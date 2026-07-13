import type { BehaviorOSEngine } from '@behavioros/core';
import { z } from 'zod';

export const updateProgressInput = z.object({
  missionId: z.string().uuid().describe('Mission ID to update'),
  status: z.enum(['executing', 'review', 'completed', 'failed']).describe('New mission status'),
  notes: z.string().optional().describe('Optional progress notes'),
});

export type UpdateProgressInput = z.infer<typeof updateProgressInput>;

export async function updateProgress(engine: BehaviorOSEngine, input: UpdateProgressInput) {
  let mission = engine.getMission(input.missionId);
  if (!mission) {
    throw new Error(`Mission not found: ${input.missionId}`);
  }

  if (input.status === 'executing' && mission.status === 'draft') {
    mission = await engine.startMission(input.missionId);
  } else if (input.status === 'completed') {
    mission = await engine.completeMission(input.missionId, {
      notes: input.notes,
    });
  } else if (input.status === 'failed') {
    mission = await engine.failMission(input.missionId, new Error(input.notes ?? 'Mission failed'));
  } else {
    mission = { ...mission, status: input.status };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(mission, null, 2),
      },
    ],
  };
}
