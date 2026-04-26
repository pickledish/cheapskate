import { supabase } from '../supabase'

export interface AssetAllocation {
  asset_id: number
  asset_class_id: number
  percentage: number
}

export interface AssetAllocationWithClass extends AssetAllocation {
  asset_classes: {
    name: string
    color: string
    sort_order: number
  }
}

export async function listAssetAllocations(): Promise<AssetAllocation[]> {
  const { data, error } = await supabase
    .from('asset_allocations')
    .select('asset_id, asset_class_id, percentage')

  if (error) throw error
  return data || []
}

export async function listAssetAllocationsByAsset(assetId: number): Promise<AssetAllocation[]> {
  const { data, error } = await supabase
    .from('asset_allocations')
    .select('asset_id, asset_class_id, percentage')
    .eq('asset_id', assetId)

  if (error) throw error
  return data || []
}

export async function listAssetAllocationsWithClass(): Promise<AssetAllocationWithClass[]> {
  const { data, error } = await supabase
    .from('asset_allocations')
    .select('asset_id, asset_class_id, percentage, asset_classes(name, color, sort_order)')

  if (error) throw error
  return (data || []) as unknown as AssetAllocationWithClass[]
}

export async function insertAssetAllocation(allocation: {
  asset_id: number
  asset_class_id: number
  percentage: number
}): Promise<void> {
  const { error } = await supabase
    .from('asset_allocations')
    .insert({
      asset_id: allocation.asset_id,
      asset_class_id: allocation.asset_class_id,
      percentage: allocation.percentage
    })

  if (error) throw error
}

export async function deleteAssetAllocationsByAsset(assetId: number): Promise<void> {
  const { error } = await supabase
    .from('asset_allocations')
    .delete()
    .eq('asset_id', assetId)

  if (error) throw error
}
