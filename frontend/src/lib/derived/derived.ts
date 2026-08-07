import type { PriceUpdateWithContext } from '../data/price-updates';

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
