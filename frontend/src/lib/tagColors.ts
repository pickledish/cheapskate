// Color palette keyed by color name for easy lookup
// Hex values are Tailwind's 500 shade (charts + color picker; fine in both schemes)
export const TAG_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  gray: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-800 dark:text-gray-200',
    hex: '#6a7282',
  },
  red: {
    bg: 'bg-red-100 dark:bg-red-950',
    text: 'text-red-800 dark:text-red-200',
    hex: '#fb2c36',
  },
  orange: {
    bg: 'bg-orange-100 dark:bg-orange-950',
    text: 'text-orange-800 dark:text-orange-200',
    hex: '#ff6900',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-800 dark:text-amber-200',
    hex: '#fe9a00',
  },
  yellow: {
    bg: 'bg-yellow-100 dark:bg-yellow-950',
    text: 'text-yellow-800 dark:text-yellow-200',
    hex: '#f0b100',
  },
  lime: {
    bg: 'bg-lime-100 dark:bg-lime-950',
    text: 'text-lime-800 dark:text-lime-200',
    hex: '#7ccf00',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-950',
    text: 'text-green-800 dark:text-green-200',
    hex: '#00c950',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-950',
    text: 'text-emerald-800 dark:text-emerald-200',
    hex: '#00bc7d',
  },
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-950',
    text: 'text-teal-800 dark:text-teal-200',
    hex: '#00bba7',
  },
  cyan: {
    bg: 'bg-cyan-100 dark:bg-cyan-950',
    text: 'text-cyan-800 dark:text-cyan-200',
    hex: '#00b8db',
  },
  sky: {
    bg: 'bg-sky-100 dark:bg-sky-950',
    text: 'text-sky-800 dark:text-sky-200',
    hex: '#00a6f4',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-800 dark:text-blue-200',
    hex: '#2b7fff',
  },
  indigo: {
    bg: 'bg-indigo-100 dark:bg-indigo-950',
    text: 'text-indigo-800 dark:text-indigo-200',
    hex: '#615fff',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-950',
    text: 'text-violet-800 dark:text-violet-200',
    hex: '#8e51ff',
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-950',
    text: 'text-purple-800 dark:text-purple-200',
    hex: '#ad46ff',
  },
  fuchsia: {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-950',
    text: 'text-fuchsia-800 dark:text-fuchsia-200',
    hex: '#e12afb',
  },
  pink: {
    bg: 'bg-pink-100 dark:bg-pink-950',
    text: 'text-pink-800 dark:text-pink-200',
    hex: '#f6339a',
  },
  rose: {
    bg: 'bg-rose-100 dark:bg-rose-950',
    text: 'text-rose-800 dark:text-rose-200',
    hex: '#ff2056',
  },
};

// List of color names for the color picker
export const COLOR_NAMES = Object.keys(TAG_COLORS);

// Get Tailwind classes and hex for a color name
export function getColorClasses(colorName: string): {
  bg: string;
  text: string;
  hex: string;
} {
  return TAG_COLORS[colorName] ?? TAG_COLORS.red!;
}

// Get hex color for a color name (for charts)
export function getHexForColor(colorName: string): string {
  return TAG_COLORS[colorName]?.hex ?? TAG_COLORS.red!.hex;
}
