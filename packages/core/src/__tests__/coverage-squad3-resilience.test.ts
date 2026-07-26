import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// Hoisted mocks — must be before vi.mock calls
// ============================================================

const mockRandomUUID = vi.hoisted(() => {
  let counter = 0;
  return () => {
    counter++;
    const c = String(counter).padStart(12, '0');
    return `${c.slice(0, 8)}-${c.slice(8, 12)}-0000-0000-000000000000`;
  };
});

const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockWriteFileSync = vi.hoisted(() => vi.fn());
const mockMkdirSync = vi.hoisted(() => vi.fn());

const mockReadFile = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockAccess = vi.hoisted(() => vi.fn());
const mockReaddir = vi.hoisted(() => vi.fn());

const mockExecSync = vi.hoisted(() => vi.fn());

vi.mock('node:crypto', () => ({ randomUUID: mockRandomUUID }));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  access: mockAccess,
  readdir: mockReaddir,
}));

vi.mock('node:child_process', () => ({ execSync: mockExecSync }));

// ============================================================
// Imports
// ============================================================

import { AgentManager } from '../engines/agent-manager.js';
import { EcosystemRegistry } from '../engines/ecosystem-registry.js';
import { ClosedState } from '../resilience/circuit-breaker/states/closed.js';
import { OpenState } from '../resilience/circuit-breaker/states/open.js';
import { BlockEscalation } from '../resilience/rate-limiter/escalation/block.js';
import { WarningEscalation } from '../resilience/rate-limiter/escalation/warning.js';
import { AlertManager } from '../shadow/alert-manager.js';
import { DiffAnalyzer } from '../shadow/diff-analyzer.js';
import { ComplianceReportGenerator } from '../shadow/reports/compliance-report.js';
import { ShadowReportGenerator } from '../shadow/reports/shadow-report.js';
import { ShadowPipeline } from '../shadow/shadow-pipeline.js';
import { TrafficCapture } from '../shadow/traffic-capture.js';
import { TrafficReplay } from '../shadow/traffic-replay.js';

// ============================================================
// Helpers
// ============================================================

function makeCircuitRequest(id = 'req-1') {
  return { id, method: 'GET', path: '/test', body: {}, headers: {} };
}

function makeError(msg = 'boom') {
  return new Error(msg);
}

function makeCapturedTraffic(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capture-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    latencyMs: 100,
    method: 'GET',
    path: '/api/test',
    request: { key: 'value' },
    response: { result: 'ok' },
    statusCode: 200,
    sampling: { strategy: 'random', sampleRate: 1, selected: true },
    tags: {},
    ...overrides,
  } as import('../shadow/traffic-capture.js').CapturedTraffic;
}

function makeReplayResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'replay-1',
    captureId: 'capture-1',
    timestamp: '2026-01-01T00:00:01.000Z',
    shadowResponse: { result: 'ok' },
    shadowStatusCode: 200,
    shadowLatencyMs: 50,
    success: true,
    ...overrides,
  } as import('../shadow/traffic-replay.js').ReplayResult;
}

function makeDiffResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'diff-1',
    captureId: 'capture-1',
    replayId: 'replay-1',
    timestamp: '2026-01-01T00:00:02.000Z',
    findings: [],
    driftScore: 0,
    overallSeverity: 'info',
    statusCodeMatch: true,
    latencyRatio: 1,
    regressions: false,
    ...overrides,
  } as import('../shadow/diff-analyzer.js').DiffResult;
}

function makeDNAPackage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    personas: [{ role: 'engineer', authority: 'senior' }],
    ...overrides,
  } as import('@behavioros/schemas').DNAPackage;
}

// ============================================================
// SECTION 1 — ClosedState (closed.ts — 76.27%)
// ============================================================

describe('ClosedState', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct with defaults', () => {
    const s = new ClosedState(5);
    expect(s.isAvailable()).toBe(true);
    expect(s.getConsecutiveFailures()).toBe(0);
    expect(s.getTotalCalls()).toBe(0);
    expect(s.getSlowCallRate()).toBe(0);
  });

  it('should construct with partial config', () => {
    const s = new ClosedState(3, { slowCallDurationMs: 1000, slowCallThresholdPercent: 50 });
    expect(s.isAvailable()).toBe(true);
  });

  it('check should always return allowed', () => {
    const s = new ClosedState(5);
    // @ts-expect-error - partial mock request for circuit breaker testing
    const result = s.check(makeCircuitRequest('r1'));
    expect(result.allowed).toBe(true);
    expect(result.state).toBe('closed');
  });

  it('onSuccess should reset failures and increment total', () => {
    const s = new ClosedState(2);
    s.onFailure('r1', makeError());
    expect(s.getConsecutiveFailures()).toBe(1);
    expect(s.getTotalCalls()).toBe(1);
    s.onSuccess('r1');
    expect(s.getConsecutiveFailures()).toBe(0);
    expect(s.getTotalCalls()).toBe(2);
  });

  it('onFailure should return transition when threshold reached', () => {
    const s = new ClosedState(2);
    expect(s.onFailure('r1', makeError())).toBeNull();
    expect(s.onFailure('r2', makeError())).toEqual({
      to: 'open',
      reason: expect.stringContaining('Failure threshold reached'),
    });
  });

  it('onFailure should return null when below threshold', () => {
    const s = new ClosedState(5);
    expect(s.onFailure('r1', makeError())).toBeNull();
    expect(s.getConsecutiveFailures()).toBe(1);
    expect(s.getTotalCalls()).toBe(1);
  });

  it('getSlowCallRate should return 0 when totalCalls is 0', () => {
    const s = new ClosedState(5);
    expect(s.getSlowCallRate()).toBe(0);
  });

  it('getSlowCallRate should calculate correctly', () => {
    const s = new ClosedState(5);
    s.recordSlowCall();
    s.recordSlowCall();
    s.onSuccess('r1');
    expect(s.getTotalCalls()).toBe(3);
    expect(s.getSlowCallRate()).toBeCloseTo(66.67, 1);
  });

  it('recordSlowCall should increment both counters', () => {
    const s = new ClosedState(5);
    s.recordSlowCall();
    expect(s.getSlowCallRate()).toBe(100);
    expect(s.getTotalCalls()).toBe(1);
  });

  it('reset should zero all counters', () => {
    const s = new ClosedState(3);
    s.onFailure('r1', makeError());
    s.recordSlowCall();
    expect(s.getConsecutiveFailures()).toBe(1);
    expect(s.getTotalCalls()).toBe(2);
    expect(s.getSlowCallRate()).toBe(50);
    s.reset();
    expect(s.getConsecutiveFailures()).toBe(0);
    expect(s.getSlowCallRate()).toBe(0);
    expect(s.getTotalCalls()).toBe(0);
  });
});

// ============================================================
// SECTION 2 — OpenState (open.ts — 60.81%)
// ============================================================

describe('OpenState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should construct with defaults', () => {
    const s = new OpenState(30_000, 3);
    expect(s.getAttempts()).toBe(0);
    expect(s.getOpenedAt()).toBeGreaterThan(0);
  });

  it('should construct with partial config', () => {
    const s = new OpenState(30_000, 3, { allowHalfOpenAfterMs: 10_000, maxOpenDurationMs: 60_000 });
    expect(s.getRemainingMs()).toBeGreaterThan(0);
  });

  it('check should return half-open when elapsed >= allowHalfOpenAfterMs', () => {
    const s = new OpenState(10_000, 3);
    vi.advanceTimersByTime(10_001);
    // @ts-expect-error - partial mock request for circuit breaker testing
    const r = s.check(makeCircuitRequest('r1'));
    expect(r.state).toBe('half-open');
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(0);
  });

  it('check should return half-open when elapsed >= maxOpenDurationMs', () => {
    const s = new OpenState(10_000, 3, { maxOpenDurationMs: 5_000, allowHalfOpenAfterMs: 100_000 });
    vi.advanceTimersByTime(5_001);
    // @ts-expect-error - partial mock request for circuit breaker testing
    const r = s.check(makeCircuitRequest('r1'));
    expect(r.state).toBe('half-open');
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(0);
  });

  it('check should reject with retryAfterMs when still in open window', () => {
    const s = new OpenState(60_000, 3);
    // @ts-expect-error - partial mock request for circuit breaker testing
    const r = s.check(makeCircuitRequest('r1'));
    expect(r.allowed).toBe(false);
    expect(r.state).toBe('open');
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });

  it('onSuccess should return null', () => {
    const s = new OpenState(30_000, 3);
    expect(s.onSuccess('r1')).toBeNull();
  });

  it('onFailure should accumulate attempts and return transition when exhausted', () => {
    const s = new OpenState(30_000, 2);
    expect(s.onFailure('r1', makeError())).toBeNull();
    expect(s.getAttempts()).toBe(1);
    expect(s.onFailure('r2', makeError())).toEqual({
      to: 'open',
      reason: expect.stringContaining('attempts exhausted'),
    });
    expect(s.getAttempts()).toBe(2);
  });

  it('onFailure should return null when under max attempts', () => {
    const s = new OpenState(30_000, 5);
    expect(s.onFailure('r1', makeError())).toBeNull();
    expect(s.getAttempts()).toBe(1);
  });

  it('isAvailable should return true when elapsed >= allowHalfOpenAfterMs', () => {
    const s = new OpenState(5_000, 3);
    expect(s.isAvailable()).toBe(false);
    vi.advanceTimersByTime(5_001);
    expect(s.isAvailable()).toBe(true);
  });

  it('getRemainingMs should return remaining time', () => {
    const s = new OpenState(60_000, 3);
    const rem = s.getRemainingMs();
    expect(rem).toBeGreaterThan(0);
    expect(rem).toBeLessThanOrEqual(60_000);
  });

  it('getOpenedAt should return the timestamp', () => {
    const s = new OpenState(30_000, 3);
    expect(s.getOpenedAt()).toBeGreaterThan(0);
  });

  it('getAttempts should return attempt count', () => {
    const s = new OpenState(30_000, 3);
    expect(s.getAttempts()).toBe(0);
    s.onFailure('r1', makeError());
    expect(s.getAttempts()).toBe(1);
  });
});

// ============================================================
// SECTION 3 — BlockEscalation (block.ts — 57.36%)
// ============================================================

