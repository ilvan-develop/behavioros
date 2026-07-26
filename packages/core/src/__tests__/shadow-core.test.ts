import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertManager } from '../shadow/alert-manager';
import type { DiffResult } from '../shadow/diff-analyzer';
import type { ShadowHandler } from '../shadow/shadow-pipeline';
import { ShadowPipeline } from '../shadow/shadow-pipeline';
import type { CapturedTraffic } from '../shadow/traffic-capture';
import type { ReplayResult, ReplayStats } from '../shadow/traffic-replay';

// ── Helpers ──────────────────────────────────────────────────────────

function makeDiffResult(overrides: Partial<DiffResult> = {}): DiffResult {
  return {
    id: 'diff-1',
    captureId: 'cap-1',
    replayId: 'rep-1',
    timestamp: new Date().toISOString(),
    findings: [],
    driftScore: 0,
    overallSeverity: 'info',
    statusCodeMatch: true,
    latencyRatio: 1,
    regressions: false,
    ...overrides,
  };
}

function _makeCapturedTraffic(overrides: Partial<CapturedTraffic> = {}): CapturedTraffic {
  return {
    id: 'cap-1',
    timestamp: new Date().toISOString(),
    latencyMs: 100,
    method: 'GET',
    path: '/api/test',
    request: { key: 'value' },
    response: { result: 'ok' },
    statusCode: 200,
    sampling: { strategy: 'head', sampleRate: 1, selected: true, bucket: 5000 },
    tags: {},
    ...overrides,
  };
}

function _makeReplayResult(overrides: Partial<ReplayResult> = {}): ReplayResult {
  return {
    id: 'rep-1',
    captureId: 'cap-1',
    timestamp: new Date().toISOString(),
    shadowResponse: { result: 'ok' },
    shadowStatusCode: 200,
    shadowLatencyMs: 50,
    success: true,
    ...overrides,
  };
}

function _makeReplayStats(overrides: Partial<ReplayStats> = {}): ReplayStats {
  return {
    total: 1,
    succeeded: 1,
    failed: 0,
    avgLatencyMs: 50,
    p50LatencyMs: 45,
    p95LatencyMs: 100,
    p99LatencyMs: 150,
    totalDurationMs: 50,
    ...overrides,
  };
}

// ── AlertManager Tests ──────────────────────────────────────────────

