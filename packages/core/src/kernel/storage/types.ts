export interface StorageEntry {
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface StorageProvider {
  readonly name: string;
  read(key: string): Promise<StorageEntry | null>;
  write(key: string, value: string, metadata?: Record<string, unknown>): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(prefix?: string): Promise<StorageEntry[]>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
}
