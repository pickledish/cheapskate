/**
 * Every operation the tool offers, in one list. The CLI and the MCP server are
 * both generated from it, so they cannot drift apart.
 */
import { z } from 'zod';
import * as data from './data.js';
import { latestBy } from './latest.js';
import type { Session } from './session.js';
import {
  applyStatement,
  HoldingInputSchema,
  planStatement,
  type PlanContext,
  type StatementPlan,
} from './statement.js';

export class OperationError extends Error {}

export interface Operation<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  /** True if it can change data. */
  writes: boolean;
  input: Shape;
  run(session: Session, input: z.infer<z.ZodObject<Shape>>): Promise<unknown>;
}

function operation<Shape extends z.ZodRawShape>(op: Operation<Shape>): Operation {
  return op as unknown as Operation;
}

const accountId = z.number().int().positive().describe('Account id, from list_accounts.');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), 'not a real date');

async function requireAccount(s: Session, id: number): Promise<data.Account> {
  const account = await data.getAccount(s, id);
  if (!account) throw new OperationError(`No account with id ${id} in this family`);
  return account;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Accounts with what each currently holds, valued at the latest known price. */
async function accountsWithHoldings(s: Session) {
  const [accounts, assets, holdings, prices] = await Promise.all([
    data.listAccounts(s),
    data.listAssets(s),
    data.listHoldings(s),
    data.listPrices(s),
  ]);
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const latestPrice = latestBy(prices, (p) => String(p.asset_id));
  const latestHolding = latestBy(holdings, (h) => `${h.account_id}-${h.asset_id}`);

  return accounts.map((account) => {
    const held = [...latestHolding.values()]
      .filter((h) => h.account_id === account.id && h.quantity !== 0)
      .map((h) => {
        const asset = assetsById.get(h.asset_id);
        const price = latestPrice.get(String(h.asset_id))?.price ?? null;
        return {
          asset_id: h.asset_id,
          name: asset?.name ?? null,
          ticker: asset?.ticker ?? null,
          quantity: h.quantity,
          price,
          value: price == null ? null : round2(h.quantity * price),
          as_of: h.effective_date,
        };
      });
    return {
      ...account,
      holdings: held,
      total_value: round2(held.reduce((sum, h) => sum + (h.value ?? 0), 0)),
    };
  });
}

async function planContext(s: Session, account: number): Promise<PlanContext> {
  const [assets, aliases, holdings] = await Promise.all([
    data.listAssets(s),
    data.listAliases(s, account),
    data.listHoldings(s, account),
  ]);
  const latest = latestBy(holdings, (h) => String(h.asset_id));
  const heldAssetIds = [...latest.values()].filter((h) => h.quantity > 0).map((h) => h.asset_id);
  return { assets, aliases, heldAssetIds };
}

async function assertNoStatementOnDate(s: Session, plan: StatementPlan): Promise<void> {
  const updates = await data.listUpdates(s, { accountId: plan.account_id, limit: 1000 });
  const clash = updates.find(
    (u) => u.update_type === 'statement' && u.effective_date === plan.effective_date,
  );
  if (clash) {
    throw new OperationError(
      `${plan.account} already has a statement dated ${plan.effective_date} (update ${clash.id}). ` +
        'Undo it first, or pass allow_duplicate_date.',
    );
  }
}

export const OPERATIONS: Operation[] = [
  operation({
    name: 'whoami',
    description: 'Show which Cheapskate instance, user and family this tool is signed in to.',
    writes: false,
    input: {},
    run: async (s) => ({
      url: s.url,
      email: s.email,
      user_id: s.userId,
      family_id: s.familyId,
      read_only: s.readOnly,
    }),
  }),

  operation({
    name: 'list_accounts',
    description:
      'List the family’s accounts with their current holdings, valued at the latest known price. Call this before any write.',
    writes: false,
    input: {},
    run: (s) => accountsWithHoldings(s),
  }),

  operation({
    name: 'list_assets',
    description:
      'List the family’s asset catalog (id, name, ticker) and the per-account labels that map to each asset.',
    writes: false,
    input: {},
    run: async (s) => {
      const [assets, aliases] = await Promise.all([data.listAssets(s), data.listAliases(s)]);
      return assets.map((asset) => ({
        ...asset,
        aliases: aliases
          .filter((alias) => alias.asset_id === asset.id)
          .map(({ account_id, label }) => ({ account_id, label })),
      }));
    },
  }),

  operation({
    name: 'create_account',
    description:
      'Create an account (a brokerage, retirement or private account). Refuses a name that already exists unless allow_duplicate_name is set.',
    writes: true,
    input: {
      name: z.string().trim().min(1).describe('Account name as it should appear in the app.'),
      institution: z.string().trim().min(1).optional().describe('For example Fidelity or Schwab.'),
      last4: z
        .string()
        .regex(/^\d{4}$/, 'exactly four digits')
        .optional()
        .describe('Last four digits of the account number. Never the full number.'),
      in_portfolio: z
        .boolean()
        .default(true)
        .describe('Whether the account counts toward the portfolio and its rebalancing.'),
      allow_duplicate_name: z
        .boolean()
        .default(false)
        .describe('Create it even if an account with this name exists.'),
    },
    run: async (s, input) => {
      const wanted = input.name.toLowerCase();
      const existing = (await data.listAccounts(s)).find((a) => a.name.toLowerCase() === wanted);
      if (existing && !input.allow_duplicate_name) {
        throw new OperationError(`An account named "${existing.name}" exists (id ${existing.id})`);
      }
      return data.insertAccount(s, {
        name: input.name,
        in_portfolio: input.in_portfolio,
        last4: input.last4 ?? null,
        institution: input.institution ?? null,
      });
    },
  }),

  operation({
    name: 'record_statement',
    description:
      'Record every holding in one account as of a date, as one undoable update. This is a full snapshot: positions the account holds that are not listed are recorded as sold, unless mark_missing_as_sold is false. Run with dry_run first and show the plan to the user before writing.',
    writes: true,
    input: {
      account_id: accountId,
      effective_date: isoDate.describe('Statement date, YYYY-MM-DD.'),
      holdings: z
        .array(HoldingInputSchema)
        .min(1)
        .describe(
          'Every position in the account on that date: name, ticker, quantity, and price or total_value.',
        ),
      dry_run: z
        .boolean()
        .default(false)
        .describe('Return the plan (what would be created and written) and write nothing.'),
      mark_missing_as_sold: z
        .boolean()
        .default(true)
        .describe(
          'Record positions the account holds but the statement omits as sold. Switch off for a partial list.',
        ),
      allow_duplicate_date: z
        .boolean()
        .default(false)
        .describe('Allow a second statement for the same account and date.'),
    },
    run: async (s, input) => {
      const account = await requireAccount(s, input.account_id);
      const plan = planStatement(
        {
          account,
          effective_date: input.effective_date,
          holdings: input.holdings,
          mark_missing_as_sold: input.mark_missing_as_sold,
        },
        await planContext(s, account.id),
      );
      if (!input.allow_duplicate_date) await assertNoStatementOnDate(s, plan);
      if (input.dry_run) return { dry_run: true, written: false, plan };

      const updateId = await applyStatement(s, plan);
      return { dry_run: false, written: true, update_id: updateId, plan };
    },
  }),

  operation({
    name: 'list_updates',
    description:
      'List recent history (statements and manual changes), newest first, with the prices and holdings each one wrote.',
    writes: false,
    input: {
      account_id: accountId.optional(),
      limit: z.number().int().min(1).max(200).default(20),
    },
    run: (s, input) => data.listUpdates(s, { accountId: input.account_id, limit: input.limit }),
  }),

  operation({
    name: 'undo_update',
    description:
      'Delete one update and the prices and holdings it wrote, as the History page’s undo does. Assets and accounts are kept.',
    writes: true,
    input: {
      update_id: z.number().int().positive().describe('From record_statement or list_updates.'),
    },
    run: async (s, input) => {
      const update = await data.getUpdate(s, input.update_id);
      if (!update) throw new OperationError(`No update with id ${input.update_id} in this family`);
      await data.deleteUpdate(s, update.id);
      return { undone: true, update };
    },
  }),
];

export function findOperation(name: string): Operation | undefined {
  return OPERATIONS.find((op) => op.name === name);
}

/** Validate raw input against the operation's schema, then run it. */
export async function runOperation(
  op: Operation,
  session: Session,
  raw: unknown,
): Promise<unknown> {
  const parsed = z
    .object(op.input)
    .strict()
    .safeParse(raw ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`);
    throw new OperationError(`Invalid input for ${op.name}: ${problems.join('; ')}`);
  }
  return op.run(session, parsed.data);
}
