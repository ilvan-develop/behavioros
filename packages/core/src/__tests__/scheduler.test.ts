import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCron, Scheduler } from '../engines/runtime/scheduler';

describe('parseCron', () => {
  it('should parse star fields (every second)', () => {
    const now = new Date();
    const results = parseCron('* * * * * *', 3);
    expect(results).toHaveLength(3);
    for (const d of results) {
      expect(d.getTime()).toBeGreaterThanOrEqual(now.getTime());
    }
  });

  it('should parse */5 step pattern', () => {
    const results = parseCron('*/5 * * * * *', 5);
    expect(results).toHaveLength(5);
    for (const d of results) {
      expect(d.getSeconds() % 5).toBe(0);
    }
  });

  it('should parse comma-separated lists', () => {
    const results = parseCron('10,20,30 * * * * *', 5);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const d of results) {
      expect([10, 20, 30]).toContain(d.getSeconds());
    }
  });

  it('should parse ranges', () => {
    const results = parseCron('0-5 * * * * *', 5);
    for (const d of results) {
      expect(d.getSeconds()).toBeGreaterThanOrEqual(0);
      expect(d.getSeconds()).toBeLessThanOrEqual(5);
    }
  });

  it('should throw on invalid field count', () => {
    expect(() => parseCron('* * * * *')).toThrow('Expected 6 cron fields');
    expect(() => parseCron('* * * * * * *')).toThrow('Expected 6 cron fields');
  });
});

describe('Scheduler', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  describe('one-shot with delay', () => {
    it('should execute a one-shot schedule after delay', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.schedule({ name: 'test', type: 'one-shot', delay: 1000 }, handler);
      scheduler.start();

      expect(handler).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('one-shot with executeAt', () => {
    it('should execute at specified ISO timestamp', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const executeAt = new Date(Date.now() + 2000).toISOString();
      scheduler.schedule({ name: 'test', type: 'one-shot', executeAt }, handler);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(2000);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('recurring cron', () => {
    it('should execute recurring schedule at cron intervals', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.schedule({ name: 'test', type: 'recurring', cron: '* * * * * *' }, handler);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(3000);

      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('cancel', () => {
    it('should cancel a schedule and prevent execution', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const id = scheduler.schedule({ name: 'test', type: 'one-shot', delay: 1000 }, handler);
      scheduler.start();

      scheduler.cancel(id);
      await vi.advanceTimersByTimeAsync(1000);

      expect(handler).not.toHaveBeenCalled();
      expect(scheduler.get(id)?.status).toBe('cancelled');
    });
  });

  describe('pause / resume', () => {
    it('should pause and resume recurring execution', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const id = scheduler.schedule(
        { name: 'test', type: 'recurring', cron: '* * * * * *' },
        handler,
      );
      scheduler.start();

      await vi.advanceTimersByTimeAsync(2000);
      expect(handler).toHaveBeenCalledTimes(2);

      scheduler.pause(id);
      await vi.advanceTimersByTimeAsync(3000);
      expect(handler).toHaveBeenCalledTimes(2);

      scheduler.resume(id);
      await vi.advanceTimersByTimeAsync(1000);
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('get / list', () => {
    it('should return undefined for non-existent schedule', () => {
      expect(scheduler.get('nonexistent')).toBeUndefined();
    });

    it('should list all schedules', () => {
      scheduler.schedule({ name: 'a', type: 'one-shot', delay: 100 }, vi.fn());
      scheduler.schedule({ name: 'b', type: 'recurring', cron: '* * * * * *' }, vi.fn());

      expect(scheduler.list()).toHaveLength(2);
    });

    it('should filter by status', () => {
      const id = scheduler.schedule({ name: 'a', type: 'one-shot', delay: 100 }, vi.fn());
      scheduler.cancel(id);

      expect(scheduler.list('cancelled')).toHaveLength(1);
      expect(scheduler.list('active')).toHaveLength(0);
    });
  });

  describe('start / stop lifecycle', () => {
    it('should not process when not started', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.schedule({ name: 'test', type: 'one-shot', delay: 100 }, handler);

      await vi.advanceTimersByTimeAsync(200);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should stop all timers on stop', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.schedule({ name: 'test', type: 'one-shot', delay: 1000 }, handler);
      scheduler.start();

      scheduler.stop();
      await vi.advanceTimersByTimeAsync(2000);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should be idempotent on multiple start calls', () => {
      scheduler.start();
      scheduler.start();
      scheduler.start();
      // Should not throw; only one interval
    });
  });

  describe('multiple schedules', () => {
    it('should handle many concurrent schedules', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      for (let i = 0; i < 10; i++) {
        scheduler.schedule({ name: `s-${i}`, type: 'one-shot', delay: 500 }, handler);
      }
      scheduler.start();

      await vi.advanceTimersByTimeAsync(500);

      expect(handler).toHaveBeenCalledTimes(10);
    });
  });

  describe('error handling', () => {
    it('should handle handler rejection gracefully', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('fail'));
      scheduler.schedule({ name: 'test', type: 'one-shot', delay: 100 }, handler);
      scheduler.start();

      await vi.advanceTimersByTimeAsync(100);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('schedule metadata', () => {
    it('should track execution count', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const id = scheduler.schedule(
        { name: 'test', type: 'recurring', cron: '* * * * * *' },
        handler,
      );
      scheduler.start();

      await vi.advanceTimersByTimeAsync(5000);

      expect(scheduler.get(id)?.executionCount).toBeGreaterThanOrEqual(5);
    });
  });
});
