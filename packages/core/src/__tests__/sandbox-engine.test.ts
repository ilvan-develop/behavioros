import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EphemeralEnvironment } from '../sandbox/environments/ephemeral-env';
import { PersistentEnvironment } from '../sandbox/environments/persistent-env';
import { ShadowEnvironment } from '../sandbox/environments/shadow-env';
import { SandboxEngine } from '../sandbox/sandbox-engine';

describe('SandboxEngine', () => {
  let engine: SandboxEngine;

  beforeEach(() => {
    engine = new SandboxEngine();
  });

  it('should create an ephemeral environment with defaults', () => {
    const env = engine.createEnvironment('ephemeral', 'dna-test-1');

    expect(env.id).toMatch(/^sandbox-/);
    expect(env.name).toBe('ephemeral-dna-test-1');
    expect(env.type).toBe('ephemeral');
    expect(env.dnaId).toBe('dna-test-1');
    expect(env.status).toBe('active');
    expect(env.createdAt).toBeGreaterThan(0);
    expect(env.expiresAt).toBeUndefined();
  });

  it('should create a persistent environment with expiration', () => {
    const env = engine.createEnvironment('persistent', 'dna-persist');

    expect(env.type).toBe('persistent');
    expect(env.expiresAt).toBeDefined();
    expect(env.expiresAt!).toBeGreaterThan(env.createdAt);
    expect(env.expiresAt! - env.createdAt).toBe(24 * 60 * 60 * 1000);
  });

  it('should create a shadow environment with 7-day expiration', () => {
    const env = engine.createEnvironment('shadow', 'dna-shadow');

    expect(env.type).toBe('shadow');
    expect(env.expiresAt).toBeDefined();
    expect(env.expiresAt! - env.createdAt).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('should retrieve an environment by id', () => {
    const created = engine.createEnvironment('ephemeral', 'dna-find-me');
    const found = engine.getEnvironment(created.id);

    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.dnaId).toBe('dna-find-me');
  });

  it('should return undefined for a non-existent environment', () => {
    const result = engine.getEnvironment('non-existent');
    expect(result).toBeUndefined();
  });

  it('should destroy an environment and remove it', () => {
    const env = engine.createEnvironment('ephemeral', 'dna-to-destroy');

    const destroyed = engine.destroyEnvironment(env.id);
    expect(destroyed).toBe(true);
    expect(engine.getEnvironment(env.id)).toBeUndefined();
    expect(engine.count).toBe(0);
  });

  it('should return false when destroying a non-existent environment', () => {
    const result = engine.destroyEnvironment('ghost');
    expect(result).toBe(false);
  });

  it('should list active environments only', () => {
    engine.createEnvironment('ephemeral', 'active-1');
    engine.createEnvironment('shadow', 'active-2');
    const toDestroy = engine.createEnvironment('ephemeral', 'to-destroy');
    engine.destroyEnvironment(toDestroy.id);

    const active = engine.listActive();
    expect(active).toHaveLength(2);
    expect(active.every((e) => e.status === 'active')).toBe(true);
  });

  it('should return all environments via getAll()', () => {
    engine.createEnvironment('ephemeral', 'a');
    engine.createEnvironment('persistent', 'b');
    engine.createEnvironment('shadow', 'c');

    expect(engine.getAll()).toHaveLength(3);
  });

  it('should report correct count', () => {
    expect(engine.count).toBe(0);
    engine.createEnvironment('ephemeral', 'x');
    expect(engine.count).toBe(1);
    engine.createEnvironment('ephemeral', 'y');
    expect(engine.count).toBe(2);
  });

  it('should cleanup expired environments', () => {
    const engineWithPast = new SandboxEngine();
    const past = Date.now() - 25 * 60 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(past);
    engineWithPast.createEnvironment('persistent', 'old-1');
    engineWithPast.createEnvironment('persistent', 'old-2');
    vi.restoreAllMocks();

    const count = engineWithPast.cleanupExpired();
    expect(count).toBe(2);
    expect(engineWithPast.count).toBe(0);
  });

  it('should not cleanup non-expired environments', () => {
    engine.createEnvironment('persistent', 'fresh');
    engine.createEnvironment('shadow', 'still-good');

    const count = engine.cleanupExpired();
    expect(count).toBe(0);
    expect(engine.count).toBe(2);
  });
});

describe('EphemeralEnvironment', () => {
  it('should construct with default config', () => {
    const env = new EphemeralEnvironment();
    const config = env.getConfig();

    expect(config.memoryOnly).toBe(true);
    expect(config.maxMemoryMB).toBe(128);
    expect(config.timeout).toBe(5000);
  });

  it('should construct with partial overrides', () => {
    const env = new EphemeralEnvironment({ maxMemoryMB: 256, timeout: 10000 });
    const config = env.getConfig();

    expect(config.maxMemoryMB).toBe(256);
    expect(config.timeout).toBe(10000);
    expect(config.memoryOnly).toBe(true);
  });

  it('should set, get, has, delete, and clear key-value data', () => {
    const env = new EphemeralEnvironment();

    env.set('key1', 'value1');
    env.set('key2', { nested: true });
    expect(env.get('key1')).toBe('value1');
    expect(env.get<{ nested: boolean }>('key2')!.nested).toBe(true);
    expect(env.has('key1')).toBe(true);
    expect(env.has('missing')).toBe(false);

    expect(env.delete('key1')).toBe(true);
    expect(env.has('key1')).toBe(false);
    expect(env.delete('nope')).toBe(false);

    expect(env.getSize()).toBe(1);
    env.clear();
    expect(env.getSize()).toBe(0);
  });

  it('should throw on memory limit exceeded', () => {
    const env = new EphemeralEnvironment({ maxMemoryMB: 0 });
    expect(() => env.set('x', 'y')).toThrow('Memory limit exceeded');
  });
});

describe('PersistentEnvironment', () => {
  const config = { storagePath: '/tmp/test', maxStorageMB: 100, retentionHours: 24 };

  it('should persist state across multiple operations', () => {
    const env = new PersistentEnvironment(config);

    env.set('key-a', 'alpha');
    env.set('key-b', 42);
    env.set('key-c', { active: true });

    expect(env.get('key-a')).toBe('alpha');
    expect(env.get('key-b')).toBe(42);
    expect(env.get<{ active: boolean }>('key-c')!.active).toBe(true);
    expect(env.has('key-a')).toBe(true);
    expect(env.has('missing')).toBe(false);
    expect(env.size).toBe(3);
  });

  it('should return entries with timestamps', () => {
    const env = new PersistentEnvironment(config);
    const before = Date.now();
    env.set('ts-key', 'ts-value');
    const after = Date.now();

    const entries = env.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('ts-key');
    expect(entries[0].value).toBe('ts-value');
    expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(entries[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('should delete individual entries', () => {
    const env = new PersistentEnvironment(config);
    env.set('keep', 'this');
    env.set('remove', 'that');

    expect(env.delete('remove')).toBe(true);
    expect(env.has('remove')).toBe(false);
    expect(env.has('keep')).toBe(true);
    expect(env.delete('nope')).toBe(false);
  });

  it('should clear all entries and reset size', () => {
    const env = new PersistentEnvironment(config);
    env.set('a', 1);
    env.set('b', 2);
    expect(env.size).toBe(2);

    env.clear();
    expect(env.size).toBe(0);
    expect(env.getEntries()).toHaveLength(0);
  });

  it('should cleanup old entries beyond retention window', () => {
    vi.useFakeTimers();
    const env = new PersistentEnvironment({ ...config, retentionHours: 1 });

    env.set('fresh', 'new');
    vi.advanceTimersByTime(61 * 60 * 1000);
    env.set('also-fresh', 'also');
    vi.advanceTimersByTime(30 * 60 * 1000);

    const removed = env.cleanupOldEntries();
    expect(removed).toBe(1);
    expect(env.has('fresh')).toBe(false);
    expect(env.has('also-fresh')).toBe(true);
    expect(env.size).toBe(1);

    vi.useRealTimers();
  });

  it('should return a copy of config', () => {
    const env = new PersistentEnvironment(config);
    const got = env.getConfig();

    expect(got).toEqual(config);
    got.storagePath = '/hacked';
    expect(env.getConfig().storagePath).toBe('/tmp/test');
  });
});

describe('ShadowEnvironment', () => {
  const defaultConfig = { replaySpeed: 1.0, captureTraffic: true, diffAnalysis: true };

  it('should capture traffic entries when enabled', () => {
    const env = new ShadowEnvironment(defaultConfig);

    env.captureTraffic({ path: '/test' }, { status: 200 });
    env.captureTraffic({ path: '/other' }, { status: 404 });

    const traffic = env.getTrafficCapture();
    expect(traffic).toHaveLength(2);
    expect(traffic[0]).toMatchObject({
      request: { path: '/test' },
      response: { status: 200 },
    });
    expect(traffic[0].timestamp).toBeGreaterThan(0);
    expect(traffic[1].request).toEqual({ path: '/other' });
  });

  it('should not capture traffic when captureTraffic is false', () => {
    const env = new ShadowEnvironment({ ...defaultConfig, captureTraffic: false });

    env.captureTraffic({ path: '/secret' }, { status: 200 });

    expect(env.getTrafficCapture()).toHaveLength(0);
  });

  it('should replay traffic and return status', () => {
    const env = new ShadowEnvironment(defaultConfig);

    const result = env.replayTraffic({ path: '/replay' });

    expect(result.status).toBe('replayed');
    expect(result.request).toEqual({ path: '/replay' });
  });

  it('should analyze diff between original and shadow for objects', () => {
    const env = new ShadowEnvironment(defaultConfig);

    const original = { name: 'Alice', age: 30 };
    const shadow = { name: 'Alice', age: 31 };

    const diff = env.analyzeDiff(original, shadow);

    expect(diff).toEqual({
      age: { original: 30, shadow: 31 },
    });
  });

  it('should return null from analyzeDiff when diffAnalysis is false', () => {
    const env = new ShadowEnvironment({ ...defaultConfig, diffAnalysis: false });

    const result = env.analyzeDiff({ a: 1 }, { a: 2 });

    expect(result).toBeNull();
  });

  it('should handle non-object values in computeDiff', () => {
    const env = new ShadowEnvironment(defaultConfig);

    const diff = env.analyzeDiff(42, 'hello');

    expect(diff).toEqual({ original: 42, shadow: 'hello' });
  });

  it('should accumulate diff results', () => {
    const env = new ShadowEnvironment(defaultConfig);

    env.analyzeDiff({ x: 1 }, { x: 2 });
    env.analyzeDiff({ y: 'a' }, { y: 'b' });

    const results = env.getDiffResults();
    expect(results).toHaveLength(2);
    expect(results[0].diff).toEqual({ x: { original: 1, shadow: 2 } });
    expect(results[1].diff).toEqual({ y: { original: 'a', shadow: 'b' } });
  });

  it('should return a copy of traffic and diff arrays', () => {
    const env = new ShadowEnvironment(defaultConfig);

    const traffic = env.getTrafficCapture();
    const diffs = env.getDiffResults();

    traffic.push({} as any);
    diffs.push({} as any);

    expect(env.getTrafficCapture()).toHaveLength(0);
    expect(env.getDiffResults()).toHaveLength(0);
  });

  it('should clear all captures and results', () => {
    const env = new ShadowEnvironment(defaultConfig);

    env.captureTraffic({ req: 1 }, { res: 1 });
    env.analyzeDiff({ orig: 1 }, { shad: 2 });

    expect(env.getTrafficCapture()).toHaveLength(1);
    expect(env.getDiffResults()).toHaveLength(1);

    env.clear();

    expect(env.getTrafficCapture()).toHaveLength(0);
    expect(env.getDiffResults()).toHaveLength(0);
  });

  it('should return config via getConfig()', () => {
    const env = new ShadowEnvironment(defaultConfig);

    expect(env.getConfig()).toEqual(defaultConfig);
  });
});
