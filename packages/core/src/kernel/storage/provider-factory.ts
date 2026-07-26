import { FileSystemStorage } from './fs-storage';
import { MemoryStorage } from './memory-storage';
import { SQLiteStorage } from './sqlite-storage';
import type { StorageProvider } from './types';

export type StorageProviderType = 'memory' | 'filesystem' | 'sqlite';

export type StorageProviderOptions =
  | { type: 'memory' }
  | { type: 'filesystem'; basePath: string }
  | { type: 'sqlite'; dbPath: string };

export function createProvider(options: StorageProviderOptions): StorageProvider {
  switch (options.type) {
    case 'memory':
      return new MemoryStorage();
    case 'filesystem':
      return new FileSystemStorage({ basePath: options.basePath });
    case 'sqlite':
      return new SQLiteStorage({ dbPath: options.dbPath });
    default: {
      const _exhaustive: never = options;
      throw new Error(`Unknown storage provider type: ${(_exhaustive as { type: string }).type}`);
    }
  }
}
