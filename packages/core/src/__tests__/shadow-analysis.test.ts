import { describe, expect, it } from 'vitest';
import { DiffAnalyzer } from '../shadow/diff-analyzer';
import type { CapturedTraffic } from '../shadow/traffic-capture';
import { TrafficCapture } from '../shadow/traffic-capture';
import { TrafficReplay } from '../shadow/traffic-replay';

// ============================================================
// DiffAnalyzer Tests
// ============================================================

describe('DiffAnalyzer', () => {
  const makeCapture = (overrides: Partial<CapturedTraffic> = {}): CapturedTraffic => ({
    id: 'cap-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    latencyMs: 100,
    method: 'GET',
    path: '/api/users',
    request: {},
    response: { name: 'Alice', age: 30 },
    statusCode: 200,
    sampling: { strategy: 'random', sampleRate: 0.1, selected: true },
    tags: {},
    ...overrides,
  });

  const makeReplay = (
    overrides: Partial<import('../shadow/traffic-replay').ReplayResult> = {},
  ) => ({
    id: 'replay-1',
    captureId: 'cap-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    shadowResponse: {},
    shadowStatusCode: 200,
    shadowLatencyMs: 100,
    success: true,
    ...overrides,
  });

  describe('DiffAnalyzer core', () => {
    it('detects identical responses — drift score 0', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { name: 'Alice', age: 30 } });
      const replay = makeReplay({ shadowResponse: { name: 'Alice', age: 30 } });
      const result = analyzer.analyze(capture, replay);
      expect(result.driftScore).toBe(0);
      expect(result.findings).toHaveLength(0);
      expect(result.statusCodeMatch).toBe(true);
    });

    it('detects status code mismatch', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ statusCode: 200 });
      const replay = makeReplay({ shadowStatusCode: 500 });
      const result = analyzer.analyze(capture, replay);
      expect(result.statusCodeMatch).toBe(false);
      expect(result.findings.some((f) => f.category === 'error-introduced')).toBe(true);
      expect(result.driftScore).toBeGreaterThan(0);
    });

    it('detects body value differences', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { name: 'Alice', age: 30 } });
      const replay = makeReplay({ shadowResponse: { name: 'Bob', age: 30 } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'body-value')).toBe(true);
      expect(result.driftScore).toBeGreaterThan(0);
    });

    it('detects field missing in shadow', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { name: 'Alice', email: 'a@b.com' } });
      const replay = makeReplay({ shadowResponse: { name: 'Alice' } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'field-missing')).toBe(true);
    });

    it('detects field added in shadow', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { name: 'Alice' } });
      const replay = makeReplay({ shadowResponse: { name: 'Alice', extra: 'new' } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'field-added')).toBe(true);
    });

    it('detects nested object differences', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { user: { name: 'Alice', age: 30 } } });
      const replay = makeReplay({ shadowResponse: { user: { name: 'Alice', age: 31 } } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'body-value')).toBe(true);
      expect(result.findings.some((f) => f.path === 'user.age')).toBe(true);
    });

    it('detects array length changes', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { items: [1, 2, 3] } });
      const replay = makeReplay({ shadowResponse: { items: [1, 2] } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'schema-change')).toBe(true);
    });

    it('detects type change (object to array)', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { data: { key: 'val' } } });
      const replay = makeReplay({ shadowResponse: { data: [1, 2] } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'schema-change')).toBe(true);
    });

    it('ignores fields in ignoreFields list', () => {
      const analyzer = new DiffAnalyzer({ ignoreFields: ['ignoredField'] });
      const capture = makeCapture({ response: { ignoredField: 'old', name: 'Alice' } });
      const replay = makeReplay({ shadowResponse: { ignoredField: 'new', name: 'Alice' } });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings).toHaveLength(0);
    });

    it('detects latency regression', () => {
      const analyzer = new DiffAnalyzer({ latencyMinDeltaMs: 10 });
      const capture = makeCapture({ latencyMs: 100 });
      const replay = makeReplay({ shadowLatencyMs: 200 });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'latency-regression')).toBe(true);
    });

    it('detects latency improvement', () => {
      const analyzer = new DiffAnalyzer({ latencyMinDeltaMs: 10 });
      const capture = makeCapture({ latencyMs: 200 });
      const replay = makeReplay({ shadowLatencyMs: 100 });
      const result = analyzer.analyze(capture, replay);
      expect(result.findings.some((f) => f.category === 'latency-improvement')).toBe(true);
    });

    it('classifies security-critical fields as critical severity', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { token: 'abc' } });
      const replay = makeReplay({ shadowResponse: { token: 'xyz' } });
      const result = analyzer.analyze(capture, replay);
      const finding = result.findings.find((f) => f.path === 'token');
      expect(finding?.severity).toBe('critical');
    });

    it('classifies safety-critical fields as high severity', () => {
      const analyzer = new DiffAnalyzer();
      const capture = makeCapture({ response: { amount: 100 } });
      const replay = makeReplay({ shadowResponse: { amount: 200 } });
      const result = analyzer.analyze(capture, replay);
      const finding = result.findings.find((f) => f.path === 'amount');
      expect(finding?.severity).toBe('high');
    });

    it('analyzeBatch produces correct summary', () => {
      const analyzer = new DiffAnalyzer();
      const captures = [
        makeCapture({ id: 'cap-1', response: { x: 1 } }),
        makeCapture({ id: 'cap-2', response: { x: 2 } }),
      ];
      const replays = [
        makeReplay({ captureId: 'cap-1', shadowResponse: { x: 1 } }),
        makeReplay({ captureId: 'cap-2', shadowResponse: { x: 99 } }),
      ];
      const summary = analyzer.analyzeBatch(captures, replays);
      expect(summary.totalPairs).toBe(2);
      expect(summary.meanDriftScore).toBeGreaterThan(0);
      expect(summary.recommendation).toBeDefined();
    });

    it('analyzeBatch skips unmatched replays', () => {
      const analyzer = new DiffAnalyzer();
      const captures = [makeCapture({ id: 'cap-1' })];
      const replays = [makeReplay({ captureId: 'no-match' })];
      const summary = analyzer.analyzeBatch(captures, replays);
      expect(summary.totalPairs).toBe(0);
      expect(summary.recommendation).toBe('investigate');
    });

    it('determineRecommendation returns rollback for high regression rate', () => {
      const analyzer = new DiffAnalyzer();
      const captures = [makeCapture({ id: 'cap-1', statusCode: 200 })];
      const replays = [makeReplay({ captureId: 'cap-1', shadowStatusCode: 500 })];
      const summary = analyzer.analyzeBatch(captures, replays);
      expect(summary.regressions).toBeGreaterThan(0);
    });

    it('getConfig returns the active config', () => {
      const analyzer = new DiffAnalyzer({ driftThreshold: 50 });
      expect(analyzer.getConfig().driftThreshold).toBe(50);
    });
  });

  describe('TrafficCapture', () => {
    it('capture returns entry when sampled', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      const entry = capture.capture({
        method: 'GET',
        path: '/api/test',
        request: { key: 'val' },
        response: { data: 'ok' },
        statusCode: 200,
        latencyMs: 50,
      });
      expect(entry).not.toBeNull();
      expect(entry!.method).toBe('GET');
      expect(entry!.path).toBe('/api/test');
      expect(entry!.statusCode).toBe(200);
    });

    it('capture returns null when not sampled', () => {
      const capture = new TrafficCapture({ sampleRate: 0, strategy: 'random' });
      const entry = capture.capture({
        method: 'GET',
        path: '/api/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 50,
      });
      expect(entry).toBeNull();
    });

    it('capture sanitizes sensitive fields', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      const entry = capture.capture({
        method: 'POST',
        path: '/api/login',
        request: { username: 'alice', password: 'secret123' },
        response: { token: 'abc' },
        statusCode: 200,
        latencyMs: 10,
      });
      expect(entry!.request.password).toBe('[REDACTED]');
    });

    it('getEntries returns a copy of the buffer', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/a',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      const entries = capture.getEntries();
      expect(entries).toHaveLength(1);
      entries.push({} as any);
      expect(capture.getEntries()).toHaveLength(1);
    });

    it('getEntriesByPath filters by path pattern', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/api/users',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      capture.capture({
        method: 'GET',
        path: '/api/orders',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      const entries = capture.getEntriesByPath('/api/users');
      expect(entries).toHaveLength(1);
      expect(entries[0].path).toBe('/api/users');
    });

    it('getErrorEntries returns entries with errors', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/ok',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      capture.capture({
        method: 'GET',
        path: '/err',
        request: {},
        response: {},
        statusCode: 500,
        latencyMs: 10,
      });
      const errors = capture.getErrorEntries();
      expect(errors).toHaveLength(1);
      expect(errors[0].statusCode).toBe(500);
    });

    it('getSlowEntries filters by latency threshold', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/fast',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      capture.capture({
        method: 'GET',
        path: '/slow',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 2000,
      });
      const slow = capture.getSlowEntries(500);
      expect(slow).toHaveLength(1);
      expect(slow[0].path).toBe('/slow');
    });

    it('getEntryById returns correct entry', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      const entry = capture.capture({
        method: 'GET',
        path: '/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      const found = capture.getEntryById(entry!.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(entry!.id);
    });

    it('clear resets the buffer', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      capture.clear();
      expect(capture.getEntries()).toHaveLength(0);
    });

    it('getStats returns correct counters', () => {
      const capture = new TrafficCapture({ sampleRate: 0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      const stats = capture.getStats();
      expect(stats.totalCaptured).toBe(0);
      expect(stats.totalDiscarded).toBe(1);
      expect(stats.buffered).toBe(0);
    });

    it('error-only strategy only captures errors', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'error-only' });
      capture.capture({
        method: 'GET',
        path: '/ok',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      capture.capture({
        method: 'GET',
        path: '/err',
        request: {},
        response: {},
        statusCode: 500,
        latencyMs: 10,
      });
      expect(capture.getEntries()).toHaveLength(1);
      expect(capture.getEntries()[0].statusCode).toBe(500);
    });

    it('slow-only strategy only captures slow requests', () => {
      const capture = new TrafficCapture({
        sampleRate: 1.0,
        strategy: 'slow-only',
        slowThresholdMs: 100,
      });
      capture.capture({
        method: 'GET',
        path: '/fast',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      capture.capture({
        method: 'GET',
        path: '/slow',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 200,
      });
      expect(capture.getEntries()).toHaveLength(1);
      expect(capture.getEntries()[0].path).toBe('/slow');
    });

    it('head strategy captures first N entries', () => {
      const capture = new TrafficCapture({ sampleRate: 0.5, strategy: 'head', maxBufferSize: 10 });
      for (let i = 0; i < 10; i++) {
        capture.capture({
          method: 'GET',
          path: `/item/${i}`,
          request: {},
          response: {},
          statusCode: 200,
          latencyMs: 10,
        });
      }
      expect(capture.getEntries()).toHaveLength(5);
    });

    it('deterministic strategy uses bucket counter', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'deterministic' });
      const entry = capture.capture({
        method: 'GET',
        path: '/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      expect(entry).not.toBeNull();
    });

    it('sanitize recursively redacts sensitive fields', () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      const entry = capture.capture({
        method: 'POST',
        path: '/api/login',
        request: { credentials: { password: 'secret', token: 'abc' }, username: 'alice' },
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      expect(entry!.request.credentials).toEqual({ password: '[REDACTED]', token: '[REDACTED]' });
      expect(entry!.request.username).toBe('alice');
    });

    it('flush throws without persist path', async () => {
      const capture = new TrafficCapture({ sampleRate: 1.0, strategy: 'random' });
      capture.capture({
        method: 'GET',
        path: '/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      await expect(capture.flush()).rejects.toThrow('No persist path configured');
    });
  });

  describe('TrafficReplay', () => {
    it('replayOne returns result with success', async () => {
      const replay = new TrafficReplay();
      const capture = makeCapture();
      const handler = async () => ({ response: { result: 'ok' }, statusCode: 200 });
      const result = await replay.replayOne(capture, handler);
      expect(result.success).toBe(true);
      expect(result.shadowStatusCode).toBe(200);
      expect(result.shadowResponse).toEqual({ result: 'ok' });
    });

    it('replayOne captures error on handler failure', async () => {
      const replay = new TrafficReplay();
      const capture = makeCapture();
      const handler = async () => {
        throw new Error('handler failed');
      };
      const result = await replay.replayOne(capture, handler);
      expect(result.success).toBe(false);
      expect(result.error).toBe('handler failed');
    });

    it('replayOne retries on failure', async () => {
      let attempts = 0;
      const replay = new TrafficReplay({ retries: 2, delayMs: 1 });
      const capture = makeCapture();
      const handler = async () => {
        attempts++;
        if (attempts < 3) throw new Error('not yet');
        return { response: { ok: true }, statusCode: 200 };
      };
      const result = await replay.replayOne(capture, handler);
      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it('replayBatch replays all captures', async () => {
      const replay = new TrafficReplay({ concurrency: 2 });
      const captures = [
        makeCapture({ id: 'c1' }),
        makeCapture({ id: 'c2' }),
        makeCapture({ id: 'c3' }),
      ];
      const handler = async () => ({ response: { ok: true }, statusCode: 200 });
      const { results, stats } = await replay.replayBatch(captures, handler);
      expect(results).toHaveLength(3);
      expect(stats.total).toBe(3);
      expect(stats.succeeded).toBe(3);
    });

    it('replayBatch reports progress via callback', async () => {
      const replay = new TrafficReplay({ concurrency: 1 });
      const captures = [makeCapture({ id: 'c1' }), makeCapture({ id: 'c2' })];
      const handler = async () => ({ response: { ok: true }, statusCode: 200 });
      const progress: number[] = [];
      await replay.replayBatch(captures, handler, (completed) => {
        progress.push(completed);
      });
      expect(progress).toEqual([1, 2]);
    });

    it('getResults returns a copy', () => {
      const replay = new TrafficReplay();
      const results = replay.getResults();
      results.push({} as any);
      expect(replay.getResults()).toHaveLength(0);
    });

    it('getFailures returns only failed results', async () => {
      const replay = new TrafficReplay();
      const capture = makeCapture();
      const handler = async () => {
        throw new Error('fail');
      };
      await replay.replayOne(capture, handler);
      const failures = replay.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0].success).toBe(false);
    });

    it('getStatusMismatches detects status code differences', async () => {
      const replay = new TrafficReplay();
      const capture = makeCapture({ id: 'c1', statusCode: 200 });
      const handler = async () => ({ response: {}, statusCode: 500 });
      await replay.replayOne(capture, handler);
      const mismatches = replay.getStatusMismatches([capture]);
      expect(mismatches).toHaveLength(1);
    });

    it('clear resets results', async () => {
      const replay = new TrafficReplay();
      const capture = makeCapture();
      const handler = async () => ({ response: {}, statusCode: 200 });
      await replay.replayOne(capture, handler);
      replay.clear();
      expect(replay.getResults()).toHaveLength(0);
    });
  });
});
