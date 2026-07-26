import { describe, expect, it, vi } from 'vitest';
import { CoverageEngine } from '../engines/coverage-engine';
import { DecisionEngine } from '../engines/decision/decision-engine';
import { SelfHealingEngine } from '../engines/quality/self-healing-engine';
import { ContextRecoveryEngine } from '../engines/recovery/context-recovery-engine';

// ============================================================
// 1. CoverageEngine — Boundary Conditions
// ============================================================

describe('CoverageEngine — edge cases', () => {
  it('handles NaN threshold gracefully', () => {
    const engine = new CoverageEngine({ threshold: NaN });
    expect(engine).toBeDefined();
  });

  it('handles Infinity threshold gracefully', () => {
    const engine = new CoverageEngine({ threshold: Infinity });
    expect(engine).toBeDefined();
  });

  it('handles negative threshold', () => {
    const engine = new CoverageEngine({ threshold: -50 });
    expect(engine).toBeDefined();
  });

  it('handles zero threshold', () => {
    const engine = new CoverageEngine({ threshold: 0 });
    const report = {
      dimensions: [{ name: 'test', found: 0, expected: 10, percentage: 0, missing: ['a', 'b'] }],
      totalFound: 0,
      totalExpected: 10,
      overallPercentage: 0,
      passed: false,
      timestamp: new Date().toISOString(),
    };
    const result = engine.checkThreshold(report);
    expect(result.passed).toBe(true);
  });

  it('checkThreshold returns missing items for sub-threshold dimensions', () => {
    const engine = new CoverageEngine({ threshold: 90 });
    const report = {
      dimensions: [
        {
          name: 'docs',
          found: 1,
          expected: 10,
          percentage: 10,
          missing: ['doc1', 'doc2', 'doc3'],
        },
      ],
      totalFound: 1,
      totalExpected: 10,
      overallPercentage: 10,
      passed: false,
      timestamp: new Date().toISOString(),
    };
    const result = engine.checkThreshold(report);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing[0]).toContain('docs');
  });

  it('getRecommendations returns empty array for perfect coverage', () => {
    const engine = new CoverageEngine({ threshold: 90 });
    const report = {
      dimensions: [{ name: 'test', found: 5, expected: 5, percentage: 100, missing: [] }],
      totalFound: 5,
      totalExpected: 5,
      overallPercentage: 100,
      passed: true,
      timestamp: new Date().toISOString(),
    };
    const recs = engine.getRecommendations(report);
    expect(recs).toEqual([]);
  });

  it('getRecommendations adds threshold message when below threshold', () => {
    const engine = new CoverageEngine({ threshold: 90 });
    const report = {
      dimensions: [{ name: 'test', found: 1, expected: 10, percentage: 10, missing: ['item'] }],
      totalFound: 1,
      totalExpected: 10,
      overallPercentage: 10,
      passed: false,
      timestamp: new Date().toISOString(),
    };
    const recs = engine.getRecommendations(report);
    expect(recs[0]).toContain('below threshold');
  });

  it('calculate on non-existent directory does not throw', async () => {
    const engine = new CoverageEngine();
    const report = await engine.calculate('/non-existent-path-12345');
    expect(report).toHaveProperty('dimensions');
    expect(report).toHaveProperty('overallPercentage');
    expect(typeof report.overallPercentage).toBe('number');
  });
});

// ============================================================
// 2. DecisionEngine — Edge Cases
// ============================================================

describe('DecisionEngine — edge cases', () => {
  it('handles empty participants list', () => {
    const engine = new DecisionEngine();
    const result = engine.vote(
      {
        id: 'test-1',
        title: 'Empty participants',
        type: 'design',
        participants: [],
        options: [{ id: 'opt-a', title: 'Option A', pros: [], cons: [], risk: 'low' as const }],
      },
      [],
    );
    expect(result).toHaveProperty('decisionId', 'test-1');
    expect(result.winningOption).toBeNull();
  });

  it('handles empty options list', () => {
    const engine = new DecisionEngine();
    const context = {
      id: 'no-options',
      title: 'No options',
      type: 'design' as const,
      participants: [{ id: 'p1', role: 'eng', authority: 5, weight: 1 }],
      options: [],
    };
    const result = engine.vote(context, []);
    expect(result.winningOption).toBeNull();
    expect(result.consensus).toBe(false);
  });

  it('handles no participants with empty arrays', () => {
    const engine = new DecisionEngine();
    const result = engine.vote(
      { id: 'no-p', title: 'none', type: 'design' as const, participants: [], options: [] },
      [],
    );
    expect(result).toBeDefined();
  });

  it('handles tie votes', () => {
    const engine = new DecisionEngine();
    const context = {
      id: 'test-tie',
      title: 'Tie vote',
      type: 'design' as const,
      participants: [
        { id: 'p1', role: 'eng', authority: 5, weight: 1 },
        { id: 'p2', role: 'arch', authority: 8, weight: 1 },
      ],
      options: [
        { id: 'opt-a', title: 'Option A', pros: [], cons: [], risk: 'low' as const },
        { id: 'opt-b', title: 'Option B', pros: [], cons: [], risk: 'low' as const },
      ],
    };
    const result = engine.vote(context, [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.8 },
      { participantId: 'p2', optionId: 'opt-b', confidence: 0.9 },
    ]);
    expect(result.winningOption).toBeDefined();
    expect(result.consensus).toBe(false);
  });

  it('handles votes with zero confidence', () => {
    const engine = new DecisionEngine();
    const context = {
      id: 'test-zero',
      title: 'Zero confidence',
      type: 'design' as const,
      participants: [{ id: 'p1', role: 'eng', authority: 5, weight: 1 }],
      options: [{ id: 'opt-a', title: 'Option A', pros: [], cons: [], risk: 'low' as const }],
    };
    const result = engine.vote(context, [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0 },
    ]);
    expect(result.winningOption).toBe('opt-a');
  });
});

