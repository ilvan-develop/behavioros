import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoggingEngine } from '../engines/observability/logging-engine';
import { MetricsEngine } from '../engines/observability/metrics-engine';
import { TracingEngine } from '../engines/observability/tracing-engine';

// ============================================================
// Observability Engines — MetricsEngine Tests
// ============================================================

describe('MetricsEngine', () => {
  let engine: MetricsEngine;

  beforeEach(() => {
    engine = new MetricsEngine();
  });

  it('increment creates a counter metric with default value 1', () => {
    engine.increment('requests');
    const metrics = engine.getMetric('requests');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].type).toBe('counter');
    expect(metrics[0].value).toBe(1);
  });

  it('increment accepts custom value and labels', () => {
    engine.increment('requests', 5, { path: '/api' });
    const metrics = engine.getMetric('requests');
    expect(metrics[0].value).toBe(5);
    expect(metrics[0].labels).toEqual({ path: '/api' });
  });

  it('gauge stores a gauge-type metric', () => {
    engine.gauge('memory', 256);
    const metrics = engine.getMetric('memory');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].type).toBe('gauge');
    expect(metrics[0].value).toBe(256);
  });

  it('gauge updates value on subsequent calls', () => {
    engine.gauge('memory', 256);
    engine.gauge('memory', 128);
    const metrics = engine.getMetric('memory');
    expect(metrics).toHaveLength(2);
    expect(metrics[1].value).toBe(128);
  });

  it('observe stores a histogram-type metric', () => {
    engine.observe('latency', 42.5);
    const metrics = engine.getMetric('latency');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].type).toBe('histogram');
    expect(metrics[0].value).toBe(42.5);
  });

  it('timer measures async function duration', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const elapsed = await engine.timer('db-query', fn);
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(fn).toHaveBeenCalledTimes(1);
    const metrics = engine.getMetric('db-query');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].type).toBe('timer');
  });

  it('timer records metric even if function throws', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(engine.timer('failing-op', fn)).resolves.toBeGreaterThanOrEqual(0);
    const metrics = engine.getMetric('failing-op');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].type).toBe('timer');
  });

  it('getMetric returns empty array for unknown name', () => {
    expect(engine.getMetric('nonexistent')).toEqual([]);
  });

  it('getAll returns all metrics grouped by name', () => {
    engine.increment('a');
    engine.increment('b');
    engine.gauge('c', 1);
    const all = engine.getAll();
    expect(Object.keys(all)).toEqual(['a', 'b', 'c']);
    expect(all.a).toHaveLength(1);
    expect(all.b).toHaveLength(1);
    expect(all.c).toHaveLength(1);
  });

  it('reset clears all metrics when called without name', () => {
    engine.increment('a');
    engine.increment('b');
    engine.reset();
    expect(engine.getAll()).toEqual({});
  });

  it('reset clears a single metric when name is provided', () => {
    engine.increment('a');
    engine.increment('b');
    engine.reset('a');
    expect(engine.getMetric('a')).toEqual([]);
    expect(engine.getMetric('b')).toHaveLength(1);
  });
});

// ============================================================
// TracingEngine Tests
// ============================================================

