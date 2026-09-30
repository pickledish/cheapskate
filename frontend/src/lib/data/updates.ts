import { supabase } from '../supabase';
import { type AccountId } from './accounts';
import { type AssetId } from './assets';
import { type PriceUpdate } from './price-updates';
import { type HoldingUpdate } from './holding-updates';
import { throwIfError } from '../util/error';

export type UpdateType =
  'statement' | 'manual_price' | 'manual_holdings' | 'mark_as_closed' | 'include_in_portfolio';

export interface Update {
  id: number;
  family_id: string;
  account_id: AccountId | null;
  update_type: UpdateType;
  effective_date: string;
  created_by: string;
  created_at: string;
}

export interface UpdateWithDetails extends Update {
  prices: PriceUpdate[];
  holdings: HoldingUpdate[];
}

export async function listUpdates(): Promise<Update[]> {
  const { data, error } = await supabase
    .from('updates')
    .select('*')
    .order('effective_date', { ascending: false });

  throwIfError(error);
  return data || [];
}

type UpdateRow = Update & {
  price_updates: PriceUpdate[] | null;
  holding_updates: HoldingUpdate[] | null;
};

function mapUpdateRows(data: UpdateRow[] | null): UpdateWithDetails[] {
  return (data || []).map((row) => ({
    id: row.id,
    family_id: row.family_id,
    account_id: row.account_id,
    update_type: row.update_type,
    effective_date: row.effective_date,
    created_by: row.created_by,
    created_at: row.created_at,
    prices: row.price_updates || [],
    holdings: row.holding_updates || [],
  }));
}

export type UpdateHistoryQuery =
  | { scope: 'month'; year: number; month: number }
  | { scope: 'account'; accountId: AccountId }
  | { scope: 'asset'; assetId: AssetId };

export async function listUpdatesWithDetails(
  query: UpdateHistoryQuery,
): Promise<UpdateWithDetails[]> {
  if (query.scope === 'asset') {
    // price_match is only the join. price_updates stays unfiltered so a statement
    // still returns every price on that update.
    const { data, error } = await supabase
      .from('updates')
      .select('*, price_match:price_updates!inner(asset_id), price_updates(*), holding_updates(*)')
      .eq('price_match.asset_id', query.assetId)
      .order('created_at', { ascending: false });

    throwIfError(error);
    return mapUpdateRows(data as UpdateRow[] | null);
  }

  let request = supabase
    .from('updates')
    .select('*, price_updates (*), holding_updates (*)')
    .order('created_at', { ascending: false });

  if (query.scope === 'month') {
    const startDate = `${query.year}-${String(query.month).padStart(2, '0')}-01`;
    const nextMonth = query.month === 12 ? 1 : query.month + 1;
    const nextYear = query.month === 12 ? query.year + 1 : query.year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
    request = request.gte('created_at', startDate).lt('created_at', endDate);
  } else {
    request = request.eq('account_id', query.accountId);
  }

  const { data, error } = await request;
  throwIfError(error);
  return mapUpdateRows(data as UpdateRow[] | null);
}

export async function listUpdatesByAccount(accountId: AccountId): Promise<Update[]> {
  const { data, error } = await supabase
    .from('updates')
    .select('*')
    .eq('account_id', accountId)
    .order('effective_date', { ascending: false });

  throwIfError(error);
  return data || [];
}

export async function insertUpdate(update: {
  family_id: string;
  account_id: AccountId | null;
  update_type: UpdateType;
  effective_date: string;
  created_by: string;
  /** Defaults to now() in the database. Only backfills should set this. */
  created_at?: string;
}): Promise<Update> {
  const { data, error } = await supabase
    .from('updates')
    .insert({
      family_id: update.family_id,
      account_id: update.account_id,
      update_type: update.update_type,
      effective_date: update.effective_date,
      created_by: update.created_by,
      ...(update.created_at ? { created_at: update.created_at } : {}),
    })
    .select()
    .single();

  throwIfError(error);
  return data;
}

export async function deleteUpdate(id: number): Promise<void> {
  const { error } = await supabase.from('updates').delete().eq('id', id);

  throwIfError(error);
}
