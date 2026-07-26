import { randomUUID } from 'node:crypto';
import type { EventBridge } from '../../events/event-bridge';
import type { Goal } from './goal-engine';

/**
 * TaskStatus — Union type: pending, in_progress, completed, blocked, failed;.
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';

/**
 * Task — Configuration and options interface.
 */
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  estimatedDuration: number;
  assignedTo?: string;
  output?: string;
}

/**
 * Plan — Configuration and options interface.
 */
export interface Plan {
  id: string;
  missionTitle: string;
  goals: Goal[];
  tasks: Task[];
  dependencyGraph: Map<string, string[]>;
  createdAt: string;
}

const GOAL_TASK_TEMPLATES: Record<
  string,
  Array<{ title: string; description: string; duration: number; deps: string[] }>
> = {
  'Design architecture': [
    {
      title: 'Review requirements',
      description: 'Review and finalize all requirements',
      duration: 15,
      deps: [],
    },
    {
      title: 'Create architecture diagram',
      description: 'Document system architecture',
      duration: 30,
      deps: ['Review requirements'],
    },
  ],
  'Implement API': [
    {
      title: 'Define API contracts',
      description: 'Define request/response schemas',
      duration: 20,
      deps: ['Review requirements'],
    },
    {
      title: 'Build endpoints',
      description: 'Implement the API endpoints',
      duration: 45,
      deps: ['Define API contracts'],
    },
    {
      title: 'Add error handling',
      description: 'Add proper error handling middleware',
      duration: 20,
      deps: ['Build endpoints'],
    },
  ],
  'Add validation': [
    {
      title: 'Define validation rules',
      description: 'Define input validation rules',
      duration: 15,
      deps: ['Define API contracts'],
    },
    {
      title: 'Implement validators',
      description: 'Implement validation logic',
      duration: 25,
      deps: ['Define validation rules'],
    },
  ],
  'Write tests': [
    {
      title: 'Write unit tests',
      description: 'Write unit tests for all modules',
      duration: 30,
      deps: ['Build endpoints', 'Implement validators'],
    },
    {
      title: 'Write integration tests',
      description: 'Write integration tests for the flow',
      duration: 30,
      deps: ['Write unit tests'],
    },
    {
      title: 'Run test suite',
      description: 'Run all tests and fix failures',
      duration: 15,
      deps: ['Write integration tests'],
    },
  ],
  'Reproduce bug': [
    {
      title: 'Create test case',
      description: 'Create a test case that reproduces the bug',
      duration: 15,
      deps: [],
    },
    {
      title: 'Document steps',
      description: 'Document exact reproduction steps',
      duration: 10,
      deps: ['Create test case'],
    },
  ],
  'Identify root cause': [
    {
      title: 'Debug issue',
      description: 'Debug to locate the root cause',
      duration: 30,
      deps: ['Create test case'],
    },
    {
      title: 'Document root cause',
      description: 'Document the root cause analysis',
      duration: 10,
      deps: ['Debug issue'],
    },
  ],
  'Apply fix': [
    {
      title: 'Implement fix',
      description: 'Implement the fix',
      duration: 20,
      deps: ['Document root cause'],
    },
    {
      title: 'Run affected tests',
      description: 'Run tests for affected modules',
      duration: 15,
      deps: ['Implement fix'],
    },
  ],
  'Verify fix': [
    {
      title: 'Verify regression',
      description: 'Verify no regressions introduced',
      duration: 15,
      deps: ['Run affected tests'],
    },
    {
      title: 'Add regression test',
      description: 'Add test to prevent future regression',
      duration: 15,
      deps: ['Verify regression'],
    },
  ],
  'Analyze current code': [
    {
      title: 'Read source code',
      description: 'Read and understand the current implementation',
      duration: 20,
      deps: [],
    },
    {
      title: 'Document pain points',
      description: 'Document areas for improvement',
      duration: 15,
      deps: ['Read source code'],
    },
  ],
  'Define target structure': [
    {
      title: 'Design target architecture',
      description: 'Design the target architecture',
      duration: 25,
      deps: ['Document pain points'],
    },
    {
      title: 'Create migration plan',
      description: 'Create a step-by-step migration plan',
      duration: 20,
      deps: ['Design target architecture'],
    },
  ],
  'Implement refactoring': [
    {
      title: 'Execute refactoring',
      description: 'Execute the refactoring changes',
      duration: 45,
      deps: ['Create migration plan'],
    },
    {
      title: 'Verify no regressions',
      description: 'Verify all existing tests pass',
      duration: 20,
      deps: ['Execute refactoring'],
    },
  ],
  'Validate behavior': [
    {
      title: 'Run full test suite',
      description: 'Run the complete test suite',
      duration: 20,
      deps: ['Verify no regressions'],
    },
    {
      title: 'Manual verification',
      description: 'Manual verification of critical paths',
      duration: 15,
      deps: ['Run full test suite'],
    },
  ],
  'Gather data': [
    {
      title: 'Identify data sources',
      description: 'Identify and document data sources',
      duration: 15,
      deps: [],
    },
    {
      title: 'Collect data',
      description: 'Collect relevant data',
      duration: 20,
      deps: ['Identify data sources'],
    },
  ],
  'Perform analysis': [
    {
      title: 'Run analysis',
      description: 'Perform the data analysis',
      duration: 30,
      deps: ['Collect data'],
    },
    {
      title: 'Review results',
      description: 'Review and validate analysis results',
      duration: 15,
      deps: ['Run analysis'],
    },
  ],
  'Document findings': [
    {
      title: 'Write report',
      description: 'Write analysis report',
      duration: 20,
      deps: ['Review results'],
    },
    {
      title: 'Present findings',
      description: 'Prepare presentation of findings',
      duration: 15,
      deps: ['Write report'],
    },
  ],
  'Prepare release': [
    {
      title: 'Update changelog',
      description: 'Update the changelog with new changes',
      duration: 10,
      deps: [],
    },
    {
      title: 'Bump version',
      description: 'Bump the package version',
      duration: 5,
      deps: ['Update changelog'],
    },
    {
      title: 'Build artifacts',
      description: 'Build production artifacts',
      duration: 15,
      deps: ['Bump version'],
    },
  ],
  'Run pre-deployment checks': [
    { title: 'Run lint', description: 'Run linter', duration: 10, deps: ['Build artifacts'] },
    {
      title: 'Run typecheck',
      description: 'Run TypeScript typecheck',
      duration: 15,
      deps: ['Build artifacts'],
    },
    {
      title: 'Run tests',
      description: 'Run full test suite',
      duration: 20,
      deps: ['Run lint', 'Run typecheck'],
    },
  ],
  'Execute deployment': [
    {
      title: 'Deploy to environment',
      description: 'Deploy to target environment',
      duration: 30,
      deps: ['Run tests'],
    },
    {
      title: 'Verify health',
      description: 'Verify health checks pass',
      duration: 10,
      deps: ['Deploy to environment'],
    },
  ],
  'Verify deployment': [
    {
      title: 'Smoke tests',
      description: 'Run smoke tests against deployed version',
      duration: 15,
      deps: ['Verify health'],
    },
    {
      title: 'Monitor metrics',
      description: 'Monitor metrics for anomalies',
      duration: 20,
      deps: ['Smoke tests'],
    },
  ],
  'Research topic': [
    {
      title: 'Gather resources',
      description: 'Gather relevant documentation and resources',
      duration: 20,
      deps: [],
    },
    {
      title: 'Read and understand',
      description: 'Read and understand the material',
      duration: 30,
      deps: ['Gather resources'],
    },
  ],
  'Synthesize knowledge': [
    {
      title: 'Create summary',
      description: 'Summarize key findings',
      duration: 20,
      deps: ['Read and understand'],
    },
    {
      title: 'Create examples',
      description: 'Create code examples if applicable',
      duration: 25,
      deps: ['Create summary'],
    },
  ],
  'Document results': [
    {
      title: 'Write documentation',
      description: 'Write comprehensive documentation',
      duration: 25,
      deps: ['Create examples'],
    },
    {
      title: 'Review documentation',
      description: 'Review documentation for accuracy',
      duration: 10,
      deps: ['Write documentation'],
    },
  ],
};

