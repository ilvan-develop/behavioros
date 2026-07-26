import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AIResourceManager } from '../engines/ai-platform/ai-resource-manager';

describe('AIResourceManager', () => {
  let manager: AIResourceManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new AIResourceManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackTokens', () => {
    it('should track token usage and cost', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      const usage = manager.getUsage('gpt-4');
      expect(usage).toHaveLength(1);
      expect(usage[0].tokensInput).toBe(100);
      expect(usage[0].tokensOutput).toBe(50);
      expect(usage[0].cost).toBe(0.003);
      expect(usage[0].requests).toBe(1);
    });

    it('should accumulate multiple calls', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      manager.trackTokens('gpt-4', 200, 100, 0.006);
      const usage = manager.getUsage('gpt-4');
      expect(usage[0].tokensInput).toBe(300);
      expect(usage[0].tokensOutput).toBe(150);
      expect(usage[0].cost).toBeCloseTo(0.009, 6);
      expect(usage[0].requests).toBe(2);
    });
  });

  describe('checkLimit', () => {
    it('should allow when under limits', () => {
      manager.setTokenLimit('gpt-4', 1000, 500);
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      expect(manager.checkLimit('gpt-4').allowed).toBe(true);
    });

    it('should block when input limit exceeded', () => {
      manager.setTokenLimit('gpt-4', 100, 500);
      manager.trackTokens('gpt-4', 150, 50, 0.003);
      const result = manager.checkLimit('gpt-4');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Input token limit exceeded');
    });

    it('should block when output limit exceeded', () => {
      manager.setTokenLimit('gpt-4', 1000, 50);
      manager.trackTokens('gpt-4', 100, 60, 0.003);
      const result = manager.checkLimit('gpt-4');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Output token limit exceeded');
    });

    it('should auto-reset tokens after period', () => {
      manager.setTokenLimit('gpt-4', 100, 500, 60_000);
      manager.trackTokens('gpt-4', 150, 50, 0.003);
      expect(manager.checkLimit('gpt-4').allowed).toBe(false);

      vi.advanceTimersByTime(60_000);
      const result = manager.checkLimit('gpt-4');
      expect(result.allowed).toBe(true);
    });

    it('should return allowed for unknown models', () => {
      expect(manager.checkLimit('unknown-model').allowed).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should block when RPM limit exceeded', () => {
      manager.setRateLimit('gpt-4', 3, 100_000);
      manager.trackTokens('gpt-4', 10, 5, 0.001);
      manager.trackTokens('gpt-4', 10, 5, 0.001);
      manager.trackTokens('gpt-4', 10, 5, 0.001);
      const result = manager.checkLimit('gpt-4');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('RPM');
    });

    it('should reset RPM count after window', () => {
      manager.setRateLimit('gpt-4', 2, 100_000);
      manager.trackTokens('gpt-4', 10, 5, 0.001);
      manager.trackTokens('gpt-4', 10, 5, 0.001);
      expect(manager.checkLimit('gpt-4').allowed).toBe(false);

      vi.advanceTimersByTime(60_000);
      manager.trackTokens('gpt-4', 10, 5, 0.001);
      expect(manager.checkLimit('gpt-4').allowed).toBe(true);
    });
  });

  describe('concurrency', () => {
    it('should acquire slots within limit', () => {
      manager.setConcurrencyLimit('gpt-4', 3);
      expect(manager.acquireSlot('gpt-4')).toBe(true);
      expect(manager.acquireSlot('gpt-4')).toBe(true);
      expect(manager.acquireSlot('gpt-4')).toBe(true);
    });

    it('should reject when concurrency limit reached', () => {
      manager.setConcurrencyLimit('gpt-4', 2);
      manager.acquireSlot('gpt-4');
      manager.acquireSlot('gpt-4');
      expect(manager.acquireSlot('gpt-4')).toBe(false);
    });

    it('should release slots', () => {
      manager.setConcurrencyLimit('gpt-4', 2);
      manager.acquireSlot('gpt-4');
      manager.acquireSlot('gpt-4');
      manager.releaseSlot('gpt-4');
      expect(manager.acquireSlot('gpt-4')).toBe(true);
    });
  });

  describe('getUsage', () => {
    it('should return usage for specific model', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      const usage = manager.getUsage('gpt-4');
      expect(usage).toHaveLength(1);
      expect(usage[0].modelId).toBe('gpt-4');
    });

    it('should return all usage when no model specified', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      manager.trackTokens('claude-3', 200, 100, 0.006);
      const all = manager.getUsage();
      expect(all).toHaveLength(2);
    });

    it('should return empty array for unknown model', () => {
      expect(manager.getUsage('unknown')).toEqual([]);
    });
  });

  describe('getTotalCost', () => {
    it('should sum costs across all models', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      manager.trackTokens('claude-3', 200, 100, 0.006);
      expect(manager.getTotalCost()).toBeCloseTo(0.009, 6);
    });

    it('should return 0 when no usage recorded', () => {
      expect(manager.getTotalCost()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset a specific model', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      manager.reset('gpt-4');
      expect(manager.getUsage('gpt-4')).toEqual([]);
    });

    it('should reset all models', () => {
      manager.trackTokens('gpt-4', 100, 50, 0.003);
      manager.trackTokens('claude-3', 200, 100, 0.006);
      manager.reset();
      expect(manager.getUsage()).toHaveLength(0);
      expect(manager.getTotalCost()).toBe(0);
    });
  });

  describe('multiple models', () => {
    it('should track models independently', () => {
      manager.setTokenLimit('gpt-4', 100, 500);
      manager.setTokenLimit('claude-3', 200, 1000);

      manager.trackTokens('gpt-4', 150, 50, 0.003);
      manager.trackTokens('claude-3', 50, 30, 0.001);

      expect(manager.checkLimit('gpt-4').allowed).toBe(false);
      expect(manager.checkLimit('claude-3').allowed).toBe(true);
    });

    it('should maintain separate concurrency per model', () => {
      manager.setConcurrencyLimit('gpt-4', 1);
      manager.setConcurrencyLimit('claude-3', 3);

      expect(manager.acquireSlot('gpt-4')).toBe(true);
      expect(manager.acquireSlot('gpt-4')).toBe(false);
      expect(manager.acquireSlot('claude-3')).toBe(true);
      expect(manager.acquireSlot('claude-3')).toBe(true);
      expect(manager.acquireSlot('claude-3')).toBe(true);
      expect(manager.acquireSlot('claude-3')).toBe(false);
    });
  });
});