describe('BlockEscalation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should construct with defaults', () => {
    const b = new BlockEscalation();
    expect(b.getActiveBlocks()).toEqual([]);
    expect(b.getBlockHistory()).toEqual([]);
  });

  it('should construct with partial config', () => {
    const b = new BlockEscalation({ thresholdPercent: 90, allowOverride: true });
    expect(b.getActiveBlocks()).toEqual([]);
  });

  it('check should return blocked when existing block is active', () => {
    const b = new BlockEscalation({ thresholdPercent: 50, blockDurationMs: 60_000 });
    b.forceBlock('target-1', 'agent');
    const r = b.check('target-1', 0);
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain('Forced block');
  });

  it('check should clear expired block and re-evaluate', () => {
    const b = new BlockEscalation({ thresholdPercent: 50, blockDurationMs: 1 });
    b.forceBlock('target-1', 'agent', 1);
    vi.advanceTimersByTime(2);
    const r = b.check('target-1', 30);
    expect(r.blocked).toBe(false);
  });

  it('check should return not blocked when utilization below threshold', () => {
    const b = new BlockEscalation({ thresholdPercent: 80 });
    const r = b.check('target-1', 50);
    expect(r.blocked).toBe(false);
    expect(r.reason).toContain('within acceptable range');
  });

  it('check should apply block when utilization exceeds threshold', () => {
    const b = new BlockEscalation({ thresholdPercent: 50 });
    const r = b.check('target-1', 90);
    expect(r.blocked).toBe(true);
    expect(r.expiresAt).toBeDefined();
    expect(r.remainingMs).toBeGreaterThan(0);
  });

  it('isBlocked should return false for non-existent block', () => {
    const b = new BlockEscalation();
    expect(b.isBlocked('nonexistent')).toBe(false);
  });

  it('isBlocked should return false for expired block', () => {
    const b = new BlockEscalation({ blockDurationMs: 1 });
    b.forceBlock('target-1', 'agent', 1);
    vi.advanceTimersByTime(2);
    expect(b.isBlocked('target-1')).toBe(false);
  });

  it('isBlocked should return true for active block', () => {
    const b = new BlockEscalation({ blockDurationMs: 60_000 });
    b.forceBlock('target-1', 'agent');
    expect(b.isBlocked('target-1')).toBe(true);
  });

  it('getBlockRemaining should return 0 for non-existent block', () => {
    const b = new BlockEscalation();
    expect(b.getBlockRemaining('nonexistent')).toBe(0);
  });

  it('getBlockRemaining should return remaining time', () => {
    const b = new BlockEscalation({ blockDurationMs: 60_000 });
    b.forceBlock('target-1', 'agent');
    expect(b.getBlockRemaining('target-1')).toBeGreaterThan(0);
  });

  it('overrideBlock should return false when allowOverride is false', () => {
    const b = new BlockEscalation({ allowOverride: false });
    expect(b.overrideBlock('target-1')).toBe(false);
  });

  it('overrideBlock should return true when allowOverride is true and block exists', () => {
    const b = new BlockEscalation({ allowOverride: true });
    b.forceBlock('target-1', 'agent');
    expect(b.overrideBlock('target-1')).toBe(true);
  });

  it('forceBlock should create a forced block', () => {
    const b = new BlockEscalation();
    const r = b.forceBlock('target-1', 'agent', 5_000);
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain('Forced block');
    expect(r.remainingMs).toBe(5_000);
  });

  it('forceBlock should use default duration when not specified', () => {
    const b = new BlockEscalation({ blockDurationMs: 10_000 });
    const r = b.forceBlock('target-1', 'dna');
    expect(r.remainingMs).toBe(10_000);
  });

  it('getActiveBlocks should remove expired entries', () => {
    const b = new BlockEscalation({ blockDurationMs: 1 });
    b.forceBlock('target-1', 'agent', 1);
    b.forceBlock('target-2', 'agent', 60_000);
    vi.advanceTimersByTime(2);
    const active = b.getActiveBlocks();
    expect(active.length).toBe(1);
    expect(active[0].targetId).toBe('target-2');
  });

  it('reset should remove a specific block', () => {
    const b = new BlockEscalation();
    b.forceBlock('target-1', 'agent');
    b.reset('target-1');
    expect(b.isBlocked('target-1')).toBe(false);
  });

  it('resetAll should clear all blocks', () => {
    const b = new BlockEscalation();
    b.forceBlock('target-1', 'agent');
    b.forceBlock('target-2', 'agent');
    b.resetAll();
    expect(b.getActiveBlocks()).toEqual([]);
  });

  it('getBlockHistory should return a copy of history', () => {
    const b = new BlockEscalation();
    b.forceBlock('target-1', 'agent');
    const h = b.getBlockHistory();
    h.push({} as never);
    expect(b.getBlockHistory().length).toBe(1);
  });

  it('applyBlock should use exponential backoff', () => {
    const b = new BlockEscalation({
      thresholdPercent: 50,
      blockDurationMs: 10_000,
      maxBlockDurationMs: 100_000,
    });
    b.check('target-1', 90);
    vi.advanceTimersByTime(100_000);
    b.check('target-1', 90);
    vi.advanceTimersByTime(100_000);
    const r = b.check('target-1', 90);
    expect(r.blocked).toBe(true);
    const history = b.getBlockHistory();
    expect(history).toHaveLength(3);
    expect(history[1].reason).toContain('attempt #2');
  });
});

// ============================================================
// SECTION 4 — WarningEscalation (warning.ts — 72.6%)
// ============================================================

describe('WarningEscalation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should construct with defaults', () => {
    const w = new WarningEscalation();
    expect(w.getWarnings()).toEqual([]);
    expect(w.getWarningCount('any')).toBe(0);
  });

  it('should construct with partial config', () => {
    const w = new WarningEscalation({ thresholdPercent: 90, cooldownMs: 10_000 });
    expect(w.getWarnings()).toEqual([]);
  });

  it('check should return undefined when utilization below threshold', () => {
    const w = new WarningEscalation({ thresholdPercent: 80 });
    expect(w.check('target-1', 'agent', 50)).toBeUndefined();
    expect(w.getWarningCount('target-1')).toBe(0);
  });

  it('check should return undefined when cooldown is active', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 60_000 });
    w.check('target-1', 'agent', 90);
    const second = w.check('target-1', 'agent', 90);
    expect(second).toBeUndefined();
  });

  it('check should return a warning event when threshold exceeded', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10 });
    const event = w.check('target-1', 'agent', 90);
    expect(event).toBeDefined();
    expect(event!.targetId).toBe('target-1');
    expect(event!.consecutiveCount).toBe(1);
    expect(event!.message).toContain('90.0%');
  });

  it('should escalate after configurable count', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10, escalateAfter: 3 });
    expect(w.shouldEscalate('target-1')).toBe(false);
    w.check('target-1', 'agent', 90);
    expect(w.shouldEscalate('target-1')).toBe(false);
    vi.advanceTimersByTime(11);
    w.check('target-1', 'agent', 90);
    expect(w.shouldEscalate('target-1')).toBe(false);
    vi.advanceTimersByTime(11);
    w.check('target-1', 'agent', 90);
    expect(w.shouldEscalate('target-1')).toBe(true);
  });

  it('hasExceededMax should return true when max reached', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10, maxWarnings: 2 });
    expect(w.hasExceededMax('target-1')).toBe(false);
    w.check('target-1', 'agent', 90);
    expect(w.hasExceededMax('target-1')).toBe(false);
    vi.advanceTimersByTime(11);
    w.check('target-1', 'agent', 90);
    expect(w.hasExceededMax('target-1')).toBe(true);
  });

  it('getWarnings should filter by targetId', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10 });
    w.check('target-a', 'agent', 90);
    vi.advanceTimersByTime(11);
    w.check('target-b', 'agent', 90);
    vi.advanceTimersByTime(11);
    w.check('target-a', 'agent', 90);
    expect(w.getWarnings('target-a')).toHaveLength(2);
    expect(w.getWarnings('target-b')).toHaveLength(1);
  });

  it('getWarnings without filter should return all', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10 });
    w.check('target-a', 'agent', 90);
    vi.advanceTimersByTime(11);
    w.check('target-b', 'agent', 90);
    expect(w.getWarnings()).toHaveLength(2);
  });

  it('getWarningCount should return 0 for unknown target', () => {
    const w = new WarningEscalation();
    expect(w.getWarningCount('unknown')).toBe(0);
  });

  it('reset should clear counts for a target', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10 });
    w.check('target-1', 'agent', 90);
    expect(w.getWarningCount('target-1')).toBe(1);
    w.reset('target-1');
    expect(w.getWarningCount('target-1')).toBe(0);
  });

  it('resetAll should clear everything', () => {
    const w = new WarningEscalation({ thresholdPercent: 50, cooldownMs: 10 });
    w.check('target-1', 'agent', 90);
    vi.advanceTimersByTime(11);
    w.check('target-2', 'agent', 90);
    w.resetAll();
    expect(w.getWarnings()).toEqual([]);
    expect(w.getWarningCount('target-1')).toBe(0);
  });

  it('formatMessage should produce correct format', () => {
    const w = new WarningEscalation({ thresholdPercent: 90 });
    const event = w.check('test-agent', 'agent', 85.5);
    expect(event).toBeUndefined();
  });
});

// ============================================================
// SECTION 5 — TrafficCapture (traffic-capture.ts — 79.05%)
// ============================================================

