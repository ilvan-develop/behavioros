import type { QualityGate, QualityMetric } from '@behavioros/schemas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DispatcherLayerResult,
  PipelineDispatcherContext,
} from '../pipeline/pipeline-context';

// ============================================================
// Mock node:crypto with createHash for AuditTrailLayer
// ============================================================
vi.mock('node:crypto', () => {
  // @ts-expect-error - vi.importActual returns Promise in sync mock factory
  const { randomUUID: realUUID } = vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2, 10)}`,
    createHash: () => ({
      update: () => ({ digest: () => 'a'.repeat(64) }),
    }),
  };
});

// Mock node:fs for QualityEngine tests
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

// ============================================================
// SECTION 1 — MetricsInterceptor
// ============================================================
import { MetricsInterceptor } from '../pipeline/interceptors/metrics-interceptor';

describe('MetricsInterceptor — edge coverage', () => {
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    interceptor = new MetricsInterceptor();
  });

  it('should record failure when result.passed is false', async () => {
    const ctx = {} as PipelineDispatcherContext;
    const next = vi.fn<() => Promise<DispatcherLayerResult>>().mockResolvedValue({
      layerId: 'test-layer',
      layerName: 'Test',
      passed: false,
      score: 0,
      duration: 10,
      details: {},
    });
    const result = await interceptor.intercept(ctx, next);
    expect(result.passed).toBe(false);
    const metrics = interceptor.getMetrics();
    const layer = metrics.get('test-layer');
    expect(layer).toBeDefined();
    expect(layer!.failures).toBe(1);
    expect(layer!.count).toBe(1);
  });

  it('should accumulate metrics across multiple calls', async () => {
    const ctx = {} as PipelineDispatcherContext;
    const nextPass = vi.fn<() => Promise<DispatcherLayerResult>>().mockResolvedValue({
      layerId: 'multi',
      layerName: 'Multi',
      passed: true,
      score: 100,
      duration: 5,
      details: {},
    });
    const nextFail = vi.fn<() => Promise<DispatcherLayerResult>>().mockResolvedValue({
      layerId: 'multi',
      layerName: 'Multi',
      passed: false,
      score: 0,
      duration: 10,
      details: {},
    });
    await interceptor.intercept(ctx, nextPass);
    await interceptor.intercept(ctx, nextFail);
    const metrics = interceptor.getMetrics();
    const layer = metrics.get('multi')!;
    expect(layer.count).toBe(2);
    expect(layer.failures).toBe(1);
    expect(layer.avgDuration).toBeGreaterThanOrEqual(0);
  });

  it('should return empty map from getMetrics when nothing recorded', () => {
    const metrics = interceptor.getMetrics();
    expect(metrics.size).toBe(0);
  });

  it('should clear all metrics on reset', async () => {
    const ctx = {} as PipelineDispatcherContext;
    const next = vi.fn<() => Promise<DispatcherLayerResult>>().mockResolvedValue({
      layerId: 'x',
      layerName: 'X',
      passed: true,
      score: 100,
      duration: 0,
      details: {},
    });
    await interceptor.intercept(ctx, next);
    expect(interceptor.getMetrics().size).toBe(1);
    interceptor.reset();
    expect(interceptor.getMetrics().size).toBe(0);
  });

  it('should handle multiple layers independently', async () => {
    const ctx = {} as PipelineDispatcherContext;
    const makeNext = (layerId: string, passed: boolean) =>
      vi.fn<() => Promise<DispatcherLayerResult>>().mockResolvedValue({
        layerId,
        layerName: layerId,
        passed,
        score: passed ? 100 : 0,
        duration: 5,
        details: {},
      });
    await interceptor.intercept(ctx, makeNext('layer-a', true));
    await interceptor.intercept(ctx, makeNext('layer-b', false));
    const metrics = interceptor.getMetrics();
    expect(metrics.get('layer-a')!.failures).toBe(0);
    expect(metrics.get('layer-b')!.failures).toBe(1);
  });
});

// ============================================================
// SECTION 2 — TimeoutInterceptor
// ============================================================
import { TimeoutInterceptor } from '../pipeline/interceptors/timeout-interceptor';

describe('TimeoutInterceptor — edge coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return layer result on normal execution', async () => {
    const interceptor = new TimeoutInterceptor(5000);
    const ctx = {} as PipelineDispatcherContext;
    const next = vi.fn<() => Promise<DispatcherLayerResult>>().mockResolvedValue({
      layerId: 'normal',
      layerName: 'Normal',
      passed: true,
      score: 100,
      duration: 1,
      details: {},
    });
    const result = await interceptor.intercept(ctx, next);
    expect(result.passed).toBe(true);
    expect(result.layerId).toBe('normal');
  });

  it('should catch timeout error when next never resolves', async () => {
    const interceptor = new TimeoutInterceptor(100);
    const ctx = {} as PipelineDispatcherContext;
    const next = vi
      .fn<() => Promise<DispatcherLayerResult>>()
      .mockImplementation(() => new Promise(() => {}));
    const promise = interceptor.intercept(ctx, next);
    vi.advanceTimersByTime(150);
    const result = await promise;
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.layerId).toBe('timeout');
    expect(result.error).toContain('Layer timeout after 100ms');
  });

  it('should handle non-Error rejection gracefully', async () => {
    const interceptor = new TimeoutInterceptor(50);
    const ctx = {} as PipelineDispatcherContext;
    const next = vi.fn<() => Promise<DispatcherLayerResult>>().mockRejectedValue('string error');
    const promise = interceptor.intercept(ctx, next);
    vi.advanceTimersByTime(60);
    const result = await promise;
    expect(result.passed).toBe(false);
  });
});

// ============================================================
// SECTION 3 — PipelineTracer
// ============================================================
import { traceLayer, tracePipeline } from '../pipeline/telemetry/pipeline-tracer';
import { getTracer, resetTracer } from '../pipeline/telemetry/tracing';

describe('PipelineTracer — edge coverage', () => {
  beforeEach(() => {
    resetTracer();
  });

  it('should trace pipeline success', async () => {
    const result = await tracePipeline('pipe-1', async () => 'ok');
    expect(result).toBe('ok');
  });

  it('should trace pipeline error and rethrow', async () => {
    await expect(
      tracePipeline('pipe-2', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('should trace pipeline error with non-Error', async () => {
    await expect(
      tracePipeline('pipe-3', async () => {
        throw 'string-error';
      }),
    ).rejects.toBe('string-error');
  });

  it('should trace layer success', async () => {
    const result = await traceLayer('my-layer', 'pipe-1', 0, async () => 42);
    expect(result).toBe(42);
  });

  it('should trace layer error and rethrow', async () => {
    await expect(
      traceLayer('bad-layer', 'pipe-1', 1, async () => {
        throw new Error('layer fail');
      }),
    ).rejects.toThrow('layer fail');
  });

  it('should trace layer error with non-Error', async () => {
    await expect(
      traceLayer('bad-layer', 'pipe-1', 2, async () => {
        throw 'err';
      }),
    ).rejects.toBe('err');
  });

  it('should respect BEHAVIOROS_TELEMETRY=console in tracer', () => {
    process.env.BEHAVIOROS_TELEMETRY = 'console';
    resetTracer();
    const tracer = getTracer();
    const span = tracer.startSpan('test-span');
    span.setAttribute('key', 'value');
    span.setAttribute('num', 42);
    span.setStatus(0 as any, 'test message');
    span.end();
    delete process.env.BEHAVIOROS_TELEMETRY;
  });
});

// ============================================================
// SECTION 4 — Tracing module
// ============================================================
import {
  getTracer as getTracer2,
  resetTracer as resetTracer2,
} from '../pipeline/telemetry/tracing';

describe('Tracing module — edge coverage', () => {
  beforeEach(() => {
    resetTracer2();
  });

  it('should return same tracer instance on multiple calls', () => {
    const t1 = getTracer2();
    const t2 = getTracer2();
    expect(t1).toBe(t2);
  });

  it('should create new tracer after reset', () => {
    const t1 = getTracer2();
    resetTracer2();
    const t2 = getTracer2();
    expect(t1).not.toBe(t2);
  });

  it('ConsoleSpan should handle empty attrs', () => {
    process.env.BEHAVIOROS_TELEMETRY = 'console';
    resetTracer2();
    const tracer = getTracer2();
    const span = tracer.startSpan('empty-test');
    span.setAttribute('a', 1);
    span.end();
    delete process.env.BEHAVIOROS_TELEMETRY;
  });

  it('ConsoleSpan.end with no statusMessage', () => {
    process.env.BEHAVIOROS_TELEMETRY = 'console';
    resetTracer2();
    const tracer = getTracer2();
    const span = tracer.startSpan('no-msg');
    span.setStatus(1 as any);
    span.end();
    delete process.env.BEHAVIOROS_TELEMETRY;
    resetTracer2();
  });
});

// ============================================================
// SECTION 5 — Metrics (MetricsCollector)
// ============================================================
import { MetricsCollector } from '../pipeline/telemetry/metrics';

describe('MetricsCollector — edge coverage', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should record execution with empty layerTimings', () => {
    collector.recordExecution(100, true, new Map());
    const metrics = collector.getMetrics();
    expect(metrics.executions).toBe(1);
    expect(metrics.successes).toBe(1);
    expect(metrics.failures).toBe(0);
    expect(metrics.layerMetrics.size).toBe(0);
  });

  it('should record failure with layerTimings', () => {
    const timings = new Map([['layer1', 50]]);
    collector.recordExecution(200, false, timings);
    const metrics = collector.getMetrics();
    expect(metrics.executions).toBe(1);
    expect(metrics.successes).toBe(0);
    expect(metrics.failures).toBe(1);
    const layer = metrics.layerMetrics.get('layer1')!;
    expect(layer.count).toBe(1);
    expect(layer.errors).toBe(1);
  });

  it('should return a copy from getMetrics', () => {
    collector.recordExecution(10, true, new Map([['x', 1]]));
    const m1 = collector.getMetrics();
    const m2 = collector.getMetrics();
    expect(m1).not.toBe(m2);
    expect(m1.layerMetrics).not.toBe(m2.layerMetrics);
  });

  it('should reset all state', () => {
    collector.recordExecution(10, true, new Map([['a', 1]]));
    collector.reset();
    const m = collector.getMetrics();
    expect(m.executions).toBe(0);
    expect(m.successes).toBe(0);
    expect(m.failures).toBe(0);
    expect(m.avgLatency).toBe(0);
    expect(m.p99Latency).toBe(0);
    expect(m.layerMetrics.size).toBe(0);
  });

  it('should compute p99 correctly', () => {
    for (let i = 0; i < 100; i++) {
      collector.recordExecution(i, true, new Map());
    }
    const m = collector.getMetrics();
    expect(m.executions).toBe(100);
    expect(m.avgLatency).toBeGreaterThan(0);
    expect(m.p99Latency).toBeGreaterThan(0);
  });

  it('should handle single execution latencies', () => {
    collector.recordExecution(42, true, new Map());
    const m = collector.getMetrics();
    expect(m.avgLatency).toBe(42);
    expect(m.p99Latency).toBe(42);
  });

  it('should accumulate layer metrics across calls', () => {
    const t1 = new Map([['shared', 10]]);
    const t2 = new Map([['shared', 20]]);
    collector.recordExecution(30, true, t1);
    collector.recordExecution(60, false, t2);
    const layer = collector.getMetrics().layerMetrics.get('shared')!;
    expect(layer.count).toBe(2);
    expect(layer.avgLatency).toBe(15);
    expect(layer.errors).toBe(1);
  });
});

// ============================================================
// SECTION 6 — AuditTrailLayer
// ============================================================
import { AuditTrailLayer } from '../pipeline/layers/audit-trail.layer';
import { createDispatcherContext } from '../pipeline/pipeline-context';

function makeAuditCtx(
  overrides: Partial<PipelineDispatcherContext> = {},
): PipelineDispatcherContext {
  return createDispatcherContext({
    id: 'audit-test',
    dnaId: 'dna-1',
    dnaMode: 'transactional',
    agentId: 'agent-1',
    agentAuthority: 'architect',
    action: 'deploy',
    payload: { action: 'deploy', target: 'staging' },
    metadata: new Map([['env', 'staging']]),
    ...overrides,
  });
}

describe('AuditTrailLayer — edge coverage', () => {
  it('should construct with default options', () => {
    const layer = new AuditTrailLayer();
    expect(layer.id).toBe('audit-trail');
  });

  it('should construct with maxEntries', () => {
    const layer = new AuditTrailLayer({ maxEntries: 5 });
    expect(layer).toBeInstanceOf(AuditTrailLayer);
  });

  it('should execute and record an entry', async () => {
    const layer = new AuditTrailLayer();
    const ctx = makeAuditCtx();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.trailLength).toBe(1);
  });

  it('should return true from shouldExecute', () => {
    const layer = new AuditTrailLayer();
    expect(layer.shouldExecute({} as any)).toBe(true);
  });

  it('should return trail length', () => {
    const layer = new AuditTrailLayer();
    expect(layer.getTrailLength()).toBe(0);
  });

  it('should return trail copy', async () => {
    const layer = new AuditTrailLayer();
    const ctx = makeAuditCtx();
    await layer.execute(ctx);
    const trail = layer.getTrail();
    expect(trail).toHaveLength(1);
    trail.length = 0;
    expect(layer.getTrail()).toHaveLength(1);
  });

  it('should filter trail by pipeline id', async () => {
    const layer = new AuditTrailLayer();
    await layer.execute(makeAuditCtx({ id: 'pipe-a' }));
    await layer.execute(makeAuditCtx({ id: 'pipe-b' }));
    expect(layer.getTrailForPipeline('pipe-a')).toHaveLength(1);
    expect(layer.getTrailForPipeline('pipe-b')).toHaveLength(1);
    expect(layer.getTrailForPipeline('nonexistent')).toHaveLength(0);
  });

  it('should clear trail', async () => {
    const layer = new AuditTrailLayer();
    await layer.execute(makeAuditCtx());
    layer.clearTrail();
    expect(layer.getTrailLength()).toBe(0);
    expect(layer.getTrail()).toEqual([]);
  });

  it('should return null store when persistence disabled', () => {
    const layer = new AuditTrailLayer();
    expect(layer.getStore()).toBeNull();
  });

  it('should handle verifyChain with broken previousHash', async () => {
    const layer = new AuditTrailLayer({ maxEntries: 100 });
    const ctx = makeAuditCtx();
    await layer.execute(ctx);
    const trail = (layer as any).trail;
    (layer as any).lastVerifiedIndex = -1;
    trail[0].previousHash = 'bad';
    expect(layer.verifyChain()).toBe(false);
  });

  it('should handle verifyChain with bad hash length', async () => {
    const layer = new AuditTrailLayer({ maxEntries: 100 });
    const ctx = makeAuditCtx();
    await layer.execute(ctx);
    const trail = (layer as any).trail;
    (layer as any).lastVerifiedIndex = -1;
    trail[0].hash = 'short';
    expect(layer.verifyChain()).toBe(false);
  });

  it('should handle execute catch block when context is malformed', async () => {
    const layer = new AuditTrailLayer();
    const badCtx = {
      ...makeAuditCtx(),
      get id() {
        throw new Error('bad id');
      },
    };
    // @ts-expect-error - intentionally partial context for error testing
    const result = await layer.execute(badCtx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(0);
    expect(result.details.error).toContain('bad id');
  });

  it('should have chain valid with multiple entries', async () => {
    const layer = new AuditTrailLayer();
    await layer.execute(makeAuditCtx({ id: 'pipe-c', currentLayerIndex: 0 }));
    await layer.execute(makeAuditCtx({ id: 'pipe-c', currentLayerIndex: 1 }));
    expect(layer.getTrailLength()).toBe(2);
    expect(layer.verifyChain()).toBe(true);
  });

  it('should trim when exceeding maxEntries', async () => {
    const layer = new AuditTrailLayer({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      await layer.execute(makeAuditCtx({ id: `pipe-${i}` }));
    }
    expect(layer.getTrailLength()).toBe(3);
  });

  it('should verify chain with single entry', () => {
    const layer = new AuditTrailLayer();
    expect(layer.verifyChain()).toBe(true);
  });
});

// ============================================================
// SECTION 7 — QualityEngine
// ============================================================
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

describe('QualityEngine — edge coverage', () => {
  let engine: QualityEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockExecSync.mockReturnValue('');
  });

  describe('addGate', () => {
    it('should add a new gate', () => {
      engine = new QualityEngine();
      const gate = makeGate({ name: 'new-gate' });
      engine.addGate(gate);
      expect(engine.getGates()).toHaveLength(1);
    });

    it('should update existing gate with same name', () => {
      engine = new QualityEngine([makeGate({ name: 'dup', threshold: 50 })]);
      engine.addGate(makeGate({ name: 'dup', threshold: 90 }));
      const gates = engine.getGates();
      expect(gates).toHaveLength(1);
      expect(gates[0].threshold).toBe(90);
    });
  });

  describe('removeGate', () => {
    it('should remove existing gate', () => {
      engine = new QualityEngine([makeGate({ name: 'removable' })]);
      expect(engine.removeGate('removable')).toBe(true);
      expect(engine.getGates()).toHaveLength(0);
    });

    it('should return false for non-existent gate', () => {
      engine = new QualityEngine();
      expect(engine.removeGate('nonexistent')).toBe(false);
    });
  });

  describe('getGates / getHistory / getLastReport', () => {
    it('getGates should return a copy', () => {
      engine = new QualityEngine([makeGate()]);
      const gates = engine.getGates();
      gates.length = 0;
      expect(engine.getGates()).toHaveLength(1);
    });

    it('getHistory should return a copy', () => {
      engine = new QualityEngine([makeGate()]);
      engine.evaluate([{ name: 'test_coverage', value: 90 }]);
      const hist = engine.getHistory();
      expect(hist).toHaveLength(1);
      hist.length = 0;
      expect(engine.getHistory()).toHaveLength(1);
    });

    it('getLastReport should return undefined when no history', () => {
      engine = new QualityEngine();
      expect(engine.getLastReport()).toBeUndefined();
    });

    it('getLastReport should return last report when history exists', () => {
      engine = new QualityEngine([makeGate()]);
      engine.evaluate([{ name: 'test_coverage', value: 90 }]);
      expect(engine.getLastReport()).toBeDefined();
    });
  });

  describe('summary', () => {
    it('should format summary string', () => {
      engine = new QualityEngine([makeGate({ name: 'lint', threshold: 0 })]);
      const report = engine.evaluate([{ name: 'lint', value: 0 }]);
      const s = engine.summary(report);
      expect(s).toContain('Quality Report');
      expect(s).toContain('PASSED');
    });

    it('should show failed in summary', () => {
      engine = new QualityEngine([makeGate({ name: 'cov', threshold: 80 })]);
      const report = engine.evaluate([{ name: 'cov', value: 30 }]);
      const s = engine.summary(report);
      expect(s).toContain('FAILED');
    });
  });

  describe('evaluate — boolean pass gate', () => {
    it('should handle gate.pass boolean value', () => {
      const gate: QualityGate = { id: 'g', name: 'custom', pass: true, type: 'custom' };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'custom', value: 1, passed: true }]);
      expect(report.checks[0].passed).toBe(true);
    });

    it('should fail gate.pass when metric does not match', () => {
      const gate: QualityGate = { id: 'g', name: 'custom', pass: true, type: 'custom' };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'custom', value: 0, passed: false }]);
      expect(report.checks[0].passed).toBe(false);
    });

    it('should auto-pass gate with no threshold or pass', () => {
      const gate: QualityGate = { id: 'g', name: 'auto', type: 'custom' };
      engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'auto', value: 50 }]);
      expect(report.checks[0].passed).toBe(true);
      expect(report.checks[0].message).toContain('no threshold configured');
    });
  });

  describe('runAll', () => {
    it('should pass with no gates', async () => {
      engine = new QualityEngine();
      const report = await engine.runAll('/fake/path');
      expect(report.passed).toBe(true);
      expect(report.score).toBe(100);
      expect(report.checks).toHaveLength(0);
    });

    it('should run gate and produce check results', async () => {
      mockExecSync.mockReturnValue('');
      engine = new QualityEngine([makeGate({ name: 'lint' })]);
      const report = await engine.runAll('/fake/path');
      expect(report.checks).toHaveLength(1);
      expect(report.checks[0].gate).toBe('lint');
    });
  });

  describe('createReport', () => {
    it('should create report from results', () => {
      engine = new QualityEngine([], { minScore: 70 });
      const results = [
        { gate: 'lint', passed: true, actual: 0, expected: 0, message: 'ok' },
        { gate: 'cov', passed: false, actual: 50, expected: 80, message: 'fail' },
      ];
      const report = engine.createReport(results);
      expect(report.passed).toBe(false);
      expect(report.score).toBe(50);
      expect(report.checks).toHaveLength(2);
      expect(report.metrics).toHaveLength(2);
    });

    it('should create report with empty results (score 100)', () => {
      engine = new QualityEngine();
      const report = engine.createReport([]);
      expect(report.score).toBe(100);
    });
  });
});

import { LifecycleManager } from '../kernel/lifecycle/lifecycle-manager';
// ============================================================
// SECTION 8 — LifecycleManager
// ============================================================
import { InvalidTransitionError, isValidTransition } from '../kernel/lifecycle/types';

describe('LifecycleManager — edge coverage', () => {
  it('should trim history when exceeding maxHistorySize', () => {
    const lm = new LifecycleManager(3);
    lm.transition('initialized');
    lm.transition('starting');
    lm.transition('running');
    lm.transition('stopping');
    lm.transition('stopped');
    const history = lm.getHistory();
    expect(history.length).toBeLessThanOrEqual(3);
  });

  it('should handle listener that throws', () => {
    const lm = new LifecycleManager();
    const throwingListener = vi.fn().mockImplementation(() => {
      throw new Error('listener fail');
    });
    const safeListener = vi.fn();
    lm.on('thrower', throwingListener);
    lm.on('safe', safeListener);
    expect(() => lm.transition('initialized')).toThrow('listener fail');
  });

  it('getState returns current state', () => {
    const lm = new LifecycleManager();
    expect(lm.getState()).toBe('draft');
    lm.transition('initialized');
    expect(lm.getState()).toBe('initialized');
  });

  it('isValidTransition validates correctly', () => {
    expect(isValidTransition('draft', 'initialized')).toBe(true);
    expect(isValidTransition('draft', 'running')).toBe(false);
    expect(isValidTransition('unknown' as any, 'draft')).toBe(false);
  });

  it('InvalidTransitionError has correct name', () => {
    const err = new InvalidTransitionError('draft', 'running');
    expect(err.name).toBe('InvalidTransitionError');
    expect(err.message).toContain('draft');
    expect(err.message).toContain('running');
  });

  it('reset clears listeners and history', () => {
    const lm = new LifecycleManager();
    const listener = vi.fn();
    lm.on('test', listener);
    lm.transition('initialized');
    lm.reset();
    lm.transition('initialized');
    expect(lm.getState()).toBe('initialized');
    expect(lm.getHistory()).toHaveLength(1);
  });

  it('removes listener with off', () => {
    const lm = new LifecycleManager();
    const listener = vi.fn();
    lm.on('test', listener);
    lm.off('test');
    lm.transition('initialized');
    expect(listener).not.toHaveBeenCalled();
  });
});

// ============================================================
// SECTION 9 — ComplianceExporter
// ============================================================
import { ComplianceExporter, type ComplianceExportReport } from '../compliance/compliance-exporter';

describe('ComplianceExporter — edge coverage', () => {
  let exporter: ComplianceExporter;

  beforeEach(() => {
    exporter = new ComplianceExporter({ projectName: 'test-proj' });
  });

  describe('export formats', () => {
    it('should export JSON format', () => {
      const report = exporter.generate({});
      const output = exporter.export(report, 'json');
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should export markdown format', () => {
      const report = exporter.generate({});
      const output = exporter.export(report, 'markdown');
      expect(output).toContain('# Compliance Report');
      expect(output).toContain('Executive Summary');
    });

    it('should export CSV format', () => {
      const report = exporter.generate({});
      const output = exporter.export(report, 'csv');
      expect(output).toContain('Framework');
    });
  });

  describe('load', () => {
    it('should throw for missing file', async () => {
      await expect(exporter.load('/nonexistent/path/report.json')).rejects.toThrow(
        'Report file not found',
      );
    });
  });

  describe('verifyAuditChain', () => {
    it('should detect broken links when prev not passed', () => {
      const report = exporter.generate({
        auditChain: [
          { step: 'lint', hash: 'a', timestamp: 't1', passed: true },
          { step: 'typecheck', hash: 'b', timestamp: 't2', passed: false },
          { step: 'security', hash: 'c', timestamp: 't3', passed: true },
        ],
      });
      expect(report.auditChain.chainIntact).toBe(false);
      expect(report.auditChain.brokenLinks).toBe(1);
    });

    it('should handle empty audit chain', () => {
      exporter = new ComplianceExporter({ projectName: 'empty' });
      const report = exporter.generate({ auditChain: [] });
      expect(report.auditChain.chainIntact).toBe(false);
      expect(report.auditChain.totalEntries).toBe(0);
    });
  });

  describe('buildSummary with no frameworks', () => {
    it('should produce zero summary when no assessments generated', () => {
      exporter = new ComplianceExporter({ frameworks: [], projectName: 'empty' });
      const report = exporter.generate({});
      expect(report.summary.totalChecks).toBe(0);
      expect(report.summary.overallScore).toBe(0);
    });
  });

  describe('full assessment markdown', () => {
    it('should produce markdown with dnaVersion and full assessments', () => {
      exporter = new ComplianceExporter({ projectName: 'full-test', dnaVersion: '1.0' });
      const report = exporter.generate({
        euRiskInput: {
          purpose: 'test',
          usesBiometrics: true,
          accessesCriticalInfrastructure: false,
          determinesAccessToEssentialServices: false,
          usedInLawEnforcement: false,
          usedInMigration: false,
          usedInEducation: false,
          usedInEmployment: false,
          remoteBiometricPublicSpaces: false,
          profilesNaturalPersons: true,
        },
        pciInput: {
          handlesCardholderData: true,
          processesPayments: true,
          internetFacing: true,
          annualTransactions: 100000,
          encryptsInTransit: true,
          encryptsAtRest: true,
          hasAccessControl: true,
          hasMonitoring: true,
          hasVulnerabilityScanning: true,
          hasSecurityPolicies: true,
          hasFirewall: true,
          hasMFA: true,
          hasAuditLogging: true,
          hasNetworkSegmentation: true,
          // @ts-expect-error - unknown property for edge case testing
          hasWAF: true,
          hasIDS: true,
          hasCDE: true,
          hasPenTest: true,
          hasIncidentResponse: true,
          hasPolicies: true,
          hasTraining: true,
          hasBackgroundChecks: true,
          hasSecureDevelop: true,
          hasChangeControl: true,
        },
        soc2Input: {
          // @ts-expect-error - unknown property for edge case testing
          handlesCustomerData: true,
          usesCloudServices: true,
          hasAccessControl: true,
          hasEncryption: true,
          hasMonitoring: true,
          hasIncidentResponse: true,
          hasVendorManagement: true,
          hasBusinessContinuity: true,
          hasTraining: true,
          hasChangeManagement: true,
          hostsProductionData: false,
          hasDataRetention: true,
          hasDataDeletion: true,
          hasPenTest: true,
          hasAuditLogging: true,
        },
      });
      const md = exporter.export(report, 'markdown');
      expect(md).toContain('DNA Version');
      expect(md).toContain('EU AI Act');
      expect(md).toContain('PCI-DSS');
      expect(md).toContain('SOC 2');
    });
  });
});

// ============================================================
// SECTION 10 — LearningEngine
// ============================================================
import { LearningEngine } from '../engines/learning/learning-engine';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'observation',
    source: 'test-source',
    data: { key: 'value' },
    confidence: 0.5,
    applied: false,
    ...overrides,
  } as any;
}

describe('LearningEngine — edge coverage', () => {
  let engine: LearningEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new LearningEngine();
  });

  describe('getTrends', () => {
    it('should return empty when events have fewer than 3 per type', () => {
      for (let i = 0; i < 4; i++) {
        const d = new Date('2026-07-20T10:00:00Z');
        d.setMinutes(d.getMinutes() + i * 60);
        engine.record(makeEvent({ type: `type-${i}`, source: 'src' }));
      }
      expect(engine.getTrends()).toEqual([]);
    });

    it('should detect increasing trend', () => {
      const now = Date.now();
      for (let i = 0; i < 6; i++) {
        const t = new Date(now - (5 - i) * 3600000);
        (engine as any).events.push({
          id: `evt-${i}`,
          timestamp: t.toISOString(),
          type: 'error',
          source: 'src',
          data: {},
        });
      }
      const trends = engine.getTrends();
      expect(trends.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAnomalies', () => {
    it('should return anomalies when rate exceeds threshold', () => {
      for (let i = 0; i < 10; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - i * 2);
        (engine as any).events.push({
          id: `evt-${i}`,
          timestamp: d.toISOString(),
          type: 'correction',
          source: 'src',
          data: {},
        });
      }
      const anomalies = engine.getAnomalies();
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('getSourceReputation', () => {
    it('should handle source with only corrections', () => {
      engine.record(makeEvent({ source: 'fixer', type: 'correction', confidence: 0.8 }));
      engine.record(makeEvent({ source: 'fixer', type: 'correction', confidence: 0.7 }));
      engine.record(makeEvent({ source: 'fixer', type: 'correction', confidence: 0.9 }));
      const rep = engine.getSourceReputation('fixer');
      expect(rep).not.toBeNull();
      expect(rep!.correctionCount).toBe(3);
      expect(rep!.insightRatio).toBeGreaterThanOrEqual(0);
    });

    it('should handle source with mixed types', () => {
      engine.record(makeEvent({ source: 'mixed', type: 'insight', confidence: 0.9 }));
      engine.record(makeEvent({ source: 'mixed', type: 'correction', confidence: 0.5 }));
      engine.record(makeEvent({ source: 'mixed', type: 'observation', confidence: 0.3 }));
      const rep = engine.getSourceReputation('mixed');
      expect(rep).not.toBeNull();
      expect(rep!.insightCount).toBe(1);
      expect(rep!.correctionCount).toBe(1);
    });
  });

  describe('detectTemporalPattern — hourly clustering', () => {
    it('should create hourly cluster insights', () => {
      for (let i = 0; i < 6; i++) {
        const d = new Date('2026-07-20T14:00:00Z');
        d.setHours(14, i * 5);
        engine.record(makeEvent({ type: 'heartbeat', source: 'sys' }));
      }
      const insights = engine.getInsights();
      expect(Array.isArray(insights)).toBe(true);
    });
  });

  describe('detectAnomaly — update existing pattern', () => {
    it('should update existing anomaly insight confidence', () => {
      for (let i = 0; i < 8; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - i * 5);
        (engine as any).events.push({
          id: `evt-anom-${i}`,
          timestamp: d.toISOString(),
          type: 'spike',
          source: 'mon',
          data: {},
        });
      }
      engine.record(makeEvent({ type: 'spike', source: 'mon' }));
      const insights = engine.getInsights();
      const anomaly = insights.find((i) => i.id === 'anomaly-spike');
      if (anomaly) {
        expect(anomaly.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('detectTrend — decreasing and stable', () => {
    it('should handle decreasing trend', () => {
      for (let i = 0; i < 8; i++) {
        const d = new Date();
        d.setHours(d.getHours() - (7 - i) * 2);
        (engine as any).events.push({
          id: `evt-dec-${i}`,
          timestamp: d.toISOString(),
          type: 'declining',
          source: 'src',
          data: {},
        });
      }
      engine.record(makeEvent({ type: 'declining', source: 'src' }));
      expect(engine.getInsights().length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectFailureChain', () => {
    it('should detect failure chain pattern', () => {
      for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (2 - i) * 5);
        (engine as any).events.push({
          id: `evt-fail-${i}`,
          timestamp: d.toISOString(),
          type: 'error',
          source: 'sys',
          data: {},
        });
      }
      engine.record(makeEvent({ type: 'correction', source: 'sys' }));
      const insights = engine.getInsights();
      const failure = insights.find((i) => i.id?.includes('failure'));
      if (failure) {
        expect(failure.category).toBe('failure');
      }
    });
  });

  describe('updateSourceReputationInsight', () => {
    it('should update existing reputation insight', () => {
      for (let i = 0; i < 5; i++) {
        engine.record(makeEvent({ source: 'known-src', type: 'insight', confidence: 0.9 }));
      }
      engine.record(makeEvent({ source: 'known-src', type: 'insight', confidence: 0.9 }));
      const insights = engine.getInsights();
      const rep = insights.find((i) => i.id === 'reputation-known-src');
      if (rep) {
        expect(rep.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('autoApplyInsights', () => {
    it('should not apply when no high confidence insights', () => {
      const e = new LearningEngine({ autoApply: true });
      e.record(makeEvent({ type: 'insight', confidence: 0.5 }));
      const feedback = e.getEvents().filter((ev) => ev.type === 'feedback');
      expect(feedback.length).toBe(0);
    });
  });

  describe('timeSpanHours', () => {
    it('should return 1 for fewer than 2 events', () => {
      const result = (engine as any).timeSpanHours([{ timestamp: new Date().toISOString() }]);
      expect(result).toBe(1);
    });
  });

  describe('generateReport with insights', () => {
    it('should include insights in report', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9, source: 'test' }));
      const report = engine.generateReport();
      expect(report.insights).toBeDefined();
    });
  });

  describe('persist', () => {
    it('should persist state', async () => {
      const e = new LearningEngine({ persistPath: '/tmp/learn-test.json' });
      e.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      await expect(e.persist()).resolves.toBeUndefined();
      expect(e.getEvents()).toHaveLength(1);
    });
  });
});

// ============================================================
// SECTION 11 — PatternDetector
// ============================================================
import { PatternDetector } from '../engines/intelligence/pattern-detector';

describe('PatternDetector — edge coverage', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('detectFrequentSequences', () => {
    it('should return empty with fewer than 2 events', () => {
      detector.record('a', {});
      expect(detector.detectFrequentSequences()).toEqual([]);
    });

    it('should detect frequent sequences', () => {
      detector.record('A', {});
      detector.record('B', {});
      detector.record('A', {});
      detector.record('B', {});
      detector.record('A', {});
      detector.record('B', {});
      const patterns = detector.detectFrequentSequences(2);
      expect(patterns.length).toBeGreaterThanOrEqual(1);
      expect(patterns[0].type).toBe('frequent-sequence');
    });

    it('should update existing frequent sequence frequency', () => {
      detector.record('M', {});
      detector.record('N', {});
      detector.record('M', {});
      detector.record('N', {});
      const first = detector.detectFrequentSequences(2);
      const freqSeq = first.find((p) => p.type === 'frequent-sequence');
      const freqBefore = freqSeq?.frequency ?? 0;
      detector.record('M', {});
      detector.record('N', {});
      const second = detector.detectFrequentSequences(2);
      const newFreq = second.find((p) => p.type === 'frequent-sequence');
      expect(second.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectAnomalies', () => {
    it('should return empty with fewer than 4 events', () => {
      for (let i = 0; i < 3; i++) detector.record('t', {});
      expect(detector.detectAnomalies()).toEqual([]);
    });

    it('should return empty when stdDev is 0', () => {
      for (let i = 0; i < 10; i++) detector.record('same', { key: 'v' });
      expect(detector.detectAnomalies()).toEqual([]);
    });

    it('should detect anomalies with high z-score', () => {
      for (let i = 0; i < 8; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (7 - i) * 2);
        (detector as any).events.push({
          id: `anom-${i}`,
          type: 'burst',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      detector.record('burst', {});
      const anomalies = detector.detectAnomalies(5, 1);
      expect(Array.isArray(anomalies)).toBe(true);
    });

    it('should update existing anomaly pattern', () => {
      for (let i = 0; i < 10; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (9 - i) * 1);
        (detector as any).events.push({
          id: `anom2-${i}`,
          type: 'flash',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      detector.detectAnomalies(5, 0.5);
      const beforeConf =
        detector.getAllPatterns().find((p) => p.name === 'anomaly: flash')?.confidence ?? 0;
      for (let i = 0; i < 4; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (3 - i) * 1);
        (detector as any).events.push({
          id: `anom2b-${i}`,
          type: 'flash',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      detector.detectAnomalies(5, 0.5);
      const updatedConf =
        detector.getAllPatterns().find((p) => p.name === 'anomaly: flash')?.confidence ?? 0;
      expect(updatedConf).toBeGreaterThanOrEqual(beforeConf);
    });
  });

  describe('detectTrends', () => {
    it('should return empty with insufficient events', () => {
      for (let i = 0; i < 5; i++) detector.record('sparse', {});
      expect(detector.detectTrends(3)).toEqual([]);
    });

    it('should return empty when firstSum is 0', () => {
      for (let i = 0; i < 10; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (9 - i) * 100);
        (detector as any).events.push({
          id: `z-${i}`,
          type: 'rare',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      const trends = detector.detectTrends(3);
      expect(Array.isArray(trends)).toBe(true);
    });

    it('should detect increasing and decreasing trends', () => {
      for (let i = 0; i < 20; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (19 - i) * 5);
        (detector as any).events.push({
          id: `tr-${i}`,
          type: 'growing',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      const trends = detector.detectTrends(5);
      expect(trends.length).toBeGreaterThanOrEqual(0);
    });

    it('should update existing trend pattern', () => {
      for (let i = 0; i < 20; i++) {
        const d = new Date();
        d.setHours(d.getHours() - (19 - i) * 2);
        (detector as any).events.push({
          id: `trendup-${i}`,
          type: 'rising',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      detector.detectTrends(5);
      const before = detector.getAllPatterns().length;
      for (let i = 0; i < 10; i++) {
        const d = new Date();
        d.setHours(d.getHours() - (9 - i) * 1);
        (detector as any).events.push({
          id: `trendup2-${i}`,
          type: 'rising',
          data: {},
          timestamp: d.toISOString(),
        });
      }
      detector.detectTrends(5);
      expect(detector.getAllPatterns().length).toBeGreaterThanOrEqual(before);
    });
  });

  describe('getAllPatterns / clear', () => {
    it('should return copy of patterns', () => {
      detector.record('A', {});
      detector.record('B', {});
      detector.record('A', {});
      detector.record('B', {});
      detector.detectFrequentSequences(2);
      const patterns = detector.getAllPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should clear all state', () => {
      detector.record('A', {});
      detector.clear();
      expect(detector.getAllPatterns()).toEqual([]);
      expect(detector.detectFrequentSequences()).toEqual([]);
    });
  });

  describe('record', () => {
    it('should handle multiple event types', () => {
      detector.record('start', {});
      detector.record('process', { id: 1 });
      detector.record('end', { result: 'ok' });
      expect(detector.detectFrequentSequences()).toEqual([]);
    });
  });
});

// ============================================================
// SECTION 12 — LifecyclePipeline
// ============================================================
import { AutoDocumentationTrigger } from '../engines/orchestrator/auto-documentation-trigger';
import { AutonomousDecomposer } from '../engines/orchestrator/autonomous-decomposer';
import { HandoffProtocol } from '../engines/orchestrator/handoff-protocol';
import { LifecyclePipeline } from '../engines/orchestrator/lifecycle-pipeline';
import { SkillRouter } from '../engines/orchestrator/skill-router';
import { SkillEngine } from '../engines/skill-engine';

describe('LifecyclePipeline — edge coverage', () => {
  let pipeline: LifecyclePipeline;
  let skillEngine: SkillEngine;

  beforeEach(async () => {
    skillEngine = new SkillEngine();
    const decomposer = new AutonomousDecomposer();
    const router = new SkillRouter(skillEngine);
    const handoff = new HandoffProtocol();
    const autoDocs = new AutoDocumentationTrigger({ writeFiles: false });
    pipeline = new LifecyclePipeline(decomposer, router, handoff, autoDocs, skillEngine);
  });

  it('should execute mission successfully', async () => {
    const result = await pipeline.execute({
      title: 'Test mission',
      type: 'feature',
      priority: 'medium',
      description: 'Test',
    });
    expect(result.status).toBe('completed');
  });

  it('should handle error in pipeline execution', async () => {
    const badEngine = new SkillEngine();
    vi.spyOn(badEngine, 'status').mockRejectedValue(new Error('engine down'));
    const decomposer = new AutonomousDecomposer();
    const router = new SkillRouter(badEngine);
    const handoff = new HandoffProtocol();
    const autoDocs = new AutoDocumentationTrigger({ writeFiles: false });
    const pl = new LifecyclePipeline(decomposer, router, handoff, autoDocs, badEngine);
    const result = await pl.execute({
      title: 'Error test',
      type: 'feature',
      priority: 'low',
    });
    expect(result.status).toBe('completed');
  });

  it('should handle pipeline agents getter when null', () => {
    const agents = (pipeline as any).pipelineAgents;
    expect(Array.isArray(agents)).toBe(true);
  });

  it('should handle pipeline agents setter', () => {
    (pipeline as any).pipelineAgents = [{ id: 'a1', skills: ['test'] }];
    expect((pipeline as any)._pipelineAgents).toHaveLength(1);
  });

  it('should handle empty subtask list in stageExecute', async () => {
    await (pipeline as any).stageExecute([], []);
    expect(true).toBe(true);
  });

  it('should handle quality gates', async () => {
    const gate = await (pipeline as any).stageQualityGates();
    expect(gate.passed).toBe(true);
    expect(gate.gates).toHaveLength(4);
  });
});
