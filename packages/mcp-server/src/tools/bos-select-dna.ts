import type { BehaviorSelector, DnaSelection } from '@behavioros/core';
import { z } from 'zod';

export const bosSelectDnaInput = z.object({
  taskType: z
    .string()
    .describe('Task type: feature, bugfix, refactor, security, performance, review, deploy'),
  domain: z.string().describe('Domain: payments, auth, frontend, backend, database, infra'),
  riskLevel: z.string().optional().describe('Risk level: low, medium, high, critical'),
  complexity: z.string().optional().describe('Complexity: simple, medium, complex'),
  agentId: z.string().optional().describe('Agent ID performing the task (optional)'),
});

export type BosSelectDnaInput = z.infer<typeof bosSelectDnaInput>;

const PATTERN_BEHAVIORS: Record<
  string,
  { principles: string[]; forbidden: string[]; description: string }
> = {
  'surgical-team': {
    description: 'Zero-defect operations for patient safety',
    principles: [
      'Every change must be precisely targeted to the diagnosed root cause',
      'The smallest possible change that fixes the issue is always the right choice',
    ],
    forbidden: [
      'Making large, sweeping changes',
      'Deploying a fix that has not been validated against the original failure',
    ],
  },
  manufacturing: {
    description: 'Deterministic pipelines with zero-defect, strict sequencing',
    principles: [
      'Every output must pass through quality gates before proceeding',
      'Traceability from requirement to implementation',
    ],
    forbidden: ['Skipping quality gates', 'Merging without review'],
  },
  'immune-system': {
    description: 'Threat detection and defense in depth at every layer',
    principles: [
      'Defense in depth — multiple validation layers',
      'Anomaly response with automatic containment',
    ],
    forbidden: ['Bypassing security checks', 'Deploying without vulnerability scan'],
  },
  'ant-colony': {
    description: 'Emergent behavior through parallel exploration and pheromone trails',
    principles: [
      'Pheromone trails guide convergence toward proven solutions',
      'Self-organization with local decisions, no centralized bottleneck',
    ],
    forbidden: [
      'Centralized bottleneck decisions',
      'Ignoring discovered patterns from parallel agents',
    ],
  },
  'bee-colony': {
    description: 'Hive mind coordination across packages via waggle dance communication',
    principles: [
      'Waggle dance communication for knowledge sharing',
      'Task allocation through dance competition',
    ],
    forbidden: [
      'Working in isolation without reporting findings',
      'Ignoring peer findings from other agents',
    ],
  },
  'wolf-pack': {
    description: 'Alpha-led coordinated response with pack hierarchy',
    principles: [
      'Alpha-led coordinated response for rapid decision-making',
      'Territory defense — protect production at all costs',
    ],
    forbidden: ['Acting without pack coordination', 'Retreating without escalation to alpha'],
  },
  orchestra: {
    description: 'Conductor-led harmony with synchronized movements',
    principles: [
      'Synchronized movements across all components',
      'Tempo control — pace matches complexity',
    ],
    forbidden: [
      'Playing out of tempo (rushing delivery)',
      'Solo performance without conductor approval',
    ],
  },
  'mathematical-swarm': {
    description: 'Algorithmic coordination driven by metrics and convergence',
    principles: [
      'Convergence through measurable metrics',
      'Optimization driven by data, not intuition',
    ],
    forbidden: ['Decisions without metrics', 'Optimizing without measurement baseline'],
  },
  'research-lab': {
    description: 'Hypothesis-driven exploration with peer review',
    principles: [
      'Hypothesis-driven exploration before implementation',
      'Peer review before any code ships',
    ],
    forbidden: ['Implementing without research', 'Skipping peer review'],
  },
  octopus: {
    description: 'Decentralized autonomy for each arm with regeneration',
    principles: [
      'Decentralized autonomy for each arm (package)',
      'Regeneration — failed attempts inform next try',
    ],
    forbidden: ['Arms acting against central nervous system', 'Ignoring failed attempt signals'],
  },
  'enterprise-governance': {
    description: 'Compliance at every decision point with audit trails',
    principles: ['Compliance at every decision point', 'Audit trails for all actions'],
    forbidden: ['Bypassing compliance checks', 'Actions without audit trail'],
  },
};