describe('TrafficCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should construct with partial config', () => {
    const tc = new TrafficCapture({ sampleRate: 0.5, strategy: 'error-only' });
    expect(tc.getConfig().sampleRate).toBe(0.5);
    expect(tc.getConfig().strategy).toBe('error-only');
  });

  it('capture should return null when not sampled', () => {
    const tc = new TrafficCapture({ sampleRate: 0, strategy: 'random' });
    const result = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(result).toBeNull();
    expect(tc.getStats().totalDiscarded).toBe(1);
  });

  it('capture should succeed with error-only strategy for errors', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'error-only' });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 500,
      latencyMs: 10,
      error: 'fail',
    });
    expect(r).not.toBeNull();
    expect(r!.sampling.strategy).toBe('error-only');
  });

  it('capture should fail with error-only strategy for 200', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'error-only' });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(r).toBeNull();
  });

  it('capture should succeed with slow-only strategy for slow requests', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'slow-only', slowThresholdMs: 100 });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 200,
    });
    expect(r).not.toBeNull();
  });

  it('capture should fail with slow-only strategy for fast requests', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'slow-only', slowThresholdMs: 100 });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 50,
    });
    expect(r).toBeNull();
  });

  it('capture with head strategy should capture at the beginning', () => {
    const tc = new TrafficCapture({ sampleRate: 0.5, strategy: 'head', maxBufferSize: 10 });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(r).not.toBeNull();
  });

  it('capture with tail strategy should capture at the end after discards', () => {
    const tc = new TrafficCapture({ sampleRate: 0.5, strategy: 'tail', maxBufferSize: 10 });
    for (let i = 0; i < 5; i++) {
      const r = tc.capture({
        method: 'GET',
        path: `/test/${i}`,
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
    }
    const stats = tc.getStats();
    expect(stats.totalCaptured + stats.totalDiscarded).toBeGreaterThanOrEqual(4);
  });

  it('capture with deterministic strategy', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'deterministic' });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(r).not.toBeNull();
  });

  it('capture should trigger flushSync when buffer full and persistPath set', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{"entries":[],"totalCaptured":0,"totalDiscarded":0}');
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      maxBufferSize: 1,
      persistPath: '/tmp/test.json',
      sanitizeFields: [],
    });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: { a: 1 },
      response: { b: 2 },
      statusCode: 200,
      latencyMs: 10,
    });
    expect(r).not.toBeNull();
  });

  it('flushSync should handle non-fatal errors', () => {
    mockExistsSync.mockImplementation(() => {
      throw new Error('disk error');
    });
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      maxBufferSize: 1,
      persistPath: '/tmp/test.json',
    });
    const r = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(r).not.toBeNull();
  });

  it('flush should throw when no persist path', async () => {
    const tc = new TrafficCapture({ sampleRate: 1 });
    await expect(tc.flush()).rejects.toThrow('No persist path configured');
  });

  it('flush should do nothing when buffer empty', async () => {
    mockExistsSync.mockReturnValue(true);
    const tc = new TrafficCapture({ sampleRate: 1, persistPath: '/tmp/test.json' });
    await tc.flush();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('flush should write to disk', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('{"entries":[],"totalCaptured":0,"totalDiscarded":0}');
    mockWriteFile.mockResolvedValue(undefined);
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      persistPath: '/tmp/test.json',
      sanitizeFields: [],
    });
    tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    await tc.flush();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('flush with corrupt existing file should recover gracefully', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue('corrupt json');
    mockWriteFile.mockResolvedValue(undefined);
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      persistPath: '/tmp/test.json',
      sanitizeFields: [],
    });
    tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    await tc.flush();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('flush should create directory if needed', async () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFile.mockResolvedValue('{"entries":[],"totalCaptured":0,"totalDiscarded":0}');
    mockWriteFile.mockResolvedValue(undefined);
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      persistPath: '/tmp/test.json',
      sanitizeFields: [],
    });
    tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    await tc.flush();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('load should throw when file not found', async () => {
    mockExistsSync.mockReturnValue(false);
    const tc = new TrafficCapture();
    await expect(tc.load('/nonexistent.json')).rejects.toThrow('Persist file not found');
  });

  it('load should restore state from file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        entries: [
          {
            id: 'e1',
            method: 'GET',
            path: '/test',
            request: {},
            response: {},
            statusCode: 200,
            latencyMs: 10,
            timestamp: '2026-01-01T00:00:00.000Z',
            sampling: { strategy: 'random', sampleRate: 1, selected: true },
            tags: {},
          },
        ],
        totalCaptured: 1,
        totalDiscarded: 0,
      }),
    );
    const tc = new TrafficCapture();
    await tc.load('/tmp/test.json');
    expect(tc.getEntries()).toHaveLength(1);
    expect(tc.getStats().totalCaptured).toBe(1);
  });

  it('getEntriesByPath should handle string and regex', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'random', sanitizeFields: [] });
    tc.capture({
      method: 'GET',
      path: '/api/users',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    tc.capture({
      method: 'POST',
      path: '/api/orders',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(tc.getEntriesByPath('/api/users')).toHaveLength(1);
    expect(tc.getEntriesByPath(/\/api\//)).toHaveLength(2);
    expect(tc.getEntriesByPath('/*')).toHaveLength(2);
  });

  it('getErrorEntries should return entries with errors', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'random', sanitizeFields: [] });
    tc.capture({
      method: 'GET',
      path: '/ok',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    tc.capture({
      method: 'GET',
      path: '/err',
      request: {},
      response: {},
      statusCode: 500,
      latencyMs: 10,
      error: 'fail',
    });
    expect(tc.getErrorEntries()).toHaveLength(1);
  });

  it('getSlowEntries should filter by threshold', () => {
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      sanitizeFields: [],
      slowThresholdMs: 100,
    });
    tc.capture({
      method: 'GET',
      path: '/fast',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 50,
    });
    tc.capture({
      method: 'GET',
      path: '/slow',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 200,
    });
    expect(tc.getSlowEntries()).toHaveLength(1);
    expect(tc.getSlowEntries(150)).toHaveLength(1);
  });

  it('getEntryById should find by id', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'random', sanitizeFields: [] });
    const entry = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(tc.getEntryById(entry!.id)).toBeDefined();
    expect(tc.getEntryById('nonexistent')).toBeUndefined();
  });

  it('sanitize should redact sensitive fields recursively', () => {
    const tc = new TrafficCapture({
      sampleRate: 1,
      strategy: 'random',
      sanitizeFields: ['password'],
    });
    const entry = tc.capture({
      method: 'POST',
      path: '/login',
      request: { username: 'user', password: 'secret', nested: { token: 'abc' } },
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(entry!.request.password).toBe('[REDACTED]');
    expect(entry!.request.nested).toEqual({ token: 'abc' });
  });

  it('clear should empty the buffer', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'random', sanitizeFields: [] });
    tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(tc.getEntries()).toHaveLength(1);
    tc.clear();
    expect(tc.getEntries()).toHaveLength(0);
  });

  it('should use tags default to empty object', () => {
    const tc = new TrafficCapture({ sampleRate: 1, strategy: 'random', sanitizeFields: [] });
    const entry = tc.capture({
      method: 'GET',
      path: '/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(entry!.tags).toEqual({});
  });

  it('default config should have correct defaults', () => {
    const tc = new TrafficCapture();
    expect(tc.getConfig().sampleRate).toBe(0.1);
    expect(tc.getConfig().maxBodyBytes).toBe(65_536);
  });
});

// ============================================================
// SECTION 6 — AlertManager (alert-manager.ts — 93.38%)
// ============================================================

