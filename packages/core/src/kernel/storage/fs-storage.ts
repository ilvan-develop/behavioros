import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { StorageEntry, StorageProvider } from './types';

export interface FileSystemStorageOptions {
  basePath: string;
}

export class FileSystemStorage implements StorageProvider {
  readonly name = 'filesystem';
  private basePath: string;
  private ready: Promise<string | undefined>;

  constructor(options: FileSystemStorageOptions) {
    this.basePath = options.basePath;
    this.ready = mkdir(this.basePath, { recursive: true });
  }

  private async getPath(key: string): Promise<string> {
    await this.ready;
    return join(this.basePath, `${encodeURIComponent(key)}.json`);
  }

  private decodeKey(filename: string): string {
    return decodeURIComponent(filename.replace(/\.json$/, ''));
  }

  async read(key: string): Promise<StorageEntry | null> {
    try {
      const path = await this.getPath(key);
      const data = await readFile(path, 'utf-8');
      return JSON.parse(data) as StorageEntry;
    } catch {
      return null;
    }
  }

  async write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void> {
    const existing = await this.read(key);
    const now = new Date().toISOString();
    const entry: StorageEntry = {
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      metadata: { ...existing?.metadata, ...metadata },
    };
    const path = await this.getPath(key);
    await writeFile(path, JSON.stringify(entry, null, 2), 'utf-8');
  }

  async delete(key: string): Promise<boolean> {
    try {
      const path = await this.getPath(key);
      await unlink(path);
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix?: string): Promise<StorageEntry[]> {
    await this.ready;
    const entries: StorageEntry[] = [];
    let files: string[];
    try {
      files = await readdir(this.basePath);
    } catch {
      return [];
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const key = this.decodeKey(file);
      if (!prefix || key.startsWith(prefix)) {
        const entry = await this.read(key);
        if (entry) entries.push(entry);
      }
    }
    return entries.sort((a, b) => a.key.localeCompare(b.key));
  }

  async exists(key: string): Promise<boolean> {
    const entry = await this.read(key);
    return entry !== null;
  }

  async clear(): Promise<void> {
    await this.ready;
    let files: string[];
    try {
      files = await readdir(this.basePath);
    } catch {
      return;
    }
    const deletions = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => unlink(join(this.basePath, f)).catch(() => {}));
    await Promise.all(deletions);
  }
}
