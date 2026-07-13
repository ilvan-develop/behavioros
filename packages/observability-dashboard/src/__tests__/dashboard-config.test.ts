import { describe, expect, it } from 'vitest';
import {
  BehaviorOSDashboard,
  BrocolisDashboard,
  FinPayDashboard,
  getAllAlertRules,
  toGrafanaDashboard,
  toPrometheusRules,
  UnifiedDashboard,
} from '../dashboard-config';

// ============================================================
// Dashboard Configuration Tests
// ============================================================

describe('Dashboard Configurations', () => {
  describe('BrocolisDashboard', () => {
    it('should return a valid Brocolis dashboard config', () => {
      const config = BrocolisDashboard();

      expect(config.title).toBe('Brocolis Dashboard');
      expect(config.description).toBeDefined();
      expect(config.refreshInterval).toBeGreaterThan(0);
      expect(config.panels).toBeInstanceOf(Array);
      expect(config.panels.length).toBeGreaterThan(0);
      expect(config.templates).toBeInstanceOf(Array);
    });

    it('should have all required panel fields', () => {
      const config = BrocolisDashboard();

      for (const panel of config.panels) {
        expect(panel.title).toBeTruthy();
        expect(panel.type).toBeTruthy();
        expect(panel.metrics).toBeInstanceOf(Array);
        expect(panel.metrics.length).toBeGreaterThan(0);
        expect(panel.position).toBeDefined();
        expect(typeof panel.position.x).toBe('number');
        expect(typeof panel.position.y).toBe('number');
        expect(typeof panel.position.width).toBe('number');
        expect(typeof panel.position.height).toBe('number');
      }
    });

    it('should include brocolis-specific metrics', () => {
      const config = BrocolisDashboard();
      const allMetrics = config.panels.flatMap((p) => p.metrics);

      expect(allMetrics.some((m) => m.includes('brocolis'))).toBe(true);
    });

    it('should have brocolis tags', () => {
      const config = BrocolisDashboard();

      expect(config.tags).toContain('brocolis');
    });
  });

  describe('FinPayDashboard', () => {
    it('should return a valid FinPay dashboard config', () => {
      const config = FinPayDashboard();

      expect(config.title).toBe('FinPay Dashboard');
      expect(config.panels.length).toBeGreaterThan(0);
    });

    it('should include finpay-specific metrics', () => {
      const config = FinPayDashboard();
      const allMetrics = config.panels.flatMap((p) => p.metrics);

      expect(allMetrics.some((m) => m.includes('finpay'))).toBe(true);
    });

    it('should have finpay tags', () => {
      const config = FinPayDashboard();

      expect(config.tags).toContain('finpay');
    });
  });

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

  describe('UnifiedDashboard', () => {
    it('should return a valid unified dashboard config', () => {
      const config = UnifiedDashboard();

      expect(config.title).toBe('Unified Ecosystem Dashboard');
      expect(config.panels.length).toBeGreaterThan(0);
    });

    it('should include metrics from all platforms', () => {
      const config = UnifiedDashboard();
      const allMetrics = config.panels.flatMap((p) => p.metrics);

      expect(allMetrics.some((m) => m.includes('brocolis'))).toBe(true);
      expect(allMetrics.some((m) => m.includes('finpay'))).toBe(true);
      expect(allMetrics.some((m) => m.includes('behavioros'))).toBe(true);
    });

    it('should have unified tags', () => {
      const config = UnifiedDashboard();

      expect(config.tags).toContain('unified');
    });
  });
});

describe('Grafana Dashboard Export', () => {
  it('should convert a dashboard config to Grafana format', () => {
    const config = BrocolisDashboard();
    const grafana = toGrafanaDashboard(config);

    expect(grafana.dashboard).toBeDefined();
    expect(grafana.dashboard.title).toBe(config.title);
    expect(grafana.dashboard.panels).toBeInstanceOf(Array);
    expect(grafana.dashboard.panels.length).toBe(config.panels.length);
    expect(grafana.overwrite).toBe(true);
  });

  it('should map panel types correctly', () => {
    const config = BrocolisDashboard();
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
    const config = FinPayDashboard();
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
    const config = BrocolisDashboard();
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
  it('should return alerts from all platforms', () => {
    const alerts = getAllAlertRules();

    expect(alerts.length).toBeGreaterThan(0);

    const brocolisAlerts = alerts.filter((a) => a.name.toLowerCase().includes('brocolis'));
    const finpayAlerts = alerts.filter((a) => a.name.toLowerCase().includes('finpay'));
    const behaviorosAlerts = alerts.filter((a) => a.name.toLowerCase().includes('behavioros'));

    expect(brocolisAlerts.length).toBeGreaterThan(0);
    expect(finpayAlerts.length).toBeGreaterThan(0);
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
