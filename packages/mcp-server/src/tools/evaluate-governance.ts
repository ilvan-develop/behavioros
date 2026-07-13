import { z } from 'zod'
import type { BehaviorOSEngine } from '@behavioros/core'

export const evaluateGovernanceInput = z.object({
  action: z.string().describe('Action to evaluate against governance rules'),
  context: z
    .record(z.unknown())
    .optional()
    .describe('Optional context object for the action'),
})

export type EvaluateGovernanceInput = z.infer<typeof evaluateGovernanceInput>

export async function evaluateGovernance(
  engine: BehaviorOSEngine,
  input: EvaluateGovernanceInput,
) {
  const result = await engine.evaluateGovernance(
    input.action,
    input.context ?? {},
  )

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            approved: result.approved,
            violations: result.violations.map((r) => ({
              id: r.id,
              name: r.name,
              level: r.level,
              action: r.action,
              description: r.description,
            })),
            warnings: result.warnings.map((r) => ({
              id: r.id,
              name: r.name,
              level: r.level,
              action: r.action,
              description: r.description,
            })),
          },
          null,
          2,
        ),
      },
    ],
  }
}
