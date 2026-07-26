import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertEngine } from '../engines/observability/alert-engine';
import { HealthEngine } from '../engines/observability/health-engine';
import { ProfilingEngine } from '../engines/observability/profiling-engine';

describe('ProfilingEngine', () => {
  let engine: ProfilingEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new ProfilingEngine();
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
  });

  it('should take a snapshot with all fields', () => {
    const snap = engine.snapshot();
    expect(snap.id).toBeDefined();
    expect(snap.timestamp).toBeDefined();
    expect(snap.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(snap.cpuUsage).toBeLessThanOrEqual(100);
    expect(snap.memoryUsage.heapUsed).toBeGreaterThan(0);
    expect(snap.memoryUsage.heapTotal).toBeGreaterThan(0);
    expect(snap.activeHandles).toBeGreaterThanOrEqual(0);
    expect(typeof snap.eventLoopLag).toBe('number');
  });

  it('should add snapshot to history', () => {
    engine.snapshot();
    expect(engine.getHistory().length).toBe(1);
    engine.snapshot();
    expect(engine.getHistory().length).toBe(2);
  });

  it('should start periodic snapshots', () => {
    const spy = vi.spyOn(engine, 'snapshot');
    engine.start(100);
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('should not start multiple intervals', () => {
    engine.start(100);
    engine.start(100);
    engine.start(100);
    const spy = vi.spyOn(engine, 'snapshot');
    vi.advanceTimersByTime(200);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should stop periodic snapshots', () => {
    engine.start(100);
    engine.stop();
    const spy = vi.spyOn(engine, 'snapshot');
    vi.advanceTimersByTime(300);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should return last N snapshots from getHistory', () => {
    for (let i = 0; i < 10; i++) engine.snapshot();
    const last3 = engine.getHistory(3);
    expect(last3.length).toBe(3);
    expect(last3[0].id).toBe(engine.getHistory()[7].id);
  });

  it('should return all history if count omitted', () => {
    for (let i = 0; i < 5; i++) engine.snapshot();
    expect(engine.getHistory().length).toBe(5);
  });

  it('should calculate average metrics', () => {
    engine.snapshot();
    engine.snapshot();
    const avg = engine.getAverage();
    expect(avg.cpuAvg).toBeGreaterThanOrEqual(0);
    expect(avg.memoryAvg).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(avg.memoryAvg)).toBe(false);
    expect(typeof avg.lagAvg).toBe('number');
  });

  it('should return zero averages if no snapshots', () => {
    const avg = engine.getAverage();
    expect(avg.cpuAvg).toBe(0);
    expect(avg.memoryAvg).toBe(0);
    expect(avg.lagAvg).toBe(0);
  });

  it('should clear history', () => {
    engine.snapshot();
    engine.snapshot();
    expect(engine.getHistory().length).toBe(2);
    engine.clear();
    expect(engine.getHistory().length).toBe(0);
  });
});

describe('HealthEngine', () => {
  let engine: HealthEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new HealthEngine();
  });

  afterEach(() => {
    engine.stopInterval();
    vi.useRealTimers();
  });

  it('should register a health check', () => {
    engine.register('db', async () => true);
    expect(engine.getRegisteredChecks()).toEqual(['db']);
  });

  it('should unregister a health check', () => {
    engine.register('db', async () => true);
    engine.unregister('db');
    expect(engine.getRegisteredChecks()).toEqual([]);
  });

  it('should run all checks and return healthy status', async () => {
    engine.register('db', async () => true);
    engine.register('api', async () => true);
    const status = await engine.runAll();
    expect(status.overall).toBe('healthy');
    expect(status.checks.length).toBe(2);
    expect(status.checks.every((c) => c.status === 'healthy')).toBe(true);
  });

  it('should detect unhealthy checks', async () => {
    engine.register('db', async () => true);
    engine.register('broken', async () => false);
    const status = await engine.runAll();
    expect(status.overall).toBe('unhealthy');
    const broken = status.checks.find((c) => c.name === 'broken');
    expect(broken?.status).toBe('unhealthy');
  });

  it('should handle exception in check function', async () => {
    engine.register('flaky', async () => {
      throw new Error('timeout');
    });
    const status = await engine.runAll();
    expect(status.overall).toBe('unhealthy');
    const flaky = status.checks.find((c) => c.name === 'flaky');
    expect(flaky?.status).toBe('unhealthy');
    expect(flaky?.error).toBe('timeout');
  });

  it('should return cached status via getStatus', async () => {
    await engine.runAll();
    const status = engine.getStatus();
    expect(status).toBeDefined();
    expect(status!.overall).toBe('healthy');
  });

  it('should return undefined getStatus before first run', () => {
    expect(engine.getStatus()).toBeUndefined();
  });

  it('should set auto-check interval', () => {
    const spy = vi.spyOn(engine, 'runAll');
    engine.setInterval(100);
    vi.advanceTimersByTime(300);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('should include uptime in status', async () => {
    vi.advanceTimersByTime(100);
    const status = await engine.runAll();
    expect(status.uptime).toBeGreaterThan(0);
  });

  it('should include latency per check', async () => {
    engine.register('fast', async () => true);
    const status = await engine.runAll();
    const fast = status.checks.find((c) => c.name === 'fast');
    expect(fast).toBeDefined();
    expect(fast!.latency).toBeGreaterThanOrEqual(0);
  });
});

