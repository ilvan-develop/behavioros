import { describe, expect, it } from 'vitest';
import {
  type EvaluationCriterion,
  EvaluationEngine,
} from '../engines/intelligence/evaluation-engine';

describe('EvaluationEngine', () => {
  const accuracy: EvaluationCriterion = {
    id: 'accuracy',
    name: 'Accuracy',
    weight: 0.5,
    threshold: 0.8,
    description: 'Accuracy of the response',
  };
  const relevance: EvaluationCriterion = {
    id: 'relevance',
    name: 'Relevance',
    weight: 0.3,
    threshold: 0.7,
    description: 'Relevance to the query',
  };
  const coherence: EvaluationCriterion = {
    id: 'coherence',
    name: 'Coherence',
    weight: 0.2,
    threshold: 0.6,
    description: 'Logical coherence',
  };

  it('should register a criterion', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    expect(engine.getCriteria()).toHaveLength(1);
    expect(engine.getCriteria()[0].id).toBe('accuracy');
  });

  it('should evaluate with all criteria passing', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);
    engine.registerCriterion(coherence);

    const result = engine.evaluate('target-1', 'response', {
      accuracy: 0.9,
      relevance: 0.85,
      coherence: 0.8,
    });

    expect(result.passed).toBe(true);
    expect(result.weightedScore).toBeCloseTo(0.865, 3);
    expect(result.targetId).toBe('target-1');
    expect(result.targetType).toBe('response');
    expect(result.id).toBeDefined();
    expect(result.evaluatedAt).toBeDefined();
  });

  it('should evaluate with some failures', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);
    engine.registerCriterion(coherence);

    const result = engine.evaluate('target-2', 'response', {
      accuracy: 0.9,
      relevance: 0.85,
      coherence: 0.3,
    });

    expect(result.passed).toBe(true);
    expect(result.weightedScore).toBeCloseTo(0.765, 3);
  });

  it('should reject below overall threshold', () => {
    const engine = new EvaluationEngine({ overallThreshold: 0.9 });
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);
    engine.registerCriterion(coherence);

    const result = engine.evaluate('target-3', 'response', {
      accuracy: 0.8,
      relevance: 0.7,
      coherence: 0.6,
    });

    expect(result.passed).toBe(false);
    expect(result.weightedScore).toBeCloseTo(0.73, 3);
  });

  it('should throw when a criterion score is missing', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);

    expect(() =>
      engine.evaluate('target-4', 'response', {
        accuracy: 0.9,
      }),
    ).toThrow('Missing score for criterion "relevance"');
  });

  it('should throw when no criteria are registered', () => {
    const engine = new EvaluationEngine();

    expect(() => engine.evaluate('target-5', 'response', {})).toThrow('No criteria registered');
  });

  it('should maintain evaluation history', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);

    const r1 = engine.evaluate('target-6', 'response', { accuracy: 0.9 });
    const r2 = engine.evaluate('target-6', 'response', { accuracy: 0.8 });

    const history = engine.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe(r1.id);
    expect(history[1].id).toBe(r2.id);
  });

  it('should filter history by targetId', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);

    engine.evaluate('target-a', 'response', { accuracy: 0.9 });
    engine.evaluate('target-b', 'response', { accuracy: 0.8 });
    engine.evaluate('target-a', 'response', { accuracy: 0.95 });

    const historyA = engine.getHistory('target-a');
    expect(historyA).toHaveLength(2);

    const historyB = engine.getHistory('target-b');
    expect(historyB).toHaveLength(1);
  });

  it('should compute weighted score correctly', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);
    engine.registerCriterion(coherence);

    const result = engine.evaluate('target-w', 'response', {
      accuracy: 1.0,
      relevance: 0.5,
      coherence: 0.0,
    });

    expect(result.weightedScore).toBeCloseTo(0.65, 3);
  });

  it('should get all registered criteria', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);

    const criteria = engine.getCriteria();
    expect(criteria).toHaveLength(2);
    expect(criteria.map((c) => c.id)).toEqual(['accuracy', 'relevance']);
  });

  it('should remove a criterion', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);
    engine.registerCriterion(relevance);
    expect(engine.getCriteria()).toHaveLength(2);

    engine.removeCriterion('accuracy');
    expect(engine.getCriteria()).toHaveLength(1);
    expect(engine.getCriteria()[0].id).toBe('relevance');
  });

  it('should set overall threshold', () => {
    const engine = new EvaluationEngine({ overallThreshold: 0.9 });
    engine.registerCriterion(accuracy);

    const r1 = engine.evaluate('t1', 'response', { accuracy: 0.8 });
    expect(r1.passed).toBe(false);

    engine.setOverallThreshold(0.5);
    const r2 = engine.evaluate('t2', 'response', { accuracy: 0.8 });
    expect(r2.passed).toBe(true);
  });

  it('should attach details to result', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);

    const result = engine.evaluate(
      'target-d',
      'response',
      { accuracy: 0.9 },
      { accuracy: 'High accuracy score' },
    );

    expect(result.details.accuracy).toBe('High accuracy score');
  });

  it('should return empty history when no evaluations exist', () => {
    const engine = new EvaluationEngine();
    expect(engine.getHistory()).toHaveLength(0);
    expect(engine.getHistory('nonexistent')).toHaveLength(0);
  });

  it('should handle single criterion evaluation', () => {
    const engine = new EvaluationEngine();
    engine.registerCriterion(accuracy);

    const result = engine.evaluate('target-single', 'response', {
      accuracy: 1.0,
    });

    expect(result.weightedScore).toBe(1.0);
    expect(result.passed).toBe(true);
  });
});
