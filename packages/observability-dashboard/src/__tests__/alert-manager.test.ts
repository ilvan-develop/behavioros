import { beforeEach, describe, expect, it } from 'vitest';
import { AlertManager } from '../alert-manager';
import type { AlertRule, UnifiedMetrics } from '../types';

// ============================================================
// Alert Manager Tests
// ============================================================

const createTestMetrics = (overrides?: Partial<UnifiedMetrics>): UnifiedMetrics => ({
  behavioros: {
    pipeline: { active: 3, completed: 80, failed: 5 },
    layers: { passed: 70, failed: 8, pending: 2 },
    governance: { blocked: 10, escalated: 5, approved: 150 },
    quality: { coverage: 85, lintPass: true, typecheckPass: true },
    learning: { events: 200, patterns: 25, autoFixes: 15 },
    timestamp: new Date().toISOString(),
  },
  timestamp: new Date().toISOString(),
  ...overrides,
});

const testAlertRules: AlertRule[] = [
  {
    name: 'Pipeline Failures',
    condition: 'above',
    threshold: 0,
    severity: 'critical',
    channels: ['pagerduty'],
    description: 'Pipeline failures detected',
  },
  {
    name: 'Quality Gate Failures',
    condition: 'above',
    threshold: 0,
    severity: 'high',
    channels: ['slack', 'email'],
    description: 'Quality gate check failures',
  },
  {
    name: 'Governance Blocks',
    condition: 'above',
    threshold: 5,
    severity: 'medium',
    channels: ['slack'],
    description: 'Excessive governance rule blocks',
  },
];

describe('AlertManager', () => {
  let manager: AlertManager;

  beforeEach(() => {
    manager = new AlertManager(testAlertRules);
  });

  describe('constructor', () => {
    it('should create an AlertManager with rules', () => {
      expect(manager).toBeDefined();
    });

    it('should create an AlertManager without rules', () => {
      const empty = new AlertManager();
      expect(empty).toBeDefined();
    });
  });

  describe('evaluateAlert', () => {
    it('should not trigger when value is within threshold', async () => {
      const metrics = createTestMetrics();
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 100,
        severity: 'medium',
        channels: ['slack'],
      };

      const result = await manager.evaluateAlert(rule, metrics);

      expect(result.triggered).toBe(false);
      expect(result.alert).toBeUndefined();
      expect(result.currentValue).toBeDefined();
      expect(result.rule).toBe(rule);
      expect(result.timestamp).toBeDefined();
    });

    it('should trigger when value exceeds threshold (above)', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      const result = await manager.evaluateAlert(rule, metrics);

      expect(result.triggered).toBe(true);
      expect(result.alert).toBeDefined();
      expect(result.alert!.status).toBe('firing');
      expect(result.alert!.severity).toBe('critical');
    });

    it('should trigger when value is below threshold (below)', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          quality: { coverage: 30, lintPass: true, typecheckPass: true },
        },
      });
      const rule: AlertRule = {
        name: 'Quality Coverage',
        condition: 'below',
        threshold: 50,
        severity: 'high',
        channels: ['slack'],
      };

      const result = await manager.evaluateAlert(rule, metrics);

      expect(result.triggered).toBe(true);
      expect(result.alert).toBeDefined();
    });

    it('should record fired alerts in active alerts', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          governance: { blocked: 10, escalated: 5, approved: 150 },
        },
      });
      const rule: AlertRule = {
        name: 'Governance Blocks',
        condition: 'above',
        threshold: 5,
        severity: 'medium',
        channels: ['slack'],
      };

      await manager.evaluateAlert(rule, metrics);
      const activeAlerts = await manager.getActiveAlerts();

      expect(activeAlerts.length).toBeGreaterThan(0);
    });

    it('should include all alert channels in fired alert', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack', 'pagerduty', 'email'],
      };

      const result = await manager.evaluateAlert(rule, metrics);

      expect(result.alert!.channels).toEqual(['slack', 'pagerduty', 'email']);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return empty array when no alerts fired', async () => {
      const activeAlerts = await manager.getActiveAlerts();

      expect(activeAlerts).toBeInstanceOf(Array);
      expect(activeAlerts.length).toBe(0);
    });

    it('should return only firing alerts', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      const result = await manager.evaluateAlert(rule, metrics);
      const active = await manager.getActiveAlerts();

      expect(active.length).toBe(1);
      expect(active[0].id).toBe(result.alert!.id);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge a firing alert', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      const result = await manager.evaluateAlert(rule, metrics);
      await manager.acknowledgeAlert(result.alert!.id);

      const active = await manager.getActiveAlerts();
      expect(active.length).toBe(0);
    });

    it('should throw for unknown alert id', async () => {
      await expect(manager.acknowledgeAlert('nonexistent')).rejects.toThrow('Alert not found');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve and remove from active alerts', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      const result = await manager.evaluateAlert(rule, metrics);
      await manager.resolveAlert(result.alert!.id);

      const active = await manager.getActiveAlerts();
      expect(active.length).toBe(0);
    });

    it('should throw for unknown alert id', async () => {
      await expect(manager.resolveAlert('nonexistent')).rejects.toThrow('Alert not found');
    });
  });

  describe('getAlertHistory', () => {
    it('should return empty history initially', async () => {
      const history = await manager.getAlertHistory();

      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBe(0);
    });

    it('should record alert history', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      await manager.evaluateAlert(rule, metrics);
      const history = await manager.getAlertHistory();

      expect(history.length).toBe(1);
      expect(history[0].ruleName).toBe('Pipeline Failures');
    });

    it('should filter by severity', async () => {
      const metrics = createTestMetrics();
      const criticalRule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };
      const lowRule: AlertRule = {
        name: 'Quality Coverage',
        condition: 'below',
        threshold: 10,
        severity: 'low',
        channels: ['slack'],
      };

      await manager.evaluateAlert(criticalRule, metrics);
      await manager.evaluateAlert(lowRule, metrics);

      const criticalHistory = await manager.getAlertHistory({
        severity: 'critical',
      });
      expect(criticalHistory.length).toBe(1);
      expect(criticalHistory[0].severity).toBe('critical');
    });

    it('should filter by limit', async () => {
      const metrics = createTestMetrics();
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      for (let i = 0; i < 5; i++) {
        await manager.evaluateAlert(rule, metrics);
      }

      const limited = await manager.getAlertHistory({ limit: 3 });
      expect(limited.length).toBe(3);
    });
  });

  describe('getAlertStats', () => {
    it('should return zero stats initially', async () => {
      const stats = await manager.getAlertStats();

      expect(stats.total).toBe(0);
      expect(stats.firing).toBe(0);
      expect(stats.acknowledged).toBe(0);
      expect(stats.resolved).toBe(0);
      expect(stats.bySeverity).toBeDefined();
    });

    it('should track alert stats after firing', async () => {
      const metrics = createTestMetrics({
        behavioros: {
          ...createTestMetrics().behavioros,
          pipeline: { active: 3, completed: 80, failed: 10 },
        },
      });
      const rule: AlertRule = {
        name: 'Pipeline Failures',
        condition: 'above',
        threshold: 0,
        severity: 'critical',
        channels: ['slack'],
      };

      await manager.evaluateAlert(rule, metrics);
      const stats = await manager.getAlertStats();

      expect(stats.total).toBe(1);
      expect(stats.firing).toBe(1);
      expect(stats.bySeverity.critical).toBe(1);
    });
  });
});
