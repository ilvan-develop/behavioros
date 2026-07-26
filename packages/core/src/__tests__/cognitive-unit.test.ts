import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CognitiveIndex, type IndexEntry } from '../engines/cognitive/cognitive-index';
import { ContextBudget } from '../engines/cognitive/context-budget';
import { EvidenceGraph } from '../engines/cognitive/evidence-graph';
import { MissionContext } from '../engines/cognitive/mission-context';
import { SemanticReasoning } from '../engines/cognitive/semantic-reasoning';
import { TruthVector } from '../engines/cognitive/truth-vector';
import type { OntologyClass } from '../engines/knowledge/ontology-manager';
import { OntologyManager } from '../engines/knowledge/ontology-manager';

describe('EvidenceGraph', () => {
  let graph: EvidenceGraph;

  beforeEach(() => {
    graph = new EvidenceGraph();
  });

  it('should add an edge between source and target', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.8);
    const edge = graph.getEdge('A', 'B');
    expect(edge).toBeDefined();
    expect(edge!.source).toBe('A');
    expect(edge!.target).toBe('B');
    expect(edge!.evidenceIds).toEqual(['ev-1']);
    expect(edge!.weight).toBeCloseTo(0.8);
  });

  it('should accumulate multiple evidence IDs on the same edge', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.8);
    graph.addEdge('A', 'B', 'ev-2', 1.0);
    graph.addEdge('A', 'B', 'ev-3', 0.6);
    const edge = graph.getEdge('A', 'B');
    expect(edge!.evidenceIds).toHaveLength(3);
    expect(edge!.evidenceIds).toContain('ev-1');
    expect(edge!.evidenceIds).toContain('ev-2');
    expect(edge!.evidenceIds).toContain('ev-3');
  });

  it('should compute average weight when adding evidence to existing edge', () => {
    graph.addEdge('A', 'B', 'ev-1', 1.0);
    graph.addEdge('A', 'B', 'ev-2', 0.0);
    const edge = graph.getEdge('A', 'B');
    // First: weight=1.0, second: (1.0*1 + 0.0) / 2 = 0.5
    expect(edge!.weight).toBeCloseTo(0.5, 2);
  });

  it('should return undefined for non-existent edge', () => {
    expect(graph.getEdge('X', 'Y')).toBeUndefined();
  });

  it('should return connected targets from a source', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.9);
    graph.addEdge('A', 'C', 'ev-2', 0.7);
    graph.addEdge('B', 'D', 'ev-3', 0.5);
    const connected = graph.getConnected('A');
    expect(connected).toHaveLength(2);
    expect(connected.map((c) => c.target)).toEqual(expect.arrayContaining(['B', 'C']));
  });

  it('should return empty array when source has no connections', () => {
    expect(graph.getConnected('Z')).toEqual([]);
  });

  it('should propagate truth across all edges', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.8);
    graph.addEdge('A', 'C', 'ev-2', 0.6);
    graph.propagateTruth();
    const edge1 = graph.getEdge('A', 'B');
    const edge2 = graph.getEdge('A', 'C');
    expect(edge1!.weight).toBeCloseTo(0.8);
    expect(edge2!.weight).toBeCloseTo(0.6);
  });

  it('should clear all edges', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.9);
    graph.addEdge('B', 'C', 'ev-2', 0.8);
    graph.clear();
    expect(graph.getEdge('A', 'B')).toBeUndefined();
    expect(graph.getConnected('B')).toHaveLength(0);
  });

  it('should clamp weight between 0 and 1', () => {
    graph.addEdge('A', 'B', 'ev-1', 1.5);
    expect(graph.getEdge('A', 'B')!.weight).toBe(1.0);
    graph.addEdge('C', 'D', 'ev-2', -0.5);
    expect(graph.getEdge('C', 'D')!.weight).toBe(0);
  });
});

