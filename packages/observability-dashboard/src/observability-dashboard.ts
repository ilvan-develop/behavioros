// ============================================================
// ObservabilityDashboard — High-level facade
// ============================================================
//
// Ties MetricsCollector, AlertManager, and DashboardConfig
// into a single entry point for BehaviorOS observability.
//
// ============================================================

import { AlertManager } from './alert-manager';
import {
  BehaviorOSDashboard,
  getAllAlertRules,
  toGrafanaDashboard,
  toPrometheusRules,
} from './dashboard-config';
import type { MetricsCollectorConfig } from './metrics-collector';
import { MetricsCollector } from './metrics-collector';
import type {
  Alert,
  AlertHistory,
  AlertHistoryFilters,
  AlertResult,
  AlertRule,
  AlertStats,
  BehaviorOSMetrics,
  DashboardConfig,
  GrafanaDashboard,
  HealthStatus,
  PrometheusRulesFile,
  UnifiedMetrics,
} from './types';

// ============================================================
// Config
// ============================================================

export interface ObservabilityDashboardConfig {
  /** MetricsCollector configuration. */
  metrics?: MetricsCollectorConfig;
  /** Additional alert rules beyond the built-in BehaviorOS rules. */
  alertRules?: AlertRule[];
  /** Auto-start the metrics collector on init. Default: false. */
  autoStart?: boolean;
}

// ============================================================
// ObservabilityDashboard
// ============================================================

export class ObservabilityDashboard {
  private readonly metricsCollector: MetricsCollector;
  private readonly alertManager: AlertManager;
  private readonly dashboardConfig: DashboardConfig;
  private _initialized = false;

  constructor(config: ObservabilityDashboardConfig = {}) {
    const rules = [...getAllAlertRules(), ...(config.alertRules ?? [])];
    this.alertManager = new AlertManager(rules);
    this.metricsCollector = new MetricsCollector(config.metrics);
    this.dashboardConfig = BehaviorOSDashboard();

    if (config.autoStart) {
      this.metricsCollector.start();
    }
    this._initialized = true;
  }

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  get isInitialized(): boolean {
    return this._initialized;
  }

  start(): void {
    this.metricsCollector.start();
  }

  stop(): void {
    this.metricsCollector.stop();
  }

  // ----------------------------------------------------------
  // Metrics
  // ----------------------------------------------------------

  async collectMetrics(): Promise<UnifiedMetrics> {
    return this.metricsCollector.collectAll();
  }

  async getBehaviorOSMetrics(): Promise<BehaviorOSMetrics> {
    return this.metricsCollector.collectBehaviorOSMetrics();
  }

  getMetricHistory(metricName: string, durationMs: number) {
    return this.metricsCollector.getMetricHistory(metricName, durationMs);
  }

  // ----------------------------------------------------------
  // Alerts
  // ----------------------------------------------------------

  async evaluateAlerts(): Promise<AlertResult[]> {
    const metrics = await this.metricsCollector.collectAll();
    const results: AlertResult[] = [];
    for (const rule of this.alertManager.getRules()) {
      const result = await this.alertManager.evaluateAlert(rule, metrics);
      results.push(result);
    }
    return results;
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return this.alertManager.getActiveAlerts();
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    return this.alertManager.acknowledgeAlert(alertId);
  }

  async resolveAlert(alertId: string): Promise<void> {
    return this.alertManager.resolveAlert(alertId);
  }

  async getAlertHistory(filters?: AlertHistoryFilters): Promise<AlertHistory[]> {
    return this.alertManager.getAlertHistory(filters);
  }

  async getAlertStats(): Promise<AlertStats> {
    return this.alertManager.getAlertStats();
  }

  getAlertRules(): AlertRule[] {
    return this.alertManager.getRules();
  }

  // ----------------------------------------------------------
  // Dashboard Config
  // ----------------------------------------------------------

  getDashboardConfig(): DashboardConfig {
    return this.dashboardConfig;
  }

  exportGrafana(): GrafanaDashboard {
    return toGrafanaDashboard(this.dashboardConfig);
  }

  exportPrometheus(): PrometheusRulesFile {
    return toPrometheusRules(getAllAlertRules());
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealthStatus(): Promise<HealthStatus> {
    return this.metricsCollector.getHealthStatus();
  }
}
