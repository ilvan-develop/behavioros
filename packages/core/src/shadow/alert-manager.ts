import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DiffResult, DiffSeverity } from './diff-analyzer';

// ============================================================
// Alert Manager — Drift & anomaly alert management
// ============================================================

/**
 * Alert status lifecycle.
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

/**
 * Alert type classification.
 */
export type AlertType =
  | 'drift-threshold'
  | 'regression'
  | 'status-code-mismatch'
  | 'latency-regression'
  | 'schema-break'
  | 'error-introduced'
  | 'compliance-violation';

/**
 * Notification channel for alert delivery.
 */
export type NotificationChannel = 'log' | 'webhook' | 'email' | 'slack' | 'pager';

/**
 * A single alert instance.
 */
export interface Alert {
  /** Unique alert ID. */
  id: string;
  /** Type of alert. */
  type: AlertType;
  /** Current status. */
  status: AlertStatus;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last updated timestamp. */
  updatedAt: string;
  /** ISO-8601 acknowledgement timestamp. */
  acknowledgedAt?: string;
  /** ISO-8601 resolution timestamp. */
  resolvedAt?: string;
  /** Alert severity (derived from DiffSeverity). */
  severity: DiffSeverity;
  /** Human-readable summary. */
  summary: string;
  /** Detailed description. */
  description: string;
  /** Associated diff result IDs. */
  diffResultIds: string[];
  /** Drift score that triggered this alert. */
  driftScore: number;
  /** Metadata for notification templates. */
  metadata: Record<string, unknown>;
}

/**
 * Rules that control when alerts fire.
 */
export interface AlertRule {
  /** Unique rule ID. */
  id: string;
  /** Name of the rule. */
  name: string;
  /** Alert type this rule triggers. */
  type: AlertType;
  /** Minimum severity to trigger. */
  minSeverity: DiffSeverity;
  /** Minimum drift score to trigger. */
  minDriftScore: number;
  /** Cooldown period in ms to avoid duplicate alerts. */
  cooldownMs: number;
  /** Notification channels to use. */
  channels: NotificationChannel[];
  /** Whether this rule is enabled. */
  enabled: boolean;
}

export interface AlertManagerConfig {
  /** Persist path for alerts and rules. */
  persistPath?: string;
  /** Maximum active alerts before suppression. Default: 100. */
  maxActiveAlerts: number;
  /** Default cooldown for auto-generated rules. Default: 300000 (5 min). */
  defaultCooldownMs: number;
  /** Auto-resolve alerts older than this (ms). Default: 86400000 (24h). */
  autoResolveAfterMs: number;
}

interface PersistedState {
  alerts: Alert[];
  rules: AlertRule[];
}

// --- Defaults ---

const DEFAULT_ALERT_CONFIG: AlertManagerConfig = {
  maxActiveAlerts: 100,
  defaultCooldownMs: 300_000,
  autoResolveAfterMs: 86_400_000,
};

const SEVERITY_WEIGHT: Record<DiffSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================================
// AlertManager
// ============================================================

export class AlertManager {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private config: AlertManagerConfig;
  private lastFiredAt: Map<string, number> = new Map();

