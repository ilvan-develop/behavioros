import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceSource } from '../engines/knowledge/evidence-manager';
import { EvidenceManager } from '../engines/knowledge/evidence-manager';
import { TruthCalculator } from '../engines/knowledge/truth-calculator';

describe('EvidenceManager', () => {
  let manager: EvidenceManager;
  let source: EvidenceSource;

  beforeEach(() => {
    manager = new EvidenceManager();
    source = {
      id: 'src-1',
      name: 'Test Runner',
      reliability: 0.9,
      type: 'test-result',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register a source', () => {
    manager.registerSource(source);
    expect(manager.getSource('src-1')).toEqual(source);
  });

  it('should list registered sources', () => {
    manager.registerSource(source);
    manager.registerSource({
      id: 'src-2',
      name: 'Log Collector',
      reliability: 0.7,
      type: 'log',
    });
    expect(manager.listSources()).toHaveLength(2);
  });

  it('should return undefined for unknown source', () => {
    expect(manager.getSource('nonexistent')).toBeUndefined();
  });

  it('should add evidence and return an id', () => {
    manager.registerSource(source);
    const id = manager.addEvidence('claim-1', 'src-1', 'Test passed', 0.95);
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should get evidence for a claim', () => {
    manager.registerSource(source);
    const id = manager.addEvidence('claim-1', 'src-1', 'Test passed', 0.95);
    const items = manager.getEvidence('claim-1');
    expect(items).toHaveLength(1);
    expect(items[0].claimId).toBe('claim-1');
    expect(items[0].content).toBe('Test passed');
    expect(items[0].id).toBe(id);
  });

  it('should return empty array for claim with no evidence', () => {
    expect(manager.getEvidence('no-evidence')).toEqual([]);
  });

  it('should verify evidence', () => {
    manager.registerSource(source);
    const id = manager.addEvidence('claim-1', 'src-1', 'Test passed', 0.95);
    expect(manager.getEvidence('claim-1')[0].verified).toBe(false);
    manager.verify(id);
    expect(manager.getEvidence('claim-1')[0].verified).toBe(true);
    expect(manager.getEvidence('claim-1')[0].verifiedAt).toBeDefined();
  });

  it('should collect unverified evidence', () => {
    manager.registerSource(source);
    manager.addEvidence('claim-1', 'src-1', 'Evidence A', 0.9);
    const idB = manager.addEvidence('claim-2', 'src-1', 'Evidence B', 0.8);
    manager.verify(idB);
    const unverified = manager.getUnverifiedEvidence();
    expect(unverified).toHaveLength(1);
    expect(unverified[0].content).toBe('Evidence A');
  });

  it('should remove evidence', () => {
    manager.registerSource(source);
    const id = manager.addEvidence('claim-1', 'src-1', 'Test passed', 0.95);
    manager.removeEvidence(id);
    expect(manager.getEvidence('claim-1')).toHaveLength(0);
  });

  it('should use source reliability as default confidence', () => {
    manager.registerSource(source);
    manager.addEvidence('claim-1', 'src-1', 'Auto confidence');
    const items = manager.getEvidence('claim-1');
    expect(items[0].confidence).toBe(0.9);
  });

  it('should use 0.5 as default confidence when source not found', () => {
    manager.addEvidence('claim-1', 'unknown-source', 'No source');
    const items = manager.getEvidence('claim-1');
    expect(items[0].confidence).toBe(0.5);
  });

  it('should not affect other claims when removing evidence', () => {
    manager.registerSource(source);
    const idA = manager.addEvidence('claim-1', 'src-1', 'A', 0.9);
    manager.addEvidence('claim-2', 'src-1', 'B', 0.8);
    manager.removeEvidence(idA);
    expect(manager.getEvidence('claim-1')).toHaveLength(0);
    expect(manager.getEvidence('claim-2')).toHaveLength(1);
  });
});

describe('TruthCalculator', () => {
  let calculator: TruthCalculator;
  let manager: EvidenceManager;
  let sourceA: EvidenceSource;
  let sourceB: EvidenceSource;

  beforeEach(() => {
    calculator = new TruthCalculator(0.95);
    manager = new EvidenceManager();
    sourceA = { id: 'src-a', name: 'High Rel', reliability: 0.95, type: 'measurement' };
    sourceB = { id: 'src-b', name: 'Low Rel', reliability: 0.5, type: 'log' };
    manager.registerSource(sourceA);
    manager.registerSource(sourceB);
  });

  it('should compute score from single evidence', () => {
    manager.addEvidence('claim-1', 'src-a', 'Sensor reading', 0.98);
    const evidence = manager.getEvidence('claim-1');
    const result = calculator.compute('claim-1', evidence, [sourceA]);
    expect(result.score).toBeCloseTo(0.98, 2);
    expect(result.evidenceCount).toBe(1);
  });

  it('should compute weighted average with multiple evidence', () => {
    manager.addEvidence('claim-1', 'src-a', 'High confidence', 0.98);
    manager.addEvidence('claim-1', 'src-b', 'Low confidence', 0.4);
    const evidence = manager.getEvidence('claim-1');
    const result = calculator.compute('claim-1', evidence, [sourceA, sourceB]);
    const expected = (0.98 * 0.95 + 0.4 * 0.5) / (0.95 + 0.5);
    expect(result.score).toBeCloseTo(expected, 2);
    expect(result.evidenceCount).toBe(2);
  });

  it('should meet threshold when score >= 0.95', () => {
    manager.addEvidence('claim-1', 'src-a', 'Highly reliable', 0.99);
    const evidence = manager.getEvidence('claim-1');
    const result = calculator.compute('claim-1', evidence, [sourceA]);
    expect(result.score).toBeGreaterThanOrEqual(0.95);
    expect(result.meetsThreshold).toBe(true);
  });

  it('should not meet threshold when score < 0.95', () => {
    manager.addEvidence('claim-1', 'src-b', 'Unreliable', 0.3);
    const evidence = manager.getEvidence('claim-1');
    const result = calculator.compute('claim-1', evidence, [sourceB]);
    expect(result.score).toBeLessThan(0.95);
    expect(result.meetsThreshold).toBe(false);
  });

  it('should return score 0 when no evidence', () => {
    const result = calculator.compute('claim-1', [], []);
    expect(result.score).toBe(0);
    expect(result.evidenceCount).toBe(0);
    expect(result.meetsThreshold).toBe(false);
  });

  it('should apply time decay', () => {
    vi.useFakeTimers();
    const now = new Date('2026-07-01T00:00:00.000Z');
    vi.setSystemTime(now);

    manager.addEvidence('claim-1', 'src-a', 'Test', 1.0);
    const evidence = manager.getEvidence('claim-1');
    calculator.compute('claim-1', evidence, [sourceA]);

    vi.setSystemTime(new Date('2026-07-06T00:00:00.000Z'));
    calculator.setDecayRate(0.1);
    const decayed = calculator.compute('claim-1', evidence, [sourceA]);
    expect(decayed.score).toBeCloseTo(1.0 * 0.9 ** 5, 2);
    expect(decayed.score).toBeLessThan(1);
    vi.useRealTimers();
  });

  it('should get score for a claim', () => {
    manager.addEvidence('claim-1', 'src-a', 'Test', 0.95);
    const evidence = manager.getEvidence('claim-1');
    calculator.compute('claim-1', evidence, [sourceA]);
    const score = calculator.getScore('claim-1');
    expect(score).toBeDefined();
    expect(score!.claimId).toBe('claim-1');
  });

  it('should return undefined for unknown claim', () => {
    expect(calculator.getScore('unknown')).toBeUndefined();
  });

  it('should return all scores', () => {
    manager.addEvidence('claim-1', 'src-a', 'A', 0.9);
    manager.addEvidence('claim-2', 'src-a', 'B', 0.8);
    calculator.compute('claim-1', manager.getEvidence('claim-1'), [sourceA]);
    calculator.compute('claim-2', manager.getEvidence('claim-2'), [sourceA]);
    expect(calculator.getAllScores()).toHaveLength(2);
  });

  it('should recalculate meetsThreshold after setThreshold', () => {
    manager.addEvidence('claim-1', 'src-a', 'Test', 0.9);
    const evidence = manager.getEvidence('claim-1');
    calculator.setThreshold(0.85);
    const result = calculator.compute('claim-1', evidence, [sourceA]);
    expect(result.meetsThreshold).toBe(true);
  });

  it('should decay all scores', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));

    manager.addEvidence('claim-1', 'src-a', 'A', 0.95);
    calculator.compute('claim-1', manager.getEvidence('claim-1'), [sourceA]);

    vi.setSystemTime(new Date('2026-07-11T00:00:00.000Z'));
    calculator.setDecayRate(0.01);
    calculator.decayAll();

    const score = calculator.getScore('claim-1');
    const expected = 0.95 * 0.99 ** 10;
    expect(score!.score).toBeCloseTo(expected, 2);
    expect(score!.score).toBeLessThan(0.95);
    vi.useRealTimers();
  });

  it('should compute average source reliability', () => {
    manager.addEvidence('claim-1', 'src-a', 'A', 0.9);
    manager.addEvidence('claim-1', 'src-b', 'B', 0.8);
    const evidence = manager.getEvidence('claim-1');
    const result = calculator.compute('claim-1', evidence, [sourceA, sourceB]);
    expect(result.sourceReliability).toBeCloseTo((0.95 + 0.5) / 2, 2);
  });

  it('should clamp score between 0 and 1', () => {
    calculator.setDecayRate(2);
    calculator.compute('claim-1', [], []);
    expect(calculator.getScore('claim-1')!.score).toBe(0);
  });
});
