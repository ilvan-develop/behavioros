import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceManager } from '../engines/runtime/resource-manager';
import { RetryManager } from '../engines/runtime/retry-manager';
import { TimeoutError, TimeoutManager } from '../engines/runtime/timeout-manager';

// ============================================================
// RetryManager Tests
// ============================================================

describe('RetryManager', () => {
  describe('delay computation', () => {
    it('should compute exponential backoff without jitter', () => {
      const rm = new RetryManager({ jitter: false });
      expect(rm.computeDelay(0)).toBe(1000);
      expect(rm.computeDelay(1)).toBe(2000);
      expect(rm.computeDelay(2)).toBe(4000);
    });

    it('should cap delay at maxDelay', () => {
      const rm = new RetryManager({ baseDelay: 10000, jitter: false });
      expect(rm.computeDelay(10)).toBe(30000);
    });

    it('should apply jitter within expected range', () => {
      const rm = new RetryManager();
      const delays = Array.from({ length: 100 }, () => rm.computeDelay(2));
      for (const d of delays) {
        expect(d).toBeGreaterThanOrEqual(2000 * 0.5);
        expect(d).toBeLessThanOrEqual(4000);
      }
    });

    it('should not apply jitter when disabled', () => {
      const rm = new RetryManager({ jitter: false });
      expect(rm.computeDelay(0)).toBe(1000);
      expect(rm.computeDelay(1)).toBe(2000);
    });
  });

  describe('shouldRetry', () => {
    it('should retry on matching retryable error', () => {
      const rm = new RetryManager({ retryableErrors: ['timeout'], maxRetries: 1 });
      expect(rm.shouldRetry(new Error('request timeout'), 0)).toBe(true);
    });

    it('should not retry on non-matching error', () => {
      const rm = new RetryManager({ retryableErrors: ['timeout'], maxRetries: 3 });
      expect(rm.shouldRetry(new Error('validation failed'), 0)).toBe(false);
    });

    it('should not retry when attempt exceeds maxRetries', () => {
      const rm = new RetryManager({ maxRetries: 3, retryableErrors: ['error'] });
      expect(rm.shouldRetry(new Error('some error'), 3)).toBe(false);
    });

    it('should retry all errors when retryableErrors is empty', () => {
      const rm = new RetryManager();
      expect(rm.shouldRetry(new Error('anything'), 0)).toBe(true);
    });
  });

  describe('wrap', () => {
    it('should succeed on first try', async () => {
      const rm = new RetryManager({ baseDelay: 0, jitter: false });
      const fn = vi.fn().mockResolvedValue('ok');
      await expect(rm.wrap(fn)).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and eventually succeed', async () => {
      const rm = new RetryManager({ baseDelay: 0, jitter: false });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('ok');
      const result = await rm.wrap(fn);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting retries', async () => {
      const rm = new RetryManager({ baseDelay: 0, jitter: false });
      const fn = vi.fn().mockRejectedValue(new Error('persistent error'));
      await expect(rm.wrap(fn)).rejects.toThrow('persistent error');
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });
});

// ============================================================
// TimeoutManager Tests
// ============================================================

describe('TimeoutManager', () => {
  let manager: TimeoutManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new TimeoutManager({ defaultTimeout: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve when fn completes within timeout', async () => {
    const fn = vi.fn().mockResolvedValue('done');
    await expect(manager.execute(fn)).resolves.toBe('done');
  });

  it('should throw TimeoutError when fn exceeds timeout', async () => {
    const fn = () => new Promise<string>((resolve) => setTimeout(() => resolve('too late'), 2000));
    const promise = manager.execute(fn, 500);
    vi.advanceTimersByTime(500);
    await expect(promise).rejects.toThrow(TimeoutError);
  });

  it('should open circuit after threshold failures', () => {
    const cm = new TimeoutManager({ circuitBreakerThreshold: 3 });
    cm.recordFailure();
    cm.recordFailure();
    cm.recordFailure();
    expect(cm.isCircuitOpen()).toBe(true);
    expect(cm.getCircuitState()).toBe('open');
  });

  it('should close circuit on success', () => {
    const cm = new TimeoutManager({ circuitBreakerThreshold: 3 });
    cm.recordFailure();
    cm.recordFailure();
    cm.recordFailure();
    expect(cm.isCircuitOpen()).toBe(true);
    cm.recordSuccess();
    expect(cm.isCircuitOpen()).toBe(false);
    expect(cm.getCircuitState()).toBe('closed');
  });

  it('should reject immediately when circuit is open', async () => {
    const cm = new TimeoutManager({ circuitBreakerThreshold: 1 });
    cm.recordFailure();
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(cm.execute(fn)).rejects.toThrow('Circuit breaker is open');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should transition to half-open after reset timeout', () => {
    const cm = new TimeoutManager({ circuitBreakerThreshold: 1, circuitBreakerResetTimeout: 5000 });
    cm.recordFailure();
    vi.advanceTimersByTime(5000);
    expect(cm.getCircuitState()).toBe('half-open');
  });

  it('should not open circuit below threshold', () => {
    const cm = new TimeoutManager({ circuitBreakerThreshold: 5 });
    cm.recordFailure();
    cm.recordFailure();
    cm.recordFailure();
    expect(cm.isCircuitOpen()).toBe(false);
  });
});

// ============================================================
// ResourceManager Tests
// ============================================================

describe('ResourceManager', () => {
  let rm: ResourceManager;

  beforeEach(() => {
    rm = new ResourceManager();
  });

  it('should acquire resources when within limit', () => {
    expect(rm.acquire()).toBe(true);
    expect(rm.getUsage().concurrent).toBe(1);
  });

  it('should release resources', () => {
    rm.acquire();
    rm.acquire();
    rm.release();
    expect(rm.getUsage().concurrent).toBe(1);
  });

  it('should block when max concurrency reached', () => {
    for (let i = 0; i < 10; i++) rm.acquire();
    expect(rm.acquire()).toBe(false);
    expect(rm.getAvailableConcurrency()).toBe(0);
  });

  it('should track usage correctly', () => {
    rm.acquire(3);
    rm.acquire(2);
    const usage = rm.getUsage();
    expect(usage.concurrent).toBe(5);
    expect(usage.tokens).toBe(0);
    expect(usage.memoryMB).toBe(0);
  });

  it('should report available concurrency', () => {
    rm.acquire(4);
    expect(rm.getAvailableConcurrency()).toBe(6);
  });

  it('should report available tokens', () => {
    expect(rm.getAvailableTokens()).toBe(100000);
  });

  it('should reset to empty state', () => {
    rm.acquire(5);
    rm.reset();
    const usage = rm.getUsage();
    expect(usage.concurrent).toBe(0);
    expect(usage.memoryMB).toBe(0);
    expect(usage.tokens).toBe(0);
  });

  it('should not release below zero', () => {
    rm.release(5);
    expect(rm.getUsage().concurrent).toBe(0);
  });

  it('should accept custom budget', () => {
    const custom = new ResourceManager({ maxConcurrent: 3, maxTokens: 500 });
    expect(custom.acquire(3)).toBe(true);
    expect(custom.acquire()).toBe(false);
    expect(custom.getAvailableTokens()).toBe(500);
  });
});