// ============================================================
// 3. SelfHealingEngine — Edge Cases
// ============================================================

describe('SelfHealingEngine — edge cases', () => {
  it('returns null when disabled', async () => {
    const engine = new SelfHealingEngine({ enabled: false });
    const result = await engine.monitor({ gate: 'test', passed: false, error: 'fail' });
    expect(result).toBeNull();
  });

  it('returns null when gate passes', async () => {
    const engine = new SelfHealingEngine({ enabled: true });
    const result = await engine.monitor({ gate: 'test', passed: true });
    expect(result).toBeNull();
  });

  it('alerts after max retries exceeded', async () => {
    const engine = new SelfHealingEngine({ enabled: true, maxRetries: 1 });
    engine.registerFixPattern('flaky', async () => false);

    await engine.monitor({ gate: 'flaky', passed: false, error: 'err' });
    const result = await engine.monitor({ gate: 'flaky', passed: false, error: 'err' });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('alert');
    expect(result!.description).toContain('Max retries');
  });

  it('handles fix pattern that throws', async () => {
    const engine = new SelfHealingEngine({ enabled: true });
    engine.registerFixPattern('broken', async () => {
      throw new Error('unexpected');
    });

    const result = await engine.monitor({ gate: 'broken', passed: false, error: 'err' });
    expect(result).not.toBeNull();
    expect(result!.success).toBe(false);
  });

  it('rollback returns false for empty checkpoint', async () => {
    const engine = new SelfHealingEngine();
    const result = await engine.rollback('');
    expect(result).toBe(false);
  });

  it('getStats returns zeros initially', async () => {
    const engine = new SelfHealingEngine();
    const stats = await engine.getStats();
    expect(stats.totalAttempts).toBe(0);
    expect(stats.successful).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.byType).toEqual({});
  });

  it('registers and uses fix patterns', async () => {
    const engine = new SelfHealingEngine({ enabled: true });
    const handler = vi.fn().mockResolvedValue(true);
    engine.registerFixPattern('custom', handler);

    await engine.monitor({ gate: 'custom', passed: false, error: 'fixme' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// 4. ContextRecoveryEngine — Edge Cases
// ============================================================

describe('ContextRecoveryEngine — edge cases', () => {
  it('getLatestCheckpoint returns null when no checkpoints exist', async () => {
    const engine = new ContextRecoveryEngine({ basePath: '/tmp/non-existent-bos' });
    const latest = await engine.getLatestCheckpoint();
    expect(latest).toBeNull();
  });

  it('detectContextLoss returns no loss when no checkpoint exists', async () => {
    const engine = new ContextRecoveryEngine({ basePath: '/tmp/non-existent-bos' });
    const result = await engine.detectContextLoss(90, undefined);
    expect(result.lost).toBe(false);
    expect(result.severity).toBe('none');
  });

  it('rebuildContext returns failure when no checkpoint exists', async () => {
    const engine = new ContextRecoveryEngine({ basePath: '/tmp/non-existent-bos' });
    const result = await engine.rebuildContext();
    expect(result.success).toBe(false);
    expect(result.restoredFrom).toBe('none');
    expect(result.actions).toContain('No checkpoint found to rebuild from');
  });

  it('validateRecovery reports issues for failed recovery', async () => {
    const engine = new ContextRecoveryEngine();
    const result = await engine.validateRecovery({
      success: false,
      restoredFrom: 'none',
      checkpoints: [],
      actions: [],
      coverageAfter: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('validateRecovery returns valid for successful recovery', async () => {
    const engine = new ContextRecoveryEngine();
    const result = await engine.validateRecovery({
      success: true,
      restoredFrom: 'cp-001',
      checkpoints: [
        {
          id: 'cp-001',
          timestamp: new Date().toISOString(),
          phase: 'test',
          coverage: 90,
          contextHash: 'abc',
          state: { key: 'val' },
        },
      ],
      actions: ['Restored from checkpoint cp-001'],
      coverageAfter: 90,
    });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('handles very large maxCheckpoints', () => {
    const engine = new ContextRecoveryEngine({ maxCheckpoints: 999999 });
    expect(engine).toBeDefined();
  });

  it('handles zero maxCheckpoints', () => {
    const engine = new ContextRecoveryEngine({ maxCheckpoints: 0 });
    expect(engine).toBeDefined();
  });
});
