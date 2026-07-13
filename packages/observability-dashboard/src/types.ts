// ============================================================
// Observability Dashboard — Type Definitions
// ============================================================

// --- Metric Definitions ---

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'rate' | 'p95' | 'p99';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  labels: string[];
  aggregation: AggregationType;
  threshold?: number;
  unit?: string;
  description?: string;
}

// --- Dashboard Configuration ---

export interface DashboardTemplate {
  name: string;
  variables: DashboardVariable[];
}

export interface DashboardVariable {
  name: string;
  type: 'query' | 'interval' | 'custom';
  query?: string;
  options?: string[];
  defaultValue?: string;
}

export interface DashboardConfig {
  title: string;
  description?: string;
  refreshInterval: number;
  panels: PanelConfig[];
  templates: DashboardTemplate[];
  tags?: string[];
}

// --- Panel Configuration ---

export type PanelType =
  | 'timeseries'
  | 'stat'
  | 'gauge'
  | 'bar'
  | 'pie'
  | 'table'
  | 'heatmap'
  | 'logs'
  | 'trace'
  | 'alert-list';

export interface PanelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelConfig {
  title: string;
  type: PanelType;
  metrics: string[];
  position: PanelPosition;
  alerts?: AlertRule[];
  description?: string;
  visualization?: PanelVisualization;
}

export interface PanelVisualization {
  colorScheme?: string;
  decimals?: number;
  unit?: string;
  legend?: 'list' | 'table' | 'hidden';
  tooltipMode?: 'single' | 'multi' | 'none';
}

// --- Alert Rules ---

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type AlertCondition = 'above' | 'below' | 'equals' | 'not_equals' | 'change' | 'absent';
export type AlertChannel = 'slack' | 'email' | 'pagerduty' | 'webhook' | 'sms';

export interface AlertRule {
  name: string;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  channels: AlertChannel[];
  for?: number;
  description?: string;
  runbook?: string;
}

export interface Alert {
  id: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  channels: AlertChannel[];
}

export type AlertStatus = 'pending' | 'firing' | 'acknowledged' | 'resolved';

export interface AlertResult {
  triggered: boolean;
  alert?: Alert;
  rule: AlertRule;
  currentValue: number;
  timestamp: string;
}

export interface AlertHistoryFilters {
  severity?: AlertSeverity;
  status?: AlertStatus;
  from?: string;
  to?: string;
  ruleName?: string;
  limit?: number;
}

export interface AlertHistory {
  id: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  duration?: number;
}

// --- Health Status ---

export type HealthLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthStatus {
  service: string;
  status: HealthLevel;
  uptime: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}

// --- Deployment Status ---

export type DeploymentStatusType =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface DeploymentStatus {
  version: string;
  environment: string;
  status: DeploymentStatusType;
  progress: number;
  rollbackAvailable: boolean;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

// --- Platform-Specific Metrics ---

export interface BrocolisOrders {
  total: number;
  pending: number;
  completed: number;
  cancelled: number;
  revenue: number;
}

export interface BrocolisPrescriptions {
  uploaded: number;
  verified: number;
  rejected: number;
}

export interface BrocolisDeliveries {
  active: number;
  completed: number;
  failed: number;
}

export interface BrocolisUsers {
  active: number;
  new: number;
  churned: number;
}

export interface BrocolisApi {
  latency: number;
  errorRate: number;
  throughput: number;
}

export interface BrocolisMetrics {
  orders: BrocolisOrders;
  prescriptions: BrocolisPrescriptions;
  deliveries: BrocolisDeliveries;
  users: BrocolisUsers;
  api: BrocolisApi;
  timestamp: string;
}

export interface FinPayPayments {
  total: number;
  approved: number;
  rejected: number;
  pendingReview: number;
}

export interface FinPayTrust {
  avgScore: number;
  distribution: Record<string, number>;
}

export interface FinPayFraud {
  detected: number;
  falsePositives: number;
  truePositives: number;
}

export interface FinPayCompliance {
  passed: number;
  violations: number;
}

export interface FinPayOcr {
  accuracy: number;
  processingTime: number;
}

export interface FinPayMetrics {
  payments: FinPayPayments;
  trust: FinPayTrust;
  fraud: FinPayFraud;
  compliance: FinPayCompliance;
  ocr: FinPayOcr;
  timestamp: string;
}

export interface BehaviorOSPipeline {
  active: number;
  completed: number;
  failed: number;
}

export interface BehaviorOSLayers {
  passed: number;
  failed: number;
  pending: number;
}

export interface BehaviorOSGovernance {
  blocked: number;
  escalated: number;
  approved: number;
}

export interface BehaviorOSQuality {
  coverage: number;
  lintPass: boolean;
  typecheckPass: boolean;
}

export interface BehaviorOSLearning {
  events: number;
  patterns: number;
  autoFixes: number;
}

export interface BehaviorOSMetrics {
  pipeline: BehaviorOSPipeline;
  layers: BehaviorOSLayers;
  governance: BehaviorOSGovernance;
  quality: BehaviorOSQuality;
  learning: BehaviorOSLearning;
  timestamp: string;
}

// --- Unified Metrics ---

export interface UnifiedMetrics {
  brocolis: BrocolisMetrics;
  finpay: FinPayMetrics;
  behavioros: BehaviorOSMetrics;
  timestamp: string;
}

// --- Grafana Export Types ---

export interface GrafanaDashboard {
  dashboard: {
    title: string;
    tags: string[];
    timezone: string;
    refresh: string;
    time: { from: string; to: string };
    panels: GrafanaPanel[];
    templating: { list: GrafanaTemplate[] };
  };
  overwrite: boolean;
}

export interface GrafanaPanel {
  id: number;
  title: string;
  type: string;
  gridPos: { h: number; w: number; x: number; y: number };
  targets: GrafanaTarget[];
  options?: Record<string, unknown>;
}

export interface GrafanaTarget {
  expr: string;
  legendFormat: string;
  refId: string;
}

export interface GrafanaTemplate {
  name: string;
  type: string;
  query?: string;
  options?: Array<{ text: string; value: string }>;
  current?: { text: string; value: string };
}

// --- Prometheus Export Types ---

export interface PrometheusAlertingRule {
  alert: string;
  expr: string;
  for: string;
  labels: { severity: string };
  annotations: { summary: string; description: string };
}

export interface PrometheusRuleGroup {
  name: string;
  interval: string;
  rules: PrometheusAlertingRule[];
}

export interface PrometheusRulesFile {
  groups: PrometheusRuleGroup[];
}
