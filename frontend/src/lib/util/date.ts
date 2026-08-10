import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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

/**
 * Last n calendar months as "YYYY-MM", ending at the previous month
 * (excludes the current month).
 */
export function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

/** "YYYY-MM" → last calendar day of that month as "YYYY-MM-DD". */
export function monthEnd(monthStr: string): string {
  const [yearStr, monthPart] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthPart);
  const nextMonth = new Date(year, month, 1);
  nextMonth.setDate(nextMonth.getDate() - 1);
  return nextMonth.toISOString().split('T')[0]!;
}
