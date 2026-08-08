import type { PriceUpdateWithContext } from '../data/price-updates';
import type { HoldingUpdateWithContext } from '../data/holding-updates';

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
): Record<number, PriceUpdateWithContext> {
  const latest: Record<number, PriceUpdateWithContext> = {};

  for (const p of prices) {
    if (effectiveDate !== undefined && p.effective_date > effectiveDate) {
      continue;
    }

    const current = latest[p.asset_id];
    if (
      !current ||
      p.effective_date > current.effective_date ||
      (p.effective_date === current.effective_date && p.created_at > current.created_at)
    ) {
      latest[p.asset_id] = p;
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

    const key = `${h.account_id}-${h.asset_id}`;
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
