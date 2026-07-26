import type { EcosystemRegistry } from '@behavioros/core';
import { z } from 'zod';

export const bosEcosystemDoctorInput = z.object({});

export type BosEcosystemDoctorInput = z.infer<typeof bosEcosystemDoctorInput>;

interface EngineStatus {
  status: string;
  issues: number;
  error?: string;
}

export async function bosEcosystemDoctor(
  registry: EcosystemRegistry,
  _input: BosEcosystemDoctorInput,
) {
  const result = await registry.doctor();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            healthy: result.healthy,
            timestamp: new Date().toISOString(),
            stats: result.stats,
            engines: result.engines,
            issues: result.engines
              ? Object.entries(result.engines).map(([name, engine]: [string, EngineStatus]) => ({
                  engine: name,
                  status: engine.status,
                  issues: engine.issues,
                  error: engine.error ?? undefined,
                }))
              : [],
            recommendations: buildRecommendations(result),
          },
          null,
          2,
        ),
      },
    ],
  };
}

function buildRecommendations(result: {
  healthy: boolean;
  engines: Record<string, EngineStatus>;
}): string[] {
  const recommendations: string[] = [];

  for (const [name, engine] of Object.entries(result.engines)) {
    if (engine.status === 'not-detected') {
      recommendations.push(`Install or configure ${name} adapter to enable its functionality`);
    }
    if (engine.status === 'error') {
      recommendations.push(`Fix ${name} engine error: ${engine.error ?? 'Unknown error'}`);
    }
    if (engine.issues > 0) {
      recommendations.push(`Resolve ${engine.issues} issue(s) in ${name} engine`);
    }
  }

  if (result.healthy) {
    recommendations.push('All engines are healthy — no action required');
  }

  return recommendations;
}
