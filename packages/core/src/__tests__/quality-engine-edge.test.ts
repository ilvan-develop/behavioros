import type { QualityGate, QualityMetric } from '@behavioros/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecSync = vi.hoisted(() => vi.fn().mockImplementation(() => ''));
vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
}));

import type { QualityCheckResult } from '../engines/quality/quality-engine';
import { QualityEngine } from '../engines/quality/quality-engine';

function makeGate(overrides: Partial<QualityGate> = {}): QualityGate {
  return {
    id: 'test-gate',
    name: 'test_coverage',
    type: 'test_coverage',
    threshold: 80,
    ...overrides,
  };
}

describe('QualityEngine — edge cases', () => {
  let engine: QualityEngine;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluate — threshold boundary values', () => {
    it('should pass when threshold is 0 and metric is 0', () => {
      const gate = makeGate({ name: 'coverage', threshold: 0 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'coverage', value: 0 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should pass when metric equals threshold exactly', () => {
      const gate = makeGate({ name: 'coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'coverage', value: 80 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail when metric is just below threshold', () => {
      const gate = makeGate({ name: 'coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'coverage', value: 79.9 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should handle negative threshold gracefully', () => {
      const gate = makeGate({ name: 'coverage', threshold: -1 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'coverage', value: 0 }]);
      expect(report.checks[0].passed).toBe(true);
    });
  });

  describe('evaluate — multiple gates with mixed results', () => {
    it('should handle 3 gates: pass, fail, missing metric', () => {
      const gates: QualityGate[] = [
        makeGate({ name: 'lint', threshold: 0 }),
        makeGate({ name: 'coverage', threshold: 80 }),
        makeGate({ name: 'security', threshold: 0 }),
      ];
      engine = new QualityEngine(gates);
      const metrics: QualityMetric[] = [
        { name: 'lint', value: 0 },
        { name: 'coverage', value: 50 },
      ];
      const report = engine.evaluate(metrics);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[1].passed).toBe(false);
      expect(report.checks[2].passed).toBe(false);
      expect(report.checks[2].message).toContain('Metric not found');
    });
  });

  describe('evaluate — boolean gates', () => {
    it('should handle pass gate with boolean value', () => {
      const gate: QualityGate = { id: 'bool', name: 'lint', type: 'lint', pass: true };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 1, passed: true }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should handle fail gate with boolean value', () => {
      const gate: QualityGate = { id: 'bool', name: 'lint', type: 'lint', pass: true };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 0, passed: false }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should auto-pass when gate has no threshold and no pass', () => {
      const gate: QualityGate = { id: 'custom', name: 'custom', type: 'custom' };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'custom', value: 42 }]);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].message).toContain('auto-pass');
    });
  });

  describe('evaluate — score calculations', () => {
    it('should return score 100 for empty gate list', () => {
      engine = new QualityEngine([]);
      const report = engine.evaluate([]);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    });

    it('should return score 0 when no checks pass', () => {
      const gates: QualityGate[] = [
        makeGate({ name: 'a', threshold: 80 }),
        makeGate({ name: 'b', threshold: 80 }),
      ];
      engine = new QualityEngine(gates, { minScore: 0 });
      const report = engine.evaluate([
        { name: 'a', value: 10 },
        { name: 'b', value: 20 },
      ]);
      expect(report.score).toBe(0);
      expect(report.passed).toBe(false);
    });
  });

  describe('createReport — edge cases', () => {
    it('should create report with empty checks', () => {
      engine = new QualityEngine();
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
      expect(report.checks).toEqual([]);
    });

    it('should create metrics from check results', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'a', passed: true, actual: 10, expected: 10, message: 'ok' },
        { gate: 'b', passed: false, actual: 5, expected: 10, message: 'fail' },
      ];
      const report = engine.createReport(checks);
      expect(report.metrics).toHaveLength(2);
      expect(report.metrics[0]).toMatchObject({ name: 'a', value: 10, passed: true });
      expect(report.metrics[1]).toMatchObject({ name: 'b', value: 5, passed: false });
    });
  });

  describe('gate management — edge cases', () => {
    it('should update existing gate with addGate', () => {
      const gate = makeGate({ name: 'dup', threshold: 50 });
      engine = new QualityEngine([gate]);
      engine.addGate(makeGate({ name: 'dup', threshold: 90 }));
      expect(engine.getGates()).toHaveLength(1);
      expect(engine.getGates()[0].threshold).toBe(90);
    });

    it('should return false when removing non-existent gate', () => {
      engine = new QualityEngine();
      expect(engine.removeGate('nope')).toBe(false);
    });

    it('should return copy of gates list', () => {
      const gate = makeGate({ name: 'g1' });
      engine = new QualityEngine([gate]);
      const gates = engine.getGates();
      gates.push({} as QualityGate);
      expect(engine.getGates()).toHaveLength(1);
    });
  });

  describe('history — edge cases', () => {
    it('should accumulate history across evaluate calls', () => {
      engine = new QualityEngine();
      engine.evaluate([{ name: 'a', value: 80 }]);
      engine.evaluate([{ name: 'a', value: 90 }]);
      engine.evaluate([{ name: 'a', value: 70 }]);
      expect(engine.getHistory()).toHaveLength(3);
    });

    it('should return copy of history', () => {
      engine = new QualityEngine();
      engine.evaluate([]);
      const history = engine.getHistory();
      history.push({} as any);
      expect(engine.getHistory()).toHaveLength(1);
    });

    it('should return last report from multiple evaluations', () => {
      engine = new QualityEngine();
      engine.evaluate([{ name: 'a', value: 50 }]);
      const last = engine.evaluate([{ name: 'a', value: 90 }]);
      expect(engine.getLastReport()?.id).toBe(last.id);
    });
  });

  describe('summary — edge cases', () => {
    it('should format failed report in summary', () => {
      engine = new QualityEngine();
      const gates = [makeGate({ name: 'g1', threshold: 80 })];
      engine = new QualityEngine(gates);
      const report = engine.evaluate([{ name: 'g1', value: 30 }]);
      const s = engine.summary(report);
      expect(s).toContain('FAILED');
      expect(s).toContain('g1');
    });

    it('should include all check messages in summary', () => {
      engine = new QualityEngine();
      const gates = [
        makeGate({ name: 'g1', threshold: 80 }),
        makeGate({ name: 'g2', threshold: 90 }),
      ];
      engine = new QualityEngine(gates);
      const report = engine.evaluate([
        { name: 'g1', value: 90 },
        { name: 'g2', value: 95 },
      ]);
      const s = engine.summary(report);
      expect(s).toContain('PASSED');
      expect(s).toContain('g1');
      expect(s).toContain('g2');
    });
  });

  describe('runGate — custom gate with command config', () => {
    it('should execute custom gate with command config and pass', async () => {
      const gate: QualityGate = {
        id: 'custom-cmd',
        name: 'custom-check',
        type: 'custom',
        config: { command: 'echo ok' },
      };
      engine = new QualityEngine([gate]);
      const result = await engine.runGate('custom-check', '/test/project');
      expect(result.check.passed).toBe(true);
      expect(result.check.message).toContain('passed');
    });

    it('should auto-pass unknown gate without config', async () => {
      engine = new QualityEngine([makeGate({ name: 'mystery', type: 'custom' })]);
      const result = await engine.runGate('mystery', '/test/project');
      expect(result.check.passed).toBe(true);
      expect(result.check.message).toContain('auto-pass');
    });
  });
});
