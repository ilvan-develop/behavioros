import type { EventStore } from './event-store';
import type { BehaviorOSEvent } from './event-types';
import { createEvent } from './event-types';

export class EventBridge {
  constructor(private store: EventStore) {}

  emit(
    type: string,
    aggregateId: string,
    aggregateType: string,
    payload: unknown,
    metadata?: Record<string, unknown>,
  ): BehaviorOSEvent {
    const event = createEvent({ type, aggregateId, aggregateType, payload, metadata });
    this.store.append(event);
    return event;
  }

  emitIntentDetected(intent: { type: string; confidence: number; description: string }): void {
    this.emit('intent-detected', 'intent-engine', 'intelligence', intent);
  }

  emitGoalDecomposed(goals: Array<{ id: string; title: string }>): void {
    this.emit('goal-decomposed', 'goal-engine', 'intelligence', { goals });
  }

  emitPlanCreated(plan: { id: string; missionTitle: string }): void {
    this.emit('plan-created', 'planning-engine', 'intelligence', plan);
  }

  emitTaskCompleted(taskId: string, result: unknown): void {
    this.emit('task-completed', taskId, 'task', { taskId, result });
  }

  emitTaskFailed(taskId: string, error: string): void {
    this.emit('task-failed', taskId, 'task', { taskId, error });
  }
}
