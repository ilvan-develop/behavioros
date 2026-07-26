import { describe, expect, it } from 'vitest';
import type { CommandHandler, EventHandler, QueryHandler } from '../cqrs/handlers';
import type { Command, Event, Query } from '../cqrs/interfaces';
import { CommandRegistry, EventRegistry, QueryRegistry } from '../cqrs/registries';

const makeCommand = (overrides: Partial<Command> = {}): Command => ({
  type: 'test.command',
  payload: { value: 42 },
  metadata: { requestId: 'req-1' },
  timestamp: new Date().toISOString(),
  id: 'cmd-1',
  ...overrides,
});

const makeQuery = (overrides: Partial<Query> = {}): Query => ({
  type: 'test.query',
  filters: { status: 'active' },
  timestamp: new Date().toISOString(),
  id: 'qry-1',
  ...overrides,
});

const makeEvent = (overrides: Partial<Event> = {}): Event => ({
  id: 'evt-1',
  type: 'test.event',
  aggregateId: 'agg-1',
  aggregateType: 'test',
  timestamp: new Date().toISOString(),
  version: 1,
  metadata: {},
  payload: null,
  ...overrides,
});

describe('CommandRegistry', () => {
  it('should register and dispatch a command handler', async () => {
    const registry = new CommandRegistry();
    let handled: Command | undefined;

    const handler: CommandHandler = {
      commandType: 'test.command',
      async handle(cmd) {
        handled = cmd;
      },
    };

    registry.register(handler);
    const cmd = makeCommand();
    await registry.dispatch(cmd);

    expect(handled).toBeDefined();
    expect(handled!.type).toBe('test.command');
    expect(handled!.payload).toEqual({ value: 42 });
  });

  it('should throw when dispatching with no registered handler', async () => {
    const registry = new CommandRegistry();
    const cmd = makeCommand({ type: 'unknown.command' });

    await expect(registry.dispatch(cmd)).rejects.toThrow(
      'No command handler registered for type: unknown.command',
    );
  });

  it('should report handler existence correctly', () => {
    const registry = new CommandRegistry();
    expect(registry.hasHandler('test.command')).toBe(false);

    const handler: CommandHandler = {
      commandType: 'test.command',
      async handle() {},
    };
    registry.register(handler);
    expect(registry.hasHandler('test.command')).toBe(true);
  });

  it('should handle multiple command types independently', async () => {
    const registry = new CommandRegistry();
    const results: string[] = [];

    registry.register({
      commandType: 'cmd.a',
      async handle() {
        results.push('a');
      },
    });
    registry.register({
      commandType: 'cmd.b',
      async handle() {
        results.push('b');
      },
    });

    await registry.dispatch(makeCommand({ type: 'cmd.a', id: '1' }));
    await registry.dispatch(makeCommand({ type: 'cmd.b', id: '2' }));

    expect(results).toEqual(['a', 'b']);
  });

  it('should pass handler metadata in command', async () => {
    const registry = new CommandRegistry();
    let capturedMetadata: Record<string, unknown> | undefined;

    registry.register({
      commandType: 'test.command',
      async handle(cmd) {
        capturedMetadata = cmd.metadata;
      },
    });

    await registry.dispatch(makeCommand({ metadata: { requestId: 'req-42', source: 'test' } }));
    expect(capturedMetadata).toEqual({ requestId: 'req-42', source: 'test' });
  });
});

