import type { BehaviorOSEngine } from '@behavioros/core';
import { z } from 'zod';

export const listAgentsInput = z
  .object({
    role: z.string().optional().describe('Filter agents by role'),
  })
  .optional();

export type ListAgentsInput = z.infer<typeof listAgentsInput>;

export async function listAgents(engine: BehaviorOSEngine, input?: ListAgentsInput) {
  let agents = engine.getAllAgents();

  if (input?.role) {
    agents = engine.getAgentsByRole(input.role);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(agents, null, 2),
      },
    ],
  };
}
