import { supabase } from '../supabase';

export interface AssetAlias {
  account_id: number;
  label: string;
  asset_id: number;
  created_at: string;
}

/** Uppercase and collapse whitespace for stable alias keys. */
export function normalizeLabel(label: string): string {
  return label.toUpperCase().replace(/\s+/g, ' ').trim();
}

export async function listAliasesByAccount(accountId: number): Promise<AssetAlias[]> {
  const { data, error } = await supabase
    .from('asset_aliases')
    .select('*')
    .eq('account_id', accountId);

  if (error) throw error;
  return data || [];
}

export async function insertAssetAlias(alias: {
  account_id: number;
  label: string;
  asset_id: number;
}): Promise<void> {
  const { error } = await supabase.from('asset_aliases').insert({
    account_id: alias.account_id,
    label: normalizeLabel(alias.label),
    asset_id: alias.asset_id,
  });

  if (error) throw error;
}
