// ============================================================
// Dashboard Configurations — Brocolis + FinPay + BehaviorOS
// ============================================================

import type {
  AlertRule,
  DashboardConfig,
  GrafanaDashboard,
  GrafanaPanel,
  GrafanaTarget,
  GrafanaTemplate,
  PrometheusAlertingRule,
  PrometheusRuleGroup,
  PrometheusRulesFile,
} from './types';

// ============================================================
// Pre-built Alert Rules
// ============================================================

const BROCOLIS_ALERTS: AlertRule[] = [
  {
    name: 'Brocolis High Error Rate',
    condition: 'above',
    threshold: 5,
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
    description: 'API error rate exceeds 5%',
  },
  {
    name: 'Brocolis Low Inventory',
    condition: 'below',
    threshold: 10,
    severity: 'high',
    channels: ['slack', 'email'],
    description: 'Inventory items below threshold',
  },
  {
    name: 'Brocolis Delivery Delays',
    condition: 'above',
    threshold: 30,
    severity: 'medium',
    channels: ['slack'],
    description: 'Average delivery time exceeds 30 minutes',
  },
];

const FINPAY_ALERTS: AlertRule[] = [
  {
    name: 'FinPay High Fraud Rate',
    condition: 'above',
    threshold: 2,
    severity: 'critical',
    channels: ['slack', 'pagerduty', 'email'],
    description: 'Fraud detection rate exceeds 2%',
  },
  {
    name: 'FinPay OCR Failures',
    condition: 'above',
    threshold: 10,
    severity: 'high',
    channels: ['slack', 'email'],
    description: 'OCR accuracy drops below 90%',
  },
  {
    name: 'FinPay Compliance Violations',
    condition: 'above',
    threshold: 0,
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
    description: 'Any compliance violation detected',
  },
];

const BEHAVIOROS_ALERTS: AlertRule[] = [
  {
    name: 'BehaviorOS Pipeline Failures',
    condition: 'above',
    threshold: 0,
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
    description: 'Pipeline execution failures',
  },
  {
    name: 'BehaviorOS Quality Gate Failures',
    condition: 'above',
    threshold: 0,
    severity: 'high',
    channels: ['slack', 'email'],
    description: 'Quality gate check failures',
  },
  {
    name: 'BehaviorOS Governance Blocks',
    condition: 'above',
    threshold: 5,
    severity: 'medium',
    channels: ['slack'],
    description: 'Excessive governance rule blocks',
  },
];

// ============================================================
// Dashboard Configurations
// ============================================================

export function BrocolisDashboard(): DashboardConfig {
  return {
    title: 'Brocolis Dashboard',
    description: 'Pharmacy operations, prescriptions, deliveries and revenue',
    refreshInterval: 30,
    tags: ['brocolis', 'pharmacy', 'operations'],
    templates: [
      {
        name: 'period',
        variables: [
          {
            name: 'period',
            type: 'custom',
            options: ['1h', '6h', '24h', '7d', '30d'],
            defaultValue: '24h',
          },
        ],
      },
    ],
    panels: [
      {
        title: 'Order Volume',
        type: 'stat',
        metrics: ['brocolis_orders_total'],
        position: { x: 0, y: 0, width: 6, height: 4 },
        description: 'Total orders in selected period',
      },
      {
        title: 'Revenue',
        type: 'stat',
        metrics: ['brocolis_revenue'],
        position: { x: 6, y: 0, width: 6, height: 4 },
        description: 'Total revenue in selected period',
      },
      {
        title: 'Order Status Breakdown',
        type: 'pie',
        metrics: [
          'brocolis_orders_pending',
          'brocolis_orders_completed',
          'brocolis_orders_cancelled',
        ],
        position: { x: 12, y: 0, width: 6, height: 4 },
        description: 'Distribution of order statuses',
      },
      {
        title: 'Orders Over Time',
        type: 'timeseries',
        metrics: ['brocolis_orders_total', 'brocolis_orders_pending', 'brocolis_orders_completed'],
        position: { x: 0, y: 4, width: 12, height: 6 },
        visualization: { legend: 'table', tooltipMode: 'multi' },
      },
      {
        title: 'Prescription Processing',
        type: 'bar',
        metrics: [
          'brocolis_prescriptions_uploaded',
          'brocolis_prescriptions_verified',
          'brocolis_prescriptions_rejected',
        ],
        position: { x: 0, y: 10, width: 6, height: 4 },
        alerts: BROCOLIS_ALERTS,
      },
      {
        title: 'Delivery Status',
        type: 'bar',
        metrics: [
          'brocolis_deliveries_active',
          'brocolis_deliveries_completed',
          'brocolis_deliveries_failed',
        ],
        position: { x: 6, y: 10, width: 6, height: 4 },
      },
      {
        title: 'API Latency (p95)',
        type: 'timeseries',
        metrics: ['brocolis_api_latency_ms'],
        position: { x: 0, y: 14, width: 6, height: 4 },
        visualization: { decimals: 2, unit: 'ms' },
      },
      {
        title: 'API Error Rate',
        type: 'timeseries',
        metrics: ['brocolis_api_error_rate'],
        position: { x: 6, y: 14, width: 6, height: 4 },
        visualization: { decimals: 2, unit: '%' },
      },
      {
        title: 'Active Users',
        type: 'timeseries',
        metrics: ['brocolis_users_active', 'brocolis_users_new', 'brocolis_users_churned'],
        position: { x: 0, y: 18, width: 12, height: 4 },
        visualization: { legend: 'table', tooltipMode: 'multi' },
      },
    ],
  };
}

