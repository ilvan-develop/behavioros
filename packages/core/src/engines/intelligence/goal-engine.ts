import { randomUUID } from 'node:crypto';
import type { EventBridge } from '../../events/event-bridge';
import type { Intent } from './intent-engine';

/**
 * Goal — Configuration and options interface.
 */
export interface Goal {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  parentIntent: string;
  measurableOutcome: string;
  constraints: string[];
}

const INTENT_GOAL_MAP: Record<
  string,
  Array<{ title: string; description: string; priority: 'critical' | 'high' | 'medium' | 'low' }>
> = {
  build: [
    {
      title: 'Design architecture',
      description: 'Define system architecture and component structure',
      priority: 'high',
    },
    { title: 'Implement API', description: 'Build the core API endpoints', priority: 'high' },
    {
      title: 'Add validation',
      description: 'Add input validation and error handling',
      priority: 'medium',
    },
    { title: 'Write tests', description: 'Write unit and integration tests', priority: 'high' },
  ],
  fix: [
    {
      title: 'Reproduce bug',
      description: 'Create reproduction steps for the reported issue',
      priority: 'critical',
    },
    {
      title: 'Identify root cause',
      description: 'Debug and find the root cause of the issue',
      priority: 'critical',
    },
    {
      title: 'Apply fix',
      description: 'Implement the fix for the identified root cause',
      priority: 'critical',
    },
    {
      title: 'Verify fix',
      description: 'Verify the fix resolves the issue and add regression tests',
      priority: 'high',
    },
  ],
  refactor: [
    {
      title: 'Analyze current code',
      description: 'Review and understand the existing implementation',
      priority: 'high',
    },
    {
      title: 'Define target structure',
      description: 'Define the desired target architecture',
      priority: 'high',
    },
    {
      title: 'Implement refactoring',
      description: 'Execute the refactoring changes',
      priority: 'high',
    },
    {
      title: 'Validate behavior',
      description: 'Ensure behavior is preserved after refactoring',
      priority: 'critical',
    },
  ],
  analyze: [
    { title: 'Gather data', description: 'Collect relevant data and metrics', priority: 'high' },
    {
      title: 'Perform analysis',
      description: 'Analyze the gathered data for insights',
      priority: 'high',
    },
    {
      title: 'Document findings',
      description: 'Document the analysis results and recommendations',
      priority: 'medium',
    },
  ],
  deploy: [
    {
      title: 'Prepare release',
      description: 'Prepare the release artifacts and changelog',
      priority: 'critical',
    },
    {
      title: 'Run pre-deployment checks',
      description: 'Run all quality gates before deployment',
      priority: 'critical',
    },
    {
      title: 'Execute deployment',
      description: 'Deploy to the target environment',
      priority: 'critical',
    },
    {
      title: 'Verify deployment',
      description: 'Verify the deployment is successful and monitor',
      priority: 'high',
    },
  ],
  learn: [
    {
      title: 'Research topic',
      description: 'Research the requested topic thoroughly',
      priority: 'medium',
    },
    {
      title: 'Synthesize knowledge',
      description: 'Synthesize findings into actionable knowledge',
      priority: 'medium',
    },
    {
      title: 'Document results',
      description: 'Create documentation for the learned material',
      priority: 'low',
    },
  ],
};

/**
 * GoalEngine — Provides constructor, decompose, if operations.
 */
export class GoalEngine {
  constructor(private eventBridge?: EventBridge) {}

  decompose(intent: Intent): Goal[] {
    const templates = INTENT_GOAL_MAP[intent.type];
    if (!templates) {
      return [
        {
          id: randomUUID(),
          title: 'Process custom request',
          description: 'Process and fulfill the custom request',
          priority: 'medium',
          status: 'pending',
          parentIntent: intent.rawInput,
          measurableOutcome: 'Request completed successfully',
          constraints: [],
        },
      ];
    }

    const goals = templates.map((t) => ({
      id: randomUUID(),
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: 'pending' as const,
      parentIntent: intent.rawInput,
      measurableOutcome: `${t.title}: completed and verified`,
      constraints: intent.entities.technologies
        ? [`Must use ${intent.entities.technologies.join(', ')}`]
        : [],
    }));

    this.eventBridge?.emitGoalDecomposed(goals.map((g) => ({ id: g.id, title: g.title })));

    return goals;
  }
}
