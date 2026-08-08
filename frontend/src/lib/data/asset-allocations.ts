import { supabase } from '../supabase';
import type { AssetClassId } from './asset-classes';
import type { AssetId } from './assets';

export interface AssetAllocation {
  asset_id: AssetId;
  asset_class_id: AssetClassId;
  percentage: number;
}

export async function listAssetAllocations(): Promise<AssetAllocation[]> {
  const { data, error } = await supabase
    .from('asset_allocations')
    .select('asset_id, asset_class_id, percentage');

  if (error) throw error;
  return (data || []).map((row) => ({
    asset_id: row.asset_id,
    asset_class_id: row.asset_class_id,
    // PostgREST returns Postgres numeric as a string; coerce once here.
    percentage: parseFloat(String(row.percentage)),
  }));
}

export async function insertAssetAllocation(allocation: AssetAllocation): Promise<void> {
  const { error } = await supabase.from('asset_allocations').insert({
    asset_id: allocation.asset_id,
    asset_class_id: allocation.asset_class_id,
    percentage: allocation.percentage,
  });

  if (error) throw error;
}

export async function deleteAssetAllocationsByAsset(assetId: AssetId): Promise<void> {
  const { error } = await supabase.from('asset_allocations').delete().eq('asset_id', assetId);

  if (error) throw error;
}
