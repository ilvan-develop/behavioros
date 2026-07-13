import type { BehaviorOSEngine } from '@behavioros/core';
import { z } from 'zod';

export const recordLearningInput = z.object({
  type: z
    .enum(['observation', 'pattern', 'insight', 'feedback', 'correction'])
    .describe('Type of learning event'),
  source: z.string().describe('Source of the learning event'),
  data: z.record(z.unknown()).describe('Learning event data'),
  confidence: z.number().min(0).max(1).default(0.5).describe('Confidence level (0-1)'),
});

export type RecordLearningInput = z.infer<typeof recordLearningInput>;

export async function recordLearning(engine: BehaviorOSEngine, input: RecordLearningInput) {
  const event = await engine.recordLearning({
    type: input.type,
    source: input.source,
    data: input.data,
    confidence: input.confidence,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(event, null, 2),
      },
    ],
  };
}
