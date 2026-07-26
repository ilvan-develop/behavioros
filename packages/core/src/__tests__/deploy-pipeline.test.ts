import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanaryDeployer } from '../deploy/canary-deployer';
import type { CanaryPromptDefinition } from '../deploy/canary-prompts/canary-prompt.schema';
import {
  CanaryPromptDefinitionSchema,
  CanaryPromptResultSchema,
  DriftDetectionSchema,
} from '../deploy/canary-prompts/canary-prompt.schema';
import { CanaryPromptRegistry } from '../deploy/canary-prompts/canary-prompt-registry';
import { CanaryPromptRunner } from '../deploy/canary-prompts/canary-prompt-runner';
import type { HealthCheckResult } from '../deploy/health-checker';
import { HealthChecker } from '../deploy/health-checker';
import {
  STAGE_5_CONFIG,
  STAGE_25_CONFIG,
  STAGE_50_CONFIG,
  STAGE_100_CONFIG,
} from '../deploy/index';
import { RollbackManager } from '../deploy/rollback-manager';
import { TrafficSplitter } from '../deploy/traffic-splitter';

// ============================================================
// Deploy Pipeline Tests
// ============================================================

describe('CanaryDeployer', () => {
  let deployer: CanaryDeployer;

  beforeEach(() => {
    vi.useFakeTimers();
    deployer = new CanaryDeployer();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts a deployment with correct initial state', async () => {
    const dep = await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test-project',
    });

    expect(dep.status).toBe('in-progress');
    expect(dep.stableVersion).toBe('v1.0.0');
    expect(dep.canaryVersion).toBe('v2.0.0-canary');
    expect(dep.projectName).toBe('test-project');
    expect(dep.currentStageIndex).toBe(0);
    expect(dep.stages).toHaveLength(4);
    expect(dep.stages[0].config.trafficPercent).toBe(5);
  });

  it('throws if deployment is already in progress', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    await expect(
      deployer.startDeployment({
        stableVersion: 'v1.0.0',
        canaryVersion: 'v2.0.0-canary',
        projectName: 'test',
      }),
    ).rejects.toThrow('A canary deployment is already in progress');
  });

  it('returns null for getDeployment before start', () => {
    const d = new CanaryDeployer();
    expect(d.getDeployment()).toBeNull();
  });

  it('returns deployment history', async () => {
    const dep = await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const history = deployer.getDeployments();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(dep.id);
  });

  it('reports health and advances stage when healthy', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    for (let i = 0; i < 3; i++) {
      const result = deployer.reportHealth({
        successCount: 50,
        totalCount: 50,
        totalLatencyMs: 100,
        errorCount: 0,
      });
      expect(result?.overallStatus).toBe('healthy');
    }
  });

  it('triggers rollback on unhealthy health check', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const result = deployer.reportHealth({
      successCount: 1,
      totalCount: 50,
      totalLatencyMs: 50000,
      errorCount: 49,
    });

    expect(result?.overallStatus).toBe('unhealthy');
    const dep = deployer.getDeployment();
    expect(dep?.status).toBe('rolled-back');
  });

  it('reports drift and triggers rollback above threshold', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const record = deployer.reportDrift(0.8);
    expect(record).not.toBeNull();
    expect(record?.trigger).toBe('drift-detected');
    const dep = deployer.getDeployment();
    expect(dep?.status).toBe('rolled-back');
  });

  it('does not rollback on low drift', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const record = deployer.reportDrift(0.05);
    expect(record).toBeNull();
  });

  it('pauses and resumes a deployment', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const paused = deployer.pause();
    expect(paused?.status).toBe('paused');

    const resumed = deployer.resume();
    expect(resumed?.status).toBe('in-progress');
  });

  it('returns null on pause when not in-progress', async () => {
    expect(deployer.pause()).toBeNull();
  });

  it('manually promotes to next stage', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const dep = deployer.promote();
    expect(dep?.currentStageIndex).toBe(1);
  });

  it('manually triggers rollback', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    const dep = deployer.manualRollback('manual rollback');
    expect(dep?.status).toBe('rolled-back');
    expect(dep?.rollbackRecord?.trigger).toBe('manual');
  });

  it('traffic split resets to 0 on rollback', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    deployer.manualRollback('testing traffic reset');
    const dep = deployer.getDeployment();
    expect(dep?.trafficSplit.stable).toBe(100);
    expect(dep?.trafficSplit.canary).toBe(0);
  });

  it('completes deployment after all stages promoted', async () => {
    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    deployer.promote();
    deployer.promote();
    deployer.promote();
    const dep = deployer.promote();
    expect(dep?.status).toBe('completed');
  });

  it('emits deployment events', async () => {
    const started = vi.fn();
    const completed = vi.fn();
    const rolledBack = vi.fn();
    deployer.on('deployment:started', started);
    deployer.on('deployment:completed', completed);
    deployer.on('deployment:rolled-back', rolledBack);

    await deployer.startDeployment({
      stableVersion: 'v1.0.0',
      canaryVersion: 'v2.0.0-canary',
      projectName: 'test',
    });

    expect(started).toHaveBeenCalledTimes(1);

    deployer.manualRollback('test rollback');
    expect(rolledBack).toHaveBeenCalledTimes(1);
  });

  it('returns null for reportHealth when no active deployment', () => {
    const result = deployer.reportHealth({
      successCount: 50,
      totalCount: 50,
      totalLatencyMs: 100,
      errorCount: 0,
    });
    expect(result).toBeNull();
  });

  it('exposes sub-components via getters', async () => {
    const hc = deployer.getHealthChecker();
    const rm = deployer.getRollbackManager();
    const ts = deployer.getTrafficSplitter();

    expect(hc).toBeInstanceOf(HealthChecker);
    expect(rm).toBeInstanceOf(RollbackManager);
    expect(ts).toBeInstanceOf(TrafficSplitter);
  });
});

