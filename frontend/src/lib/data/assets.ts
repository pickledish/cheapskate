import { supabase } from '../supabase';
import type { AssetClass, AssetClassId } from './asset-classes';

// opaque type for AssetId, though underneath it's just a number
declare const __brand: unique symbol;
export type AssetId = { readonly [__brand]: 'AssetId' };

export function assetIdToString(assetId: AssetId): string {
  return `${assetId as unknown as number}`;
}

export interface Asset {
  id: AssetId;
  ticker: string | null;
  name: string;
  created_by: string;
  created_at: string;
  family_id: string;
}

export interface AssetAllocationInfo {
  asset_class_id: AssetClassId;
  percentage: number;
  asset_classes: AssetClass;
}

export interface AssetWithAllocations extends Asset {
  allocations: AssetAllocationInfo[];
}

export async function listAssets(): Promise<Asset[]> {
  const { data, error } = await supabase.from('assets').select('*').order('name');

  if (error) throw error;
  return data || [];
}

export async function listAssetsWithAllocations(): Promise<AssetWithAllocations[]> {
  const { data, error } = await supabase
    .from('assets')
    .select(
      `
      *,
      asset_allocations (*, asset_classes (*))
    `,
    )
    .order('name');

  if (error) throw error;

  type AssetRow = Asset & {
    asset_allocations: AssetAllocationInfo[] | null;
  };

  return ((data || []) as AssetRow[]).map((row) => ({
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    created_by: row.created_by,
    created_at: row.created_at,
    family_id: row.family_id,
    allocations: (row.asset_allocations || []).map((allocation) => ({
      ...allocation,
      // PostgREST returns Postgres numeric as a string; coerce once here.
      percentage: parseFloat(String(allocation.percentage)),
    })),
  }));
}

export async function getAsset(id: AssetId): Promise<Asset | null> {
  const { data, error } = await supabase.from('assets').select('*').eq('id', id).single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function insertAsset(asset: {
  ticker: string | null;
  name: string;
  created_by: string;
  family_id: string;
}): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert({
      ticker: asset.ticker,
      name: asset.name,
      created_by: asset.created_by,
      family_id: asset.family_id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateAsset(
  id: AssetId,
  updates: {
    ticker?: string | null;
    name?: string;
  },
): Promise<void> {
  const { error } = await supabase.from('assets').update(updates).eq('id', id);

  if (error) throw error;
}

export async function deleteAsset(id: AssetId): Promise<void> {
  const { error } = await supabase.from('assets').delete().eq('id', id);

  if (error) throw error;
}
