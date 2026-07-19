import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoRecovery } from '../resilience/circuit-breaker/recovery/auto-recovery';
import { ManualRecovery } from '../resilience/circuit-breaker/recovery/manual-recovery';

describe('AutoRecovery', () => {
  let recovery: AutoRecovery;

  beforeEach(() => {
    vi.useFakeTimers();
    recovery = new AutoRecovery({
      initialRecoveryPercentage: 10,
      recoveryStepPercentage: 10,
      recoveryIntervalMs: 10_000,
      maxRecoveryAttempts: 10,
      healthCheckEnabled: false,
      healthCheckIntervalMs: 5_000,
      healthCheckTimeoutMs: 3_000,
      backoffMultiplier: 2,
      maxBackoffMs: 60_000,
    });
  });

  afterEach(() => {
    recovery.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should initialize with initial recovery percentage', () => {
      recovery.start();
      expect(recovery.getState().active).toBe(true);
      expect(recovery.getTrafficPercentage()).toBe(10);
    });

    it('should increment attempts on start', () => {
      recovery.start();
      expect(recovery.getState().attempts).toBe(1);
      recovery.stop();
      recovery.start();
      expect(recovery.getState().attempts).toBe(2);
    });

    it('should not start if already active', () => {
      recovery.start();
      recovery.start();
      expect(recovery.getState().attempts).toBe(1);
    });

    it('should call onStep callback with initial percentage', () => {
      const cb = vi.fn();
      recovery.onStep(cb);
      recovery.start();
      expect(cb).toHaveBeenCalledWith(10);
    });

    it('should set lastStepAt on start', () => {
      recovery.start();
      expect(recovery.getState().lastStepAt).toBeTruthy();
    });

    it('should set nextStepAt on start', () => {
      recovery.start();
      expect(recovery.getState().nextStepAt).toBeTruthy();
    });
  });

  describe('stop', () => {
    it('should deactivate recovery', () => {
      recovery.start();
      recovery.stop();
      expect(recovery.getState().active).toBe(false);
    });

    it('should be safe to call when not active', () => {
      recovery.stop();
      expect(recovery.getState().active).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      recovery.start();
      vi.advanceTimersByTime(25_000);
      recovery.reset();
      const state = recovery.getState();
      expect(state.active).toBe(false);
      expect(state.currentStep).toBe(0);
      expect(state.trafficPercentage).toBe(0);
      expect(state.attempts).toBe(0);
    });

    it('should calculate totalSteps correctly', () => {
      recovery.start();
      const state = recovery.getState();
      expect(state.totalSteps).toBe(9);
    });
  });

  describe('step advancement', () => {
    it('should advance traffic percentage on each step', () => {
      recovery.start();
      expect(recovery.getTrafficPercentage()).toBe(10);
      vi.advanceTimersByTime(10_000);
      expect(recovery.getTrafficPercentage()).toBe(20);
    });

    it('should call onStep callback on each step with correct backoff', () => {
      const cb = vi.fn();
      recovery.onStep(cb);
      recovery.start();
      expect(cb).toHaveBeenCalledWith(10);

      vi.advanceTimersByTime(10_000);
      expect(cb).toHaveBeenCalledWith(20);

      vi.advanceTimersByTime(20_000);
      expect(cb).toHaveBeenCalledWith(30);
    });

    it('should complete at 100% traffic with correct backoff timing', () => {
      const cb = vi.fn();
      recovery.onRecoveryComplete(cb);
      recovery.start();

      const backoffs = [10_000, 20_000, 40_000, 60_000, 60_000, 60_000, 60_000, 60_000, 60_000];
      for (const ms of backoffs) {
        vi.advanceTimersByTime(ms);
      }

      expect(recovery.getTrafficPercentage()).toBe(100);
      expect(recovery.getState().active).toBe(false);
      expect(cb).toHaveBeenCalled();
    });

    it('should increase currentStep on advancement', () => {
      recovery.start();
      expect(recovery.getState().currentStep).toBe(0);
      vi.advanceTimersByTime(10_000);
      expect(recovery.getState().currentStep).toBe(1);
    });
  });

  describe('backoff', () => {
    it('should use exponential backoff for step timing', () => {
      recovery.start();
      const state1 = recovery.getState();
      const nextStep1 = new Date(state1.nextStepAt).getTime();
      const lastStep1 = new Date(state1.lastStepAt).getTime();
      expect(nextStep1 - lastStep1).toBe(10_000);
    });

    it('should cap backoff at maxBackoffMs', () => {
      const cappedRecovery = new AutoRecovery({
        initialRecoveryPercentage: 10,
        recoveryStepPercentage: 10,
        recoveryIntervalMs: 10_000,
        maxRecoveryAttempts: 20,
        backoffMultiplier: 3,
        maxBackoffMs: 30_000,
        healthCheckEnabled: false,
      });
      cappedRecovery.start();
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(60_000);
      }
      expect(cappedRecovery.getState().active).toBe(false);
      cappedRecovery.stop();
    });
  });

  describe('health checks', () => {
    it('should default healthCheckPassing to true', () => {
      const hcRecovery = new AutoRecovery({
        initialRecoveryPercentage: 10,
        recoveryStepPercentage: 10,
        recoveryIntervalMs: 10_000,
        healthCheckEnabled: true,
      });
      hcRecovery.setHealthCheck(async () => ({
        healthy: true,
        latencyMs: 10,
        timestamp: '',
        details: '',
      }));
      expect(hcRecovery.getState().healthCheckPassing).toBe(true);
      hcRecovery.stop();
    });

    it('should allow setting healthCheckFn', () => {
      const hcRecovery = new AutoRecovery({ healthCheckEnabled: true });
      const fn = async () => ({
        healthy: true,
        latencyMs: 0,
        timestamp: '',
        details: '',
      });
      hcRecovery.setHealthCheck(fn);
      hcRecovery.stop();
    });

    it('should allow recovery to complete when health check is passing', async () => {
      const hcRecovery = new AutoRecovery({
        initialRecoveryPercentage: 10,
        recoveryStepPercentage: 10,
        recoveryIntervalMs: 10_000,
        healthCheckEnabled: true,
        healthCheckIntervalMs: 1_000,
        healthCheckTimeoutMs: 3_000,
      });

      hcRecovery.setHealthCheck(async () => ({
        healthy: true,
        latencyMs: 10,
        timestamp: '',
        details: 'OK',
      }));

      hcRecovery.start();
      vi.advanceTimersByTime(10_000);
      expect(hcRecovery.getTrafficPercentage()).toBe(20);
      expect(hcRecovery.getState().active).toBe(true);
      hcRecovery.stop();
    });

    it('should not start health checks when healthCheckEnabled is false', () => {
      const hcRecovery = new AutoRecovery({
        initialRecoveryPercentage: 10,
        recoveryStepPercentage: 10,
        recoveryIntervalMs: 10_000,
        healthCheckEnabled: false,
      });
      hcRecovery.start();
      expect(hcRecovery.getState().healthCheckPassing).toBe(true);
      hcRecovery.stop();
    });
  });

  describe('getState', () => {
    it('should return a copy of state', () => {
      recovery.start();
      const state1 = recovery.getState();
      const state2 = recovery.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });
});

