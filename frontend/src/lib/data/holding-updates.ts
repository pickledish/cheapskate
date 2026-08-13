import { supabase } from '../supabase';
import type { AccountId } from './accounts';
import type { AssetId } from './assets';
import type { Update } from './updates';

export interface HoldingUpdate {
  update_id: number;
  asset_id: AssetId;
  quantity: number;
}

export interface HoldingUpdateWithContext {
  asset_id: AssetId;
  account_id: AccountId;
  effective_date: string;
  quantity: number;
  update_id: number;
  created_by: string;
  created_at: string;
}

type HoldingUpdateRow = HoldingUpdate & { updates: Update };

function mapHoldingUpdateRow(row: HoldingUpdateRow): HoldingUpdateWithContext {
  const accountId = row.updates.account_id;
  if (accountId == null) {
    throw new Error(`holding update ${row.update_id} is missing account_id`);
  }

  return {
    asset_id: row.asset_id,
    account_id: accountId,
    effective_date: row.updates.effective_date,
    // PostgREST returns Postgres numeric as a string; coerce once here.
    quantity: parseFloat(String(row.quantity)),
    update_id: row.update_id,
    created_by: row.updates.created_by,
    created_at: row.updates.created_at,
  };
}

export async function insertHoldingUpdate(holding: HoldingUpdate): Promise<void> {
  const { error } = await supabase.from('holding_updates').insert({
    update_id: holding.update_id,
    asset_id: holding.asset_id,
    quantity: holding.quantity,
  });

  if (error) throw error;
}

export async function listHoldingUpdatesWithContext(
  order: 'asc' | 'desc' = 'desc',
): Promise<HoldingUpdateWithContext[]> {
  const { data, error } = await supabase
    .from('holding_updates')
    .select(
      `
      asset_id,
      quantity,
      update_id,
      updates!inner (
        account_id,
        effective_date,
        created_by,
        created_at
      )
    `,
    )
    .order('updates(effective_date)', { ascending: order === 'asc' });

  if (error) throw error;

  return ((data || []) as unknown as HoldingUpdateRow[]).map(mapHoldingUpdateRow);
}

export async function listHoldingUpdatesByAccount(
  accountId: AccountId,
  order: 'asc' | 'desc' = 'desc',
): Promise<HoldingUpdateWithContext[]> {
  const { data, error } = await supabase
    .from('holding_updates')
    .select(
      `
      asset_id,
      quantity,
      update_id,
      updates!inner (
        account_id,
        effective_date,
        created_by,
        created_at
      )
    `,
    )
    .eq('updates.account_id', accountId)
    .order('updates(effective_date)', { ascending: order === 'asc' });

  if (error) throw error;

  return ((data || []) as unknown as HoldingUpdateRow[]).map(mapHoldingUpdateRow);
}
