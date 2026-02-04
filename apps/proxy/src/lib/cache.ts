/**
 * In-memory cache with TTL (time-to-live) per key.
 */
export function createTtlCache<T>(ttlMs: number) {
  const store = new Map<string, { value: T; expiresAt: number }>();

  function get(key: string): T | undefined {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  function set(key: string, value: T): void {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function deleteKey(key: string): boolean {
    return store.delete(key);
  }

  return { get, set, delete: deleteKey };
}

export type TtlCache<T> = ReturnType<typeof createTtlCache<T>>;
