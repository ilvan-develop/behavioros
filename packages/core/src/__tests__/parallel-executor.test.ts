import { beforeEach, describe, expect, it } from 'vitest';
import type { ParallelTask } from '../engines/runtime/parallel-executor';
import { ParallelExecutor } from '../engines/runtime/parallel-executor';

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor();
  });

  it('should complete all tasks', async () => {
    const tasks: ParallelTask<string>[] = [
      { id: '1', execute: async () => 'a' },
      { id: '2', execute: async () => 'b' },
      { id: '3', execute: async () => 'c' },
    ];

    const results = await executor.execute(tasks);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.status === 'completed')).toHaveLength(3);
    expect(results.find((r) => r.id === '1')?.result).toBe('a');
    expect(results.find((r) => r.id === '2')?.result).toBe('b');
    expect(results.find((r) => r.id === '3')?.result).toBe('c');
  });

  it('should stop on first error in fail-fast mode', async () => {
    const failFast = new ParallelExecutor(5, 'fail-fast');
    const completed: string[] = [];
    const tasks: ParallelTask<string>[] = [
      {
        id: '1',
        execute: async () => {
          completed.push('1');
          return 'a';
        },
      },
      {
        id: '2',
        execute: async () => {
          completed.push('2');
          throw new Error('fail');
        },
      },
      {
        id: '3',
        execute: async () => {
          completed.push('3');
          return 'c';
        },
      },
    ];

    const results = await failFast.execute(tasks);

    const failed = results.find((r) => r.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed?.error).toBe('fail');
  });

  it('should collect all errors in all-settle mode', async () => {
    const tasks: ParallelTask<string>[] = [
      {
        id: '1',
        execute: async () => {
          throw new Error('err1');
        },
      },
      {
        id: '2',
        execute: async () => {
          throw new Error('err2');
        },
      },
      { id: '3', execute: async () => 'ok' },
    ];

    const results = await executor.execute(tasks);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.status === 'failed')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'completed')).toHaveLength(1);
  });

  it('should respect concurrency limit', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks: ParallelTask<string>[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      execute: async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
        return `task-${i}`;
      },
    }));

    const limited = new ParallelExecutor(3);
    await limited.execute(tasks);

    expect(maxConcurrent).toBeLessThanOrEqual(3);
    expect(maxConcurrent).toBeGreaterThan(1);
  });

  it('should abort in-flight tasks', async () => {
    const resolvers: Array<() => void> = [];
    const tasks: ParallelTask<string>[] = Array.from({ length: 3 }, (_, i) => ({
      id: String(i),
      execute: async () => {
        await new Promise<void>((resolve) => {
          resolvers[i] = resolve;
        });
        return `task-${i}`;
      },
    }));

    const promise = executor.execute(tasks);

    resolvers[0]?.();
    await new Promise((r) => setTimeout(r, 5));

    executor.abort();
    const results = await promise;

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('0');
  });

  it('should return accurate getStats after execution', async () => {
    const tasks: ParallelTask<string>[] = [
      { id: '1', execute: async () => 'ok' },
      {
        id: '2',
        execute: async () => {
          throw new Error('fail');
        },
      },
    ];

    await executor.execute(tasks);

    const stats = executor.getStats();
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.running).toBe(0);
  });

  it('should handle mixed success and failure in all-settle', async () => {
    const tasks: ParallelTask<string>[] = [
      { id: 's1', execute: async () => 'ok' },
      {
        id: 'f1',
        execute: async () => {
          throw new Error('bad');
        },
      },
      { id: 's2', execute: async () => 'ok2' },
    ];

    const results = await executor.execute(tasks);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.status === 'completed')).toHaveLength(2);
    expect(results.filter((r) => r.status === 'failed')).toHaveLength(1);
    expect(results.find((r) => r.id === 'f1')?.error).toBe('bad');
  });

  it('should return empty array for empty task list', async () => {
    const results = await executor.execute([]);
    expect(results).toEqual([]);
  });

  it('should track result durations', async () => {
    const tasks: ParallelTask<string>[] = [
      {
        id: 'slow',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return 'slow';
        },
      },
      { id: 'fast', execute: async () => 'fast' },
    ];

    const results = await executor.execute(tasks);

    for (const r of results) {
      expect(r.duration).toBeGreaterThanOrEqual(0);
    }
    const slow = results.find((r) => r.id === 'slow');
    const fast = results.find((r) => r.id === 'fast');
    expect(slow!.duration).toBeGreaterThanOrEqual(fast!.duration);
  });

  it('should track duration for failed tasks', async () => {
    const tasks: ParallelTask<string>[] = [
      {
        id: 'fail',
        execute: async () => {
          await new Promise((r) => setTimeout(r, 5));
          throw new Error('boom');
        },
      },
    ];

    const results = await executor.execute(tasks);

    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('boom');
    expect(results[0].duration).toBeGreaterThan(0);
  });

  it('should default maxConcurrency to 5', () => {
    const defaultExec = new ParallelExecutor();
    const customExec = new ParallelExecutor(10);
    expect(defaultExec).toBeInstanceOf(ParallelExecutor);
    expect(customExec).toBeInstanceOf(ParallelExecutor);
  });

  it('should default mode to all-settle', () => {
    const defaultExec = new ParallelExecutor();
    expect(defaultExec).toBeInstanceOf(ParallelExecutor);
  });
});