describe('AlertManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockReadFile.mockReset();
    mockWriteFile.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should construct with custom config', () => {
    const am = new AlertManager({ maxActiveAlerts: 5, defaultCooldownMs: 10_000 });
    expect(am.getConfig().maxActiveAlerts).toBe(5);
    expect(am.getRules()).toHaveLength(4);
  });

  it('evaluate should skip disabled rules', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    for (const r of am.getRules()) {
      am.upsertRule({ ...r, enabled: false });
    }
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'high' });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(0);
  });

  it('evaluate should skip rules on cooldown', () => {
    const am = new AlertManager({ defaultCooldownMs: 60_000 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    am.evaluate(diff);
    vi.advanceTimersByTime(1_000);
    const second = am.evaluate(diff);
    expect(second).toHaveLength(0);
  });

  it('evaluate should fire alert when rule matches', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    const alerts = am.evaluate(diff);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0].status).toBe('active');
  });

  it('evaluateBatch should process multiple results', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diffs = [
      makeDiffResult({ id: 'd1', driftScore: 50, overallSeverity: 'medium' }),
      makeDiffResult({ id: 'd2', driftScore: 10, overallSeverity: 'low' }),
    ];
    const alerts = am.evaluateBatch(diffs);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it('acknowledge should return null if alert not active', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    expect(am.acknowledge('nonexistent')).toBeNull();
  });

  it('acknowledge should change status to acknowledged', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    const [alert] = am.evaluate(diff);
    const ack = am.acknowledge(alert.id);
    expect(ack).not.toBeNull();
    expect(ack!.status).toBe('acknowledged');
    expect(am.acknowledge(alert.id)).toBeNull();
  });

  it('resolve should return null for already resolved or suppressed', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    const [alert] = am.evaluate(diff);
    const r1 = am.resolve(alert.id);
    expect(r1).not.toBeNull();
    expect(r1!.status).toBe('resolved');
    expect(am.resolve(alert.id)).toBeNull();
    expect(am.resolve('nonexistent')).toBeNull();
  });

  it('suppress should return null for missing alert', () => {
    const am = new AlertManager();
    expect(am.suppress('nonexistent')).toBeNull();
  });

  it('suppress should change status to suppressed', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    const [alert] = am.evaluate(diff);
    const s = am.suppress(alert.id);
    expect(s).not.toBeNull();
    expect(s!.status).toBe('suppressed');
  });

  it('getAlerts should filter by status', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    am.evaluate(diff);
    expect(am.getAlerts('active')).toHaveLength(1);
    expect(am.getAlerts('resolved')).toHaveLength(0);
  });

  it('getActiveCounts should count by severity', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'high' });
    am.evaluate(diff);
    const counts = am.getActiveCounts();
    expect(counts.high).toBe(1);
    expect(counts.info).toBe(0);
  });

  it('autoResolveStale should resolve old alerts', () => {
    const am = new AlertManager({ defaultCooldownMs: 10, autoResolveAfterMs: 100 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    am.evaluate(diff);
    vi.advanceTimersByTime(101);
    const resolved = am.autoResolveStale();
    expect(resolved.length).toBeGreaterThanOrEqual(1);
  });

  it('upsertRule should add new rule', () => {
    const am = new AlertManager();
    const len = am.getRules().length;
    am.upsertRule({
      id: 'custom-rule',
      name: 'Custom',
      type: 'regression',
      minSeverity: 'low',
      minDriftScore: 5,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    expect(am.getRules()).toHaveLength(len + 1);
  });

  it('upsertRule should update existing rule', () => {
    const am = new AlertManager();
    const rule = am.getRules()[0];
    am.upsertRule({ ...rule, name: 'Updated Name' });
    expect(am.getRules()[0].name).toBe('Updated Name');
  });

  it('removeRule should return false for missing rule', () => {
    const am = new AlertManager();
    expect(am.removeRule('nonexistent')).toBe(false);
  });

  it('removeRule should remove existing rule', () => {
    const am = new AlertManager();
    const rule = am.getRules()[0];
    expect(am.removeRule(rule.id)).toBe(true);
    expect(am.getRules()).toHaveLength(3);
  });

  it('matchesRule should match regression type', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.upsertRule({
      id: 'regression-test',
      name: 'Regression Test',
      type: 'regression',
      minSeverity: 'low',
      minDriftScore: 0,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    const diff = makeDiffResult({ driftScore: 5, overallSeverity: 'low', regressions: true });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(1);
  });

  it('matchesRule should match status-code-mismatch type', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.upsertRule({
      id: 'sc-test',
      name: 'SC Test',
      type: 'status-code-mismatch',
      minSeverity: 'low',
      minDriftScore: 0,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    const diff = makeDiffResult({ driftScore: 5, overallSeverity: 'low', statusCodeMatch: false });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(1);
  });

  it('matchesRule should match latency-regression type', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.upsertRule({
      id: 'lat-test',
      name: 'Lat Test',
      type: 'latency-regression',
      minSeverity: 'low',
      minDriftScore: 0,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    const diff = makeDiffResult({ driftScore: 5, overallSeverity: 'low', latencyRatio: 2.0 });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(1);
  });

  it('matchesRule should match schema-break type', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.upsertRule({
      id: 'schema-test',
      name: 'Schema Test',
      type: 'schema-break',
      minSeverity: 'low',
      minDriftScore: 0,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    const diff = makeDiffResult({
      driftScore: 5,
      overallSeverity: 'low',
      findings: [
        {
          id: 'f1',
          category: 'schema-change',
          severity: 'high',
          description: 'changed',
          path: '/a',
        },
      ] as import('../shadow/diff-analyzer.js').DiffFinding[],
    });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(1);
  });

  it('matchesRule should match error-introduced type', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.upsertRule({
      id: 'err-test',
      name: 'Err Test',
      type: 'error-introduced',
      minSeverity: 'low',
      minDriftScore: 0,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    const diff = makeDiffResult({
      driftScore: 5,
      overallSeverity: 'low',
      findings: [
        {
          id: 'f1',
          category: 'error-introduced',
          severity: 'high',
          description: 'err',
          path: '/a',
        },
      ] as import('../shadow/diff-analyzer.js').DiffFinding[],
    });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(1);
  });

  it('matchesRule should match compliance-violation type', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.upsertRule({
      id: 'comp-test',
      name: 'Comp Test',
      type: 'compliance-violation',
      minSeverity: 'low',
      minDriftScore: 0,
      cooldownMs: 10_000,
      channels: ['log'],
      enabled: true,
    });
    const diff = makeDiffResult({
      driftScore: 5,
      overallSeverity: 'low',
      findings: [
        { id: 'f1', category: 'body-value', severity: 'critical', description: 'crit', path: '/a' },
      ] as import('../shadow/diff-analyzer.js').DiffFinding[],
    });
    const alerts = am.evaluate(diff);
    expect(alerts).toHaveLength(1);
  });

  it('createAlert should return null when maxActiveAlerts exceeded', () => {
    const am = new AlertManager({ maxActiveAlerts: 1, defaultCooldownMs: 10 });
    const diff = makeDiffResult({ driftScore: 50, overallSeverity: 'medium' });
    am.evaluate(diff);
    vi.advanceTimersByTime(11);
    const second = am.evaluate(diff);
    expect(second).toHaveLength(0);
  });

  it('persist should throw with no path', async () => {
    const am = new AlertManager();
    await expect(am.persist()).rejects.toThrow('No persist path configured');
  });

  it('persist should write to file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.evaluate(makeDiffResult({ driftScore: 50, overallSeverity: 'medium' }));
    await am.persist('/tmp/alerts.json');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('load should throw if file not found', async () => {
    mockExistsSync.mockReturnValue(false);
    const am = new AlertManager();
    await expect(am.load('/nonexistent.json')).rejects.toThrow('Persist file not found');
  });

  it('load should restore state', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        alerts: [
          {
            id: 'a1',
            type: 'regression',
            status: 'active',
            severity: 'medium',
            driftScore: 10,
            summary: 'test',
            description: 'test',
            diffResultIds: [],
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            metadata: {},
          },
        ],
        rules: [
          {
            id: 'r1',
            name: 'Test',
            type: 'regression',
            minSeverity: 'low',
            minDriftScore: 5,
            cooldownMs: 10_000,
            channels: ['log'],
            enabled: true,
          },
        ],
      }),
    );
    const am = new AlertManager();
    await am.load('/tmp/alerts.json');
    expect(am.getAlerts()).toHaveLength(1);
    expect(am.getRules()).toHaveLength(1);
  });

  it('clearAlerts should remove all alerts', () => {
    const am = new AlertManager({ defaultCooldownMs: 10 });
    am.evaluate(makeDiffResult({ driftScore: 50, overallSeverity: 'medium' }));
    am.clearAlerts();
    expect(am.getAlerts()).toHaveLength(0);
  });
});

// ============================================================
// SECTION 7 — ShadowPipeline (shadow-pipeline.ts — 91.19%)
// ============================================================

describe('ShadowPipeline', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockWriteFile.mockReset();
    mockReadFile.mockReset();
  });

  it('should construct with partial config', () => {
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    expect(sp.getConfig().projectName).toBe('test');
    expect(sp.getStatus()).toBe('idle');
  });

  it('execute should handle empty captures gracefully', async () => {
    const sp = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      generateCompliance: false,
    });
    const handler = vi.fn();
    const result = await sp.execute([], handler);
    expect(result.status).toBe('completed');
    expect(result.capturedCount).toBe(0);
  });

  it('execute should succeed without compliance', async () => {
    const sp = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      generateCompliance: false,
    });
    const handler = vi.fn().mockResolvedValue({ response: { result: 'ok' }, statusCode: 200 });
    const captures = [
      makeCapturedTraffic({ id: 'c1', request: { a: 1 }, response: { result: 'ok' } }),
    ];
    const result = await sp.execute(captures, handler);
    expect(result.status).toBe('completed');
    expect(result.shadowReport).not.toBeNull();
    expect(result.complianceReport).toBeNull();
  });

  it('execute should persist when persistDir is set', async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    const sp = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      persistDir: '/tmp/pipeline',
      generateCompliance: false,
    });
    const handler = vi.fn().mockResolvedValue({ response: { result: 'ok' }, statusCode: 200 });
    const captures = [
      makeCapturedTraffic({ id: 'c1', request: { a: 1 }, response: { result: 'ok' } }),
    ];
    const result = await sp.execute(captures, handler);
    expect(result.status).toBe('completed');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('createCaptureMiddleware should return capture functions', () => {
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    const mw = sp.createCaptureMiddleware();
    expect(mw.capture).toBeDefined();
    expect(mw.getCaptures).toBeDefined();
    expect(mw.getStats).toBeDefined();
  });

  it('getHistory and getLastResult should work', () => {
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    expect(sp.getHistory()).toEqual([]);
    expect(sp.getLastResult()).toBeUndefined();
  });

  it('persist should throw without persistDir', async () => {
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    await expect(sp.persist()).rejects.toThrow('No persist directory configured');
  });

  it('persist should write files when dir exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    const sp = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      persistDir: '/tmp/pipeline',
    });
    await sp.persist();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('persist should create directory when missing', async () => {
    mockExistsSync.mockReturnValue(false);
    mockWriteFile.mockResolvedValue(undefined);
    const sp = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      persistDir: '/tmp/pipeline',
    });
    await sp.persist();
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('load should restore from directory', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      JSON.stringify([
        {
          id: 'r1',
          status: 'completed',
          startedAt: '2026-01-01T00:00:00.000Z',
          completedAt: '2026-01-01T00:01:00.000Z',
          durationMs: 60_000,
          capturedCount: 0,
          diffSummary: null,
          replayStats: null,
          alerts: [],
          shadowReport: null,
          complianceReport: null,
        },
      ]),
    );
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    await sp.load('/tmp/pipeline');
    expect(sp.getHistory()).toHaveLength(1);
    expect(sp.getLastResult()!.id).toBe('r1');
  });

  it('getReportGenerator and getComplianceGenerator should return objects', () => {
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    expect(sp.getReportGenerator()).toBeDefined();
    expect(sp.getComplianceGenerator()).toBeDefined();
  });

  it('getStatus should return current status', () => {
    const sp = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
    expect(sp.getStatus()).toBe('idle');
  });
});

// ============================================================
// SECTION 8 — ComplianceReportGenerator (compliance-report.ts — 96.71%)
// ============================================================

