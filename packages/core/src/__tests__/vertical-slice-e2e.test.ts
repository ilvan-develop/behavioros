import { describe, expect, it } from 'vitest';
import { QueueManager } from '../engines/execution/queue-manager';
import { GoalEngine } from '../engines/intelligence/goal-engine';
import { IntentEngine } from '../engines/intelligence/intent-engine';
import { MissionCompiler } from '../engines/intelligence/mission-compiler';
import { PlanningEngine } from '../engines/intelligence/planning-engine';
import { KnowledgeGraph } from '../engines/knowledge/knowledge-graph';
import { EventStore } from '../events/event-store';
import { createEvent } from '../events/event-types';

describe('Vertical Slice E2E — Full Pipeline', () => {
  it('should complete full vertical slice flow end-to-end', async () => {
    const intentEngine = new IntentEngine();
    const goalEngine = new GoalEngine();
    const planningEngine = new PlanningEngine();
    const missionCompiler = new MissionCompiler();
    const queueManager = new QueueManager();
    const knowledgeGraph = new KnowledgeGraph();
    const eventStore = new EventStore();

    const intent = intentEngine.detect(
      'Build a REST API for user management with Node.js and PostgreSQL',
    );
    expect(intent.type).toBe('build');
    expect(intent.entities).toBeDefined();
    const allEntities = Object.values(intent.entities).flat();
    expect(allEntities).toContain('node');
    expect(allEntities).toContain('postgresql');
    expect(intent.confidence).toBeGreaterThan(0);

    const goals = goalEngine.decompose(intent);
    expect(goals.length).toBeGreaterThanOrEqual(3);
    for (const goal of goals) {
      expect(goal.id).toBeDefined();
      expect(goal.title).toBeDefined();
      expect(goal.priority).toBeDefined();
    }

    const plan = planningEngine.createPlan('User Management API', goals);
    expect(plan.tasks.length).toBeGreaterThanOrEqual(5);
    expect(plan.dependencyGraph).toBeDefined();
    for (const task of plan.tasks) {
      expect(task.dependencies).toBeDefined();
      expect(task.status).toBeDefined();
      expect(task.priority).toBeDefined();
    }

    const workflow = missionCompiler.compile(plan);
    expect(workflow.steps.length).toBeGreaterThanOrEqual(plan.tasks.length);
    const stepIds = workflow.steps.map((s) => s.taskId);
    expect(new Set(stepIds).size).toBe(stepIds.length);
    for (const step of workflow.steps) {
      expect(step.timeout).toBeGreaterThan(0);
      expect(step.retryCount).toBeGreaterThan(0);
    }

    for (const step of workflow.steps) {
      queueManager.enqueue({
        taskId: step.taskId,
        type: step.type,
        payload: step,
        priority: 'high',
        maxRetries: step.retryCount,
      });
    }

    const initialStats = queueManager.getStats();
    expect(initialStats.queued).toBeGreaterThanOrEqual(workflow.steps.length);

    for (let i = 0; i < workflow.steps.length; i++) {
      const item = queueManager.dequeue();
      expect(item).not.toBeNull();
      if (item) {
        knowledgeGraph.addNode({
          id: `exec-${item.id}`,
          type: 'entity',
          label: `Task: ${item.taskId}`,
          properties: { status: 'completed', queueItemId: item.id },
        });
        queueManager.complete(item.id);
      }
    }

    const finalStats = queueManager.getStats();
    expect(finalStats.completed).toBe(workflow.steps.length);
    expect(finalStats.failed).toBe(0);

    const knowledgeStats = knowledgeGraph.getStats();
    expect(knowledgeStats.nodes).toBe(workflow.steps.length);

    const buildEvent = createEvent({
      type: 'insight-recorded',
      aggregateId: 'vertical-slice',
      aggregateType: 'mission',
      payload: {
        content: 'Completed mission: User Management API',
        source: 'vertical-slice',
        impact: 'high',
      },
      metadata: { stepsExecuted: workflow.steps.length },
    });
    eventStore.append(buildEvent);
    const events = eventStore.getAllEvents();
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1].type).toBe('insight-recorded');
  });

  it('should dequeue and fail items correctly', async () => {
    const queue = new QueueManager();
    const graph = new KnowledgeGraph();

    const goodId = queue.enqueue({
      taskId: 'good-task',
      type: 'task',
      payload: {},
      priority: 'high',
      maxRetries: 0,
    });
    const badId = queue.enqueue({
      taskId: 'will-fail',
      type: 'task',
      payload: {},
      priority: 'high',
      maxRetries: 2,
    });

    const goodItem = queue.dequeue();
    expect(goodItem).not.toBeNull();
    if (goodItem) {
      graph.addNode({
        id: `exec-${goodItem.id}`,
        type: 'entity',
        label: `Task: ${goodItem.taskId}`,
        properties: { status: 'completed' },
      });
      queue.complete(goodItem.id);
    }

    const badItem = queue.dequeue();
    expect(badItem).not.toBeNull();
    if (badItem) {
      queue.fail(badItem.id, 'Intentional failure');
    }

    expect(graph.getStats().nodes).toBe(1);

    const goodStatus = queue.getStatus(goodId);
    expect(goodStatus).toBe('completed');

    const badStatus = queue.getStatus(badId);
    expect(badStatus).toBe('failed');
  });

  it('should handle empty flow gracefully', async () => {
    const queue = new QueueManager();

    const stats = queue.getStats();
    expect(stats.queued).toBe(0);
    expect(stats.running).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.failed).toBe(0);

    const item = queue.dequeue();
    expect(item).toBeNull();
  });

  it('should handle concurrent execution with multiple workers', async () => {
    const queue = new QueueManager();
    const graph = new KnowledgeGraph();

    for (let i = 0; i < 10; i++) {
      queue.enqueue({
        taskId: `concurrent-task-${i + 1}`,
        type: 'task',
        payload: { index: i },
        priority: 'medium',
        maxRetries: 1,
      });
    }

    const initialStats = queue.getStats();
    expect(initialStats.queued).toBe(10);

    for (let i = 0; i < 10; i++) {
      const item = queue.dequeue();
      expect(item).not.toBeNull();
      if (item) {
        graph.addNode({
          id: `concurrent-${item.id}`,
          type: 'entity',
          label: `Task: ${item.taskId}`,
          properties: { status: 'completed' },
        });
        queue.complete(item.id);
      }
    }

    expect(graph.getStats().nodes).toBe(10);

    const finalStats = queue.getStats();
    expect(finalStats.completed).toBe(10);
    expect(finalStats.failed).toBe(0);
  });
});
