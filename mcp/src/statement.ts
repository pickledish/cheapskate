/**
 * Recording a statement: a full snapshot of one account's holdings on a date.
 *
 * `planStatement` is pure: it decides what would be written. `applyStatement`
 * writes it. The split is what makes a dry run trustworthy: both paths use the
 * same plan. The rules mirror UploadStatementModal.vue in the web app.
 */
import { z } from 'zod';
import * as data from './data.js';
import { normalizeLabel, type Asset, type AssetAlias } from './data.js';
import type { Session } from './session.js';

export const HoldingInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .describe('Security name exactly as printed on the source. Do not normalize it.'),
    ticker: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional()
      .describe(
        "Ticker only if the source prints one; never guess. Use '$CASH' for cash and '$DEBT' for a liability.",
      ),
    quantity: z
      .number()
      .finite()
      .describe('Shares or units. For $CASH and $DEBT this is the dollar amount.'),
    total_value: z
      .number()
      .finite()
      .optional()
      .describe('Market value in dollars. Negative for $DEBT. Required unless price is given.'),
    price: z
      .number()
      .finite()
      .optional()
      .describe('Per-unit price if the source prints it. Otherwise computed from total_value.'),
    asset_id: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Map this line to an existing asset by id, overriding ticker and name matching.'),
  })
  .strict()
  .refine((h) => h.price !== undefined || h.total_value !== undefined, {
    message: 'each holding needs price or total_value',
  });

export type HoldingInput = z.infer<typeof HoldingInputSchema>;

/** How a statement line found its asset. */
export type Match = 'asset_id' | 'ticker' | 'alias';

export type PlanLine =
  | {
      action: 'use-existing-asset';
      match: Match;
      asset_id: number;
      asset: string;
      quantity: number;
      price: number;
      /** Label to remember for this account, when the line had no ticker. */
      new_alias: string | null;
    }
  | {
      action: 'create-asset';
      name: string;
      ticker: string | null;
      quantity: number;
      price: number;
      /** A ticker-less asset is remembered by its label for this account. */
      new_alias: string | null;
    }
  | { action: 'mark-sold'; asset_id: number; asset: string };

export interface StatementPlan {
  account_id: number;
  account: string;
  effective_date: string;
  lines: PlanLine[];
  total_value: number;
}

/** What the family already has, as far as planning needs it. */
export interface PlanContext {
  assets: Asset[];
  /** Aliases of the target account only. */
  aliases: AssetAlias[];
  /** Asset ids the account currently holds with a quantity above zero. */
  heldAssetIds: number[];
}

export class StatementError extends Error {}

const displayAsset = (a: Asset): string => (a.ticker ? `${a.name} (${a.ticker})` : a.name);

/** Same rule as the web app: printed price, else value per unit, else the value itself. */
export function computePrice(h: HoldingInput): number {
  if (h.price !== undefined) return h.price;
  const total = h.total_value as number;
  return h.quantity !== 0 ? total / h.quantity : total;
}

function existingLine(h: HoldingInput, asset: Asset, match: Match, alias: boolean): PlanLine {
  return {
    action: 'use-existing-asset',
    match,
    asset_id: asset.id,
    asset: displayAsset(asset),
    quantity: h.quantity,
    price: computePrice(h),
    new_alias: alias ? normalizeLabel(h.name) : null,
  };
}

interface Lookups {
  byId: Map<number, Asset>;
  byTicker: Map<string, Asset>;
  byLabel: Map<string, Asset>;
}

function buildLookups(context: PlanContext): Lookups {
  const byId = new Map(context.assets.map((a) => [a.id, a]));
  const byTicker = new Map(
    context.assets.flatMap((a) => (a.ticker ? [[a.ticker.toUpperCase(), a] as const] : [])),
  );
  const byLabel = new Map(
    context.aliases.flatMap((alias) => {
      const asset = byId.get(alias.asset_id);
      return asset ? [[alias.label, asset] as const] : [];
    }),
  );
  return { byId, byTicker, byLabel };
}

