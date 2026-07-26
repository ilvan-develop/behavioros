import { randomUUID } from 'node:crypto';

/**
 * WorkflowState — Configuration and options interface.
 */
export interface WorkflowState {
  id: string;
  name: string;
  type: 'simple' | 'parallel' | 'timed' | 'event-driven';
}

/**
 * WorkflowTransition — Configuration and options interface.
 */
export interface WorkflowTransition {
  from: string;
  to: string;
  on: string;
  action?: (context: Record<string, unknown>) => Promise<void>;
}

/**
 * WorkflowDefinition — Configuration and options interface.
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  initialState: string;
  context?: Record<string, unknown>;
}

/**
 * WorkflowInstance — Configuration and options interface.
 */
export interface WorkflowInstance {
  id: string;
  definitionId: string;
  currentState: string;
  history: { from: string; to: string; on: string; timestamp: string }[];
  context: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed' | 'aborted';
  createdAt: string;
}

/**
 * InvalidTransitionError — invalid transition error.
 *
 * Methods: register, create, start, transition, getInstance, getDefinition, abort, clearTimeout, +1 more.
 */
export class InvalidTransitionError extends Error {
  constructor(instanceId: string, from: string, event: string) {
    super(`Invalid transition from '${from}' on event '${event}' for instance '${instanceId}'`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * WorkflowEngine — workflow engine.
 *
 * Methods: register, create, start, transition, getInstance, getDefinition, abort, clearTimeout, +1 more.
 */
export class WorkflowEngine {
  private definitions: Map<string, WorkflowDefinition> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  register(definition: WorkflowDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  create(definitionId: string, context?: Record<string, unknown>): string {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`Definition '${definitionId}' not found`);
    }
    const id = randomUUID();
    const instance: WorkflowInstance = {
      id,
      definitionId,
      currentState: definition.initialState,
      history: [],
      context: { ...definition.context, ...context },
      status: 'running',
      createdAt: new Date().toISOString(),
    };
    this.instances.set(id, instance);
    return id;
  }

  async start(instanceId: string): Promise<string> {
    const instance = this.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    instance.history.push({
      from: '',
      to: instance.currentState,
      on: 'start',
      timestamp: new Date().toISOString(),
    });
    await this.processAutoTransitions(instance);
    return instance.currentState;
  }

  async transition(instanceId: string, event: string): Promise<string> {
    const instance = this.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    if (instance.status !== 'running') {
      throw new Error(`Instance '${instanceId}' is not running (status: ${instance.status})`);
    }

    const definition = this.getDefinition(instance.definitionId);
    if (!definition) {
      throw new Error(`Definition for instance '${instanceId}' not found`);
    }

    const _currentState = definition.states.find((s) => s.id === instance.currentState);
    const matchingTransitions = definition.transitions.filter(
      (t) => t.from === instance.currentState && t.on === event,
    );

    if (matchingTransitions.length === 0) {
      throw new InvalidTransitionError(instanceId, instance.currentState, event);
    }

    for (const transition of matchingTransitions) {
      instance.history.push({
        from: instance.currentState,
        to: transition.to,
        on: event,
        timestamp: new Date().toISOString(),
      });
      instance.currentState = transition.to;

      if (transition.action) {
        await transition.action(instance.context);
      }

      const isEndState = !definition.transitions.some((t) => t.from === transition.to);
      if (isEndState) {
        instance.status = 'completed';
      }
    }

    await this.processAutoTransitions(instance);
    return instance.currentState;
  }

  getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  getDefinition(definitionId: string): WorkflowDefinition | undefined {
    return this.definitions.get(definitionId);
  }

  abort(instanceId: string): void {
    const instance = this.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance '${instanceId}' not found`);
    }
    instance.status = 'aborted';
    const timerId = this.timers.get(instanceId);
    if (timerId) {
      clearTimeout(timerId);
      this.timers.delete(instanceId);
    }
  }

  listInstances(status?: string): WorkflowInstance[] {
    const all = Array.from(this.instances.values());
    if (status) {
      return all.filter((i) => i.status === status);
    }
    return all;
  }

  private async processAutoTransitions(instance: WorkflowInstance): Promise<void> {
    const definition = this.getDefinition(instance.definitionId);
    if (!definition) return;

    const currentState = definition.states.find((s) => s.id === instance.currentState);
    if (!currentState) return;

    if (currentState.type === 'timed') {
      const timedTransitions = definition.transitions.filter(
        (t) => t.from === instance.currentState && t.on.startsWith('after:'),
      );
      for (const transition of timedTransitions) {
        const delayStr = transition.on.replace('after:', '');
        const delay = parseInt(delayStr, 10);
        if (!Number.isNaN(delay)) {
          const timerId = setTimeout(async () => {
            try {
              await this.transition(instance.id, transition.on);
            } catch {
              // instance may have been aborted
            }
          }, delay);
          this.timers.set(instance.id, timerId);
        }
      }
    }
  }
}
