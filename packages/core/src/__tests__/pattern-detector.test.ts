import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningEvolver } from '../engines/intelligence/learning-evolver';
import type { DetectedPattern } from '../engines/intelligence/pattern-detector';
import { PatternDetector } from '../engines/intelligence/pattern-detector';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new PatternDetector();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should record events and return empty getAllPatterns before detection', () => {
    detector.record('login', { user: 'alice' });
    detector.record('logout', { user: 'alice' });
    const patterns = detector.getAllPatterns();
    expect(patterns).toEqual([]);
  });

  it('should detect frequent sequences with default minOccurrences', () => {
    const seq = ['error', 'retry', 'success'];
    for (let i = 0; i < 3; i++) {
      for (const type of seq) {
        detector.record(type, {});
      }
    }
    const patterns = detector.detectFrequentSequences();
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.type).toBe('frequent-sequence');
      expect(p.frequency).toBeGreaterThanOrEqual(2);
      expect(p.confidence).toBeGreaterThan(0);
    }
  });

  it('should detect frequent sequences with custom minOccurrences', () => {
    for (let i = 0; i < 5; i++) {
      detector.record('a', {});
      detector.record('b', {});
    }
    const patterns = detector.detectFrequentSequences(4);
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.frequency).toBeGreaterThanOrEqual(4);
    }
  });

  it('should not detect frequent sequences when minOccurrences not met', () => {
    detector.record('x', {});
    detector.record('y', {});
    const patterns = detector.detectFrequentSequences(5);
    expect(patterns.length).toBe(0);
  });

  it('should detect anomalies using time-binned z-score analysis', () => {
    for (let i = 0; i < 20; i++) {
      detector.record('heartbeat', { seq: i });
      vi.advanceTimersByTime(500);
    }
    for (let i = 0; i < 10; i++) {
      detector.record('heartbeat', { seq: 20 + i });
      vi.advanceTimersByTime(10);
    }
    const patterns = detector.detectAnomalies(10, 2);
    expect(patterns.length).toBeGreaterThan(0);
    for (const p of patterns) {
      expect(p.type).toBe('anomaly');
      expect(p.severity).toBeDefined();
      expect(p.relatedEvents.length).toBeGreaterThan(0);
    }
  });

  it('should detect anomalies with custom stdDevThreshold', () => {
    for (let i = 0; i < 20; i++) {
      detector.record('metric', { seq: i });
      vi.advanceTimersByTime(500);
    }
    for (let i = 0; i < 5; i++) {
      detector.record('metric', { seq: 20 + i });
      vi.advanceTimersByTime(10);
    }
    const patterns = detector.detectAnomalies(5, 1);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should detect upward trends using time bins', () => {
    for (let i = 0; i < 10; i++) {
      detector.record('deploy', {});
      vi.advanceTimersByTime(1000);
    }
    for (let i = 0; i < 30; i++) {
      detector.record('deploy', {});
      vi.advanceTimersByTime(100);
    }
    const patterns = detector.detectTrends(5);
    const deployTrends = patterns.filter((p) => p.name.includes('deploy'));
    expect(deployTrends.length).toBeGreaterThan(0);
    expect(deployTrends[0].description).toMatch(/increasing/i);
  });

  it('should detect downward trends using time bins', () => {
    for (let i = 0; i < 30; i++) {
      detector.record('error', {});
      vi.advanceTimersByTime(100);
    }
    for (let i = 0; i < 10; i++) {
      detector.record('error', {});
      vi.advanceTimersByTime(1000);
    }
    const patterns = detector.detectTrends(5);
    const errorTrends = patterns.filter((p) => p.name.includes('error'));
    expect(errorTrends.length).toBeGreaterThan(0);
    expect(errorTrends[0].description).toMatch(/decreasing/i);
  });

  it('should not detect trends when data is flat', () => {
    for (let i = 0; i < 30; i++) {
      detector.record('metric', { value: 42 });
      vi.advanceTimersByTime(1000);
    }
    const patterns = detector.detectTrends(5);
    const metricTrends = patterns.filter((p) => p.name.includes('metric'));
    expect(metricTrends.length).toBe(0);
  });

  it('should return empty array for trends with insufficient data', () => {
    detector.record('a', {});
    const patterns = detector.detectTrends(10);
    expect(patterns.length).toBe(0);
  });

  it('should return all patterns via getAllPatterns', () => {
    for (let i = 0; i < 3; i++) {
      detector.record('error', {});
      detector.record('retry', {});
      detector.record('success', {});
      vi.advanceTimersByTime(100);
    }
    for (let i = 0; i < 40; i++) {
      detector.record('heartbeat', { seq: i });
      vi.advanceTimersByTime(100);
    }

    detector.detectFrequentSequences();

    const all = detector.getAllPatterns();
    expect(all.length).toBeGreaterThan(0);

    const types = new Set(all.map((p) => p.type));
    expect(types.has('frequent-sequence')).toBe(true);
  });

  it('should clear all events and patterns', () => {
    for (let i = 0; i < 3; i++) {
      detector.record('test', {});
    }
    detector.detectFrequentSequences();
    expect(detector.getAllPatterns().length).toBeGreaterThan(0);

    detector.clear();
    expect(detector.getAllPatterns().length).toBe(0);
  });

  it('should return empty array when detecting with no events', () => {
    const sequences = detector.detectFrequentSequences();
    const anomalies = detector.detectAnomalies();
    const trends = detector.detectTrends();

    expect(sequences).toEqual([]);
    expect(anomalies).toEqual([]);
    expect(trends).toEqual([]);
  });

  it('should return empty array for anomalies with insufficient data', () => {
    detector.record('event', {});
    const patterns = detector.detectAnomalies(10);
    expect(patterns).toEqual([]);
  });

  it('should update confidence on repeated detection', () => {
    for (let i = 0; i < 3; i++) {
      detector.record('a', {});
      detector.record('b', {});
    }
    detector.detectFrequentSequences();
    const firstConfidence =
      detector.getAllPatterns().find((p) => p.type === 'frequent-sequence')?.confidence ?? 0;

    for (let i = 0; i < 3; i++) {
      detector.record('a', {});
      detector.record('b', {});
    }
    detector.detectFrequentSequences();
    const secondConfidence =
      detector.getAllPatterns().find((p) => p.type === 'frequent-sequence')?.confidence ?? 0;

    expect(secondConfidence).toBeGreaterThanOrEqual(firstConfidence);
  });
});