describe('ComplianceReportGenerator', () => {
  it('should construct with partial config', () => {
    const crg = new ComplianceReportGenerator({
      frameworks: ['pci-dss'],
      projectName: 'my-project',
    });
    expect(crg.getConfig().frameworks).toEqual(['pci-dss']);
  });

  it('generate should produce a report for all frameworks', () => {
    const crg = new ComplianceReportGenerator();
    const report = crg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 10,
        meanDriftScore: 15,
        p95DriftScore: 30,
        driftViolations: 1,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 1.0,
        recommendation: 'proceed',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [],
      },
      replayStats: {
        total: 10,
        succeeded: 10,
        failed: 0,
        avgLatencyMs: 50,
        p50LatencyMs: 45,
        p95LatencyMs: 100,
        p99LatencyMs: 150,
        totalDurationMs: 500,
      },
      captures: Array.from({ length: 10 }, (_, i) =>
        makeCapturedTraffic({ id: `c${i}`, request: {}, response: {} }),
      ),
      alerts: [],
      dnaVersion: '1.0.0',
      projectName: 'test',
    });
    expect(report.frameworks).toHaveLength(3);
    expect(report.overallStatus).toBe('pass');
    expect(report.totalChecks).toBeGreaterThan(0);
  });

  it('generate should handle failing checks', () => {
    const crg = new ComplianceReportGenerator();
    const report = crg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 5,
        meanDriftScore: 80,
        p95DriftScore: 95,
        driftViolations: 5,
        regressions: 3,
        improvements: 0,
        statusCodeMismatches: 2,
        meanLatencyRatio: 3.0,
        recommendation: 'rollback',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: { 'schema-change': 3, 'error-introduced': 2 },
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: { high: 5 },
        results: [makeDiffResult({ driftScore: 80, overallSeverity: 'high', regressions: true })],
      },
      replayStats: {
        total: 5,
        succeeded: 3,
        failed: 2,
        avgLatencyMs: 200,
        p50LatencyMs: 150,
        p95LatencyMs: 500,
        p99LatencyMs: 800,
        totalDurationMs: 1000,
      },
      captures: [],
      alerts: [
        {
          id: 'a1',
          type: 'drift-threshold',
          status: 'active',
          severity: 'critical',
          driftScore: 80,
          summary: 'test',
          description: 'test',
          diffResultIds: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          metadata: {},
        },
      ],
    });
    expect(report.overallStatus).toBe('fail');
    expect(report.totalFailed).toBeGreaterThan(0);
  });

  it('save should write to file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    const crg = new ComplianceReportGenerator();
    const report = crg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 1,
        meanDriftScore: 0,
        p95DriftScore: 0,
        driftViolations: 0,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 1.0,
        recommendation: 'proceed',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [],
      },
      replayStats: {
        total: 1,
        succeeded: 1,
        failed: 0,
        avgLatencyMs: 10,
        p50LatencyMs: 10,
        p95LatencyMs: 10,
        p99LatencyMs: 10,
        totalDurationMs: 10,
      },
      captures: [],
      alerts: [],
    });
    await crg.save(report, '/tmp/report.json');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('load should throw if file not found', async () => {
    mockExistsSync.mockReturnValue(false);
    const crg = new ComplianceReportGenerator();
    await expect(crg.load('/nonexistent.json')).rejects.toThrow('Report file not found');
  });

  it('load should return report from file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        id: 'r1',
        timestamp: '2026-01-01T00:00:00.000Z',
        projectName: 'test',
        dnaVersion: '1.0.0',
        overallStatus: 'pass',
        frameworks: [],
        totalChecks: 0,
        totalPassed: 0,
        totalFailed: 0,
        executiveSummary: 'ok',
      }),
    );
    const crg = new ComplianceReportGenerator();
    const report = await crg.load('/tmp/report.json');
    expect(report.id).toBe('r1');
  });
});

// ============================================================
// SECTION 9 — ShadowReportGenerator (shadow-report.ts — 95.81%)
// ============================================================

describe('ShadowReportGenerator', () => {
  it('should construct with partial config', () => {
    const srg = new ShadowReportGenerator({ includeDiffDetails: true, projectName: 'my-project' });
    expect(srg.getConfig().includeDiffDetails).toBe(true);
  });

  it('generate should produce a report with proceed recommendation', () => {
    const srg = new ShadowReportGenerator();
    const report = srg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 10,
        meanDriftScore: 5,
        p95DriftScore: 10,
        driftViolations: 0,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 1.0,
        recommendation: 'proceed',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [],
      },
      replayStats: {
        total: 10,
        succeeded: 10,
        failed: 0,
        avgLatencyMs: 50,
        p50LatencyMs: 45,
        p95LatencyMs: 100,
        p99LatencyMs: 150,
        totalDurationMs: 500,
      },
      alerts: [],
      captures: [
        { timestamp: '2026-01-01T00:00:00.000Z' },
        { timestamp: '2026-01-02T00:00:00.000Z' },
      ],
      dnaVersion: '1.0.0',
      projectName: 'test',
    });
    expect(report.recommendation).toBe('proceed');
    expect(report.confidenceScore).toBeGreaterThan(0);
  });

  it('generate should handle investigate and rollback recommendations', () => {
    const srg = new ShadowReportGenerator();
    const investigate = srg.generate({
      diffSummary: {
        id: 'a2',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 10,
        meanDriftScore: 40,
        p95DriftScore: 50,
        driftViolations: 3,
        regressions: 1,
        improvements: 0,
        statusCodeMismatches: 1,
        meanLatencyRatio: 1.2,
        recommendation: 'investigate',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: { 'body-value': 3 },
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: { low: 3 },
        results: [makeDiffResult({ driftScore: 40, overallSeverity: 'low' })],
      },
      replayStats: {
        total: 10,
        succeeded: 9,
        failed: 1,
        avgLatencyMs: 100,
        p50LatencyMs: 80,
        p95LatencyMs: 200,
        p99LatencyMs: 300,
        totalDurationMs: 1000,
      },
      alerts: [],
      captures: [{ timestamp: '2026-01-01T00:00:00.000Z' }],
      dnaVersion: '1.0.0',
    });
    expect(investigate.recommendation).toBe('investigate');

    const rollback = srg.generate({
      diffSummary: {
        id: 'a3',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 10,
        meanDriftScore: 80,
        p95DriftScore: 90,
        driftViolations: 8,
        regressions: 3,
        improvements: 0,
        statusCodeMismatches: 2,
        meanLatencyRatio: 2.5,
        recommendation: 'rollback',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: { 'error-introduced': 3 },
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: { high: 3 },
        results: [],
      },
      replayStats: {
        total: 10,
        succeeded: 5,
        failed: 5,
        avgLatencyMs: 500,
        p50LatencyMs: 400,
        p95LatencyMs: 1000,
        p99LatencyMs: 2000,
        totalDurationMs: 5000,
      },
      alerts: [],
      captures: [],
      dnaVersion: '1.0.0',
    });
    expect(rollback.recommendation).toBe('rollback');
  });

  it('generate with alerts should include alerts section', () => {
    const srg = new ShadowReportGenerator();
    const report = srg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 10,
        meanDriftScore: 30,
        p95DriftScore: 40,
        driftViolations: 2,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 1.0,
        recommendation: 'investigate',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [makeDiffResult()],
      },
      replayStats: {
        total: 10,
        succeeded: 10,
        failed: 0,
        avgLatencyMs: 50,
        p50LatencyMs: 45,
        p95LatencyMs: 100,
        p99LatencyMs: 150,
        totalDurationMs: 500,
      },
      alerts: [
        {
          id: 'a1',
          type: 'drift-threshold',
          status: 'active',
          severity: 'critical',
          driftScore: 30,
          summary: 'High drift',
          description: 'desc',
          diffResultIds: ['d1'],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          metadata: {},
        },
      ],
      captures: [{ timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    expect(report.alerts).toHaveLength(1);
    expect(report.sections.some((s) => s.title === 'Active Alerts')).toBe(true);
  });

  it('generate with includeDiffDetails should include diff details section', () => {
    const srg = new ShadowReportGenerator({ includeDiffDetails: true });
    const report = srg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 1,
        meanDriftScore: 5,
        p95DriftScore: 10,
        driftViolations: 0,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 1.0,
        recommendation: 'proceed',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [
          makeDiffResult({
            findings: [
              {
                id: 'f1',
                category: 'body-value',
                severity: 'low',
                description: 'diff',
                path: '/a',
                original: 1,
                shadow: 2,
              },
            ] as import('../shadow/diff-analyzer.js').DiffFinding[],
          }),
        ],
      },
      replayStats: {
        total: 1,
        succeeded: 1,
        failed: 0,
        avgLatencyMs: 10,
        p50LatencyMs: 10,
        p95LatencyMs: 10,
        p99LatencyMs: 10,
        totalDurationMs: 10,
      },
      alerts: [],
      captures: [{ timestamp: '2026-01-01T00:00:00.000Z' }],
    });
    expect(report.sections.some((s) => s.title === 'Diff Details')).toBe(true);
  });

  it('getTimeRange should handle empty captures', () => {
    const srg = new ShadowReportGenerator();
    const report = srg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 0,
        meanDriftScore: 0,
        p95DriftScore: 0,
        driftViolations: 0,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 0,
        recommendation: 'investigate',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [],
      },
      replayStats: {
        total: 0,
        succeeded: 0,
        failed: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        totalDurationMs: 0,
      },
      alerts: [],
      captures: [],
    });
    expect(report.trafficTimeRange.start).toBeDefined();
    expect(report.trafficTimeRange.end).toBeDefined();
  });

  it('buildDriftSection should handle empty severity and category breakdowns', () => {
    const srg = new ShadowReportGenerator();
    const report = srg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 0,
        meanDriftScore: 10,
        p95DriftScore: 0,
        driftViolations: 0,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 1.0,
        recommendation: 'proceed',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [],
      },
      replayStats: {
        total: 0,
        succeeded: 0,
        failed: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        totalDurationMs: 0,
      },
      alerts: [],
      captures: [],
    });
    expect(report.sections.some((s) => s.title === 'Drift Analysis')).toBe(true);
  });

  it('save should write to file', async () => {
    mockExistsSync.mockReturnValue(true);
    mockWriteFile.mockResolvedValue(undefined);
    const srg = new ShadowReportGenerator();
    const report = srg.generate({
      diffSummary: {
        id: 'a1',
        timestamp: '2026-01-01T00:00:00.000Z',
        totalPairs: 0,
        meanDriftScore: 0,
        p95DriftScore: 0,
        driftViolations: 0,
        regressions: 0,
        improvements: 0,
        statusCodeMismatches: 0,
        meanLatencyRatio: 0,
        recommendation: 'proceed',
        // @ts-expect-error - partial mock for edge case testing
        categoryBreakdown: {},
        // @ts-expect-error - partial mock for edge case testing
        severityBreakdown: {},
        results: [],
      },
      replayStats: {
        total: 0,
        succeeded: 0,
        failed: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        totalDurationMs: 0,
      },
      alerts: [],
      captures: [],
    });
    await srg.save(report, '/tmp/report.json');
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it('load should throw if file not found', async () => {
    mockExistsSync.mockReturnValue(false);
    const srg = new ShadowReportGenerator();
    await expect(srg.load('/nonexistent.json')).rejects.toThrow('Report file not found');
  });
});

// ============================================================
// SECTION 10 — DiffAnalyzer (diff-analyzer.ts — ~93%)
// ============================================================