function buildTasksForGoal(goal: Goal): Task[] {
  const templates = GOAL_TASK_TEMPLATES[goal.title];
  if (!templates) {
    return [
      {
        id: randomUUID(),
        title: goal.title,
        description: goal.description,
        status: 'pending',
        priority: goal.priority,
        dependencies: [],
        estimatedDuration: 30,
      },
    ];
  }

  const taskMap = new Map<string, Task>();
  for (const t of templates) {
    const task: Task = {
      id: randomUUID(),
      title: t.title,
      description: t.description,
      status: 'pending',
      priority: goal.priority,
      dependencies: [],
      estimatedDuration: t.duration,
    };
    taskMap.set(t.title, task);
  }

  for (const t of templates) {
    const task = taskMap.get(t.title)!;
    for (const dep of t.deps) {
      const depTask = taskMap.get(dep);
      if (depTask) {
        task.dependencies.push(depTask.id);
      }
    }
  }

  return [...taskMap.values()];
}

/**
 * PlanningEngine — planning engine.
 *
 * Methods: createPlan, detectCycle, topologicalSort, visit.
 */
export class PlanningEngine {
  constructor(private eventBridge?: EventBridge) {}

  createPlan(missionTitle: string, goals: Goal[]): Plan {
    const allTasks: Task[] = [];
    for (const goal of goals) {
      const goalTasks = buildTasksForGoal(goal);
      allTasks.push(...goalTasks);
    }

    const dependencyGraph = new Map<string, string[]>();
    for (const task of allTasks) {
      dependencyGraph.set(task.id, task.dependencies);
    }

    const plan: Plan = {
      id: randomUUID(),
      missionTitle,
      goals,
      tasks: allTasks,
      dependencyGraph,
      createdAt: new Date().toISOString(),
    };

    this.eventBridge?.emitPlanCreated({ id: plan.id, missionTitle: plan.missionTitle });

    return plan;
  }

  detectCycle(tasks: Task[]): string[] | null {
    const adjacency = new Map<string, string[]>();
    for (const task of tasks) {
      adjacency.set(task.id, task.dependencies);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    function dfs(nodeId: string, path: string[]): string[] | null {
      if (inStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        return path.slice(cycleStart).concat(nodeId);
      }
      if (visited.has(nodeId)) return null;

      visited.add(nodeId);
      inStack.add(nodeId);
      path.push(nodeId);

      const deps = adjacency.get(nodeId) ?? [];
      for (const depId of deps) {
        const cycle = dfs(depId, path);
        if (cycle) return cycle;
      }

      inStack.delete(nodeId);
      path.pop();
      return null;
    }

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        const cycle = dfs(task.id, []);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  topologicalSort(tasks: Task[]): Task[] {
    const visited = new Set<string>();
    const result: Task[] = [];
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    function visit(taskId: string) {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
        result.push(task);
      }
    }

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }
}
