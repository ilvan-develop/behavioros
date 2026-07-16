import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from '../resilience/circuit-breaker/circuit-breaker';

// ============================================================
// Circuit Breaker Tests
// ============================================================

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeoutMs: 10_000,
      halfOpenMaxAttempts: 3,
      successThreshold: 2,
      monitoringWindowMs: 60_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const makeRequest = (id = 'req-1'): { id: string; action: string; timestamp: string } => ({
    id,
    action: 'test',
    timestamp: new Date().toISOString(),
  });

  describe('closed state', () => {
    it('should start in closed state', () => {
      expect(cb.getState()).toBe('closed');
    });

    it('should allow all requests in closed state', () => {
      const result = cb.check(makeRequest());
      expect(result.allowed).toBe(true);
      expect(result.state).toBe('closed');
    });

    it('should be available in closed state', () => {
      expect(cb.isAvailable()).toBe(true);
    });

    it('should track stats in closed state', () => {
      cb.check(makeRequest('r1'));
      cb.check(makeRequest('r2'));
      const stats = cb.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.currentState).toBe('closed');
    });
  });

  describe('closed → open transition', () => {
    it('should transition to open after failure threshold', () => {
      for (let i = 0; i < 5; i++) {
        cb.recordFailure(`req-${i}`, new Error(`fail-${i}`));
      }
      expect(cb.getState()).toBe('open');
    });

    it('should not transition before failure threshold', () => {
      for (let i = 0; i < 4; i++) {
        cb.recordFailure(`req-${i}`, new Error(`fail-${i}`));
      }
      expect(cb.getState()).toBe('closed');
    });

    it('should reset failure count on success', () => {
      for (let i = 0; i < 3; i++) {
        cb.recordFailure(`req-${i}`, new Error(`fail-${i}`));
      }
      cb.recordSuccess('req-ok');
      for (let i = 0; i < 3; i++) {
        cb.recordFailure(`req-f${i}`, new Error(`fail-${i}`));
      }
      expect(cb.getState()).toBe('closed');
    });

    it('should reject requests in open state', () => {
      cb.forceOpen();
      const result = cb.check(makeRequest());
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('open');
    });
  });

  describe('open → half-open transition', () => {
    it('should transition to half-open after recovery timeout', () => {
      cb.forceOpen();
      vi.advanceTimersByTime(10_000);
      const result = cb.check(makeRequest());
      expect(result.state).toBe('half-open');
    });

    it('should block requests while open and before recovery timeout', () => {
      cb.forceOpen();
      vi.advanceTimersByTime(5000);
      const result = cb.check(makeRequest());
      expect(result.allowed).toBe(false);
      expect(result.state).toBe('open');
    });
  });

  describe('half-open → closed transition', () => {
    it('should transition back to closed on success threshold', () => {
      cb.forceOpen();
      vi.advanceTimersByTime(10_000);
      cb.forceHalfOpen();

      cb.recordSuccess('ho-1');
      expect(cb.getState()).toBe('half-open');

      cb.recordSuccess('ho-2');
      expect(cb.getState()).toBe('closed');
    });
  });

  describe('half-open → open transition', () => {
    it('should transition back to open on failure in half-open', () => {
      cb.forceOpen();
      vi.advanceTimersByTime(10_000);
      cb.forceHalfOpen();

      cb.recordFailure('ho-f1', new Error('fail'));
      expect(cb.getState()).toBe('open');
    });

    it('should accept limited test requests in half-open', () => {
      cb.forceOpen();
      vi.advanceTimersByTime(10_000);
      cb.forceHalfOpen();

      const r1 = cb.check(makeRequest('t1'));
      expect(r1.allowed).toBe(true);

      const r2 = cb.check(makeRequest('t2'));
      expect(r2.allowed).toBe(true);

      const r3 = cb.check(makeRequest('t3'));
      expect(r3.allowed).toBe(true);

      const r4 = cb.check(makeRequest('t4'));
      expect(r4.allowed).toBe(false);
    });
  });

  describe('event emission', () => {
    it('should emit state-change events', () => {
      const handler = vi.fn();
      cb.on('state-change', handler);

      cb.forceOpen();
      expect(handler).toHaveBeenCalledWith('closed', 'open', 'Forced open');
    });

    it('should emit request-allowed events', () => {
      const handler = vi.fn();
      cb.on('request-allowed', handler);

      cb.check(makeRequest('allowed-1'));
      expect(handler).toHaveBeenCalledWith('allowed-1');
    });

    it('should emit request-rejected events', () => {
      const handler = vi.fn();
      cb.on('request-rejected', handler);

      cb.forceOpen();
      cb.check(makeRequest('rejected-1'));
      expect(handler).toHaveBeenCalledWith('rejected-1', expect.stringContaining('Circuit open'));
    });

    it('should emit failure-recorded events', () => {
      const handler = vi.fn();
      cb.on('failure-recorded', handler);

      cb.recordFailure('f1', new Error('boom'));
      expect(handler).toHaveBeenCalledWith('f1', expect.any(Error));
    });

    it('should emit success-recorded events', () => {
      const handler = vi.fn();
      cb.on('success-recorded', handler);

      cb.recordSuccess('s1');
      expect(handler).toHaveBeenCalledWith('s1');
    });

    it('should stop emitting after off()', () => {
      const handler = vi.fn();
      cb.on('state-change', handler);
      cb.off('state-change', handler);

      cb.forceOpen();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('state history', () => {
    it('should record state transitions', () => {
      cb.forceOpen('reason-1');
      cb.forceHalfOpen();
      cb.recordSuccess('ho-1');
      cb.recordSuccess('ho-2');

      const history = cb.getStateHistory();
      expect(history).toHaveLength(3);
      expect(history[0].to).toBe('open');
      expect(history[1].to).toBe('half-open');
      expect(history[2].to).toBe('closed');
    });

    it('should not duplicate same-state transitions', () => {
      cb.forceOpen();
      const history = cb.getStateHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('manual controls', () => {
    it('should reset to closed state', () => {
      cb.forceOpen();
      cb.reset();
      expect(cb.getState()).toBe('closed');
    });

    it('should force open with custom reason', () => {
      cb.forceOpen('maintenance');
      expect(cb.getState()).toBe('open');
      const history = cb.getStateHistory();
      expect(history[0].reason).toBe('maintenance');
    });

    it('should force half-open', () => {
      cb.forceHalfOpen();
      expect(cb.getState()).toBe('half-open');
    });
  });

  describe('stats', () => {
    it('should track total successes and failures', () => {
      cb.recordSuccess('s1');
      cb.recordSuccess('s2');
      cb.recordFailure('f1', new Error('e'));
      const stats = cb.getStats();
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(1);
    });

    it('should track consecutive failures', () => {
      cb.recordFailure('f1', new Error('e'));
      cb.recordFailure('f2', new Error('e'));
      expect(cb.getStats().consecutiveFailures).toBe(2);
    });

    it('should reset consecutive failures on success', () => {
      cb.recordFailure('f1', new Error('e'));
      cb.recordFailure('f2', new Error('e'));
      cb.recordSuccess('s1');
      expect(cb.getStats().consecutiveFailures).toBe(0);
    });

    it('should track uptime', () => {
      vi.advanceTimersByTime(5000);
      const stats = cb.getStats();
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(5000);
    });

    it('should track state changes count', () => {
      cb.forceOpen();
      cb.forceHalfOpen();
      cb.recordSuccess('s1');
      cb.recordSuccess('s2');
      expect(cb.getStats().stateChanges).toBe(3);
    });
  });

  describe('getConfig', () => {
    it('should return config copy', () => {
      const config = cb.getConfig();
      expect(config.failureThreshold).toBe(5);
      expect(config.recoveryTimeoutMs).toBe(10_000);
    });

    it('should not mutate internal config', () => {
      const config = cb.getConfig();
      config.failureThreshold = 999;
      expect(cb.getConfig().failureThreshold).toBe(5);
    });
  });
});
