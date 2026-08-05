import { supabase } from '../supabase';

export interface AssetAllocation {
  asset_id: number;
  asset_class_id: number;
  percentage: number;
}

export async function listAssetAllocations(): Promise<AssetAllocation[]> {
  const { data, error } = await supabase
    .from('asset_allocations')
    .select('asset_id, asset_class_id, percentage');

  if (error) throw error;
  return data || [];
}

export async function insertAssetAllocation(allocation: {
  asset_id: number;
  asset_class_id: number;
  percentage: number;
}): Promise<void> {
  const { error } = await supabase.from('asset_allocations').insert({
    asset_id: allocation.asset_id,
    asset_class_id: allocation.asset_class_id,
    percentage: allocation.percentage,
  });

  if (error) throw error;
}

export async function deleteAssetAllocationsByAsset(assetId: number): Promise<void> {
  const { error } = await supabase
    .from('asset_allocations')
    .delete()
    .eq('asset_id', assetId);

  if (error) throw error;
}
