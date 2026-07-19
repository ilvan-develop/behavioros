import { randomUUID } from 'node:crypto';
import EventEmitter from 'eventemitter3';
import { HealthChecker, type HealthCheckerConfig, type HealthCheckResult } from './health-checker';
import {
  RollbackManager,
  type RollbackManagerConfig,
  type RollbackRecord,
} from './rollback-manager';
import { STAGE_5_CONFIG } from './stages/stage-5';
import { STAGE_25_CONFIG } from './stages/stage-25';
import { STAGE_50_CONFIG } from './stages/stage-50';
import { STAGE_100_CONFIG } from './stages/stage-100';
import { TrafficSplitter, type TrafficSplitterConfig } from './traffic-splitter';

// ============================================================
// Canary Deployer — Main orchestrator for staged DNA deployment
// ============================================================

/**
 * Configuration for a single canary deployment stage.
 */
export interface CanaryStageConfig {
  /** Stage identifier (e.g. "stage-5"). */
  name: string;
  /** Traffic percentage to route to canary. */
  trafficPercent: number;
  /** Duration to hold this stage in ms. 0 = until manual promotion. */
  durationMs: number;
  /** Health check interval during this stage. */
  healthCheckIntervalMs: number;
  /** Consecutive healthy checks required before advancing. */
  requiredConsecutiveHealthy: number;
  /** Maximum drift score allowed at this stage. */
  driftThreshold: number;
  /** Whether to auto-advance when duration + health checks pass. */
  autoAdvance: boolean;
  /** Human-readable description. */
  description: string;
}

/**
 * Deployment status.
 */
export type CanaryDeploymentStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'rolled-back'
  | 'failed'
  | 'paused';

/**
 * A snapshot of the current stage state.
 */
export interface CanaryStageState {
  /** Stage configuration. */
  config: CanaryStageConfig;
  /** ISO-8601 stage start time. */
  startedAt: string;
  /** ISO-8601 stage end time (if completed). */
  completedAt?: string;
  /** Number of consecutive healthy checks in this stage. */
  consecutiveHealthy: number;
  /** Last health check result. */
  lastHealthCheck?: HealthCheckResult;
  /** Whether the stage duration has elapsed. */
  durationElapsed: boolean;
}

/**
 * Complete canary deployment record.
 */
export interface CanaryDeployment {
  /** Unique deployment ID. */
  id: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 completion timestamp. */
  completedAt?: string;
  /** Current deployment status. */
  status: CanaryDeploymentStatus;
  /** Stable version identifier. */
  stableVersion: string;
  /** Canary version identifier. */
  canaryVersion: string;
  /** Project or DNA name. */
  projectName: string;
  /** Current stage index (0-based). */
  currentStageIndex: number;
  /** All stage states in order. */
  stages: CanaryStageState[];
  /** Current traffic split. */
  trafficSplit: Record<string, number>;
  /** Rollback record if rolled back. */
  rollbackRecord?: RollbackRecord;
  /** Error message if failed. */
  error?: string;
}

/**
 * Configuration for the canary deployer.
 */
export interface CanaryDeployerConfig {
  /** Ordered stages for the canary rollout. Default: [5%, 25%, 50%, 100%]. */
  stages: CanaryStageConfig[];
  /** Health checker configuration overrides. */
  healthChecker: Partial<HealthCheckerConfig>;
  /** Rollback manager configuration overrides. */
  rollbackManager: Partial<RollbackManagerConfig>;
  /** Traffic splitter configuration overrides. */
  trafficSplitter: Partial<TrafficSplitterConfig>;
  /** Global drift score threshold for immediate rollback. Default: 0.30. */
  globalDriftThreshold: number;
  /** Callback invoked on status change. */
  onStatusChange?: (status: CanaryDeploymentStatus) => void;
}

/**
 * Events emitted by the canary deployer.
 */
export interface CanaryDeployerEvents {
  'deployment:started': (deployment: CanaryDeployment) => void;
  'deployment:stage-advanced': (deployment: CanaryDeployment, stage: CanaryStageConfig) => void;
  'deployment:completed': (deployment: CanaryDeployment) => void;
  'deployment:rolled-back': (deployment: CanaryDeployment, record: RollbackRecord) => void;
  'deployment:failed': (deployment: CanaryDeployment, error: string) => void;
  'deployment:paused': (deployment: CanaryDeployment) => void;
  'deployment:resumed': (deployment: CanaryDeployment) => void;
}

const DEFAULT_STAGES: CanaryStageConfig[] = [
  STAGE_5_CONFIG,
  STAGE_25_CONFIG,
  STAGE_50_CONFIG,
  STAGE_100_CONFIG,
];