describe('LearningEvolver', () => {
  let evolver: LearningEvolver;

  beforeEach(() => {
    evolver = new LearningEvolver();
  });

  it('should auto-apply when confidence meets threshold', async () => {
    const pattern: DetectedPattern = {
      id: 'p1',
      type: 'frequent-sequence',
      name: 'test pattern',
      description: 'A test pattern',
      confidence: 0.85,
      relatedEvents: ['e1'],
      detectedAt: new Date().toISOString(),
    };

    const fix = await evolver.autoApply(pattern);
    expect(fix.autoApplied).toBe(true);
    expect(fix.success).toBe(true);
    expect(fix.patternId).toBe('p1');
  });

  it('should not auto-apply when confidence is below threshold', async () => {
    const evolverLow = new LearningEvolver();
    evolverLow.setConfidenceThreshold(0.9);

    const pattern: DetectedPattern = {
      id: 'p2',
      type: 'anomaly',
      name: 'low confidence',
      description: 'Low confidence pattern',
      confidence: 0.5,
      relatedEvents: ['e1'],
      detectedAt: new Date().toISOString(),
    };

    const fix = await evolverLow.autoApply(pattern);
    expect(fix.autoApplied).toBe(false);
    expect(fix.success).toBe(false);
  });

  it('should retrieve all fixes', async () => {
    const p1: DetectedPattern = {
      id: 'p1',
      type: 'trend',
      name: 'trend 1',
      description: 'First trend',
      confidence: 0.8,
      relatedEvents: ['e1'],
      detectedAt: new Date().toISOString(),
    };
    const p2: DetectedPattern = {
      id: 'p2',
      type: 'anomaly',
      name: 'anomaly 1',
      description: 'First anomaly',
      confidence: 0.9,
      relatedEvents: ['e2'],
      detectedAt: new Date().toISOString(),
    };

    await evolver.autoApply(p1);
    await evolver.autoApply(p2);

    const fixes = evolver.getFixes();
    expect(fixes).toHaveLength(2);
    expect(fixes[0].patternId).toBe('p1');
    expect(fixes[1].patternId).toBe('p2');
  });
});
