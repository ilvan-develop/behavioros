import { beforeEach, describe, expect, it } from 'vitest';
import { ContextBudget } from '../engines/cognitive/context-budget';
import { MissionContext } from '../engines/cognitive/mission-context';
import { SemanticReasoning } from '../engines/cognitive/semantic-reasoning';
import { OntologyManager } from '../engines/knowledge/ontology-manager';

describe('ContextBudget', () => {
  let budget: ContextBudget;

  beforeEach(() => {
    budget = new ContextBudget(128_000);
  });

  describe('allocate / use / release', () => {
    it('should allocate a category and track usage', () => {
      budget.allocate('reasoning', 50_000);
      budget.use('reasoning', 10_000);
      const usage = budget.getUsage('reasoning');
      expect(usage.used).toBe(10_000);
      expect(usage.limit).toBe(50_000);
      expect(usage.remaining).toBe(40_000);
    });

    it('should release tokens and not go below zero', () => {
      budget.allocate('memory', 10_000);
      budget.use('memory', 5_000);
      budget.release('memory', 3_000);
      expect(budget.getUsage('memory').used).toBe(2_000);
      budget.release('memory', 10_000);
      expect(budget.getUsage('memory').used).toBe(0);
    });

    it('should throw on use without allocation', () => {
      expect(() => budget.use('unknown', 100)).toThrow('has no allocation');
    });

    it('should throw on release without allocation', () => {
      expect(() => budget.release('unknown', 100)).toThrow('has no allocation');
    });

    it('should throw getUsage without allocation', () => {
      expect(() => budget.getUsage('unknown')).toThrow('has no allocation');
    });
  });

  describe('isOverBudget', () => {
    it('should return false when under limit', () => {
      budget.allocate('planning', 10_000);
      budget.use('planning', 5_000);
      expect(budget.isOverBudget()).toBe(false);
    });

    it('should return true when over limit', () => {
      budget.allocate('planning', 10_000);
      budget.use('planning', 15_000);
      expect(budget.isOverBudget()).toBe(true);
    });

    it('should return false when no allocations exist', () => {
      expect(budget.isOverBudget()).toBe(false);
    });
  });

  describe('getAllocations', () => {
    it('should return all allocations with remaining', () => {
      budget.allocate('a', 100);
      budget.allocate('b', 200);
      budget.use('a', 30);
      const allocations = budget.getAllocations();
      expect(allocations).toHaveLength(2);
      expect(allocations.find((a) => a.category === 'a')?.remaining).toBe(70);
      expect(allocations.find((a) => a.category === 'b')?.remaining).toBe(200);
    });

    it('should return empty array when no allocations', () => {
      expect(budget.getAllocations()).toEqual([]);
    });
  });

  describe('reset', () => {
    it('should clear all allocations', () => {
      budget.allocate('x', 500);
      budget.use('x', 100);
      budget.reset();
      expect(budget.getAllocations()).toEqual([]);
      expect(budget.isOverBudget()).toBe(false);
    });
  });

  describe('constructor default', () => {
    it('should use default total budget of 128000', () => {
      const b = new ContextBudget();
      b.allocate('test', 128_000);
      expect(b.getUsage('test').limit).toBe(128_000);
    });
  });
});