// ============================================================
// HealthChecker
// ============================================================

describe('HealthChecker', () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker();
  });

  it('returns healthy for good metrics', () => {
    const result = checker.check({
      successCount: 50,
      totalCount: 50,
      totalLatencyMs: 100,
      errorCount: 0,
    });

    expect(result.overallStatus).toBe('healthy');
    expect(result.successRate).toBe(100);
    expect(result.errorRate).toBe(0);
    expect(result.requestCount).toBe(50);
    expect(result.probes).toHaveLength(3);
  });

  it('returns degraded for warning-level metrics', () => {
    const result = checker.check({
      successCount: 47,
      totalCount: 50,
      totalLatencyMs: 25000,
      errorCount: 3,
    });

    expect(result.overallStatus).toBe('degraded');
  });

  it('returns unhealthy for failure-threshold metrics', () => {
    const result = checker.check({
      successCount: 40,
      totalCount: 50,
      totalLatencyMs: 60000,
      errorCount: 10,
    });

    expect(result.overallStatus).toBe('unhealthy');
  });

  it('returns 100% success rate when totalCount is 0', () => {
    const result = checker.check({
      successCount: 0,
      totalCount: 0,
      totalLatencyMs: 0,
      errorCount: 0,
    });

    expect(result.successRate).toBe(100);
    expect(result.avgLatencyMs).toBe(0);
  });

  it('emits check:complete event', () => {
    const handler = vi.fn();
    checker.on('check:complete', handler);

    checker.check({
      successCount: 50,
      totalCount: 50,
      totalLatencyMs: 100,
      errorCount: 0,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits check:unhealthy event on failure', () => {
    const handler = vi.fn();
    checker.on('check:unhealthy', handler);

    checker.check({
      successCount: 1,
      totalCount: 50,
      totalLatencyMs: 60000,
      errorCount: 49,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('tracks consecutive failures', () => {
    checker.check({
      successCount: 1,
      totalCount: 50,
      totalLatencyMs: 60000,
      errorCount: 49,
    });

    expect(checker.getConsecutiveFailures()).toBe(1);
  });

  it('returns false for isFailing when under threshold', () => {
    expect(checker.isFailing()).toBe(false);
  });

  it('resets state correctly', () => {
    checker.check({
      successCount: 1,
      totalCount: 50,
      totalLatencyMs: 60000,
      errorCount: 49,
    });

    checker.reset();
    expect(checker.getConsecutiveFailures()).toBe(0);
    expect(checker.getResults()).toHaveLength(0);
  });

  it('updates config', () => {
    checker.updateConfig({ intervalMs: 5000 });
    expect(checker.getConfig().intervalMs).toBe(5000);
  });
});

// ============================================================
// RollbackManager
// ============================================================

describe('RollbackManager', () => {
  let manager: RollbackManager;

  beforeEach(() => {
    manager = new RollbackManager();
  });

  it('triggers rollback on unhealthy health check', () => {
    const result: HealthCheckResult = {
      id: 'test-check',
      timestamp: new Date().toISOString(),
      probes: [],
      overallStatus: 'unhealthy',
      successRate: 50,
      avgLatencyMs: 500,
      errorRate: 50,
      requestCount: 100,
    };

    const record = manager.evaluateHealthCheck(result, 'dep-1', 'v1', 'v2', 25);
    expect(record).not.toBeNull();
    expect(record?.trigger).toBe('health-check-failure');
    expect(record?.status).toBe('in-progress');
  });

  it('returns null for healthy health check', () => {
    const result: HealthCheckResult = {
      id: 'test-check',
      timestamp: new Date().toISOString(),
      probes: [],
      overallStatus: 'healthy',
      successRate: 100,
      avgLatencyMs: 100,
      errorRate: 0,
      requestCount: 100,
    };

    const record = manager.evaluateHealthCheck(result, 'dep-1', 'v1', 'v2', 25);
    expect(record).toBeNull();
  });

  it('triggers rollback on drift above threshold', () => {
    const record = manager.evaluateDrift(0.8, 'dep-1', 'v1', 'v2', 25);
    expect(record).not.toBeNull();
    expect(record?.trigger).toBe('drift-detected');
    expect(record?.driftScore).toBe(0.8);
  });

  it('returns null for drift below threshold', () => {
    const record = manager.evaluateDrift(0.05, 'dep-1', 'v1', 'v2', 25);
    expect(record).toBeNull();
  });

  it('triggers manual rollback', () => {
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'Manual rollback for testing',
    });

    expect(record).not.toBeNull();
    expect(record?.trigger).toBe('manual');
  });

  it('completes a rollback', () => {
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });

    const completed = manager.completeRollback(record!.id);
    expect(completed?.status).toBe('completed');
  });

  it('fails a rollback', () => {
    const record = manager.triggerManual({
      deploymentId: 'dep-1',
      fromVersion: 'v2',
      toVersion: 'v1',
      stagePercent: 25,
      reason: 'test',
    });

    const failed = manager.failRollback(record!.id, 'rollback execution error');
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('rollback execution error');
  });

  it('returns null when completing invalid rollback', () => {
    expect(manager.completeRollback('nonexistent')).toBeNull();
  });

  it('returns null when cancelling in-progress rollback', () => {
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

  it('returns history for a specific deployment', () => {
    manager.evaluateDrift(0.8, 'dep-1', 'v1', 'v2', 25);
    const history = manager.getHistoryForDeployment('dep-1');
    expect(history).toHaveLength(1);
  });

  it('resets all state', () => {
    manager.evaluateDrift(0.8, 'dep-1', 'v1', 'v2', 25);
    manager.reset();
    expect(manager.getHistory()).toHaveLength(0);
    expect(manager.hasActiveRollback()).toBe(false);
  });

  it('emits rollback:triggered event', () => {
    const handler = vi.fn();
    manager.on('rollback:triggered', handler);

    manager.evaluateDrift(0.8, 'dep-1', 'v1', 'v2', 25);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// TrafficSplitter
// ============================================================

describe('TrafficSplitter', () => {
  let splitter: TrafficSplitter;

  beforeEach(() => {
    splitter = new TrafficSplitter();
  });

  it('sets split with 10/90 ratio', () => {
    const routes = splitter.setSplit(10);
    expect(routes).toHaveLength(2);
    expect(routes[1].weight).toBe(10);
    expect(routes[0].weight).toBe(90);
  });

  it('sets split with 50/50 ratio', () => {
    const routes = splitter.setSplit(50);
    expect(routes[0].weight).toBe(50);
    expect(routes[1].weight).toBe(50);
  });

  it('sets split with 100/0 ratio', () => {
    const routes = splitter.setSplit(100, 0);
    expect(routes[0].weight).toBe(0);
    expect(routes[1].weight).toBe(100);
  });

  it('returns traffic split as version map', () => {
    splitter.setSplit(25);
    const split = splitter.getTrafficSplit();
    expect(split.stable).toBe(75);
    expect(split.canary).toBe(25);
  });

  it('routes requests and returns routing decision', () => {
    splitter.setSplit(50);
    const decision = splitter.route();
    expect(decision.trafficSplit).toBeDefined();
    expect(['stable', 'canary']).toContain(decision.routedVersion);
  });

  it('creates and uses sticky sessions', () => {
    splitter.setSplit(50);
    const session = splitter.createStickySession('session-1', 'canary');
    expect(session.sessionId).toBe('session-1');
    expect(session.pinnedVersion).toBe('canary');

    const decision = splitter.route('session-1');
    expect(decision.stickyMatch).toBe(true);
    expect(decision.routedVersion).toBe('canary');
  });

  it('removes sticky sessions', () => {
    splitter.createStickySession('session-1', 'canary');
    expect(splitter.removeStickySession('session-1')).toBe(true);
    expect(splitter.getStickySessions()).toHaveLength(0);
  });

  it('resets all routes', () => {
    splitter.setSplit(50);
    splitter.reset();
    expect(splitter.getRoutes()).toHaveLength(0);
  });

  it('returns canary and stable routes', () => {
    splitter.setSplit(25);
    expect(splitter.getCanaryRoute()?.weight).toBe(25);
    expect(splitter.getStableRoute()?.weight).toBe(75);
  });

  it('emits split:changed event', () => {
    const handler = vi.fn();
    splitter.on('split:changed', handler);

    splitter.setSplit(50);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Stage Configs
// ============================================================

describe('Stage Configs', () => {
  it('stage-5 has 5% traffic', () => {
    expect(STAGE_5_CONFIG.trafficPercent).toBe(5);
    expect(STAGE_5_CONFIG.name).toBe('stage-5');
    expect(STAGE_5_CONFIG.autoAdvance).toBe(true);
  });

  it('stage-25 has 25% traffic', () => {
    expect(STAGE_25_CONFIG.trafficPercent).toBe(25);
    expect(STAGE_25_CONFIG.name).toBe('stage-25');
  });

  it('stage-50 has 50% traffic', () => {
    expect(STAGE_50_CONFIG.trafficPercent).toBe(50);
    expect(STAGE_50_CONFIG.name).toBe('stage-50');
  });

  it('stage-100 has 100% traffic and autoAdvance is false', () => {
    expect(STAGE_100_CONFIG.trafficPercent).toBe(100);
    expect(STAGE_100_CONFIG.name).toBe('stage-100');
    expect(STAGE_100_CONFIG.autoAdvance).toBe(false);
    expect(STAGE_100_CONFIG.durationMs).toBe(0);
  });
});

// ============================================================
// CanaryPromptRegistry
// ============================================================

describe('CanaryPromptRegistry', () => {
  let registry: CanaryPromptRegistry;
  const validPrompt = {
    id: 'prompt-1',
    name: 'Test Prompt',
    description: 'A test prompt',
    prompt: 'What is 2+2?',
    expectedBehavior: 'The answer is 4',
    driftThreshold: 0.3,
    category: 'accuracy' as const,
    tags: ['math'],
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    registry = new CanaryPromptRegistry();
  });

  it('registers a new prompt', () => {
    const def = registry.register(validPrompt);
    expect(def.id).toBe('prompt-1');
    expect(def.createdAt).toBeDefined();
    expect(def.updatedAt).toBeDefined();
  });

  it('throws on duplicate registration', () => {
    registry.register(validPrompt);
    expect(() => registry.register(validPrompt)).toThrow('already exists');
  });

  it('gets a prompt by id', () => {
    registry.register(validPrompt);
    const prompt = registry.get('prompt-1');
    expect(prompt).toBeDefined();
    expect(prompt?.name).toBe('Test Prompt');
  });

  it('lists all registered prompts', () => {
    registry.register(validPrompt);
    registry.register({ ...validPrompt, id: 'prompt-2', name: 'Prompt 2' });
    const list = registry.list();
    expect(list).toHaveLength(2);
  });

  it('lists prompts by category', () => {
    registry.register(validPrompt);
    registry.register({
      ...validPrompt,
      id: 'prompt-2',
      name: 'Safety Prompt',
      category: 'safety',
    });
    const safety = registry.listByCategory('safety');
    expect(safety).toHaveLength(1);
  });

  it('unregisters a prompt', () => {
    registry.register(validPrompt);
    expect(registry.unregister('prompt-1')).toBe(true);
    expect(registry.get('prompt-1')).toBeUndefined();
  });

  it('validates a valid prompt', () => {
    const result = registry.validate(validPrompt);
    expect(result.valid).toBe(true);
  });

  it('validates an invalid prompt', () => {
    const result = registry.validate({ id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('exports prompts as YAML string', () => {
    registry.register(validPrompt);
    const exported = registry.export();
    expect(exported).toContain('prompt-1');
    expect(exported).toContain('Test Prompt');
  });

  it('imports prompts from YAML string', () => {
    const yaml = `id: import-prompt
  name: "Imported"
  description: "Imported prompt"
  category: accuracy
  driftThreshold: 0.3
  version: 1.0.0
  tags: [test]
  prompt: |
    Test prompt
  expectedBehavior: |
    Test behavior`;

    const imported = registry.import(yaml);
    expect(registry.size()).toBe(1);
    expect(imported).toHaveLength(1);
  });

  it('clears all prompts', () => {
    registry.register(validPrompt);
    registry.clear();
    expect(registry.size()).toBe(0);
  });
});

// ============================================================
// CanaryPromptRunner
// ============================================================

describe('CanaryPromptRunner', () => {
  let runner: CanaryPromptRunner;
  let adapter: ReturnType<typeof vi.fn>;

  const validPrompt: CanaryPromptDefinition = {
    id: 'prompt-1',
    name: 'Test Prompt',
    description: 'Test',
    prompt: 'What is 2+2?',
    expectedBehavior: 'The answer is 4',
    driftThreshold: 0.3,
    category: 'accuracy',
    tags: [],
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    adapter = vi.fn();
    runner = new CanaryPromptRunner(adapter);
  });

  it('runs a prompt and returns a result', async () => {
    adapter.mockResolvedValue({
      content: 'The answer is 4',
      latencyMs: 100,
      model: 'gpt-4',
    });

    const result = await runner.run(validPrompt);
    expect(result.promptId).toBe('prompt-1');
    expect(result.passed).toBe(true);
    expect(result.driftScore).toBeLessThanOrEqual(0.3);
  });

  it('returns failed result on adapter error', async () => {
    adapter.mockRejectedValue(new Error('API failure'));

    const result = await runner.run(validPrompt);
    expect(result.passed).toBe(false);
    expect(result.error).toBe('API failure');
  });

  it('returns failed result on timeout', async () => {
    runner = new CanaryPromptRunner(adapter, { timeoutMs: 50 });
    adapter.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100)),
    );

    const result = await runner.run(validPrompt);
    expect(result.passed).toBe(false);
  });

  it('runs a batch of prompts', async () => {
    adapter.mockResolvedValue({
      content: 'The answer is 4',
      latencyMs: 50,
      model: 'gpt-4',
    });

    const batch = await runner.runBatch([validPrompt, { ...validPrompt, id: 'prompt-2' }]);
    expect(batch.results).toHaveLength(2);
    expect(batch.overallPassed).toBe(true);
  });

  it('detects drift from results', () => {
    const results = [
      {
        promptId: 'p1',
        model: 'gpt-4',
        response: '',
        driftScore: 0.8,
        passed: false,
        latencyMs: 100,
        timestamp: new Date().toISOString(),
      },
      {
        promptId: 'p2',
        model: 'gpt-4',
        response: 'ok',
        driftScore: 0.2,
        passed: true,
        latencyMs: 100,
        timestamp: new Date().toISOString(),
      },
    ];

    const drift = runner.detectDrift(results);
    expect(drift.detected).toBe(true);
    expect(drift.affectedPrompts).toContain('p1');
  });

  it('returns no drift for empty results', () => {
    const drift = runner.detectDrift([]);
    expect(drift.detected).toBe(false);
    expect(drift.severity).toBe('none');
  });

  it('recommend rollback for critical severity', () => {
    const results = [
      {
        promptId: 'p1',
        model: 'gpt-4',
        response: '',
        driftScore: 0.9,
        passed: false,
        latencyMs: 100,
        timestamp: new Date().toISOString(),
      },
      {
        promptId: 'p2',
        model: 'gpt-4',
        response: '',
        driftScore: 0.85,
        passed: false,
        latencyMs: 100,
        timestamp: new Date().toISOString(),
      },
    ];

    const drift = runner.detectDrift(results);
    expect(drift.recommendation).toBe('rollback');
  });

  it('evaluates drift score using Jaccard similarity', () => {
    const score = runner.evaluate('The answer is 4', 'The answer is 4');
    expect(score).toBe(0);
  });

  it('evaluates drift score for completely different responses', () => {
    const score = runner.evaluate('foo bar baz', 'The answer is 4');
    expect(score).toBeGreaterThan(0);
  });
});

// ============================================================
// Canary Prompt Schema
// ============================================================

describe('CanaryPrompt Schemas', () => {
  it('validates a correct prompt definition', () => {
    const result = CanaryPromptDefinitionSchema.safeParse({
      id: 'test-1',
      name: 'Test',
      description: 'Desc',
      prompt: 'Hello',
      expectedBehavior: 'World',
      driftThreshold: 0.3,
      category: 'accuracy',
      tags: [],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects prompt definition with missing required fields', () => {
    const result = CanaryPromptDefinitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('validates a correct prompt result', () => {
    const result = CanaryPromptResultSchema.safeParse({
      promptId: 'test-1',
      model: 'gpt-4',
      response: 'some response',
      driftScore: 0.1,
      passed: true,
      latencyMs: 100,
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('validates drift detection schema with all severities', () => {
    for (const severity of ['none', 'low', 'medium', 'high', 'critical'] as const) {
      const result = DriftDetectionSchema.safeParse({
        detected: false,
        severity,
        affectedPrompts: [],
        averageDriftScore: 0,
        maxDriftScore: 0,
        recommendation: 'continue',
      });
      expect(result.success).toBe(true);
    }
  });

  it('validates drift detection with rollback recommendation', () => {
    const result = DriftDetectionSchema.safeParse({
      detected: true,
      severity: 'critical',
      affectedPrompts: ['prompt-1'],
      averageDriftScore: 0.8,
      maxDriftScore: 0.9,
      recommendation: 'rollback',
    });
    expect(result.success).toBe(true);
  });
});
