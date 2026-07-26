import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventStore } from '../event-store';
import type { BehaviorOSEvent } from '../event-types';

// ============================================================
// EventStore Tests
// ============================================================

function createTestEvent(overrides: Partial<BehaviorOSEvent> = {}): BehaviorOSEvent {
  return {
    id: crypto.randomUUID(),
    type: 'mission.created',
    aggregateId: 'mission-001',
    aggregateType: 'mission',
    timestamp: new Date().toISOString(),
    version: 1,
    metadata: { correlationId: 'corr-001' },
    payload: { title: 'Test Mission', type: 'feature' },
    ...overrides,
  };
}

const TEMP_DIR = join(process.cwd(), '.test-event-store');

describe('EventStore', () => {
  beforeEach(() => {
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      const fs = require('node:fs');
      const files = fs.readdirSync(TEMP_DIR);
      for (const file of files) {
        fs.unlinkSync(join(TEMP_DIR, file));
      }
      fs.rmdirSync(TEMP_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('append', () => {
    it('appends an event to the store', () => {
      const store = new EventStore();
      const event = createTestEvent();

      store.append(event);

      expect(store.getAllEvents()).toHaveLength(1);
      expect(store.getAllEvents()[0].id).toBe(event.id);
    });

    it('appends multiple events in order', () => {
      const store = new EventStore();
      const e1 = createTestEvent({ id: 'e1' });
      const e2 = createTestEvent({ id: 'e2' });
      const e3 = createTestEvent({ id: 'e3' });

      store.append(e1);
      store.append(e2);
      store.append(e3);

      const all = store.getAllEvents();
      expect(all).toHaveLength(3);
      expect(all[0].id).toBe('e1');
      expect(all[1].id).toBe('e2');
      expect(all[2].id).toBe('e3');
    });

    it('trims events when maxEvents exceeded', () => {
      const store = new EventStore({ maxEvents: 3 });

      store.append(createTestEvent({ id: 'e1' }));
      store.append(createTestEvent({ id: 'e2' }));
      store.append(createTestEvent({ id: 'e3' }));
      store.append(createTestEvent({ id: 'e4' }));

      const all = store.getAllEvents();
      expect(all).toHaveLength(3);
      expect(all[0].id).toBe('e2');
      expect(all[1].id).toBe('e3');
      expect(all[2].id).toBe('e4');
    });
  });

  describe('getEvents', () => {
    it('returns events filtered by aggregate ID', () => {
      const store = new EventStore();

      store.append(createTestEvent({ aggregateId: 'mission-1' }));
      store.append(createTestEvent({ aggregateId: 'mission-2' }));
      store.append(createTestEvent({ aggregateId: 'mission-1' }));

      const events = store.getEvents('mission-1');
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.aggregateId === 'mission-1')).toBe(true);
    });

    it('returns empty array for non-existent aggregate', () => {
      const store = new EventStore();
      store.append(createTestEvent({ aggregateId: 'mission-1' }));

      const events = store.getEvents('non-existent');
      expect(events).toHaveLength(0);
    });
  });

  describe('getEventsByType', () => {
    it('returns events filtered by type', () => {
      const store = new EventStore();

      store.append(createTestEvent({ type: 'mission.created' }));
      store.append(createTestEvent({ type: 'mission.started' }));
      store.append(createTestEvent({ type: 'mission.created' }));

      const events = store.getEventsByType('mission.created');
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.type === 'mission.created')).toBe(true);
    });
  });

  describe('getEventsAfter', () => {
    it('returns events after a given timestamp', () => {
      const store = new EventStore();

      store.append(createTestEvent({ timestamp: '2026-01-01T00:00:00.000Z' }));
      store.append(createTestEvent({ timestamp: '2026-06-01T00:00:00.000Z' }));
      store.append(createTestEvent({ timestamp: '2026-12-01T00:00:00.000Z' }));

      const events = store.getEventsAfter('2026-06-01T00:00:00.000Z');
      expect(events).toHaveLength(1);
      expect(events[0].timestamp).toBe('2026-12-01T00:00:00.000Z');
    });
  });

  describe('getAllEvents', () => {
    it('returns empty array when store is empty', () => {
      const store = new EventStore();
      expect(store.getAllEvents()).toHaveLength(0);
    });

    it('returns a copy, not the internal array', () => {
      const store = new EventStore();
      store.append(createTestEvent());

      const all = store.getAllEvents();
      all.push(createTestEvent());

      expect(store.getAllEvents()).toHaveLength(1);
    });
  });

  describe('snapshots', () => {
    it('creates a snapshot', () => {
      const store = new EventStore();
      const snapshot = store.createSnapshot('mission-1', { status: 'completed' });

      expect(snapshot.aggregateId).toBe('mission-1');
      expect(snapshot.state).toEqual({ status: 'completed' });
      expect(snapshot.version).toBe(0);
    });

    it('gets the latest snapshot', () => {
      const store = new EventStore();

      store.createSnapshot('mission-1', { status: 'draft' });
      store.createSnapshot('mission-1', { status: 'completed' });

      const latest = store.getLatestSnapshot('mission-1');
      expect(latest?.state).toEqual({ status: 'completed' });
    });

    it('returns null for non-existent aggregate snapshot', () => {
      const store = new EventStore();
      expect(store.getLatestSnapshot('non-existent')).toBeNull();
    });

    it('gets all snapshots for an aggregate', () => {
      const store = new EventStore();

      store.createSnapshot('mission-1', { step: 1 });
      store.createSnapshot('mission-1', { step: 2 });
      store.createSnapshot('mission-2', { step: 1 });

      const snapshots = store.getSnapshots('mission-1');
      expect(snapshots).toHaveLength(2);
    });

    it('resolves aggregateType from existing events', () => {
      const store = new EventStore();
      store.append(createTestEvent({ aggregateId: 'a1', aggregateType: 'pipeline' }));

      const snapshot = store.createSnapshot('a1', {});
      expect(snapshot.aggregateType).toBe('pipeline');
    });

    it('defaults aggregateType to unknown when no events exist', () => {
      const store = new EventStore();
      const snapshot = store.createSnapshot('new-agg', {});
      expect(snapshot.aggregateType).toBe('unknown');
    });
  });

  describe('replay', () => {
    it('replays events for an aggregate and merges payloads', () => {
      const store = new EventStore();

      store.append(
        createTestEvent({
          aggregateId: 'm1',
          payload: { title: 'Mission A', status: 'draft' },
        }),
      );
      store.append(
        createTestEvent({
          aggregateId: 'm1',
          payload: { status: 'executing' },
        }),
      );

      const state = store.replay('m1');
      expect(state).toEqual({ title: 'Mission A', status: 'executing' });
    });

    it('returns null for non-existent aggregate', () => {
      const store = new EventStore();
      expect(store.replay('non-existent')).toBeNull();
    });
  });

  describe('replayFrom', () => {
    it('returns events after the given timestamp', () => {
      const store = new EventStore();

      store.append(createTestEvent({ timestamp: '2026-01-01T00:00:00.000Z' }));
      store.append(createTestEvent({ timestamp: '2026-07-01T00:00:00.000Z' }));

      const events = store.replayFrom('2026-06-01T00:00:00.000Z');
      expect(events).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('returns correct stats', () => {
      const store = new EventStore();

      store.append(createTestEvent({ aggregateId: 'a1' }));
      store.append(createTestEvent({ aggregateId: 'a2' }));
      store.append(createTestEvent({ aggregateId: 'a1' }));
      store.createSnapshot('a1', {});

      const stats = store.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.totalSnapshots).toBe(1);
      expect(stats.aggregates).toContain('a1');
      expect(stats.aggregates).toContain('a2');
    });

    it('returns zeros for empty store', () => {
      const store = new EventStore();
      const stats = store.getStats();

      expect(stats.totalEvents).toBe(0);
      expect(stats.totalSnapshots).toBe(0);
      expect(stats.aggregates).toHaveLength(0);
    });
  });

  describe('persistence', () => {
    it('persists and loads events from disk', () => {
      const persistPath = join(TEMP_DIR, 'events.json');
      const store1 = new EventStore({ persistPath });

      store1.append(createTestEvent({ id: 'e1', payload: { data: 'test' } }));
      store1.append(createTestEvent({ id: 'e2', payload: { data: 'test2' } }));

      const store2 = new EventStore({ persistPath });
      expect(store2.getAllEvents()).toHaveLength(2);
      expect(store2.getAllEvents()[0].id).toBe('e1');
    });

    it('persists and loads snapshots from disk', () => {
      const persistPath = join(TEMP_DIR, 'events-snap.json');
      const store1 = new EventStore({ persistPath });

      store1.append(createTestEvent({ aggregateId: 'a1' }));
      store1.createSnapshot('a1', { snapshot: true });

      const store2 = new EventStore({ persistPath });
      expect(store2.getLatestSnapshot('a1')?.state).toEqual({ snapshot: true });
    });

    it('handles missing persistence file gracefully', () => {
      const store = new EventStore({
        persistPath: join(TEMP_DIR, 'non-existent-dir', 'events.json'),
      });

      expect(store.getAllEvents()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty store queries', () => {
      const store = new EventStore();

      expect(store.getEvents('any')).toHaveLength(0);
      expect(store.getEventsByType('any')).toHaveLength(0);
      expect(store.getEventsAfter('2026-01-01T00:00:00.000Z')).toHaveLength(0);
      expect(store.replay('any')).toBeNull();
      expect(store.replayFrom('2026-01-01T00:00:00.000Z')).toHaveLength(0);
    });

    it('handles events with empty metadata', () => {
      const store = new EventStore();
      const event = createTestEvent({ metadata: {} });

      store.append(event);
      expect(store.getAllEvents()[0].metadata).toEqual({});
    });

    it('handles events with null payload', () => {
      const store = new EventStore();
      const event = createTestEvent({ payload: null });

      store.append(event);
      const state = store.replay(event.aggregateId);
      expect(state).toEqual({});
    });
  });
});
