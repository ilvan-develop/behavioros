import { describe, expect, it } from 'vitest';
import { UnderstandingEngine } from '../engines/cognitive/understanding-engine';

describe('UnderstandingEngine', () => {
  const engine = new UnderstandingEngine();

  it('should create a hypothesis linked to an observation', () => {
    const h = engine.hypothesize('obs-1', ['pattern-a', 'pattern-b']);
    expect(h.id).toBeDefined();
    expect(h.observationId).toBe('obs-1');
    expect(h.patterns).toEqual(['pattern-a', 'pattern-b']);
    expect(h.confidence).toBeGreaterThan(0);
  });

  it('should return low confidence for empty patterns', () => {
    const h = engine.hypothesize('obs-2', []);
    expect(h.confidence).toBe(0.1);
    expect(h.patterns).toEqual([]);
  });

  it('should build inference chain from rules', () => {
    const h = engine.hypothesize('obs-3', ['pattern-x']);
    const chain = engine.infer(h.id, [
      { if: 'A', thenResult: 'B', confidence: 0.9 },
      { if: 'B', thenResult: 'C', confidence: 0.8 },
    ]);
    expect(chain.hypothesisId).toBe(h.id);
    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[0].from).toBe('A');
    expect(chain.steps[0].to).toBe('B');
    expect(chain.steps[1].from).toBe('B');
    expect(chain.steps[1].to).toBe('C');
  });

  it('should propagate confidence multiplicatively through chain', () => {
    const h = engine.hypothesize('obs-4', ['pattern-z']);
    const chain = engine.infer(h.id, [
      { if: 'X', thenResult: 'Y', confidence: 0.9 },
      { if: 'Y', thenResult: 'Z', confidence: 0.8 },
    ]);
    expect(chain.overallConfidence).toBeCloseTo(0.72, 2);
  });

  it('should return zero confidence for empty rules', () => {
    const h = engine.hypothesize('obs-5', ['pattern-a']);
    const chain = engine.infer(h.id, []);
    expect(chain.overallConfidence).toBe(0);
    expect(chain.steps).toHaveLength(0);
  });

  it('should retrieve hypothesis by id', () => {
    const h = engine.hypothesize('obs-6', ['pattern-q']);
    const retrieved = engine.getHypothesis(h.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(h.id);
    expect(retrieved!.observationId).toBe('obs-6');
  });

  it('should return undefined for missing hypothesis', () => {
    expect(engine.getHypothesis('nonexistent')).toBeUndefined();
  });

  it('should retrieve inference chain by id', () => {
    const h = engine.hypothesize('obs-7', ['pattern-r']);
    const chain = engine.infer(h.id, [{ if: 'X', thenResult: 'Y', confidence: 0.9 }]);
    const retrieved = engine.getInference(chain.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(chain.id);
    expect(retrieved!.conclusion).toBe('Y');
  });

  it('should list hypotheses filtered by observation', () => {
    engine.hypothesize('obs-filter-1', ['a']);
    engine.hypothesize('obs-filter-1', ['b']);
    engine.hypothesize('obs-filter-2', ['c']);
    const filtered = engine.listHypotheses('obs-filter-1');
    expect(filtered).toHaveLength(2);
    expect(filtered.every((h) => h.observationId === 'obs-filter-1')).toBe(true);
  });

  it('should list all hypotheses when no filter given', () => {
    const count = engine.listHypotheses().length;
    expect(count).toBeGreaterThan(0);
  });

  it('should list inferences filtered by hypothesis', () => {
    const h = engine.hypothesize('obs-list-inf', ['p']);
    const c1 = engine.infer(h.id, [{ if: 'A', thenResult: 'B', confidence: 0.9 }]);
    const c2 = engine.infer(h.id, [{ if: 'B', thenResult: 'C', confidence: 0.8 }]);
    const filtered = engine.listInferences(h.id);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((i) => i.id)).toContain(c1.id);
    expect(filtered.map((i) => i.id)).toContain(c2.id);
  });

  it('should list all inferences when no filter given', () => {
    const all = engine.listInferences();
    expect(all.length).toBeGreaterThan(0);
  });

  it('should throw when inferring with unknown hypothesis', () => {
    expect(() =>
      engine.infer('nonexistent', [{ if: 'A', thenResult: 'B', confidence: 0.9 }]),
    ).toThrow('Hypothesis nonexistent not found');
  });

  it('should set and respect confidence threshold', () => {
    engine.setConfidenceThreshold(0.7);
    const h = engine.hypothesize('obs-threshold', ['p1', 'p2']);
    expect(h.confidence).toBeGreaterThan(0);
  });
});
