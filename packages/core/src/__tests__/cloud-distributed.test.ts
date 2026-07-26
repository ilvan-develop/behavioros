import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributedEventBus } from '../engines/cloud/distributed-event-bus';
import { DistributedLock } from '../engines/cloud/distributed-lock';
import { DistributedMemory } from '../engines/cloud/distributed-memory';

// ============================================================
// DistributedLock Tests
// ============================================================

describe('DistributedLock', () => {
  let lock: DistributedLock;

  beforeEach(() => {
    vi.useFakeTimers();
    lock = new DistributedLock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should acquire a lock successfully', async () => {
    const result = await lock.acquire('lock-1', 'node-a');
    expect(result).toBe(true);
    expect(lock.isLocked('lock-1')).toBe(true);
  });

  it('should reject acquiring an already-held lock by another holder', async () => {
    await lock.acquire('lock-1', 'node-a');
    const result = await lock.acquire('lock-1', 'node-b');
    expect(result).toBe(false);
  });

  it('should allow reentrant acquisition by the same holder', async () => {
    await lock.acquire('lock-1', 'node-a');
    const result = await lock.acquire('lock-1', 'node-a');
    expect(result).toBe(true);
  });

  it('should release a lock', async () => {
    await lock.acquire('lock-1', 'node-a');
    const released = await lock.release('lock-1', 'node-a');
    expect(released).toBe(true);
    expect(lock.isLocked('lock-1')).toBe(false);
  });

  it('should not release a lock held by another holder', async () => {
    await lock.acquire('lock-1', 'node-a');
    const released = await lock.release('lock-1', 'node-b');
    expect(released).toBe(false);
    expect(lock.isLocked('lock-1')).toBe(true);
  });

  it('should decrement reentrant count on release', async () => {
    await lock.acquire('lock-1', 'node-a');
    await lock.acquire('lock-1', 'node-a');
    const lockInfo = lock.getLock('lock-1');
    expect(lockInfo?.reentrantCount).toBe(2);

    await lock.release('lock-1', 'node-a');
    const afterRelease = lock.getLock('lock-1');
    expect(afterRelease?.reentrantCount).toBe(1);
  });

  it('should expire a lock after TTL', async () => {
    await lock.acquire('lock-1', 'node-a', 100);
    expect(lock.isLocked('lock-1')).toBe(true);

    vi.advanceTimersByTime(101);
    expect(lock.isLocked('lock-1')).toBe(false);
  });

  it('should get locks by holder', async () => {
    await lock.acquire('lock-1', 'node-a');
    await lock.acquire('lock-2', 'node-a');
    await lock.acquire('lock-3', 'node-b');

    const nodeALocks = lock.getLocksByHolder('node-a');
    expect(nodeALocks).toHaveLength(2);
    expect(nodeALocks.map((l) => l.id).sort()).toEqual(
      expect.arrayContaining([expect.any(String), expect.any(String)]),
    );
  });

  it('should force release a lock', async () => {
    await lock.acquire('lock-1', 'node-a');
    lock.forceRelease('lock-1');
    expect(lock.isLocked('lock-1')).toBe(false);
  });

  it('should clean up expired locks', async () => {
    await lock.acquire('lock-1', 'node-a', 50);
    await lock.acquire('lock-2', 'node-b', 200);
    vi.advanceTimersByTime(100);

    const removed = lock.cleanup();
    expect(removed).toBe(1);
    expect(lock.isLocked('lock-1')).toBe(false);
    expect(lock.isLocked('lock-2')).toBe(true);
  });

  it('should check isHeldByMe', async () => {
    await lock.acquire('lock-1', 'node-a');
    expect(lock.isHeldByMe('lock-1', 'node-a')).toBe(true);
    expect(lock.isHeldByMe('lock-1', 'node-b')).toBe(false);
  });

  it('should return undefined for non-existent lock via getLock', () => {
    expect(lock.getLock('non-existent')).toBeUndefined();
  });
});

// ============================================================
// DistributedEventBus Tests
// ============================================================

