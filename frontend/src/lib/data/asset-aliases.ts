import { supabase } from '../supabase';
import type { AccountId } from './accounts';
import type { AssetId } from './assets';

export interface AssetAlias {
  account_id: AccountId;
  label: string;
  asset_id: AssetId;
  created_at: string;
}

/** Uppercase and collapse whitespace for stable alias keys. */
export function normalizeLabel(label: string): string {
  return label.toUpperCase().replace(/\s+/g, ' ').trim();
}

export async function listAliasesByAccount(accountId: AccountId): Promise<AssetAlias[]> {
  const { data, error } = await supabase
    .from('asset_aliases')
    .select('*')
    .eq('account_id', accountId);

  if (error) throw error;
  return data || [];
}

export async function insertAssetAlias(alias: {
  account_id: AccountId;
  label: string;
  asset_id: AssetId;
}): Promise<void> {
  const { error } = await supabase.from('asset_aliases').insert({
    account_id: alias.account_id,
    label: normalizeLabel(alias.label),
    asset_id: alias.asset_id,
  });

  if (error) throw error;
}
