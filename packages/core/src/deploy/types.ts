// ============================================================
// Deploy — Shared Types
// Extracted to break circular dependency:
//   canary-deployer.ts ↔ stages/stage-*.ts
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