describe('TracingEngine', () => {
  let engine: TracingEngine;

  beforeEach(() => {
    engine = new TracingEngine();
  });

  it('startSpan creates a span with id and traceId', () => {
    const span = engine.startSpan('http-request');
    expect(span.id).toBeDefined();
    expect(span.traceId).toBeDefined();
    expect(span.name).toBe('http-request');
    expect(span.status).toBe('ok');
  });

  it('startSpan accepts attributes', () => {
    const span = engine.startSpan('query', { db: 'postgres' });
    expect(span.attributes).toEqual({ db: 'postgres' });
  });

  it('endSpan sets endTime, duration, and status', () => {
    const span = engine.startSpan('slow-op');
    engine.endSpan(span.id, 'error');
    const stored = engine.getSpan(span.id);
    expect(stored?.endTime).toBeDefined();
    expect(stored?.duration).toBeGreaterThanOrEqual(0);
    expect(stored?.status).toBe('error');
  });

  it('endSpan does nothing for unknown span id', () => {
    expect(() => engine.endSpan('unknown')).not.toThrow();
  });

  it('getTrace returns all spans for a traceId', () => {
    const s1 = engine.startSpan('op1');
    const s2 = engine.startSpan('op2');
    const _s2withTrace = { ...s2, traceId: s1.traceId };
    engine.endSpan(s2.id);
    engine.endSpan(s1.id);

    const spans = engine.getTrace(s1.traceId);
    expect(spans.length).toBeGreaterThanOrEqual(1);
    expect(spans.every((s) => s.traceId === s1.traceId)).toBe(true);
  });

  it('getTrace returns empty array for unknown trace', () => {
    expect(engine.getTrace('unknown')).toEqual([]);
  });

  it('getSpan returns undefined for unknown id', () => {
    expect(engine.getSpan('unknown')).toBeUndefined();
  });

  it('getSpan returns a copy of the span', () => {
    const span = engine.startSpan('test');
    engine.endSpan(span.id);
    const retrieved = engine.getSpan(span.id);
    retrieved!.name = 'mutated';
    const again = engine.getSpan(span.id);
    expect(again!.name).toBe('test');
  });

  it('setSamplingRate clamps values to 0-1', () => {
    engine.setSamplingRate(1.5);
    expect(engine.export().length).toBe(0);

    const e2 = new TracingEngine();
    e2.setSamplingRate(1);
    const _s = e2.startSpan('included');
    expect(e2.export()).toHaveLength(1);
  });

  it('export returns all spans', () => {
    engine.startSpan('a');
    engine.startSpan('b');
    expect(engine.export()).toHaveLength(2);
  });
});

// ============================================================
// LoggingEngine Tests
// ============================================================

describe('LoggingEngine', () => {
  let engine: LoggingEngine;

  beforeEach(() => {
    engine = new LoggingEngine();
  });

  it('logs entries at all levels', () => {
    engine.debug('debug msg');
    engine.info('info msg');
    engine.warn('warn msg');
    engine.error('error msg');
    engine.fatal('fatal msg', 'app');
    const entries = JSON.parse(engine.export()) as { level: string }[];
    expect(entries).toHaveLength(5);
  });

  it('setLevel filters entries below threshold', () => {
    engine.setLevel('warn');
    engine.debug('skip');
    engine.info('skip');
    engine.warn('keep');
    engine.error('keep');
    const entries = JSON.parse(engine.export()) as { level: string }[];
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.level === 'warn' || e.level === 'error')).toBe(true);
  });

  it('query filters by level', () => {
    engine.info('a');
    engine.warn('b');
    engine.error('c');
    const warns = engine.query({ level: 'warn' });
    expect(warns).toHaveLength(1);
    expect(warns[0].message).toBe('b');
  });

  it('query filters by source', () => {
    engine.info('a', 'api');
    engine.info('b', 'worker');
    const apiLogs = engine.query({ source: 'api' });
    expect(apiLogs).toHaveLength(1);
    expect(apiLogs[0].message).toBe('a');
  });

  it('query filters by time range (since)', () => {
    const beforeAll = new Date(Date.now() - 60_000).toISOString();
    engine.info('entry');
    const results = engine.query({ since: beforeAll });
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe('entry');
  });

  it('query filters by time range (until)', () => {
    const afterAll = new Date(Date.now() + 60_000).toISOString();
    engine.info('entry');
    const results = engine.query({ until: afterAll });
    expect(results).toHaveLength(1);
    expect(results[0].message).toBe('entry');
  });

  it('query respects limit', () => {
    engine.info('a');
    engine.info('b');
    engine.info('c');
    const limited = engine.query({ limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('export text format produces lines', () => {
    engine.info('hello', 'app');
    const text = engine.export('text');
    expect(text).toContain('[INFO]');
    expect(text).toContain('[app]');
    expect(text).toContain('hello');
    expect(text.split('\n')).toHaveLength(1);
  });

  it('export json format produces valid JSON', () => {
    engine.info('test');
    const json = engine.export('json');
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe('test');
  });

  it('log includes metadata when provided', () => {
    engine.info('with-meta', 'svc', { userId: 42 });
    const entries = JSON.parse(engine.export());
    expect(entries[0].metadata).toEqual({ userId: 42 });
  });
});
