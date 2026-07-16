// ============================================================
// Persistent Environment — Durable sandbox with retention
// ============================================================

export interface PersistentConfig {
  storagePath: string;
  maxStorageMB: number;
  retentionHours: number;
}

interface PersistentEntry {
  value: unknown;
  timestamp: number;
}

export class PersistentEnvironment {
  private data: Map<string, PersistentEntry> = new Map();
  private config: PersistentConfig;

  constructor(config: PersistentConfig) {
    this.config = config;
  }

  set(key: string, value: unknown): void {
    this.data.set(key, { value, timestamp: Date.now() });
  }

  get<T = unknown>(key: string): T | undefined {
    const entry = this.data.get(key);
    return entry?.value as T | undefined;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }

  getEntries(): Array<{ key: string; value: unknown; timestamp: number }> {
    return Array.from(this.data.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      timestamp: entry.timestamp,
    }));
  }

  cleanupOldEntries(): number {
    const cutoff = Date.now() - this.config.retentionHours * 60 * 60 * 1000;
    let count = 0;

    for (const [key, entry] of this.data) {
      if (entry.timestamp < cutoff) {
        this.data.delete(key);
        count++;
      }
    }

    return count;
  }

  getConfig(): PersistentConfig {
    return { ...this.config };
  }

  get size(): number {
    return this.data.size;
  }
}
