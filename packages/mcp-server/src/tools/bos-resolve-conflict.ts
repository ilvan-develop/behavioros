import type { ConflictContext, ConflictResolver, Resolution } from '@behavioros/core';
import { z } from 'zod';

export const bosResolveConflictInput = z.object({
  type: z
    .enum([
      'backend_vs_frontend',
      'security_vs_feature',
      'qa_vs_developer',
      'devops_vs_backend',
      'custom',
    ])
    .describe('Conflict type'),
  agentA: z.string().describe('First agent/squad'),
  agentB: z.string().describe('Second agent/squad'),
  context: z.string().describe('Description of the conflict'),
});

export type BosResolveConflictInput = z.infer<typeof bosResolveConflictInput>;

function formatResolution(context: ConflictContext, resolution: Resolution): string {
  const lines = [
    `Conflict Resolution: ${context.type}`,
    `Agents: ${context.agents.join(' vs ')}`,
    `Severity: ${context.severity}`,
    '',
    `Resolution Strategy: ${resolution.resolution}`,
    '',
    'Steps:',
    ...resolution.steps.map((s) => `  ${s}`),
  ];

  if (resolution.winner) {
    lines.push('', `Winner (by evidence): ${resolution.winner}`);
  }
  if (resolution.escalation) {
    lines.push('', `Escalation Path: ${resolution.escalation}`);
  }
  lines.push(`Timeout: ${resolution.timeout}`);
  lines.push(`Timestamp: ${resolution.timestamp}`);

  return lines.join('\n');
}

export async function bosResolveConflict(
  resolver: ConflictResolver,
  input: BosResolveConflictInput,
) {
  const conflictContext: ConflictContext = {
    type: input.type,
    agents: [input.agentA, input.agentB],
    issue: input.context,
    severity: 'medium',
  };

  const resolution = resolver.resolve(conflictContext);
  const history = resolver.getResolutionHistory(input.type);
  const previousConflicts = history.filter(
    (h) => h.agents.includes(input.agentA) || h.agents.includes(input.agentB),
  );

  const formatted = formatResolution(conflictContext, resolution);

  const output: string[] = [formatted];

  if (previousConflicts.length > 1) {
    output.push(
      '',
      `--- CONFLICT HISTORY (${previousConflicts.length} previous involving these agents) ---`,
      JSON.stringify(
        previousConflicts.slice(0, 5).map((h) => ({
          type: h.type,
          agents: h.agents,
          resolution: h.resolution.resolution,
          timestamp: h.resolution.timestamp,
        })),
        null,
        2,
      ),
    );
  }

  output.push(
    '',
    '--- RAW DATA ---',
    JSON.stringify({ conflict: conflictContext, resolution }, null, 2),
  );

  return {
    content: [{ type: 'text' as const, text: output.join('\n') }],
  };
}
