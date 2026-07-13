// ============================================================
// Alert Manager — Alert evaluation, tracking and history
// ============================================================

// ============================================================
// Alert Manager — Alert evaluation, tracking and history
// ============================================================

import type {
  Alert,
  AlertHistory,
  AlertHistoryFilters,
  AlertResult,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  UnifiedMetrics,
} from './types';

// ============================================================
// Alert Manager
// ============================================================

export class AlertManager {
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private readonly alertHistory: AlertHistory[] = [];
  private readonly rules: AlertRule[];

  constructor(rules: AlertRule[] = []) {
    this.rules = rules;
  }

  async evaluateAlert(rule: AlertRule, metrics: UnifiedMetrics): Promise<AlertResult> {
    const currentValue = this.extractMetricValue(rule.name, metrics);
    const triggered = this.evaluateCondition(rule.condition, currentValue, rule.threshold);

    if (triggered) {
      const alert: Alert = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        ruleName: rule.name,
        severity: rule.severity,
        status: 'firing',
        message: `${rule.name}: current value ${currentValue.toFixed(2)} ${rule.condition} threshold ${rule.threshold}`,
        metric: rule.name,
        currentValue,
        threshold: rule.threshold,
        firedAt: new Date().toISOString(),
        channels: rule.channels,
      };

      this.activeAlerts.set(alert.id, alert);
      this.recordHistory(alert);

      return { triggered: true, alert, rule, currentValue, timestamp: new Date().toISOString() };
    }

    return { triggered: false, rule, currentValue, timestamp: new Date().toISOString() };
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values()).filter((a) => a.status === 'firing');
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();

    this.updateHistory(alert);
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();

    this.updateHistory(alert);
    this.activeAlerts.delete(alertId);
  }

  async getAlertHistory(filters?: AlertHistoryFilters): Promise<AlertHistory[]> {
    let results = [...this.alertHistory];

    if (filters?.severity) {
      results = results.filter((h) => h.severity === filters.severity);
    }
    if (filters?.status) {
      results = results.filter((h) => h.status === filters.status);
    }
    if (filters?.ruleName) {
      results = results.filter((h) => h.ruleName === filters.ruleName);
    }
    if (filters?.from) {
      const from = new Date(filters.from).getTime();
      results = results.filter((h) => new Date(h.firedAt).getTime() >= from);
    }
    if (filters?.to) {
      const to = new Date(filters.to).getTime();
      results = results.filter((h) => new Date(h.firedAt).getTime() <= to);
    }

    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results.sort((a, b) => new Date(b.firedAt).getTime() - new Date(a.firedAt).getTime());
  }

  async getAlertStats(): Promise<{
    total: number;
    firing: number;
    acknowledged: number;
    resolved: number;
    bySeverity: Record<AlertSeverity, number>;
  }> {
    const all = [...this.alertHistory];
    const bySeverity: Record<AlertSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const h of all) {
      bySeverity[h.severity]++;
    }

    return {
      total: all.length,
      firing: all.filter((h) => h.status === 'firing').length,
      acknowledged: all.filter((h) => h.status === 'acknowledged').length,
      resolved: all.filter((h) => h.status === 'resolved').length,
      bySeverity,
    };
  }

  private evaluateCondition(condition: string, currentValue: number, threshold: number): boolean {
    switch (condition) {
      case 'above':
        return currentValue > threshold;
      case 'below':
        return currentValue < threshold;
      case 'equals':
        return currentValue === threshold;
      case 'not_equals':
        return currentValue !== threshold;
      default:
        return false;
    }
  }

  private extractMetricValue(ruleName: string, metrics: UnifiedMetrics): number {
    const name = ruleName.toLowerCase();

    if (name.includes('error rate') || name.includes('error_rate')) {
      return metrics.brocolis.api.errorRate;
    }
    if (name.includes('inventory') || name.includes('low inventory')) {
      return metrics.brocolis.deliveries.active;
    }
    if (name.includes('delivery delay') || name.includes('delivery')) {
      return metrics.brocolis.api.latency / 1000;
    }
    if (name.includes('fraud') || name.includes('fraud rate')) {
      const total = metrics.finpay.payments.total || 1;
      return (metrics.finpay.fraud.detected / total) * 100;
    }
    if (name.includes('ocr') || name.includes('ocr failure')) {
      return 100 - metrics.finpay.ocr.accuracy;
    }
    if (name.includes('compliance') || name.includes('compliance violation')) {
      return metrics.finpay.compliance.violations;
    }
    if (name.includes('pipeline failure') || name.includes('pipeline')) {
      return metrics.behavioros.pipeline.failed;
    }
    if (name.includes('quality gate') || name.includes('quality')) {
      return metrics.behavioros.layers.failed;
    }
    if (name.includes('governance block') || name.includes('governance')) {
      return metrics.behavioros.governance.blocked;
    }

    return 0;
  }

  private recordHistory(alert: Alert): void {
    const entry: AlertHistory = {
      id: alert.id,
      ruleName: alert.ruleName,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      metric: alert.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
      firedAt: alert.firedAt,
    };
    this.alertHistory.push(entry);
  }

  private updateHistory(alert: Alert): void {
    const entry = this.alertHistory.find((h) => h.id === alert.id);
    if (entry) {
      entry.status = alert.status;
      entry.acknowledgedAt = alert.acknowledgedAt;
      entry.resolvedAt = alert.resolvedAt;
      if (alert.resolvedAt && alert.firedAt) {
        entry.duration = new Date(alert.resolvedAt).getTime() - new Date(alert.firedAt).getTime();
      }
    }
  }
}
