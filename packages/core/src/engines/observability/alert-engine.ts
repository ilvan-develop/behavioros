import { randomUUID } from 'node:crypto';

/**
 * AlertRule — Configuration and options interface.
 */
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
}

/**
 * Alert — Configuration and options interface.
 */
export interface Alert {
  id: string;
  ruleId: string;
  name: string;
  severity: string;
  value: number;
  threshold: number;
  firedAt: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

/**
 * AlertEngine — alert engine.
 *
 * Methods: addRule, removeRule, evaluate, acknowledge, resolve, getAlerts, getRules, clear.
 */
export class AlertEngine {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private sustainedViolations: Map<string, { startTime: number; currentValue: number }> = new Map();

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(id: string): void {
    this.rules.delete(id);
  }

  evaluate(metrics: Record<string, number>): Alert[] {
    const fired: Alert[] = [];

    for (const [, rule] of this.rules) {
      const value = metrics[rule.metric];
      if (value === undefined) continue;

      const violated = this.checkCondition(value, rule.condition, rule.threshold);

      if (violated) {
        if (!this.sustainedViolations.has(rule.id)) {
          this.sustainedViolations.set(rule.id, {
            startTime: performance.now(),
            currentValue: value,
          });
        }

        const entry = this.sustainedViolations.get(rule.id)!;
        if (performance.now() - entry.startTime >= rule.duration) {
          if (!this.hasActiveAlert(rule.id)) {
            const alert: Alert = {
              id: randomUUID(),
              ruleId: rule.id,
              name: rule.name,
              severity: rule.severity,
              value,
              threshold: rule.threshold,
              firedAt: new Date().toISOString(),
              acknowledged: false,
            };
            this.alerts.set(alert.id, alert);
            fired.push(alert);
          }
        }
      } else {
        this.sustainedViolations.delete(rule.id);
      }
    }

    return fired;
  }

  acknowledge(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) alert.acknowledged = true;
  }

  resolve(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.resolvedAt = new Date().toISOString();
      const ruleId = alert.ruleId;
      this.sustainedViolations.delete(ruleId);
    }
  }

  getAlerts(status?: string): Alert[] {
    const all = [...this.alerts.values()];
    if (!status) return all;
    if (status === 'active') return all.filter((a) => !a.resolvedAt);
    if (status === 'resolved') return all.filter((a) => a.resolvedAt);
    if (status === 'acknowledged') return all.filter((a) => a.acknowledged);
    if (status === 'unacknowledged') return all.filter((a) => !a.acknowledged);
    return all;
  }

  getRules(): AlertRule[] {
    return [...this.rules.values()];
  }

  clear(): void {
    this.rules.clear();
    this.alerts.clear();
    this.sustainedViolations.clear();
  }

  private checkCondition(value: number, condition: 'gt' | 'lt' | 'eq', threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
    }
  }

  private hasActiveAlert(ruleId: string): boolean {
    for (const alert of this.alerts.values()) {
      if (alert.ruleId === ruleId && !alert.resolvedAt) return true;
    }
    return false;
  }
}
