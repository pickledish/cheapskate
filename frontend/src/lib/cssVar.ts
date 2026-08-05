/** Resolve a CSS custom property on :root to a concrete color for canvas/SVG libs. */
export function cssVar(name: string): string {
  const styles = getComputedStyle(document.documentElement);
  let value = styles.getPropertyValue(name).trim();
  // Semantic tokens are often `var(--color-gray-…)`; ECharts needs the resolved value.
  if (value.startsWith('var(')) {
    const inner = value.slice(4, -1).trim().split(',')[0]?.trim();
    if (inner) {
      value = styles.getPropertyValue(inner).trim();
    }
  }
  return value;
}