describe('TruthVector', () => {
  let tv: TruthVector;

  beforeEach(() => {
    tv = new TruthVector();
  });

  it('should update a domain truth score', () => {
    tv.update('security', 0.95, 10);
    const t = tv.get('security');
    expect(t).toBeDefined();
    expect(t!.domain).toBe('security');
    expect(t!.score).toBeCloseTo(0.95);
    expect(t!.evidenceCount).toBe(10);
  });

  it('should return undefined for unknown domain', () => {
    expect(tv.get('unknown')).toBeUndefined();
  });

  it('should return all domain truths', () => {
    tv.update('security', 0.9, 5);
    tv.update('performance', 0.8, 3);
    tv.update('reliability', 0.7, 2);
    const all = tv.getAll();
    expect(all).toHaveLength(3);
  });

  it('should calculate overall truth as average of all domains', () => {
    tv.update('a', 1.0, 5);
    tv.update('b', 0.5, 3);
    tv.update('c', 0.0, 1);
    expect(tv.getOverall()).toBeCloseTo(0.5, 2);
  });

  it('should return 0 overall when no domains exist', () => {
    expect(tv.getOverall()).toBe(0);
  });

  it('should decay scores over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));
    tv.update('reliability', 1.0, 10);
    vi.setSystemTime(new Date('2026-07-11T00:00:00.000Z'));
    tv.decay(0.1);
    const t = tv.get('reliability');
    // 10 days at 10% decay: 1.0 * (1-0.1)^10 = 0.9^10 ≈ 0.3487
    const expected = 1.0 * 0.9 ** 10;
    expect(t!.score).toBeCloseTo(expected, 2);
    vi.useRealTimers();
  });

  it('should clamp score during update between 0 and 1', () => {
    tv.update('a', 2.5, 1);
    expect(tv.get('a')!.score).toBe(1.0);
    tv.update('b', -1.0, 1);
    expect(tv.get('b')!.score).toBe(0);
  });
});

describe('CognitiveIndex', () => {
  let index: CognitiveIndex;
  let entries: IndexEntry[];

  beforeEach(() => {
    index = new CognitiveIndex();
    entries = [
      {
        id: 'e1',
        type: 'evidence',
        key: 'login-failed',
        value: { count: 5 },
        confidence: 0.9,
        timestamp: '2026-01-01',
        source: 'auth-module',
      },
      {
        id: 'e2',
        type: 'pattern',
        key: 'brute-force',
        value: { threshold: 3 },
        confidence: 0.85,
        timestamp: '2026-01-02',
        source: 'auth-module',
      },
      {
        id: 'e3',
        type: 'fact',
        key: 'server-location',
        value: 'us-east',
        confidence: 1.0,
        timestamp: '2026-01-03',
        source: 'infra',
      },
    ];
    for (const e of entries) index.index(e);
  });

  it('should index entries and retrieve by search', () => {
    const results = index.search('login');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('e1');
  });

  it('should search by source field', () => {
    const results = index.search('infra');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('e3');
  });

  it('should filter search results by type', () => {
    const results = index.search('module', 'evidence');
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('evidence');
  });

  it('should return empty when no matches', () => {
    expect(index.search('nonexistent')).toHaveLength(0);
  });

  it('should get entries by source', () => {
    const results = index.getBySource('auth-module');
    expect(results).toHaveLength(2);
  });

  it('should get entries by type', () => {
    const facts = index.getByType('fact');
    expect(facts).toHaveLength(1);
    expect(facts[0].id).toBe('e3');
  });

  it('should return empty for unknown type', () => {
    expect(index.getByType('hypothesis')).toHaveLength(0);
  });

  it('should remove an entry by id', () => {
    index.remove('e1');
    expect(index.search('login')).toHaveLength(0);
  });

  it('should clear all entries', () => {
    index.clear();
    expect(index.search('login')).toHaveLength(0);
    expect(index.search('brute')).toHaveLength(0);
  });
});

