import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptiveRateLimiter } from '../resilience/rate-limiter/algorithms/adaptive';
import { SlidingWindow } from '../resilience/rate-limiter/algorithms/sliding-window';
import { TokenBucket } from '../resilience/rate-limiter/algorithms/token-bucket';
import { RateLimiter } from '../resilience/rate-limiter/rate-limiter';

// ============================================================
// Token Bucket Algorithm Tests
// ============================================================

describe('TokenBucket', () => {
  let bucket: TokenBucket;

  beforeEach(() => {
    vi.useFakeTimers();
    bucket = new TokenBucket({
      capacity: 10,
      refillRate: 5,
      refillIntervalMs: 1000,
      burstCapacity: 15,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within capacity', () => {
    const result = bucket.consume(1);
    expect(result.allowed).toBe(true);
    expect(result.tokensRemaining).toBe(9);
  });

  it('should consume multiple tokens', () => {
    const result = bucket.consume(5);
    expect(result.allowed).toBe(true);
    expect(result.tokensRemaining).toBe(5);
  });

  it('should reject requests over capacity', () => {
    bucket.consume(10);
    const result = bucket.consume(1);
    expect(result.allowed).toBe(false);
    expect(result.tokensRemaining).toBe(0);
    expect(result.waitMs).toBeGreaterThan(0);
  });

  it('should refill tokens over time', () => {
    bucket.consume(10);
    expect(bucket.consume(1).allowed).toBe(false);

    vi.advanceTimersByTime(1000);
    const result = bucket.consume(1);
    expect(result.allowed).toBe(true);
  });

  it('should not exceed burst capacity on refill', () => {
    bucket.consume(10);
    vi.advanceTimersByTime(10_000);
    const state = bucket.getState();
    expect(state.tokens).toBeLessThanOrEqual(15);
  });

  it('should track utilization', () => {
    expect(bucket.getUtilization()).toBe(0);
    bucket.consume(5);
    expect(bucket.getUtilization()).toBeCloseTo(0.5);
  });

  it('should reset to full capacity', () => {
    bucket.consume(10);
    bucket.reset();
    const state = bucket.getState();
    expect(state.tokens).toBe(10);
    expect(state.totalConsumed).toBe(0);
  });

  it('should update capacity', () => {
    bucket.updateCapacity(20);
    expect(bucket.getState().tokens).toBeLessThanOrEqual(20);
  });

  it('should track total consumed and rejected', () => {
    bucket.consume(5);
    bucket.consume(5);
    bucket.consume(1);
    const state = bucket.getState();
    expect(state.totalConsumed).toBe(10);
    expect(state.totalRejected).toBe(1);
  });
});

// ============================================================
// Sliding Window Algorithm Tests
// ============================================================

describe('SlidingWindow', () => {
  let window: SlidingWindow;

  beforeEach(() => {
    vi.useFakeTimers();
    window = new SlidingWindow({
      windowMs: 60_000,
      maxRequests: 5,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within limit', () => {
    for (let i = 0; i < 5; i++) {
      const result = window.consume();
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(i + 1);
    }
  });

  it('should reject requests over limit', () => {
    for (let i = 0; i < 5; i++) window.consume();
    const result = window.consume();
    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(5);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should expire old requests', () => {
    for (let i = 0; i < 5; i++) window.consume();
    expect(window.consume().allowed).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(window.consume().allowed).toBe(true);
  });

  it('should enforce minimum spacing', () => {
    const spaced = new SlidingWindow({
      windowMs: 60_000,
      maxRequests: 10,
      minSpacingMs: 1000,
    });

    spaced.consume();
    const result = spaced.consume();
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should track utilization', () => {
    window.consume();
    window.consume();
    expect(window.getUtilization()).toBeCloseTo(0.4);
  });

  it('should reset state', () => {
    window.consume();
    window.consume();
    window.reset();
    const state = window.getState();
    expect(state.requests).toHaveLength(0);
    expect(state.totalAccepted).toBe(0);
  });

  it('should update limit', () => {
    window.updateLimit(10);
    for (let i = 0; i < 10; i++) {
      expect(window.consume().allowed).toBe(true);
    }
  });
});

// ============================================================
// Adaptive Algorithm Tests
// ============================================================

describe('AdaptiveRateLimiter', () => {
  let adaptive: AdaptiveRateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    adaptive = new AdaptiveRateLimiter({
      baseLimit: 20,
      windowMs: 60_000,
      cooldownMs: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow requests within current limit', () => {
    const result = adaptive.consume();
    expect(result.allowed).toBe(true);
    expect(result.currentLimit).toBe(20);
  });

  it('should reject when limit is reached', () => {
    for (let i = 0; i < 20; i++) adaptive.consume();
    const result = adaptive.consume();
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('should reduce limit under high load', () => {
    const longWindow = new AdaptiveRateLimiter({
      baseLimit: 20,
      windowMs: 600_000,
      cooldownMs: 5000,
    });
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(6000);
      for (let j = 0; j < 20; j++) longWindow.consume();
    }
    const state = longWindow.getState();
    expect(state.currentLimit).toBeLessThan(20);
  });

  it('should force adjust limit', () => {
    adaptive.forceAdjust(50);
    expect(adaptive.getState().currentLimit).toBe(50);
  });

  it('should clamp forced adjustment within bounds', () => {
    adaptive.forceAdjust(0);
    expect(adaptive.getState().currentLimit).toBeGreaterThanOrEqual(1);
    adaptive.forceAdjust(99999);
    expect(adaptive.getState().currentLimit).toBeLessThanOrEqual(60);
  });

  it('should track utilization', () => {
    adaptive.consume();
    adaptive.consume();
    expect(adaptive.getUtilization()).toBeCloseTo(0.1);
  });

  it('should reset state', () => {
    adaptive.consume();
    adaptive.consume();
    adaptive.reset();
    const state = adaptive.getState();
    expect(state.totalRequests).toBe(0);
    expect(state.currentLimit).toBe(20);
    expect(state.recentRequests).toHaveLength(0);
  });
});

// ============================================================
// RateLimiter Integration Tests
// ============================================================

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({
      algorithm: 'token-bucket',
      globalMaxRequests: 100,
      globalWindowMs: 60_000,
      dynamicScaling: true,
    });
  });

  afterEach(() => {
    limiter.resetAll();
    vi.useRealTimers();
  });

  const makeRequest = (
    overrides?: Partial<{
      agentId: string;
      authority: 'junior' | 'senior' | 'architect' | 'lead' | 'director' | 'vp' | 'c-level';
      dnaId: string;
      dnaMode: 'conversational' | 'transactional';
      action: string;
    }>,
  ) => ({
    agentId: 'agent-1',
    authority: 'senior' as const,
    dnaId: 'dna-1',
    dnaMode: 'conversational' as const,
    action: 'read',
    ...overrides,
  });

  describe('basic request handling', () => {
    it('should allow requests within limit', () => {
      const result = limiter.check(makeRequest());
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Request allowed');
    });

    it('should block requests over limit', () => {
      for (let i = 0; i < 200; i++) {
        limiter.check(makeRequest());
      }
      const result = limiter.check(makeRequest());
      expect(result.allowed).toBe(false);
    });

    it('should track stats', () => {
      limiter.check(makeRequest());
      limiter.check(makeRequest());
      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalAllowed).toBe(2);
    });
  });

  describe('token bucket algorithm', () => {
    it('should use token bucket by default', () => {
      const result = limiter.check(makeRequest());
      expect(result.algorithm).toBe('token-bucket');
    });

    it('should refill tokens over time', () => {
      for (let i = 0; i < 100; i++) limiter.check(makeRequest());
      vi.advanceTimersByTime(60_000);
      const result = limiter.check(makeRequest());
      expect(result.allowed).toBe(true);
    });
  });

  describe('sliding window algorithm', () => {
    it('should use sliding window when configured', () => {
      const swLimiter = new RateLimiter({
        algorithm: 'sliding-window',
        globalMaxRequests: 50,
        globalWindowMs: 60_000,
      });
      const result = swLimiter.check(makeRequest());
      expect(result.algorithm).toBe('sliding-window');
      swLimiter.resetAll();
    });
  });

  describe('adaptive algorithm', () => {
    it('should use adaptive algorithm when configured', () => {
      const adaptiveLimiter = new RateLimiter({
        algorithm: 'adaptive',
        globalMaxRequests: 50,
        globalWindowMs: 60_000,
      });
      const result = adaptiveLimiter.check(makeRequest());
      expect(result.algorithm).toBe('adaptive');
      adaptiveLimiter.resetAll();
    });
  });

  describe('escalation', () => {
    it('should generate warnings when utilization is high', () => {
      for (let i = 0; i < 30; i++) {
        limiter.check(makeRequest({ agentId: 'heavy-agent', authority: 'junior' }));
      }
      const stats = limiter.getStats();
      expect(stats.totalWarnings + stats.totalBlocked).toBeGreaterThan(0);
    });

    it('should force block an agent', () => {
      limiter.forceBlock('bad-agent', 60_000);
      expect(limiter.isBlocked('bad-agent')).toBe(true);
    });

    it('should return block info in check result', () => {
      limiter.check(makeRequest({ agentId: 'blocked-agent' }));
      limiter.forceBlock('blocked-agent', 60_000);
      const result = limiter.check(makeRequest({ agentId: 'blocked-agent' }));
      expect(result.allowed).toBe(false);
      expect(result.blockExpiresAt).toBeDefined();
    });
  });

  describe('per-agent limits', () => {
    it('should apply per-agent rate limits', () => {
      const result = limiter.check(makeRequest({ agentId: 'agent-a', authority: 'junior' }));
      expect(result.allowed).toBe(true);
    });

    it('should track separate buckets per agent', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check(makeRequest({ agentId: 'agent-a', authority: 'junior' }));
        limiter.check(makeRequest({ agentId: 'agent-b', authority: 'junior' }));
      }
      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(10);
    });

    it('should reset specific agent', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check(makeRequest({ agentId: 'agent-a', authority: 'junior' }));
      }
      limiter.resetAgent('agent-a');
      const result = limiter.check(makeRequest({ agentId: 'agent-a', authority: 'junior' }));
      expect(result.allowed).toBe(true);
    });
  });

  describe('per-DNA limits', () => {
    it('should apply per-DNA rate limits', () => {
      const result = limiter.check(
        makeRequest({ dnaId: 'dna-enterprise', dnaMode: 'transactional' }),
      );
      expect(result.allowed).toBe(true);
    });

    it('should block when DNA limit exceeded', () => {
      for (let i = 0; i < 100; i++) {
        limiter.check(makeRequest({ dnaId: 'dna-strict', dnaMode: 'transactional' }));
      }
      const result = limiter.check(makeRequest({ dnaId: 'dna-strict', dnaMode: 'transactional' }));
      expect(result.allowed).toBe(false);
    });
  });

  describe('reset and prune', () => {
    it('should reset all state', () => {
      limiter.check(makeRequest());
      limiter.check(makeRequest());
      limiter.resetAll();
      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalAllowed).toBe(0);
    });

    it('should prune old buckets', () => {
      limiter.check(makeRequest({ agentId: 'stale-agent' }));
      vi.advanceTimersByTime(600_000);
      const pruned = limiter.prune(300_000);
      expect(pruned).toBeGreaterThan(0);
    });
  });
});
