import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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

/** Share quantity for display/edit: integers as-is, else trim trailing zeros (max 4 dp). */
export function formatQuantity(qty: number): string {
  if (Number.isInteger(qty)) return qty.toString();
  return qty.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** "YYYY-MM" → "MMM YYYY" (e.g. "2024-03" → "Mar 2024"). */
export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Relative time via dayjs (e.g. "2 days ago"). Nullish → null. */
export function relativeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return dayjs(dateStr).fromNow();
}
