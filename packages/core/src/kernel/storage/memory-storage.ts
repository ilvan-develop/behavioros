import type { StorageEntry, StorageProvider } from './types';

export class MemoryStorage implements StorageProvider {
  readonly name = 'memory';
  private store = new Map<string, StorageEntry>();

  async read(key: string): Promise<StorageEntry | null> {
    return this.store.get(key) ?? null;
  }

  async write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void> {
    const existing = this.store.get(key);
    const now = new Date().toISOString();
    this.store.set(key, {
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: { ...existing?.metadata, ...metadata },
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async list(prefix?: string): Promise<StorageEntry[]> {
    const entries: StorageEntry[] = [];
    for (const [key, entry] of this.store) {
      if (!prefix || key.startsWith(prefix)) {
        entries.push({ ...entry });
      }
    }
    return entries.sort((a, b) => a.key.localeCompare(b.key));
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
