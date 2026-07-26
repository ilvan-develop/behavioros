import { describe, expect, it } from 'vitest';
import { CommandBus } from '../mesh/command-bus';
import { EventBus } from '../mesh/event-bus';
import { MeshHub } from '../mesh/mesh-hub';
import { NotificationBus } from '../mesh/notification-bus';
import { QueryBus } from '../mesh/query-bus';
import { StreamBus } from '../mesh/stream-bus';

// ─── EventBus ─────────────────────────────────────────────

describe('EventBus', () => {
  it('sends a message and delivers to subscribers', async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.subscribe((msg) => {
      received.push(msg.payload);
    });

    const id = await bus.send({ type: 'test', payload: { hello: 'world' }, metadata: {} });
    expect(id).toBeDefined();
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ hello: 'world' });
  });

  it('subscribe returns an id that can be used to unsubscribe', async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    const subId = bus.subscribe((msg) => {
      received.push(msg.payload);
    });
    bus.unsubscribe(subId);

    await bus.send({ type: 'test', payload: 'data', metadata: {} });
    expect(received).toHaveLength(0);
  });

  it('supports filtering subscriptions', async () => {
    const bus = new EventBus();
    const received: unknown[] = [];

    bus.subscribe(
      (msg) => {
        received.push(msg.payload);
      },
      (msg) => msg.type === 'important',
    );

    await bus.send({ type: 'normal', payload: 'skip', metadata: {} });
    await bus.send({ type: 'important', payload: 'keep', metadata: {} });
    expect(received).toEqual(['keep']);
  });

  it('stores history for replay', async () => {
    const bus = new EventBus();
    await bus.send({ type: 'a', payload: 1, metadata: {} });
    await bus.send({ type: 'b', payload: 2, metadata: {} });

    const history = bus.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].payload).toBe(1);
    expect(history[1].payload).toBe(2);
  });

  it('replays from a given timestamp', async () => {
    const bus = new EventBus();
    await bus.send({ type: 'a', payload: 1, metadata: {} });
    const before = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 10));
    await bus.send({ type: 'b', payload: 2, metadata: {} });

    const after = bus.replayFrom(before);
    expect(after).toHaveLength(1);
    expect(after[0].payload).toBe(2);
  });
});

// ─── CommandBus ───────────────────────────────────────────

describe('CommandBus', () => {
  it('sends a command to the registered handler', async () => {
    const bus = new CommandBus();
    let handled: unknown = null;

    bus.registerHandler('create-order', (msg) => {
      handled = msg.payload;
    });

    await bus.send({ type: 'create-order', payload: { item: 'widget' }, metadata: {} });
    expect(handled).toEqual({ item: 'widget' });
  });

  it('throws if no handler is registered for the command type', async () => {
    const bus = new CommandBus();
    await expect(bus.send({ type: 'unknown', payload: {}, metadata: {} })).rejects.toThrow(
      'No handler registered for command type: unknown',
    );
  });

  it('enforces idempotency keys', async () => {
    const bus = new CommandBus();
    let count = 0;

    bus.registerHandler('create-order', () => {
      count++;
    });

    await bus.send({
      type: 'create-order',
      payload: {},
      metadata: { idempotencyKey: 'key-1' },
    });

    await expect(
      bus.send({
        type: 'create-order',
        payload: {},
        metadata: { idempotencyKey: 'key-1' },
      }),
    ).rejects.toThrow('Idempotency key already processed: key-1');

    expect(count).toBe(1);
  });

  it('validates commands before dispatch', async () => {
    const bus = new CommandBus();

    bus.registerHandler(
      'create-order',
      () => {},
      (msg) => msg.payload != null && typeof msg.payload === 'object',
    );

    await expect(bus.send({ type: 'create-order', payload: null, metadata: {} })).rejects.toThrow(
      'Command validation failed for type: create-order',
    );
  });

  it('subscribe throws not supported error', () => {
    const bus = new CommandBus();
    expect(() => bus.subscribe(() => {})).toThrow('CommandBus does not support subscribe');
  });
});

// ─── QueryBus ─────────────────────────────────────────────

describe('QueryBus', () => {
  it('executes a query and returns result via query()', async () => {
    const bus = new QueryBus();

    bus.registerHandler('get-user', (msg) => {
      return { id: msg.payload, name: 'Alice' };
    });

    const result = await bus.query<{ id: unknown; name: string }>({
      type: 'get-user',
      payload: 'user-1',
      metadata: {},
    });

    expect(result).toEqual({ id: 'user-1', name: 'Alice' });
  });

  it('send returns a message id and stores result', async () => {
    const bus = new QueryBus();

    bus.registerHandler('list-items', () => {
      return ['a', 'b'];
    });

    const id = await bus.send({ type: 'list-items', payload: {}, metadata: {} });
    expect(id).toBeDefined();
    expect(bus.getResult(id)).toEqual(['a', 'b']);
  });

  it('throws if no handler registered', async () => {
    const bus = new QueryBus();
    await expect(bus.query({ type: 'missing', payload: {}, metadata: {} })).rejects.toThrow(
      'No handler registered for query type: missing',
    );
  });

  it('subscribe throws not supported error', () => {
    const bus = new QueryBus();
    expect(() => bus.subscribe(() => {})).toThrow('QueryBus does not support subscribe');
  });
});

