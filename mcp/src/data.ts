/**
 * Typed reads and writes against the Cheapskate tables, through PostgREST.
 * Mirrors frontend/src/lib/data/*.ts. Postgres `numeric` arrives as a string
 * and is coerced to a number here, once.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import type { Session } from './session.js';

export interface Account {
  id: number;
  name: string;
  in_portfolio: boolean;
  is_archived: boolean;
  last4: string | null;
  institution: string | null;
  created_at: string;
}

export interface Asset {
  id: number;
  ticker: string | null;
  name: string;
}

export interface AssetAlias {
  account_id: number;
  label: string;
  asset_id: number;
}

export type UpdateType =
  'statement' | 'manual_price' | 'manual_holdings' | 'mark_as_closed' | 'include_in_portfolio';

export interface Update {
  id: number;
  account_id: number | null;
  update_type: UpdateType;
  effective_date: string;
  created_by: string;
  created_at: string;
}

export interface UpdateWithDetails extends Update {
  prices: { asset_id: number; price: number }[];
  holdings: { asset_id: number; quantity: number }[];
}

/** One holding row with the date context of its update. */
export interface HoldingAt {
  account_id: number;
  asset_id: number;
  quantity: number;
  effective_date: string;
  created_at: string;
}

/** One price row with the date context of its update. */
export interface PriceAt {
  asset_id: number;
  price: number;
  effective_date: string;
  created_at: string;
}

export class DataError extends Error {}

function check(error: PostgrestError | null, what: string): void {
  if (!error) return;
  const hint = error.hint ? ` (${error.hint})` : '';
  throw new DataError(`${what}: ${error.message}${hint}`);
}

const num = (value: unknown): number => parseFloat(String(value));

/** Uppercase and collapse whitespace, as the app does for alias keys. */
export function normalizeLabel(label: string): string {
  return label.toUpperCase().replace(/\s+/g, ' ').trim();
}

export async function listAccounts(s: Session): Promise<Account[]> {
  const { data, error } = await s.db
    .from('accounts')
    .select('id, name, in_portfolio, is_archived, last4, institution, created_at')
    .order('created_at');
  check(error, 'list accounts');
  return data ?? [];
}

export async function getAccount(s: Session, id: number): Promise<Account | null> {
  const { data, error } = await s.db
    .from('accounts')
    .select('id, name, in_portfolio, is_archived, last4, institution, created_at')
    .eq('id', id)
    .maybeSingle();
  check(error, `get account ${id}`);
  return data;
}

export async function insertAccount(
  s: Session,
  account: {
    name: string;
    in_portfolio: boolean;
    last4: string | null;
    institution: string | null;
  },
): Promise<Account> {
  const { data, error } = await s.db
    .from('accounts')
    .insert({ ...account, created_by: s.userId, family_id: s.familyId })
    .select('id, name, in_portfolio, is_archived, last4, institution, created_at')
    .single();
  check(error, `create account "${account.name}"`);
  return data as Account;
}

export async function listAssets(s: Session): Promise<Asset[]> {
  const { data, error } = await s.db.from('assets').select('id, ticker, name').order('name');
  check(error, 'list assets');
  return data ?? [];
}

export async function insertAsset(
  s: Session,
  asset: { ticker: string | null; name: string },
): Promise<Asset> {
  const { data, error } = await s.db
    .from('assets')
    .insert({ ...asset, created_by: s.userId, family_id: s.familyId })
    .select('id, ticker, name')
    .single();
  check(error, `create asset "${asset.name}"`);
  return data as Asset;
}

export async function listAliases(s: Session, accountId?: number): Promise<AssetAlias[]> {
  let request = s.db.from('asset_aliases').select('account_id, label, asset_id');
  if (accountId !== undefined) request = request.eq('account_id', accountId);
  const { data, error } = await request;
  check(error, 'list asset aliases');
  return data ?? [];
}

export async function insertAlias(s: Session, alias: AssetAlias): Promise<void> {
  const { error } = await s.db
    .from('asset_aliases')
    .insert({ ...alias, label: normalizeLabel(alias.label) });
  check(error, `create alias "${alias.label}"`);
}

