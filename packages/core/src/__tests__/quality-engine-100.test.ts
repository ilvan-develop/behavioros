import type { QualityGate } from '@behavioros/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecSync = vi.hoisted(() => vi.fn().mockReturnValue(''));

vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));

const mockExistsSync = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockReadFileSync = vi.hoisted(() => vi.fn().mockReturnValue('{}'));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
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

describe('QualityEngine — 100% target coverage', () => {
  let engine: QualityEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockExecSync.mockReturnValue('');
  });

  // =========================================================
  // 1a. checkQuality() — coverage acima/abaixo/igual threshold
  // =========================================================
  describe('checkQuality — coverage threshold (evaluate)', () => {
    it('should pass when coverage above threshold', () => {
      const gate = makeGate({ name: 'test_coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'test_coverage', value: 95 }]);
      expect(report.passed).toBe(true);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].message).toContain('95 >= 80');
    });

    it('should pass when coverage equals threshold', () => {
      const gate = makeGate({ name: 'test_coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'test_coverage', value: 80 }]);
      expect(report.passed).toBe(true);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].actual).toBe(80);
      expect(report.checks[0].expected).toBe(80);
    });

    it('should fail when coverage below threshold', () => {
      const gate = makeGate({ name: 'test_coverage', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'test_coverage', value: 45 }]);
      expect(report.passed).toBe(false);
      expect(report.checks[0].passed).toBe(false);
      expect(report.checks[0].message).toContain('45 < 80');
    });

    it('should fail when coverage is 0 and threshold > 0', () => {
      const gate = makeGate({ name: 'test_coverage', threshold: 1 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'test_coverage', value: 0 }]);
      expect(report.passed).toBe(false);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should pass when coverage exactly 0 and threshold 0', () => {
      const gate = makeGate({ name: 'test_coverage', threshold: 0 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'test_coverage', value: 0 }]);
      expect(report.passed).toBe(true);
      expect(report.checks[0].passed).toBe(true);
    });
  });

  // =========================================================
  // 1b. checkQuality() — lint pass/fail com diferentes contagens
  // =========================================================
  describe('checkQuality — lint (evaluate)', () => {
    it('should pass lint with 0 errors', () => {
      const gate: QualityGate = { id: 'lint-gate', name: 'lint', type: 'lint', threshold: 0 };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 0 }]);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].actual).toBe(0);
    });

    it('should pass lint with value > 0 when threshold=0 (>= semantics)', () => {
      const gate: QualityGate = { id: 'lint-gate', name: 'lint', type: 'lint', threshold: 0 };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 42 }]);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].actual).toBe(42);
    });

    it('should fail lint when threshold=0 and value negative', () => {
      const gate: QualityGate = { id: 'lint-gate', name: 'lint', type: 'lint', threshold: 0 };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: -1 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should pass lint with boolean pass gate (passed=true)', () => {
      const gate: QualityGate = { id: 'lint-gate', name: 'lint', type: 'lint', pass: true };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 0, passed: true }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail lint with boolean pass gate (passed=false)', () => {
      const gate: QualityGate = { id: 'lint-gate', name: 'lint', type: 'lint', pass: true };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 5, passed: false }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should pass lint with pass=false and metric.passed=false', () => {
      const gate: QualityGate = { id: 'lint-gate', name: 'lint', type: 'lint', pass: false };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'lint', value: 5, passed: false }]);
      expect(report.checks[0].passed).toBe(true);
    });
  });

  // =========================================================
  // 1c. checkQuality() — typecheck pass/fail
  // =========================================================
  describe('checkQuality — typecheck (evaluate)', () => {
    it('should pass typecheck with 0 errors', () => {
      const gate: QualityGate = {
        id: 'tc-gate',
        name: 'typecheck',
        type: 'typecheck',
        threshold: 0,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'typecheck', value: 0 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail typecheck with value < threshold', () => {
      const gate: QualityGate = {
        id: 'tc-gate',
        name: 'typecheck',
        type: 'typecheck',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'typecheck', value: 50 }]);
      expect(report.checks[0].passed).toBe(false);
      expect(report.checks[0].actual).toBe(50);
    });

    it('should pass typecheck with value >= threshold', () => {
      const gate: QualityGate = {
        id: 'tc-gate',
        name: 'typecheck',
        type: 'typecheck',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'typecheck', value: 99 }]);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].actual).toBe(99);
    });
  });

  // =========================================================
  // 1d. checkQuality() — security scan severities
  // =========================================================
  describe('checkQuality — security (evaluate)', () => {
    it('should pass security with 0 vulnerabilities', () => {
      const gate: QualityGate = {
        id: 'sec-gate',
        name: 'security',
        type: 'security',
        threshold: 0,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'security', value: 0 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should pass security with positive value (>= threshold semantics)', () => {
      const gate: QualityGate = {
        id: 'sec-gate',
        name: 'security',
        type: 'security',
        threshold: 0,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'security', value: 5 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail security with value < threshold', () => {
      const gate: QualityGate = {
        id: 'sec-gate',
        name: 'security',
        type: 'security',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'security', value: 30 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should handle security with negative threshold (always pass)', () => {
      const gate: QualityGate = {
        id: 'sec-gate',
        name: 'security',
        type: 'security',
        threshold: -1,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'security', value: 10 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should reject security via pass boolean (passed=false)', () => {
      const gate: QualityGate = { id: 'sec-gate', name: 'security', type: 'security', pass: true };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'security', value: 5, passed: false }]);
      expect(report.checks[0].passed).toBe(false);
    });
  });

  // =========================================================
  // 1e. checkQuality() — performance acima/abaixo/igual
  // =========================================================
  describe('checkQuality — performance (evaluate)', () => {
    it('should pass performance when score >= 80', () => {
      const gate: QualityGate = {
        id: 'perf-gate',
        name: 'performance',
        type: 'performance',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'performance', value: 95 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should pass when performance equals threshold exactly', () => {
      const gate: QualityGate = {
        id: 'perf-gate',
        name: 'performance',
        type: 'performance',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'performance', value: 80 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail performance when score < threshold', () => {
      const gate: QualityGate = {
        id: 'perf-gate',
        name: 'performance',
        type: 'performance',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'performance', value: 55 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should fail performance at 0', () => {
      const gate: QualityGate = {
        id: 'perf-gate',
        name: 'performance',
        type: 'performance',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'performance', value: 0 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should handle max performance score of 100', () => {
      const gate: QualityGate = {
        id: 'perf-gate',
        name: 'performance',
        type: 'performance',
        threshold: 80,
      };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'performance', value: 100 }]);
      expect(report.checks[0].passed).toBe(true);
    });
  });

  // =========================================================
  // 2. composeResults() — 1 gate, múltiplos gates, 0 gates
  // =========================================================
  describe('composeResults — createReport (0, 1, multiple gates)', () => {
    it('should compose empty report with 0 gates', () => {
      engine = new QualityEngine();
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
      expect(report.checks).toHaveLength(0);
    });

    it('should compose report with 1 passing gate', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'lint', passed: true, actual: 0, expected: 0, message: 'Lint: no errors' },
      ];
      const report = engine.createReport(checks);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
      expect(report.checks).toHaveLength(1);
    });

    it('should compose report with 1 failing gate', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'lint', passed: false, actual: 5, expected: 0, message: 'Lint: 5 errors' },
      ];
      const report = engine.createReport(checks);
      expect(report.passed).toBe(false);
      expect(report.score).toBe(0);
    });

    it('should compose report with 3 gates (2 pass, 1 fail)', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'lint', passed: true, actual: 0, expected: 0, message: 'ok' },
        { gate: 'coverage', passed: true, actual: 90, expected: 80, message: 'ok' },
        { gate: 'security', passed: false, actual: 2, expected: 0, message: 'fail' },
      ];
      const report = engine.createReport(checks);
      expect(report.passed).toBe(false);
      expect(report.score).toBe(67);
    });

    it('should compose report with 5 gates (all pass)', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'lint', passed: true, actual: 0, expected: 0, message: 'ok' },
        { gate: 'typecheck', passed: true, actual: 0, expected: 0, message: 'ok' },
        { gate: 'coverage', passed: true, actual: 90, expected: 80, message: 'ok' },
        { gate: 'security', passed: true, actual: 0, expected: 0, message: 'ok' },
        { gate: 'performance', passed: true, actual: 100, expected: 80, message: 'ok' },
      ];
      const report = engine.createReport(checks);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    });
  });

  // =========================================================
  // 3. composeResults() — misto de pass/fail/warn
  // =========================================================
  describe('composeResults — mixed pass/fail/warn (createReport)', () => {
    it('should handle all checks failing', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'a', passed: false, actual: 0, expected: 1, message: 'fail' },
        { gate: 'b', passed: false, actual: 0, expected: 1, message: 'fail' },
      ];
      const report = engine.createReport(checks);
      expect(report.passed).toBe(false);
      expect(report.score).toBe(0);
    });

    it('should handle half pass half fail', () => {
      engine = new QualityEngine([], { minScore: 30 });
      const checks: QualityCheckResult[] = [
        { gate: 'a', passed: true, actual: 1, expected: 1, message: 'pass' },
        { gate: 'b', passed: false, actual: 0, expected: 1, message: 'fail' },
        { gate: 'c', passed: true, actual: 1, expected: 1, message: 'pass' },
        { gate: 'd', passed: false, actual: 0, expected: 1, message: 'fail' },
      ];
      const report = engine.createReport(checks);
      expect(report.score).toBe(50);
      expect(report.passed).toBe(false);
      expect(report.checks).toHaveLength(4);
    });

    it('should handle metric with boolean values (1/0)', () => {
      engine = new QualityEngine();
      const checks: QualityCheckResult[] = [
        { gate: 'gate-a', passed: true, actual: true, expected: true, message: 'pass' },
        { gate: 'gate-b', passed: true, actual: 1, expected: 1, message: 'pass' },
        { gate: 'gate-c', passed: false, actual: false, expected: true, message: 'fail' },
      ];
      const report = engine.createReport(checks);
      expect(report.metrics).toHaveLength(3);
      expect(report.metrics[0].value).toBe(1);
      expect(report.metrics[1].value).toBe(1);
      expect(report.metrics[2].value).toBe(0);
    });

    it('should fail overall when score >= minScore but not all checks pass', () => {
      const gates = [
        makeGate({ name: 'a', threshold: 80 }),
        makeGate({ name: 'b', threshold: 80 }),
      ];
      engine = new QualityEngine(gates, { minScore: 40 });
      const report = engine.evaluate([
        { name: 'a', value: 90 },
        { name: 'b', value: 30 },
      ]);
      expect(report.score).toBe(50);
      expect(report.passed).toBe(false);
    });

    it('should respect minScore: pass when score >= minScore and all pass', () => {
      const gates = [
        makeGate({ name: 'a', threshold: 80 }),
        makeGate({ name: 'b', threshold: 80 }),
      ];
      engine = new QualityEngine(gates, { minScore: 50 });
      const report = engine.evaluate([
        { name: 'a', value: 90 },
        { name: 'b', value: 85 },
      ]);
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
    });
  });

  // =========================================================
  // 4. getConfig()/setConfig() — valid/invalid config
  // =========================================================
  describe('config — valid/invalid configurations', () => {
    it('should create with default config when no options', () => {
      engine = new QualityEngine();
      expect(engine).toBeInstanceOf(QualityEngine);
    });

    it('should create with minScore 0', () => {
      engine = new QualityEngine([], { minScore: 0 });
      const report = engine.evaluate([{ name: 'x', value: 0 }]);
      expect(report.passed).toBe(true);
    });

    it('should create with minScore 100', () => {
      const gate = makeGate({ name: 'a', threshold: 80 });
      engine = new QualityEngine([gate], { minScore: 100 });
      const report = engine.evaluate([{ name: 'a', value: 90 }]);
      expect(report.passed).toBe(true);
    });

    it('should create with persistPath', () => {
      engine = new QualityEngine([], { persistPath: '/tmp/reports' });
      expect(engine).toBeInstanceOf(QualityEngine);
    });

    it('should create with custom timeout', () => {
      engine = new QualityEngine([], { timeout: 60000 });
      expect(engine).toBeInstanceOf(QualityEngine);
    });

    it('should create with all options simultaneously', () => {
      engine = new QualityEngine([makeGate({ name: 'g1', threshold: 50 })], {
        minScore: 60,
        persistPath: '/tmp/q.json',
        timeout: 99999,
      });
      const report = engine.evaluate([{ name: 'g1', value: 50 }]);
      expect(report.passed).toBe(true);
    });
  });

  // =========================================================
  // 5. reset() — após execuções
  // =========================================================
  describe('reset — multiple executions, history clearing', () => {
    it('should accumulate history across evaluations', () => {
      engine = new QualityEngine();
      engine.evaluate([]);
      engine.evaluate([]);
      engine.evaluate([]);
      expect(engine.getHistory()).toHaveLength(3);
    });

    it('should track last report after multiple evaluations', () => {
      engine = new QualityEngine();
      engine.evaluate([]);
      const mid = engine.evaluate([{ name: 'a', value: 50 }]);
      const last = engine.evaluate([{ name: 'a', value: 90 }]);
      expect(engine.getLastReport()?.id).toBe(last.id);
      expect(engine.getLastReport()?.id).not.toBe(mid.id);
    });

    it('should return undefined for last report when no history', () => {
      engine = new QualityEngine();
      expect(engine.getLastReport()).toBeUndefined();
    });

    it('should reset by creating new engine (no reset method)', () => {
      engine = new QualityEngine([makeGate({ name: 'g', threshold: 80 })]);
      engine.evaluate([{ name: 'g', value: 90 }]);
      expect(engine.getHistory()).toHaveLength(1);
      engine = new QualityEngine();
      expect(engine.getHistory()).toHaveLength(0);
      expect(engine.getGates()).toHaveLength(0);
    });

    it('should produce independent reports per evaluate call', () => {
      const gate = makeGate({ name: 'x', threshold: 50 });
      engine = new QualityEngine([gate]);
      const r1 = engine.evaluate([{ name: 'x', value: 30 }]);
      const r2 = engine.evaluate([{ name: 'x', value: 80 }]);
      expect(r1.passed).toBe(false);
      expect(r2.passed).toBe(true);
      expect(r1.id).not.toBe(r2.id);
    });
  });

  // =========================================================
  // evaluate — edge and boundary cases
  // =========================================================
  describe('evaluate — additional boundaries', () => {
    it('should handle metric exactly at 0 for threshold 0', () => {
      const gate = makeGate({ name: 'zero', threshold: 0 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'zero', value: 0 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should handle metric at very high values', () => {
      const gate = makeGate({ name: 'big', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'big', value: 999999 }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should handle metric at very low non-zero', () => {
      const gate = makeGate({ name: 'small', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'small', value: 0.01 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should handle negative metric value', () => {
      const gate = makeGate({ name: 'neg', threshold: 80 });
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'neg', value: -10 }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should evaluate gate with pass=false (fail expected)', () => {
      const gate: QualityGate = { id: 'fg', name: 'must-fail', type: 'custom', pass: false };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'must-fail', value: 0, passed: false }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should evaluate gate with pass=false but actual passed=true', () => {
      const gate: QualityGate = { id: 'fg', name: 'must-fail', type: 'custom', pass: false };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'must-fail', value: 1, passed: true }]);
      expect(report.checks[0].passed).toBe(false);
    });
  });

  // =========================================================
  // createReport — additional
  // =========================================================
  describe('createReport — additional', () => {
    it('should generate uuid for each report', () => {
      engine = new QualityEngine();
      const r1 = engine.createReport([]);
      const r2 = engine.createReport([]);
      expect(r1.id).toBeDefined();
      expect(r2.id).toBeDefined();
      expect(r1.id).not.toBe(r2.id);
    });

    it('should add timestamp in ISO format', () => {
      engine = new QualityEngine();
      const report = engine.createReport([]);
      expect(report.timestamp).toBeDefined();
      expect(() => new Date(report.timestamp)).not.toThrow();
    });

    it('should include duration in report', () => {
      engine = new QualityEngine();
      const report = engine.createReport([]);
      expect(typeof report.duration).toBe('number');
    });
  });

  // =========================================================
  // summary
  // =========================================================
  describe('summary', () => {
    it('should include report id in summary', () => {
      engine = new QualityEngine();
      const report = engine.evaluate([]);
      const s = engine.summary(report);
      expect(s).toContain(report.id);
    });

    it('should show correct check counts in summary', () => {
      const gates = [
        makeGate({ name: 'a', threshold: 80 }),
        makeGate({ name: 'b', threshold: 80 }),
      ];
      engine = new QualityEngine(gates);
      const report = engine.evaluate([
        { name: 'a', value: 90 },
        { name: 'b', value: 30 },
      ]);
      const s = engine.summary(report);
      expect(s).toContain('1/2');
      expect(s).toContain('FAILED');
    });

    it('should include all check messages in summary', () => {
      engine = new QualityEngine([makeGate({ name: 'x', threshold: 50 })]);
      const report = engine.evaluate([{ name: 'x', value: 100 }]);
      const s = engine.summary(report);
      expect(s).toContain('PASSED');
      expect(s).toContain('x');
    });
  });

  // =========================================================
  // gate management — full coverage
  // =========================================================
  describe('gate management', () => {
    it('should add gate to empty engine', () => {
      engine = new QualityEngine();
      engine.addGate(makeGate({ name: 'new' }));
      expect(engine.getGates()).toHaveLength(1);
    });

    it('should replace existing gate with same name', () => {
      engine = new QualityEngine([makeGate({ name: 'dup', threshold: 50 })]);
      engine.addGate(makeGate({ name: 'dup', threshold: 99 }));
      expect(engine.getGates()).toHaveLength(1);
      expect(engine.getGates()[0].threshold).toBe(99);
    });

    it('should not affect other gates when adding with same name', () => {
      engine = new QualityEngine([
        makeGate({ name: 'a', threshold: 50 }),
        makeGate({ name: 'b', threshold: 60 }),
      ]);
      engine.addGate(makeGate({ name: 'a', threshold: 95 }));
      expect(engine.getGates()).toHaveLength(2);
      expect(engine.getGates()[0].threshold).toBe(95);
      expect(engine.getGates()[1].threshold).toBe(60);
    });

    it('should remove gate that exists', () => {
      engine = new QualityEngine([makeGate({ name: 'remove-me' })]);
      const result = engine.removeGate('remove-me');
      expect(result).toBe(true);
      expect(engine.getGates()).toHaveLength(0);
    });

    it('should return false when removing non-existent gate', () => {
      engine = new QualityEngine([makeGate({ name: 'keep' })]);
      const result = engine.removeGate('ghost');
      expect(result).toBe(false);
      expect(engine.getGates()).toHaveLength(1);
    });

    it('should return copy of gates (mutation safe)', () => {
      engine = new QualityEngine([makeGate({ name: 'g1' })]);
      const gates = engine.getGates();
      gates[0] = { id: 'hacked', name: 'hacked', type: 'custom' };
      expect(engine.getGates()[0].name).toBe('g1');
    });
  });
});
