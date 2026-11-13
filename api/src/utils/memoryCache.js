/**
 * CampusFlow API - In-Memory Fast Cache Utility
 * Provides lightweight key-value caching with TTL for high-frequency,
 * low-mutation catalog reads (e.g. resources list, public holidays).
 */

class MemoryCache {
  constructor(defaultTtlMs = 60000) {
    this.store = new Map();
    this.defaultTtl = defaultTtlMs;
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtl) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key) {
    this.store.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }
}

export const memoryCache = new MemoryCache();
