import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShadowPipeline } from '../shadow/shadow-pipeline';
import { TrafficCapture } from '../shadow/traffic-capture';

// shadow/index.ts is a barrel — skip

// ============================================================
// TrafficCapture — Edge branches
// ============================================================

describe('TrafficCapture — edge branches', () => {
  let capture: TrafficCapture;

  beforeEach(() => {
    capture = new TrafficCapture({ sampleRate: 1, strategy: 'random' });
  });

  it('should discard when sampleRate is 0', () => {
    const zeroCapture = new TrafficCapture({ sampleRate: 0, strategy: 'random' });
    const result = zeroCapture.capture({
      method: 'GET',
      path: '/api/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 50,
    });
    expect(result).toBeNull();
  });

  it('should return null from capture when sample rate rejects', () => {
    const lowCapture = new TrafficCapture({ sampleRate: 0, strategy: 'random' });
    const entry = lowCapture.capture({
      method: 'GET',
      path: '/api/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 50,
    });
    expect(entry).toBeNull();
  });

  it('should handle unknown strategy via default (random)', () => {
    const c = new TrafficCapture({ sampleRate: 1, strategy: 'unknown' as any });
    const entry = c.capture({
      method: 'GET',
      path: '/api/test',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 50,
    });
    expect(entry).not.toBeNull();
  });

  it('should use deterministic strategy', () => {
    const c = new TrafficCapture({ sampleRate: 0.5, strategy: 'deterministic' });
    let captured = 0;
    for (let i = 0; i < 100; i++) {
      const entry = c.capture({
        method: 'GET',
        path: '/api/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      if (entry) captured++;
    }
    expect(captured).toBeGreaterThan(0);
  });

  it('should use head strategy', () => {
    const c = new TrafficCapture({ sampleRate: 0.5, strategy: 'head', maxBufferSize: 10 });
    let captured = 0;
    for (let i = 0; i < 20; i++) {
      const entry = c.capture({
        method: 'GET',
        path: '/api/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      if (entry) captured++;
    }
    expect(captured).toBe(5);
  });

  it('should use tail strategy', () => {
    const c = new TrafficCapture({ sampleRate: 0.5, strategy: 'tail', maxBufferSize: 10 });
    let captured = 0;
    for (let i = 0; i < 20; i++) {
      const entry = c.capture({
        method: 'GET',
        path: '/api/test',
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      if (entry) captured++;
    }
    expect(captured).toBe(15);
  });

  it('should use error-only strategy and capture errors', () => {
    const errorCapture = new TrafficCapture({ sampleRate: 1, strategy: 'error-only' });
    const entry = errorCapture.capture({
      method: 'GET',
      path: '/api/error',
      request: {},
      response: {},
      statusCode: 500,
      latencyMs: 50,
      error: 'server error',
    });
    expect(entry).not.toBeNull();
    expect(entry!.statusCode).toBe(500);
  });

  it('should skip non-errors in error-only strategy', () => {
    const errorCapture = new TrafficCapture({ sampleRate: 1, strategy: 'error-only' });
    const entry = errorCapture.capture({
      method: 'GET',
      path: '/api/ok',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 50,
    });
    expect(entry).toBeNull();
  });

  it('should use slow-only strategy', () => {
    const slowCapture = new TrafficCapture({
      sampleRate: 1,
      strategy: 'slow-only',
      slowThresholdMs: 100,
    });
    const slow = slowCapture.capture({
      method: 'GET',
      path: '/api/slow',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 200,
    });
    expect(slow).not.toBeNull();
    const fast = slowCapture.capture({
      method: 'GET',
      path: '/api/fast',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(fast).toBeNull();
  });

  it('should auto-flush when buffer reaches max and persistPath set', () => {
    const flushSpy = vi
      .spyOn(TrafficCapture.prototype as any, 'flushSync')
      .mockImplementation(() => {});
    const c = new TrafficCapture({
      sampleRate: 1,
      strategy: 'head',
      maxBufferSize: 2,
      persistPath: '/tmp/test-flush.json',
    });
    c.capture({
      method: 'GET',
      path: '/a',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    c.capture({
      method: 'GET',
      path: '/b',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    c.capture({
      method: 'GET',
      path: '/c',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(flushSpy).toHaveBeenCalled();
    flushSpy.mockRestore();
  });

  it('flush should throw when no persist path', async () => {
    await expect(capture.flush()).rejects.toThrow('No persist path');
  });

  it('flush should do nothing when buffer is empty', async () => {
    const c = new TrafficCapture({ sampleRate: 1 });
    await c.flush('/tmp/empty-flush.json');
    expect(c.getEntries()).toHaveLength(0);
  });

  it('should load existing state from persist file', async () => {
    const c = new TrafficCapture({ sampleRate: 1, strategy: 'head' });
    c.capture({
      method: 'GET',
      path: '/a',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const path = `C:\\Users\\Ilvan\\AppData\\Local\\Temp\\traffic-load-test-${Date.now()}.json`;
    await c.flush(path);
    const c2 = new TrafficCapture({ sampleRate: 1 });
    await c2.load(path);
    expect(c2.getEntries()).toHaveLength(1);
    const { unlinkSync } = await import('node:fs');
    try {
      unlinkSync(path);
    } catch {}
  });

  it('load should throw when persist file not found', async () => {
    await expect(capture.load('/nonexistent/persist.json')).rejects.toThrow(
      'Persist file not found',
    );
  });

  it('should sanitize nested objects recursively', () => {
    const c = new TrafficCapture({ sampleRate: 1, sanitizeFields: ['secret'] });
    const entry = c.capture({
      method: 'POST',
      path: '/api/login',
      request: { user: 'test', credentials: { secret: 's3cret', nested: { secret: 'deep' } } },
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(entry).not.toBeNull();
    expect((entry!.request as any).credentials.secret).toBe('[REDACTED]');
    expect((entry!.request as any).credentials.nested.secret).toBe('[REDACTED]');
  });

  it('should get entries by path string pattern with wildcard', () => {
    capture.capture({
      method: 'GET',
      path: '/api/users/1',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    capture.capture({
      method: 'GET',
      path: '/api/posts/2',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const users = capture.getEntriesByPath('/api/users/*');
    expect(users).toHaveLength(1);
    expect(users[0].path).toBe('/api/users/1');
  });

  it('should get entries by path regex', () => {
    capture.capture({
      method: 'GET',
      path: '/api/users/1',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const matched = capture.getEntriesByPath(/\/api\/users/);
    expect(matched).toHaveLength(1);
  });

  it('should get error entries by status code >= 400', () => {
    capture.capture({
      method: 'GET',
      path: '/api/err',
      request: {},
      response: {},
      statusCode: 500,
      latencyMs: 10,
    });
    capture.capture({
      method: 'GET',
      path: '/api/ok',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const errors = capture.getErrorEntries();
    expect(errors).toHaveLength(1);
  });

  it('should get slow entries with custom threshold', () => {
    capture.capture({
      method: 'GET',
      path: '/api/slow',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 500,
    });
    capture.capture({
      method: 'GET',
      path: '/api/fast',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const slow = capture.getSlowEntries(100);
    expect(slow).toHaveLength(1);
  });

  it('should get entry by ID', () => {
    const entry = capture.capture({
      method: 'GET',
      path: '/api/t',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const found = capture.getEntryById(entry!.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(entry!.id);
  });

  it('should return undefined for unknown entry ID', () => {
    expect(capture.getEntryById('nonexistent')).toBeUndefined();
  });

  it('should get stats', () => {
    capture.capture({
      method: 'GET',
      path: '/api/stats',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    const stats = capture.getStats();
    expect(stats.buffered).toBeGreaterThan(0);
    expect(stats.totalCaptured).toBeGreaterThan(0);
    expect(stats.strategy).toBe('random');
  });

  it('should get config', () => {
    const config = capture.getConfig();
    expect(config.sampleRate).toBe(1);
  });

  it('should clear buffer', () => {
    capture.capture({
      method: 'GET',
      path: '/api/clear',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    capture.clear();
    expect(capture.getEntries()).toHaveLength(0);
  });
});

// ============================================================
// ShadowPipeline — Edge branches
// ============================================================

describe('ShadowPipeline — edge branches', () => {
  let pipeline: ShadowPipeline;

  beforeEach(() => {
    pipeline = new ShadowPipeline({ projectName: 'test', dnaVersion: '1.0.0' });
  });

  it('should handle execute with no persistDir (skip persist)', async () => {
    const capture = pipeline.getCapture();
    capture.capture({
      method: 'GET',
      path: '/api/t',
      request: {},
      response: { ok: true },
      statusCode: 200,
      latencyMs: 10,
    });
    const handler = async () => ({ response: { ok: true }, statusCode: 200 });
    const result = await pipeline.execute(capture.getEntries(), handler);
    expect(result.status).toBe('completed');
  });

  it('should handle execute with generateCompliance=false', async () => {
    const p = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      generateCompliance: false,
    });
    const capture = p.getCapture();
    capture.capture({
      method: 'GET',
      path: '/api/t',
      request: {},
      response: { ok: true },
      statusCode: 200,
      latencyMs: 10,
    });
    const handler = async () => ({ response: { ok: true }, statusCode: 200 });
    const result = await p.execute(capture.getEntries(), handler);
    expect(result.status).toBe('completed');
    expect(result.complianceReport).toBeNull();
  });

  it('should handle execute with persistDir', async () => {
    const p = new ShadowPipeline({
      projectName: 'test',
      dnaVersion: '1.0.0',
      persistDir: 'C:\\Users\\Ilvan\\AppData\\Local\\Temp\\shadow-persist-test',
    });
    const capture = p.getCapture();
    capture.capture({
      method: 'GET',
      path: '/api/t',
      request: {},
      response: { ok: true },
      statusCode: 200,
      latencyMs: 10,
    });
    const handler = async () => ({ response: { ok: true }, statusCode: 200 });
    const result = await p.execute(capture.getEntries(), handler);
    expect(result.status).toBe('completed');
  });

  it('load should not fail when history file missing', async () => {
    await pipeline.load('/nonexistent-shadow-dir');
    expect(pipeline.getHistory()).toEqual([]);
  });

  it('persist should throw with no persistDir', async () => {
    await expect(pipeline.persist()).rejects.toThrow('No persist directory');
  });
});
