import type { BehaviorSelector, DnaSelection } from '@behavioros/core';
import { z } from 'zod';

/**
 * BOS + Context7 Truth Source Integration
 *
 * When the orchestrator delegates a task, this tool:
 * 1. Selects the optimal behavioral DNA pattern via BehaviorSelector
 * 2. Dynamically resolves which libraries/stack are relevant based on domain + pattern
 * 3. Adjusts behavioral principles based on risk level and complexity
 * 4. Returns the DNA pattern + principles + instructions to fetch context7 docs
 */

// Domain → library truth sources (base mapping)
const DOMAIN_LIBRARIES: Record<string, string[]> = {
  frontend: ['next.js', 'react', 'shadcn/ui', 'tailwindcss'],
  backend: ['nestjs', 'prisma', 'zod'],
  database: ['prisma', 'postgresql'],
  auth: ['better-auth', 'prisma'],
  payments: ['prisma', 'nestjs', 'zod'],
  testing: ['playwright', 'vitest'],
  devops: ['docker', 'kubernetes', 'github-actions'],
  design: ['shadcn/ui', 'tailwindcss', 'radix-ui'],
  infra: ['docker', 'kubernetes', 'terraform'],
};

// Pattern → additional libraries that pair well
const PATTERN_LIBRARIES: Record<string, string[]> = {
  'surgical-team': ['vitest'],
  manufacturing: ['vitest', 'biome'],
  'immune-system': ['better-auth', 'eslint'],
  'ant-colony': ['vitest'],
  'bee-colony': ['vitest'],
  'wolf-pack': ['playwright'],
  orchestra: ['vitest', 'playwright'],
  'mathematical-swarm': ['vitest'],
  'research-lab': ['vitest'],
  octopus: ['vitest'],
  'enterprise-governance': ['eslint', 'biome'],
};

// Pattern → behavioral principles (base)
const PATTERN_PRINCIPLES: Record<string, string[]> = {
  'surgical-team': [
    'Every change must be precisely targeted to the diagnosed root cause',
    'The smallest possible change that fixes the issue is always the right choice',
    'Every fix must be validated against the original failure scenario',
  ],
  manufacturing: [
    'Deterministic pipelines, zero-defect, strict sequencing',
    'Every output must pass through quality gates before proceeding',
    'Traceability from requirement to implementation',
  ],
  'immune-system': [
    'Threat detection at every layer',
    'Defense in depth — multiple validation layers',
    'Anomaly response with automatic containment',
  ],
  'ant-colony': [
    'Emergent behavior through parallel exploration',
    'Pheromone trails guide convergence',
    'Self-organization with local decisions',
  ],
  'bee-colony': [
    'Waggle dance communication for knowledge sharing',
    'Hive mind coordination across packages',
    'Task allocation through dance competition',
  ],
  'wolf-pack': [
    'Alpha-led coordinated response',
    'Pack hierarchy for rapid decision-making',
    'Territory defense — protect production',
  ],
  orchestra: [
    'Conductor-led harmony',
    'Synchronized movements across components',
    'Tempo control — pace matches complexity',
  ],
  'mathematical-swarm': [
    'Algorithmic coordination',
    'Convergence through metrics',
    'Optimization driven by data',
  ],
  'research-lab': [
    'Hypothesis-driven exploration',
    'Peer review before implementation',
    'Reproducibility of all findings',
  ],
  octopus: [
    'Decentralized autonomy for each arm',
    'Regeneration — failed attempts inform next try',
    'Camouflage — blend with existing patterns',
  ],
  'enterprise-governance': [
    'Compliance at every decision point',
    'Audit trails for all actions',
    'Risk management before execution',
  ],
};

// Risk-based principle overlays
const RISK_OVERLAYS: Record<string, string[]> = {
  critical: [
    'MANDATORY: All changes require human approval before execution',
    'MANDATORY: Auto-rollback on any failure detection',
  ],
  high: [
    'Enhanced review required — all changes peer-reviewed',
    'Regression testing mandatory before merge',
  ],
  medium: [],
  low: [],
};