/** Explicit id first, then printed ticker, then a label this account has used before. */
function resolveLine(h: HoldingInput, lookups: Lookups): PlanLine {
  const label = normalizeLabel(h.name);
  const ticker = h.ticker ? h.ticker.toUpperCase() : null;

  if (h.asset_id !== undefined) {
    const asset = lookups.byId.get(h.asset_id);
    if (!asset) throw new StatementError(`"${h.name}": no asset with id ${h.asset_id}`);
    return existingLine(h, asset, 'asset_id', !ticker && !lookups.byLabel.has(label));
  }

  if (ticker) {
    const asset = lookups.byTicker.get(ticker);
    if (asset) return existingLine(h, asset, 'ticker', false);
    return {
      action: 'create-asset',
      name: h.name,
      ticker,
      quantity: h.quantity,
      price: computePrice(h),
      new_alias: null,
    };
  }

  const aliased = lookups.byLabel.get(label);
  if (aliased) return existingLine(h, aliased, 'alias', false);
  return {
    action: 'create-asset',
    name: h.name,
    ticker: null,
    quantity: h.quantity,
    price: computePrice(h),
    new_alias: label,
  };
}

/** A key that is equal for two lines that would land on the same asset. */
function assetKey(line: PlanLine): string {
  if (line.action !== 'create-asset') return `id:${line.asset_id}`;
  return line.ticker ? `ticker:${line.ticker}` : `label:${line.new_alias}`;
}

function assertNoDuplicates(lines: PlanLine[]): void {
  const seen = new Set<string>();
  for (const line of lines) {
    const key = assetKey(line);
    if (seen.has(key)) {
      const what = line.action === 'create-asset' ? line.name : line.asset;
      throw new StatementError(
        `Two holdings resolve to the same asset (${what}). Combine them or map one with asset_id.`,
      );
    }
    seen.add(key);
  }
}

/** Held positions the statement does not mention are recorded at quantity zero. */
function soldLines(lines: PlanLine[], context: PlanContext, lookups: Lookups): PlanLine[] {
  const present = new Set(lines.flatMap((l) => (l.action === 'create-asset' ? [] : [l.asset_id])));
  return context.heldAssetIds.flatMap((id) => {
    const asset = lookups.byId.get(id);
    return asset && !present.has(id)
      ? [{ action: 'mark-sold' as const, asset_id: id, asset: displayAsset(asset) }]
      : [];
  });
}

const lineValue = (line: PlanLine): number =>
  line.action === 'mark-sold' ? 0 : line.quantity * line.price;

export function planStatement(
  input: {
    account: { id: number; name: string };
    effective_date: string;
    holdings: HoldingInput[];
    mark_missing_as_sold: boolean;
  },
  context: PlanContext,
): StatementPlan {
  if (input.holdings.length === 0) throw new StatementError('No holdings to record');

  const lookups = buildLookups(context);
  const lines = input.holdings.map((h) => resolveLine(h, lookups));
  assertNoDuplicates(lines);
  if (input.mark_missing_as_sold) lines.push(...soldLines(lines, context, lookups));

  return {
    account_id: input.account.id,
    account: input.account.name,
    effective_date: input.effective_date,
    lines,
    total_value: Math.round(lines.reduce((sum, l) => sum + lineValue(l), 0) * 100) / 100,
  };
}

/** Create whatever the line needs and return the asset id it lands on. */
async function materializeAsset(s: Session, accountId: number, line: PlanLine): Promise<number> {
  if (line.action === 'mark-sold') return line.asset_id;

  const assetId =
    line.action === 'use-existing-asset'
      ? line.asset_id
      : (await data.insertAsset(s, { ticker: line.ticker, name: line.name })).id;

  if (line.new_alias) {
    await data.insertAlias(s, { account_id: accountId, label: line.new_alias, asset_id: assetId });
  }
  return assetId;
}

async function writeLine(s: Session, plan: StatementPlan, updateId: number, line: PlanLine) {
  const assetId = await materializeAsset(s, plan.account_id, line);
  if (line.action !== 'mark-sold') {
    await data.insertPrice(s, { update_id: updateId, asset_id: assetId, price: line.price });
  }
  await data.insertHolding(s, {
    update_id: updateId,
    asset_id: assetId,
    quantity: line.action === 'mark-sold' ? 0 : line.quantity,
  });
}

/**
 * Write the plan as one `statement` update and return its id. If any line
 * fails, the update is deleted (taking its rows with it) and the error is
 * rethrown. Assets and aliases created before the failure stay, as in the app.
 */
export async function applyStatement(s: Session, plan: StatementPlan): Promise<number> {
  const updateId = await data.insertUpdate(s, {
    account_id: plan.account_id,
    update_type: 'statement',
    effective_date: plan.effective_date,
  });

  try {
    for (const line of plan.lines) await writeLine(s, plan, updateId, line);
  } catch (err) {
    await data.deleteUpdate(s, updateId);
    throw err;
  }
  return updateId;
}
