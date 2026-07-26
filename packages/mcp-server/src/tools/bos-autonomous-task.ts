import type { AutonomousOrchestrator } from '@behavioros/core';
import { z } from 'zod';

export const bosAutonomousTaskInput = z.object({
  title: z.string().min(1).describe('Task title for the autonomous orchestrator'),
  type: z.enum(['feature', 'bugfix', 'refactor', 'research', 'incident']).describe('Task type'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Task priority'),
  description: z.string().optional().describe('Task description'),
});

export type BosAutonomousTaskInput = z.infer<typeof bosAutonomousTaskInput>;

export async function bosAutonomousTask(
  orchestrator: AutonomousOrchestrator,
  input: BosAutonomousTaskInput,
) {
  const result = await orchestrator.processTask({
    title: input.title,
    type: input.type,
    priority: input.priority ?? 'medium',
    description: input.description,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            success: true,
            taskId: result.mission.id,
            subtasks: result.mission.subtasks?.length ?? 0,
            summary: `Autonomous task "${input.title}" processed with ${result.mission.subtasks?.length ?? 0} subtasks`,
            details: result,
          },
          null,
          2,
        ),
      },
    ],
  };
}
