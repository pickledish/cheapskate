import type { PriceUpdateWithContext } from '../data/price-updates';
import type { HoldingUpdateWithContext } from '../data/holding-updates';
import type { AssetAllocation } from '../data/asset-allocations';
import { accountIdToString } from '../data/accounts';
import { assetIdToString, type AssetId, type AssetWithAllocations } from '../data/assets';
import type { AssetClassId } from '../data/asset-classes';

/**
 * Returns the latest price update per asset.
 *
 * For each asset, picks the row with the greatest `effective_date` among those
 * with `effective_date <= effectiveDate` (or among all rows if `effectiveDate`
 * is omitted). Input list ordering does not matter.
 *
 * When two updates share the same `effective_date`, the one with the newer
 * `created_at` wins.
 */
export function getLatestPrices(
  prices: PriceUpdateWithContext[],
  effectiveDate?: string,
): Map<AssetId, PriceUpdateWithContext> {
  const latest: Map<AssetId, PriceUpdateWithContext> = new Map();

  for (const p of prices) {
    if (effectiveDate !== undefined && p.effective_date > effectiveDate) {
      continue;
    }

    const current = latest.get(p.asset_id);
    if (
      !current ||
      p.effective_date > current.effective_date ||
      (p.effective_date === current.effective_date && p.created_at > current.created_at)
    ) {
      latest.set(p.asset_id, p);
    }
  }

  return latest;
}

/**
 * Returns the latest holding update per account+asset.
 *
 * Keys are `${account_id}-${asset_id}`. For each key, picks the row with the
 * greatest `effective_date` among those with `effective_date <= effectiveDate`
 * (or among all rows if `effectiveDate` is omitted). Input list ordering does
 * not matter.
 *
 * When two updates share the same `effective_date`, the one with the newer
 * `created_at` wins.
 */
export function getLatestHoldings(
  holdings: HoldingUpdateWithContext[],
  effectiveDate?: string,
): Record<string, HoldingUpdateWithContext> {
  const latest: Record<string, HoldingUpdateWithContext> = {};

  for (const h of holdings) {
    if (effectiveDate !== undefined && h.effective_date > effectiveDate) {
      continue;
    }

    const key = `${accountIdToString(h.account_id)}-${assetIdToString(h.asset_id)}`;
    const current = latest[key];
    if (
      !current ||
      h.effective_date > current.effective_date ||
      (h.effective_date === current.effective_date && h.created_at > current.created_at)
    ) {
      latest[key] = h;
    }
  }

  return latest;
}

/**
 * Groups holding value by asset class.
 *
 * For each holding, value is `quantity * price` (missing prices treated as 0).
 * Assets with no allocation rows contribute their full value to `unclassified`.
 * Otherwise each allocation adds `value * percentage` to its asset class.
 *
 * `allocations` may be flat `AssetAllocation` rows or `AssetWithAllocations`
 * (nested form from `listAssetsWithAllocations`); both are normalized internally.
 *
 * Callers should filter the holdings list (e.g. by account) before calling.
 */
export function getValueByClass(
  holdings: HoldingUpdateWithContext[],
  prices: Map<AssetId, PriceUpdateWithContext>,
  allocations: AssetAllocation[] | AssetWithAllocations[],
): { byClass: Map<AssetClassId, number>; unclassified: number } {
  const rows = normalizeAllocations(allocations);

  const allocationsByAsset: Map<AssetId, AssetAllocation[]> = new Map();
  for (const alloc of rows) {
    let assetAllocations = allocationsByAsset.get(alloc.asset_id);
    if (!assetAllocations) {
      assetAllocations = [];
      allocationsByAsset.set(alloc.asset_id, assetAllocations);
    }
    assetAllocations.push(alloc);
  }

  const byClass: Map<AssetClassId, number> = new Map();
  let unclassified = 0;

  for (const h of holdings) {
    const value = h.quantity * (prices.get(h.asset_id)?.price ?? 0);
    const assetAllocations = allocationsByAsset.get(h.asset_id) ?? [];

    if (assetAllocations.length === 0) {
      unclassified += value;
      continue;
    }

    for (const alloc of assetAllocations) {
      byClass.set(
        alloc.asset_class_id,
        (byClass.get(alloc.asset_class_id) || 0) + value * alloc.percentage,
      );
    }
  }

  return { byClass, unclassified };
}

/** Helper for the above */
function normalizeAllocations(
  allocations: AssetAllocation[] | AssetWithAllocations[],
): AssetAllocation[] {
  const first = allocations[0];
  if (first === undefined || !('allocations' in first)) {
    return allocations as AssetAllocation[];
  }

  return (allocations as AssetWithAllocations[]).flatMap((a) =>
    a.allocations.map((alloc) => ({
      asset_id: a.id,
      asset_class_id: alloc.asset_class_id,
      percentage: alloc.percentage,
    })),
  );
}
