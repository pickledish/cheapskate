function usefulString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[object Object]') return null;
  return trimmed;
}

/** Pull user-facing fields off Error, PostgREST `{ message, hint }`, Auth `{ msg }`. */
function messagesFrom(err: unknown, seen: Set<unknown>): string[] {
  if (err == null || seen.has(err)) return [];
  if (typeof err === 'string') {
    const text = usefulString(err);
    return text ? [text] : [];
  }
  if (typeof err !== 'object') {
    return [];
  }

  seen.add(err);
  const obj = err as Record<string, unknown>;
  const parts: string[] = [];

  const push = (value: unknown) => {
    if (typeof value === 'string') {
      const text = usefulString(value);
      if (text && !parts.includes(text)) parts.push(text);
    } else if (value && typeof value === 'object') {
      for (const nested of messagesFrom(value, seen)) {
        if (!parts.includes(nested)) parts.push(nested);
      }
    }
  };

  push(obj.message);
  push(obj.msg);
  push(obj.hint);

  if (parts.length === 0) {
    push(obj.details);
    push(obj.error);
  }

  return parts;
}

/** String suitable for UI banners. Prefers Postgres `message` (+ `hint` when present). */
export function formatError(err: unknown): string {
  const parts = messagesFrom(err, new Set());
  if (parts.length > 0) return parts.join('. ');

  try {
    const json = JSON.stringify(err);
    if (json && json !== '{}' && json !== 'null') return json;
  } catch {
    // circular
  }

  return 'Something went wrong';
}

/** Throw a real Error so callers don't stringify PostgREST objects as [object Object]. */
export function throwIfError(error: unknown): asserts error is null | undefined {
  if (error != null) {
    throw new Error(formatError(error));
  }
}
