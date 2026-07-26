import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandHandler, EventHandler, QueryHandler } from '../cqrs/handlers';
import type { AntiCorruptionLayer } from '../domain/anti-corruption/acl.interface';
import type { Boundary, BoundaryType } from '../domain/boundaries/boundary.interface';
import { EventStore } from '../events/event-store';
import type { BehaviorOSEvent } from '../events/event-types';
import * as eventsMod from '../events/index';
import * as meshMod from '../mesh/index';
import { shouldSkipForConversational } from '../pipeline/mode/conversational.adapter';
import { shouldSkipForTransactional } from '../pipeline/mode/transactional.adapter';

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

const TEMP_DIR = join(process.cwd(), '.test-plumbing-100');

// ============================================================
// CQRS — Handlers
// ============================================================

describe('cqrs/handlers', () => {
  it('CommandHandler should have commandType and handle', () => {
    const handler: CommandHandler = {
      commandType: 'test.command',
      async handle() {},
    };
    expect(handler.commandType).toBe('test.command');
    expect(typeof handler.handle).toBe('function');
  });

  it('QueryHandler should have queryType and handle', () => {
    const handler: QueryHandler = {
      queryType: 'test.query',
      async handle() {
        return { data: [{ id: 'test' }], total: 1, offset: 0, limit: 10 };
      },
    };
    expect(handler.queryType).toBe('test.query');
    expect(typeof handler.handle).toBe('function');
  });

  it('EventHandler should have eventType and handle', () => {
    const handler: EventHandler = {
      eventType: 'test.event',
      async handle() {},
    };
    expect(handler.eventType).toBe('test.event');
    expect(typeof handler.handle).toBe('function');
  });

  it('should handle a command without error', async () => {
    const handler: CommandHandler = {
      commandType: 'test.command',
      async handle() {},
    };
    await expect(handler.handle({} as any)).resolves.toBeUndefined();
  });

  it('should handle a query and return QueryResult', async () => {
    const handler: QueryHandler = {
      queryType: 'test.query',
      async handle() {
        return { data: [{ result: 42 }], total: 1, offset: 0, limit: 10 };
      },
    };
    const result = await handler.handle({} as any);
    expect(result.data).toEqual([{ result: 42 }]);
    expect(result.total).toBe(1);
  });

  it('should handle an event without error', async () => {
    const handler: EventHandler = {
      eventType: 'test.event',
      async handle() {},
    };
    await expect(handler.handle({} as any)).resolves.toBeUndefined();
  });

  it('should return empty data from QueryHandler when null', async () => {
    const handler: QueryHandler = {
      queryType: 'test.query',
      async handle() {
        return { data: [], total: 0, offset: 0, limit: 10 };
      },
    };
    const result = await handler.handle({} as any);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should reject command handler on error', async () => {
    const handler: CommandHandler = {
      commandType: 'failing.command',
      async handle() {
        throw new Error('command failed');
      },
    };
    await expect(handler.handle({} as any)).rejects.toThrow('command failed');
  });

  it('should reject query handler on error', async () => {
    const handler: QueryHandler = {
      queryType: 'failing.query',
      async handle() {
        throw new Error('query failed');
      },
    };
    await expect(handler.handle({} as any)).rejects.toThrow('query failed');
  });

  it('should reject event handler on error', async () => {
    const handler: EventHandler = {
      eventType: 'failing.event',
      async handle() {
        throw new Error('event failed');
      },
    };
    await expect(handler.handle({} as any)).rejects.toThrow('event failed');
  });
});

// ============================================================
// Pipeline — Transactional Mode Adapter
// ============================================================

describe('pipeline/mode/transactional.adapter', () => {
  it('should not skip any layer', () => {
    expect(shouldSkipForTransactional).toBeDefined();
    expect(shouldSkipForTransactional('domain-invariants')).toBe(false);
    expect(shouldSkipForTransactional('decision')).toBe(false);
    expect(shouldSkipForTransactional('audit')).toBe(false);
    expect(shouldSkipForTransactional('any-layer')).toBe(false);
  });
});

// ============================================================
// Pipeline — Conversational Mode Adapter
// ============================================================