describe('AlertManager', () => {
  describe('lifecycle', () => {
    it('should create default rules on construction', () => {
      const am = new AlertManager();
      const rules = am.getRules();
      expect(rules).toHaveLength(4);
      expect(rules.map((r) => r.id)).toEqual([
        'rule-regression',
        'rule-drift-threshold',
        'rule-error-introduced',
        'rule-critical',
      ]);
    });

    it('should evaluate a diff result and fire matching alerts', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const fired = am.evaluate(result);
      expect(fired.length).toBeGreaterThanOrEqual(1);
      expect(fired[0].status).toBe('active');
      expect(fired[0].driftScore).toBe(50);
    });

    it('should not fire alerts for low drift scores', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 5, overallSeverity: 'low' });
      const fired = am.evaluate(result);
      expect(fired).toHaveLength(0);
    });

    it('should not fire alerts when rule is disabled', () => {
      const am = new AlertManager();
      const rules = am.getRules();
      for (const rule of rules) {
        am.upsertRule({ ...rule, enabled: false });
      }
      const result = makeDiffResult({
        driftScore: 80,
        overallSeverity: 'critical',
        regressions: true,
      });
      const fired = am.evaluate(result);
      expect(fired).toHaveLength(0);
    });

    it('should respect cooldown and not fire duplicate alerts', () => {
      const am = new AlertManager({ defaultCooldownMs: 100000 });
      const result = makeDiffResult({
        driftScore: 20,
        overallSeverity: 'medium',
        regressions: true,
      });
      const first = am.evaluate(result);
      expect(first).toHaveLength(1);
      const second = am.evaluate(result);
      expect(second).toHaveLength(0);
    });

    it('should fire after cooldown expires', async () => {
      const am = new AlertManager({ defaultCooldownMs: 1 });
      const result = makeDiffResult({
        driftScore: 20,
        overallSeverity: 'medium',
        regressions: true,
      });
      expect(am.evaluate(result)).toHaveLength(1);
      await new Promise((r) => setTimeout(r, 5));
      expect(am.evaluate(result)).toHaveLength(1);
    });

    it('should not create alert when maxActiveAlerts is exceeded', () => {
      const am = new AlertManager({ maxActiveAlerts: 1 });
      const r1 = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const r2 = makeDiffResult({ driftScore: 60, overallSeverity: 'critical', regressions: true });
      expect(am.evaluate(r1)).toHaveLength(1);
      expect(am.evaluate(r2)).toHaveLength(0);
    });

    it('should evaluate batch of diff results', () => {
      const am = new AlertManager();
      const results = [
        makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true }),
        makeDiffResult({ driftScore: 5, overallSeverity: 'low' }),
        makeDiffResult({ driftScore: 80, overallSeverity: 'critical', regressions: true }),
      ];
      const fired = am.evaluateBatch(results);
      expect(fired.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge an active alert', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const [alert] = am.evaluate(result);
      const ack = am.acknowledge(alert.id);
      expect(ack).not.toBeNull();
      expect(ack!.status).toBe('acknowledged');
      expect(ack!.acknowledgedAt).toBeDefined();
    });

    it('should return null when acknowledging non-active alert', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const [alert] = am.evaluate(result);
      am.acknowledge(alert.id);
      const secondAck = am.acknowledge(alert.id);
      expect(secondAck).toBeNull();
    });

    it('should return null for unknown alert ID', () => {
      const am = new AlertManager();
      expect(am.acknowledge('nonexistent')).toBeNull();
    });
  });

  describe('resolve', () => {
    it('should resolve an active alert', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const [alert] = am.evaluate(result);
      const resolved = am.resolve(alert.id);
      expect(resolved).not.toBeNull();
      expect(resolved!.status).toBe('resolved');
      expect(resolved!.resolvedAt).toBeDefined();
    });

    it('should return null when resolving already resolved alert', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const [alert] = am.evaluate(result);
      am.resolve(alert.id);
      expect(am.resolve(alert.id)).toBeNull();
    });

    it('should return null when resolving suppressed alert', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const [alert] = am.evaluate(result);
      am.suppress(alert.id);
      expect(am.resolve(alert.id)).toBeNull();
    });

    it('should return null for unknown alert ID on resolve', () => {
      const am = new AlertManager();
      expect(am.resolve('nonexistent')).toBeNull();
    });
  });

  describe('suppress', () => {
    it('should suppress an active alert', () => {
      const am = new AlertManager();
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const [alert] = am.evaluate(result);
      const suppressed = am.suppress(alert.id);
      expect(suppressed).not.toBeNull();
      expect(suppressed!.status).toBe('suppressed');
    });

    it('should return null when suppressing unknown alert', () => {
      const am = new AlertManager();
      expect(am.suppress('nonexistent')).toBeNull();
    });
  });

  describe('query', () => {
    it('should get alerts filtered by status', () => {
      const am = new AlertManager();
      const r1 = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      const r2 = makeDiffResult({ driftScore: 80, overallSeverity: 'critical', regressions: true });
      const [a1] = am.evaluate(r1);
      am.evaluate(r2);
      am.acknowledge(a1.id);
      const active = am.getAlerts('active');
      const acknowledged = am.getAlerts('acknowledged');
      expect(active).toHaveLength(1);
      expect(acknowledged).toHaveLength(1);
    });

    it('should return all alerts when no status filter', () => {
      const am = new AlertManager();
      am.evaluate(makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true }));
      am.evaluate(
        makeDiffResult({ driftScore: 80, overallSeverity: 'critical', regressions: true }),
      );
      expect(am.getAlerts()).toHaveLength(2);
    });

    it('should return active counts by severity', () => {
      const am = new AlertManager();
      am.upsertRule({
        id: 'test-severity',
        name: 'Severity Test',
        type: 'regression',
        minSeverity: 'info',
        minDriftScore: 0,
        cooldownMs: 0,
        channels: ['log'],
        enabled: true,
      });
      am.evaluate(makeDiffResult({ driftScore: 5, overallSeverity: 'high', regressions: true }));
      am.evaluate(
        makeDiffResult({ driftScore: 5, overallSeverity: 'critical', regressions: true }),
      );
      const counts = am.getActiveCounts();
      expect(counts.high).toBe(1);
      expect(counts.critical).toBe(1);
      expect(counts.info).toBe(0);
    });

    it('should auto-resolve stale alerts', () => {
      const am = new AlertManager({ autoResolveAfterMs: -1 });
      const result = makeDiffResult({ driftScore: 20, overallSeverity: 'high', regressions: true });
      am.evaluate(result);
      const resolved = am.autoResolveStale();
      expect(resolved).toHaveLength(1);
      expect(resolved[0].status).toBe('resolved');
    });

    it('should not auto-resolve recent alerts', () => {
      const am = new AlertManager({ autoResolveAfterMs: 86400000 });
      const result = makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true });
      am.evaluate(result);
      const resolved = am.autoResolveStale();
      expect(resolved).toHaveLength(0);
    });
  });

  describe('rules', () => {
    it('should upsert a new rule', () => {
      const am = new AlertManager();
      am.upsertRule({
        id: 'custom-rule',
        name: 'Custom Rule',
        type: 'latency-regression',
        minSeverity: 'low',
        minDriftScore: 5,
        cooldownMs: 1000,
        channels: ['log', 'slack'],
        enabled: true,
      });
      const rules = am.getRules();
      expect(rules).toHaveLength(5);
      expect(rules.find((r) => r.id === 'custom-rule')!.channels).toEqual(['log', 'slack']);
    });

    it('should update an existing rule on upsert', () => {
      const am = new AlertManager();
      am.upsertRule({
        id: 'rule-regression',
        name: 'Updated Regression Rule',
        type: 'regression',
        minSeverity: 'low',
        minDriftScore: 5,
        cooldownMs: 1000,
        channels: ['slack'],
        enabled: false,
      });
      const rule = am.getRules().find((r) => r.id === 'rule-regression')!;
      expect(rule.name).toBe('Updated Regression Rule');
      expect(rule.enabled).toBe(false);
    });

    it('should remove a rule', () => {
      const am = new AlertManager();
      expect(am.removeRule('rule-regression')).toBe(true);
      expect(am.getRules()).toHaveLength(3);
    });

    it('should return false when removing nonexistent rule', () => {
      const am = new AlertManager();
      expect(am.removeRule('nonexistent')).toBe(false);
    });
  });

  describe('config', () => {
    it('should use default config when no config provided', () => {
      const am = new AlertManager();
      const config = am.getConfig();
      expect(config.maxActiveAlerts).toBe(100);
      expect(config.defaultCooldownMs).toBe(300000);
      expect(config.autoResolveAfterMs).toBe(86400000);
    });

    it('should merge custom config with defaults', () => {
      const am = new AlertManager({ maxActiveAlerts: 10, defaultCooldownMs: 5000 });
      const config = am.getConfig();
      expect(config.maxActiveAlerts).toBe(10);
      expect(config.defaultCooldownMs).toBe(5000);
      expect(config.autoResolveAfterMs).toBe(86400000);
    });

    it('should clear all alerts', () => {
      const am = new AlertManager();
      am.evaluate(makeDiffResult({ driftScore: 50, overallSeverity: 'high', regressions: true }));
      am.evaluate(
        makeDiffResult({ driftScore: 80, overallSeverity: 'critical', regressions: true }),
      );
      expect(am.getAlerts()).toHaveLength(2);
      am.clearAlerts();
      expect(am.getAlerts()).toHaveLength(0);
    });
  });

  describe('type-specific rules', () => {
    it('should fire on status-code-mismatch', () => {
      const am = new AlertManager();
      am.upsertRule({
        id: 'rule-status-code',
        name: 'Status Code Mismatch',
        type: 'status-code-mismatch',
        minSeverity: 'low',
        minDriftScore: 0,
        cooldownMs: 1000,
        channels: ['log'],
        enabled: true,
      });
      const result = makeDiffResult({
        statusCodeMatch: false,
        driftScore: 5,
        overallSeverity: 'low',
      });
      const fired = am.evaluate(result);
      expect(fired).toHaveLength(1);
      expect(fired[0].type).toBe('status-code-mismatch');
    });

    it('should fire on latency-regression rule', () => {
      const am = new AlertManager();
      am.upsertRule({
        id: 'rule-latency',
        name: 'Latency Regression',
        type: 'latency-regression',
        minSeverity: 'low',
        minDriftScore: 0,
        cooldownMs: 1000,
        channels: ['log'],
        enabled: true,
      });
      const result = makeDiffResult({ latencyRatio: 2.5, driftScore: 5, overallSeverity: 'low' });
      const fired = am.evaluate(result);
      expect(fired).toHaveLength(1);
      expect(fired[0].type).toBe('latency-regression');
    });

    it('should fire on schema-break rule', () => {
      const am = new AlertManager();
      am.upsertRule({
        id: 'rule-schema',
        name: 'Schema Break',
        type: 'schema-break',
        minSeverity: 'low',
        minDriftScore: 0,
        cooldownMs: 1000,
        channels: ['log'],
        enabled: true,
      });
      const result = makeDiffResult({
        driftScore: 5,
        overallSeverity: 'low',
        findings: [
          {
            id: 'f1',
            category: 'schema-change',
            severity: 'high',
            description: 'schema changed',
            path: '/',
            original: { a: 1 },
            shadow: { b: 2 },
          },
        ],
      });
      const fired = am.evaluate(result);
      expect(fired).toHaveLength(1);
      expect(fired[0].type).toBe('schema-break');
    });

    it('should fire on compliance-violation rule', () => {
      const am = new AlertManager();
      const result = makeDiffResult({
        driftScore: 5,
        overallSeverity: 'critical',
        findings: [
          {
            id: 'f1',
            category: 'behavioral-shift',
            severity: 'critical',
            description: 'critical finding',
            path: '/',
          },
        ],
      });
      const fired = am.evaluate(result);
      expect(fired).toHaveLength(1);
      expect(fired[0].type).toBe('compliance-violation');
    });
  });
});

