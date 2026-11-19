import { describe, expect, it } from 'vitest';
import {
  computePrice,
  HoldingInputSchema,
  planStatement,
  StatementError,
  type HoldingInput,
  type PlanContext,
} from '../src/statement.js';

const account = { id: 7, name: 'Brokerage' };
const VTI = { id: 1, ticker: 'VTI', name: 'Vanguard Total Stock Market' };
const TARGET = { id: 2, ticker: null, name: 'Target Retirement 2060' };

const context = (over: Partial<PlanContext> = {}): PlanContext => ({
  assets: [VTI, TARGET],
  aliases: [],
  heldAssetIds: [],
  ...over,
});

const plan = (holdings: HoldingInput[], ctx = context(), markSold = true) =>
  planStatement(
    { account, effective_date: '2026-10-31', holdings, mark_missing_as_sold: markSold },
    ctx,
  );

describe('computePrice', () => {
  it('prefers the printed price', () => {
    expect(computePrice({ name: 'x', quantity: 10, total_value: 999, price: 5 })).toBe(5);
  });
  it('derives price from value and quantity', () => {
    expect(computePrice({ name: 'x', quantity: 4, total_value: 100 })).toBe(25);
  });
  it('uses the value itself when quantity is zero', () => {
    expect(computePrice({ name: 'x', quantity: 0, total_value: 100 })).toBe(100);
  });
});

describe('HoldingInputSchema', () => {
  it('rejects a holding with neither price nor total_value', () => {
    expect(HoldingInputSchema.safeParse({ name: 'x', quantity: 1 }).success).toBe(false);
  });
  it('rejects unknown fields', () => {
    const parsed = HoldingInputSchema.safeParse({ name: 'x', quantity: 1, price: 1, shares: 1 });
    expect(parsed.success).toBe(false);
  });
});

describe('planStatement', () => {
  it('matches a printed ticker to an existing asset, ignoring case', () => {
    const [line] = plan([{ name: 'VANGUARD TOTAL', ticker: 'vti', quantity: 2, price: 300 }]).lines;
    expect(line).toMatchObject({ action: 'use-existing-asset', match: 'ticker', asset_id: 1 });
  });

  it('creates an asset for an unknown ticker, with no alias', () => {
    const [line] = plan([{ name: 'Apple', ticker: 'aapl', quantity: 1, price: 200 }]).lines;
    expect(line).toMatchObject({ action: 'create-asset', ticker: 'AAPL', new_alias: null });
  });

  it('matches a ticker-less line through an alias of this account', () => {
    const ctx = context({ aliases: [{ account_id: 7, label: 'TGT RET 2060', asset_id: 2 }] });
    const [line] = plan([{ name: ' tgt  ret 2060 ', quantity: 5, total_value: 500 }], ctx).lines;
    expect(line).toMatchObject({ action: 'use-existing-asset', match: 'alias', asset_id: 2 });
  });

  it('creates a ticker-less asset and remembers its label', () => {
    const [line] = plan([{ name: 'Stable Value Fund', quantity: 5, total_value: 500 }]).lines;
    expect(line).toMatchObject({
      action: 'create-asset',
      ticker: null,
      new_alias: 'STABLE VALUE FUND',
      price: 100,
    });
  });

  it('maps a line to an explicit asset id and remembers a ticker-less label', () => {
    const [line] = plan([{ name: 'TGT 2060', quantity: 1, price: 50, asset_id: 2 }]).lines;
    expect(line).toMatchObject({
      action: 'use-existing-asset',
      match: 'asset_id',
      asset_id: 2,
      new_alias: 'TGT 2060',
    });
  });

  it('refuses an asset id the family does not have', () => {
    expect(() => plan([{ name: 'x', quantity: 1, price: 1, asset_id: 99 }])).toThrow(
      StatementError,
    );
  });

  it('refuses two lines that land on the same existing asset', () => {
    const twice = [
      { name: 'a', ticker: 'VTI', quantity: 1, price: 1 },
      { name: 'b', ticker: 'vti', quantity: 2, price: 1 },
    ];
    expect(() => plan(twice)).toThrow(/same asset/);
  });

  it('refuses two lines that would create the same new ticker', () => {
    const twice = [
      { name: 'a', ticker: 'AAPL', quantity: 1, price: 1 },
      { name: 'b', ticker: 'AAPL', quantity: 2, price: 1 },
    ];
    expect(() => plan(twice)).toThrow(/same asset/);
  });

  it('marks held positions missing from the statement as sold', () => {
    const lines = plan(
      [{ name: 'v', ticker: 'VTI', quantity: 1, price: 1 }],
      context({ heldAssetIds: [1, 2] }),
    ).lines;
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatchObject({ action: 'mark-sold', asset_id: 2 });
  });

  it('leaves missing positions alone when asked', () => {
    const lines = plan(
      [{ name: 'v', ticker: 'VTI', quantity: 1, price: 1 }],
      context({ heldAssetIds: [1, 2] }),
      false,
    ).lines;
    expect(lines).toHaveLength(1);
  });

  it('totals the statement, counting debt as negative', () => {
    const total = plan([
      { name: 'v', ticker: 'VTI', quantity: 2, price: 300 },
      { name: 'Cash', ticker: '$CASH', quantity: 150.5, total_value: 150.5 },
      { name: 'Margin loan', ticker: '$DEBT', quantity: 100, total_value: -100 },
    ]).total_value;
    expect(total).toBe(650.5);
  });

  it('refuses an empty statement', () => {
    expect(() => plan([])).toThrow(StatementError);
  });
});
