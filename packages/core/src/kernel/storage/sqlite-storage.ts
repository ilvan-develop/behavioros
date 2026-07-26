import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { StorageEntry, StorageProvider } from './types';

export interface SQLiteStorageOptions {
  dbPath: string;
}

interface Row {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  metadata: string | null;
}

export class SQLiteStorage implements StorageProvider {
  readonly name = 'sqlite';
  private dbPath: string;
  private data: Row[] = [];
  private loaded = false;

  constructor(options: SQLiteStorageOptions) {
    this.dbPath = options.dbPath;
    const dir = dirname(options.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.dbPath)) {
        const raw = readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch {
      this.data = [];
    }
    this.loaded = true;
  }

  private save(): void {
    writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private toEntry(row: Row): StorageEntry {
    return {
      key: row.key,
      value: row.value,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  private findIndex(key: string): number {
    return this.data.findIndex((r) => r.key === key);
  }

  async read(key: string): Promise<StorageEntry | null> {
    if (!this.loaded) this.load();
    const idx = this.findIndex(key);
    return idx >= 0 ? this.toEntry(this.data[idx]) : null;
  }

  async write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.loaded) this.load();
    const now = new Date().toISOString();
    const idx = this.findIndex(key);

    if (idx >= 0) {
      const existing = this.data[idx];
      this.data[idx] = {
        key,
        value,
        createdAt: existing.createdAt,
        updatedAt: now,
        metadata: metadata
          ? JSON.stringify({
              ...(existing.metadata ? JSON.parse(existing.metadata) : {}),
              ...metadata,
            })
          : existing.metadata,
      };
    } else {
      this.data.push({
        key,
        value,
        createdAt: now,
        updatedAt: now,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    }

    this.save();
  }

  async delete(key: string): Promise<boolean> {
    if (!this.loaded) this.load();
    const idx = this.findIndex(key);
    if (idx < 0) return false;
    this.data.splice(idx, 1);
    this.save();
    return true;
  }

  async list(prefix?: string): Promise<StorageEntry[]> {
    if (!this.loaded) this.load();
    let rows = this.data;
    if (prefix) {
      rows = rows.filter((r) => r.key.startsWith(prefix));
    }
    return rows.map((r) => this.toEntry(r)).sort((a, b) => a.key.localeCompare(b.key));
  }

  async exists(key: string): Promise<boolean> {
    if (!this.loaded) this.load();
    return this.findIndex(key) >= 0;
  }

  async clear(): Promise<void> {
    this.data = [];
    this.save();
  }
}