  constructor(config?: Partial<AlertManagerConfig>) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
    this.registerDefaultRules();
  }

  // ── Core — evaluate diff results for alerts ──────────────────

  /**
   * Evaluate a single diff result against all rules and fire alerts.
   */
  evaluate(diffResult: DiffResult): Alert[] {
    const fired: Alert[] = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;
      if (!this.matchesRule(rule, diffResult)) continue;
      if (this.isOnCooldown(rule.id)) continue;

      const alert = this.createAlert(rule, diffResult);
      if (alert) {
        this.alerts.push(alert);
        this.lastFiredAt.set(rule.id, Date.now());
        fired.push(alert);
      }
    }

    return fired;
  }

  /**
   * Evaluate a batch of diff results and return all fired alerts.
   */
  evaluateBatch(diffResults: DiffResult[]): Alert[] {
    const allFired: Alert[] = [];
    for (const result of diffResults) {
      allFired.push(...this.evaluate(result));
    }
    return allFired;
  }

  // ── Alert lifecycle ──────────────────────────────────────────

  /**
   * Acknowledge an alert.
   */
  acknowledge(alertId: string): Alert | null {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert?.status !== 'active') return null;
    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.updatedAt = alert.acknowledgedAt;
    return alert;
  }

  /**
   * Resolve an alert.
   */
  resolve(alertId: string): Alert | null {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert || alert.status === 'resolved' || alert.status === 'suppressed') return null;
    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.updatedAt = alert.resolvedAt;
    return alert;
  }

  /**
   * Suppress an alert (silently dismiss).
   */
  suppress(alertId: string): Alert | null {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return null;
    alert.status = 'suppressed';
    alert.updatedAt = new Date().toISOString();
    return alert;
  }

  // ── Query ────────────────────────────────────────────────────

  /**
   * Get all alerts (copy), optionally filtered by status.
   */
  getAlerts(status?: AlertStatus): Alert[] {
    if (status) return this.alerts.filter((a) => a.status === status);
    return [...this.alerts];
  }

  /**
   * Get active alerts count by severity.
   */
  getActiveCounts(): Record<DiffSeverity, number> {
    const counts: Record<DiffSeverity, number> = {
      info: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const alert of this.alerts) {
      if (alert.status === 'active') {
        counts[alert.severity]++;
      }
    }
    return counts;
  }

  /**
   * Auto-resolve stale alerts.
   */
  autoResolveStale(): Alert[] {
    const now = Date.now();
    const resolved: Alert[] = [];
    for (const alert of this.alerts) {
      if (alert.status === 'active') {
        const age = now - new Date(alert.createdAt).getTime();
        if (age > this.config.autoResolveAfterMs) {
          const r = this.resolve(alert.id);
          if (r) resolved.push(r);
        }
      }
    }
    return resolved;
  }

  // ── Rules ────────────────────────────────────────────────────

  /**
   * Add or update a custom alert rule.
   */
  upsertRule(rule: AlertRule): void {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Remove an alert rule.
   */
  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx < 0) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  /**
   * Get all rules (copy).
   */
  getRules(): AlertRule[] {
    return [...this.rules];
  }

  // ── Persist ──────────────────────────────────────────────────

  async persist(path?: string): Promise<void> {
    const target = path ?? this.config.persistPath;
    if (!target) throw new Error('No persist path configured');

    const dir = dirname(target);
    if (!existsSync(dir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
    }

    const state: PersistedState = { alerts: this.alerts, rules: this.rules };
    await writeFile(target, JSON.stringify(state, null, 2), 'utf-8');
  }

  async load(path: string): Promise<void> {
    if (!existsSync(path)) throw new Error(`Persist file not found: ${path}`);
    const raw = await readFile(path, 'utf-8');
    const state = JSON.parse(raw) as PersistedState;
    this.alerts = state.alerts ?? [];
    this.rules = state.rules ?? [];
  }

  /** Get the active config (read-only). */
  getConfig(): Readonly<AlertManagerConfig> {
    return this.config;
  }

  /** Clear all alerts. */
  clearAlerts(): void {
    this.alerts = [];
  }

  // ── Matching logic ───────────────────────────────────────────

  private matchesRule(rule: AlertRule, result: DiffResult): boolean {
    if (result.driftScore < rule.minDriftScore) return false;
    if (SEVERITY_WEIGHT[result.overallSeverity] < SEVERITY_WEIGHT[rule.minSeverity]) return false;

    switch (rule.type) {
      case 'regression':
        return result.regressions;
      case 'drift-threshold':
        return result.driftScore >= rule.minDriftScore;
      case 'status-code-mismatch':
        return !result.statusCodeMatch;
      case 'latency-regression':
        return result.latencyRatio >= 1.5;
      case 'error-introduced':
        return result.findings.some((f) => f.category === 'error-introduced');
      case 'schema-break':
        return result.findings.some((f) => f.category === 'schema-change');
      case 'compliance-violation':
        return result.findings.some((f) => f.severity === 'critical');
      default:
        return false;
    }
  }

  private isOnCooldown(ruleId: string): boolean {
    const lastFired = this.lastFiredAt.get(ruleId);
    if (lastFired === undefined) return false;
    const rule = this.rules.find((r) => r.id === ruleId);
    const cooldown = rule?.cooldownMs ?? this.config.defaultCooldownMs;
    return Date.now() - lastFired < cooldown;
  }

  private createAlert(rule: AlertRule, result: DiffResult): Alert | null {
    if (this.alerts.filter((a) => a.status === 'active').length >= this.config.maxActiveAlerts) {
      return null;
    }

    return {
      id: randomUUID(),
      type: rule.type,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      severity: result.overallSeverity,
      summary: `${rule.name}: drift=${result.driftScore}, severity=${result.overallSeverity}`,
      description: this.buildDescription(rule, result),
      diffResultIds: [result.id],
      driftScore: result.driftScore,
      metadata: {
        ruleId: rule.id,
        channels: rule.channels,
        statusCodeMatch: result.statusCodeMatch,
        latencyRatio: result.latencyRatio,
        regressions: result.regressions,
      },
    };
  }

  private buildDescription(rule: AlertRule, result: DiffResult): string {
    const parts: string[] = [`Alert triggered by rule "${rule.name}".`];
    parts.push(`Drift score: ${result.driftScore}/100.`);
    parts.push(`Overall severity: ${result.overallSeverity}.`);

    if (result.regressions) {
      parts.push('Regressions detected (new errors introduced by shadow).');
    }
    if (!result.statusCodeMatch) {
      parts.push(
        `Status code mismatch: original=${result.statusCodeMatch ? 'match' : 'different'}.`,
      );
    }
    if (result.latencyRatio > 1.5) {
      parts.push(`Shadow is ${Math.round((result.latencyRatio - 1) * 100)}% slower.`);
    }

    return parts.join(' ');
  }

  // ── Default rules ────────────────────────────────────────────

  private registerDefaultRules(): void {
    this.rules.push({
      id: 'rule-regression',
      name: 'Regression Detected',
      type: 'regression',
      minSeverity: 'medium',
      minDriftScore: 10,
      cooldownMs: this.config.defaultCooldownMs,
      channels: ['log'],
      enabled: true,
    });
    this.rules.push({
      id: 'rule-drift-threshold',
      name: 'Drift Threshold Exceeded',
      type: 'drift-threshold',
      minSeverity: 'medium',
      minDriftScore: 30,
      cooldownMs: this.config.defaultCooldownMs,
      channels: ['log'],
      enabled: true,
    });
    this.rules.push({
      id: 'rule-error-introduced',
      name: 'Error Introduced by Shadow',
      type: 'error-introduced',
      minSeverity: 'high',
      minDriftScore: 0,
      cooldownMs: this.config.defaultCooldownMs,
      channels: ['log'],
      enabled: true,
    });
    this.rules.push({
      id: 'rule-critical',
      name: 'Critical Severity Alert',
      type: 'compliance-violation',
      minSeverity: 'critical',
      minDriftScore: 0,
      cooldownMs: 60_000,
      channels: ['log', 'webhook'],
      enabled: true,
    });
  }
}
