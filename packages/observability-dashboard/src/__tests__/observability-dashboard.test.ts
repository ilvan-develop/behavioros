import { beforeEach, describe, expect, it } from 'vitest';
import { ObservabilityDashboard } from '../observability-dashboard';
import type { AlertRule } from '../types';

// ============================================================
// ObservabilityDashboard Facade Tests
// ============================================================

describe('ObservabilityDashboard', () => {
  let dashboard: ObservabilityDashboard;

  beforeEach(() => {
    dashboard = new ObservabilityDashboard();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(dashboard).toBeDefined();
      expect(dashboard.isInitialized).toBe(true);
    });

    it('should initialize with custom alert rules', () => {
      const customRule: AlertRule = {
        name: 'Custom Alert',
        condition: 'above',
        threshold: 10,
        severity: 'high',
        channels: ['slack'],
      };
      const custom = new ObservabilityDashboard({ alertRules: [customRule] });
      const rules = custom.getAlertRules();
      expect(rules.length).toBe(4); // 3 built-in + 1 custom
    });

    it('should start collector when autoStart is true', () => {
      const auto = new ObservabilityDashboard({ autoStart: true });
      // Collector should be running
      auto.stop(); // cleanup
    });
  });

  describe('lifecycle', () => {
    it('should start and stop', () => {
      dashboard.start();
      dashboard.stop();
    });
  });

  describe('metrics', () => {
    it('should collect unified metrics', async () => {
      const metrics = await dashboard.collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.behavioros).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should collect BehaviorOS metrics', async () => {
      const metrics = await dashboard.getBehaviorOSMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.pipeline).toBeDefined();
      expect(metrics.layers).toBeDefined();
      expect(metrics.governance).toBeDefined();
      expect(metrics.quality).toBeDefined();
      expect(metrics.learning).toBeDefined();
    });

    it('should get metric history (empty initially)', () => {
      const history = dashboard.getMetricHistory('behavioros.pipeline.completed', 60_000);
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('alerts', () => {
    it('should evaluate all alert rules', async () => {
      const results = await dashboard.evaluateAlerts();
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3); // 3 built-in rules
    });

    it('should get built-in alert rules', () => {
      const rules = dashboard.getAlertRules();
      expect(rules.length).toBe(3);
      expect(rules[0].name).toBe('BehaviorOS Pipeline Failures');
    });

    it('should get active alerts (empty initially)', async () => {
      const alerts = await dashboard.getActiveAlerts();
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });

    it('should get alert stats', async () => {
      const stats = await dashboard.getAlertStats();
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.firing).toBe('number');
      expect(typeof stats.acknowledged).toBe('number');
      expect(typeof stats.resolved).toBe('number');
      expect(stats.bySeverity).toBeDefined();
    });

    it('should get alert history (empty initially)', async () => {
      const history = await dashboard.getAlertHistory();
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('dashboard config', () => {
    it('should return dashboard config', () => {
      const config = dashboard.getDashboardConfig();
      expect(config).toBeDefined();
      expect(config.title).toBe('BehaviorOS Dashboard');
      expect(config.panels).toBeDefined();
      expect(config.panels.length).toBeGreaterThan(0);
    });

    it('should export to Grafana format', () => {
      const grafana = dashboard.exportGrafana();
      expect(grafana).toBeDefined();
      expect(grafana.dashboard).toBeDefined();
      expect(grafana.dashboard.title).toBe('BehaviorOS Dashboard');
      expect(grafana.dashboard.panels).toBeDefined();
      expect(grafana.dashboard.panels.length).toBeGreaterThan(0);
    });

    it('should export to Prometheus format', () => {
      const prometheus = dashboard.exportPrometheus();
      expect(prometheus).toBeDefined();
      expect(prometheus.groups).toBeDefined();
      expect(prometheus.groups.length).toBe(1);
      expect(prometheus.groups[0].rules.length).toBe(3);
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const health = await dashboard.getHealthStatus();
      expect(health).toBeDefined();
      expect(health.service).toBe('metrics-collector');
      expect(health.status).toBeDefined();
      expect(typeof health.uptime).toBe('number');
    });
  });
});