describe('ContextBudget', () => {
  let budget: ContextBudget;

  beforeEach(() => {
    budget = new ContextBudget(128_000);
  });

  it('should allocate tokens to a category', () => {
    budget.allocate('planning', 10_000);
    const usage = budget.getUsage('planning');
    expect(usage.limit).toBe(10_000);
    expect(usage.used).toBe(0);
    expect(usage.remaining).toBe(10_000);
  });

  it('should consume tokens from a category', () => {
    budget.allocate('planning', 10_000);
    budget.use('planning', 3_000);
    const usage = budget.getUsage('planning');
    expect(usage.used).toBe(3_000);
    expect(usage.remaining).toBe(7_000);
  });

  it('should release tokens back to a category', () => {
    budget.allocate('planning', 10_000);
    budget.use('planning', 5_000);
    budget.release('planning', 2_000);
    expect(budget.getUsage('planning').used).toBe(3_000);
  });

  it('should not go below zero on release', () => {
    budget.allocate('planning', 10_000);
    budget.release('planning', 100);
    expect(budget.getUsage('planning').used).toBe(0);
  });

  it('should throw when using unallocated category', () => {
    expect(() => budget.use('unknown', 100)).toThrow('has no allocation');
  });

  it('should throw when releasing unallocated category', () => {
    expect(() => budget.release('unknown', 100)).toThrow('has no allocation');
  });

  it('should throw when getting usage for unallocated category', () => {
    expect(() => budget.getUsage('unknown')).toThrow('has no allocation');
  });

  it('should detect when a category is over budget', () => {
    budget.allocate('planning', 1_000);
    budget.use('planning', 1_500);
    expect(budget.isOverBudget()).toBe(true);
  });

  it('should return false when within budget', () => {
    budget.allocate('planning', 1_000);
    budget.use('planning', 500);
    expect(budget.isOverBudget()).toBe(false);
  });

  it('should return all allocations', () => {
    budget.allocate('a', 100);
    budget.allocate('b', 200);
    budget.use('a', 50);
    const all = budget.getAllocations();
    expect(all).toHaveLength(2);
    const a = all.find((x) => x.category === 'a');
    expect(a!.allocated).toBe(100);
    expect(a!.used).toBe(50);
    expect(a!.remaining).toBe(50);
  });

  it('should reset all allocations', () => {
    budget.allocate('planning', 10_000);
    budget.use('planning', 5_000);
    budget.reset();
    expect(budget.isOverBudget()).toBe(false);
    expect(() => budget.getUsage('planning')).toThrow();
    expect(budget.getAllocations()).toHaveLength(0);
  });
});

describe('MissionContext', () => {
  let mc: MissionContext;

  beforeEach(() => {
    mc = new MissionContext(100);
  });

  it('should push events and retrieve by mission id', () => {
    mc.push('mission-1', 'info', 'Started processing');
    mc.push('mission-1', 'progress', '50% complete');
    const ctx = mc.getContext('mission-1');
    expect(ctx).toHaveLength(2);
    expect(ctx[0].content).toBe('Started processing');
    expect(ctx[1].content).toBe('50% complete');
  });

  it('should isolate contexts between missions', () => {
    mc.push('mission-1', 'info', 'A');
    mc.push('mission-2', 'info', 'B');
    expect(mc.getContext('mission-1')).toHaveLength(1);
    expect(mc.getContext('mission-2')).toHaveLength(1);
  });

  it('should search events by content', () => {
    mc.push('mission-1', 'error', 'Connection timeout');
    mc.push('mission-1', 'info', 'Retrying connection');
    const results = mc.search('mission-1', 'timeout');
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Connection timeout');
  });

  it('should search events by type', () => {
    mc.push('mission-1', 'error', 'Something broke');
    mc.push('mission-1', 'warning', 'Something is off');
    mc.push('mission-1', 'error', 'Something else broke');
    const errors = mc.search('mission-1', 'error');
    expect(errors).toHaveLength(2);
  });

  it('should clear events for a specific mission', () => {
    mc.push('mission-1', 'info', 'A');
    mc.push('mission-2', 'info', 'B');
    mc.clear('mission-1');
    expect(mc.getContext('mission-1')).toHaveLength(0);
    expect(mc.getContext('mission-2')).toHaveLength(1);
  });

  it('should clear all events when no mission id', () => {
    mc.push('mission-1', 'info', 'A');
    mc.push('mission-2', 'info', 'B');
    mc.clear();
    expect(mc.getContext('mission-1')).toHaveLength(0);
    expect(mc.getContext('mission-2')).toHaveLength(0);
  });

  it('should enforce window size limit', () => {
    const small = new MissionContext(3);
    small.push('m-1', 'a', '1');
    small.push('m-1', 'b', '2');
    small.push('m-1', 'c', '3');
    small.push('m-1', 'd', '4');
    const ctx = small.getContext('m-1');
    expect(ctx).toHaveLength(3);
    expect(ctx[0].content).toBe('2');
  });

  it('should generate unique ids for each event', () => {
    mc.push('m-1', 'a', 'first');
    mc.push('m-1', 'b', 'second');
    const [a, b] = mc.getContext('m-1');
    expect(a.id).not.toBe(b.id);
  });
});

