import { supabase } from '../supabase'
import { listPriceUpdates, type PriceUpdate } from './price-updates'
import { listHoldingUpdates, type HoldingUpdate } from './holding-updates'

export type UpdateType = 'statement' | 'manual_price' | 'manual_holdings' | 'mark_as_closed'

export interface Update {
  id: number
  family_id: string
  account_id: number | null
  update_type: UpdateType
  effective_date: string
  created_by: string
  created_at: string
}

export interface UpdateWithDetails extends Update {
  prices: PriceUpdate[]
  holdings: HoldingUpdate[]
}

export async function listUpdates(): Promise<Update[]> {
  const { data, error } = await supabase
    .from('updates')
    .select('*')
    .order('effective_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listUpdatesForHistory(year: number, month: number): Promise<Update[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('updates')
    .select('*')
    .gte('created_at', startDate)
    .lt('created_at', endDate)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listUpdatesWithDetails(year: number, month: number): Promise<UpdateWithDetails[]> {
  const [updates, prices, holdings] = await Promise.all([
    listUpdatesForHistory(year, month),
    listPriceUpdates(),
    listHoldingUpdates()
  ])

  const pricesByUpdate: Record<number, PriceUpdate[]> = {}
  for (const p of prices) {
    const arr = pricesByUpdate[p.update_id] ?? (pricesByUpdate[p.update_id] = [])
    arr.push(p)
  }

  const holdingsByUpdate: Record<number, HoldingUpdate[]> = {}
  for (const h of holdings) {
    const arr = holdingsByUpdate[h.update_id] ?? (holdingsByUpdate[h.update_id] = [])
    arr.push(h)
  }

  return updates.map(u => ({
    ...u,
    prices: pricesByUpdate[u.id] || [],
    holdings: holdingsByUpdate[u.id] || []
  }))
}

export async function listUpdatesByAccount(accountId: number): Promise<Update[]> {
  const { data, error } = await supabase
    .from('updates')
    .select('*')
    .eq('account_id', accountId)
    .order('effective_date', { ascending: false })

  if (error) throw error
  return data || []
}

export async function insertUpdate(update: {
  family_id: string
  account_id: number | null
  update_type: UpdateType
  effective_date: string
  created_by: string
}): Promise<Update> {
  const { data, error } = await supabase
    .from('updates')
    .insert({
      family_id: update.family_id,
      account_id: update.account_id,
      update_type: update.update_type,
      effective_date: update.effective_date,
      created_by: update.created_by
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteUpdate(id: number): Promise<void> {
  const { error } = await supabase
    .from('updates')
    .delete()
    .eq('id', id)

  if (error) throw error
}
