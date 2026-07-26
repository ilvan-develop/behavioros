// @behavioros/observability-dashboard — Barrel Export

export { AlertManager } from './alert-manager';
// --- Dashboard Configurations ---
export {
  BehaviorOSDashboard,
  getAllAlertRules,
  toGrafanaDashboard,
  toPrometheusRules,
} from './dashboard-config';
export type { MetricsCollectorConfig } from './metrics-collector';
// --- Classes ---
export { MetricsCollector } from './metrics-collector';
export type { ObservabilityDashboardConfig } from './observability-dashboard';
// --- High-level Facade ---
export { ObservabilityDashboard } from './observability-dashboard';
// --- Types ---
export type {
  AggregationType,
  Alert,
  AlertChannel,
  AlertCondition,
  AlertHistory,
  AlertHistoryFilters,
  AlertResult,
  AlertRule,
  AlertSeverity,
  AlertStats,
  AlertStatus,
  BehaviorOSGovernance,
  BehaviorOSLayers,
  BehaviorOSLearning,
  BehaviorOSMetrics,
  BehaviorOSPipeline,
  BehaviorOSQuality,
  DashboardConfig,
  DashboardTemplate,
  DashboardVariable,
  DeploymentStatus,
  DeploymentStatusType,
  GrafanaDashboard,
  GrafanaPanel,
  GrafanaTarget,
  GrafanaTemplate,
  HealthLevel,
  HealthStatus,
  MetricDefinition,
  MetricType,
  PanelConfig,
  PanelPosition,
  PanelType,
  PanelVisualization,
  PrometheusAlertingRule,
  PrometheusRuleGroup,
  PrometheusRulesFile,
  UnifiedMetrics,
} from './types';
