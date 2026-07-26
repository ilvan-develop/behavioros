/**
 * MetadataEntry — Configuration and options interface.
 */
export interface MetadataEntry {
  key: string;
  value: unknown;
  tags: string[];
  version: number;
  ttl?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * MetadataStore — metadata store.
 *
 * Methods: set, get, getByPrefix, getByTag, list, updateTags, and 1 more.
 */
export class MetadataStore {
  private store = new Map<string, MetadataEntry>();
  private tagIndex = new Map<string, Set<string>>();

  set(key: string, value: unknown, tags?: string[], ttl?: number): void {
    const now = new Date().toISOString();
    const existing = this.store.get(key);

    const entry: MetadataEntry = {
      key,
      value,
      tags: tags ?? [],
      version: existing ? existing.version + 1 : 1,
      ttl,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    if (existing) {
      for (const tag of existing.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }

    this.store.set(key, entry);

    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  get(key: string): MetadataEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  getByPrefix(prefix: string): MetadataEntry[] {
    const result: MetadataEntry[] = [];
    for (const [key, entry] of this.store) {
      if (key.startsWith(prefix)) {
        if (!this.isExpired(entry)) {
          result.push(entry);
        } else {
          this.store.delete(key);
        }
      }
    }
    return result;
  }

  getByTag(tag: string): MetadataEntry[] {
    const keys = this.tagIndex.get(tag);
    if (!keys) return [];
    const result: MetadataEntry[] = [];
    for (const key of keys) {
      const entry = this.store.get(key);
      if (entry && !this.isExpired(entry)) {
        result.push(entry);
      }
    }
    return result;
  }

  delete(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(key);
    }
    this.store.delete(key);
    return true;
  }

  list(): MetadataEntry[] {
    const result: MetadataEntry[] = [];
    for (const [key, entry] of this.store) {
      if (!this.isExpired(entry)) {
        result.push(entry);
      } else {
        this.store.delete(key);
      }
    }
    return result;
  }

  updateTags(key: string, tags: string[]): void {
    const entry = this.store.get(key);
    if (!entry) throw new Error(`Metadata entry not found: ${key}`);

    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(key);
    }

    entry.tags = tags;
    entry.updatedAt = new Date().toISOString();

    for (const tag of entry.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    }
  }

  clearExpired(): number {
    let count = 0;
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        for (const tag of entry.tags) {
          this.tagIndex.get(tag)?.delete(key);
        }
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  private isExpired(entry: MetadataEntry): boolean {
    if (entry.ttl === undefined) return false;
    const elapsed = Date.now() - new Date(entry.createdAt).getTime();
    return elapsed >= entry.ttl;
  }
}
