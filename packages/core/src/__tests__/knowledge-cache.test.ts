import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeCache } from '../engines/knowledge/knowledge-cache';

describe('KnowledgeCache', () => {
  let cache: KnowledgeCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new KnowledgeCache(3, 300_000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('set / get', () => {
    it('should set and get a value', () => {
      cache.set('key1', { data: 'hello' });
      expect(cache.get('key1')).toEqual({ data: 'hello' });
    });

    it('should return undefined for missing key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing key and reset TTL', () => {
      cache.set('key1', 'first');
      vi.advanceTimersByTime(100_000);
      cache.set('key1', 'second');
      vi.advanceTimersByTime(250_000);
      expect(cache.get('key1')).toBe('second');
    });

    it('should use custom TTL on set', () => {
      cache.set('key1', 'fast', 50_000);
      vi.advanceTimersByTime(60_000);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should return undefined for expired entry', () => {
      cache.set('key1', 'value');
      vi.advanceTimersByTime(300_001);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should remove expired entry internally', () => {
      cache.set('key1', 'value');
      vi.advanceTimersByTime(300_001);
      cache.get('key1');
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when at capacity', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.get('d')).toBe(4);
    });

    it('should evict in correct order based on access recency', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.get('a');
      cache.set('d', 4);
      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
    });
  });

  describe('invalidate', () => {
    it('should invalidate a single key', () => {
      cache.set('key1', 'value');
      cache.invalidate('key1');
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should invalidate keys by prefix', () => {
      cache.set('user:1', 'alice');
      cache.set('user:2', 'bob');
      cache.set('config:1', 'dark');
      cache.invalidateByPrefix('user:');
      expect(cache.get('user:1')).toBeUndefined();
      expect(cache.get('user:2')).toBeUndefined();
      expect(cache.get('config:1')).toBe('dark');
    });

    it('should clear all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();
      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBeUndefined();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      cache.set('key1', 'value');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing key', () => {
      expect(cache.has('nope')).toBe(false);
    });

    it('should return false for expired key', () => {
      cache.set('key1', 'value');
      vi.advanceTimersByTime(300_001);
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.evictions).toBe(0);
    });

    it('should track hits and misses', () => {
      cache.set('a', 1);
      cache.get('a');
      cache.get('b');
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track evictions', () => {
      cache = new KnowledgeCache(2, 300_000);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      expect(cache.getStats().evictions).toBe(1);
    });

    it('should reset stats on clear', () => {
      cache.set('a', 1);
      cache.get('a');
      cache.clear();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });
});
