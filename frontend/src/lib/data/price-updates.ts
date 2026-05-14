import { supabase } from '../supabase'

export interface PriceUpdate {
  update_id: number
  asset_id: number
  price: number
}

export interface PriceUpdateWithContext {
  asset_id: number
  price_date: string
  price: number
  update_id: number
  created_by: string
  created_at: string
}

export async function listPriceUpdates(): Promise<PriceUpdate[]> {
  const { data, error } = await supabase
    .from('price_updates')
    .select('*')

  if (error) throw error
  return data || []
}

export async function insertPriceUpdate(price: {
  update_id: number
  asset_id: number
  price: number
}): Promise<void> {
  const { error } = await supabase
    .from('price_updates')
    .insert({
      update_id: price.update_id,
      asset_id: price.asset_id,
      price: price.price
    })

  if (error) throw error
}

export async function listPriceUpdatesWithContext(order: 'asc' | 'desc' = 'desc'): Promise<PriceUpdateWithContext[]> {
  const { data, error } = await supabase
    .from('price_updates')
    .select(`
      asset_id,
      price,
      update_id,
      updates!inner (
        effective_date,
        created_by,
        created_at
      )
    `)
    .order('updates(effective_date)', { ascending: order === 'asc' })

  if (error) throw error

  return (data || []).map((row: any) => ({
    asset_id: row.asset_id,
    price_date: row.updates.effective_date,
    price: row.price,
    update_id: row.update_id,
    created_by: row.updates.created_by,
    created_at: row.updates.created_at
  }))
}

export async function listPriceUpdatesByAsset(assetId: number, order: 'asc' | 'desc' = 'desc'): Promise<PriceUpdateWithContext[]> {
  const { data, error } = await supabase
    .from('price_updates')
    .select(`
      asset_id,
      price,
      update_id,
      updates!inner (
        effective_date,
        created_by,
        created_at
      )
    `)
    .eq('asset_id', assetId)
    .order('updates(effective_date)', { ascending: order === 'asc' })

  if (error) throw error

  return (data || []).map((row: any) => ({
    asset_id: row.asset_id,
    price_date: row.updates.effective_date,
    price: row.price,
    update_id: row.update_id,
    created_by: row.updates.created_by,
    created_at: row.updates.created_at
  }))
}
