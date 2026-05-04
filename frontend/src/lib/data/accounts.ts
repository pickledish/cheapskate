import { supabase } from '../supabase'

export interface Account {
  id: number
  name: string
  rebalancing: boolean
  archived_at: string | null
  last4: string | null
  created_by: string
  created_at: string
  family_id: string
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at')

  if (error) throw error
  return data || []
}

export async function getAccount(id: number): Promise<Account | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data
}

export async function insertAccount(account: {
  name: string
  rebalancing: boolean
  created_by: string
  family_id: string
  last4?: string | null
}): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: account.name,
      rebalancing: account.rebalancing,
      created_by: account.created_by,
      family_id: account.family_id,
      last4: account.last4 ?? null
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAccount(id: number, updates: {
  name?: string
  rebalancing?: boolean
  archived_at?: string | null
  last4?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function findAccountByLast4(last4: string): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('last4', last4)

  if (error) throw error
  return data || []
}

export async function deleteAccount(id: number): Promise<void> {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)

  if (error) throw error
}
