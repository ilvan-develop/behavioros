import { randomUUID } from 'node:crypto';
import type { MemoryItem, MemoryType } from './types';

/**
 * ShortTermMemory — short term memory.
 *
 * Methods: write, read, getAll, clear.
 */
export class ShortTermMemory {
  readonly type: MemoryType = 'short-term';
  private items: Map<string, MemoryItem> = new Map();
  private accessOrder: string[] = [];
  private keyToAccessId: Map<string, string> = new Map();
  private maxItems: number;
  private defaultTtl: number;

  constructor(maxItems = 100, defaultTtl = 300_000) {
    this.maxItems = maxItems;
    this.defaultTtl = defaultTtl;
  }

  write(
    key: string,
    value: string,
    context: Record<string, unknown> = {},
    ttl?: number,
  ): MemoryItem {
    this.evictExpired();
    const item: MemoryItem = {
      id: randomUUID(),
      type: this.type,
      key,
      value,
      context,
      timestamp: new Date().toISOString(),
      ttl: ttl ?? this.defaultTtl,
      importance: 0.5,
    };

    if (this.items.has(key)) {
      const oldAccessId = this.keyToAccessId.get(key);
      if (oldAccessId) {
        this.accessOrder = this.accessOrder.filter((k) => k !== oldAccessId);
      }
    }

    const accessId = randomUUID();
    this.keyToAccessId.set(key, accessId);
    this.items.set(key, item);
    this.accessOrder.push(accessId);

    if (this.items.size > this.maxItems) {
      this.evictLru();
    }

    return item;
  }

  read(key: string): MemoryItem | null {
    this.evictExpired();
    const item = this.items.get(key);
    if (!item) return null;
    this.touch(key);
    return item;
  }

  delete(key: string): boolean {
    const item = this.items.get(key);
    if (!item) return false;
    this.items.delete(key);
    const accessId = this.keyToAccessId.get(key);
    if (accessId) {
      this.accessOrder = this.accessOrder.filter((k) => k !== accessId);
      this.keyToAccessId.delete(key);
    }
    return true;
  }

  getAll(): MemoryItem[] {
    this.evictExpired();
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
    this.accessOrder = [];
    this.keyToAccessId.clear();
  }

  get size(): number {
    this.evictExpired();
    return this.items.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.items) {
      if (item.ttl == null) continue;
      const createdAt = new Date(item.timestamp).getTime();
      if (now - createdAt > item.ttl) {
        this.items.delete(key);
        const accessId = this.keyToAccessId.get(key);
        if (accessId) {
          this.accessOrder = this.accessOrder.filter((k) => k !== accessId);
          this.keyToAccessId.delete(key);
        }
      }
    }
  }

  private evictLru(): void {
    while (this.items.size > this.maxItems && this.accessOrder.length > 0) {
      const lruAccessId = this.accessOrder.shift()!;
      let lruKey: string | undefined;
      for (const [key, accessId] of this.keyToAccessId) {
        if (accessId === lruAccessId) {
          lruKey = key;
          break;
        }
      }
      if (lruKey) {
        this.items.delete(lruKey);
        this.keyToAccessId.delete(lruKey);
      }
    }
  }

  private touch(key: string): void {
    const oldAccessId = this.keyToAccessId.get(key);
    if (!oldAccessId) return;
    this.accessOrder = this.accessOrder.filter((k) => k !== oldAccessId);
    const newAccessId = randomUUID();
    this.keyToAccessId.set(key, newAccessId);
    this.accessOrder.push(newAccessId);
  }
}