describe('pipeline/mode/conversational.adapter', () => {
  it('should skip domain-invariants and decision layers', () => {
    expect(shouldSkipForConversational).toBeDefined();
    expect(shouldSkipForConversational('domain-invariants')).toBe(true);
    expect(shouldSkipForConversational('decision')).toBe(true);
  });

  it('should not skip other layers', () => {
    expect(shouldSkipForConversational('dna')).toBe(false);
    expect(shouldSkipForConversational('schema')).toBe(false);
    expect(shouldSkipForConversational('governance')).toBe(false);
    expect(shouldSkipForConversational('quality')).toBe(false);
  });
});

// ============================================================
// Mesh — Barrel Smoke Test
// ============================================================

describe('mesh/index', () => {
  it('should export modules', () => {
    expect(Object.keys(meshMod).length).toBeGreaterThan(0);
  });

  it('should export all bus types and implementations', () => {
    expect(meshMod.CommandBus).toBeDefined();
    expect(meshMod.EventBus).toBeDefined();
    expect(meshMod.MeshHub).toBeDefined();
    expect(meshMod.NotificationBus).toBeDefined();
    expect(meshMod.QueryBus).toBeDefined();
    expect(meshMod.StreamBus).toBeDefined();
  });
});

// ============================================================
// Events — Barrel Smoke Test
// ============================================================

describe('events/index', () => {
  it('should export modules', () => {
    expect(Object.keys(eventsMod).length).toBeGreaterThan(0);
  });

  it('should export EventBridge, EventReplay, EventStore', () => {
    expect(eventsMod.EventBridge).toBeDefined();
    expect(eventsMod.EventReplay).toBeDefined();
    expect(eventsMod.EventStore).toBeDefined();
  });

  it('should export createEvent', () => {
    expect(eventsMod.createEvent).toBeDefined();
    expect(typeof eventsMod.createEvent).toBe('function');
  });
});

// ============================================================
// EventStore — Completing Coverage Gaps
// ============================================================