const DEFAULT_DEPLOYER_CONFIG: CanaryDeployerConfig = {
  stages: DEFAULT_STAGES,
  healthChecker: {},
  rollbackManager: {},
  trafficSplitter: {},
  globalDriftThreshold: 0.3,
};

// ============================================================
// CanaryDeployer
// ============================================================

export class CanaryDeployer extends EventEmitter<CanaryDeployerEvents> {
  private config: CanaryDeployerConfig;
  private healthChecker: HealthChecker;
  private rollbackManager: RollbackManager;
  private trafficSplitter: TrafficSplitter;
  private deployment: CanaryDeployment | null = null;
  private stageTimer: ReturnType<typeof setTimeout> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private deployments: CanaryDeployment[] = [];

  constructor(config?: Partial<CanaryDeployerConfig>) {
    super();
    this.config = { ...DEFAULT_DEPLOYER_CONFIG, ...config };

    this.healthChecker = new HealthChecker({
      ...this.config.healthChecker,
      intervalMs: this.config.stages[0]?.healthCheckIntervalMs ?? 30_000,
    });
    this.rollbackManager = new RollbackManager(this.config.rollbackManager);
    this.trafficSplitter = new TrafficSplitter(this.config.trafficSplitter);

    this.wireEvents();
  }

  // ── Deployment lifecycle ────────────────────────────────────

  /**
   * Start a new canary deployment.
   */
  async startDeployment(params: {
    stableVersion: string;
    canaryVersion: string;
    projectName: string;
  }): Promise<CanaryDeployment> {
    if (this.deployment && this.deployment.status === 'in-progress') {
      throw new Error('A canary deployment is already in progress');
    }

    const stages: CanaryStageState[] = this.config.stages.map((config) => ({
      config,
      startedAt: '',
      consecutiveHealthy: 0,
      durationElapsed: false,
    }));

    const deployment: CanaryDeployment = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'in-progress',
      stableVersion: params.stableVersion,
      canaryVersion: params.canaryVersion,
      projectName: params.projectName,
      currentStageIndex: 0,
      stages,
      trafficSplit: {},
    };

    this.deployment = deployment;
    this.deployments.push(deployment);

    this.emit('deployment:started', deployment);
    await this.enterStage(0);

