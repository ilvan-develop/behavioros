import { describe, expect, it } from 'vitest';
import { CommandBus } from '../mesh/command-bus';
import { QueryBus } from '../mesh/query-bus';
import { StreamBus } from '../mesh/stream-bus';

describe('CommandBus edge cases', () => {
  it('propagates handler exception', async () => {
    const bus = new CommandBus();
    bus.registerHandler('fail', () => {
      throw new Error('handler failure');
    });
    await expect(bus.send({ type: 'fail', payload: {}, metadata: {} })).rejects.toThrow(
      'handler failure',
    );
  });

  it('unsubscribe of non-existent handler does not throw', () => {
    const bus = new CommandBus();
    expect(() => bus.unsubscribe('non-existent')).not.toThrow();
  });

  it('hasProcessed returns false for unknown key', () => {
    const bus = new CommandBus();
    expect(bus.hasProcessed('unknown-key')).toBe(false);
  });

  it('hasProcessed returns true after idempotent send', async () => {
    const bus = new CommandBus();
    bus.registerHandler('test', () => {});
    await bus.send({ type: 'test', payload: {}, metadata: { idempotencyKey: 'k1' } });
    expect(bus.hasProcessed('k1')).toBe(true);
  });

  it('passes priority metadata through to handler', async () => {
    const bus = new CommandBus();
    let receivedMeta: Record<string, unknown> | undefined;
    bus.registerHandler('order', (msg) => {
      receivedMeta = msg.metadata;
    });
    await bus.send({
      type: 'order',
      payload: {},
      metadata: { priority: 'high', idempotencyKey: 'ord-1' },
    });
    expect(receivedMeta).toEqual({ priority: 'high', idempotencyKey: 'ord-1' });
  });
});

describe('QueryBus edge cases', () => {
  it('send throws if no handler registered', async () => {
    const bus = new QueryBus();
    await expect(bus.send({ type: 'missing', payload: {}, metadata: {} })).rejects.toThrow(
      'No handler registered for query type: missing',
    );
  });

  it('propagates handler exception via send', async () => {
    const bus = new QueryBus();
    bus.registerHandler('boom', () => {
      throw new Error('handler error');
    });
    await expect(bus.send({ type: 'boom', payload: {}, metadata: {} })).rejects.toThrow(
      'handler error',
    );
  });

  it('propagates handler exception via query', async () => {
    const bus = new QueryBus();
    bus.registerHandler('boom', () => {
      throw new Error('handler error');
    });
    await expect(bus.query({ type: 'boom', payload: {}, metadata: {} })).rejects.toThrow(
      'handler error',
    );
  });

  it('returns undefined for unknown result id', () => {
    const bus = new QueryBus();
    expect(bus.getResult('no-such-id')).toBeUndefined();
  });

  it('stores and retrieves empty result (undefined)', async () => {
    const bus = new QueryBus();
    bus.registerHandler('empty', () => undefined);
    const id = await bus.send({ type: 'empty', payload: {}, metadata: {} });
    expect(bus.getResult(id)).toBeUndefined();
  });

  it('stores and retrieves null result', async () => {
    const bus = new QueryBus();
    bus.registerHandler('null-result', () => null);
    const id = await bus.send({ type: 'null-result', payload: {}, metadata: {} });
    expect(bus.getResult(id)).toBeNull();
  });

  it('stores and retrieves empty array result', async () => {
    const bus = new QueryBus();
    bus.registerHandler('list', () => []);
    const id = await bus.send({ type: 'list', payload: {}, metadata: {} });
    expect(bus.getResult(id)).toEqual([]);
  });

  it('unsubscribe of non-existent handler does not throw', () => {
    const bus = new QueryBus();
    expect(() => bus.unsubscribe('non-existent')).not.toThrow();
  });

  it('multiple queries each store independent results', async () => {
    const bus = new QueryBus();
    bus.registerHandler('a', () => 'result-a');
    bus.registerHandler('b', () => 'result-b');

    const idA = await bus.send({ type: 'a', payload: {}, metadata: {} });
    const idB = await bus.send({ type: 'b', payload: {}, metadata: {} });

    expect(bus.getResult(idA)).toBe('result-a');
    expect(bus.getResult(idB)).toBe('result-b');
  });
});

describe('StreamBus edge cases', () => {
  it('subscriber error propagates and prevents other subscribers from receiving', async () => {
    const bus = new StreamBus();
    const received: unknown[] = [];

    bus.subscribe(() => {
      throw new Error('subscriber failed');
    });
    bus.subscribe((msg) => {
      received.push(msg.payload);
    });

    await expect(
      bus.send({ type: 'event', payload: 'data', metadata: { partition: 'test' } }),
    ).rejects.toThrow('subscriber failed');
    expect(received).toEqual([]);
  });

  it('unsubscribe of non-existent subscriber does not throw', () => {
    const bus = new StreamBus();
    expect(() => bus.unsubscribe('non-existent')).not.toThrow();
  });

  it('multiple subscribers both receive messages (sync delivery only)', async () => {
    const bus = new StreamBus();
    const received: string[] = [];

    bus.subscribe((msg) => {
      received.push(`first:${msg.payload}`);
    });
    bus.subscribe((msg) => {
      received.push(`second:${msg.payload}`);
    });

    await bus.send({ type: 'event', payload: 'a', metadata: { partition: 'multi' } });

    expect(received).toEqual(['first:a', 'second:a']);
  });

  it('createConsumerGroup on existing group adds member', () => {
    const bus = new StreamBus();
    const id1 = bus.createConsumerGroup('workers', () => {});
    const id2 = bus.createConsumerGroup('workers', () => {});
    expect(id1).not.toBe(id2);
  });

  it('subscribe with filter only delivers matching messages', async () => {
    const bus = new StreamBus();
    const received: unknown[] = [];

    bus.subscribe(
      (msg) => {
        received.push(msg.payload);
      },
      (msg) => msg.type === 'important',
    );

    await bus.send({ type: 'normal', payload: 'skip', metadata: { partition: 'filter' } });
    await bus.send({ type: 'important', payload: 'keep', metadata: { partition: 'filter' } });

    expect(received).toEqual(['keep']);
  });

  it('replay on non-existent stream returns empty array', () => {
    const bus = new StreamBus();
    expect(bus.replay('no-such', 0)).toEqual([]);
  });

  it('getStream returns copy of stream messages', async () => {
    const bus = new StreamBus();
    await bus.send({ type: 'a', payload: 1, metadata: { partition: 'log' } });

    const direct = bus.getStream('log');
    direct.push({} as never);
    expect(bus.getStream('log')).toHaveLength(1);
  });
});
