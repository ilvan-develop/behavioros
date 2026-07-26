import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetadataStore } from '../engines/integration/metadata-store';

describe('MetadataStore', () => {
  let store: MetadataStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MetadataStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('set and get a metadata entry', () => {
    store.set('foo', { bar: 1 });
    const entry = store.get('foo');
    expect(entry).toBeDefined();
    expect(entry!.key).toBe('foo');
    expect(entry!.value).toEqual({ bar: 1 });
    expect(entry!.version).toBe(1);
    expect(entry!.createdAt).toBeDefined();
    expect(entry!.updatedAt).toBeDefined();
  });

  it('get returns undefined for missing key', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('overwrite increments version and preserves createdAt', () => {
    store.set('foo', 'v1');
    const first = store.get('foo')!;
    const createdAt = first.createdAt;

    store.set('foo', 'v2');
    const second = store.get('foo')!;

    expect(second.version).toBe(2);
    expect(second.createdAt).toBe(createdAt);
    expect(second.value).toBe('v2');
  });

  it('getByPrefix returns entries matching prefix', () => {
    store.set('app:config:db', 'postgres');
    store.set('app:config:cache', 'redis');
    store.set('app:secrets:key', 'secret');

    const configs = store.getByPrefix('app:config:');
    expect(configs).toHaveLength(2);
    expect(configs.map((e) => e.key)).toEqual(
      expect.arrayContaining(['app:config:db', 'app:config:cache']),
    );
  });

  it('getByPrefix returns empty array when no match', () => {
    expect(store.getByPrefix('zzz:')).toEqual([]);
  });

  it('getByTag returns entries with the given tag', () => {
    store.set('a', 1, ['critical']);
    store.set('b', 2, ['critical', 'urgent']);
    store.set('c', 3, ['low']);

    const critical = store.getByTag('critical');
    expect(critical).toHaveLength(2);
  });

  it('getByTag returns empty array for unused tag', () => {
    expect(store.getByTag('nonexistent')).toEqual([]);
  });

  it('delete removes entry and returns true', () => {
    store.set('foo', 'bar');
    expect(store.delete('foo')).toBe(true);
    expect(store.get('foo')).toBeUndefined();
  });

  it('delete returns false for missing key', () => {
    expect(store.delete('nonexistent')).toBe(false);
  });

  it('list returns all non-expired entries', () => {
    store.set('a', 1);
    store.set('b', 2);
    expect(store.list()).toHaveLength(2);
  });

  it('updateTags replaces tags and updates updatedAt', () => {
    store.set('foo', 'val', ['old']);
    store.updateTags('foo', ['new', 'another']);

    const entry = store.get('foo')!;
    expect(entry.tags).toEqual(['new', 'another']);

    const old = store.getByTag('old');
    expect(old).toHaveLength(0);

    const updated = store.getByTag('new');
    expect(updated).toHaveLength(1);
  });

  it('updateTags throws on missing key', () => {
    expect(() => store.updateTags('ghost', ['x'])).toThrow('Metadata entry not found: ghost');
  });

  it('clearExpired removes entries past TTL', () => {
    store.set('ephemeral', 'data', [], 10_000);

    vi.advanceTimersByTime(15_000);
    const removed = store.clearExpired();

    expect(removed).toBe(1);
    expect(store.get('ephemeral')).toBeUndefined();
  });

  it('entries without TTL never expire', () => {
    store.set('permanent', 'data');

    vi.advanceTimersByTime(100_000);
    const removed = store.clearExpired();

    expect(removed).toBe(0);
    expect(store.get('permanent')).toBeDefined();
  });
});
