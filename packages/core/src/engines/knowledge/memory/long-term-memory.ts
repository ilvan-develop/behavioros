import { randomUUID } from 'node:crypto';
import type { StorageProvider } from '../../../kernel/storage/types';
import type { MemoryItem, MemoryType } from './types';

/**
 * LongTermMemory — long term memory.
 *
 * Methods: write, read, getAll, clear.
 */
export class LongTermMemory {
  readonly type: MemoryType = 'long-term';
  private storage: StorageProvider;

  constructor(storage: StorageProvider) {
    this.storage = storage;
  }

  async write(
    key: string,
    value: string,
    context: Record<string, unknown> = {},
  ): Promise<MemoryItem> {
    const item: MemoryItem = {
      id: randomUUID(),
      type: this.type,
      key,
      value,
      context,
      timestamp: new Date().toISOString(),
      importance: 0.8,
    };

    await this.storage.write(key, JSON.stringify(item), { memoryType: this.type });
    return item;
  }

  async read(key: string): Promise<MemoryItem | null> {
    const entry = await this.storage.read(key);
    if (!entry) return null;
    return JSON.parse(entry.value) as MemoryItem;
  }

  async delete(key: string): Promise<boolean> {
    return this.storage.delete(key);
  }

  async getAll(): Promise<MemoryItem[]> {
    const entries = await this.storage.list();
    return entries.map((e) => JSON.parse(e.value) as MemoryItem);
  }

  async clear(): Promise<void> {
    await this.storage.clear();
  }
}
