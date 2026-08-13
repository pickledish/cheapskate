import { supabase } from '../supabase';

// opaque type for AccountId, though underneath it's just a number
declare const __brand: unique symbol;
export type AccountId = { readonly [__brand]: 'AccountId' };

export function accountIdToString(accountId: AccountId): string {
  return `${accountId as unknown as number}`;
}

export interface Account {
  id: AccountId;
  name: string;
  in_portfolio: boolean;
  is_archived: boolean;
  last4: string | null;
  institution: string | null;
  created_by: string;
  created_at: string;
  family_id: string;
}

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at');

  if (error) throw error;
  return data || [];
}

export async function getAccount(id: AccountId): Promise<Account | null> {
  const { data, error } = await supabase.from('accounts').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function insertAccount(account: {
  name: string;
  in_portfolio: boolean;
  created_by: string;
  family_id: string;
  last4?: string | null;
  institution?: string | null;
}): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({
      name: account.name,
      in_portfolio: account.in_portfolio,
      created_by: account.created_by,
      family_id: account.family_id,
      last4: account.last4 ?? null,
      institution: account.institution ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAccount(
  id: AccountId,
  updates: {
    name?: string;
    in_portfolio?: boolean;
    is_archived?: boolean;
    last4?: string | null;
    institution?: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('accounts').update(updates).eq('id', id);

  if (error) throw error;
}

export async function findAccountByLast4(last4: string): Promise<Account[]> {
  const { data, error } = await supabase.from('accounts').select('*').eq('last4', last4);

  if (error) throw error;
  return data || [];
}

export async function deleteAccount(id: AccountId): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id);

  if (error) throw error;
}
