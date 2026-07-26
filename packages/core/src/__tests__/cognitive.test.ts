import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CognitiveIndex } from '../engines/cognitive/cognitive-index';
import { EvidenceGraph } from '../engines/cognitive/evidence-graph';
import { TruthVector } from '../engines/cognitive/truth-vector';

describe('EvidenceGraph', () => {
  let graph: EvidenceGraph;

  beforeEach(() => {
    graph = new EvidenceGraph();
  });

  it('should add an edge', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.9);
    const edge = graph.getEdge('A', 'B');
    expect(edge).toBeDefined();
    expect(edge!.source).toBe('A');
    expect(edge!.target).toBe('B');
    expect(edge!.evidenceIds).toEqual(['ev-1']);
    expect(edge!.weight).toBeCloseTo(0.9, 2);
  });

  it('should merge evidence into existing edge', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.9);
    graph.addEdge('A', 'B', 'ev-2', 0.7);
    const edge = graph.getEdge('A', 'B');
    expect(edge!.evidenceIds).toHaveLength(2);
    expect(edge!.weight).toBeGreaterThan(0.7);
    expect(edge!.weight).toBeLessThan(0.9);
  });

  it('should return undefined for non-existent edge', () => {
    expect(graph.getEdge('X', 'Y')).toBeUndefined();
  });

  it('should propagate truth across all edges', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.8);
    graph.addEdge('B', 'C', 'ev-2', 0.6);
    graph.propagateTruth();
    const edgeAB = graph.getEdge('A', 'B');
    const edgeBC = graph.getEdge('B', 'C');
    expect(edgeAB!.weight).toBeGreaterThan(0);
    expect(edgeBC!.weight).toBeGreaterThan(0);
  });

  it('should get connected edges from a source', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.9);
    graph.addEdge('A', 'C', 'ev-2', 0.8);
    const connected = graph.getConnected('A');
    expect(connected).toHaveLength(2);
    expect(connected.find((c) => c.target === 'B')!.weight).toBeCloseTo(0.9, 2);
    expect(connected.find((c) => c.target === 'C')!.weight).toBeCloseTo(0.8, 2);
  });

  it('should clear all edges', () => {
    graph.addEdge('A', 'B', 'ev-1', 0.9);
    graph.clear();
    expect(graph.getEdge('A', 'B')).toBeUndefined();
    expect(graph.getConnected('A')).toHaveLength(0);
  });

  it('should clamp weight between 0 and 1', () => {
    graph.addEdge('A', 'B', 'ev-1', 1.5);
    expect(graph.getEdge('A', 'B')!.weight).toBe(1);
    graph.addEdge('B', 'C', 'ev-2', -0.5);
    expect(graph.getEdge('B', 'C')!.weight).toBe(0);
  });
});

describe('TruthVector', () => {
  let tv: TruthVector;

  beforeEach(() => {
    tv = new TruthVector();
  });

  it('should update a domain truth', () => {
    tv.update('payments', 0.85, 10);
    const truth = tv.get('payments');
    expect(truth).toBeDefined();
    expect(truth!.domain).toBe('payments');
    expect(truth!.score).toBeCloseTo(0.85, 2);
    expect(truth!.evidenceCount).toBe(10);
  });

  it('should return undefined for unknown domain', () => {
    expect(tv.get('unknown')).toBeUndefined();
  });

  it('should get all domain truths', () => {
    tv.update('auth', 0.9, 5);
    tv.update('payments', 0.8, 15);
    const all = tv.getAll();
    expect(all).toHaveLength(2);
  });

  it('should compute overall truth score', () => {
    tv.update('auth', 1.0, 5);
    tv.update('payments', 0.5, 10);
    expect(tv.getOverall()).toBeCloseTo(0.75, 2);
  });

  it('should return 0 overall when no domains', () => {
    expect(tv.getOverall()).toBe(0);
  });

  it('should apply decay to all domains', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));

    tv.update('payments', 1.0, 10);

    vi.setSystemTime(new Date('2026-07-11T00:00:00.000Z'));
    tv.decay(0.01);

    const truth = tv.get('payments');
    const expected = 1.0 * 0.99 ** 10;
    expect(truth!.score).toBeCloseTo(expected, 2);
    expect(truth!.score).toBeLessThan(1);
    vi.useRealTimers();
  });

  it('should clamp score between 0 and 1 on update', () => {
    tv.update('test', 1.5, 1);
    expect(tv.get('test')!.score).toBe(1);
    tv.update('test', -0.5, 1);
    expect(tv.get('test')!.score).toBe(0);
  });
});