// Complexity-based library additions
const COMPLEXITY_LIBRARIES: Record<string, string[]> = {
  complex: ['vitest', 'playwright'],
  medium: ['vitest'],
  simple: [],
};

export const bosResolveTruthInput = z.object({
  taskType: z
    .string()
    .describe('Task type: feature, bugfix, refactor, security, performance, review, deploy'),
  domain: z
    .string()
    .describe('Domain: payments, auth, frontend, backend, database, infra, testing, design'),
  riskLevel: z.string().optional().describe('Risk level: low, medium, high, critical'),
  complexity: z.string().optional().describe('Complexity: simple, medium, complex'),
  agentId: z.string().optional().describe('Agent ID performing the task'),
  libraries: z
    .array(z.string())
    .optional()
    .describe('Specific libraries to fetch docs for (overrides auto-detection)'),
});

export type BosResolveTruthInput = z.infer<typeof bosResolveTruthInput>;

export async function bosResolveTruth(selector: BehaviorSelector, input: BosResolveTruthInput) {
  // Step 1: Select DNA pattern via real engine
  const selection: DnaSelection = selector.select({
    problemType: input.taskType as any,
    riskLevel: (input.riskLevel ?? 'medium') as any,
    scope: 'single_package',
    timeline: 'sprint',
    domain: input.domain,
  });

  // Step 2: Dynamically resolve truth sources (libraries)
  const domainLibs = DOMAIN_LIBRARIES[input.domain] ?? [];
  const patternLibs = PATTERN_LIBRARIES[selection.primary] ?? [];
  const complexityLibs = COMPLEXITY_LIBRARIES[input.complexity ?? 'medium'] ?? [];
  const autoLibraries = [...domainLibs, ...patternLibs, ...complexityLibs];
  const libraries = input.libraries ?? [...new Set(autoLibraries)];

  // Step 3: Get behavioral principles with risk overlays
  const basePrinciples = PATTERN_PRINCIPLES[selection.primary] ?? [
    'Follow standard engineering best practices',
  ];
  const riskOverlay = RISK_OVERLAYS[input.riskLevel ?? 'medium'] ?? [];
  const allPrinciples = [...basePrinciples, ...riskOverlay];

  const principles = [
    `## BEHAVIORAL DNA: ${selection.primary}`,
    ...allPrinciples.map((p) => `- ${p}`),
  ].join('\n');

  // Step 4: Build context7 fetch instructions
  const context7Instructions =
    libraries.length > 0
      ? [
          '## Context7 Truth Source Instructions',
          'Before implementing, fetch current documentation for these libraries:',
          ...libraries.map(
            (lib) =>
              `- Use \`resolve-library-id\` with "${lib}" then \`query-docs\` for relevant concepts`,
          ),
          '',
          'This ensures you use the LATEST API signatures, configuration patterns, and best practices — not outdated training data.',
        ].join('\n')
      : 'No specific library documentation needed for this task.';

  const result = {
    dna: {
      pattern: selection.primary,
      secondary: selection.secondary,
      blend: selection.blend,
      confidence: selection.confidence,
      rationale: selection.rationale,
    },
    principles,
    truthSources: {
      libraries,
      instructions: context7Instructions,
    },
    agentInstructions: [
      principles,
      '',
      context7Instructions,
      '',
      '## Task Context',
      `- Domain: ${input.domain}`,
      `- Risk: ${input.riskLevel ?? 'medium'}`,
      `- Complexity: ${input.complexity ?? 'medium'}`,
      `- DNA Confidence: ${(selection.confidence * 100).toFixed(0)}%`,
      `- Pattern Rationale: ${selection.rationale}`,
    ].join('\n'),
  };

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
