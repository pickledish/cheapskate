// Color palette keyed by color name for easy lookup
// Hex values are Tailwind's 500 shade
export const TAG_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  gray: { bg: 'bg-gray-100', text: 'text-gray-800', hex: '#6a7282' },
  red: { bg: 'bg-red-100', text: 'text-red-800', hex: '#fb2c36' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', hex: '#ff6900' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-800', hex: '#fe9a00' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#f0b100' },
  lime: { bg: 'bg-lime-100', text: 'text-lime-800', hex: '#7ccf00' },
  green: { bg: 'bg-green-100', text: 'text-green-800', hex: '#00c950' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', hex: '#00bc7d' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-800', hex: '#00bba7' },
  cyan: { bg: 'bg-cyan-100', text: 'text-cyan-800', hex: '#00b8db' },
  sky: { bg: 'bg-sky-100', text: 'text-sky-800', hex: '#00a6f4' },
  blue: { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#2b7fff' },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', hex: '#615fff' },
  violet: { bg: 'bg-violet-100', text: 'text-violet-800', hex: '#8e51ff' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-800', hex: '#ad46ff' },
  fuchsia: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', hex: '#e12afb' },
  pink: { bg: 'bg-pink-100', text: 'text-pink-800', hex: '#f6339a' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-800', hex: '#ff2056' },
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
