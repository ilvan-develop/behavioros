import { beforeEach, describe, expect, it } from 'vitest';
import { FactExtractor } from '../engines/knowledge/fact-extractor';

describe('FactExtractor', () => {
  let extractor: FactExtractor;

  beforeEach(() => {
    extractor = new FactExtractor();
  });

  describe('extractTriples', () => {
    it('should extract a simple "X is Y" triple', () => {
      const triples = extractor.extractTriples('Node.js is a runtime');
      expect(triples).toHaveLength(1);
      expect(triples[0].subject).toBe('Node.js');
      expect(triples[0].predicate).toBe('is');
      expect(triples[0].object).toBe('runtime');
      expect(triples[0].confidence).toBeGreaterThan(0);
    });

    it('should extract "X has Y" triple', () => {
      const triples = extractor.extractTriples('PostgreSQL has JSON');
      expect(triples).toHaveLength(1);
      expect(triples[0].subject).toBe('PostgreSQL');
      expect(triples[0].predicate).toBe('has');
      expect(triples[0].object).toBe('JSON');
    });

    it('should extract "X uses Y" triple', () => {
      const triples = extractor.extractTriples('The application uses Redis');
      expect(triples).toHaveLength(1);
      expect(triples[0].predicate).toBe('uses');
      expect(triples[0].object).toBe('Redis');
    });

    it('should extract "X was Y" triple', () => {
      const triples = extractor.extractTriples('Docker was a game changer');
      expect(triples).toHaveLength(1);
      expect(triples[0].subject).toBe('Docker');
      expect(triples[0].predicate).toBe('was');
    });

    it('should extract multiple triples from a sentence', () => {
      const triples = extractor.extractTriples(
        'Node.js is a runtime and PostgreSQL has JSON support',
      );
      expect(triples.length).toBeGreaterThanOrEqual(2);
      expect(triples.map((t) => t.subject)).toContain('Node.js');
      expect(triples.map((t) => t.subject)).toContain('PostgreSQL');
    });
  });

  describe('extractEntities', () => {
    it('should find known technology entities', () => {
      const entities = extractor.extractEntities('Node.js and PostgreSQL are great');
      expect(entities.length).toBeGreaterThanOrEqual(2);
      expect(entities.find((e) => e.text === 'node.js' && e.type === 'technology')).toBeDefined();
      expect(
        entities.find((e) => e.text === 'postgresql' && e.type === 'technology'),
      ).toBeDefined();
    });

    it('should find organization entities', () => {
      const entities = extractor.extractEntities('AWS and Google provide cloud services');
      expect(entities.find((e) => e.text === 'aws' && e.type === 'organization')).toBeDefined();
      expect(entities.find((e) => e.text === 'google' && e.type === 'organization')).toBeDefined();
    });

    it('should find concept entities', () => {
      const entities = extractor.extractEntities('Authentication uses encryption');
      expect(
        entities.find((e) => e.text === 'authentication' && e.type === 'concept'),
      ).toBeDefined();
      expect(entities.find((e) => e.text === 'encryption' && e.type === 'concept')).toBeDefined();
    });
  });

  describe('extractTemporal', () => {
    it('should extract absolute date with year', () => {
      const temporal = extractor.extractTemporal('released in 2024');
      expect(temporal).toBeDefined();
      expect(temporal!.type).toBe('absolute');
    });

    it('should extract relative temporal expressions', () => {
      const temporal = extractor.extractTemporal('deployed yesterday');
      expect(temporal).toBeDefined();
      expect(temporal!.type).toBe('relative');
    });

    it('should extract duration expressions', () => {
      const temporal = extractor.extractTemporal('ran for 3 days');
      expect(temporal).toBeDefined();
      expect(temporal!.type).toBe('duration');
    });

    it('should return undefined when no temporal expression is found', () => {
      const temporal = extractor.extractTemporal('Node.js is a runtime');
      expect(temporal).toBeUndefined();
    });
  });

  describe('extract (full pipeline)', () => {
    it('should extract complete facts from text', () => {
      const facts = extractor.extract(
        'Node.js is a runtime. PostgreSQL uses encryption.',
        'test-source',
      );
      expect(facts).toHaveLength(2);
      expect(facts[0].subject).toBe('Node.js');
      expect(facts[0].source).toBe('test-source');
      expect(facts[0].entities.length).toBeGreaterThan(0);
      expect(facts[0].id).toBeDefined();
      expect(facts[0].extractedAt).toBeDefined();
    });

    it('should return empty array for empty text', () => {
      const facts = extractor.extract('', 'source');
      expect(facts).toEqual([]);
    });

    it('should return empty array for whitespace-only text', () => {
      const facts = extractor.extract('   ', 'source');
      expect(facts).toEqual([]);
    });

    it('should associate entities with facts they belong to', () => {
      const facts = extractor.extract('Node.js is a runtime', 'src');
      expect(facts[0].entities).toHaveLength(1);
      expect(facts[0].entities[0].text).toBe('node.js');
    });

    it('should extract facts with temporal context', () => {
      const facts = extractor.extract('Node.js was released in 2024', 'docs');
      expect(facts).toHaveLength(1);
      expect(facts[0].temporal).toBeDefined();
      expect(facts[0].temporal!.type).toBe('absolute');
    });

    it('should compute confidence from triple word count', () => {
      const short = extractor.extract('X is Y', 'a');
      const long = extractor.extract('PostgreSQL database uses JSON support', 'b');
      expect(long[0].confidence).toBeGreaterThanOrEqual(short[0].confidence);
    });
  });

  describe('getFacts', () => {
    it('should filter facts by source', () => {
      extractor.extract('Node.js is a runtime', 'src-a');
      extractor.extract('PostgreSQL has JSON', 'src-b');
      const filtered = extractor.getFacts('src-a');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].subject).toBe('Node.js');
    });

    it('should return all facts when no source is provided', () => {
      extractor.extract('Node.js is a runtime', 'a');
      extractor.extract('PostgreSQL has JSON', 'b');
      expect(extractor.getFacts()).toHaveLength(2);
    });

    it('should return empty array when no facts match source', () => {
      expect(extractor.getFacts('nonexistent')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear all stored facts', () => {
      extractor.extract('Node.js is a runtime', 'src');
      expect(extractor.getFacts()).toHaveLength(1);
      extractor.clear();
      expect(extractor.getFacts()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should not extract triple from text without patterns', () => {
      const triples = extractor.extractTriples('The quick brown fox');
      expect(triples).toEqual([]);
    });

    it('should extract "X created Y" triple', () => {
      const triples = extractor.extractTriples('Ryan Dahl created Node.js');
      expect(triples).toHaveLength(1);
      expect(triples[0].predicate).toBe('created');
    });

    it('should handle incomplete triples gracefully', () => {
      const triples = extractor.extractTriples('Hello is');
      expect(triples).toHaveLength(0);
    });
  });
});
