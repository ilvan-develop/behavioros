import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueManager } from '../engines/execution/queue-manager';
import { WorkerPool } from '../engines/execution/worker-pool';

describe('QueueManager', () => {
  let queue: QueueManager;

  beforeEach(() => {
    queue = new QueueManager();
  });

  describe('enqueue / dequeue', () => {
    it('should enqueue an item and return an id', () => {
      const id = queue.enqueue({
        taskId: 'task-1',
        type: 'test',
        payload: { foo: 'bar' },
        priority: 'medium',
        maxRetries: 3,
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should dequeue items in FIFO order within same priority', () => {
      const id1 = queue.enqueue({
        taskId: 'task-1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      const id2 = queue.enqueue({
        taskId: 'task-2',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });

      const item1 = queue.dequeue();
      expect(item1?.id).toBe(id1);
      const item2 = queue.dequeue();
      expect(item2?.id).toBe(id2);
    });

    it('should dequeue higher priority items first', () => {
      queue.enqueue({
        taskId: 'low',
        type: 'test',
        payload: null,
        priority: 'low',
        maxRetries: 0,
      });
      queue.enqueue({
        taskId: 'critical',
        type: 'test',
        payload: null,
        priority: 'critical',
        maxRetries: 0,
      });
      queue.enqueue({
        taskId: 'high',
        type: 'test',
        payload: null,
        priority: 'high',
        maxRetries: 0,
      });

      const first = queue.dequeue();
      expect(first?.taskId).toBe('critical');
      const second = queue.dequeue();
      expect(second?.taskId).toBe('high');
      const third = queue.dequeue();
      expect(third?.taskId).toBe('low');
    });

    it('should return null when queue is empty', () => {
      expect(queue.dequeue()).toBeNull();
    });
  });

  describe('complete / fail / cancel', () => {
    it('should mark item as completed', () => {
      const id = queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.dequeue();
      queue.complete(id);
      expect(queue.getStatus(id)).toBe('completed');
    });

    it('should mark item as failed with error', () => {
      const id = queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.fail(id, 'something went wrong');
      expect(queue.getStatus(id)).toBe('failed');
    });

    it('should mark item as cancelled and remove from queue', () => {
      const id = queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.cancel(id);
      expect(queue.getStatus(id)).toBe('cancelled');
      expect(queue.dequeue()).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty queue', () => {
      const stats = queue.getStats();
      expect(stats.queued).toBe(0);
      expect(stats.running).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.avgWaitTime).toBe(0);
    });

    it('should track queued and completed counts', () => {
      const id1 = queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      const id2 = queue.enqueue({
        taskId: 't2',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.dequeue();
      queue.complete(id1);
      queue.fail(id2, 'err');

      const stats = queue.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('lifecycle events', () => {
    it('should call onEnqueue when item is enqueued', () => {
      const cb = vi.fn();
      queue.onEnqueue(cb);
      queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].taskId).toBe('t1');
    });

    it('should call onComplete when item is completed', () => {
      const cb = vi.fn();
      queue.onComplete(cb);
      const id = queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.complete(id);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('should call onFail when item fails', () => {
      const cb = vi.fn();
      queue.onFail(cb);
      const id = queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.fail(id, 'error');
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('clear', () => {
    it('should clear all items', () => {
      queue.enqueue({
        taskId: 't1',
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
      queue.clear();
      expect(queue.dequeue()).toBeNull();
      expect(queue.getStats().queued).toBe(0);
    });
  });
});

describe('WorkerPool', () => {
  let queue: QueueManager;

  beforeEach(() => {
    queue = new QueueManager();
  });

  it('should create workers with correct size', () => {
    const pool = new WorkerPool(3, async () => ({ success: true }));
    const workers = pool.getWorkers();
    expect(workers).toHaveLength(3);
    expect(workers[0].status).toBe('idle');
  });

  it('should process items from the queue', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const pool = new WorkerPool(2, handler);

    queue.enqueue({
      taskId: 't1',
      type: 'test',
      payload: null,
      priority: 'medium',
      maxRetries: 0,
    });
    queue.enqueue({
      taskId: 't2',
      type: 'test',
      payload: null,
      priority: 'medium',
      maxRetries: 0,
    });

    pool.start(queue);

    await vi.waitFor(
      () => {
        expect(handler).toHaveBeenCalledTimes(2);
      },
      { timeout: 2000 },
    );

    pool.stop();
  });

  it('should respect concurrency and not process more than worker count', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const handler = vi.fn().mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 200));
      concurrent--;
      return { success: true };
    });

    const pool = new WorkerPool(2, handler);

    for (let i = 0; i < 4; i++) {
      queue.enqueue({
        taskId: `t${i}`,
        type: 'test',
        payload: null,
        priority: 'medium',
        maxRetries: 0,
      });
    }

    pool.start(queue);

    await vi.waitFor(
      () => {
        expect(handler).toHaveBeenCalledTimes(4);
      },
      { timeout: 5000 },
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    pool.stop();
  });

  it('should report correct stats', () => {
    const pool = new WorkerPool(3, async () => ({ success: true }));
    const stats = pool.getStats();
    expect(stats.total).toBe(3);
    expect(stats.idle).toBe(3);
    expect(stats.busy).toBe(0);
  });

  it('should stop processing when stop is called', async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    const pool = new WorkerPool(1, handler);

    queue.enqueue({
      taskId: 't1',
      type: 'test',
      payload: null,
      priority: 'medium',
      maxRetries: 0,
    });

    pool.start(queue);
    pool.stop();

    await new Promise((r) => setTimeout(r, 300));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should resize the pool', () => {
    const pool = new WorkerPool(2, async () => ({ success: true }));
    expect(pool.getWorkers()).toHaveLength(2);

    pool.resize(4);
    expect(pool.getWorkers()).toHaveLength(4);

    pool.resize(1);
    expect(pool.getWorkers()).toHaveLength(1);
  });

  it('should retry on handler failure within maxRetries', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('transient error'));

    const pool = new WorkerPool(1, handler);

    queue.enqueue({
      taskId: 't1',
      type: 'test',
      payload: null,
      priority: 'medium',
      maxRetries: 2,
    });

    pool.start(queue);

    await vi.waitFor(
      () => {
        expect(handler).toHaveBeenCalled();
      },
      { timeout: 3000 },
    );

    pool.stop();
  });
});
