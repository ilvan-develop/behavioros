import { z } from 'zod'
import type { BehaviorOSEngine } from '@behavioros/core'

export const listMissionsInput = z
  .object({
    status: z
      .string()
      .optional()
      .describe('Filter missions by status (draft, queued, executing, etc.)'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe('Maximum number of missions to return'),
  })
  .optional()

export type ListMissionsInput = z.infer<typeof listMissionsInput>

export async function listMissions(
  engine: BehaviorOSEngine,
  input?: ListMissionsInput,
) {
  let missions = engine.getAllMissions()

  if (input?.status) {
    missions = missions.filter((m) => m.status === input.status)
  }

  const limit = input?.limit ?? 10
  missions = missions.slice(0, limit)

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(missions, null, 2),
      },
    ],
  }
}
