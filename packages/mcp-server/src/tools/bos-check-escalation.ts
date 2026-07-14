import type { EscalationEvent, EscalationManager } from '@behavioros/core';
import { z } from 'zod';

export const bosCheckEscalationInput = z.object({
  trigger: z.string().describe('Trigger description (e.g., "security vulnerability found")'),
  context: z.string().optional().describe('Additional context'),
});

export type BosCheckEscalationInput = z.infer<typeof bosCheckEscalationInput>;

function formatEscalationResult(
  input: BosCheckEscalationInput,
  event: EscalationEvent | null,
  activeCount: number,
): string {
  if (!event) {
    return [
      'Escalation Check Result: NO ESCALATION REQUIRED',
      `Trigger: "${input.trigger}"`,
      `Active escalations: ${activeCount}`,
      '',
      'No matching escalation trigger found in the governance rules.',
      'This situation does not require human oversight at this time.',
    ].join('\n');
  }

  const severityMap: Record<string, string> = {
    halt_all_activate_immune: 'CRITICAL — All operations halted',
    immediate_surgical_team: 'CRITICAL — Surgical team activated',
    halt_and_review: 'HIGH — Paused for review',
    halt_and_notify_architect: 'HIGH — Architect notified',
    escalate_to_human: 'HIGH — Human oversight required',
    halt_and_activate_governance: 'CRITICAL — Governance activated',
    halt_and_activate_mathematical_swarm: 'HIGH — Performance analysis activated',
    spawn_testing_agent: 'MEDIUM — Testing agent spawned',
  };

  return [
    'ESCALATION TRIGGERED',
    `Trigger ID: ${event.triggerId}`,
    `Action: ${event.action}`,
    `Severity: ${severityMap[event.action] ?? event.status}`,
    `Status: ${event.status}`,
    `Timestamp: ${event.timestamp}`,
    event.agent ? `Agent: ${event.agent}` : '',
    '',
    `Active escalations in system: ${activeCount}`,
    '',
    `Original trigger: "${input.trigger}"`,
    input.context ? `Context: ${input.context}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function bosCheckEscalation(
  manager: EscalationManager,
  input: BosCheckEscalationInput,
) {
  const event = manager.check({
    type: input.trigger,
    agent: undefined,
    context: input.context ? { description: input.context } : undefined,
  });

  const activeEscalations = manager.getActiveEscalations();
  const formatted = formatEscalationResult(input, event, activeEscalations.length);

  return {
    content: [
      { type: 'text' as const, text: formatted },
      {
        type: 'text' as const,
        text: `\n--- RAW DATA ---\n${JSON.stringify(
          { event, activeEscalationCount: activeEscalations.length },
          null,
          2,
        )}`,
      },
    ],
  };
}