describe('DistributedEventBus', () => {
  let bus: DistributedEventBus;

  beforeEach(() => {
    bus = new DistributedEventBus();
  });

  it('should publish an event and notify subscribers', () => {
    const handler = vi.fn();
    bus.subscribe('orders', 'node-a', handler);

    bus.publish({ topic: 'orders', payload: { orderId: 1 }, source: 'node-b' });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0];
    expect(event.topic).toBe('orders');
    expect(event.payload).toEqual({ orderId: 1 });
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('should not notify subscribers of different topics', () => {
    const handler = vi.fn();
    bus.subscribe('orders', 'node-a', handler);

    bus.publish({ topic: 'payments', payload: {}, source: 'node-b' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should filter events using a predicate', () => {
    const handler = vi.fn();
    bus.subscribe(
      'orders',
      'node-a',
      handler,
      (e) => (e.payload as { priority: string }).priority === 'high',
    );

    bus.publish({ topic: 'orders', payload: { priority: 'low' }, source: 'node-b' });
    bus.publish({ topic: 'orders', payload: { priority: 'high' }, source: 'node-b' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0].payload as { priority: string }).priority).toBe('high');
  });

  it('should unsubscribe a subscription', () => {
    const handler = vi.fn();
    const id = bus.subscribe('orders', 'node-a', handler);

    const unsubscribed = bus.unsubscribe(id);
    expect(unsubscribed).toBe(true);

    bus.publish({ topic: 'orders', payload: {}, source: 'node-b' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('should return false when unsubscribing non-existent id', () => {
    expect(bus.unsubscribe('non-existent')).toBe(false);
  });

  it('should list subscriptions by topic', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.subscribe('orders', 'node-a', h1);
    bus.subscribe('orders', 'node-b', h2);
    bus.subscribe('payments', 'node-a', vi.fn());

    const orderSubs = bus.getSubscriptions('orders');
    expect(orderSubs).toHaveLength(2);

    const allSubs = bus.getSubscriptions();
    expect(allSubs).toHaveLength(3);
  });

  it('should get events with optional topic and since filter', () => {
    bus.publish({ topic: 'orders', payload: {}, source: 'node-a' });
    bus.publish({ topic: 'payments', payload: {}, source: 'node-a' });

    const orderEvents = bus.getEvents('orders');
    expect(orderEvents).toHaveLength(1);

    const allEvents = bus.getEvents();
    expect(allEvents).toHaveLength(2);
  });

  it('should forward events to a specific node', () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    bus.subscribe('orders', 'node-a', handlerA);
    bus.subscribe('orders', 'node-b', handlerB);

    bus.forwardToNode('node-a', [
      {
        id: 'e1',
        topic: 'orders',
        payload: {},
        source: 'node-c',
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();
  });
});

// ============================================================
// DistributedMemory Tests
// ============================================================

describe('DistributedMemory', () => {
  let mem: DistributedMemory;

  beforeEach(() => {
    vi.useFakeTimers();
    mem = new DistributedMemory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set and get a value', () => {
    mem.set('key1', { name: 'test' }, 'node-a');
    const result = mem.get('key1');
    expect(result?.value).toEqual({ name: 'test' });
    expect(result?.nodeId).toBe('node-a');
    expect(result?.version).toBe(1);
  });

  it('should return undefined for non-existent key', () => {
    expect(mem.get('non-existent')).toBeUndefined();
  });

  it('should delete a key', () => {
    mem.set('key1', 'value1', 'node-a');
    expect(mem.delete('key1')).toBe(true);
    expect(mem.get('key1')).toBeUndefined();
  });

  it('should return false when deleting non-existent key', () => {
    expect(mem.delete('non-existent')).toBe(false);
  });

  it('should get keys with optional prefix filter', () => {
    mem.set('app:config:port', '3000', 'node-a');
    mem.set('app:config:host', 'localhost', 'node-a');
    mem.set('db:url', 'postgres://...', 'node-b');

    const appKeys = mem.getKeys('app:');
    expect(appKeys).toHaveLength(2);

    const allKeys = mem.getKeys();
    expect(allKeys).toHaveLength(3);
  });

  it('should get all values', () => {
    mem.set('a', 1, 'node-a');
    mem.set('b', 2, 'node-b');

    const all = mem.getAll();
    expect(all).toHaveLength(2);
  });

  it('should merge with last-write-wins strategy', () => {
    mem.set('key1', { x: 1 }, 'node-a');
    mem.merge('key1', { x: 99 }, 'node-b', 'last-write-wins');

    const result = mem.get('key1');
    expect(result?.value).toEqual({ x: 99 });
    expect(result?.version).toBe(2);
  });

  it('should merge with version-merge strategy', () => {
    mem.set('key1', { x: 1, y: 2 }, 'node-a');
    mem.merge('key1', { y: 3, z: 4 }, 'node-b', 'version-merge');

    const result = mem.get('key1');
    expect(result?.value).toEqual({ x: 1, y: 3, z: 4 });
    expect(result?.version).toBe(2);
  });

  it('should expire keys after TTL', () => {
    mem.set('temp', 'ephemeral', 'node-a', 100);
    expect(mem.hasKey('temp')).toBe(true);

    vi.advanceTimersByTime(101);
    expect(mem.hasKey('temp')).toBe(false);
    expect(mem.get('temp')).toBeUndefined();
  });

  it('should clean up expired entries', () => {
    mem.set('temp1', 'v1', 'node-a', 50);
    mem.set('temp2', 'v2', 'node-b', 200);
    mem.set('perm', 'v3', 'node-c');

    vi.advanceTimersByTime(100);
    const removed = mem.cleanup();
    expect(removed).toBe(1);
    expect(mem.hasKey('temp1')).toBe(false);
    expect(mem.hasKey('temp2')).toBe(true);
    expect(mem.hasKey('perm')).toBe(true);
  });

  it('should check hasKey correctly', () => {
    mem.set('key1', 'val', 'node-a');
    expect(mem.hasKey('key1')).toBe(true);
    expect(mem.hasKey('nope')).toBe(false);
  });

  it('should increment version on each set', () => {
    mem.set('key1', 'v1', 'node-a');
    mem.set('key1', 'v2', 'node-b');
    mem.set('key1', 'v3', 'node-a');

    const result = mem.get('key1');
    expect(result?.version).toBe(3);
    expect(result?.value).toBe('v3');
  });
});
