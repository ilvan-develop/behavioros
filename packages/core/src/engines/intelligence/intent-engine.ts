/**
 * IntentType — Union type: build, fix, refactor, analyze, deploy, learn, ....
 */
export type IntentType = 'build' | 'fix' | 'refactor' | 'analyze' | 'deploy' | 'learn' | 'custom';

/**
 * Intent — Configuration and options interface.
 */
export interface Intent {
  type: IntentType;
  confidence: number;
  description: string;
  rawInput: string;
  entities: Record<string, string[]>;
  timestamp: string;
}

const KEYWORD_MAP: Record<IntentType, string[]> = {
  build: [
    'build',
    'create',
    'generate',
    'implement',
    'add',
    'make',
    'develop',
    'write',
    'construct',
    'produce',
    'scaffold',
    'setup',
    'init',
  ],
  fix: [
    'fix',
    'bug',
    'repair',
    'issue',
    'error',
    'broken',
    'crash',
    'incorrect',
    'wrong',
    'fault',
    'defect',
    'hotfix',
    'patch',
  ],
  refactor: [
    'refactor',
    'restructure',
    'reorganize',
    'clean',
    'improve',
    'optimize',
    'simplify',
    'rework',
    'redesign',
    'modernize',
  ],
  analyze: [
    'analyze',
    'audit',
    'review',
    'inspect',
    'examine',
    'investigate',
    'diagnose',
    'trace',
    'profile',
    'scan',
    'assess',
  ],
  deploy: [
    'deploy',
    'release',
    'publish',
    'ship',
    'launch',
    'rollout',
    'go live',
    'promote',
    'push to prod',
  ],
  learn: [
    'learn',
    'explain',
    'understand',
    'document',
    'research',
    'study',
    'explore',
    'what is',
    'how to',
    'tutorial',
    'guide',
  ],
  custom: [],
};

function detectIntentType(raw: string): { type: IntentType; confidence: number } {
  const lower = raw.toLowerCase();
  let bestType: IntentType = 'custom';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
    if (type === 'custom') continue;
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestType = type as IntentType;
    }
  }

  const confidence = bestScore === 0 ? 0 : Math.min(bestScore / 2, 1);
  return { type: bestType, confidence };
}

const ENTITY_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  {
    name: 'technologies',
    patterns: [
      /\b(react|vue|angular|svelte|next\.?js?|nuxt|node|express|fastify|nestjs|django|flask|spring|rails|laravel|prisma|typeorm|drizzle|supabase|firebase|aws|gcp|azure|docker|kubernetes|redis|postgres(?:ql)?|mongo(?:db)?|mysql|graphql|rest|grpc|tailwind|shadcn|chakra|mui|bootstrap)\b/gi,
    ],
  },
  {
    name: 'features',
    patterns: [
      /(?:add|implement|create|build|fix|update|remove)\s+(?:a\s+|an\s+|the\s+)?(\w[\w\s]{1,40}?)(?:\s+(?:in|for|to|with|using|module|component|service|endpoint|api|page|route))(?:\s|$)/gi,
      /(\w[\w\s]{1,40}?)\s+(?:endpoint|api|service|component|module|page|route|function|feature|flow)/gi,
    ],
  },
];

function extractEntities(raw: string): Record<string, string[]> {
  const entities: Record<string, string[]> = {};
  for (const entity of ENTITY_PATTERNS) {
    const matches = new Set<string>();
    for (const pattern of entity.patterns) {
      pattern.lastIndex = 0;
      let execResult: RegExpExecArray | null;
      do {
        execResult = pattern.exec(raw);
        if (execResult !== null) {
          const value = execResult[1] ?? execResult[0];
          if (value) matches.add(value.trim().toLowerCase());
        }
      } while (execResult !== null);
    }
    if (matches.size > 0) {
      entities[entity.name] = [...matches];
    }
  }
  return entities;
}

import type { EventBridge } from '../../events/event-bridge';

/**
 * IntentEngine — Provides constructor, detect operations.
 */
export class IntentEngine {
  constructor(private eventBridge?: EventBridge) {}

  detect(raw: string): Intent {
    const { type, confidence } = detectIntentType(raw);
    const entities = extractEntities(raw);

    const description = type === 'custom' ? 'Custom request' : `${type} task detected`;

    const intent: Intent = {
      type,
      confidence,
      description,
      rawInput: raw,
      entities,
      timestamp: new Date().toISOString(),
    };

    this.eventBridge?.emitIntentDetected({ type, confidence, description });

    return intent;
  }
}
