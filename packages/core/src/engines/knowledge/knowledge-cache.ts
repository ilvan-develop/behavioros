/**
 * CacheEntry — Configuration and options interface.
 */
export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

/**
 * CacheStats — Configuration and options interface.
 */
export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * KnowledgeCache — knowledge cache.
 *
 * Methods: has, invalidate, invalidateByPrefix, clear, getStats, resolve, next.
 */
export class KnowledgeCache {
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private readonly entries = new Map<string, CacheEntry>();
  private readonly accessOrder = new Map<string, number>();
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private accessCounter = 0;
  private readonly lock = new IntrinsicLock();

  constructor(maxSize = 1000, defaultTTL = 300_000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string): T | undefined {
    return this.lock.run(() => {
      const entry = this.entries.get(key);
      if (!entry) {
        this.misses++;
        return undefined;
      }
      if (Date.now() > entry.expiresAt) {
        this.entries.delete(key);
        this.accessOrder.delete(key);
        this.misses++;
        return undefined;
      }
      this.hits++;
      entry.hitCount++;
      this.accessOrder.set(key, ++this.accessCounter);
      return entry.value as T;
    });
  }

  set<T>(key: string, value: T, ttl?: number): void {
    this.lock.run(() => {
      if (this.entries.has(key)) {
        const existing = this.entries.get(key)!;
        existing.value = value;
        existing.createdAt = Date.now();
        existing.expiresAt = Date.now() + (ttl ?? this.defaultTTL);
        existing.hitCount = 0;
        this.accessOrder.set(key, ++this.accessCounter);
        return;
      }

      if (this.entries.size >= this.maxSize) {
        this.evictLru();
      }

      const now = Date.now();
      const entry: CacheEntry = {
        key,
        value,
        createdAt: now,
        expiresAt: now + (ttl ?? this.defaultTTL),
        hitCount: 0,
      };
      this.entries.set(key, entry);
      this.accessOrder.set(key, ++this.accessCounter);
    });
  }

  has(key: string): boolean {
    return this.lock.run(() => {
      const entry = this.entries.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        this.entries.delete(key);
        this.accessOrder.delete(key);
        return false;
      }
      return true;
    });
  }

  invalidate(key: string): void {
    this.lock.run(() => {
      this.entries.delete(key);
      this.accessOrder.delete(key);
    });
  }

  invalidateByPrefix(prefix: string): void {
    this.lock.run(() => {
      for (const key of this.entries.keys()) {
        if (key.startsWith(prefix)) {
          this.entries.delete(key);
          this.accessOrder.delete(key);
        }
      }
    });
  }

  clear(): void {
    this.lock.run(() => {
      this.entries.clear();
      this.accessOrder.clear();
      this.hits = 0;
      this.misses = 0;
      this.evictions = 0;
      this.accessCounter = 0;
    });
  }

  getStats(): CacheStats {
    return this.lock.run(() => {
      const total = this.hits + this.misses;
      return {
        size: this.entries.size,
        hits: this.hits,
        misses: this.misses,
        hitRate: total === 0 ? 0 : this.hits / total,
        evictions: this.evictions,
      };
    });
  }

  private evictLru(): void {
    let oldestKey: string | undefined;
    let oldestOrder = Infinity;
    for (const [key, order] of this.accessOrder) {
      if (order < oldestOrder) {
        oldestOrder = order;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.entries.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.evictions++;
    }
  }
}

class IntrinsicLock {
  private locked = false;
  private readonly queue: Array<() => void> = [];

  run<T>(fn: () => T): T {
    if (!this.locked) {
      this.locked = true;
      try {
        return fn();
      } finally {
        this.locked = false;
        this.drain();
      }
    }
    let resolve: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    this.queue.push(() => {
      try {
        resolve(fn());
      } finally {
        this.locked = false;
        this.drain();
      }
    });
    this.locked = true;
    return promise as unknown as T;
  }

  private drain(): void {
    if (this.queue.length > 0 && !this.locked) {
      const next = this.queue.shift()!;
      this.locked = true;
      next();
    }
  }
}
