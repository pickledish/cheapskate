// Color palette with both Tailwind classes and hex values
const TAG_COLORS = [
  { bg: 'bg-red-100', text: 'text-red-800', hex: '#EF4444' },
  { bg: 'bg-orange-100', text: 'text-orange-800', hex: '#F97316' },
  { bg: 'bg-amber-100', text: 'text-amber-800', hex: '#F59E0B' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#EAB308' },
  { bg: 'bg-lime-100', text: 'text-lime-800', hex: '#84CC16' },
  { bg: 'bg-green-100', text: 'text-green-800', hex: '#22C55E' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', hex: '#10B981' },
  { bg: 'bg-teal-100', text: 'text-teal-800', hex: '#14B8A6' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', hex: '#06B6D4' },
  { bg: 'bg-sky-100', text: 'text-sky-800', hex: '#0EA5E9' },
  { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#3B82F6' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', hex: '#6366F1' },
  { bg: 'bg-violet-100', text: 'text-violet-800', hex: '#8B5CF6' },
  { bg: 'bg-purple-100', text: 'text-purple-800', hex: '#A855F7' },
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', hex: '#D946EF' },
  { bg: 'bg-pink-100', text: 'text-pink-800', hex: '#EC4899' },
  { bg: 'bg-rose-100', text: 'text-rose-800', hex: '#F43F5E' },
]

// Simple string hash function
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Get color classes for a tag key
export function getTagColor(key: string): { bg: string; text: string; hex: string } {
  const index = hashString(key) % TAG_COLORS.length
  return TAG_COLORS[index]!
}

// Get hex color for a name (for charts)
export function getHexColor(name: string): string {
  const index = hashString(name) % TAG_COLORS.length
  return TAG_COLORS[index]!.hex
}
