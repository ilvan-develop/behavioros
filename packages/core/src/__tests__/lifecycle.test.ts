import { describe, expect, it, vi } from 'vitest';
import { InvalidTransitionError, KernelLifecycle, LifecycleManager } from '../kernel/lifecycle';

describe('LifecycleManager', () => {
  it('starts in draft state', () => {
    const lm = new LifecycleManager();
    expect(lm.getState()).toBe('draft');
  });

  it('transitions through valid states', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    expect(lm.getState()).toBe('initialized');
  });

  it('throws on invalid transition', () => {
    const lm = new LifecycleManager();
    expect(() => lm.transition('running')).toThrow(InvalidTransitionError);
  });

  it('records transition history', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    lm.transition('starting');
    lm.transition('running');
    const history = lm.getHistory();
    expect(history.length).toBe(3);
    expect(history[0].from).toBe('draft');
    expect(history[0].to).toBe('initialized');
    expect(history[2].to).toBe('running');
  });

  it('notifies listeners on transition', () => {
    const lm = new LifecycleManager();
    const listener = vi.fn();
    lm.on('test', listener);
    lm.transition('initialized');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transition', from: 'draft', to: 'initialized' }),
    );
  });

  it('supports multiple listeners', () => {
    const lm = new LifecycleManager();
    const a = vi.fn();
    const b = vi.fn();
    lm.on('a', a);
    lm.on('b', b);
    lm.transition('initialized');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('removes listeners with off()', () => {
    const lm = new LifecycleManager();
    const listener = vi.fn();
    lm.on('test', listener);
    lm.off('test');
    lm.transition('initialized');
    expect(listener).not.toHaveBeenCalled();
  });

  it('completes full valid cycle', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    lm.transition('starting');
    lm.transition('running');
    lm.transition('stopping');
    lm.transition('stopped');
    expect(lm.getState()).toBe('stopped');
  });

  it('restarts from stopped', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    lm.transition('starting');
    lm.transition('running');
    lm.transition('stopping');
    lm.transition('stopped');
    lm.transition('initialized');
    expect(lm.getState()).toBe('initialized');
  });

  it('transitions to error from starting', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    lm.transition('starting');
    lm.transition('error');
    expect(lm.getState()).toBe('error');
  });

  it('recovers from error via stopped', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    lm.transition('starting');
    lm.transition('error');
    lm.transition('stopped');
    expect(lm.getState()).toBe('stopped');
  });

  it('rejects double transitions that are invalid', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    expect(() => lm.transition('initialized')).toThrow(InvalidTransitionError);
  });

  it('supports history with reason', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized', 'setup complete');
    const h = lm.getHistory();
    expect(h[0].reason).toBe('setup complete');
  });

  it('resets to draft and clears history', () => {
    const lm = new LifecycleManager();
    lm.transition('initialized');
    lm.transition('starting');
    lm.reset();
    expect(lm.getState()).toBe('draft');
    expect(lm.getHistory()).toHaveLength(0);
  });
});

describe('KernelLifecycle', () => {
  it('starts in draft state', () => {
    const kl = new KernelLifecycle();
    expect(kl.getState()).toBe('draft');
  });

  it('initializes successfully', async () => {
    const kl = new KernelLifecycle();
    await kl.initialize();
    expect(kl.getState()).toBe('initialized');
  });

  it('starts and stops successfully', async () => {
    const kl = new KernelLifecycle();
    await kl.initialize();
    await kl.start();
    expect(kl.getState()).toBe('running');
    await kl.stop();
    expect(kl.getState()).toBe('stopped');
  });

  it('calls beforeStart hooks in order', async () => {
    const kl = new KernelLifecycle();
    const order: string[] = [];
    kl.onBeforeStart(async () => {
      order.push('hook1');
    });
    kl.onBeforeStart(async () => {
      order.push('hook2');
    });
    await kl.initialize();
    await kl.start();
    expect(order).toEqual(['hook1', 'hook2']);
  });

  it('transitions to error if hook fails', async () => {
    const kl = new KernelLifecycle();
    kl.onBeforeStart(async () => {
      throw new Error('Hook failure');
    });
    await kl.initialize();
    await expect(kl.start()).rejects.toThrow('Hook failure');
    expect(kl.getState()).toBe('error');
  });

  it('calls beforeStop hooks', async () => {
    const kl = new KernelLifecycle();
    const hook = vi.fn();
    kl.onBeforeStop(hook);
    await kl.initialize();
    await kl.start();
    await kl.stop();
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('restarts after stopped', async () => {
    const kl = new KernelLifecycle();
    await kl.initialize();
    await kl.start();
    await kl.stop();
    await kl.restart();
    expect(kl.getState()).toBe('running');
  });

  it('getHealth returns correct info while running', async () => {
    const kl = new KernelLifecycle();
    await kl.initialize();
    await kl.start();
    const health = kl.getHealth();
    expect(health.state).toBe('running');
    expect(health.uptime).toBeGreaterThanOrEqual(0);
    expect(health.lastTransition).toBeTruthy();
  });

  it('getHealth returns stopped state after stop', async () => {
    const kl = new KernelLifecycle();
    await kl.initialize();
    await kl.start();
    await kl.stop();
    const health = kl.getHealth();
    expect(health.state).toBe('stopped');
    expect(health.uptime).toBe(0);
  });
});
