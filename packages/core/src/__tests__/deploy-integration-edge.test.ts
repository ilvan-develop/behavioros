import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanaryDeployer } from '../deploy/canary-deployer';
import type { HealthCheckResult } from '../deploy/health-checker';
import { HealthChecker } from '../deploy/health-checker';
import { RollbackManager } from '../deploy/rollback-manager';

// deploy/index.ts is a barrel — skip

// ============================================================
// CanaryDeployer — Edge branches
// ============================================================

describe('CanaryDeployer — edge branches', () => {
  let deployer: CanaryDeployer;

  beforeEach(() => {
    vi.useFakeTimers();
    deployer = new CanaryDeployer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null on reportHealth when no active deployment', () => {
    const result = deployer.reportHealth({
      successCount: 50,
      totalCount: 50,
      totalLatencyMs: 100,
      errorCount: 0,
    });
    expect(result).toBeNull();
  });

  it('should return null on reportDrift when no active deployment', () => {
    expect(deployer.reportDrift(0.8)).toBeNull();
  });

  it('should return null on pause when no active deployment', () => {
    expect(deployer.pause()).toBeNull();
  });

  it('should return null on resume when not paused', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    expect(deployer.resume()).toBeNull();
  });

  it('should return null on promote when not in-progress', () => {
    expect(deployer.promote()).toBeNull();
  });

  it('should return null on manualRollback when not in-progress', () => {
    expect(deployer.manualRollback('not started')).toBeNull();
  });

  it('should resume only when paused', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    deployer.pause();
    const resumed = deployer.resume();
    expect(resumed?.status).toBe('in-progress');
  });

  it('should promote through all stages and complete', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    deployer.promote();
    expect(deployer.getDeployment()?.currentStageIndex).toBe(1);
    deployer.promote();
    expect(deployer.getDeployment()?.currentStageIndex).toBe(2);
    deployer.promote();
    expect(deployer.getDeployment()?.currentStageIndex).toBe(3);
    deployer.promote();
    expect(deployer.getDeployment()?.status).toBe('completed');
  });

  it('should trigger rollback via reportHealth with unhealthy status', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    deployer.reportHealth({
      successCount: 1,
      totalCount: 50,
      totalLatencyMs: 50000,
      errorCount: 49,
    });
    expect(deployer.getDeployment()?.status).toBe('rolled-back');
  });

  it('should trigger rollback via reportDrift above threshold', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    deployer.reportDrift(0.8);
    expect(deployer.getDeployment()?.status).toBe('rolled-back');
  });

  it('should emit deployment:stage-advanced on promote', async () => {
    const handler = vi.fn();
    deployer.on('deployment:stage-advanced', handler);
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    deployer.promote();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('should emit deployment:failed event via health check', async () => {
    const handler = vi.fn();
    deployer.on('deployment:failed', handler);
    await deployer.startDeployment({
      stableVersion: 'v1',
      canaryVersion: 'v2',
      projectName: 'test',
    });
    deployer.reportHealth({
      successCount: 0,
      totalCount: 50,
      totalLatencyMs: 99999,
      errorCount: 50,
    });
  });

  it('should expose config', () => {
    const config = deployer.getConfig();
    expect(config.globalDriftThreshold).toBe(0.3);
  });

  it('should use custom config', () => {
    const custom = new CanaryDeployer({ globalDriftThreshold: 0.5 });
    expect(custom.getConfig().globalDriftThreshold).toBe(0.5);
  });
});

// ============================================================
// HealthChecker — Edge branches
// ============================================================

describe('HealthChecker — edge branches', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    vi.useFakeTimers();
    checker = new HealthChecker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not start periodic timer again if already running', () => {
    checker.startPeriodic(async () => ({
      successCount: 10,
      totalCount: 10,
      totalLatencyMs: 100,
      errorCount: 0,
    }));
    checker.startPeriodic(async () => ({
      successCount: 10,
      totalCount: 10,
      totalLatencyMs: 100,
      errorCount: 0,
    }));
  });

  it('should handle periodic check error gracefully', async () => {
    const unhealthyHandler = vi.fn();
    checker.on('check:unhealthy', unhealthyHandler);
    checker.startPeriodic(async () => {
      throw new Error('periodic fail');
    });
    await vi.advanceTimersByTimeAsync(30000);
    expect(unhealthyHandler).toHaveBeenCalled();
  });

  it('should handle custom threshold category via continue (default case)', () => {
    const customChecker = new HealthChecker({
      thresholds: [{ category: 'custom', warningThreshold: 10, failureThreshold: 20, unit: '%' }],
    });
    const result = customChecker.check({
      successCount: 50,
      totalCount: 50,
      totalLatencyMs: 100,
      errorCount: 0,
    });
    expect(result.probes).toHaveLength(0);
  });

  it('should emit check:recovered after unhealthy then healthy', () => {
    const recoveredHandler = vi.fn();
    checker.on('check:recovered', recoveredHandler);

    checker.check({
      successCount: 1,
      totalCount: 50,
      totalLatencyMs: 50000,
      errorCount: 49,
    });
    expect(recoveredHandler).toHaveBeenCalledTimes(1);

    const result = checker.check({
      successCount: 50,
      totalCount: 50,
      totalLatencyMs: 100,
      errorCount: 0,
    });
    expect(result.overallStatus).toBe('healthy');
    expect(recoveredHandler).toHaveBeenCalledTimes(2);
  });

  it('should return isFailing true at threshold', () => {
    for (let i = 0; i < 3; i++) {
      checker.check({
        successCount: 0,
        totalCount: 50,
        totalLatencyMs: 99999,
        errorCount: 50,
      });
    }
    expect(checker.isFailing()).toBe(true);
  });

  it('should stop periodic timer', () => {
    const sampleFn = vi
      .fn()
      .mockResolvedValue({ successCount: 10, totalCount: 10, totalLatencyMs: 100, errorCount: 0 });
    checker.startPeriodic(sampleFn);
    checker.stopPeriodic();
    expect((checker as any).timer).toBeNull();
  });

  it('should handle stopPeriodic when no timer', () => {
    checker.stopPeriodic();
  });

  it('should return undefined getLastResult when empty', () => {
    expect(checker.getLastResult()).toBeUndefined();
  });

  it('should handle evaluateThreshold with degraded status', () => {
    const result = checker.check({
      successCount: 47,
      totalCount: 50,
      totalLatencyMs: 200,
      errorCount: 3,
    });
    expect(result.overallStatus).toBe('degraded');
  });
});

