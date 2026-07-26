import { describe, expect, it } from 'vitest';
import { EventReplay } from '../event-replay';
import { EventStore } from '../event-store';
import type { BehaviorOSEvent } from '../event-types';

// ============================================================
// EventReplay Tests
// ============================================================

function createEvent(overrides: Partial<BehaviorOSEvent> = {}): BehaviorOSEvent {
  return {
    id: crypto.randomUUID(),
    type: 'mission.created',
    aggregateId: 'mission-001',
    aggregateType: 'mission',
    timestamp: new Date().toISOString(),
    version: 1,
    metadata: {},
    payload: null,
    ...overrides,
  };
}

describe('EventReplay', () => {
  describe('replayAggregate', () => {
    it('replays all events for an aggregate and returns merged state', () => {
      const store = new EventStore();
      const replay = new EventReplay();

      store.append(
        createEvent({ aggregateId: 'm1', payload: { title: 'Mission A', status: 'draft' } }),
      );
      store.append(createEvent({ aggregateId: 'm1', payload: { status: 'executing' } }));
      store.append(
        createEvent({ aggregateId: 'm1', payload: { status: 'completed', result: 'ok' } }),
      );

      const state = replay.replayAggregate(store, 'm1');
      expect(state).toEqual({
        title: 'Mission A',
        status: 'completed',
        result: 'ok',
      });
    });

    it('returns null for non-existent aggregate', () => {
      const store = new EventStore();
      const replay = new EventReplay();

      expect(replay.replayAggregate(store, 'non-existent')).toBeNull();
    });
  });

  describe('replayAll', () => {
    it('replays all aggregates from events', () => {
      const store = new EventStore();
      const replay = new EventReplay();

      store.append(createEvent({ aggregateId: 'm1', payload: { title: 'Mission A' } }));
      store.append(createEvent({ aggregateId: 'm2', payload: { name: 'Agent B' } }));
      store.append(createEvent({ aggregateId: 'm1', payload: { status: 'done' } }));

      const results = replay.replayAll(store);

      expect(results.size).toBe(2);
      expect(results.get('m1')).toEqual({ title: 'Mission A', status: 'done' });
      expect(results.get('m2')).toEqual({ name: 'Agent B' });
    });

    it('returns empty map for empty store', () => {
      const store = new EventStore();
      const replay = new EventReplay();

      const results = replay.replayAll(store);
      expect(results.size).toBe(0);
    });
  });

  describe('replayWithProjection', () => {
    it('reduces events into a custom projection', () => {
      const replay = new EventReplay();
      const events = [
        createEvent({ type: 'mission.created', payload: { title: 'A' } }),
        createEvent({ type: 'mission.started', payload: { agentId: 'agent-1' } }),
        createEvent({
          type: 'mission.completed',
          payload: { result: 'success', duration: 120 },
        }),
      ];

      interface MissionProjection {
        missionTitle: string;
        completed: boolean;
        duration: number;
      }

      const projection = replay.replayWithProjection<MissionProjection>(
        events,
        (state, event) => {
          if (event.type === 'mission.created') {
            return {
              ...state,
              missionTitle: String((event.payload as Record<string, unknown>).title),
            };
          }
          if (event.type === 'mission.completed') {
            return {
              ...state,
              completed: true,
              duration: Number((event.payload as Record<string, unknown>).duration),
            };
          }
          return state;
        },
        { missionTitle: '', completed: false, duration: 0 },
      );

      expect(projection).toEqual({
        missionTitle: 'A',
        completed: true,
        duration: 120,
      });
    });

    it('returns initial state for empty events', () => {
      const replay = new EventReplay();

      const result = replay.replayWithProjection([], (state) => state, { count: 0 });

      expect(result).toEqual({ count: 0 });
    });

    it('handles sequential state transformations', () => {
      const replay = new EventReplay();
      const events = [
        createEvent({ type: 'step.1', payload: { value: 10 } }),
        createEvent({ type: 'step.2', payload: { value: 20 } }),
        createEvent({ type: 'step.3', payload: { value: 30 } }),
      ];

      interface ValueState {
        values: number[];
      }

      const result = replay.replayWithProjection<ValueState>(
        events,
        (state, event) => ({
          values: [...state.values, Number((event.payload as Record<string, unknown>).value)],
        }),
        { values: [] },
      );

      expect(result.values).toEqual([10, 20, 30]);
    });
  });
});
