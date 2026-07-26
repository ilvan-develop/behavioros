import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScalingRule } from '../engines/cloud/auto-scaler';
import { AutoScaler } from '../engines/cloud/auto-scaler';

describe('AutoScaler', () => {
  let scaler: AutoScaler;

  beforeEach(() => {
    scaler = new AutoScaler(5);
  });

  describe('constructor', () => {
    it('should start with default replicas of 1', () => {
      const s = new AutoScaler();
      expect(s.getCurrentReplicas()).toBe(1);
    });

    it('should start with given initial replicas', () => {
      expect(scaler.getCurrentReplicas()).toBe(5);
    });
  });

  describe('addRule / removeRule', () => {
    it('should add a rule and evaluate it', async () => {
      const rule: ScalingRule = {
        id: 'cpu-rule',
        metric: 'cpu-usage',
        targetValue: 50,
        scaleUpThreshold: 80,
        scaleDownThreshold: 20,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      const decisions = await scaler.evaluate({ 'cpu-usage': 90 });
      expect(decisions).toHaveLength(1);
      expect(decisions[0].ruleId).toBe('cpu-rule');
    });

    it('should remove a rule and not evaluate it', async () => {
      const rule: ScalingRule = {
        id: 'mem-rule',
        metric: 'memory-usage',
        targetValue: 100,
        scaleUpThreshold: 200,
        scaleDownThreshold: 50,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      scaler.removeRule('mem-rule');
      const decisions = await scaler.evaluate({ 'memory-usage': 300 });
      expect(decisions).toHaveLength(0);
    });
  });

  describe('evaluate — scale up', () => {
    it('should scale up when metric exceeds scaleUpThreshold', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 20,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      const decisions = await scaler.evaluate({ 'queue-depth': 15 });
      expect(decisions).toHaveLength(1);
      expect(decisions[0].desiredReplicas).toBeGreaterThan(5);
      expect(decisions[0].reason).toContain('scale-up');
      expect(scaler.getCurrentReplicas()).toBeGreaterThan(5);
    });
  });

  describe('evaluate — scale down', () => {
    it('should scale down when metric drops below scaleDownThreshold', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 20,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      await scaler.evaluate({ 'queue-depth': 15 });
      const initial = scaler.getCurrentReplicas();

      const decisions = await scaler.evaluate({ 'queue-depth': 1 });
      const scaleDown = decisions.find((d) => d.reason.includes('scale-down'));
      expect(scaleDown).toBeDefined();
      expect(scaleDown!.desiredReplicas).toBeLessThan(initial);
      expect(scaler.getCurrentReplicas()).toBeLessThan(initial);
    });
  });

  describe('min / max replica enforcement', () => {
    it('should not scale below minReplicas', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 3,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler = new AutoScaler(10);
      scaler.addRule(rule);
      await scaler.evaluate({ 'queue-depth': 1 });
      expect(scaler.getCurrentReplicas()).toBeGreaterThanOrEqual(3);
    });

    it('should not scale above maxReplicas', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 5,
        cooldownMs: 0,
      };
      scaler = new AutoScaler(3);
      scaler.addRule(rule);
      await scaler.evaluate({ 'queue-depth': 100 });
      expect(scaler.getCurrentReplicas()).toBeLessThanOrEqual(5);
    });
  });

  describe('cooldown prevents thrashing', () => {
    it('should not scale again within cooldown period', async () => {
      vi.useFakeTimers();
      const rule: ScalingRule = {
        id: 'cpu-rule',
        metric: 'cpu-usage',
        targetValue: 50,
        scaleUpThreshold: 70,
        scaleDownThreshold: 20,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 5000,
      };
      const s = new AutoScaler(3);
      s.addRule(rule);

      const first = await s.evaluate({ 'cpu-usage': 90 });
      expect(first[0].desiredReplicas).toBeGreaterThan(3);
      expect(first[0].reason).toContain('scale-up');

      const second = await s.evaluate({ 'cpu-usage': 95 });
      expect(second[0].reason).toContain('cooldown');
      expect(second[0].desiredReplicas).toBe(6);

      vi.advanceTimersByTime(5001);
      const third = await s.evaluate({ 'cpu-usage': 95 });
      expect(third[0].reason).toContain('scale-up');
      expect(third[0].desiredReplicas).toBeGreaterThan(3);

      vi.useRealTimers();
    });
  });

  describe('custom metric', () => {
    it('should evaluate custom metrics', async () => {
      const rule: ScalingRule = {
        id: 'custom-rule',
        metric: 'custom',
        targetValue: 100,
        scaleUpThreshold: 80,
        scaleDownThreshold: 20,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
        customMetric: 'my-custom-metric',
      };
      scaler.addRule(rule);
      const decisions = await scaler.evaluate({ 'my-custom-metric': 90 });
      expect(decisions[0].metrics).toHaveProperty('custom');
      expect(decisions[0].metrics.custom).toBe(90);
    });
  });

  describe('custom provider function', () => {
    it('should use custom provider to compute desired replicas', async () => {
      const rule: ScalingRule = {
        id: 'custom-provider',
        metric: 'custom',
        targetValue: 100,
        scaleUpThreshold: 50,
        scaleDownThreshold: 10,
        minReplicas: 1,
        maxReplicas: 20,
        cooldownMs: 0,
        customMetric: 'latency',
        customProvider: (currentValue) => {
          if (currentValue > 200) return 10;
          if (currentValue > 100) return 5;
          return 2;
        },
      };
      scaler = new AutoScaler(2);
      scaler.addRule(rule);

      const high = await scaler.evaluate({ latency: 250 });
      expect(high[0].desiredReplicas).toBe(10);

      const mid = await scaler.evaluate({ latency: 150 });
      expect(mid[0].desiredReplicas).toBe(5);

      const low = await scaler.evaluate({ latency: 50 });
      expect(low[0].desiredReplicas).toBe(2);
    });
  });

  describe('no decision when metric is in range', () => {
    it('should not produce a decision when metric is between thresholds', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      const decisions = await scaler.evaluate({ 'queue-depth': 5 });
      expect(decisions).toHaveLength(0);
    });
  });

  describe('missing metric', () => {
    it('should skip rules when the metric is not provided', async () => {
      const rule: ScalingRule = {
        id: 'cpu-rule',
        metric: 'cpu-usage',
        targetValue: 50,
        scaleUpThreshold: 80,
        scaleDownThreshold: 20,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      const decisions = await scaler.evaluate({ 'queue-depth': 100 });
      expect(decisions).toHaveLength(0);
    });
  });

  describe('getHistory', () => {
    it('should return all history when count is omitted', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      await scaler.evaluate({ 'queue-depth': 15 });
      await scaler.evaluate({ 'queue-depth': 1 });
      await scaler.evaluate({ 'queue-depth': 20 });
      expect(scaler.getHistory()).toHaveLength(3);
    });

    it('should return last N decisions when count is provided', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      await scaler.evaluate({ 'queue-depth': 15 });
      await scaler.evaluate({ 'queue-depth': 1 });
      await scaler.evaluate({ 'queue-depth': 20 });
      expect(scaler.getHistory(2)).toHaveLength(2);
    });
  });

  describe('summarize', () => {
    it('should return correct summary stats', async () => {
      const rule: ScalingRule = {
        id: 'q-rule',
        metric: 'queue-depth',
        targetValue: 10,
        scaleUpThreshold: 8,
        scaleDownThreshold: 2,
        minReplicas: 1,
        maxReplicas: 20,
        cooldownMs: 0,
      };
      scaler.addRule(rule);
      await scaler.evaluate({ 'queue-depth': 15 });
      await scaler.evaluate({ 'queue-depth': 1 });

      const summary = scaler.summarize();
      expect(summary.totalRules).toBe(1);
      expect(summary.lastDecision).toBeDefined();
      expect(summary.lastDecision!.ruleId).toBe('q-rule');
      expect(summary.currentReplicas).toBeGreaterThan(0);
      expect(summary.averageReplicas).toBeGreaterThan(0);
    });

    it('should return current replicas as average when no history', () => {
      const summary = scaler.summarize();
      expect(summary.currentReplicas).toBe(5);
      expect(summary.averageReplicas).toBe(5);
      expect(summary.lastDecision).toBeUndefined();
      expect(summary.totalRules).toBe(0);
    });
  });

  describe('multiple rules', () => {
    it('should evaluate multiple rules in one call', async () => {
      const cpuRule: ScalingRule = {
        id: 'cpu',
        metric: 'cpu-usage',
        targetValue: 50,
        scaleUpThreshold: 70,
        scaleDownThreshold: 20,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      const memRule: ScalingRule = {
        id: 'mem',
        metric: 'memory-usage',
        targetValue: 200,
        scaleUpThreshold: 300,
        scaleDownThreshold: 50,
        minReplicas: 1,
        maxReplicas: 10,
        cooldownMs: 0,
      };
      scaler = new AutoScaler(3);
      scaler.addRule(cpuRule);
      scaler.addRule(memRule);

      const decisions = await scaler.evaluate({ 'cpu-usage': 90, 'memory-usage': 400 });
      expect(decisions).toHaveLength(2);
      expect(decisions[0].ruleId).toBe('cpu');
      expect(decisions[1].ruleId).toBe('mem');
      expect(decisions[0].desiredReplicas).toBeGreaterThan(3);
      expect(decisions[1].desiredReplicas).toBeGreaterThan(3);
    });
  });
});