function resolvePatternBehavior(patternName: string): {
  principles: string[];
  forbidden: string[];
  description: string;
} {
  return (
    PATTERN_BEHAVIORS[patternName] ?? {
      principles: ['Follow standard engineering best practices'],
      forbidden: ['Skipping review or quality gates'],
      description: `Behavioral pattern: ${patternName}`,
    }
  );
}

function buildVisualDisplay(
  selection: DnaSelection,
  input: BosSelectDnaInput,
  behavior: { principles: string[]; forbidden: string[]; description: string },
): string {
  const p1 = behavior.principles[0] || 'N/A';
  const p2 = behavior.principles[1] || 'N/A';
  const f1 = behavior.forbidden[0] || 'N/A';
  const f2 = behavior.forbidden[1] || 'N/A';
  const blendStr = selection.secondary
    ? `${selection.blend.primary}% ${selection.primary} + ${selection.blend.secondary}% ${selection.secondary}`
    : `${selection.blend.primary}% ${selection.primary}`;
  const agentId = input.agentId || 'unassigned';
  const taskSummary = `${input.taskType} in ${input.domain}`;

  return `
╔══════════════════════════════════════════════════════════╗
║ BEHAVIORAL DNA SELECTED                                  ║
╠══════════════════════════════════════════════════════════╣
║ Pattern:   ${selection.primary.padEnd(43)}║
║ Blend:     ${blendStr.substring(0, 43).padEnd(43)}║
║ Confidence:${(' ' + (selection.confidence * 100).toFixed(0) + '%').padEnd(42)}║
║ Rationale: ${selection.rationale.substring(0, 43).padEnd(43)}║
║ Domain:    ${input.domain.padEnd(43)}║
║ Risk:      ${(input.riskLevel ?? 'medium').padEnd(43)}║
╠══════════════════════════════════════════════════════════╣
║ ACTIVE PRINCIPLES:                                       ║
║ * ${p1.substring(0, 53).padEnd(54)}║
║ * ${p2.substring(0, 53).padEnd(54)}║
╠══════════════════════════════════════════════════════════╣
║ FORBIDDEN RULES:                                         ║
║ * ${f1.substring(0, 53).padEnd(54)}║
║ * ${f2.substring(0, 53).padEnd(54)}║
╠══════════════════════════════════════════════════════════╣
║ AGENT: ${agentId.padEnd(49)}║
║ TASK:  ${taskSummary.substring(0, 49).padEnd(49)}║
╚══════════════════════════════════════════════════════════╝`;
}

export async function bosSelectDna(selector: BehaviorSelector, input: BosSelectDnaInput) {
  const selection = selector.select({
    problemType: input.taskType as any,
    riskLevel: (input.riskLevel ?? 'medium') as any,
    scope: 'single_package',
    timeline: 'sprint',
    domain: input.domain,
  });

  const behavior = resolvePatternBehavior(selection.primary);
  const visualDisplay = buildVisualDisplay(selection, input, behavior);

  return {
    content: [
      { type: 'text' as const, text: visualDisplay },
      {
        type: 'text' as const,
        text: [
          '',
          '--- RAW DATA ---',
          JSON.stringify(
            {
              pattern: selection.primary,
              secondary: selection.secondary,
              blend: selection.blend,
              confidence: selection.confidence,
              rationale: selection.rationale,
              description: behavior.description,
              principles: behavior.principles,
              forbidden: behavior.forbidden,
            },
            null,
            2,
          ),
        ].join('\n'),
      },
    ],
  };
}
