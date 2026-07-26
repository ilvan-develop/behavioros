import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FileSystemStorage } from '../kernel/storage/fs-storage';
import { MemoryStorage } from '../kernel/storage/memory-storage';
import { createProvider } from '../kernel/storage/provider-factory';
import { SQLiteStorage } from '../kernel/storage/sqlite-storage';
import type { StorageProvider } from '../kernel/storage/types';

function testSuite(name: string, factory: () => StorageProvider, cleanup?: () => void) {
  describe(name, () => {
    let store: StorageProvider;

    beforeAll(() => {
      store = factory();
    });

    afterAll(() => {
      cleanup?.();
    });

    it('should read non-existent key returns null', async () => {
      const result = await store.read('nonexistent');
      expect(result).toBeNull();
    });

    it('should write and read a value', async () => {
      await store.write('key1', 'value1');
      const entry = await store.read('key1');
      expect(entry).not.toBeNull();
      expect(entry!.key).toBe('key1');
      expect(entry!.value).toBe('value1');
      expect(entry!.createdAt).toBeDefined();
      expect(entry!.updatedAt).toBeDefined();
      expect(entry!.createdAt).toBe(entry!.updatedAt);
    });

    it('should overwrite existing key and update updatedAt', async () => {
      await store.write('overwrite', 'original');
      const first = await store.read('overwrite');
      await new Promise((r) => setTimeout(r, 10));
      await store.write('overwrite', 'updated');
      const second = await store.read('overwrite');
      expect(second!.value).toBe('updated');
      expect(second!.createdAt).toBe(first!.createdAt);
      expect(second!.updatedAt).not.toBe(first!.updatedAt);
    });

    it('should delete a key and return true', async () => {
      await store.write('todelete', 'value');
      const deleted = await store.delete('todelete');
      expect(deleted).toBe(true);
      const entry = await store.read('todelete');
      expect(entry).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const result = await store.delete('doesnotexist');
      expect(result).toBe(false);
    });

    it('should list all entries with no prefix', async () => {
      await store.clear();
      await store.write('a', '1');
      await store.write('b', '2');
      await store.write('c', '3');
      const entries = await store.list();
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.key)).toEqual(['a', 'b', 'c']);
    });

    it('should list entries matching prefix', async () => {
      await store.clear();
      await store.write('app:users:1', 'user1');
      await store.write('app:users:2', 'user2');
      await store.write('app:config:db', 'config');
      const users = await store.list('app:users');
      expect(users).toHaveLength(2);
      expect(users.map((e) => e.key).sort()).toEqual(['app:users:1', 'app:users:2']);
    });

    it('should return empty list when prefix does not match', async () => {
      await store.clear();
      await store.write('alpha', '1');
      const entries = await store.list('beta');
      expect(entries).toHaveLength(0);
    });

    it('should check exists for existing key', async () => {
      await store.write('exists-key', 'value');
      const result = await store.exists('exists-key');
      expect(result).toBe(true);
    });

    it('should check exists for non-existing key', async () => {
      const result = await store.exists('no-such-key');
      expect(result).toBe(false);
    });

    it('should clear all entries', async () => {
      await store.write('a', '1');
      await store.write('b', '2');
      await store.clear();
      const entries = await store.list();
      expect(entries).toHaveLength(0);
    });

    it('should handle special characters in value', async () => {
      const special = '你好🌍\n\t"quoted"<xml>&amp;';
      await store.write('special', special);
      const entry = await store.read('special');
      expect(entry!.value).toBe(special);
    });

    it('should write and read metadata', async () => {
      await store.write('meta-key', 'value', { author: 'test', version: 1 });
      const entry = await store.read('meta-key');
      expect(entry!.metadata).toBeDefined();
      expect(entry!.metadata!.author).toBe('test');
      expect(entry!.metadata!.version).toBe(1);
    });

    it('should merge metadata on overwrite', async () => {
      await store.write('merge', 'v1', { a: 1, b: 2 });
      await store.write('merge', 'v2', { b: 3, c: 4 });
      const entry = await store.read('merge');
      expect(entry!.metadata).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should handle concurrent writes', async () => {
      await store.clear();
      const promises = Array.from({ length: 50 }, (_, i) =>
        store.write(`concurrent-${i}`, `value-${i}`),
      );
      await Promise.all(promises);
      const entries = await store.list('concurrent');
      expect(entries).toHaveLength(50);
    });

    it('should handle empty key', async () => {
      await store.write('', 'empty-key-value');
      const entry = await store.read('');
      expect(entry).not.toBeNull();
      expect(entry!.key).toBe('');
      expect(entry!.value).toBe('empty-key-value');
    });
  });
}

describe('StorageProvider implementations', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'behavioros-storage-test-'));
  const sqlitePath = join(tmpDir, 'test.db');

  const memoryCleanup = () => {};
  const fsCleanup = () => rmSync(tmpDir, { recursive: true, force: true });

  testSuite('MemoryStorage', () => new MemoryStorage(), memoryCleanup);

  testSuite(
    'FileSystemStorage',
    () => new FileSystemStorage({ basePath: join(tmpDir, 'fs') }),
    fsCleanup,
  );

  testSuite('SQLiteStorage', () => new SQLiteStorage({ dbPath: sqlitePath }), fsCleanup);

  describe('ProviderFactory', () => {
    it('should create MemoryStorage from factory', () => {
      const provider = createProvider({ type: 'memory' });
      expect(provider.name).toBe('memory');
      expect(provider).toBeInstanceOf(MemoryStorage);
    });

    it('should create FileSystemStorage from factory', () => {
      const provider = createProvider({ type: 'filesystem', basePath: join(tmpDir, 'factory-fs') });
      expect(provider.name).toBe('filesystem');
      expect(provider).toBeInstanceOf(FileSystemStorage);
    });

    it('should create SQLiteStorage from factory', () => {
      const provider = createProvider({ type: 'sqlite', dbPath: join(tmpDir, 'factory.db') });
      expect(provider.name).toBe('sqlite');
      expect(provider).toBeInstanceOf(SQLiteStorage);
    });
  });
});
