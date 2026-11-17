import { beforeAll, describe, expect, it } from 'vitest';
import { findOperation, OperationError, runOperation } from '../src/operations.js';
import { signIn, type Session } from '../src/session.js';
import { createUser, failingOn, newFamilySession, rowCounts } from './helpers.js';

/** Run an operation by name with raw input, as the CLI and MCP server do. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- results are checked by the assertions
async function run(s: Session, name: string, input: unknown = {}): Promise<any> {
  const op = findOperation(name);
  if (!op) throw new Error(`no operation ${name}`);
  return runOperation(op, s, input);
}

const OCTOBER = [
  { name: 'Vanguard Total Stock Market ETF', ticker: 'VTI', quantity: 10, price: 300 },
  { name: 'Target Retirement 2060 Trust', quantity: 4, total_value: 1000 },
  { name: 'Cash', ticker: '$CASH', quantity: 250.75, total_value: 250.75 },
];

describe('against a real backend', () => {
  let s: Session;
  let accountId: number;

  beforeAll(async () => {
    s = await newFamilySession();
    accountId = (await run(s, 'create_account', { name: 'Brokerage', institution: 'Fidelity' })).id;
  });

  it('whoami reports the user and family, and no secrets', async () => {
    const me = await run(s, 'whoami');
    expect(me).toMatchObject({ email: s.email, family_id: s.familyId, read_only: false });
    expect(JSON.stringify(me)).not.toMatch(/password|anon/i);
  });

  it('create_account stores the account (requirement 1)', async () => {
    const accounts = await run(s, 'list_accounts');
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: accountId,
      name: 'Brokerage',
      institution: 'Fidelity',
      last4: null,
      in_portfolio: true,
      holdings: [],
    });
  });

  it('create_account refuses a duplicate name unless told otherwise', async () => {
    await expect(run(s, 'create_account', { name: 'brokerage' })).rejects.toThrow(/exists/);
    const second = await run(s, 'create_account', {
      name: 'Brokerage',
      allow_duplicate_name: true,
    });
    expect(second.id).not.toBe(accountId);
  });

  it('create_account refuses a full account number as last4', async () => {
    await expect(run(s, 'create_account', { name: 'X', last4: '123456789' })).rejects.toThrow(
      /four digits/,
    );
  });

  it('a dry run writes nothing (requirement 6)', async () => {
    const before = await rowCounts(s);
    const result = await run(s, 'record_statement', {
      account_id: accountId,
      effective_date: '2026-10-31',
      holdings: OCTOBER,
      dry_run: true,
    });
    expect(result).toMatchObject({ dry_run: true, written: false });
    expect(result.plan.lines.map((l: { action: string }) => l.action)).toEqual([
      'create-asset',
      'create-asset',
      'create-asset',
    ]);
    expect(result.plan.total_value).toBe(4250.75);
    expect(await rowCounts(s)).toEqual(before);
  });

  let octoberUpdate: number;

  it('record_statement writes holdings, prices and one update (requirement 2)', async () => {
    const result = await run(s, 'record_statement', {
      account_id: accountId,
      effective_date: '2026-10-31',
      holdings: OCTOBER,
    });
    expect(result.written).toBe(true);
    octoberUpdate = result.update_id;

    const account = (await run(s, 'list_accounts')).find((a: { id: number }) => a.id === accountId);
    expect(account.total_value).toBe(4250.75);
    const byName = Object.fromEntries(account.holdings.map((h: { name: string }) => [h.name, h]));
    expect(byName['Vanguard Total Stock Market ETF']).toMatchObject({
      ticker: 'VTI',
      quantity: 10,
      price: 300,
      value: 3000,
      as_of: '2026-10-31',
    });
    expect(byName['Target Retirement 2060 Trust']).toMatchObject({ ticker: null, price: 250 });

    const [update] = await run(s, 'list_updates', { account_id: accountId });
    expect(update).toMatchObject({ id: octoberUpdate, update_type: 'statement' });
    expect(update.holdings).toHaveLength(3);
    expect(update.prices).toHaveLength(3);
  });

  it('a ticker-less asset is remembered by its label for that account', async () => {
    const assets = await run(s, 'list_assets');
    const target = assets.find((a: { name: string }) => a.name === 'Target Retirement 2060 Trust');
    expect(target.aliases).toEqual([
      { account_id: accountId, label: 'TARGET RETIREMENT 2060 TRUST' },
    ]);
  });

  it('refuses a second statement for the same account and date', async () => {
    const again = { account_id: accountId, effective_date: '2026-10-31', holdings: OCTOBER };
    await expect(run(s, 'record_statement', again)).rejects.toThrow(/already has a statement/);
    await expect(run(s, 'record_statement', { ...again, dry_run: true })).rejects.toThrow(
      /already has a statement/,
    );
  });

  it('a later statement reuses assets and marks missing positions sold', async () => {
    const before = await rowCounts(s);
    const result = await run(s, 'record_statement', {
      account_id: accountId,
      effective_date: '2026-11-30',
      holdings: [
        { name: 'VANGUARD TOTAL STK MKT', ticker: 'vti', quantity: 12, price: 310 },
        { name: 'target  retirement 2060 trust', quantity: 4, total_value: 1040 },
      ],
    });
    expect(result.plan.lines.map((l: { action: string }) => l.action)).toEqual([
      'use-existing-asset',
      'use-existing-asset',
      'mark-sold',
    ]);
    const after = await rowCounts(s);
    expect(after.assets).toBe(before.assets);
    expect(after.asset_aliases).toBe(before.asset_aliases);

    const account = (await run(s, 'list_accounts')).find((a: { id: number }) => a.id === accountId);
    expect(account.holdings.map((h: { ticker: string | null }) => h.ticker).sort()).toEqual([
      'VTI',
      null,
    ]);
    expect(account.total_value).toBe(12 * 310 + 1040);
  });

  it('undo_update removes the statement and its rows (requirement 3)', async () => {
    const [latest] = await run(s, 'list_updates', { account_id: accountId, limit: 1 });
    const before = await rowCounts(s);
    const undone = await run(s, 'undo_update', { update_id: latest.id });
    expect(undone.undone).toBe(true);

    const after = await rowCounts(s);
    expect(after.updates).toBe(before.updates - 1);
    expect(after.holding_updates).toBe(before.holding_updates - 3);
    expect(after.price_updates).toBe(before.price_updates - 2);

    const account = (await run(s, 'list_accounts')).find((a: { id: number }) => a.id === accountId);
    expect(account.total_value).toBe(4250.75);
    await expect(run(s, 'undo_update', { update_id: latest.id })).rejects.toThrow(OperationError);
  });

  it('a write that fails part-way leaves no update behind', async () => {
    const before = await rowCounts(s);
    const statement = {
      account_id: accountId,
      effective_date: '2026-12-31',
      holdings: OCTOBER,
    };
    const broken = failingOn(s, 'holding_updates', 2);
    await expect(run(broken, 'record_statement', statement)).rejects.toThrow(/injected failure/);
    expect(await rowCounts(s)).toEqual(before);
  });

  it('rejects input the schema does not allow', async () => {
    const bad = { account_id: accountId, effective_date: '31/10/2026', holdings: OCTOBER };
    await expect(run(s, 'record_statement', bad)).rejects.toThrow(/YYYY-MM-DD/);
    await expect(run(s, 'list_accounts', { extra: 1 })).rejects.toThrow(/Invalid input/);
  });

  describe('family isolation (requirement 4)', () => {
    let outsider: Session;
    beforeAll(async () => {
      outsider = await newFamilySession();
    });

    it('a user in another family sees none of this family’s data', async () => {
      expect(await run(outsider, 'list_accounts')).toEqual([]);
      expect(await run(outsider, 'list_assets')).toEqual([]);
      expect(await run(outsider, 'list_updates')).toEqual([]);
    });

    it('a user in another family cannot write to this family’s account', async () => {
      const before = await rowCounts(s);
      const attempt = { account_id: accountId, effective_date: '2026-09-30', holdings: OCTOBER };
      await expect(run(outsider, 'record_statement', attempt)).rejects.toThrow(/No account/);
      await expect(run(outsider, 'undo_update', { update_id: octoberUpdate })).rejects.toThrow(
        /No update/,
      );
      expect(await rowCounts(s)).toEqual(before);
    });

    it('the database itself refuses a cross-family insert', async () => {
      const forged = await outsider.db.from('updates').insert({
        family_id: s.familyId,
        account_id: accountId,
        update_type: 'statement',
        effective_date: '2026-09-30',
        created_by: outsider.userId,
      });
      expect(forged.error).not.toBeNull();
    });

    it('a second member of the same family sees the same accounts', async () => {
      const member = await signIn(await createUser(s.familyId));
      const accounts = await run(member, 'list_accounts');
      expect(accounts.map((a: { id: number }) => a.id)).toContain(accountId);
    });
  });
});
