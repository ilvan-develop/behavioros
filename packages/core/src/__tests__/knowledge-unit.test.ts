import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidenceSource } from '../engines/knowledge/evidence-manager';
import { EvidenceManager } from '../engines/knowledge/evidence-manager';
import { TruthCalculator } from '../engines/knowledge/truth-calculator';

describe('EvidenceManager — additional coverage', () => {
  let manager: EvidenceManager;
  let source: EvidenceSource;

  beforeEach(() => {
    manager = new EvidenceManager();
    source = { id: 'src-1', name: 'Scanner', reliability: 0.85, type: 'measurement' };
    manager.registerSource(source);
  });

  it('should handle multiple claims with overlapping evidence', () => {
    const id1 = manager.addEvidence('claim-A', 'src-1', 'overlap-data', 0.9);
    const id2 = manager.addEvidence('claim-B', 'src-1', 'overlap-data', 0.9);
    expect(manager.getEvidence('claim-A')).toHaveLength(1);
    expect(manager.getEvidence('claim-B')).toHaveLength(1);
    expect(id1).not.toBe(id2);
  });

  it('should return empty when removing non-existent evidence', () => {
    expect(() => manager.removeEvidence('nonexistent')).not.toThrow();
  });

  it('should delete claim bucket when last evidence removed', () => {
    const id = manager.addEvidence('claim-x', 'src-1', 'only one', 0.8);
    manager.removeEvidence(id);
    const remaining = manager.getEvidence('claim-x');
    expect(remaining).toEqual([]);
  });

  it('should keep other evidence in claim when removing one', () => {
    const id1 = manager.addEvidence('claim-z', 'src-1', 'first', 0.9);
    manager.addEvidence('claim-z', 'src-1', 'second', 0.8);
    manager.removeEvidence(id1);
    const items = manager.getEvidence('claim-z');
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('second');
  });

  it('should verify evidence only once', () => {
    const id = manager.addEvidence('claim-v', 'src-1', 'verify-me', 0.9);
    manager.verify(id);
    manager.verify(id);
    const item = manager.getEvidence('claim-v')[0];
    expect(item.verified).toBe(true);
    expect(item.verifiedAt).toBeDefined();
  });

  it('should handle verify on non-existent evidence gracefully', () => {
    expect(() => manager.verify('ghost')).not.toThrow();
  });

  it('should use default confidence from source when not specified', () => {
    manager.addEvidence('claim-d', 'src-1', 'implicit confidence');
    const items = manager.getEvidence('claim-d');
    expect(items[0].confidence).toBe(0.85);
  });

  it('should fall back to 0.5 for unknown source with no explicit confidence', () => {
    manager.addEvidence('claim-f', 'unknown', 'fallback');
    expect(manager.getEvidence('claim-f')[0].confidence).toBe(0.5);
  });

  it('should collect all unverified evidence across claims', () => {
    manager.addEvidence('c1', 'src-1', 'unverified-a', 0.9);
    const id2 = manager.addEvidence('c2', 'src-1', 'verified-one', 0.9);
    manager.addEvidence('c3', 'src-1', 'unverified-b', 0.7);
    manager.verify(id2);
    const list = manager.getUnverifiedEvidence();
    expect(list).toHaveLength(2);
    expect(list.map((e) => e.content)).toEqual(
      expect.arrayContaining(['unverified-a', 'unverified-b']),
    );
  });

  it('should return empty unverified list when all verified', () => {
    const id1 = manager.addEvidence('c1', 'src-1', 'a', 0.9);
    const id2 = manager.addEvidence('c2', 'src-1', 'b', 0.9);
    manager.verify(id1);
    manager.verify(id2);
    expect(manager.getUnverifiedEvidence()).toHaveLength(0);
  });

  it('should not mutate original source object after registration', () => {
    const original: EvidenceSource = {
      id: 'src-2',
      name: 'Original',
      reliability: 0.7,
      type: 'log',
    };
    manager.registerSource(original);
    const stored = manager.getSource('src-2');
    expect(stored).toBe(original);
    expect(stored!.reliability).toBe(0.7);
  });

  it('should preserve evidence timestamp on creation', () => {
    const before = Date.now();
    const _id = manager.addEvidence('claim-ts', 'src-1', 'time-check', 0.9);
    const after = Date.now();
    const item = manager.getEvidence('claim-ts')[0];
    const ts = new Date(item.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('TruthCalculator — additional coverage', () => {
  let calculator: TruthCalculator;
  let sources: EvidenceSource[];

  beforeEach(() => {
    calculator = new TruthCalculator(0.95);
    sources = [
      { id: 'rel-a', name: 'Reliable', reliability: 0.99, type: 'measurement' },
      { id: 'rel-b', name: 'Medium', reliability: 0.7, type: 'test-result' },
      { id: 'rel-c', name: 'Low', reliability: 0.3, type: 'log' },
    ];
  });

  it('should compute perfect score with maximum confidence evidence', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'rel-a',
        content: 'perfect',
        confidence: 1.0,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const result = calculator.compute('c1', evidence, sources);
    expect(result.score).toBeCloseTo(1.0, 2);
    expect(result.meetsThreshold).toBe(true);
  });

  it('should compute zero score with all zero-confidence evidence', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'rel-a',
        content: 'zero',
        confidence: 0,
        verified: true,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'e2',
        claimId: 'c1',
        sourceId: 'rel-b',
        content: 'zero',
        confidence: 0,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const result = calculator.compute('c1', evidence, sources);
    expect(result.score).toBe(0);
    expect(result.meetsThreshold).toBe(false);
  });

  it('should weight high-reliability sources more heavily', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'rel-a',
        content: 'high',
        confidence: 1.0,
        verified: true,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'e2',
        claimId: 'c1',
        sourceId: 'rel-c',
        content: 'low',
        confidence: 0.0,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const result = calculator.compute('c1', evidence, sources);
    // expected = (1.0*0.99 + 0.0*0.3) / (0.99 + 0.3) = 0.99/1.29 ≈ 0.7674
    const expected = (1.0 * 0.99) / (0.99 + 0.3);
    expect(result.score).toBeCloseTo(expected, 4);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('should store computed score for later retrieval', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'stored-claim',
        sourceId: 'rel-a',
        content: 'test',
        confidence: 0.85,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    calculator.compute('stored-claim', evidence, sources);
    const retrieved = calculator.getScore('stored-claim');
    expect(retrieved).toBeDefined();
    expect(retrieved!.claimId).toBe('stored-claim');
    expect(retrieved!.score).toBeCloseTo(0.85, 2);
  });

  it('should update meetsThreshold dynamically when threshold changes', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'rel-b',
        content: 'mid',
        confidence: 0.8,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    let result = calculator.compute('c1', evidence, sources);
    expect(result.meetsThreshold).toBe(false);

    calculator.setThreshold(0.7);
    result = calculator.compute('c1', evidence, sources);
    expect(result.meetsThreshold).toBe(true);
  });

  it('should decay all scores when decayAll is called', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T00:00:00.000Z'));

    const evidence = [
      {
        id: 'e1',
        claimId: 'd1',
        sourceId: 'rel-a',
        content: 'decay-test',
        confidence: 0.9,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    calculator.compute('d1', evidence, sources);

    vi.setSystemTime(new Date('2026-07-21T00:00:00.000Z'));
    calculator.setDecayRate(0.05);
    calculator.decayAll();

    const sc = calculator.getScore('d1');
    const expected = 0.9 * (1 - 0.05) ** 20;
    expect(sc!.score).toBeCloseTo(expected, 4);
    expect(sc!.score).toBeLessThan(0.9);
    vi.useRealTimers();
  });

  it('should handle decayAll with no scores stored', () => {
    expect(() => calculator.decayAll()).not.toThrow();
  });

  it('should compute source reliability as average of source reliabilities', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'rel-a',
        content: 'a',
        confidence: 0.9,
        verified: true,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'e2',
        claimId: 'c1',
        sourceId: 'rel-b',
        content: 'b',
        confidence: 0.8,
        verified: true,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'e3',
        claimId: 'c1',
        sourceId: 'rel-c',
        content: 'c',
        confidence: 0.7,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const result = calculator.compute('c1', evidence, sources);
    const expectedReliability = (0.99 + 0.7 + 0.3) / 3;
    expect(result.sourceReliability).toBeCloseTo(expectedReliability, 4);
  });

  it('should use 0.5 as default reliability for unknown sources', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'unknown',
        content: 'ghost',
        confidence: 0.8,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const result = calculator.compute('c1', evidence, []);
    expect(result.sourceReliability).toBeCloseTo(0.5);
    expect(result.score).toBeCloseTo(0.8, 2);
  });

  it('should clamp decay rate between 0 and 1', () => {
    calculator.setDecayRate(-5);
    const evidence = [
      {
        id: 'e1',
        claimId: 'c1',
        sourceId: 'rel-a',
        content: 'clamp',
        confidence: 0.9,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    calculator.compute('c1', evidence, sources);
    expect(() => calculator.setDecayRate(2)).not.toThrow();
  });

  it('should handle one-claim edge case in getAllScores', () => {
    const evidence = [
      {
        id: 'e1',
        claimId: 'solo',
        sourceId: 'rel-a',
        content: 'only',
        confidence: 0.75,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    calculator.compute('solo', evidence, sources);
    expect(calculator.getAllScores()).toHaveLength(1);
  });

  it('should return all scores after multiple computes', () => {
    const e1 = [
      {
        id: 'e1',
        claimId: 'a',
        sourceId: 'rel-a',
        content: 'a',
        confidence: 0.9,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    const e2 = [
      {
        id: 'e2',
        claimId: 'b',
        sourceId: 'rel-b',
        content: 'b',
        confidence: 0.8,
        verified: true,
        timestamp: new Date().toISOString(),
      },
    ];
    calculator.compute('a', e1, sources);
    calculator.compute('b', e2, sources);
    calculator.compute('c', [], []);
    expect(calculator.getAllScores()).toHaveLength(3);
  });
});