// ─── NotificationBus ──────────────────────────────────────

describe('NotificationBus', () => {
  it('broadcasts to all subscribers', async () => {
    const bus = new NotificationBus();
    const received: unknown[] = [];

    bus.subscribe((msg) => {
      received.push(msg.payload);
    });
    bus.subscribe((msg) => {
      received.push(msg.payload);
    });

    await bus.send({ type: 'alert', payload: 'fire', metadata: {} });
    expect(received).toHaveLength(2);
    expect(received).toEqual(['fire', 'fire']);
  });

  it('unsubscribe removes a subscriber', async () => {
    const bus = new NotificationBus();
    const received: unknown[] = [];

    const id = bus.subscribe((msg) => {
      received.push(msg.payload);
    });
    bus.subscribe((msg) => {
      received.push(msg.payload);
    });
    bus.unsubscribe(id);

    await bus.send({ type: 'alert', payload: 'data', metadata: {} });
    expect(received).toHaveLength(1);
  });

  it('handles subscriber errors gracefully (best-effort)', async () => {
    const bus = new NotificationBus();

    bus.subscribe(() => {
      throw new Error('oops');
    });

    await expect(bus.send({ type: 'alert', payload: 'ok', metadata: {} })).resolves.toBeDefined();
  });

  it('tracks subscriber count', () => {
    const bus = new NotificationBus();
    expect(bus.subscriberCount()).toBe(0);

    bus.subscribe(() => {});
    expect(bus.subscriberCount()).toBe(1);

    bus.subscribe(() => {});
    expect(bus.subscriberCount()).toBe(2);
  });
});

// ─── StreamBus ────────────────────────────────────────────

describe('StreamBus', () => {
  it('sends messages to an ordered stream', async () => {
    const bus = new StreamBus();

    await bus.send({ type: 'event', payload: 1, metadata: { partition: 'orders' } });
    await bus.send({ type: 'event', payload: 2, metadata: { partition: 'orders' } });

    const stream = bus.getStream('orders');
    expect(stream).toHaveLength(2);
    expect(stream[0].payload).toBe(1);
    expect(stream[1].payload).toBe(2);
  });

  it('supports consumer groups with competing consumers', async () => {
    const bus = new StreamBus();
    const received: unknown[] = [];

    bus.createConsumerGroup('workers', (msg) => {
      received.push(msg.payload);
    });

    await bus.send({ type: 'task', payload: 'a', metadata: { partition: 'jobs' } });
    await bus.send({ type: 'task', payload: 'b', metadata: { partition: 'jobs' } });

    expect(received).toHaveLength(2);
  });

  it('replays stream from any point', async () => {
    const bus = new StreamBus();

    await bus.send({ type: 'event', payload: 'a', metadata: { partition: 'log' } });
    await bus.send({ type: 'event', payload: 'b', metadata: { partition: 'log' } });
    await bus.send({ type: 'event', payload: 'c', metadata: { partition: 'log' } });

    const tail = bus.replay('log', 1);
    expect(tail).toHaveLength(2);
    expect(tail[0].payload).toBe('b');
    expect(tail[1].payload).toBe('c');
  });

  it('lists all streams', async () => {
    const bus = new StreamBus();

    await bus.send({ type: 'a', payload: {}, metadata: { partition: 'stream-a' } });
    await bus.send({ type: 'b', payload: {}, metadata: { partition: 'stream-b' } });

    const streams = bus.getStreams();
    expect(streams).toContain('stream-a');
    expect(streams).toContain('stream-b');
  });
});

// ─── MeshHub ──────────────────────────────────────────────

describe('MeshHub', () => {
  it('provides access to all 5 buses', () => {
    const hub = new MeshHub();

    expect(hub.event).toBeInstanceOf(EventBus);
    expect(hub.command).toBeInstanceOf(CommandBus);
    expect(hub.query).toBeInstanceOf(QueryBus);
    expect(hub.notification).toBeInstanceOf(NotificationBus);
    expect(hub.stream).toBeInstanceOf(StreamBus);
  });

  it('getBus returns the correct bus by name', () => {
    const hub = new MeshHub();

    expect(hub.getBus('event')).toBe(hub.event);
    expect(hub.getBus('command')).toBe(hub.command);
    expect(hub.getBus('query')).toBe(hub.query);
    expect(hub.getBus('notification')).toBe(hub.notification);
    expect(hub.getBus('stream')).toBe(hub.stream);
  });

  it('getBus throws for unknown bus name', () => {
    const hub = new MeshHub();
    expect(() => hub.getBus('unknown')).toThrow('Unknown bus: unknown');
  });

  it('allBuses returns all 5 buses', () => {
    const hub = new MeshHub();
    const buses = hub.allBuses();

    expect(buses).toHaveLength(5);
    expect(buses.map((b) => b.name)).toEqual([
      'event',
      'command',
      'query',
      'notification',
      'stream',
    ]);
  });

  it('reset creates fresh bus instances', async () => {
    const hub = new MeshHub();

    await hub.event.send({ type: 'test', payload: 1, metadata: {} });
    expect(hub.event.getHistory()).toHaveLength(1);

    hub.reset();

    expect(hub.event.getHistory()).toHaveLength(0);
    expect((hub.getBus('event') as EventBus).getHistory()).toHaveLength(0);
  });
});
