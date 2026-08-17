import { supabase } from '../supabase';
import type { AssetId } from './assets';
import type { Update } from './updates';
import { throwIfError } from '../util/error';

export interface PriceUpdate {
  update_id: number;
  asset_id: AssetId;
  price: number;
}

export interface PriceUpdateWithContext {
  asset_id: AssetId;
  effective_date: string;
  price: number;
  update_id: number;
  created_by: string;
  created_at: string;
}

export async function insertPriceUpdate(price: PriceUpdate): Promise<void> {
  const { error } = await supabase.from('price_updates').insert({
    update_id: price.update_id,
    asset_id: price.asset_id,
    price: price.price,
  });

  throwIfError(error);
}

export async function listPriceUpdatesWithContext(
  order: 'asc' | 'desc' = 'desc',
): Promise<PriceUpdateWithContext[]> {
  const { data, error } = await supabase
    .from('price_updates')
    .select(
      `
      asset_id,
      price,
      update_id,
      updates!inner (
        effective_date,
        created_by,
        created_at
      )
    `,
    )
    .order('updates(effective_date)', { ascending: order === 'asc' });

  throwIfError(error);

  type PriceUpdateRow = PriceUpdate & { updates: Update };

  return ((data || []) as unknown as PriceUpdateRow[]).map((row) => ({
    asset_id: row.asset_id,
    effective_date: row.updates.effective_date,
    // PostgREST returns Postgres numeric as a string; coerce once here.
    price: parseFloat(String(row.price)),
    update_id: row.update_id,
    created_by: row.updates.created_by,
    created_at: row.updates.created_at,
  }));
}
