import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkflowDefinition } from '../engines/runtime/workflow-engine';
import { InvalidTransitionError, WorkflowEngine } from '../engines/runtime/workflow-engine';

function createSimpleDefinition(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: 'simple-workflow',
    name: 'Simple Workflow',
    version: '1.0.0',
    states: [
      { id: 'pending', name: 'Pending', type: 'simple' },
      { id: 'running', name: 'Running', type: 'simple' },
      { id: 'completed', name: 'Completed', type: 'simple' },
    ],
    transitions: [
      { from: 'pending', to: 'running', on: 'start' },
      { from: 'running', to: 'completed', on: 'finish' },
    ],
    initialState: 'pending',
    ...overrides,
  };
}

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should register a definition and create an instance', () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    const instance = engine.getInstance(instanceId);
    expect(instance).toBeDefined();
    expect(instance!.definitionId).toBe(def.id);
    expect(instance!.currentState).toBe('pending');
    expect(instance!.status).toBe('running');
    expect(instance!.history).toHaveLength(0);
  });

  it('should start a workflow and record initial state in history', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    const state = await engine.start(instanceId);
    expect(state).toBe('pending');
    const instance = engine.getInstance(instanceId);
    expect(instance!.history).toHaveLength(1);
    expect(instance!.history[0]).toMatchObject({ from: '', to: 'pending', on: 'start' });
  });

  it('should perform a valid transition', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    const state = await engine.transition(instanceId, 'start');
    expect(state).toBe('running');
    const instance = engine.getInstance(instanceId);
    expect(instance!.currentState).toBe('running');
    expect(instance!.history).toHaveLength(2);
  });

  it('should throw InvalidTransitionError for invalid transition', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    await expect(engine.transition(instanceId, 'invalid-event')).rejects.toThrow(
      InvalidTransitionError,
    );
  });

  it('should throw InvalidTransitionError when no transition from current state matches the event', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);
    await engine.transition(instanceId, 'start');

    await expect(engine.transition(instanceId, 'start')).rejects.toThrow(InvalidTransitionError);
  });

  it('should complete workflow when reaching end state', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);
    await engine.transition(instanceId, 'start');
    await engine.transition(instanceId, 'finish');

    const instance = engine.getInstance(instanceId);
    expect(instance!.currentState).toBe('completed');
    expect(instance!.status).toBe('completed');
  });

  it('should handle parallel states with multiple outgoing transitions', async () => {
    const def: WorkflowDefinition = {
      id: 'parallel-workflow',
      name: 'Parallel Workflow',
      version: '1.0.0',
      states: [
        { id: 'start', name: 'Start', type: 'parallel' },
        { id: 'branch-a', name: 'Branch A', type: 'simple' },
        { id: 'branch-b', name: 'Branch B', type: 'simple' },
      ],
      transitions: [
        { from: 'start', to: 'branch-a', on: 'fork' },
        { from: 'start', to: 'branch-b', on: 'fork' },
      ],
      initialState: 'start',
    };
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    const state = await engine.transition(instanceId, 'fork');
    expect(state).toBe('branch-b');
    const instance = engine.getInstance(instanceId);
    expect(instance!.history).toHaveLength(3);
    expect(instance!.history[1].to).toBe('branch-a');
    expect(instance!.history[2].to).toBe('branch-b');
  });

  it('should track history on every state change', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);
    await engine.transition(instanceId, 'start');
    await engine.transition(instanceId, 'finish');

    const instance = engine.getInstance(instanceId);
    expect(instance!.history).toHaveLength(3);
    expect(instance!.history[0]).toMatchObject({ from: '', to: 'pending', on: 'start' });
    expect(instance!.history[1]).toMatchObject({ from: 'pending', to: 'running', on: 'start' });
    expect(instance!.history[2]).toMatchObject({ from: 'running', to: 'completed', on: 'finish' });
  });

  it('should abort a running workflow', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    engine.abort(instanceId);
    const instance = engine.getInstance(instanceId);
    expect(instance!.status).toBe('aborted');
  });

  it('should throw when transitioning an aborted workflow', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);
    engine.abort(instanceId);

    await expect(engine.transition(instanceId, 'start')).rejects.toThrow(/not running/);
  });

  it('should list all instances', () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const id1 = engine.create(def.id);
    const id2 = engine.create(def.id);
    const all = engine.listInstances();
    expect(all).toHaveLength(2);
    expect(all.map((i) => i.id)).toEqual(expect.arrayContaining([id1, id2]));
  });

  it('should list instances filtered by status', async () => {
    const def = createSimpleDefinition();
    engine.register(def);
    const id1 = engine.create(def.id);
    const id2 = engine.create(def.id);
    await engine.start(id1);
    engine.abort(id2);

    const running = engine.listInstances('running');
    expect(running).toHaveLength(1);
    expect(running[0].id).toBe(id1);
  });

  it('should pass context through workflow steps', async () => {
    const def: WorkflowDefinition = {
      id: 'context-workflow',
      name: 'Context Workflow',
      version: '1.0.0',
      states: [
        { id: 'start', name: 'Start', type: 'simple' },
        { id: 'processed', name: 'Processed', type: 'simple' },
      ],
      transitions: [
        {
          from: 'start',
          to: 'processed',
          on: 'process',
          action: async (ctx) => {
            ctx.processed = true;
          },
        },
      ],
      initialState: 'start',
      context: { initial: 'value' },
    };
    engine.register(def);
    const instanceId = engine.create(def.id, { userData: 42 });
    await engine.start(instanceId);

    const before = engine.getInstance(instanceId);
    expect(before!.context).toMatchObject({ initial: 'value', userData: 42 });

    await engine.transition(instanceId, 'process');
    const after = engine.getInstance(instanceId);
    expect(after!.context).toMatchObject({ initial: 'value', userData: 42, processed: true });
  });

  it('should handle event-driven transitions', async () => {
    const def: WorkflowDefinition = {
      id: 'event-workflow',
      name: 'Event-Driven Workflow',
      version: '1.0.0',
      states: [
        { id: 'waiting', name: 'Waiting', type: 'event-driven' },
        { id: 'confirmed', name: 'Confirmed', type: 'simple' },
      ],
      transitions: [{ from: 'waiting', to: 'confirmed', on: 'payment.confirmed' }],
      initialState: 'waiting',
    };
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    const state = await engine.transition(instanceId, 'payment.confirmed');
    expect(state).toBe('confirmed');
  });

  it('should execute timed transitions after delay', async () => {
    const def: WorkflowDefinition = {
      id: 'timed-workflow',
      name: 'Timed Workflow',
      version: '1.0.0',
      states: [
        { id: 'waiting', name: 'Waiting', type: 'timed' },
        { id: 'timeout', name: 'Timeout', type: 'simple' },
      ],
      transitions: [{ from: 'waiting', to: 'timeout', on: 'after:100' }],
      initialState: 'waiting',
    };
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    expect(engine.getInstance(instanceId)!.currentState).toBe('waiting');

    vi.advanceTimersByTime(100);
    await Promise.resolve();

    const instance = engine.getInstance(instanceId);
    expect(instance!.currentState).toBe('timeout');
    expect(instance!.status).toBe('completed');
  });

  it('should not transition timed instance after abort', async () => {
    const def: WorkflowDefinition = {
      id: 'timed-abort-workflow',
      name: 'Timed Abort Workflow',
      version: '1.0.0',
      states: [
        { id: 'waiting', name: 'Waiting', type: 'timed' },
        { id: 'timeout', name: 'Timeout', type: 'simple' },
      ],
      transitions: [{ from: 'waiting', to: 'timeout', on: 'after:100' }],
      initialState: 'waiting',
    };
    engine.register(def);
    const instanceId = engine.create(def.id);
    await engine.start(instanceId);

    engine.abort(instanceId);

    vi.advanceTimersByTime(100);
    await Promise.resolve();

    const instance = engine.getInstance(instanceId);
    expect(instance!.currentState).toBe('waiting');
    expect(instance!.status).toBe('aborted');
  });

  it('should throw when creating instance for unregistered definition', () => {
    expect(() => engine.create('non-existent')).toThrow(/not found/);
  });
});
