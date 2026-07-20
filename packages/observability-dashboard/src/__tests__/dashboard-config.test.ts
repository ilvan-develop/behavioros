import { describe, expect, it } from 'vitest';
import {
  BehaviorOSDashboard,
  getAllAlertRules,
  toGrafanaDashboard,
  toPrometheusRules,
} from '../dashboard-config';

// ============================================================
// Dashboard Configuration Tests
// ============================================================

describe('Dashboard Configurations', () => {
  describe('BehaviorOSDashboard', () => {
    it('should return a valid BehaviorOS dashboard config', () => {
      const config = BehaviorOSDashboard();

      expect(config.title).toBe('BehaviorOS Dashboard');
      expect(config.panels.length).toBeGreaterThan(0);
    });

    it('should include behavioros-specific metrics', () => {
      const config = BehaviorOSDashboard();
      const allMetrics = config.panels.flatMap((p) => p.metrics);

      expect(allMetrics.some((m) => m.includes('behavioros'))).toBe(true);
    });

    it('should have behavioros tags', () => {
      const config = BehaviorOSDashboard();

      expect(config.tags).toContain('behavioros');
    });
  });
});

describe('Grafana Dashboard Export', () => {
  it('should convert a dashboard config to Grafana format', () => {
    const config = BehaviorOSDashboard();
    const grafana = toGrafanaDashboard(config);

    expect(grafana.dashboard).toBeDefined();
    expect(grafana.dashboard.title).toBe(config.title);
    expect(grafana.dashboard.panels).toBeInstanceOf(Array);
    expect(grafana.dashboard.panels.length).toBe(config.panels.length);
    expect(grafana.overwrite).toBe(true);
  });

  it('should map panel types correctly', () => {
    const config = BehaviorOSDashboard();
    const grafana = toGrafanaDashboard(config);

    for (const panel of grafana.dashboard.panels) {
      expect(panel.id).toBeGreaterThan(0);
      expect(panel.title).toBeTruthy();
      expect(panel.type).toBeTruthy();
      expect(panel.gridPos).toBeDefined();
      expect(panel.targets).toBeInstanceOf(Array);
    }
  });

  it('should generate targets from metrics', () => {
    const config = BehaviorOSDashboard();
    const grafana = toGrafanaDashboard(config);

    for (const panel of grafana.dashboard.panels) {
      expect(panel.targets.length).toBeGreaterThan(0);
      for (const target of panel.targets) {
        expect(target.expr).toBeTruthy();
        expect(target.refId).toBeTruthy();
      }
    }
  });

  it('should include templating variables', () => {
    const config = BehaviorOSDashboard();
    const grafana = toGrafanaDashboard(config);

    expect(grafana.dashboard.templating.list).toBeInstanceOf(Array);
    expect(grafana.dashboard.templating.list.length).toBeGreaterThan(0);
  });

  it('should set timezone and refresh interval', () => {
    const config = BehaviorOSDashboard();
    const grafana = toGrafanaDashboard(config);

    expect(grafana.dashboard.timezone).toBe('browser');
    expect(grafana.dashboard.refresh).toContain('s');
  });
});

describe('Prometheus Rules Export', () => {
  it('should convert alert rules to Prometheus format', () => {
    const rules = getAllAlertRules();
    const prometheus = toPrometheusRules(rules);

    expect(prometheus.groups).toBeInstanceOf(Array);
    expect(prometheus.groups.length).toBe(1);
  });

  it('should have valid rule group structure', () => {
    const rules = getAllAlertRules();
    const prometheus = toPrometheusRules(rules);
    const group = prometheus.groups[0];

    expect(group.name).toBe('behavioros_alerts');
    expect(group.interval).toBe('30s');
    expect(group.rules).toBeInstanceOf(Array);
    expect(group.rules.length).toBe(rules.length);
  });

  it('should generate valid alerting rules', () => {
    const rules = getAllAlertRules();
    const prometheus = toPrometheusRules(rules);

    for (const rule of prometheus.groups[0].rules) {
      expect(rule.alert).toBeTruthy();
      expect(rule.alert).not.toContain(' ');
      expect(rule.expr).toBeTruthy();
      expect(rule.for).toBeTruthy();
      expect(rule.labels.severity).toBeTruthy();
      expect(rule.annotations.summary).toBeTruthy();
    }
  });
});

describe('getAllAlertRules', () => {
  it('should return BehaviorOS alerts', () => {
    const alerts = getAllAlertRules();

    expect(alerts.length).toBeGreaterThan(0);

    const behaviorosAlerts = alerts.filter((a) => a.name.toLowerCase().includes('behavioros'));

    expect(behaviorosAlerts.length).toBeGreaterThan(0);
  });

  it('should have valid alert rule structure', () => {
    const alerts = getAllAlertRules();

    for (const alert of alerts) {
      expect(alert.name).toBeTruthy();
      expect(alert.condition).toBeTruthy();
      expect(typeof alert.threshold).toBe('number');
      expect(alert.severity).toBeTruthy();
      expect(alert.channels).toBeInstanceOf(Array);
      expect(alert.channels.length).toBeGreaterThan(0);
    }
  });
});
