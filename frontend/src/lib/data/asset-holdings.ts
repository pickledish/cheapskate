import { supabase } from '../supabase'

export interface AssetHolding {
  asset_id: number
  account_id: number
  holding_date: string
  quantity: number
  statement_id: number | null
  created_by: string
  created_at: string
}

export async function listAssetHoldings(order: 'asc' | 'desc' = 'desc'): Promise<AssetHolding[]> {
  const { data, error } = await supabase
    .from('asset_holdings')
    .select('*')
    .order('holding_date', { ascending: order === 'asc' })

  if (error) throw error
  return data || []
}

export async function listAssetHoldingsByAccount(accountId: number, order: 'asc' | 'desc' = 'desc'): Promise<AssetHolding[]> {
  const { data, error } = await supabase
    .from('asset_holdings')
    .select('*')
    .eq('account_id', accountId)
    .order('holding_date', { ascending: order === 'asc' })

  if (error) throw error
  return data || []
}

export async function upsertAssetHolding(holding: {
  asset_id: number
  account_id: number
  holding_date: string
  quantity: number
  statement_id: number | null
  created_by: string
}): Promise<void> {
  const { error } = await supabase
    .from('asset_holdings')
    .upsert({
      asset_id: holding.asset_id,
      account_id: holding.account_id,
      holding_date: holding.holding_date,
      quantity: holding.quantity,
      statement_id: holding.statement_id,
      created_by: holding.created_by
    }, {
      onConflict: 'asset_id,account_id,holding_date'
    })

  if (error) throw error
}

export async function deleteAssetHolding(assetId: number, accountId: number, holdingDate: string): Promise<void> {
  const { error } = await supabase
    .from('asset_holdings')
    .delete()
    .eq('asset_id', assetId)
    .eq('account_id', accountId)
    .eq('holding_date', holdingDate)

  if (error) throw error
}
