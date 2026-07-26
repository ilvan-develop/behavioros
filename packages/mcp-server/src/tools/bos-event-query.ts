import { EventStore } from '@behavioros/core';
import { z } from 'zod';

// ============================================================
// Event Query Tools — Query the Event Store
// ============================================================

const _eventStore = new EventStore({ maxEvents: 50_000, snapshotInterval: 100 });

export function getEventStore(): EventStore {
  return _eventStore;
}

// --- Input schemas ---

export const bosEventQueryInput = z.object({
  aggregateId: z.string().optional().describe('Filter by aggregate ID'),
  type: z.string().optional().describe('Filter by event type'),
  after: z.string().optional().describe('Filter events after this ISO timestamp'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe('Maximum number of events to return'),
});

export type BosEventQueryInput = z.infer<typeof bosEventQueryInput>;

export const bosEventStatsInput = z.object({});

export type BosEventStatsInput = z.infer<typeof bosEventStatsInput>;

export const bosEventReplayInput = z.object({
  aggregateId: z.string().min(1).describe('Aggregate ID to replay'),
});

export type BosEventReplayInput = z.infer<typeof bosEventReplayInput>;

// --- Tool handlers ---

export async function bosEventQuery(input: BosEventQueryInput) {
  let events = _eventStore.getAllEvents();

  if (input.aggregateId) {
    events = events.filter((e) => e.aggregateId === input.aggregateId);
  }
  if (input.type) {
    events = events.filter((e) => e.type === input.type);
  }
  if (input.after) {
    const afterTs = input.after;
    events = events.filter((e) => e.timestamp > afterTs);
  }

  const limit = input.limit ?? 50;
  const sliced = events.slice(-limit);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: events.length,
            returned: sliced.length,
            events: sliced,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function bosEventStats() {
  const stats = _eventStore.getStats();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
}

export async function bosEventReplay(input: BosEventReplayInput) {
  const state = _eventStore.replay(input.aggregateId);
  const events = _eventStore.getEvents(input.aggregateId);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            aggregateId: input.aggregateId,
            eventCount: events.length,
            rebuiltState: state,
          },
          null,
          2,
        ),
      },
    ],
  };
}
