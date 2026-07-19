// ============================================================
// Stage 50 — Half traffic: 50% traffic for 24h
// ============================================================

import type { CanaryStageConfig } from '../canary-deployer';

/**
 * Stage 50% configuration.
 * Routes 50% of traffic to the canary DNA for 24 hours.
 * This is the penultimate stage — the canary handles half
 * of all production traffic before full promotion.
 */
export const STAGE_50_CONFIG: CanaryStageConfig = {
  name: 'stage-50',
  trafficPercent: 50,
  durationMs: 24 * 60 * 60 * 1000,
  healthCheckIntervalMs: 30_000,
  requiredConsecutiveHealthy: 5,
  driftThreshold: 0.25,
  autoAdvance: true,
  description: 'Half traffic — 50% traffic for 24h',
};

/**
 * Stage 50% health thresholds.
 * Production-grade thresholds because the canary now handles
 * significant traffic volume.
 */
export const STAGE_50_THRESHOLDS = {
  successRate: { warning: 95, failure: 90 },
  latencyMs: { warning: 500, failure: 1000 },
  errorRate: { warning: 5, failure: 10 },
};