describe('ManualRecovery', () => {
  let recovery: ManualRecovery;

  beforeEach(() => {
    vi.useFakeTimers();
    recovery = new ManualRecovery({
      requireConfirmation: false,
      allowForceReset: true,
      logAllActions: true,
      cooldownMs: 5_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('forceReset', () => {
    it('should perform force reset', () => {
      const action = recovery.forceReset('admin', 'System unstable', 'open');
      expect(action).not.toBeNull();
      expect(action!.type).toBe('force-reset');
      expect(action!.previousState).toBe('open');
      expect(action!.newState).toBe('closed');
      expect(action!.performedBy).toBe('admin');
    });

    it('should record action in history', () => {
      recovery.forceReset('admin', 'Reset', 'open');
      expect(recovery.getHistory().length).toBe(1);
    });

    it('should block when force reset disabled', () => {
      const noReset = new ManualRecovery({ allowForceReset: false });
      const action = noReset.forceReset('admin', 'Reset', 'open');
      expect(action).toBeNull();
    });

    it('should respect cooldown', () => {
      recovery.forceReset('admin', 'Reset', 'open');
      const second = recovery.forceReset('admin', 'Reset again', 'open');
      expect(second).toBeNull();
    });

    it('should allow after cooldown expires', () => {
      recovery.forceReset('admin', 'Reset', 'open');
      vi.advanceTimersByTime(5_001);
      const second = recovery.forceReset('admin', 'Reset again', 'open');
      expect(second).not.toBeNull();
    });

    it('should emit callback', () => {
      const cb = vi.fn();
      recovery.onAction(cb);
      recovery.forceReset('admin', 'Reset', 'open');
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0].type).toBe('force-reset');
    });
  });

  describe('forceHalfOpen', () => {
    it('should perform force half-open', () => {
      const action = recovery.forceHalfOpen('admin', 'Testing', 'open');
      expect(action).not.toBeNull();
      expect(action!.type).toBe('force-half-open');
      expect(action!.newState).toBe('half-open');
    });

    it('should record in history', () => {
      recovery.forceHalfOpen('admin', 'Testing', 'open');
      expect(recovery.getHistory().length).toBe(1);
    });

    it('should respect cooldown', () => {
      recovery.forceHalfOpen('admin', 'Testing', 'open');
      expect(recovery.forceHalfOpen('admin', 'Again', 'open')).toBeNull();
    });
  });

  describe('forceOpen', () => {
    it('should perform force open', () => {
      const action = recovery.forceOpen('admin', 'Emergency', 'closed');
      expect(action).not.toBeNull();
      expect(action!.type).toBe('force-open');
      expect(action!.newState).toBe('open');
    });

    it('should respect cooldown', () => {
      recovery.forceOpen('admin', 'Emergency', 'closed');
      expect(recovery.forceOpen('admin', 'Again', 'closed')).toBeNull();
    });
  });

  describe('manualRecovery', () => {
    it('should perform manual recovery to closed', () => {
      const action = recovery.manualRecovery('admin', 'Fixed', 'open', 'closed');
      expect(action).not.toBeNull();
      expect(action!.type).toBe('manual-recovery');
      expect(action!.newState).toBe('closed');
    });

    it('should perform manual recovery to half-open', () => {
      const action = recovery.manualRecovery('admin', 'Testing', 'open', 'half-open');
      expect(action).not.toBeNull();
      expect(action!.newState).toBe('half-open');
    });

    it('should respect cooldown', () => {
      recovery.manualRecovery('admin', 'Fix', 'open', 'closed');
      expect(recovery.manualRecovery('admin', 'Fix2', 'open', 'closed')).toBeNull();
    });
  });

  describe('history', () => {
    it('should track all actions', () => {
      recovery.forceReset('admin', 'r1', 'open');
      vi.advanceTimersByTime(5_001);
      recovery.forceHalfOpen('admin', 'r2', 'closed');
      vi.advanceTimersByTime(5_001);
      recovery.forceOpen('admin', 'r3', 'half-open');
      expect(recovery.getHistory().length).toBe(3);
    });

    it('should return a copy of history', () => {
      recovery.forceReset('admin', 'r1', 'open');
      const history1 = recovery.getHistory();
      const history2 = recovery.getHistory();
      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });

    it('should get last action', () => {
      recovery.forceReset('admin', 'r1', 'open');
      vi.advanceTimersByTime(5_001);
      recovery.forceHalfOpen('admin', 'r2', 'closed');
      const last = recovery.getLastAction();
      expect(last!.type).toBe('force-half-open');
    });

    it('should return null for getLastAction with empty history', () => {
      expect(recovery.getLastAction()).toBeNull();
    });

    it('should clear history', () => {
      recovery.forceReset('admin', 'r1', 'open');
      recovery.clearHistory();
      expect(recovery.getHistory().length).toBe(0);
    });
  });

  describe('logAllActions disabled', () => {
    it('should not log when disabled', () => {
      const noLog = new ManualRecovery({ logAllActions: false });
      noLog.forceReset('admin', 'Reset', 'open');
      expect(noLog.getHistory().length).toBe(0);
    });
  });

  describe('generate unique IDs', () => {
    it('should generate unique IDs for each action', () => {
      const action1 = recovery.forceReset('admin', 'r1', 'open');
      vi.advanceTimersByTime(5_001);
      const action2 = recovery.forceReset('admin', 'r2', 'open');
      expect(action1!.id).not.toBe(action2!.id);
    });

    it('should have proper ID format', () => {
      const action = recovery.forceReset('admin', 'r1', 'open');
      expect(action!.id).toMatch(/^recovery-\d+-[a-z0-9]+$/);
    });
  });
});
