// Color palette for tag chips - each is a Tailwind bg/text class pair
const TAG_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800' },
  { bg: 'bg-green-100', text: 'text-green-800' },
  { bg: 'bg-purple-100', text: 'text-purple-800' },
  { bg: 'bg-amber-100', text: 'text-amber-800' },
  { bg: 'bg-pink-100', text: 'text-pink-800' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  { bg: 'bg-rose-100', text: 'text-rose-800' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { bg: 'bg-teal-100', text: 'text-teal-800' },
  { bg: 'bg-orange-100', text: 'text-orange-800' },
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
export function getTagColor(key: string): { bg: string; text: string } {
  const index = hashString(key) % TAG_COLORS.length
  return TAG_COLORS[index]!
}