export function FinPayDashboard(): DashboardConfig {
  return {
    title: 'FinPay Dashboard',
    description: 'Payments, trust scores, fraud detection and compliance',
    refreshInterval: 30,
    tags: ['finpay', 'payments', 'finance'],
    templates: [
      {
        name: 'period',
        variables: [
          {
            name: 'period',
            type: 'custom',
            options: ['1h', '6h', '24h', '7d', '30d'],
            defaultValue: '24h',
          },
        ],
      },
    ],
    panels: [
      {
        title: 'Total Payments',
        type: 'stat',
        metrics: ['finpay_payments_total'],
        position: { x: 0, y: 0, width: 6, height: 4 },
        description: 'Total payment volume',
      },
      {
        title: 'Approval Rate',
        type: 'gauge',
        metrics: ['finpay_payments_approved', 'finpay_payments_total'],
        position: { x: 6, y: 0, width: 6, height: 4 },
        visualization: { decimals: 1 },
      },
      {
        title: 'Payment Status',
        type: 'pie',
        metrics: [
          'finpay_payments_approved',
          'finpay_payments_rejected',
          'finpay_payments_pending_review',
        ],
        position: { x: 12, y: 0, width: 6, height: 4 },
      },
      {
        title: 'Payments Over Time',
        type: 'timeseries',
        metrics: ['finpay_payments_total', 'finpay_payments_approved', 'finpay_payments_rejected'],
        position: { x: 0, y: 4, width: 12, height: 6 },
        visualization: { legend: 'table', tooltipMode: 'multi' },
      },
      {
        title: 'Trust Score Distribution',
        type: 'bar',
        metrics: ['finpay_trust_low', 'finpay_trust_medium', 'finpay_trust_high'],
        position: { x: 0, y: 10, width: 6, height: 4 },
      },
      {
        title: 'Average Trust Score',
        type: 'stat',
        metrics: ['finpay_trust_avg'],
        position: { x: 6, y: 10, width: 6, height: 4 },
        visualization: { decimals: 1 },
      },
      {
        title: 'Fraud Detection',
        type: 'timeseries',
        metrics: [
          'finpay_fraud_detected',
          'finpay_fraud_true_positives',
          'finpay_fraud_false_positives',
        ],
        position: { x: 0, y: 14, width: 6, height: 4 },
        alerts: FINPAY_ALERTS,
      },
      {
        title: 'Compliance Status',
        type: 'stat',
        metrics: ['finpay_compliance_passed', 'finpay_compliance_violations'],
        position: { x: 6, y: 14, width: 6, height: 4 },
      },
      {
        title: 'OCR Accuracy',
        type: 'gauge',
        metrics: ['finpay_ocr_accuracy'],
        position: { x: 0, y: 18, width: 6, height: 4 },
        visualization: { decimals: 1 },
      },
      {
        title: 'OCR Processing Time',
        type: 'timeseries',
        metrics: ['finpay_ocr_processing_time_ms'],
        position: { x: 6, y: 18, width: 6, height: 4 },
        visualization: { decimals: 0, unit: 'ms' },
      },
    ],
  };
}