describe('CognitiveIndex', () => {
  let ci: CognitiveIndex;

  beforeEach(() => {
    ci = new CognitiveIndex();
  });

  it('should index an entry', () => {
    const entry = {
      id: '1',
      type: 'evidence' as const,
      key: 'payment-failure-rate',
      value: 0.02,
      confidence: 0.95,
      timestamp: new Date().toISOString(),
      source: 'monitoring',
    };
    ci.index(entry);
    const results = ci.search('payment');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('1');
  });

  it('should search by keyword in key', () => {
    ci.index({
      id: '1',
      type: 'fact',
      key: 'user-count',
      value: 1000,
      confidence: 0.9,
      timestamp: '2026-01-01',
      source: 'db',
    });
    ci.index({
      id: '2',
      type: 'fact',
      key: 'transaction-volume',
      value: 500,
      confidence: 0.8,
      timestamp: '2026-01-01',
      source: 'db',
    });
    expect(ci.search('user')).toHaveLength(1);
    expect(ci.search('volume')).toHaveLength(1);
    expect(ci.search('fact')).toHaveLength(0);
  });

  it('should search by keyword in source', () => {
    ci.index({
      id: '1',
      type: 'observation',
      key: 'latency',
      value: 200,
      confidence: 0.7,
      timestamp: '2026-01-01',
      source: 'grafana',
    });
    const results = ci.search('grafana');
    expect(results).toHaveLength(1);
  });

  it('should filter search by type', () => {
    ci.index({
      id: '1',
      type: 'evidence',
      key: 'cpu-usage',
      value: 0.8,
      confidence: 0.9,
      timestamp: '2026-01-01',
      source: 'metrics',
    });
    ci.index({
      id: '2',
      type: 'hypothesis',
      key: 'cpu-bottleneck',
      value: 'maybe',
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 'analyst',
    });
    const evResults = ci.search('cpu', 'evidence');
    expect(evResults).toHaveLength(1);
    expect(evResults[0].type).toBe('evidence');
  });

  it('should get entries by source', () => {
    ci.index({
      id: '1',
      type: 'evidence',
      key: 'a',
      value: 1,
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 'src-A',
    });
    ci.index({
      id: '2',
      type: 'evidence',
      key: 'b',
      value: 2,
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 'src-A',
    });
    ci.index({
      id: '3',
      type: 'evidence',
      key: 'c',
      value: 3,
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 'src-B',
    });
    expect(ci.getBySource('src-A')).toHaveLength(2);
    expect(ci.getBySource('src-B')).toHaveLength(1);
  });

  it('should get entries by type', () => {
    ci.index({
      id: '1',
      type: 'fact',
      key: 'x',
      value: true,
      confidence: 0.9,
      timestamp: '2026-01-01',
      source: 's',
    });
    ci.index({
      id: '2',
      type: 'pattern',
      key: 'y',
      value: 'pattern',
      confidence: 0.8,
      timestamp: '2026-01-01',
      source: 's',
    });
    expect(ci.getByType('fact')).toHaveLength(1);
    expect(ci.getByType('pattern')).toHaveLength(1);
  });

  it('should remove an entry by id', () => {
    ci.index({
      id: '1',
      type: 'observation',
      key: 'k',
      value: 'v',
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 's',
    });
    expect(ci.search('k')).toHaveLength(1);
    ci.remove('1');
    expect(ci.search('k')).toHaveLength(0);
  });

  it('should clear all entries', () => {
    ci.index({
      id: '1',
      type: 'fact',
      key: 'a',
      value: 1,
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 's',
    });
    ci.index({
      id: '2',
      type: 'fact',
      key: 'b',
      value: 2,
      confidence: 0.5,
      timestamp: '2026-01-01',
      source: 's',
    });
    ci.clear();
    expect(ci.search('a')).toHaveLength(0);
    expect(ci.search('b')).toHaveLength(0);
  });
});