describe('MissionContext', () => {
  let mc: MissionContext;

  beforeEach(() => {
    mc = new MissionContext(5);
  });

  describe('push / getContext', () => {
    it('should push events and retrieve them by mission', () => {
      mc.push('m1', 'info', 'started');
      mc.push('m1', 'info', 'processing');
      mc.push('m2', 'error', 'failed');
      const ctx = mc.getContext('m1');
      expect(ctx).toHaveLength(2);
      expect(ctx[0].content).toBe('started');
      expect(ctx[1].content).toBe('processing');
    });

    it('should return empty array for unknown mission', () => {
      expect(mc.getContext('nonexistent')).toEqual([]);
    });
  });

  describe('search', () => {
    it('should find events matching content query', () => {
      mc.push('m1', 'info', 'payment processed');
      mc.push('m1', 'warn', 'payment retry');
      mc.push('m2', 'info', 'other event');
      const results = mc.search('m1', 'payment');
      expect(results).toHaveLength(2);
    });

    it('should find events matching type query', () => {
      mc.push('m1', 'error', 'timeout occurred');
      mc.push('m1', 'info', 'completed');
      const results = mc.search('m1', 'error');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('error');
    });

    it('should return empty when no match', () => {
      mc.push('m1', 'info', 'hello world');
      expect(mc.search('m1', 'zzzz')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should clear events for a specific mission', () => {
      mc.push('m1', 'info', 'a');
      mc.push('m2', 'info', 'b');
      mc.clear('m1');
      expect(mc.getContext('m1')).toHaveLength(0);
      expect(mc.getContext('m2')).toHaveLength(1);
    });

    it('should clear all events when no mission specified', () => {
      mc.push('m1', 'info', 'a');
      mc.push('m2', 'info', 'b');
      mc.clear();
      expect(mc.getContext('m1')).toHaveLength(0);
      expect(mc.getContext('m2')).toHaveLength(0);
    });
  });

  describe('window size eviction', () => {
    it('should evict oldest events when exceeding window size', () => {
      for (let i = 0; i < 10; i++) {
        mc.push('m1', 'info', `event-${i}`);
      }
      const ctx = mc.getContext('m1');
      expect(ctx).toHaveLength(5);
      expect(ctx[0].content).toBe('event-5');
      expect(ctx[4].content).toBe('event-9');
    });
  });

  it('should assign unique id and timestamp to each event', () => {
    mc.push('m1', 'info', 'first');
    mc.push('m1', 'info', 'second');
    const ctx = mc.getContext('m1');
    expect(ctx[0].id).toBeDefined();
    expect(ctx[1].id).toBeDefined();
    expect(ctx[0].id).not.toBe(ctx[1].id);
    expect(ctx[0].timestamp).toBeDefined();
  });
});

describe('SemanticReasoning', () => {
  let sr: SemanticReasoning;

  beforeEach(() => {
    sr = new SemanticReasoning();
  });

  describe('inferRelations', () => {
    it('should infer transitive relations from known facts', () => {
      sr.addFact('manager', 'reports-to', 'director');
      sr.addFact('employee', 'reports-to', 'manager');
      const relations = [{ predicate: 'reports-to', object: 'manager' }];
      const inferred = sr.inferRelations('employee', relations);
      expect(inferred).toHaveLength(1);
      expect(inferred[0].source).toBe('employee');
      expect(inferred[0].target).toBe('director');
      expect(inferred[0].relation).toBe('reports-to');
      expect(inferred[0].confidence).toBe(0.6);
    });

    it('should skip non-transitive predicates', () => {
      sr.addFact('user', 'likes', 'coffee');
      const relations = [{ predicate: 'likes', object: 'coffee' }];
      const inferred = sr.inferRelations('user', relations);
      expect(inferred).toHaveLength(0);
    });

    it('should infer hierarchy relations when ontologyManager is provided', () => {
      const om = new OntologyManager();
      om.defineClass({ id: 'animal', name: 'Animal', properties: [], constraints: [] });
      om.defineClass({
        id: 'mammal',
        name: 'Mammal',
        parentId: 'animal',
        properties: [],
        constraints: [],
      });
      om.defineClass({
        id: 'dog',
        name: 'Dog',
        parentId: 'mammal',
        properties: [],
        constraints: [],
      });
      sr = new SemanticReasoning(om);
      const inferred = sr.inferRelations('buddy', [{ predicate: 'is-a', object: 'dog' }]);
      const hierarchies = inferred.filter((r) => r.relation.endsWith('-via-hierarchy'));
      expect(hierarchies.length).toBeGreaterThanOrEqual(2);
      expect(hierarchies.map((r) => r.target)).toContain('animal');
    });
  });

  describe('detectContradictions', () => {
    it('should detect direct contradictory values for same predicate', () => {
      const facts = [
        { subject: 'user', predicate: 'status', object: 'active' },
        { subject: 'user', predicate: 'status', object: 'inactive' },
      ];
      const contradictions = sr.detectContradictions(facts);
      expect(contradictions).toHaveLength(1);
      expect(contradictions[0].reason).toContain('Conflicting values');
    });

    it('should detect opposite predicate contradictions', () => {
      const facts = [
        { subject: 'user', predicate: 'is-active', object: 'true' },
        { subject: 'user', predicate: 'is-inactive', object: 'true' },
      ];
      const contradictions = sr.detectContradictions(facts);
      expect(contradictions).toHaveLength(1);
      expect(contradictions[0].reason).toContain('contradicts');
    });

    it('should detect transitive contradictions', () => {
      sr.addFact('admin', 'deny-access', 'resource');
      const facts = [
        { subject: 'user', predicate: 'has-access', object: 'admin' },
        { subject: 'user', predicate: 'has-access', object: 'resource' },
      ];
      const contradictions = sr.detectContradictions(facts);
      const transitive = contradictions.filter((c) =>
        c.reason.includes('Transitive contradiction'),
      );
      expect(transitive.length).toBeGreaterThan(0);
    });

    it('should return empty for non-contradictory facts', () => {
      const facts = [
        { subject: 'user', predicate: 'name', object: 'Alice' },
        { subject: 'user', predicate: 'age', object: '30' },
      ];
      expect(sr.detectContradictions(facts)).toEqual([]);
    });
  });

  describe('queryKnowledge', () => {
    it('should return objects for a given subject', () => {
      sr.addFact('server', 'located-in', 'us-east');
      sr.addFact('server', 'located-in', 'us-west');
      sr.addFact('server', 'status', 'healthy');
      const locations = sr.queryKnowledge('server', 'located-in');
      expect(locations).toEqual(['us-east', 'us-west']);
    });

    it('should return all objects when predicate is omitted', () => {
      sr.addFact('server', 'status', 'healthy');
      sr.addFact('server', 'region', 'us');
      const results = sr.queryKnowledge('server');
      expect(results).toEqual(['healthy', 'us']);
    });

    it('should return empty array for unknown subject', () => {
      expect(sr.queryKnowledge('ghost')).toEqual([]);
    });
  });
});
