export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ShortLivedCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries: number) {}

  get(key: string, now = Date.now()): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (!oldestKey) break;
      this.entries.delete(oldestKey);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

export const DIRECTIONS_CACHE_TTL_MS = 60_000;
export const DIRECTIONS_CACHE_MAX_ENTRIES = 30;

export function createDirectionsCache<T>() {
  return new ShortLivedCache<T>(DIRECTIONS_CACHE_TTL_MS, DIRECTIONS_CACHE_MAX_ENTRIES);
}
