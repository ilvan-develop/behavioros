// ============================================================
// Dashboard Configurations — BehaviorOS
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
  return [...BEHAVIOROS_ALERTS];
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