describe('SemanticReasoning', () => {
  let sr: SemanticReasoning;

  beforeEach(() => {
    sr = new SemanticReasoning();
  });

  it('should add facts to knowledge base', () => {
    sr.addFact('Socrates', 'is-a', 'Human');
    const results = sr.queryKnowledge('Socrates');
    expect(results).toEqual(['Human']);
  });

  it('should query knowledge by predicate', () => {
    sr.addFact('Socrates', 'is-a', 'Human');
    sr.addFact('Socrates', 'lives-in', 'Athens');
    const isA = sr.queryKnowledge('Socrates', 'is-a');
    expect(isA).toEqual(['Human']);
    const livesIn = sr.queryKnowledge('Socrates', 'lives-in');
    expect(livesIn).toEqual(['Athens']);
  });

  it('should return empty for unknown subject', () => {
    expect(sr.queryKnowledge('Unknown')).toEqual([]);
  });

  it('should infer transitive relations', () => {
    sr.addFact('Athens', 'located-in', 'Greece');
    sr.addFact('Socrates', 'located-in', 'Athens');
    const relations = sr.inferRelations('Socrates', [
      { predicate: 'located-in', object: 'Athens' },
    ]);
    expect(relations).toHaveLength(1);
    expect(relations[0].source).toBe('Socrates');
    expect(relations[0].target).toBe('Greece');
    expect(relations[0].relation).toBe('located-in');
    expect(relations[0].confidence).toBe(0.6);
  });

  it('should not infer for non-transitive predicates', () => {
    sr.addFact('Socrates', 'lives-in', 'Athens');
    // 'lives-in' is not in the transitive list
    const relations = sr.inferRelations('Socrates', [{ predicate: 'lives-in', object: 'Athens' }]);
    expect(relations).toHaveLength(0);
  });

  it('should infer transitive chain for is-a', () => {
    sr.addFact('Socrates', 'is-a', 'Human');
    sr.addFact('Human', 'is-a', 'Mortal');
    const relations = sr.inferRelations('Socrates', [{ predicate: 'is-a', object: 'Human' }]);
    expect(relations).toHaveLength(1);
    expect(relations[0].target).toBe('Mortal');
  });

  it('should detect direct value contradictions', () => {
    const facts = [
      { subject: 'server-1', predicate: 'status', object: 'online' },
      { subject: 'server-1', predicate: 'status', object: 'offline' },
    ];
    const contradictions = sr.detectContradictions(facts);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].reason).toContain('Conflicting values for "status"');
  });

  it('should detect opposite predicate contradictions', () => {
    const facts = [
      { subject: 'user-1', predicate: 'is-active', object: 'true' },
      { subject: 'user-1', predicate: 'is-inactive', object: 'true' },
    ];
    const contradictions = sr.detectContradictions(facts);
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].reason).toContain('"is-active" contradicts "is-inactive"');
  });

  it('should not detect contradictions when facts agree', () => {
    const facts = [
      { subject: 'server-1', predicate: 'status', object: 'online' },
      { subject: 'server-2', predicate: 'status', object: 'offline' },
    ];
    expect(sr.detectContradictions(facts)).toHaveLength(0);
  });

  it('should infer relations via ontology hierarchy', () => {
    const om = new OntologyManager();
    const cls1: OntologyClass = {
      id: 'animal',
      name: 'Animal',
      properties: [],
      constraints: [],
    };
    const cls2: OntologyClass = {
      id: 'mammal',
      name: 'Mammal',
      parentId: 'animal',
      properties: [],
      constraints: [],
    };
    om.defineClass(cls1);
    om.defineClass(cls2);

    const srWithOnt = new SemanticReasoning(om);
    srWithOnt.addFact('Dog', 'is-a', 'mammal');
    const relations = srWithOnt.inferRelations('Dog', [{ predicate: 'is-a', object: 'mammal' }]);
    expect(relations).toHaveLength(1);
    expect(relations[0].target).toBe('animal');
    expect(relations[0].relation).toBe('is-a-via-hierarchy');
    expect(relations[0].confidence).toBe(0.5);
  });
});