    return deployment;
  }

  /**
   * Report health metrics for the current canary stage.
   * Call this periodically with observed metrics.
   */
  reportHealth(metrics: {
    successCount: number;
    totalCount: number;
    totalLatencyMs: number;
    errorCount: number;
  }): HealthCheckResult | null {
    if (this.deployment?.status !== 'in-progress') return null;

    const result = this.healthChecker.check(metrics);
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    currentStage.lastHealthCheck = result;

    if (result.overallStatus === 'healthy') {
      currentStage.consecutiveHealthy++;
    } else {
      currentStage.consecutiveHealthy = 0;
    }

    const rollbackRecord = this.rollbackManager.evaluateHealthCheck(
      result,
      this.deployment.id,
      this.deployment.stableVersion,
      this.deployment.canaryVersion,
      currentStage.config.trafficPercent,
    );

    if (rollbackRecord) {
      this.handleRollback(rollbackRecord);
    } else if (this.shouldAdvanceStage()) {
      this.advanceStage();
    }

    return result;
  }

  /**
   * Report drift score from shadow analysis.
   */
  reportDrift(driftScore: number): RollbackRecord | null {
    if (this.deployment?.status !== 'in-progress') return null;

    if (driftScore > this.config.globalDriftThreshold) {
      const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
      const rollbackRecord = this.rollbackManager.evaluateDrift(
        driftScore,
        this.deployment.id,
        this.deployment.stableVersion,
        this.deployment.canaryVersion,
        currentStage.config.trafficPercent,
      );

      if (rollbackRecord) {
        this.handleRollback(rollbackRecord);
        return rollbackRecord;
      }
    }

    return null;
  }

  /**
   * Pause the current canary deployment.
   */
  pause(): CanaryDeployment | null {
    if (this.deployment?.status !== 'in-progress') return null;

    this.deployment.status = 'paused';
    this.clearTimers();

    this.emit('deployment:paused', this.deployment);
    this.setStatus('paused');
    return this.deployment;
  }

  /**
   * Resume a paused canary deployment.
   */
  resume(): CanaryDeployment | null {
    if (this.deployment?.status !== 'paused') return null;

    this.deployment.status = 'in-progress';
    this.startStageTimers();

    this.emit('deployment:resumed', this.deployment);
    this.setStatus('in-progress');
    return this.deployment;
  }

  /**
   * Manually advance to the next stage (skip current).
   */
  promote(): CanaryDeployment | null {
    if (this.deployment?.status !== 'in-progress') return null;

    this.advanceStage();
    return this.deployment;
  }

  /**
   * Manually trigger rollback.
   */
  manualRollback(reason: string): CanaryDeployment | null {
    if (this.deployment?.status !== 'in-progress') return null;

    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    const record = this.rollbackManager.triggerManual({
      deploymentId: this.deployment.id,
      fromVersion: this.deployment.canaryVersion,
      toVersion: this.deployment.stableVersion,
      stagePercent: currentStage.config.trafficPercent,
      reason,
    });

    if (record) this.handleRollback(record);
    return this.deployment;
  }

  // ── Query ───────────────────────────────────────────────────

  /**
   * Get the current active deployment.
   */
  getDeployment(): CanaryDeployment | null {
    return this.deployment;
  }

  /**
   * Get all deployment history.
   */
  getDeployments(): CanaryDeployment[] {
    return [...this.deployments];
  }

  /**
   * Get the health checker instance.
   */
  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  /**
   * Get the rollback manager instance.
   */
  getRollbackManager(): RollbackManager {
    return this.rollbackManager;
  }

  /**
   * Get the traffic splitter instance.
   */
  getTrafficSplitter(): TrafficSplitter {
    return this.trafficSplitter;
  }

  /**
   * Get current configuration.
   */
  getConfig(): Readonly<CanaryDeployerConfig> {
    return this.config;
  }

  // ── Private — Stage management ──────────────────────────────

  private async enterStage(index: number): Promise<void> {
    if (!this.deployment) return;
    if (index >= this.config.stages.length) {
      this.completeDeployment();
      return;
    }

    const stage = this.deployment.stages[index];
    stage.startedAt = new Date().toISOString();
    this.deployment.currentStageIndex = index;

    const stageConfig = stage.config;
    this.trafficSplitter.setSplit(stageConfig.trafficPercent);
    this.deployment.trafficSplit = this.trafficSplitter.getTrafficSplit();

    this.healthChecker.reset();
    this.healthChecker.updateConfig({ intervalMs: stageConfig.healthCheckIntervalMs });

    this.emit('deployment:stage-advanced', this.deployment, stageConfig);
    this.setStatus('in-progress');

    if (stageConfig.durationMs > 0 && stageConfig.autoAdvance) {
      this.startStageTimers();
    }
  }

  private startStageTimers(): void {
    this.clearTimers();

    if (!this.deployment) return;
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];

    if (currentStage.config.durationMs > 0) {
      this.stageTimer = setTimeout(() => {
        if (!this.deployment) return;
        currentStage.durationElapsed = true;
        if (this.shouldAdvanceStage()) {
          this.advanceStage();
        }
      }, currentStage.config.durationMs);
    }
  }

  private clearTimers(): void {
    if (this.stageTimer) {
      clearTimeout(this.stageTimer);
      this.stageTimer = null;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  private shouldAdvanceStage(): boolean {
    if (!this.deployment) return false;
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    const stageConfig = currentStage.config;

    if (!stageConfig.autoAdvance) return false;

    const healthMet = currentStage.consecutiveHealthy >= stageConfig.requiredConsecutiveHealthy;
    const durationMet = currentStage.durationElapsed || stageConfig.durationMs === 0;

    return healthMet && durationMet;
  }

  private advanceStage(): void {
    if (!this.deployment) return;

    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    currentStage.completedAt = new Date().toISOString();
    this.clearTimers();

    const nextIndex = this.deployment.currentStageIndex + 1;
    if (nextIndex >= this.config.stages.length) {
      this.completeDeployment();
    } else {
      this.enterStage(nextIndex);
    }
  }

  private completeDeployment(): void {
    if (!this.deployment) return;

    this.deployment.status = 'completed';
    this.deployment.completedAt = new Date().toISOString();
    this.clearTimers();

    this.emit('deployment:completed', this.deployment);
    this.setStatus('completed');
  }

  private handleRollback(record: RollbackRecord): void {
    if (!this.deployment) return;

    this.deployment.status = 'rolled-back';
    this.deployment.rollbackRecord = record;
    this.clearTimers();

    this.trafficSplitter.setSplit(0);
    this.deployment.trafficSplit = this.trafficSplitter.getTrafficSplit();

    this.emit('deployment:rolled-back', this.deployment, record);
    this.setStatus('rolled-back');
  }

  private wireEvents(): void {
    this.healthChecker.on('check:unhealthy', (result: HealthCheckResult) => {
      if (this.deployment?.status !== 'in-progress') return;

      const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
      const rollbackRecord = this.rollbackManager.evaluateHealthCheck(
        result,
        this.deployment.id,
        this.deployment.stableVersion,
        this.deployment.canaryVersion,
        currentStage.config.trafficPercent,
      );

      if (rollbackRecord) this.handleRollback(rollbackRecord);
    });
  }

  private setStatus(status: CanaryDeploymentStatus): void {
    this.config.onStatusChange?.(status);
  }
}
