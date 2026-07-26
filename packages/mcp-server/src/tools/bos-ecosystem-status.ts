import type { EcosystemRegistry } from '@behavioros/core';
import type { ComponentRegistry } from '@behavioros/schemas';
import { z } from 'zod';

export const bosEcosystemStatusInput = z.object({});

export type BosEcosystemStatusInput = z.infer<typeof bosEcosystemStatusInput>;

export async function bosEcosystemStatus(
  registry: EcosystemRegistry,
  _input: BosEcosystemStatusInput,
) {
  const report = await registry.generateReport();
  const isInit = registry.isInitialized();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            initialized: isInit,
            project: report.project,
            timestamp: report.timestamp,
            agents: report.agents.map((a: { id: string; status: string; skillsCount: number }) => ({
              id: a.id,
              status: a.status,
              skillsCount: a.skillsCount,
            })),
            skills: report.skills.map((s: ComponentRegistry) => ({
              id: s.id,
              name: s.name,
              type: s.type,
              status: s.status,
              version: s.version,
              source: s.source,
            })),
            mcps: report.mcps.map((m: ComponentRegistry) => ({
              id: m.id,
              name: m.name,
              status: m.status,
              version: m.version,
              source: m.source,
            })),
            designSystems: report.designSystems.map((d: ComponentRegistry) => ({
              id: d.id,
              name: d.name,
              status: d.status,
              version: d.version,
            })),
            dnas: report.dnas.map((d: { id: string; version: string; active: boolean }) => ({
              id: d.id,
              version: d.version,
              active: d.active,
            })),
            summary: {
              totalAgents: report.agents.length,
              totalSkills: report.skills.length,
              totalMcps: report.mcps.length,
              totalDesignSystems: report.designSystems.length,
              totalDnas: report.dnas.length,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
