import type { BehaviorOSEngine } from '@behavioros/core';

/**
 * Read-only governance telemetry summary — aggregate counters only (violations
 * blocked/approved by rule, per-agent mission/violation counts, agent efficiency).
 * Returns all-zero counters if telemetry was never enabled via
 * BehaviorOSEngineConfig.telemetry.enabled — this tool never turns it on.
 */
export async function bosTelemetrySummary(engine: BehaviorOSEngine) {
  const summary = engine.getTelemetrySummary();
  const enabled = engine.telemetryEngine.isEnabled();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ telemetryEnabled: enabled, ...summary }, null, 2),
      },
    ],
  };
}