describe('QueryRegistry', () => {
  it('should register and dispatch a query handler', async () => {
    const registry = new QueryRegistry();
    const expectedResult = { data: [{ id: 1, name: 'Alice' }], total: 1, offset: 0, limit: 10 };

    const handler: QueryHandler = {
      queryType: 'test.query',
      async handle() {
        return expectedResult;
      },
    };

    registry.register(handler);
    const result = await registry.dispatch(makeQuery());

    expect(result).toEqual(expectedResult);
  });

  it('should throw when dispatching with no registered handler', async () => {
    const registry = new QueryRegistry();
    const query = makeQuery({ type: 'unknown.query' });

    await expect(registry.dispatch(query)).rejects.toThrow(
      'No query handler registered for type: unknown.query',
    );
  });

  it('should support query with pagination', async () => {
    const registry = new QueryRegistry();
    const allData = Array.from({ length: 50 }, (_, i) => ({ id: i, name: `Item ${i}` }));

    registry.register({
      queryType: 'test.query',
      async handle(query) {
        const offset = query.pagination?.offset ?? 0;
        const limit = query.pagination?.limit ?? 10;
        return {
          data: allData.slice(offset, offset + limit),
          total: allData.length,
          offset,
          limit,
        };
      },
    });

    const query = makeQuery({ pagination: { offset: 10, limit: 5 } });
    const result = await registry.dispatch(query);

    expect(result.total).toBe(50);
    expect(result.offset).toBe(10);
    expect(result.limit).toBe(5);
    expect(result.data).toHaveLength(5);
    expect((result.data[0] as { id: number }).id).toBe(10);
  });

  it('should pass filters through query handler', async () => {
    const registry = new QueryRegistry();
    let capturedFilters: Record<string, unknown> | undefined;

    registry.register({
      queryType: 'test.query',
      async handle(query) {
        capturedFilters = query.filters;
        return { data: [], total: 0, offset: 0, limit: 10 };
      },
    });

    await registry.dispatch(makeQuery({ filters: { status: 'active', role: 'admin' } }));
    expect(capturedFilters).toEqual({ status: 'active', role: 'admin' });
  });
});

describe('EventRegistry', () => {
  it('should register and dispatch an event handler', async () => {
    const registry = new EventRegistry();
    let handled: Event | undefined;

    const handler: EventHandler = {
      eventType: 'test.event',
      async handle(evt) {
        handled = evt;
      },
    };

    registry.register(handler);
    const event = makeEvent();
    const results = registry.dispatch(event);

    expect(results).toHaveLength(1);
    await Promise.all(results);
    expect(handled).toBeDefined();
    expect(handled!.id).toBe('evt-1');
  });

  it('should throw when dispatching with no registered handler', () => {
    const registry = new EventRegistry();
    const event = makeEvent({ type: 'unknown.event' });

    expect(() => registry.dispatch(event)).toThrow(
      'No event handlers registered for type: unknown.event',
    );
  });

  it('should dispatch to multiple handlers for the same event type', async () => {
    const registry = new EventRegistry();
    const results: string[] = [];

    registry.register({
      eventType: 'test.event',
      async handle() {
        results.push('handler-a');
      },
    });
    registry.register({
      eventType: 'test.event',
      async handle() {
        results.push('handler-b');
      },
    });
    registry.register({
      eventType: 'test.event',
      async handle() {
        results.push('handler-c');
      },
    });

    expect(registry.handlerCount('test.event')).toBe(3);

    const promises = registry.dispatch(makeEvent());
    await Promise.all(promises);

    expect(results).toContain('handler-a');
    expect(results).toContain('handler-b');
    expect(results).toContain('handler-c');
    expect(results).toHaveLength(3);
  });

  it('should only dispatch to handlers of the matching event type', async () => {
    const registry = new EventRegistry();
    const triggered: string[] = [];

    registry.register({
      eventType: 'event.type-a',
      async handle() {
        triggered.push('type-a');
      },
    });
    registry.register({
      eventType: 'event.type-b',
      async handle() {
        triggered.push('type-b');
      },
    });

    const promises = registry.dispatch(makeEvent({ type: 'event.type-a', id: 'evt-2' }));
    await Promise.all(promises);

    expect(triggered).toEqual(['type-a']);
  });

  it('should track handler count correctly', () => {
    const registry = new EventRegistry();
    expect(registry.handlerCount('test.event')).toBe(0);

    registry.register({ eventType: 'test.event', async handle() {} });
    expect(registry.handlerCount('test.event')).toBe(1);

    registry.register({ eventType: 'test.event', async handle() {} });
    expect(registry.handlerCount('test.event')).toBe(2);

    expect(registry.handlerCount('other.event')).toBe(0);
  });

  it('should verify handler existence', () => {
    const registry = new EventRegistry();
    expect(registry.hasHandler('test.event')).toBe(false);

    registry.register({ eventType: 'test.event', async handle() {} });
    expect(registry.hasHandler('test.event')).toBe(true);
  });
});
