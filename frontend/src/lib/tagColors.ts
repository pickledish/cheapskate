// Color palette keyed by color name for easy lookup
export const TAG_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-800', hex: '#6B7280' },
  red: { bg: 'bg-red-100', text: 'text-red-800', hex: '#EF4444' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', hex: '#F97316' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-800', hex: '#F59E0B' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#EAB308' },
  lime: { bg: 'bg-lime-100', text: 'text-lime-800', hex: '#84CC16' },
  green: { bg: 'bg-green-100', text: 'text-green-800', hex: '#22C55E' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', hex: '#10B981' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-800', hex: '#14B8A6' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-800', hex: '#06B6D4' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-800', hex: '#0EA5E9' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#3B82F6' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', hex: '#6366F1' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-800', hex: '#8B5CF6' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', hex: '#A855F7' },
  fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', hex: '#D946EF' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-800', hex: '#EC4899' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-800', hex: '#F43F5E' },
}

// List of color names for the color picker
export const COLOR_NAMES = Object.keys(TAG_COLORS)

// Get Tailwind classes and hex for a color name
export function getColorClasses(colorName: string): { bg: string; text: string; hex: string } {
  return TAG_COLORS[colorName] ?? TAG_COLORS.red!
}

// Get hex color for a color name (for charts)
export function getHexForColor(colorName: string): string {
  return TAG_COLORS[colorName]?.hex ?? TAG_COLORS.red!.hex
}