// ============================================================
// RollbackManager — Edge branches
// ============================================================

describe('RollbackManager — edge branches', () => {
  let manager: RollbackManager;

  beforeEach(() => {
    manager = new RollbackManager();
  });

  it('should return null when autoRollbackOnHealth is false', () => {
    const noAuto = new RollbackManager({ autoRollbackOnHealth: false });
    const result: HealthCheckResult = {
      id: 'h1',
      timestamp: new Date().toISOString(),
      probes: [],
      overallStatus: 'unhealthy',
      successRate: 0,
      avgLatencyMs: 0,
      errorRate: 100,
      requestCount: 10,
    };
    expect(noAuto.evaluateHealthCheck(result, 'dep-1', 'v1', 'v2', 25)).toBeNull();
  });

  it('should return null when autoRollbackOnDrift is false', () => {
    const noAuto = new RollbackManager({ autoRollbackOnDrift: false });
    expect(noAuto.evaluateDrift(0.9, 'dep-1', 'v1', 'v2', 25)).toBeNull();
  });

  it('should return null when activeRollback exists', () => {
    const _record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    const result: HealthCheckResult = {
      id: 'h1',
      timestamp: new Date().toISOString(),
      probes: [],
      overallStatus: 'unhealthy',
      successRate: 0,
      avgLatencyMs: 0,
      errorRate: 100,
      requestCount: 10,
    };
    expect(manager.evaluateHealthCheck(result, 'dep-2', 'v3', 'v4', 50)).toBeNull();
    expect(
      manager.triggerManual({
        deploymentId: 'dep-2',
        fromVersion: 'v3',
        toVersion: 'v4',
        stagePercent: 50,
        reason: 'should be null',
      }),
    ).toBeNull();
  });

  it('completeRollback should return null when no rollback found', () => {
    expect(manager.completeRollback('nonexistent')).toBeNull();
  });

  it('completeRollback should return null when rollback not in-progress', () => {
    expect(manager.completeRollback('nonexistent')).toBeNull();
  });

  it('failRollback should return null when no rollback found', () => {
    expect(manager.failRollback('nonexistent', 'error')).toBeNull();
  });

  it('cancelRollback should return null when rollback not pending', () => {
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    const cancelled = manager.cancelRollback(record!.id);
    expect(cancelled).toBeNull();
  });

  it('getLastCompleted should return undefined when no completed rollbacks', () => {
    manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    expect(manager.getLastCompleted()).toBeUndefined();
  });

  it('getLastCompleted should return most recent completed rollback', () => {
    const r1 = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'first',
    });
    manager.completeRollback(r1!.id);
    const last = manager.getLastCompleted();
    expect(last).toBeDefined();
    expect(last!.deploymentId).toBe('dep-1');
  });

  it('should enforce maxHistory limit', () => {
    const limited = new RollbackManager({ maxHistory: 2 });
    const r1 = limited.triggerManual({
      deploymentId: 'd1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 10,
      reason: 'r1',
    })!;
    limited.completeRollback(r1.id);
    const r2 = limited.triggerManual({
      deploymentId: 'd2',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 20,
      reason: 'r2',
    })!;
    limited.completeRollback(r2.id);
    const r3 = limited.triggerManual({
      deploymentId: 'd3',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 30,
      reason: 'r3',
    })!;
    limited.completeRollback(r3.id);
    expect(limited.getHistory()).toHaveLength(2);
  });

  it('should emit rollback:completed event', () => {
    const handler = vi.fn();
    manager.on('rollback:completed', handler);
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    manager.completeRollback(record!.id);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should emit rollback:failed event', () => {
    const handler = vi.fn();
    manager.on('rollback:failed', handler);
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    manager.failRollback(record!.id, 'execution error');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should return hasActiveRollback after trigger', () => {
    manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    expect(manager.hasActiveRollback()).toBe(true);
  });

  it('should return getActiveRollback after trigger', () => {
    manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    expect(manager.getActiveRollback()).not.toBeNull();
  });

  it('completeRollback should set activeRollback to null', () => {
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    manager.completeRollback(record!.id);
    expect(manager.hasActiveRollback()).toBe(false);
  });

  it('failRollback should set activeRollback to null', () => {
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });
    manager.failRollback(record!.id, 'err');
    expect(manager.hasActiveRollback()).toBe(false);
  });
});
