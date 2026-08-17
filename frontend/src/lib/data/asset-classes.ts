import { supabase } from '../supabase';
import { throwIfError } from '../util/error';

// opaque type for AssetClassId, though underneath it's just a number
declare const __brand: unique symbol;
export type AssetClassId = { readonly [__brand]: 'AssetClassId' };

export function assetClassIdToString(assetClassId: AssetClassId): string {
  return `${assetClassId as unknown as number}`;
}

export interface AssetClass {
  id: AssetClassId;
  name: string;
  color: string;
  goal: number;
  sort_order: number;
  created_by: string;
  created_at: string;
  family_id: string;
}

export async function listAssetClasses(): Promise<AssetClass[]> {
  const { data, error } = await supabase.from('asset_classes').select('*').order('sort_order');

  throwIfError(error);
  return data || [];
}

export async function getAssetClass(id: AssetClassId): Promise<AssetClass | null> {
  const { data, error } = await supabase.from('asset_classes').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throwIfError(error);
  }
  return data;
}

export async function getMaxSortOrder(familyId: string): Promise<number> {
  const { data, error } = await supabase
    .from('asset_classes')
    .select('sort_order')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return -1;
    throwIfError(error);
  }
  return data?.sort_order ?? -1;
}

export async function insertAssetClass(assetClass: {
  name: string;
  color: string;
  goal: number;
  sort_order: number;
  created_by: string;
  family_id: string;
}): Promise<AssetClass> {
  const { data, error } = await supabase
    .from('asset_classes')
    .insert({
      name: assetClass.name,
      color: assetClass.color,
      goal: assetClass.goal,
      sort_order: assetClass.sort_order,
      created_by: assetClass.created_by,
      family_id: assetClass.family_id,
    })
    .select()
    .single();

  throwIfError(error);
  return data;
}

export async function updateAssetClass(
  id: AssetClassId,
  updates: {
    name?: string;
    color?: string;
    goal?: number;
    sort_order?: number;
  },
): Promise<void> {
  const { error } = await supabase.from('asset_classes').update(updates).eq('id', id);

  throwIfError(error);
}

export async function updateSortOrder(id: AssetClassId, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from('asset_classes')
    .update({ sort_order: sortOrder })
    .eq('id', id);

  throwIfError(error);
}

export async function deleteAssetClass(id: AssetClassId): Promise<void> {
  const { error } = await supabase.from('asset_classes').delete().eq('id', id);

  throwIfError(error);
}