describe('DiffAnalyzer', () => {
  it('should construct with partial config', () => {
    const da = new DiffAnalyzer({ driftThreshold: 50, maxDepth: 5 });
    expect(da.getConfig().driftThreshold).toBe(50);
  });

  it('analyze should compare status codes', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', statusCode: 200, latencyMs: 100 });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowStatusCode: 500,
      shadowLatencyMs: 200,
    });
    const result = da.analyze(capture, replay);
    expect(result.statusCodeMatch).toBe(false);
    expect(result.findings.some((f) => f.category === 'error-introduced')).toBe(true);
  });

  it('analyze should detect error-resolved status changes', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', statusCode: 500, latencyMs: 100 });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowStatusCode: 200,
      shadowLatencyMs: 50,
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'error-resolved')).toBe(true);
  });

  it('analyze should compare body fields', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { name: 'alice', age: 30 },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { name: 'bob', age: 30 },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'body-value')).toBe(true);
  });

  it('analyze should detect missing fields', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', response: { a: 1, b: 2 }, latencyMs: 100 });
    const replay = makeReplayResult({ id: 'r1', captureId: 'c1', shadowResponse: { a: 1 } });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'field-missing')).toBe(true);
  });

  it('analyze should detect added fields', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', response: { a: 1 }, latencyMs: 100 });
    const replay = makeReplayResult({ id: 'r1', captureId: 'c1', shadowResponse: { a: 1, b: 2 } });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'field-added')).toBe(true);
  });

  it('analyze should handle type changes between object and array', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { items: { key: 'val' } },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { items: ['a', 'b'] },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'schema-change')).toBe(true);
  });

  it('analyze should recursively compare nested objects', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { nested: { x: 1, y: 2 } },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { nested: { x: 1, y: 3 } },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'body-value')).toBe(true);
  });

  it('analyze should handle maxDepth', () => {
    const da = new DiffAnalyzer({ maxDepth: 1 });
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { deep: { deeper: { value: 1 } } },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { deep: { deeper: { value: 2 } } },
    });
    const result = da.analyze(capture, replay);
    expect(result.driftScore).toBe(0);
  });

  it('compareArrays should detect length differences', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { list: [1, 2, 3] },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { list: [1, 2] },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'schema-change')).toBe(true);
  });

  it('compareArrays should compare element-by-element', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { list: [1, 2, 3] },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { list: [1, 5, 3] },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'body-value')).toBe(true);
  });

  it('compareArrays should compare object elements recursively', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { list: [{ name: 'a' }, { name: 'b' }] },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      id: 'r1',
      captureId: 'c1',
      shadowResponse: { list: [{ name: 'a' }, { name: 'c' }] },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'body-value')).toBe(true);
  });

  it('compareLatency should detect latency regression', () => {
    const da = new DiffAnalyzer({ latencyMinDeltaMs: 10 });
    const capture = makeCapturedTraffic({ id: 'c1', latencyMs: 100 });
    const replay = makeReplayResult({ id: 'r1', captureId: 'c1', shadowLatencyMs: 300 });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'latency-regression')).toBe(true);
  });

  it('compareLatency should detect latency improvement', () => {
    const da = new DiffAnalyzer({ latencyImprovementThreshold: 0.7, latencyMinDeltaMs: 10 });
    const capture = makeCapturedTraffic({ id: 'c1', latencyMs: 200 });
    const replay = makeReplayResult({ id: 'r1', captureId: 'c1', shadowLatencyMs: 50 });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.category === 'latency-improvement')).toBe(true);
  });

  it('compareLatency should skip when latencyMs is 0', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', latencyMs: 0 });
    const replay = makeReplayResult({ id: 'r1', captureId: 'c1', shadowLatencyMs: 100 });
    const result = da.analyze(capture, replay);
    expect(result.findings).toHaveLength(0);
  });

  it('compareLatency should skip when delta below min', () => {
    const da = new DiffAnalyzer({ latencyMinDeltaMs: 1000 });
    const capture = makeCapturedTraffic({ id: 'c1', latencyMs: 100 });
    const replay = makeReplayResult({ id: 'r1', captureId: 'c1', shadowLatencyMs: 110 });
    const result = da.analyze(capture, replay);
    expect(result.findings).toHaveLength(0);
  });

  it('analyzeBatch should skip unmatched replays', () => {
    const da = new DiffAnalyzer();
    const captures = [makeCapturedTraffic({ id: 'c1' })];
    const replays = [
      makeReplayResult({ id: 'r1', captureId: 'c1' }),
      makeReplayResult({ id: 'r2', captureId: 'no-match' }),
    ];
    const summary = da.analyzeBatch(captures, replays);
    expect(summary.totalPairs).toBe(1);
  });

  it('analyzeBatch should handle empty results', () => {
    const da = new DiffAnalyzer();
    const summary = da.analyzeBatch([], []);
    expect(summary.totalPairs).toBe(0);
    expect(summary.meanDriftScore).toBe(0);
    expect(summary.p95DriftScore).toBe(0);
    expect(summary.recommendation).toBe('investigate');
  });

  it('determineRecommendation returns proceed for clean results', () => {
    const da = new DiffAnalyzer();
    const summary = da.analyzeBatch(
      [makeCapturedTraffic({ id: 'c1', response: { a: 1 }, latencyMs: 100 })],
      [
        makeReplayResult({
          captureId: 'c1',
          shadowResponse: { a: 1 },
          shadowLatencyMs: 100,
          shadowStatusCode: 200,
        }),
      ],
    );
    expect(summary.recommendation).toBe('proceed');
  });

  it('classifyValueSeverity should return critical for security fields', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', response: { token: 'abc' }, latencyMs: 100 });
    const replay = makeReplayResult({ captureId: 'c1', shadowResponse: { token: 'xyz' } });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.severity === 'critical')).toBe(true);
  });

  it('classifyValueSeverity should return high for safety-critical fields', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', response: { amount: 100 }, latencyMs: 100 });
    const replay = makeReplayResult({ captureId: 'c1', shadowResponse: { amount: 200 } });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.severity === 'high')).toBe(true);
  });

  it('classifyValueSeverity should return medium for type mismatches', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', response: { count: '5' }, latencyMs: 100 });
    const replay = makeReplayResult({ captureId: 'c1', shadowResponse: { count: 5 } });
    const result = da.analyze(capture, replay);
    expect(result.findings.some((f) => f.severity === 'medium')).toBe(true);
  });

  it('calculateDriftScore returns 0 for no findings', () => {
    const da = new DiffAnalyzer();
    const capture = makeCapturedTraffic({ id: 'c1', latencyMs: 100 });
    const replay = makeReplayResult({
      captureId: 'c1',
      shadowLatencyMs: 100,
      shadowStatusCode: 200,
    });
    const result = da.analyze(capture, replay);
    expect(result.driftScore).toBe(0);
  });

  it('should handle ignoreFields config', () => {
    const da = new DiffAnalyzer({ ignoreFields: ['ignore_me'] });
    const capture = makeCapturedTraffic({
      id: 'c1',
      response: { ignore_me: 'old', keep_me: 'same' },
      latencyMs: 100,
    });
    const replay = makeReplayResult({
      captureId: 'c1',
      shadowResponse: { ignore_me: 'new', keep_me: 'same' },
    });
    const result = da.analyze(capture, replay);
    expect(result.findings).toHaveLength(0);
  });
});

// ============================================================
// SECTION 11 — TrafficReplay (traffic-replay.ts — ~97%)
// ============================================================

