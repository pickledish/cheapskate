import { supabase } from '../supabase'

export interface Asset {
  id: number
  ticker: string | null
  name: string
  created_by: string
  created_at: string
  family_id: string
}

export async function listAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('name')

  if (error) throw error
  return data || []
}

export async function getAsset(id: number): Promise<Asset | null> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function findAssetByTickerOrName(tickerOrName: string): Promise<Asset | null> {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .or(`ticker.eq.${tickerOrName},name.eq.${tickerOrName}`)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function insertAsset(asset: {
  ticker: string | null
  name: string
  created_by: string
  family_id: string
}): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert({
      ticker: asset.ticker,
      name: asset.name,
      created_by: asset.created_by,
      family_id: asset.family_id
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAsset(id: number, updates: {
  ticker?: string | null
  name?: string
}): Promise<void> {
  const { error } = await supabase
    .from('assets')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function deleteAsset(id: number): Promise<void> {
  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id)

  if (error) throw error
}
