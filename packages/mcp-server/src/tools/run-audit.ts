import { z } from 'zod'
import { AuditEngine, type AuditStage } from '@behavioros/core'

export const runAuditInput = z.object({
  projectPath: z.string().describe('Path to the project to audit'),
  stages: z
    .array(
      z.enum([
        'static',
        'architecture',
        'security',
        'performance',
        'tests',
        'coverage',
        'contracts',
        'docs',
        'compliance',
        'benchmarks',
      ]),
    )
    .optional()
    .describe('Optional list of audit stages to run'),
})

export type RunAuditInput = z.infer<typeof runAuditInput>

export async function runAudit(input: RunAuditInput) {
  const auditEngine = new AuditEngine()

  const result = await auditEngine.execute(
    { projectPath: input.projectPath },
    input.stages as AuditStage[] | undefined,
  )

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            id: result.id,
            overall: result.overall,
            score: result.score,
            duration: result.duration,
            timestamp: result.timestamp,
            stages: result.stages.map((s) => ({
              stage: s.stage,
              result: s.result,
              score: s.score,
              duration: s.duration,
            })),
          },
          null,
          2,
        ),
      },
    ],
  }
}
