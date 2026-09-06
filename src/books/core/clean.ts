/** Firestore rejects undefined. Strip it from every write payload. */
export function clean<T extends Record<string, unknown>>(data: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value.map((item) => {
        if (item && typeof item === 'object' && item.constructor === Object) {
          return clean(item as Record<string, unknown>);
        }
        return item === undefined ? null : item;
      });
      continue;
    }
    if (value && typeof value === 'object' && value.constructor === Object) {
      out[key] = clean(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out as T;
}
