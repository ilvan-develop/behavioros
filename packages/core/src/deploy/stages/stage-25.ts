// ============================================================
// Stage 25 — Growing confidence: 25% traffic for 24h
// ============================================================

import type { CanaryStageConfig } from '../canary-deployer';

/**
 * Stage 25% configuration.
 * Routes 25% of traffic to the canary DNA for 24 hours.
 * The canary has passed initial validation at 5% and now
 * receives a meaningful portion of production traffic.
 */
export const STAGE_25_CONFIG: CanaryStageConfig = {
  name: 'stage-25',
  trafficPercent: 25,
  durationMs: 24 * 60 * 60 * 1000,
  healthCheckIntervalMs: 30_000,
  requiredConsecutiveHealthy: 3,
  driftThreshold: 0.2,
  autoAdvance: true,
  description: 'Growing confidence — 25% traffic for 24h',
};

/**
 * Stage 25% health thresholds.
 * Standard thresholds — the canary has already proven basic stability.
 */
export const STAGE_25_THRESHOLDS = {
  successRate: { warning: 96, failure: 91 },
  latencyMs: { warning: 450, failure: 900 },
  errorRate: { warning: 4, failure: 9 },
};