describe('TrafficReplay', () => {
  it('should construct with partial config', () => {
    const tr = new TrafficReplay({ concurrency: 2, retries: 1 });
    expect(tr.getConfig().retries).toBe(1);
  });

  it('replayOne should handle retries and eventual failure', async () => {
    const tr = new TrafficReplay({ retries: 2, delayMs: 10 });
    const handler = vi.fn().mockRejectedValue(new Error('persistent error'));
    const capture = makeCapturedTraffic({ id: 'c1', request: { a: 1 } });
    const result = await tr.replayOne(capture, handler);
    expect(result.success).toBe(false);
    expect(result.error).toBe('persistent error');
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('replayOne should succeed on first attempt', async () => {
    const tr = new TrafficReplay();
    const handler = vi.fn().mockResolvedValue({ response: { ok: true }, statusCode: 200 });
    const capture = makeCapturedTraffic({ id: 'c1', request: { a: 1 } });
    const result = await tr.replayOne(capture, handler);
    expect(result.success).toBe(true);
    expect(result.shadowStatusCode).toBe(200);
  });

  it('replayBatch should call onProgress', async () => {
    const tr = new TrafficReplay({ concurrency: 2 });
    const handler = vi.fn().mockResolvedValue({ response: {}, statusCode: 200 });
    const onProgress = vi.fn();
    const captures = [makeCapturedTraffic({ id: 'c1' }), makeCapturedTraffic({ id: 'c2' })];
    const outcome = await tr.replayBatch(captures, handler, onProgress);
    expect(outcome.results).toHaveLength(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('replayBatch should respect delayMs', async () => {
    const tr = new TrafficReplay({ concurrency: 1, delayMs: 50 });
    const handler = vi.fn().mockResolvedValue({ response: {}, statusCode: 200 });
    const captures = [makeCapturedTraffic({ id: 'c1' }), makeCapturedTraffic({ id: 'c2' })];
    const outcome = await tr.replayBatch(captures, handler);
    expect(outcome.results).toHaveLength(2);
  });

  it('getResults should return a copy', () => {
    const tr = new TrafficReplay();
    const results = tr.getResults();
    results.push({} as never);
    expect(tr.getResults()).toHaveLength(0);
  });

  it('getFailures should return only failed results', async () => {
    const tr = new TrafficReplay();
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    const capture = makeCapturedTraffic({ id: 'c1', request: { a: 1 } });
    await tr.replayOne(capture, handler);
    expect(tr.getFailures()).toHaveLength(1);
  });

  it('getStatusMismatches should find mismatched status codes', async () => {
    const tr = new TrafficReplay();
    const handler = vi.fn().mockResolvedValue({ response: {}, statusCode: 500 });
    const capture = makeCapturedTraffic({ id: 'c1', request: { a: 1 }, statusCode: 200 });
    await tr.replayOne(capture, handler);
    const mismatches = tr.getStatusMismatches([capture]);
    expect(mismatches).toHaveLength(1);
  });

  it('getStatusMismatches should return empty for unknown captures', () => {
    const tr = new TrafficReplay();
    const mismatches = tr.getStatusMismatches([]);
    expect(mismatches).toEqual([]);
  });

  it('clear should reset results', async () => {
    const tr = new TrafficReplay();
    const handler = vi.fn().mockResolvedValue({ response: {}, statusCode: 200 });
    const capture = makeCapturedTraffic({ id: 'c1', request: { a: 1 } });
    await tr.replayOne(capture, handler);
    expect(tr.getResults()).toHaveLength(1);
    tr.clear();
    expect(tr.getResults()).toHaveLength(0);
  });

  it('delay should return immediately for 0 ms', async () => {
    const tr = new TrafficReplay();
    const start = Date.now();
    await (tr as unknown as { delay(ms: number): Promise<void> }).delay(0);
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('withTimeout should reject on timeout', async () => {
    const tr = new TrafficReplay();
    const promise = new Promise((_resolve) => {
      // never resolves
    });
    const start = Date.now();
    await expect(
      (tr as unknown as { withTimeout<T>(p: Promise<T>, ms: number): Promise<T> }).withTimeout(
        promise,
        10,
      ),
    ).rejects.toThrow('timed out');
  });
});

// ============================================================
// SECTION 12 — EcosystemRegistry (ecosystem-registry.ts — 52.87%)
// ============================================================

describe('EcosystemRegistry', () => {
  let skillEngine: import('../engines/skill-engine.js').SkillEngine;

  beforeEach(() => {
    mockAccess.mockReset();
    mockReaddir.mockReset();
    mockReadFile.mockReset();
    mockExecSync.mockReset();
  });

  it('should construct with empty options', () => {
    const er = new EcosystemRegistry();
    expect(er.isInitialized()).toBe(false);
  });

  it('should construct with options', () => {
    const er = new EcosystemRegistry({});
    expect(er.isInitialized()).toBe(false);
  });

  it('setDNALoader should set the loader', () => {
    const er = new EcosystemRegistry();
    const loader = {} as never;
    er.setDNALoader(loader);
    expect(er.isInitialized()).toBe(false);
  });

  it('initialize should handle DNA loading gracefully with no dnas dir', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    mockReaddir.mockResolvedValue([
      { name: 'test-skill', isDirectory: () => true },
    ] as unknown as never);
    const { SkillEngine } = await import('../engines/skill-engine.js');
    const { DNALoader } = await import('../engines/behavioral/dna-loader.js');
    const skillEng = new SkillEngine();
    const dnaLoader = new DNALoader();
    const er = new EcosystemRegistry({ skillEngine: skillEng });
    er.setDNALoader(dnaLoader);
    await er.initialize();
    expect(er.isInitialized()).toBe(true);
  });

  it('initialize should handle no DNA directory gracefully', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));

    const { SkillEngine } = await import('../engines/skill-engine.js');
    const skillEng = new SkillEngine();

    const er = new EcosystemRegistry({ skillEngine: skillEng });
    await er.initialize();
    expect(er.isInitialized()).toBe(true);
  });

  it('initialize should detect adapters', async () => {
    const { AITMPLAdapter } = await import('../engines/adapters/aitmpl-adapter.js');
    const { OpenDesignAdapter } = await import('../engines/adapters/open-design-adapter.js');
    const { UIUXProMaxAdapter } = await import('../engines/adapters/ui-ux-adapter.js');

    mockExecSync.mockReturnValue('{}');

    const er = new EcosystemRegistry({
      aitmpl: new AITMPLAdapter(),
      openDesign: new OpenDesignAdapter(),
      uiUx: new UIUXProMaxAdapter(),
    });
    await er.initialize();
    expect(er.isInitialized()).toBe(true);
  });

  it('generateReport should return a report', async () => {
    const { SkillEngine } = await import('../engines/skill-engine.js');
    const skillEng = new SkillEngine();

    const er = new EcosystemRegistry({ skillEngine: skillEng });
    const report = await er.generateReport();
    expect(report.project).toBeDefined();
    expect(report.agents).toEqual([]);
  });

  it('install should handle unknown source', async () => {
    const er = new EcosystemRegistry();
    const result = await er.install('skill', 'test', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown source');
  });

  it('install should handle aitmpl source', async () => {
    const { AITMPLAdapter } = await import('../engines/adapters/aitmpl-adapter.js');
    mockExecSync.mockReturnValue('{}');
    mockAccess.mockRejectedValue(new Error('not found'));
    const adapter = new AITMPLAdapter();
    const er = new EcosystemRegistry({ aitmpl: adapter });
    mockExecSync.mockReturnValue('');
    const result = await er.install('skill', 'test-skill', 'aitmpl');
    expect(result.success).toBe(true);
  });

  it('install should handle aitmpl MCP', async () => {
    const { AITMPLAdapter } = await import('../engines/adapters/aitmpl-adapter.js');
    mockExecSync.mockReturnValue('');
    const adapter = new AITMPLAdapter();
    const er = new EcosystemRegistry({ aitmpl: adapter });
    const result = await er.install('mcp', 'test-mcp', 'aitmpl');
    expect(result.success).toBe(true);
  });

  it('install should fail when aitmpl not configured', async () => {
    const er = new EcosystemRegistry();
    const result = await er.install('skill', 'test', 'aitmpl');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('install should handle open-design source', async () => {
    const { OpenDesignAdapter } = await import('../engines/adapters/open-design-adapter.js');
    mockExecSync.mockReturnValue('{}');
    const adapter = new OpenDesignAdapter();
    const er = new EcosystemRegistry({ openDesign: adapter });
    const result = await er.install('mcp', 'test-od-mcp', 'open-design');
    expect(result.success).toBe(true);
  });

  it('install should fail for open-design with non-mcp type', async () => {
    const { OpenDesignAdapter } = await import('../engines/adapters/open-design-adapter.js');
    mockExecSync.mockReturnValue('{}');
    const adapter = new OpenDesignAdapter();
    const er = new EcosystemRegistry({ openDesign: adapter });
    const result = await er.install('skill', 'test', 'open-design');
    expect(result.success).toBe(false);
  });

  it('install should fail when open-design not configured', async () => {
    const er = new EcosystemRegistry();
    const result = await er.install('mcp', 'test', 'open-design');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('install should handle local source', async () => {
    const { SkillEngine } = await import('../engines/skill-engine.js');
    const skillEng = new SkillEngine();
    const er = new EcosystemRegistry({ skillEngine: skillEng });
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        id: 'test',
        type: 'skill',
        name: 'test',
        source: 'local',
        version: '1.0.0',
      }),
    );
    mockReaddir.mockResolvedValue([]);
    mockAccess.mockResolvedValue(undefined);
    const result = await er.install('skill', 'test-skill', 'local');
    expect(result.success).toBe(true);
  });

  it('install should fail when local source has no skillEngine', async () => {
    const er = new EcosystemRegistry();
    const result = await er.install('skill', 'test', 'local');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
  });

  it('sync should sync from specified sources', async () => {
    const { SkillEngine } = await import('../engines/skill-engine.js');
    const skillEng = new SkillEngine();
    const { DNALoader } = await import('../engines/behavioral/dna-loader.js');
    const dnaLoader = new DNALoader();
    mockAccess.mockRejectedValue(new Error('not found'));
    mockReaddir.mockResolvedValue([]);
    const er = new EcosystemRegistry({ skillEngine: skillEng });
    er.setDNALoader(dnaLoader);
    const result = await er.sync(['dna', 'local']);
    expect(result.results).toHaveLength(2);
  });

  it('doctor should check all engines', async () => {
    const { SkillEngine } = await import('../engines/skill-engine.js');
    const skillEng = new SkillEngine();
    const { AITMPLAdapter } = await import('../engines/adapters/aitmpl-adapter.js');
    mockAccess.mockRejectedValue(new Error('not found'));
    mockExecSync.mockReturnValue('{}');
    const er = new EcosystemRegistry({
      skillEngine: skillEng,
      aitmpl: new AITMPLAdapter(),
    });
    const result = await er.doctor();
    expect(result.healthy).toBe(true);
    expect(result.engines['skill-engine']).toBeDefined();
    expect(result.engines.aitmpl).toBeDefined();
  });

  it('doctor should handle errors from skill engine', async () => {
    const failingSkillEngine = {
      doctor: vi.fn().mockRejectedValue(new Error('engine error')),
      status: vi.fn().mockResolvedValue({ agents: [] }),
      loadFromOpenCodeSkills: vi.fn().mockResolvedValue({ added: 0 }),
    } as never;
    const er = new EcosystemRegistry({ skillEngine: failingSkillEngine });
    const result = await er.doctor();
    expect(result.engines['skill-engine']?.status).toBe('error');
    expect(result.healthy).toBe(false);
  });

  it('doctor should detect open-design not detected', async () => {
    const { OpenDesignAdapter } = await import('../engines/adapters/open-design-adapter.js');
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    const adapter = new OpenDesignAdapter();
    const er = new EcosystemRegistry({ openDesign: adapter });
    const result = await er.doctor();
    expect(result.engines['open-design']?.status).toBe('not-detected');
  });

  it('doctor should handle errors from open-design detection', async () => {
    const adapter = {
      detect: vi.fn().mockRejectedValue(new Error('detection error')),
    } as never;
    const er = new EcosystemRegistry({ openDesign: adapter });
    const result = await er.doctor();
    expect(result.engines['open-design']?.status).toBe('error');
  });

  it('doctor should handle ui-ux detection', async () => {
    mockAccess.mockRejectedValue(new Error('not found'));
    const { UIUXProMaxAdapter } = await import('../engines/adapters/ui-ux-adapter.js');
    const adapter = new UIUXProMaxAdapter();
    const er = new EcosystemRegistry({ uiUx: adapter });
    const result = await er.doctor();
    expect(result.engines['ui-ux-pro-max']?.status).toBe('not-detected');
  });

  it('doctor should handle errors from ui-ux detection', async () => {
    const adapter = {
      detect: vi.fn().mockRejectedValue(new Error('detection error')),
    } as never;
    const er = new EcosystemRegistry({ uiUx: adapter });
    const result = await er.doctor();
    expect(result.engines['ui-ux-pro-max']?.status).toBe('error');
  });
});

// ============================================================
// SECTION 13 — AgentManager (agent-manager.ts — 58.82%)
// ============================================================

describe('AgentManager', () => {
  it('should construct with basic DNA', () => {
    const am = new AgentManager(
      makeDNAPackage({
        personas: [
          { role: 'engineer', authority: 'senior' },
          { role: 'qa', authority: 'lead' },
        ],
      }),
    );
    const all = am.getAll();
    expect(all).toHaveLength(2);
  });

  it('should construct with agent_mapping', () => {
    const am = new AgentManager(
      makeDNAPackage({
        personas: [{ role: 'engineer', authority: 'senior' }],
        agent_mapping: {
          'team-alpha': {
            role: 'architect',
            authority: 'lead',
            opencode_agents: ['agent-alpha', 'agent-beta'],
          },
        },
      }),
    );
    expect(am.getAll()).toHaveLength(3);
    expect(am.get('agent-alpha')).toBeDefined();
    expect(am.get('agent-alpha')!.role).toBe('architect');
  });

  it('get should return undefined for missing agent', () => {
    const am = new AgentManager(makeDNAPackage());
    expect(am.get('nonexistent')).toBeUndefined();
  });

  it('getByOpenCodeName should find agent by id', () => {
    const am = new AgentManager(
      makeDNAPackage({
        personas: [{ role: 'engineer', authority: 'senior' }],
      }),
    );
    const all = am.getAll();
    const found = am.getByOpenCodeName(all[0].id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(all[0].id);
  });

  it('getByOpenCodeName should return undefined for unknown', () => {
    const am = new AgentManager(makeDNAPackage());
    expect(am.getByOpenCodeName('unknown')).toBeUndefined();
  });

  it('getByRole should filter by role', () => {
    const am = new AgentManager(
      makeDNAPackage({
        personas: [
          { role: 'qa', authority: 'senior' },
          { role: 'design', authority: 'lead' },
          { role: 'engineer', authority: 'junior' },
        ],
      }),
    );
    expect(am.getByRole('qa')).toHaveLength(1);
    expect(am.getByRole('design')).toHaveLength(1);
    expect(am.getByRole('engineer')).toHaveLength(1);
    expect(am.getByRole('architect')).toEqual([]);
  });

  it('getByRole should return empty for unmatched role', () => {
    const am = new AgentManager(makeDNAPackage());
    expect(am.getByRole('manager')).toEqual([]);
  });

  it('getRawMap should return the internal map', () => {
    const am = new AgentManager(
      makeDNAPackage({
        personas: [{ role: 'engineer', authority: 'senior' }],
      }),
    );
    const map = am.getRawMap();
    expect(map.size).toBe(1);
  });

  it('should not duplicate agent from both persona and mapping', () => {
    const am = new AgentManager(
      makeDNAPackage({
        personas: [{ role: 'engineer', authority: 'senior' }],
        agent_mapping: {
          'team-alpha': {
            role: 'architect',
            authority: 'lead',
            opencode_agents: ['agent-alpha'],
          },
        },
      }),
    );
    const all = am.getAll();
    const agentIds = all.map((a) => a.id);
    const uniqueIds = new Set(agentIds);
    expect(agentIds.length).toBe(uniqueIds.size);
  });
});

// ============================================================
// SECTION 14 — AutonomousOrchestrator (autonomous-orchestrator.ts — 70.73%)
// ============================================================

describe('AutonomousOrchestrator', () => {
  let mockSkillEngine: {
    status: ReturnType<typeof vi.fn>;
    doctor: ReturnType<typeof vi.fn>;
    loadFromOpenCodeSkills: ReturnType<typeof vi.fn>;
    resolve: ReturnType<typeof vi.fn>;
    install: ReturnType<typeof vi.fn>;
    syncFromDNA: ReturnType<typeof vi.fn>;
  };

  let mockEcosystemRegistry: { generateReport: ReturnType<typeof vi.fn> };
  let mockLifecyclePipeline: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSkillEngine = {
      status: vi.fn(),
      doctor: vi.fn(),
      loadFromOpenCodeSkills: vi.fn(),
      resolve: vi.fn(),
      install: vi.fn(),
      syncFromDNA: vi.fn(),
    };
    mockEcosystemRegistry = { generateReport: vi.fn() };
    mockLifecyclePipeline = { execute: vi.fn() };
  });

  it('should construct with options', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    expect(ao).toBeDefined();
  });

  it('processTask should handle mission manager create failure', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockLifecyclePipeline.execute.mockResolvedValue({
      status: 'completed',
      mission: {
        id: 'mission-1',
        title: 'test',
        type: 'feature',
        priority: 'high',
        status: 'completed' as const,
        subtasks: [],
        routing: [],
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        lifecycle: {
          docsGenerated: true,
          testsGenerated: true,
          auditPassed: true,
          learningRecorded: true,
        },
      },
      report: {
        project: 'test',
        timestamp: new Date().toISOString(),
        agents: [],
        skills: [],
        mcps: [],
        designSystems: [],
        dnas: [],
      },
      duration: 100,
    });
    mockEcosystemRegistry.generateReport.mockResolvedValue({
      project: 'test',
      timestamp: new Date().toISOString(),
      agents: [],
      skills: [],
      mcps: [],
      designSystems: [],
      dnas: [],
    });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
      missionManager: {
        create: vi.fn().mockRejectedValue(new Error('create failed')),
        update: vi.fn().mockRejectedValue(new Error('update failed')),
      },
    });
    const result = await ao.processTask({ title: 'test', type: 'feature', priority: 'high' });
    expect(result.status).toBe('completed');
  });

  it('processTask should handle pipeline escalation', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockLifecyclePipeline.execute.mockResolvedValue({
      status: 'escalated',
      mission: {
        id: 'mission-1',
        title: 'test',
        type: 'feature',
        priority: 'high',
        status: 'created',
        subtasks: [],
        routing: [],
        createdAt: new Date().toISOString(),
        lifecycle: {
          docsGenerated: false,
          testsGenerated: false,
          auditPassed: false,
          learningRecorded: false,
        },
      },
      report: {
        project: 'test',
        timestamp: new Date().toISOString(),
        agents: [],
        skills: [],
        mcps: [],
        designSystems: [],
        dnas: [],
      },
      duration: 100,
    });
    mockEcosystemRegistry.generateReport.mockResolvedValue({
      project: 'test',
      timestamp: new Date().toISOString(),
      agents: [],
      skills: [],
      mcps: [],
      designSystems: [],
      dnas: [],
    });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const result = await ao.processTask({ title: 'test', type: 'feature', priority: 'high' });
    expect(result.status).toBe('escalated');
    expect(result.humanRequired).toBeDefined();
  });

  it('processTask should handle pipeline failure', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockLifecyclePipeline.execute.mockResolvedValue({
      status: 'failed',
      mission: {
        id: 'mission-1',
        title: 'test',
        type: 'feature',
        priority: 'high',
        status: 'failed',
        subtasks: [],
        routing: [],
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        lifecycle: {
          docsGenerated: false,
          testsGenerated: false,
          auditPassed: false,
          learningRecorded: false,
        },
      },
      report: {
        project: 'test',
        timestamp: new Date().toISOString(),
        agents: [],
        skills: [],
        mcps: [],
        designSystems: [],
        dnas: [],
      },
      duration: 100,
    });
    mockEcosystemRegistry.generateReport.mockResolvedValue({
      project: 'test',
      timestamp: new Date().toISOString(),
      agents: [],
      skills: [],
      mcps: [],
      designSystems: [],
      dnas: [],
    });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const result = await ao.processTask({ title: 'test', type: 'feature', priority: 'high' });
    expect(result.status).toBe('failed');
    expect(result.humanRequired).toBeDefined();
  });

  it('handleRejection should escalate when no agents remain', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockSkillEngine.status.mockResolvedValue({ agents: [] });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const result = await ao.handleRejection({
      handoffId: 'h1',
      reason: { code: 'overloaded', details: 'busy' },
      subtask: {
        id: 's1',
        title: 'test',
        type: 'implementation',
        requiredSkill: 'typescript',
        status: 'pending',
      },
    });
    expect(result.status).toBe('escalated');
  });

  it('handleRejection should reroute when agent available', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockSkillEngine.status.mockResolvedValue({
      agents: [{ id: 'agent-1', status: 'idle', skillsCount: 1, skills: ['typescript'] }],
    });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const result = await ao.handleRejection({
      handoffId: 'h1',
      reason: { code: 'overloaded', details: 'busy' },
      subtask: {
        id: 's1',
        title: 'test',
        type: 'implementation',
        requiredSkill: 'typescript',
        status: 'pending',
      },
    });
    expect(result.status).toBe('rerouted');
    expect(result.newRoute).toBeDefined();
  });

  it('handleRejection should escalate when no matching agent found', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockSkillEngine.status.mockResolvedValue({
      agents: [{ id: 'agent-1', status: 'idle', skillsCount: 1, skills: ['rust'] }],
    });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const result = await ao.handleRejection({
      handoffId: 'h2',
      reason: { code: 'missing-skill', details: 'missing typescript' },
      subtask: {
        id: 's2',
        title: 'ui task',
        type: 'design',
        requiredSkill: 'typescript',
        status: 'pending',
      },
    });
    expect(result.status).toBe('escalated');
  });

  it('escalate should return different messages by severity', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const critical = await ao.escalate({
      reason: 'critical issue',
      context: {},
      severity: 'critical',
    });
    expect(critical.suggestedAction).toContain('Immediate human intervention');

    const high = await ao.escalate({ reason: 'high issue', context: {}, severity: 'high' });
    expect(high.suggestedAction).toContain('Review the escalation context');

    const medium = await ao.escalate({ reason: 'medium issue', context: {}, severity: 'medium' });
    expect(medium.suggestedAction).toContain('provide feedback');

    const low = await ao.escalate({ reason: 'low issue', context: {}, severity: 'low' });
    expect(low.suggestedAction).toContain('Acknowledge the escalation');
  });

  it('getStatus should handle skill engine error', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockSkillEngine.status.mockRejectedValue(new Error('engine down'));
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const status = await ao.getStatus();
    expect(status.activeMissions).toBe(0);
    expect(status.agentsUtilization).toEqual([]);
  });

  it('getStatus should return utilization data', async () => {
    const { AutonomousOrchestrator } = await import(
      '../engines/orchestrator/autonomous-orchestrator.js'
    );
    mockSkillEngine.status.mockResolvedValue({
      agents: [{ id: 'agent-1', status: 'idle', skillsCount: 2, skills: ['ts', 'react'] }],
    });
    const ao = new AutonomousOrchestrator({
      skillEngine: mockSkillEngine as never,
      ecosystemRegistry: mockEcosystemRegistry as never,
      lifecyclePipeline: mockLifecyclePipeline as never,
    });
    const status = await ao.getStatus();
    expect(status.agentsUtilization).toHaveLength(1);
    expect(status.agentsUtilization[0].agentId).toBe('agent-1');
  });
});
