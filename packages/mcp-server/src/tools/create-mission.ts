import { z } from 'zod'
import type { BehaviorOSEngine } from '@behavioros/core'

export const createMissionInput = z.object({
  title: z.string().min(1).describe('Mission title'),
  type: z
    .enum(['feature', 'bugfix', 'refactor', 'research', 'incident'])
    .describe('Mission type'),
  priority: z
    .enum(['critical', 'high', 'medium', 'low'])
    .default('medium')
    .describe('Mission priority'),
  description: z.string().optional().describe('Optional mission description'),
})

export type CreateMissionInput = z.infer<typeof createMissionInput>

export async function createMission(
  engine: BehaviorOSEngine,
  input: CreateMissionInput,
) {
  const mission = await engine.createMission({
    title: input.title,
    type: input.type,
    priority: input.priority,
    description: input.description,
  })

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(mission, null, 2),
      },
    ],
  }
}
