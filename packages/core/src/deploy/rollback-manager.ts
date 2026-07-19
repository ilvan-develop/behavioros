import { randomUUID } from 'node:crypto';
import EventEmitter from 'eventemitter3';
import type { HealthCheckResult } from './health-checker';

// ============================================================
// Rollback Manager — Automatic and manual rollback orchestration
// ============================================================

/**
 * Rollback trigger type.
 */
export type RollbackTrigger =
  | 'health-check-failure'
  | 'drift-detected'
  | 'manual'
  | 'timeout'
  | 'error-threshold';

/**
 * Rollback status.
 */
export type RollbackStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

/**
 * A single rollback event in history.
 */
export interface RollbackRecord {
  /** Unique rollback ID. */
  id: string;
  /** Deployment ID being rolled back. */
  deploymentId: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** What triggered the rollback. */
  trigger: RollbackTrigger;
  /** Current status. */
  status: RollbackStatus;
  /** The version being rolled back from. */
  fromVersion: string;
  /** The version being rolled back to. */
  toVersion: string;
  /** The stage percentage at rollback time. */
  stagePercent: number;
  /** Reason description. */
  reason: string;
  /** Associated health check result (if triggered by health). */
  healthCheckResult?: HealthCheckResult;
  /** Drift score at rollback time (if triggered by drift). */
  driftScore?: number;
  /** Error details if rollback itself failed. */
  error?: string;
}

/**
 * Configuration for the rollback manager.
 */
export interface RollbackManagerConfig {
  /** Maximum rollback history to retain. Default: 100. */
  maxHistory: number;
  /** Auto-rollback drift score threshold. Default: 0.30. */
  driftThreshold: number;
  /** Auto-rollback on health failure. Default: true. */
  autoRollbackOnHealth: boolean;
  /** Auto-rollback on drift. Default: true. */
  autoRollbackOnDrift: boolean;
}

/**
 * Events emitted by the rollback manager.
 */
export interface RollbackManagerEvents {
  'rollback:triggered': (record: RollbackRecord) => void;
  'rollback:completed': (record: RollbackRecord) => void;
  'rollback:failed': (record: RollbackRecord) => void;
}

const DEFAULT_ROLLBACK_CONFIG: RollbackManagerConfig = {
  maxHistory: 100,
  driftThreshold: 0.3,
  autoRollbackOnHealth: true,
  autoRollbackOnDrift: true,
};

// ============================================================
// RollbackManager
// ============================================================

export class RollbackManager extends EventEmitter<RollbackManagerEvents> {
  private config: RollbackManagerConfig;
  private history: RollbackRecord[] = [];
  private activeRollback: RollbackRecord | null = null;

  constructor(config?: Partial<RollbackManagerConfig>) {
    super();
    this.config = { ...DEFAULT_ROLLBACK_CONFIG, ...config };
  }

  // ── Rollback triggers ───────────────────────────────────────

  /**
   * Evaluate a health check result and trigger rollback if failing.
   * Returns the rollback record if triggered, null otherwise.
   */
  evaluateHealthCheck(
    result: HealthCheckResult,
    deploymentId: string,
    fromVersion: string,
    toVersion: string,
    stagePercent: number,
  ): RollbackRecord | null {
    if (!this.config.autoRollbackOnHealth) return null;
    if (result.overallStatus !== 'unhealthy') return null;
    if (this.activeRollback) return null;

    return this.triggerRollback({
      deploymentId,
      trigger: 'health-check-failure',
      fromVersion,
      toVersion,
      stagePercent,
      reason: `Health check unhealthy: success=${result.successRate.toFixed(1)}%, latency=${result.avgLatencyMs.toFixed(0)}ms, errors=${result.errorRate.toFixed(1)}%`,
      healthCheckResult: result,
    });
  }

  /**
   * Evaluate a drift score and trigger rollback if above threshold.
   * Returns the rollback record if triggered, null otherwise.
   */
  evaluateDrift(
    driftScore: number,
    deploymentId: string,
    fromVersion: string,
    toVersion: string,
    stagePercent: number,
  ): RollbackRecord | null {
    if (!this.config.autoRollbackOnDrift) return null;
    if (driftScore <= this.config.driftThreshold) return null;
    if (this.activeRollback) return null;

    return this.triggerRollback({
      deploymentId,
      trigger: 'drift-detected',
      fromVersion,
      toVersion,
      stagePercent,
      reason: `Drift score ${driftScore.toFixed(3)} exceeds threshold ${this.config.driftThreshold}`,
      driftScore,
    });
  }

  /**
   * Manually trigger a rollback.
   */
  triggerManual(params: {
    deploymentId: string;
    fromVersion: string;
    toVersion: string;
    stagePercent: number;
    reason: string;
  }): RollbackRecord | null {
    if (this.activeRollback) return null;

    return this.triggerRollback({
      ...params,
      trigger: 'manual',
    });
  }

  // ── Rollback execution ──────────────────────────────────────

  /**
   * Mark the active rollback as completed.
   */
  completeRollback(rollbackId: string): RollbackRecord | null {
    const record = this.history.find((r) => r.id === rollbackId);
    if (record?.status !== 'in-progress') return null;

    record.status = 'completed';
    this.activeRollback = null;
    this.emit('rollback:completed', record);
    return record;
  }

  /**
   * Mark the active rollback as failed.
   */
  failRollback(rollbackId: string, error: string): RollbackRecord | null {
    const record = this.history.find((r) => r.id === rollbackId);
    if (record?.status !== 'in-progress') return null;

    record.status = 'failed';
    record.error = error;
    this.activeRollback = null;
    this.emit('rollback:failed', record);
    return record;
  }

  /**
   * Cancel a pending rollback.
   */
  cancelRollback(rollbackId: string): RollbackRecord | null {
    const record = this.history.find((r) => r.id === rollbackId);
    if (record?.status !== 'pending') return null;

    record.status = 'cancelled';
    this.activeRollback = null;
    return record;
  }

  // ── Query ───────────────────────────────────────────────────

  /**
   * Whether a rollback is currently active.
   */
  hasActiveRollback(): boolean {
    return this.activeRollback !== null;
  }

  /**
   * Get the active rollback record.
   */
  getActiveRollback(): RollbackRecord | null {
    return this.activeRollback;
  }

  /**
   * Get the full rollback history.
   */
  getHistory(): RollbackRecord[] {
    return [...this.history];
  }

  /**
   * Get rollback history for a specific deployment.
   */
  getHistoryForDeployment(deploymentId: string): RollbackRecord[] {
    return this.history.filter((r) => r.deploymentId === deploymentId);
  }

  /**
   * Get the last completed rollback.
   */
  getLastCompleted(): RollbackRecord | undefined {
    return this.history
      .filter((r) => r.status === 'completed')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<RollbackManagerConfig> {
    return this.config;
  }

  // ── Reset ───────────────────────────────────────────────────

  /**
   * Clear all rollback history and active state.
   */
  reset(): void {
    this.history = [];
    this.activeRollback = null;
  }

  // ── Private ─────────────────────────────────────────────────

  private triggerRollback(
    params: Omit<RollbackRecord, 'id' | 'timestamp' | 'status'>,
  ): RollbackRecord {
    const record: RollbackRecord = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      status: 'in-progress',
      ...params,
    };

    this.history.push(record);
    this.activeRollback = record;

    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }

    this.emit('rollback:triggered', record);
    return record;
  }
}
