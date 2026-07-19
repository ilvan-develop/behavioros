// ============================================================
// Stage 100 — Full promotion: 100% traffic (completion)
// ============================================================

import type { CanaryStageConfig } from '../canary-deployer';

/**
 * Stage 100% configuration.
 * Routes 100% of traffic to the new DNA version.
 * This is the final promotion — the canary becomes the new stable.
 */
export const STAGE_100_CONFIG: CanaryStageConfig = {
  name: 'stage-100',
  trafficPercent: 100,
  durationMs: 0,
  healthCheckIntervalMs: 30_000,
  requiredConsecutiveHealthy: 3,
  driftThreshold: 0.3,
  autoAdvance: false,
  description: 'Full promotion — 100% traffic, deployment complete',
};

/**
 * Stage 100% health thresholds.
 * Standard production thresholds — this is now the only version.
 */
export const STAGE_100_THRESHOLDS = {
  successRate: { warning: 95, failure: 90 },
  latencyMs: { warning: 500, failure: 1000 },
  errorRate: { warning: 5, failure: 10 },
};