// ── ShadowPipeline Tests ────────────────────────────────────────────

describe('ShadowPipeline', () => {
  let pipeline: ShadowPipeline;

  beforeEach(() => {
    pipeline = new ShadowPipeline({
      projectName: 'test-project',
      dnaVersion: '1.0.0',
      baselineVersion: '0.9.0',
      capture: { sampleRate: 1, strategy: 'head' },
    });
  });

  describe('initialization', () => {
    it('should start with idle status', () => {
      expect(pipeline.getStatus()).toBe('idle');
    });

    it('should expose sub-components', () => {
      expect(pipeline.getCapture()).toBeDefined();
      expect(pipeline.getReplay()).toBeDefined();
      expect(pipeline.getAnalyzer()).toBeDefined();
      expect(pipeline.getAlertManager()).toBeDefined();
      expect(pipeline.getReportGenerator()).toBeDefined();
      expect(pipeline.getComplianceGenerator()).toBeDefined();
    });

    it('should return config', () => {
      const config = pipeline.getConfig();
      expect(config.projectName).toBe('test-project');
      expect(config.dnaVersion).toBe('1.0.0');
      expect(config.baselineVersion).toBe('0.9.0');
    });
  });

  describe('capture middleware', () => {
    it('should create capture middleware and set status to capturing', () => {
      const middleware = pipeline.createCaptureMiddleware();
      expect(pipeline.getStatus()).toBe('capturing');
      expect(middleware.capture).toBeInstanceOf(Function);
      expect(middleware.getCaptures).toBeInstanceOf(Function);
      expect(middleware.getStats).toBeInstanceOf(Function);
    });

    it('should capture traffic through middleware', () => {
      const middleware = pipeline.createCaptureMiddleware();
      const entry = middleware.capture({
        method: 'POST',
        path: '/api/test',
        request: { data: 'hello' },
        response: { result: 'world' },
        statusCode: 200,
        latencyMs: 50,
      });
      expect(entry).not.toBeNull();
      expect(middleware.getCaptures()).toHaveLength(1);
    });

    it('should return stats from middleware', () => {
      const middleware = pipeline.createCaptureMiddleware();
      middleware.capture({
        method: 'GET',
        path: '/api/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 30,
      });
      const stats = middleware.getStats();
      expect(stats.totalCaptured).toBe(1);
    });
  });

  describe('execute', () => {
    it('should execute full pipeline and return completed result', async () => {
      const captures: CapturedTraffic[] = [
        {
          id: 'cap-1',
          timestamp: new Date().toISOString(),
          latencyMs: 100,
          method: 'GET',
          path: '/api/users',
          request: {},
          response: { users: [] },
          statusCode: 200,
          sampling: { strategy: 'head', sampleRate: 1, selected: true, bucket: 5000 },
          tags: {},
        },
      ];

      const handler: ShadowHandler = async () => ({
        response: { users: [] },
        statusCode: 200,
      });

      const result = await pipeline.execute(captures, handler);
      expect(result.status).toBe('completed');
      expect(result.id).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.capturedCount).toBe(1);
      expect(result.replayStats).not.toBeNull();
      expect(result.diffSummary).not.toBeNull();
      expect(result.shadowReport).not.toBeNull();
      expect(result.complianceReport).not.toBeNull();
    });

    it('should handle handler errors gracefully', async () => {
      const captures: CapturedTraffic[] = [
        {
          id: 'cap-err',
          timestamp: new Date().toISOString(),
          latencyMs: 50,
          method: 'GET',
          path: '/api/error',
          request: {},
          response: { ok: true },
          statusCode: 200,
          sampling: { strategy: 'head', sampleRate: 1, selected: true, bucket: 5000 },
          tags: {},
        },
      ];

      const handler: ShadowHandler = async () => {
        throw new Error('handler crashed');
      };

      const result = await pipeline.execute(captures, handler);
      expect(result.status).toBe('completed');
      expect(result.replayStats).not.toBeNull();
      expect(result.replayStats!.failed).toBe(1);
    });

    it('should set status to failed on unexpected error', async () => {
      const p = new ShadowPipeline({ projectName: 'fail-test', dnaVersion: '1.0.0' });
      vi.spyOn(p.getAnalyzer(), 'analyzeBatch').mockImplementation(() => {
        throw new Error('unexpected analyzer failure');
      });

      const captures: CapturedTraffic[] = [
        {
          id: 'cap-1',
          timestamp: new Date().toISOString(),
          latencyMs: 50,
          method: 'GET',
          path: '/api/test',
          request: {},
          response: { ok: true },
          statusCode: 200,
          sampling: { strategy: 'head', sampleRate: 1, selected: true, bucket: 5000 },
          tags: {},
        },
      ];

      const handler: ShadowHandler = async () => ({ response: {}, statusCode: 200 });
      const result = await p.execute(captures, handler);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('unexpected analyzer failure');
    });

    it('should store result in history', async () => {
      const captures: CapturedTraffic[] = [
        {
          id: 'cap-1',
          timestamp: new Date().toISOString(),
          latencyMs: 100,
          method: 'GET',
          path: '/api/test',
          request: {},
          response: { data: 'ok' },
          statusCode: 200,
          sampling: { strategy: 'head', sampleRate: 1, selected: true, bucket: 5000 },
          tags: {},
        },
      ];
      const handler: ShadowHandler = async () => ({ response: { data: 'ok' }, statusCode: 200 });
      await pipeline.execute(captures, handler);
      expect(pipeline.getHistory()).toHaveLength(1);
      expect(pipeline.getLastResult()).toBeDefined();
      expect(pipeline.getLastResult()!.id).toBeDefined();
    });

    it('should call onStatusChange callback', async () => {
      const statuses: string[] = [];
      const pip = new ShadowPipeline({
        projectName: 'cb-test',
        dnaVersion: '1.0.0',
        onStatusChange: (s) => statuses.push(s),
      });
      const captures: CapturedTraffic[] = [
        {
          id: 'cap-1',
          timestamp: new Date().toISOString(),
          latencyMs: 50,
          method: 'GET',
          path: '/api/test',
          request: {},
          response: { ok: true },
          statusCode: 200,
          sampling: { strategy: 'head', sampleRate: 1, selected: true, bucket: 5000 },
          tags: {},
        },
      ];
      const handler: ShadowHandler = async () => ({ response: { ok: true }, statusCode: 200 });
      await pip.execute(captures, handler);
      expect(statuses).toContain('replaying');
      expect(statuses).toContain('analyzing');
      expect(statuses).toContain('reporting');
      expect(statuses).toContain('completed');
    });
  });

  describe('status', () => {
    it('should return idle initially', () => {
      const p = new ShadowPipeline({ projectName: 'p', dnaVersion: '1' });
      expect(p.getStatus()).toBe('idle');
    });

    it('should return capturing after createCaptureMiddleware', () => {
      const p = new ShadowPipeline({ projectName: 'p', dnaVersion: '1' });
      p.createCaptureMiddleware();
      expect(p.getStatus()).toBe('capturing');
    });
  });

  describe('history', () => {
    it('should return empty history initially', () => {
      const p = new ShadowPipeline({ projectName: 'p', dnaVersion: '1' });
      expect(p.getHistory()).toEqual([]);
      expect(p.getLastResult()).toBeUndefined();
    });
  });

  describe('config', () => {
    it('should use defaults for missing config fields', () => {
      const p = new ShadowPipeline({ projectName: 'minimal', dnaVersion: '1' });
      const config = p.getConfig();
      expect(config.generateCompliance).toBe(true);
      expect(config.capture).toEqual({});
    });
  });
});
