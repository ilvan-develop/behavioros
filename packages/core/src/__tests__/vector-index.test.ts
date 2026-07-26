import { beforeEach, describe, expect, it } from 'vitest';
import { VectorIndex } from '../engines/knowledge/vector-index';

describe('VectorIndex', () => {
  let index: VectorIndex;

  beforeEach(() => {
    index = new VectorIndex(3);
  });

  describe('insert / search', () => {
    it('should find nearest vector by cosine similarity', () => {
      index.insert('a', [1, 0, 0], { label: 'x-axis' });
      index.insert('b', [0, 1, 0], { label: 'y-axis' });
      index.insert('c', [0, 0, 1], { label: 'z-axis' });

      const results = index.search([1, 0, 0]);
      expect(results[0].id).toBe('a');
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should return correct top-k count', () => {
      index.insert('a', [1, 0, 0]);
      index.insert('b', [0, 1, 0]);
      index.insert('c', [0, 0, 1]);

      const results = index.search([1, 0, 0], 2);
      expect(results).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it('should remove an entry', () => {
      index.insert('a', [1, 0, 0]);
      expect(index.size()).toBe(1);
      index.remove('a');
      expect(index.size()).toBe(0);
    });
  });

  describe('update', () => {
    it('should update vector and metadata', () => {
      index.insert('a', [1, 0, 0], { label: 'original' });
      index.update('a', [0, 1, 0], { label: 'updated' });
      const entry = index.get('a');
      expect(entry?.vector).toEqual([0, 1, 0]);
      expect(entry?.metadata).toEqual({ label: 'updated' });
    });

    it('should throw when updating non-existent entry', () => {
      expect(() => index.update('nonexistent', [1, 0, 0])).toThrow('not found');
    });
  });

  describe('clear / size', () => {
    it('should return correct size', () => {
      expect(index.size()).toBe(0);
      index.insert('a', [1, 0, 0]);
      expect(index.size()).toBe(1);
      index.insert('b', [0, 1, 0]);
      expect(index.size()).toBe(2);
    });

    it('should clear all entries', () => {
      index.insert('a', [1, 0, 0]);
      index.insert('b', [0, 1, 0]);
      index.clear();
      expect(index.size()).toBe(0);
    });
  });

  describe('save / load', () => {
    it('should round-trip via JSON serialization', () => {
      index.insert('a', [1, 0, 0], { label: 'x' });
      index.insert('b', [0, 1, 0], { label: 'y' });

      const data = index.save();
      const newIndex = new VectorIndex(3);
      newIndex.load(data);

      expect(newIndex.size()).toBe(2);
      expect(newIndex.get('a')?.metadata).toEqual({ label: 'x' });
      expect(newIndex.get('b')?.metadata).toEqual({ label: 'y' });
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent entry', () => {
      expect(index.get('nonexistent')).toBeUndefined();
    });

    it('should return the entry if it exists', () => {
      index.insert('a', [1, 0, 0], { label: 'test' });
      const entry = index.get('a');
      expect(entry).toBeDefined();
      expect(entry!.id).toBe('a');
      expect(entry!.vector).toEqual([1, 0, 0]);
      expect(entry!.metadata).toEqual({ label: 'test' });
      expect(entry!.createdAt).toBeDefined();
    });
  });

  describe('cosine similarity', () => {
    it('should return 1 for identical vectors', () => {
      index.insert('a', [1, 2, 3]);
      const results = index.search([1, 2, 3]);
      expect(results[0].score).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      index.insert('a', [1, 0, 0]);
      const results = index.search([0, 1, 0]);
      expect(results[0].score).toBeCloseTo(0, 5);
    });
  });

  describe('empty index', () => {
    it('should return empty array for search on empty index', () => {
      const results = index.search([1, 0, 0]);
      expect(results).toEqual([]);
    });
  });

  describe('metadata', () => {
    it('should preserve metadata through insert and get', () => {
      const meta = { source: 'test', version: 1, tags: ['a', 'b'] };
      index.insert('a', [1, 0, 0], meta);
      expect(index.get('a')?.metadata).toEqual(meta);
    });

    it('should preserve metadata in search results', () => {
      index.insert('a', [1, 0, 0], { label: 'test' });
      const results = index.search([1, 0, 0]);
      expect(results[0].metadata).toEqual({ label: 'test' });
    });
  });
});
