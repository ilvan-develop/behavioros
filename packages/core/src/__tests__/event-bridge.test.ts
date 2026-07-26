import { describe, expect, it } from 'vitest';
import { QueueManager } from '../engines/execution/queue-manager';
import { GoalEngine } from '../engines/intelligence/goal-engine';
import { IntentEngine } from '../engines/intelligence/intent-engine';
import { MissionCompiler } from '../engines/intelligence/mission-compiler';
import { PlanningEngine } from '../engines/intelligence/planning-engine';
import { KnowledgeGraph } from '../engines/knowledge/knowledge-graph';
import { EventBridge } from '../events/event-bridge';
import { EventStore } from '../events/event-store';

describe('EventBridge', () => {
  it('emits an event and stores it in EventStore', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    bridge.emit('test.event', 'agg-1', 'test', { key: 'value' });

    const events = store.getAllEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('test.event');
    expect(events[0].aggregateId).toBe('agg-1');
    expect(events[0].aggregateType).toBe('test');
    expect(events[0].payload).toEqual({ key: 'value' });
  });

  it('returns the created event from emit()', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    const event = bridge.emit('test.event', 'agg-1', 'test', { foo: 'bar' });

    expect(event.type).toBe('test.event');
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('emitIntentDetected stores an intent-detected event', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    bridge.emitIntentDetected({
      type: 'build',
      confidence: 0.85,
      description: 'build task detected',
    });

    const events = store.getEventsByType('intent-detected');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ type: 'build', confidence: 0.85 });
  });

  it('emitGoalDecomposed stores a goal-decomposed event', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    bridge.emitGoalDecomposed([
      { id: 'g1', title: 'Design' },
      { id: 'g2', title: 'Implement' },
    ]);

    const events = store.getEventsByType('goal-decomposed');
    expect(events).toHaveLength(1);
    expect(
      (events[0].payload as { goals: Array<{ id: string; title: string }> }).goals,
    ).toHaveLength(2);
  });

  it('emitPlanCreated stores a plan-created event', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    bridge.emitPlanCreated({ id: 'plan-1', missionTitle: 'Test Mission' });

    const events = store.getEventsByType('plan-created');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ id: 'plan-1', missionTitle: 'Test Mission' });
  });

  it('emitTaskCompleted stores a task-completed event', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    bridge.emitTaskCompleted('task-1', { status: 'ok' });

    const events = store.getEventsByType('task-completed');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ taskId: 'task-1', result: { status: 'ok' } });
  });

  it('emitTaskFailed stores a task-failed event', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);

    bridge.emitTaskFailed('task-1', 'Something went wrong');

    const events = store.getEventsByType('task-failed');
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ taskId: 'task-1', error: 'Something went wrong' });
  });
});

