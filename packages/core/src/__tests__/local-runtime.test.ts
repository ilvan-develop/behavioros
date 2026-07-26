import { describe, expect, it, vi } from 'vitest';
import { LocalRuntime } from '../engines/runtime/local-runtime';

describe('LocalRuntime', () => {
  it('starts in stopped state', () => {
    const rt = new LocalRuntime();
    expect(rt.isRunning()).toBe(false);
  });

  it('start() begins scheduler and sets running', () => {
    const rt = new LocalRuntime();
    rt.start();
    expect(rt.isRunning()).toBe(true);
    rt.stop();
    expect(rt.isRunning()).toBe(false);
  });

  it('getHealth returns correct stats when stopped', () => {
    const rt = new LocalRuntime();
    const health = rt.getHealth();
    expect(health.running).toBe(false);
    expect(health.workflows).toBe(0);
    expect(health.sagas).toBe(0);
    expect(health.schedules).toBe(0);
  });

  it('getHealth reflects activity after use', async () => {
    const rt = new LocalRuntime();
    rt.start();

    const def = {
      id: 'test-wf',
      name: 'Test',
      version: '1.0.0',
      states: [
        { id: 's1', name: 'Start', type: 'simple' as const },
        { id: 's2', name: 'End', type: 'simple' as const },
      ],
      transitions: [{ from: 's1', to: 's2', on: 'complete' }],
      initialState: 's1',
    };
    rt.workflow.register(def);
    const instanceId = rt.workflow.create('test-wf');
    await rt.workflow.start(instanceId);

    rt.saga.createSaga('test-saga', [
      { id: 'step1', name: 'Step 1', execute: async () => 'ok', compensate: async () => {} },
    ]);
    rt.scheduler.schedule(
      { name: 'test-schedule', type: 'one-shot', delay: 100000 },
      async () => {},
    );

    const health = rt.getHealth();
    expect(health.running).toBe(true);
    expect(health.workflows).toBe(1);
    expect(health.sagas).toBe(1);
    expect(health.schedules).toBe(1);

    rt.stop();
  });

  it('getUptime returns 0 when not running', () => {
    const rt = new LocalRuntime();
    expect(rt.getUptime()).toBe(0);
  });

  it('getUptime increases after start', () => {
    const rt = new LocalRuntime();
    rt.start();
    expect(rt.getUptime()).toBeGreaterThanOrEqual(0);
    rt.stop();
  });

  it('supports custom options', () => {
    const rt = new LocalRuntime({ maxConcurrency: 3, defaultTimeout: 5000 });
    expect(rt.isRunning()).toBe(false);
  });

  it('handles start/stop cycle', () => {
    const rt = new LocalRuntime();
    rt.start();
    rt.stop();
    rt.start();
    expect(rt.isRunning()).toBe(true);
    rt.stop();
  });

  it('exposes all engine instances', () => {
    const rt = new LocalRuntime();
    expect(rt.workflow).toBeDefined();
    expect(rt.saga).toBeDefined();
    expect(rt.scheduler).toBeDefined();
    expect(rt.retry).toBeDefined();
    expect(rt.timeout).toBeDefined();
    expect(rt.resource).toBeDefined();
    expect(rt.parallel).toBeDefined();
  });

  it('retry manager wraps with exponential backoff', async () => {
    const rt = new LocalRuntime();
    const fn = vi.fn();
    fn.mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await rt.retry.wrap(async () => fn());
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('timeout manager enforces timeouts', async () => {
    const rt = new LocalRuntime();
    await expect(
      rt.timeout.execute(async () => {
        await new Promise((r) => setTimeout(r, 100000));
      }, 10),
    ).rejects.toThrow('timed out');
  });

  it('resource manager tracks concurrency', () => {
    const rt = new LocalRuntime();
    expect(rt.resource.acquire()).toBe(true);
    expect(rt.resource.getUsage().concurrent).toBe(1);
    rt.resource.release();
    expect(rt.resource.getUsage().concurrent).toBe(0);
  });
});