export function BehaviorOSDashboard(): DashboardConfig {
  return {
    title: 'BehaviorOS Dashboard',
    description: 'Pipeline progress, quality gates, governance and learning',
    refreshInterval: 15,
    tags: ['behavioros', 'governance', 'quality'],
    templates: [
      {
        name: 'pipeline',
        variables: [
          {
            name: 'pipelineId',
            type: 'query',
            query: 'label_values(behavioros_pipeline_active, pipeline_id)',
          },
        ],
      },
    ],
    panels: [
      {
        title: 'Active Pipelines',
        type: 'stat',
        metrics: ['behavioros_pipeline_active'],
        position: { x: 0, y: 0, width: 4, height: 4 },
        alerts: BEHAVIOROS_ALERTS,
      },
      {
        title: 'Completed Pipelines',
        type: 'stat',
        metrics: ['behavioros_pipeline_completed'],
        position: { x: 4, y: 0, width: 4, height: 4 },
      },
      {
        title: 'Failed Pipelines',
        type: 'stat',
        metrics: ['behavioros_pipeline_failed'],
        position: { x: 8, y: 0, width: 4, height: 4 },
      },
      {
        title: 'Layer Pass/Fail',
        type: 'pie',
        metrics: [
          'behavioros_layers_passed',
          'behavioros_layers_failed',
          'behavioros_layers_pending',
        ],
        position: { x: 12, y: 0, width: 6, height: 4 },
      },
      {
        title: 'Governance Decisions',
        type: 'bar',
        metrics: [
          'behavioros_governance_approved',
          'behavioros_governance_escalated',
          'behavioros_governance_blocked',
        ],
        position: { x: 0, y: 4, width: 6, height: 4 },
      },
      {
        title: 'Quality Coverage',
        type: 'gauge',
        metrics: ['behavioros_quality_coverage'],
        position: { x: 6, y: 4, width: 6, height: 4 },
        visualization: { decimals: 1 },
      },
      {
        title: 'Lint & Typecheck',
        type: 'stat',
        metrics: ['behavioros_quality_lint', 'behavioros_quality_typecheck'],
        position: { x: 12, y: 4, width: 6, height: 4 },
      },
      {
        title: 'Learning Events',
        type: 'timeseries',
        metrics: ['behavioros_learning_events'],
        position: { x: 0, y: 8, width: 8, height: 4 },
        visualization: { legend: 'table' },
      },
      {
        title: 'Patterns Detected',
        type: 'stat',
        metrics: ['behavioros_learning_patterns'],
        position: { x: 8, y: 8, width: 4, height: 4 },
      },
      {
        title: 'Auto-Fixes Applied',
        type: 'stat',
        metrics: ['behavioros_learning_autofixes'],
        position: { x: 12, y: 8, width: 6, height: 4 },
      },
    ],
  };
}

export function UnifiedDashboard(): DashboardConfig {
  return {
    title: 'Unified Ecosystem Dashboard',
    description: 'Cross-platform metrics, correlations and trends',
    refreshInterval: 60,
    tags: ['unified', 'ecosystem', 'overview'],
    templates: [
      {
        name: 'period',
        variables: [
          {
            name: 'period',
            type: 'custom',
            options: ['1h', '6h', '24h', '7d', '30d'],
            defaultValue: '24h',
          },
        ],
      },
    ],
    panels: [
      {
        title: 'Ecosystem Health',
        type: 'stat',
        metrics: [
          'brocolis_api_error_rate',
          'finpay_payments_approved',
          'behavioros_pipeline_active',
        ],
        position: { x: 0, y: 0, width: 6, height: 4 },
        description: 'Overall ecosystem health indicator',
      },
      {
        title: 'Revenue & Payments',
        type: 'timeseries',
        metrics: ['brocolis_revenue', 'finpay_payments_total'],
        position: { x: 6, y: 0, width: 6, height: 4 },
        visualization: { legend: 'table', tooltipMode: 'multi' },
      },
      {
        title: 'Pipeline vs Orders',
        type: 'timeseries',
        metrics: ['behavioros_pipeline_completed', 'brocolis_orders_completed'],
        position: { x: 12, y: 0, width: 6, height: 4 },
        visualization: { legend: 'table' },
      },
      {
        title: 'Fraud vs Governance',
        type: 'timeseries',
        metrics: ['finpay_fraud_detected', 'behavioros_governance_blocked'],
        position: { x: 0, y: 4, width: 8, height: 4 },
        visualization: { legend: 'table', tooltipMode: 'multi' },
      },
      {
        title: 'Quality & Compliance',
        type: 'timeseries',
        metrics: ['behavioros_quality_coverage', 'finpay_compliance_passed', 'finpay_ocr_accuracy'],
        position: { x: 8, y: 4, width: 10, height: 4 },
        visualization: { legend: 'table' },
      },
    ],
  };
}

