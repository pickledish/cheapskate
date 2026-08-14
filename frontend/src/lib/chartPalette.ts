/** Shared bar/line chart series colors (hex). */
export const CHART_PALETTE = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#6366F1',
  '#14B8A6',
  '#A855F7',
  '#22C55E',
  '#E11D48',
  '#0EA5E9',
] as const;

export function chartColor(index: number): string {
  // @ts-expect-error index is always in range via modulus
  return CHART_PALETTE[index % CHART_PALETTE.length];
}
