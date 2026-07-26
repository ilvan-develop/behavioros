/**
 * SharedValue — Configuration and options interface.
 */
export interface SharedValue<T = unknown> {
  key: string;
  value: T;
  version: number;
  nodeId: string;
  updatedAt: string;
  ttl?: number;
}

/**
 * DistributedMemory — distributed memory.
 *
 * Methods: getKeys, getAll, merge, cleanup, hasKey.
 */
export class DistributedMemory {
  private store: Map<string, SharedValue> = new Map();

  set<T>(key: string, value: T, nodeId: string, ttlMs?: number): void {
    const existing = this.store.get(key);
    const now = Date.now();
    this.store.set(key, {
      key,
      value: value as SharedValue['value'],
      version: existing ? existing.version + 1 : 1,
      nodeId,
      updatedAt: new Date(now).toISOString(),
      ttl: ttlMs ? now + ttlMs : undefined,
    });
  }

  get<T>(key: string): SharedValue<T> | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.ttl && Date.now() >= entry.ttl) {
      this.store.delete(key);
      return undefined;
    }
    return entry as SharedValue<T>;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  getKeys(prefix?: string): string[] {
    const keys: string[] = [];
    for (const key of this.store.keys()) {
      if (prefix && !key.startsWith(prefix)) continue;
      const entry = this.store.get(key);
      if (entry?.ttl && Date.now() >= entry.ttl) {
        this.store.delete(key);
        continue;
      }
      keys.push(key);
    }
    return keys;
  }

  getAll(): SharedValue[] {
    const values: SharedValue[] = [];
    for (const [key, entry] of this.store) {
      if (entry.ttl && Date.now() >= entry.ttl) {
        this.store.delete(key);
        continue;
      }
      values.push({ ...entry });
    }
    return values;
  }

  merge(
    key: string,
    value: unknown,
    nodeId: string,
    strategy: 'last-write-wins' | 'version-merge' = 'last-write-wins',
  ): void {
    const existing = this.store.get(key);
    const now = Date.now();

    if (!existing) {
      this.store.set(key, {
        key,
        value: value as SharedValue['value'],
        version: 1,
        nodeId,
        updatedAt: new Date(now).toISOString(),
      });
      return;
    }

    if (strategy === 'last-write-wins') {
      this.store.set(key, {
        ...existing,
        value: value as SharedValue['value'],
        version: existing.version + 1,
        nodeId,
        updatedAt: new Date(now).toISOString(),
      });
    } else {
      this.store.set(key, {
        ...existing,
        value: { ...(existing.value as object), ...(value as object) } as SharedValue['value'],
        version: existing.version + 1,
        nodeId,
        updatedAt: new Date(now).toISOString(),
      });
    }
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.ttl && now >= entry.ttl) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  hasKey(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.ttl && Date.now() >= entry.ttl) {
      this.store.delete(key);
      return false;
    }
    return true;
  }
}