type ContextRow = {
  asset_id: number;
  updates: { account_id: number | null; effective_date: string; created_at: string };
};

/** Every holding row the family has, optionally for one account. */
export async function listHoldings(s: Session, accountId?: number): Promise<HoldingAt[]> {
  let request = s.db
    .from('holding_updates')
    .select('asset_id, quantity, updates!inner (account_id, effective_date, created_at)');
  if (accountId !== undefined) request = request.eq('updates.account_id', accountId);
  const { data, error } = await request;
  check(error, 'list holdings');

  const rows = (data ?? []) as unknown as (ContextRow & { quantity: unknown })[];
  return rows.flatMap((row) =>
    row.updates.account_id == null
      ? []
      : [
          {
            account_id: row.updates.account_id,
            asset_id: row.asset_id,
            quantity: num(row.quantity),
            effective_date: row.updates.effective_date,
            created_at: row.updates.created_at,
          },
        ],
  );
}

/** Every price row the family has. Prices belong to an asset, not an account. */
export async function listPrices(s: Session): Promise<PriceAt[]> {
  const { data, error } = await s.db
    .from('price_updates')
    .select('asset_id, price, updates!inner (account_id, effective_date, created_at)');
  check(error, 'list prices');

  const rows = (data ?? []) as unknown as (ContextRow & { price: unknown })[];
  return rows.map((row) => ({
    asset_id: row.asset_id,
    price: num(row.price),
    effective_date: row.updates.effective_date,
    created_at: row.updates.created_at,
  }));
}

type UpdateRow = Update & {
  price_updates: { asset_id: number; price: unknown }[] | null;
  holding_updates: { asset_id: number; quantity: unknown }[] | null;
};

const UPDATE_COLUMNS =
  'id, account_id, update_type, effective_date, created_by, created_at, ' +
  'price_updates (asset_id, price), holding_updates (asset_id, quantity)';

function toUpdateWithDetails(row: UpdateRow): UpdateWithDetails {
  const { price_updates, holding_updates, ...update } = row;
  return {
    ...update,
    prices: (price_updates ?? []).map((p) => ({ asset_id: p.asset_id, price: num(p.price) })),
    holdings: (holding_updates ?? []).map((h) => ({
      asset_id: h.asset_id,
      quantity: num(h.quantity),
    })),
  };
}

/** Newest first, by when the update was recorded. */
export async function listUpdates(
  s: Session,
  filter: { accountId?: number; limit: number },
): Promise<UpdateWithDetails[]> {
  let request = s.db
    .from('updates')
    .select(UPDATE_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(filter.limit);
  if (filter.accountId !== undefined) request = request.eq('account_id', filter.accountId);
  const { data, error } = await request;
  check(error, 'list updates');
  return ((data ?? []) as unknown as UpdateRow[]).map(toUpdateWithDetails);
}

export async function getUpdate(s: Session, id: number): Promise<UpdateWithDetails | null> {
  const { data, error } = await s.db
    .from('updates')
    .select(UPDATE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  check(error, `get update ${id}`);
  return data ? toUpdateWithDetails(data as unknown as UpdateRow) : null;
}

export async function insertUpdate(
  s: Session,
  update: { account_id: number; update_type: UpdateType; effective_date: string },
): Promise<number> {
  const { data, error } = await s.db
    .from('updates')
    .insert({ ...update, family_id: s.familyId, created_by: s.userId })
    .select('id')
    .single();
  check(error, 'create update');
  return (data as { id: number }).id;
}

/** Deletes the update; its price and holding rows go with it (on delete cascade). */
export async function deleteUpdate(s: Session, id: number): Promise<void> {
  const { error } = await s.db.from('updates').delete().eq('id', id);
  check(error, `delete update ${id}`);
}

export async function insertPrice(
  s: Session,
  row: { update_id: number; asset_id: number; price: number },
): Promise<void> {
  const { error } = await s.db.from('price_updates').insert(row);
  check(error, `record price for asset ${row.asset_id}`);
}

export async function insertHolding(
  s: Session,
  row: { update_id: number; asset_id: number; quantity: number },
): Promise<void> {
  const { error } = await s.db.from('holding_updates').insert(row);
  check(error, `record holding for asset ${row.asset_id}`);
}
