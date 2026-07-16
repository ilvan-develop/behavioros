// ============================================================
// Stage 5 — Initial canary: 5% traffic for 24h
// ============================================================

import type { CanaryStageConfig } from '../canary-deployer';

/**
 * Stage 5% configuration.
 * Routes 5% of traffic to the canary DNA for 24 hours.
 * This is the initial validation stage — the canary must prove
 * it does not regress before receiving more traffic.
 */
export const STAGE_5_CONFIG: CanaryStageConfig = {
  name: 'stage-5',
  trafficPercent: 5,
  durationMs: 24 * 60 * 60 * 1000,
  healthCheckIntervalMs: 30_000,
  requiredConsecutiveHealthy: 3,
  driftThreshold: 0.1,
  autoAdvance: true,
  description: 'Initial canary validation — 5% traffic for 24h',
};

/**
 * Stage 5% health thresholds.
 * Tighter than default because this is the first exposure.
 * Any degradation here means the canary is not ready.
 */
export const STAGE_5_THRESHOLDS = {
  successRate: { warning: 97, failure: 93 },
  latencyMs: { warning: 400, failure: 800 },
  errorRate: { warning: 3, failure: 7 },
};
