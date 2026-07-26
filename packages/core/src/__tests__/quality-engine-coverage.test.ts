import type { QualityGate, QualityMetric } from '@behavioros/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue({ stdout: '', stderr: '', status: 0 }),
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

describe('QualityEngine', () => {
  let engine: QualityEngine;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      engine = new QualityEngine();
      expect(engine).toBeInstanceOf(QualityEngine);
    });

    it('should create with custom min score', () => {
      engine = new QualityEngine([], { minScore: 90 });
      expect(engine).toBeInstanceOf(QualityEngine);
    });

    it('should create with persist path', () => {
      engine = new QualityEngine([], { persistPath: '/tmp/quality.json' });
      expect(engine).toBeInstanceOf(QualityEngine);
    });

    it('should create with custom timeout', () => {
      engine = new QualityEngine([], { timeout: 30000 });
      expect(engine).toBeInstanceOf(QualityEngine);
    });
  });

  describe('evaluate', () => {
    it('should pass when metric meets threshold', () => {
      const gate = makeGate({ name: 'coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const metrics: QualityMetric[] = [{ name: 'coverage', value: 90 }];
      const report = engine.evaluate(metrics);
      expect(report.passed).toBe(true);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail when metric is below threshold', () => {
      const gate = makeGate({ name: 'coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const metrics: QualityMetric[] = [{ name: 'coverage', value: 50 }];
      const report = engine.evaluate(metrics);
      expect(report.passed).toBe(false);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should fail when metric is not found for gate', () => {
      const gate = makeGate({ name: 'missing-metric', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([]);
      expect(report.passed).toBe(false);
      expect(report.checks[0].message).toContain('Metric not found');
    });

    it('should evaluate boolean pass gate', () => {
      const gate: QualityGate = { id: 'bool-gate', name: 'lint', type: 'lint', pass: true };
      engine = new QualityEngine([gate]);
      const metrics: QualityMetric[] = [{ name: 'lint', value: 0, passed: true }];
      const report = engine.evaluate(metrics);
      expect(report.passed).toBe(true);
    });

    it('should evaluate boolean fail gate', () => {
      const gate: QualityGate = { id: 'bool-gate', name: 'lint', type: 'lint', pass: true };
      engine = new QualityEngine([gate]);
      const metrics: QualityMetric[] = [{ name: 'lint', value: 5, passed: false }];
      const report = engine.evaluate(metrics);
      expect(report.passed).toBe(false);
    });

    it('should auto-pass when no threshold configured', () => {
      const gate: QualityGate = { id: 'custom-gate', name: 'custom', type: 'custom' };
      engine = new QualityEngine([gate]);
      const metrics: QualityMetric[] = [{ name: 'custom', value: 42 }];
      const report = engine.evaluate(metrics);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should handle empty gate list', () => {
      engine = new QualityEngine([]);
      const report = engine.evaluate([]);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    });

    it('should calculate score as percentage of passed checks', () => {
      const gates = [
        makeGate({ name: 'a', threshold: 80 }),
        makeGate({ name: 'b', threshold: 80 }),
      ];
      engine = new QualityEngine(gates);
      const metrics: QualityMetric[] = [
        { name: 'a', value: 90 },
        { name: 'b', value: 50 },
      ];
      const report = engine.evaluate(metrics);
      expect(report.score).toBe(50);
      expect(report.passed).toBe(false);
    });

    it('should handle overall fail when score >= min but not all pass', () => {
      const gates = [
        makeGate({ name: 'a', threshold: 80 }),
        makeGate({ name: 'b', threshold: 80 }),
      ];
      engine = new QualityEngine(gates, { minScore: 40 });
      const metrics: QualityMetric[] = [
        { name: 'a', value: 90 },
        { name: 'b', value: 50 },
      ];
      const report = engine.evaluate(metrics);
      expect(report.passed).toBe(false);
    });
  });

  describe('createReport', () => {
    it('should create a report from check results', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'lint', passed: true, actual: 0, expected: 0, message: 'ok' },
      ];
      const report = engine.createReport(checks);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    });

    it('should handle empty results in createReport', () => {
      engine = new QualityEngine();
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    });

    it('should handle mixed pass/fail in createReport', () => {
      engine = new QualityEngine([], { minScore: 50 });
      const checks: QualityCheckResult[] = [
        { gate: 'a', passed: true, actual: 1, expected: 1, message: 'ok' },
        { gate: 'b', passed: false, actual: 0, expected: 1, message: 'fail' },
      ];
      const report = engine.createReport(checks);
      expect(report.score).toBe(50);
      expect(report.checks.length).toBe(2);
      expect(report.metrics.length).toBe(2);
    });
  });

  describe('gate management', () => {
    it('should add a gate', () => {
      engine = new QualityEngine();
      const gate = makeGate({ name: 'new-gate' });
      engine.addGate(gate);
      expect(engine.getGates()).toHaveLength(1);
    });

    it('should update existing gate on add', () => {
      const gate = makeGate({ name: 'coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      engine.addGate(makeGate({ name: 'coverage', threshold: 90 }));
      const gates = engine.getGates();
      expect(gates).toHaveLength(1);
      expect(gates[0].threshold).toBe(90);
    });

    it('should remove a gate by name', () => {
      const gate = makeGate({ name: 'to-remove' });
      engine = new QualityEngine([gate]);
      const removed = engine.removeGate('to-remove');
      expect(removed).toBe(true);
      expect(engine.getGates()).toHaveLength(0);
    });

    it('should return false when removing nonexistent gate', () => {
      engine = new QualityEngine();
      const removed = engine.removeGate('nonexistent');
      expect(removed).toBe(false);
    });

    it('should list all gates', () => {
      const gates = [makeGate({ name: 'a', id: '1' }), makeGate({ name: 'b', id: '2' })];
      engine = new QualityEngine(gates);
      expect(engine.getGates()).toHaveLength(2);
    });
  });

  describe('history', () => {
    it('should record evaluation history', () => {
      engine = new QualityEngine();
      const metrics: QualityMetric[] = [{ name: 'test', value: 80 }];
      engine.evaluate(metrics);
      expect(engine.getHistory()).toHaveLength(1);
    });

    it('should retrieve last report', () => {
      engine = new QualityEngine();
      engine.evaluate([]);
      expect(engine.getLastReport()).toBeDefined();
    });

    it('should return undefined when no reports', () => {
      engine = new QualityEngine();
      expect(engine.getLastReport()).toBeUndefined();
    });
  });

  describe('summary', () => {
    it('should generate summary string', () => {
      engine = new QualityEngine();
      const report = engine.evaluate([]);
      const s = engine.summary(report);
      expect(s).toContain('Quality Report');
      expect(s).toContain('Overall');
    });
  });

  describe('runAll (real command execution)', () => {
    it('should handle runAll with empty gates', async () => {
      engine = new QualityEngine();
      const report = await engine.runAll('/test/project');
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    });
  });

  describe('runGate', () => {
    it('should handle unknown gate as custom', async () => {
      engine = new QualityEngine([makeGate({ name: 'unknown-type', type: 'custom' })]);
      const result = await engine.runGate('unknown-type', '/test/project');
      expect(result.check.passed).toBe(true);
      expect(result.check.message).toContain('no execution config, auto-pass');
    });
  });
});
