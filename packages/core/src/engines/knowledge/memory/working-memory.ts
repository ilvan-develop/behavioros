import { randomUUID } from 'node:crypto';
import type { MemoryItem, MemoryType } from './types';

/**
 * WorkingMemory — working memory.
 *
 * Methods: write, read, getAll, clear.
 */
export class WorkingMemory {
  readonly type: MemoryType = 'working';
  private items: Map<string, MemoryItem> = new Map();
  private insertionOrder: string[] = [];
  private maxItems: number;

  constructor(maxItems = 20) {
    this.maxItems = maxItems;
  }

  write(key: string, value: string, context: Record<string, unknown> = {}): MemoryItem {
    const item: MemoryItem = {
      id: randomUUID(),
      type: this.type,
      key,
      value,
      context,
      timestamp: new Date().toISOString(),
      importance: 0.7,
    };

    if (this.items.has(key)) {
      this.insertionOrder = this.insertionOrder.filter((k) => k !== key);
    }

    this.items.set(key, item);
    this.insertionOrder.push(key);

    if (this.items.size > this.maxItems) {
      this.evictFifo();
    }

    return item;
  }

  read(key: string): MemoryItem | null {
    return this.items.get(key) ?? null;
  }

  delete(key: string): boolean {
    const item = this.items.get(key);
    if (!item) return false;
    this.items.delete(key);
    this.insertionOrder = this.insertionOrder.filter((k) => k !== key);
    return true;
  }

  getAll(): MemoryItem[] {
    return Array.from(this.items.values());
  }

  clear(): void {
    this.items.clear();
    this.insertionOrder = [];
  }

  get size(): number {
    return this.items.size;
  }

  private evictFifo(): void {
    while (this.items.size > this.maxItems && this.insertionOrder.length > 0) {
      const oldestKey = this.insertionOrder.shift()!;
      this.items.delete(oldestKey);
    }
  }
}