describe('AlertEngine', () => {
  let engine: AlertEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new AlertEngine();
  });

  afterEach(() => {
    engine.clear();
    vi.useRealTimers();
  });

  it('should add a rule', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 5000,
      severity: 'warning',
      channels: ['slack'],
    });
    expect(engine.getRules().length).toBe(1);
  });

  it('should remove a rule', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 5000,
      severity: 'warning',
      channels: ['slack'],
    });
    engine.removeRule('cpu-high');
    expect(engine.getRules().length).toBe(0);
  });

  it('should fire alert after duration threshold', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 5000,
      severity: 'warning',
      channels: ['slack'],
    });

    const fired1 = engine.evaluate({ cpu: 90 });
    expect(fired1.length).toBe(0);

    vi.advanceTimersByTime(5000);
    const fired2 = engine.evaluate({ cpu: 90 });
    expect(fired2.length).toBe(1);
    expect(fired2[0].ruleId).toBe('cpu-high');
    expect(fired2[0].severity).toBe('warning');
    expect(fired2[0].value).toBe(90);
    expect(fired2[0].threshold).toBe(80);
  });

  it('should not fire duplicate active alerts', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      channels: ['slack'],
    });

    engine.evaluate({ cpu: 90 });
    const fired2 = engine.evaluate({ cpu: 90 });
    expect(fired2.length).toBe(0);
  });

  it('should evaluate lt and eq conditions', () => {
    engine.addRule({
      id: 'mem-low',
      name: 'Memory < 100MB',
      metric: 'mem',
      condition: 'lt',
      threshold: 100,
      duration: 0,
      severity: 'critical',
      channels: ['pager'],
    });

    engine.addRule({
      id: 'exact-zero',
      name: 'Errors eq 0',
      metric: 'errors',
      condition: 'eq',
      threshold: 0,
      duration: 0,
      severity: 'info',
      channels: [],
    });

    const fired = engine.evaluate({ mem: 50, errors: 0 });
    expect(fired.length).toBe(2);
  });

  it('should acknowledge an alert', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      channels: [],
    });

    const [alert] = engine.evaluate({ cpu: 90 });
    expect(alert.acknowledged).toBe(false);
    engine.acknowledge(alert.id);
    expect(engine.getAlerts('acknowledged').length).toBe(1);
  });

  it('should resolve an alert', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      channels: [],
    });

    const [alert] = engine.evaluate({ cpu: 90 });
    expect(alert.resolvedAt).toBeUndefined();
    engine.resolve(alert.id);

    const resolved = engine.getAlerts('resolved');
    expect(resolved.length).toBe(1);
    expect(resolved[0].resolvedAt).toBeDefined();
  });

  it('should filter alerts by status', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      channels: [],
    });

    const [alert] = engine.evaluate({ cpu: 90 });
    expect(engine.getAlerts('active').length).toBe(1);
    expect(engine.getAlerts('resolved').length).toBe(0);

    engine.resolve(alert.id);
    expect(engine.getAlerts('active').length).toBe(0);
    expect(engine.getAlerts('resolved').length).toBe(1);
  });

  it('should get all alerts when no status filter', () => {
    engine.addRule({
      id: 'r1',
      name: 'Rule 1',
      metric: 'm1',
      condition: 'gt',
      threshold: 0,
      duration: 0,
      severity: 'info',
      channels: [],
    });

    engine.evaluate({ m1: 1 });
    engine.evaluate({ m1: 1 });
    expect(engine.getAlerts().length).toBe(1);

    engine.addRule({
      id: 'r2',
      name: 'Rule 2',
      metric: 'm2',
      condition: 'gt',
      threshold: 0,
      duration: 0,
      severity: 'warning',
      channels: [],
    });

    engine.evaluate({ m2: 1 });
    expect(engine.getAlerts().length).toBe(2);
  });

  it('should not fire alerts for missing metrics', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      channels: [],
    });

    const fired = engine.evaluate({ mem: 90 });
    expect(fired.length).toBe(0);
  });

  it('should clear all rules and alerts', () => {
    engine.addRule({
      id: 'cpu-high',
      name: 'CPU > 80%',
      metric: 'cpu',
      condition: 'gt',
      threshold: 80,
      duration: 0,
      severity: 'warning',
      channels: [],
    });

    engine.evaluate({ cpu: 90 });
    engine.clear();
    expect(engine.getRules().length).toBe(0);
    expect(engine.getAlerts().length).toBe(0);
  });
});
