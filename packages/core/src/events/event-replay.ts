import type { EventStore } from './event-store';
import type { BehaviorOSEvent } from './event-types';

// ============================================================
// Event Replay — Rebuild state from event history
// ============================================================

export class EventReplay {
  /**
   * Replay all events for an aggregate and rebuild state.
   */
  replayAggregate(eventStore: EventStore, aggregateId: string): unknown {
    const events = eventStore.getEvents(aggregateId);
    if (events.length === 0) return null;

    let state: Record<string, unknown> = {};
    for (const event of events) {
      state = { ...state, ...(event.payload as Record<string, unknown>) };
    }
    return state;
  }

  /**
   * Replay all events and rebuild all aggregates.
   */
  replayAll(eventStore: EventStore): Map<string, unknown> {
    const allEvents = eventStore.getAllEvents();
    const aggregateMap = new Map<string, BehaviorOSEvent[]>();

    for (const event of allEvents) {
      const existing = aggregateMap.get(event.aggregateId) ?? [];
      existing.push(event);
      aggregateMap.set(event.aggregateId, existing);
    }

    const results = new Map<string, unknown>();
    for (const [aggregateId, events] of aggregateMap) {
      let state: Record<string, unknown> = {};
      for (const event of events) {
        state = { ...state, ...(event.payload as Record<string, unknown>) };
      }
      results.set(aggregateId, state);
    }

    return results;
  }

  /**
   * Replay events through a projection reducer.
   */
  replayWithProjection<T>(
    events: BehaviorOSEvent[],
    reducer: (state: T, event: BehaviorOSEvent) => T,
    initialState: T,
  ): T {
    let state = initialState;
    for (const event of events) {
      state = reducer(state, event);
    }
    return state;
  }
}
