import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueItem } from '../engines/execution/queue-manager';
import { SandboxExecutor, TimeoutError } from '../engines/execution/sandbox-executor';

function createItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 'test-id',
    taskId: 'task-1',
    type: 'test',
    payload: null,
    priority: 'medium',
    status: 'running',
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 0,
    ...overrides,
  };
}

describe('SandboxExecutor', () => {
  let item: QueueItem;

  beforeEach(() => {
    item = createItem();
  });

  it('should return a successful result for a handler that resolves', async () => {
    const executor = new SandboxExecutor(async () => ({ success: true, output: 'done' }), {
      timeout: 5000,
    });

    const result = await executor.execute(item);

    expect(result.success).toBe(true);
    expect(result.output).toBe('done');
    expect(result.error).toBeUndefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should return a failed result when the handler throws', async () => {
    const executor = new SandboxExecutor(async () => {
      throw new Error('handler crashed');
    });

    const result = await executor.execute(item);

    expect(result.success).toBe(false);
    expect(result.error).toBe('handler crashed');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should reject with TimeoutError when handler exceeds timeout', async () => {
    const executor = new SandboxExecutor(
      async () => {
        await new Promise((r) => setTimeout(r, 500));
        return { success: true };
      },
      { timeout: 50 },
    );

    const result = await executor.execute(item);

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should track execution duration accurately', async () => {
    const executor = new SandboxExecutor(
      async () => {
        await new Promise((r) => setTimeout(r, 100));
        return { success: true, output: 'slow' };
      },
      { timeout: 5000 },
    );

    const result = await executor.execute(item);

    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(90);
  });

  it('should invoke onComplete callback on success', async () => {
    const onComplete = vi.fn();
    const executor = new SandboxExecutor(async () => ({ success: true, output: 'cb test' }), {
      onComplete,
    });

    await executor.execute(item);

    expect(onComplete).toHaveBeenCalledTimes(1);
    const callResult = onComplete.mock.calls[0][0];
    expect(callResult.success).toBe(true);
    expect(callResult.output).toBe('cb test');
  });

  it('should invoke onError callback on handler failure', async () => {
    const onError = vi.fn();
    const executor = new SandboxExecutor(
      async () => {
        throw new Error('fail');
      },
      { onError },
    );

    await executor.execute(item);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('fail');
  });

  it('should invoke onError callback on timeout', async () => {
    const onError = vi.fn();
    const executor = new SandboxExecutor(
      async () => {
        await new Promise((r) => setTimeout(r, 500));
        return { success: true };
      },
      { timeout: 50, onError },
    );

    await executor.execute(item);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(TimeoutError);
  });

  it('should use default 30s timeout when not specified', async () => {
    const executor = new SandboxExecutor(async () => {
      await new Promise((r) => setTimeout(r, 100));
      return { success: true, output: 'default timeout' };
    });

    const result = await executor.execute(item);

    expect(result.success).toBe(true);
    expect(result.output).toBe('default timeout');
  });
});
