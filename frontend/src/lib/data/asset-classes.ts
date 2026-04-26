import { supabase } from '../supabase'

export interface AssetClass {
  id: number
  name: string
  color: string
  goal: number
  sort_order: number
  created_by: string
  created_at: string
  family_id: string
}

export async function listAssetClasses(): Promise<AssetClass[]> {
  const { data, error } = await supabase
    .from('asset_classes')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return data || []
}

export async function getAssetClass(id: number): Promise<AssetClass | null> {
  const { data, error } = await supabase
    .from('asset_classes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function getMaxSortOrder(familyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('asset_classes')
    .select('sort_order')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return -1
    throw error
  }
  return data?.sort_order ?? -1
}

export async function insertAssetClass(assetClass: {
  name: string
  color: string
  goal: number
  sort_order: number
  created_by: string
  family_id: string
}): Promise<AssetClass> {
  const { data, error } = await supabase
    .from('asset_classes')
    .insert({
      name: assetClass.name,
      color: assetClass.color,
      goal: assetClass.goal,
      sort_order: assetClass.sort_order,
      created_by: assetClass.created_by,
      family_id: assetClass.family_id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAssetClass(id: number, updates: {
  name?: string
  color?: string
  goal?: number
  sort_order?: number
}): Promise<void> {
  const { error } = await supabase
    .from('asset_classes')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function updateSortOrder(id: number, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('asset_classes')
    .update({ sort_order: sortOrder })
    .eq('id', id)

  if (error) throw error
}

export async function deleteAssetClass(id: number): Promise<void> {
  const { error } = await supabase
    .from('asset_classes')
    .delete()
    .eq('id', id)

  if (error) throw error
}