describe('Engine EventBridge Integration', () => {
  it('IntentEngine emits intent-detected when EventBridge is provided', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const engine = new IntentEngine(bridge);

    engine.detect('build a new API');

    const events = store.getEventsByType('intent-detected');
    expect(events).toHaveLength(1);
    expect((events[0].payload as { type: string }).type).toBe('build');
  });

  it('GoalEngine emits goal-decomposed when EventBridge is provided', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const intentEngine = new IntentEngine();
    const goalEngine = new GoalEngine(bridge);

    const intent = intentEngine.detect('build a new API');
    const goals = goalEngine.decompose(intent);

    expect(goals.length).toBeGreaterThan(0);
    const events = store.getEventsByType('goal-decomposed');
    expect(events).toHaveLength(1);
  });

  it('PlanningEngine emits plan-created when EventBridge is provided', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const intentEngine = new IntentEngine();
    const goalEngine = new GoalEngine();
    const planningEngine = new PlanningEngine(bridge);

    const intent = intentEngine.detect('build a new API');
    const goals = goalEngine.decompose(intent);
    planningEngine.createPlan('Test', goals);

    const events = store.getEventsByType('plan-created');
    expect(events).toHaveLength(1);
  });

  it('MissionCompiler emits mission-compiled when EventBridge is provided', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const intentEngine = new IntentEngine();
    const goalEngine = new GoalEngine();
    const planningEngine = new PlanningEngine();
    const compiler = new MissionCompiler(bridge);

    const intent = intentEngine.detect('build a new API');
    const goals = goalEngine.decompose(intent);
    const plan = planningEngine.createPlan('Test', goals);
    compiler.compile(plan);

    const events = store.getEventsByType('mission-compiled');
    expect(events).toHaveLength(1);
  });

  it('QueueManager emits task events when EventBridge is provided', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const qm = new QueueManager(bridge);

    const id = qm.enqueue({
      taskId: 't1',
      type: 'build',
      payload: {},
      priority: 'high',
      maxRetries: 3,
    });
    expect(store.getEventsByType('task-queued')).toHaveLength(1);

    const item = qm.dequeue();
    expect(item).not.toBeNull();
    expect(store.getEventsByType('task-started')).toHaveLength(1);

    qm.complete(id);
    expect(store.getEventsByType('task-completed')).toHaveLength(1);
  });

  it('QueueManager emits task-failed when a task fails', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const qm = new QueueManager(bridge);

    const id = qm.enqueue({
      taskId: 't2',
      type: 'build',
      payload: {},
      priority: 'medium',
      maxRetries: 0,
    });
    qm.fail(id, 'Execution error');

    const events = store.getEventsByType('task-failed');
    expect(events).toHaveLength(1);
    expect((events[0].payload as { error: string }).error).toBe('Execution error');
  });

  it('KnowledgeGraph emits knowledge-node-added when EventBridge is provided', () => {
    const store = new EventStore();
    const bridge = new EventBridge(store);
    const kg = new KnowledgeGraph(bridge);

    kg.addNode({ type: 'concept', label: 'Event Sourcing', properties: {} });

    const events = store.getEventsByType('knowledge-node-added');
    expect(events).toHaveLength(1);
    expect((events[0].payload as { label: string }).label).toBe('Event Sourcing');
  });
});

describe('Backward Compatibility', () => {
  it('IntentEngine works without EventBridge', () => {
    const engine = new IntentEngine();
    const result = engine.detect('build something');
    expect(result.type).toBe('build');
  });

  it('GoalEngine works without EventBridge', () => {
    const engine = new GoalEngine();
    const intentEngine = new IntentEngine();
    const intent = intentEngine.detect('fix login bug');
    const goals = engine.decompose(intent);
    expect(goals.length).toBeGreaterThan(0);
  });

  it('PlanningEngine works without EventBridge', () => {
    const engine = new PlanningEngine();
    const intentEngine = new IntentEngine();
    const goalEngine = new GoalEngine();
    const intent = intentEngine.detect('build a new API');
    const goals = goalEngine.decompose(intent);
    const plan = engine.createPlan('Test', goals);
    expect(plan.tasks.length).toBeGreaterThan(0);
  });

  it('MissionCompiler works without EventBridge', () => {
    const compiler = new MissionCompiler();
    const intentEngine = new IntentEngine();
    const goalEngine = new GoalEngine();
    const planningEngine = new PlanningEngine();
    const intent = intentEngine.detect('build a new API');
    const goals = goalEngine.decompose(intent);
    const plan = planningEngine.createPlan('Test', goals);
    const workflow = compiler.compile(plan);
    expect(workflow.steps.length).toBeGreaterThan(0);
  });

  it('QueueManager works without EventBridge', () => {
    const qm = new QueueManager();
    const id = qm.enqueue({
      taskId: 't1',
      type: 'build',
      payload: {},
      priority: 'high',
      maxRetries: 3,
    });
    expect(id).toBeDefined();
    const item = qm.dequeue();
    expect(item).not.toBeNull();
    qm.complete(id);
  });

  it('KnowledgeGraph works without EventBridge', () => {
    const kg = new KnowledgeGraph();
    const id = kg.addNode({ type: 'concept', label: 'Test', properties: {} });
    expect(id).toBeDefined();
    const node = kg.getNode(id);
    expect(node).not.toBeNull();
  });
});
