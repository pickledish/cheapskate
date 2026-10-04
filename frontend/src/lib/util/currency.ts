/** USD currency. Nullish values render as '-'. */
export function formatCurrency(
  value: number | null | undefined,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    ...options,
  }).format(value);
}

/** Locale number with up to 4 fraction digits. Nullish values render as '-'. */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return '-';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/**
 * Stored goal fraction (0–1) as a percentage, with binary float noise removed.
 * 0.07 → 7, 0.375 → 37.5. Does not round away real decimals.
 */
export function formatGoal(goal: number): number {
  return parseFloat((goal * 100).toFixed(10));
}

/** Share quantity for display/edit: integers as-is, else trim trailing zeros (max 4 dp). */
export function formatQuantity(qty: number): string {
  if (Number.isInteger(qty)) return qty.toString();
  return qty.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}
