import { supabase } from '../supabase'

export interface AssetPrice {
  asset_id: number
  price_date: string
  price: number
  statement_id: number | null
  created_by: string
  created_at: string
}

export async function listAssetPrices(order: 'asc' | 'desc' = 'desc'): Promise<AssetPrice[]> {
  const { data, error } = await supabase
    .from('asset_prices')
    .select('*')
    .order('price_date', { ascending: order === 'asc' })

  if (error) throw error
  return data || []
}

export async function listAssetPricesByAsset(assetId: number, order: 'asc' | 'desc' = 'desc'): Promise<AssetPrice[]> {
  const { data, error } = await supabase
    .from('asset_prices')
    .select('*')
    .eq('asset_id', assetId)
    .order('price_date', { ascending: order === 'asc' })

  if (error) throw error
  return data || []
}

export async function upsertAssetPrice(price: {
  asset_id: number
  price_date: string
  price: number
  statement_id: number | null
  created_by: string
}): Promise<void> {
  const { error } = await supabase
    .from('asset_prices')
    .upsert({
      asset_id: price.asset_id,
      price_date: price.price_date,
      price: price.price,
      statement_id: price.statement_id,
      created_by: price.created_by
    }, {
      onConflict: 'asset_id,price_date'
    })

  if (error) throw error
}

export async function deleteAssetPrice(assetId: number, priceDate: string): Promise<void> {
  const { error } = await supabase
    .from('asset_prices')
    .delete()
    .eq('asset_id', assetId)
    .eq('price_date', priceDate)

  if (error) throw error
}
