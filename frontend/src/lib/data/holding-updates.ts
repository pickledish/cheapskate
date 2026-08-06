import { supabase } from '../supabase';

export interface HoldingUpdate {
  update_id: number;
  asset_id: number;
  quantity: number;
}

export interface HoldingUpdateWithContext {
  asset_id: number;
  account_id: number;
  effective_date: string;
  quantity: number;
  update_id: number;
  created_by: string;
  created_at: string;
}

type HoldingUpdateRow = {
  asset_id: number;
  quantity: number;
  update_id: number;
  updates: {
    account_id: number;
    effective_date: string;
    created_by: string;
    created_at: string;
  };
};

function mapHoldingUpdateRow(row: HoldingUpdateRow): HoldingUpdateWithContext {
  return {
    asset_id: row.asset_id,
    account_id: row.updates.account_id,
    effective_date: row.updates.effective_date,
    quantity: row.quantity,
    update_id: row.update_id,
    created_by: row.updates.created_by,
    created_at: row.updates.created_at,
  };
}

export async function insertHoldingUpdate(holding: {
  update_id: number;
  asset_id: number;
  quantity: number;
}): Promise<void> {
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
  accountId: number,
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
