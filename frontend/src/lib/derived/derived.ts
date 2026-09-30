import type { PriceUpdateWithContext } from '../data/price-updates';
import type { HoldingUpdateWithContext } from '../data/holding-updates';
import type { AssetAllocation } from '../data/asset-allocations';
import { accountIdToString, type Account, type AccountId } from '../data/accounts';
import { assetIdToString, type AssetId, type AssetWithAllocations } from '../data/assets';
import type { AssetClassId } from '../data/asset-classes';
import type { Update } from '../data/updates';

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
 * Current assets for the asset list.
 *
 * An asset is excluded when it used to be held but every account's latest
 * quantity is now zero. Those are closed-out positions, the same idea as
 * hiding a closed account. Input order is preserved.
 *
 * Assets that never had any holdings (e.g. brand new) are included still.
 */
export function getCurrentAssets(
  assets: AssetWithAllocations[],
  holdings: HoldingUpdateWithContext[],
): AssetWithAllocations[] {
  const everHeld = new Set<string>();
  for (const holding of holdings) {
    if (holding.quantity !== 0) {
      everHeld.add(assetIdToString(holding.asset_id));
    }
  }

  const stillHeld = new Set<string>();
  for (const holding of Object.values(getLatestHoldings(holdings))) {
    if (holding.quantity !== 0) {
      stillHeld.add(assetIdToString(holding.asset_id));
    }
  }

  return assets.filter((asset) => {
    const id = assetIdToString(asset.id);
    return !everHeld.has(id) || stillHeld.has(id);
  });
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

/**
 * Accounts included in portfolio as of `effectiveDate`.
 *
 * If an account has any `include_in_portfolio` event, it is included iff at
 * least one such event has `effective_date <= effectiveDate`. Otherwise the
 * account's current `in_portfolio` flag is used for all dates (created in or
 * out of portfolio, never transitioned).
 */
export function getInPortfolioAccountIds(
  accounts: Account[],
  includeEvents: Update[],
  effectiveDate: string,
): Set<AccountId> {
  const hasEvent = new Set<AccountId>();
  const includedByDate = new Set<AccountId>();
  for (const event of includeEvents) {
    if (event.account_id == null) continue;
    hasEvent.add(event.account_id);
    if (event.effective_date <= effectiveDate) {
      includedByDate.add(event.account_id);
    }
  }

  const result: Set<AccountId> = new Set();
  for (const account of accounts) {
    if (hasEvent.has(account.id)) {
      if (includedByDate.has(account.id)) {
        result.add(account.id);
      }
    } else if (account.in_portfolio) {
      result.add(account.id);
    }
  }
  return result;
}
