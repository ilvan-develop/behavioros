import { randomUUID } from 'node:crypto';
import type { EventBridge } from '../../events/event-bridge';
import type { Plan, Task } from './planning-engine';

/**
 * StepType — Union type: execute, decision, parallel, gate, notify;.
 */
export type StepType = 'execute' | 'decision' | 'parallel' | 'gate' | 'notify';

/**
 * WorkflowStep — Configuration and options interface.
 */
export interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  taskId: string;
  inputs: string[];
  outputs: string[];
  timeout: number;
  retryCount: number;
}

/**
 * ExecutableWorkflow — Configuration and options interface.
 */
export interface ExecutableWorkflow {
  missionId: string;
  steps: WorkflowStep[];
  totalEstimatedDuration: number;
}

function calculateDepths(sortedTasks: Task[]): Map<string, number> {
  const depths = new Map<string, number>();
  for (const task of sortedTasks) {
    if (task.dependencies.length === 0) {
      depths.set(task.id, 0);
    } else {
      let maxDep = 0;
      for (const depId of task.dependencies) {
        const depDepth = depths.get(depId) ?? 0;
        maxDep = Math.max(maxDep, depDepth + 1);
      }
      depths.set(task.id, maxDep);
    }
  }
  return depths;
}

function determineStepType(task: Task): StepType {
  if (task.title.includes('decision') || task.title.includes('approve')) return 'decision';
  if (
    task.title.includes('test') ||
    task.title.includes('lint') ||
    task.title.includes('typecheck')
  )
    return 'gate';
  if (
    task.title.includes('notify') ||
    task.title.includes('report') ||
    task.title.includes('document')
  )
    return 'notify';
  return 'execute';
}

function createStep(task: Task, stepType: StepType): WorkflowStep {
  return {
    id: randomUUID(),
    type: stepType,
    name: task.title,
    taskId: task.id,
    inputs: task.dependencies,
    outputs: [randomUUID()],
    timeout: task.estimatedDuration * 60 * 1000,
    retryCount: stepType === 'gate' || stepType === 'decision' ? 0 : 2,
  };
}

/**
 * MissionCompiler — mission compiler.
 *
 * Methods: compile, visit.
 */
export class MissionCompiler {
  constructor(private eventBridge?: EventBridge) {}

  compile(plan: Plan): ExecutableWorkflow {
    const sortedTasks = topologicalSort(plan.tasks);
    const _taskMap = new Map(plan.tasks.map((t) => [t.id, t]));
    const depths = calculateDepths(sortedTasks);
    const depthGroups = new Map<number, Task[]>();

    for (const task of sortedTasks) {
      const depth = depths.get(task.id) ?? 0;
      if (!depthGroups.has(depth)) depthGroups.set(depth, []);
      depthGroups.get(depth)!.push(task);
    }

    const steps: WorkflowStep[] = [];
    for (const [, group] of depthGroups) {
      if (group.length === 1) {
        const task = group[0];
        const stepType = determineStepType(task);
        steps.push(createStep(task, stepType));
      } else {
        const parallelStepId = randomUUID();
        for (const task of group) {
          const subStep = createStep(task, 'execute');
          steps.push(subStep);
          parallelStepId; // used for grouping
        }
        const parallelGate: WorkflowStep = {
          id: randomUUID(),
          type: 'parallel',
          name: `Parallel: ${group.map((t) => t.title).join(', ')}`,
          taskId: parallelStepId,
          inputs: group.map((t) => t.id),
          outputs: [randomUUID()],
          timeout: Math.max(...group.map((t) => t.estimatedDuration)) * 60 * 1000,
          retryCount: 1,
        };
        steps.push(parallelGate);
      }
    }

    const workflow: ExecutableWorkflow = {
      missionId: plan.id,
      steps,
      totalEstimatedDuration: steps.reduce((sum, s) => sum + s.timeout, 0),
    };

    this.eventBridge?.emit('mission-compiled', plan.id, 'mission', {
      missionId: workflow.missionId,
      totalSteps: workflow.steps.length,
      totalEstimatedDuration: workflow.totalEstimatedDuration,
    });

    return workflow;
  }
}

function topologicalSort(tasks: Task[]): Task[] {
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