describe('EventStore — coverage gaps', () => {
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
        try {
          fs.unlinkSync(join(TEMP_DIR, file));
        } catch {}
      }
      try {
        fs.rmdirSync(TEMP_DIR);
      } catch {}
    } catch {}
  });

  it('should not persist when persistPath is null (append path)', () => {
    const store = new EventStore();
    const event = createTestEvent();
    store.append(event);
    expect(store.getAllEvents()).toHaveLength(1);
  });

  it('should handle corrupt JSON on load', () => {
    const persistPath = join(TEMP_DIR, 'corrupt.json');
    writeFileSync(persistPath, 'not valid json{{{', 'utf-8');
    const store = new EventStore({ persistPath });
    expect(store.getAllEvents()).toHaveLength(0);
  });

  it('should handle empty JSON object on load', () => {
    const persistPath = join(TEMP_DIR, 'empty-obj.json');
    writeFileSync(persistPath, '{}', 'utf-8');
    const store = new EventStore({ persistPath });
    expect(store.getAllEvents()).toHaveLength(0);
    expect(store.getLatestSnapshot('any')).toBeNull();
  });

  it('should handle load with events but no snapshots', () => {
    const persistPath = join(TEMP_DIR, 'events-only.json');
    const store1 = new EventStore({ persistPath });
    store1.append(createTestEvent({ id: 'load-e1' }));
    store1.append(createTestEvent({ id: 'load-e2' }));

    const store2 = new EventStore({ persistPath });
    expect(store2.getAllEvents()).toHaveLength(2);
    expect(store2.getStats().totalSnapshots).toBe(0);
  });

  it('should handle constructor with persistPath creating directory', () => {
    const deepPath = join(TEMP_DIR, 'a', 'b', 'c', 'deep-store.json');
    const _store = new EventStore({ persistPath: deepPath });
    expect(existsSync(join(TEMP_DIR, 'a', 'b', 'c'))).toBe(true);
  });

  it('should create snapshot with correct version based on events count', () => {
    const store = new EventStore();
    store.append(createTestEvent({ aggregateId: 'agg-ver' }));
    store.append(createTestEvent({ aggregateId: 'agg-ver' }));
    store.append(createTestEvent({ aggregateId: 'agg-ver' }));

    const snapshot = store.createSnapshot('agg-ver', { status: 'done' });
    expect(snapshot.version).toBe(3);
  });

  it('should persist snapshot to disk when persistPath is set', () => {
    const persistPath = join(TEMP_DIR, 'snap-persist.json');
    const store1 = new EventStore({ persistPath });
    store1.append(createTestEvent({ aggregateId: 'sa1' }));
    store1.createSnapshot('sa1', { saved: true });

    const raw = JSON.parse(readFileSync(persistPath, 'utf-8'));
    expect(raw.snapshots).toHaveLength(1);
    expect(raw.snapshots[0].state).toEqual({ saved: true });
  });

  it('should persist events to disk when persistPath is set', () => {
    const persistPath = join(TEMP_DIR, 'evt-persist.json');
    const store1 = new EventStore({ persistPath });
    store1.append(createTestEvent({ id: 'disk-e1' }));

    const raw = JSON.parse(readFileSync(persistPath, 'utf-8'));
    expect(raw.events).toHaveLength(1);
    expect(raw.events[0].id).toBe('disk-e1');
  });

  it('should load from previously persisted data with events and snapshots', () => {
    const persistPath = join(TEMP_DIR, 'full-load.json');

    writeFileSync(
      persistPath,
      JSON.stringify({
        events: [createTestEvent({ id: 'existing', aggregateId: 'agg1' })],
        snapshots: [
          {
            aggregateId: 'agg1',
            aggregateType: 'mission',
            state: { x: 1 },
            version: 1,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      'utf-8',
    );

    const store = new EventStore({ persistPath });
    expect(store.getAllEvents()).toHaveLength(1);
    expect(store.getLatestSnapshot('agg1')?.state).toEqual({ x: 1 });
  });

  it('should handle replayFrom correctly with no events after timestamp', () => {
    const store = new EventStore();
    store.append(createTestEvent({ timestamp: '2026-01-01T00:00:00.000Z' }));
    const result = store.replayFrom('2026-12-31T00:00:00.000Z');
    expect(result).toHaveLength(0);
  });

  it('should handle getSnapshots for non-existent aggregate', () => {
    const store = new EventStore();
    const result = store.getSnapshots('no-snapshots-here');
    expect(result).toHaveLength(0);
  });

  it('should handle getStats with aggregates deduplicated', () => {
    const store = new EventStore();
    store.append(createTestEvent({ aggregateId: 'x' }));
    store.append(createTestEvent({ aggregateId: 'x' }));
    store.append(createTestEvent({ aggregateId: 'y' }));
    const stats = store.getStats();
    expect(stats.aggregates).toHaveLength(2);
    expect(stats.aggregates).toEqual(expect.arrayContaining(['x', 'y']));
  });
});

// ============================================================
// Domain — Anti-Corruption Layer Interface
// ============================================================

describe('domain/anti-corruption/acl.interface', () => {
  it('should create a valid AntiCorruptionLayer implementation', () => {
    const acl: AntiCorruptionLayer = {
      id: 'test-acl',
      name: 'Test ACL',
      validateInput() {
        return { passed: true };
      },
      transformInput(input) {
        return { ...input, transformed: true };
      },
      validateOutput() {
        return { passed: false, reason: 'blocked' };
      },
      transformOutput(output) {
        return { ...output, sanitized: true };
      },
    };
    expect(acl.id).toBe('test-acl');
    expect(acl.validateInput({}).passed).toBe(true);
    expect(acl.transformInput({}).transformed).toBe(true);
    expect(acl.validateOutput({}).passed).toBe(false);
    expect(acl.validateOutput({}).reason).toBe('blocked');
    expect(acl.transformOutput({}).sanitized).toBe(true);
  });
});

// ============================================================
// Domain — Boundary Interface
// ============================================================

describe('domain/boundaries/boundary.interface', () => {
  it('should create a valid Boundary implementation', () => {
    const boundary: Boundary = {
      id: 'test-boundary',
      name: 'Test Boundary',
      type: 'dna',
      validate() {
        return { passed: true };
      },
    };
    expect(boundary.id).toBe('test-boundary');
    expect(boundary.type).toBe('dna');
    expect(boundary.validate({}).passed).toBe(true);
  });

  it('should support all BoundaryType values', () => {
    const types: BoundaryType[] = ['dna', 'agent', 'execution'];
    types.forEach((t) => {
      const b: Boundary = {
        id: t,
        name: t,
        type: t,
        validate() {
          return { passed: t === 'dna' };
        },
      };
      expect(b.type).toBe(t);
    });
  });

  it('should return failed boundary result with reason', () => {
    const boundary: Boundary = {
      id: 'fail-boundary',
      name: 'Failing',
      type: 'execution',
      validate() {
        return { passed: false, reason: 'cross-boundary access denied' };
      },
    };
    const result = boundary.validate({});
    expect(result.passed).toBe(false);
    expect(result.reason).toBe('cross-boundary access denied');
  });
});
