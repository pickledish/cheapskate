/** "Latest row wins" rules, matching frontend/src/lib/derived/derived.ts. */

interface Dated {
  effective_date: string;
  created_at: string;
}

/** Later effective date wins; on a tie, the row recorded later wins. */
function isNewer(candidate: Dated, current: Dated): boolean {
  if (candidate.effective_date !== current.effective_date) {
    return candidate.effective_date > current.effective_date;
  }
  return candidate.created_at > current.created_at;
}

/** The newest row for each key. */
export function latestBy<T extends Dated>(rows: T[], key: (row: T) => string): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const k = key(row);
    const current = latest.get(k);
    if (!current || isNewer(row, current)) latest.set(k, row);
  }
  return latest;
}