// ============================================================
// Grafana Dashboard Export
// ============================================================

export function toGrafanaDashboard(config: DashboardConfig): GrafanaDashboard {
  let panelId = 0;

  const grafanaPanels: GrafanaPanel[] = config.panels.map((panel) => {
    panelId++;
    const targets: GrafanaTarget[] = panel.metrics.map((metric, idx) => ({
      expr: `${metric}{period="$period"}`,
      legendFormat: `{{${panel.metrics[idx]}}}`,
      refId: String.fromCharCode(65 + idx),
    }));

    const grafanaType = mapPanelType(panel.type);

    return {
      id: panelId,
      title: panel.title,
      type: grafanaType,
      gridPos: {
        h: panel.position.height,
        w: panel.position.width,
        x: panel.position.x,
        y: panel.position.y,
      },
      targets,
      options: panel.visualization
        ? {
            decimals: panel.visualization.decimals,
            legend: { displayMode: panel.visualization.legend ?? 'list' },
            tooltip: { mode: panel.visualization.tooltipMode ?? 'single' },
          }
        : undefined,
    };
  });

  const templates: GrafanaTemplate[] = config.templates.flatMap((t) =>
    t.variables.map((v) => ({
      name: v.name,
      type: v.type === 'custom' ? 'custom' : 'query',
      query: v.query,
      options: v.options?.map((o) => ({ text: o, value: o })),
      current: v.defaultValue ? { text: v.defaultValue, value: v.defaultValue } : undefined,
    })),
  );

  return {
    dashboard: {
      title: config.title,
      tags: config.tags ?? [],
      timezone: 'browser',
      refresh: `${config.refreshInterval}s`,
      time: { from: 'now-24h', to: 'now' },
      panels: grafanaPanels,
      templating: { list: templates },
    },
    overwrite: true,
  };
}

// ============================================================
// Prometheus Alerting Rules Export
// ============================================================

export function toPrometheusRules(alerts: AlertRule[]): PrometheusRulesFile {
  const rules: PrometheusAlertingRule[] = alerts.map((alert) => ({
    alert: alert.name.replace(/\s+/g, '_'),
    expr: buildPrometheusExpr(alert),
    for: `${alert.for ?? 5}m`,
    labels: { severity: alert.severity },
    annotations: {
      summary: alert.name,
      description: alert.description ?? '',
    },
  }));

  const group: PrometheusRuleGroup = {
    name: 'behavioros_alerts',
    interval: '30s',
    rules,
  };

  return { groups: [group] };
}

// ============================================================
// Combined Alerts
// ============================================================

export function getAllAlertRules(): AlertRule[] {
  return [...BROCOLIS_ALERTS, ...FINPAY_ALERTS, ...BEHAVIOROS_ALERTS];
}

// ============================================================
// Helpers
// ============================================================

function mapPanelType(type: string): string {
  const mapping: Record<string, string> = {
    timeseries: 'timeseries',
    stat: 'stat',
    gauge: 'gauge',
    bar: 'barchart',
    pie: 'piechart',
    table: 'table',
    heatmap: 'heatmap',
    logs: 'logs',
    trace: 'traces',
    'alert-list': 'alertlist',
  };
  return mapping[type] ?? 'timeseries';
}

function buildPrometheusExpr(alert: AlertRule): string {
  const metric = alert.name.toLowerCase().replace(/\s+/g, '_');
  const op = alert.condition === 'above' ? '>' : alert.condition === 'below' ? '<' : '==';
  return `${metric} ${op} ${alert.threshold}`;
}
