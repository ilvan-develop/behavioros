import { describe, expect, it } from 'vitest';

/**
 * Barrel smoke tests: verify every barrel/index.ts in the codebase
 * loads without error and exports something at runtime.
 *
 * For type-only barrels (no runtime exports), we verify the module
 * does not throw when imported.
 *
 * Pattern: dynamic import() since core uses ESNext modules.
 */

// ──────────────────────────────────────────────────────────────────
// Root barrel
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/index', () => {
  it('should export BehaviorCompiler (root barrel)', async () => {
    // Import specific sub-modules to verify the barrel structure
    // without loading the entire 377-line root barrel (circular dep risk)
    const mod = await import('../compiler/index');
    expect(mod.BehaviorCompiler).toBeDefined();
    expect(mod.OPAEvaluator).toBeDefined();
    expect(mod.PolicyStore).toBeDefined();
    expect(mod.YAMLToOPACompiler).toBeDefined();
  });

  it('should re-export engines from sub-barrels', async () => {
    const audit = await import('../engines/audit/index');
    expect(audit.AuditEngine).toBeDefined();
    const decision = await import('../engines/decision/index');
    expect(decision.DecisionEngine).toBeDefined();
    const governance = await import('../engines/governance/index');
    expect(governance.GovernanceEngine).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Events barrels
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/events/index', () => {
  it('should export EventBridge, EventStore, EventReplay', async () => {
    const mod = await import('../events/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.EventBridge).toBeDefined();
    expect(mod.EventStore).toBeDefined();
    expect(mod.EventReplay).toBeDefined();
  });
});

describe('barrel: src/events/event-types', () => {
  it('should load without error (types barrel)', async () => {
    const mod = await import('../events/event-types');
    expect(mod).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Mesh barrel
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/mesh/index', () => {
  it('should export all bus types and MeshHub', async () => {
    const mod = await import('../mesh/index');
    expect(Object.keys(mod).length).toBeGreaterThan(3);
    expect(mod.CommandBus).toBeDefined();
    expect(mod.EventBus).toBeDefined();
    expect(mod.MeshHub).toBeDefined();
    expect(mod.QueryBus).toBeDefined();
    expect(mod.StreamBus).toBeDefined();
    expect(mod.NotificationBus).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Kernel barrels
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/kernel/index', () => {
  it('should export kernel classes', async () => {
    const mod = await import('../kernel/index');
    expect(Object.keys(mod).length).toBeGreaterThan(5);
    expect(mod.KernelLifecycle).toBeDefined();
    expect(mod.LifecycleManager).toBeDefined();
    expect(mod.CapabilityGraph).toBeDefined();
    expect(mod.CapabilityRegistry).toBeDefined();
    expect(mod.EngineRegistry).toBeDefined();
  });
});

describe('barrel: src/kernel/lifecycle/types', () => {
  it('should export lifecycle types and isValidTransition', async () => {
    const mod = await import('../kernel/lifecycle/types');
    expect(mod.isValidTransition).toBeDefined();
    expect(mod.InvalidTransitionError).toBeDefined();
  });
});

describe('barrel: src/kernel/storage/index', () => {
  it('should export storage providers', async () => {
    const mod = await import('../kernel/storage/index');
    expect(Object.keys(mod).length).toBeGreaterThan(3);
    expect(mod.MemoryStorage).toBeDefined();
    expect(mod.FileSystemStorage).toBeDefined();
    expect(mod.SQLiteStorage).toBeDefined();
    expect(mod.createProvider).toBeDefined();
  });
});

describe('barrel: src/kernel/storage/types', () => {
  it('should load without error (types barrel)', async () => {
    const mod = await import('../kernel/storage/types');
    expect(mod).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// CQRS barrel
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/cqrs/index', () => {
  it('should export registries', async () => {
    const mod = await import('../cqrs/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.CommandRegistry).toBeDefined();
    expect(mod.EventRegistry).toBeDefined();
    expect(mod.QueryRegistry).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Compliance barrel
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/compliance/index', () => {
  it('should export ComplianceExporter and provider classes', async () => {
    const mod = await import('../compliance/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.ComplianceExporter).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Pipeline barrels
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/pipeline/pipeline-context', () => {
  it('should load PipelineDispatcherContext types', async () => {
    const mod = await import('../pipeline/pipeline-context');
    expect(mod).toBeDefined();
  });
});

describe('barrel: src/pipeline/layers/layer.interface', () => {
  it('should load PipelineLayer interface', async () => {
    const mod = await import('../pipeline/layers/layer.interface');
    expect(mod).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Domain barrels
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/domain/index', () => {
  it('should export domain classes', async () => {
    const mod = await import('../domain/index');
    expect(Object.keys(mod).length).toBeGreaterThan(5);
    expect(mod.AgentACL).toBeDefined();
    expect(mod.DataACL).toBeDefined();
    expect(mod.EventACL).toBeDefined();
    expect(mod.AgentBoundary).toBeDefined();
    expect(mod.DNABoundary).toBeDefined();
    expect(mod.ExecutionBoundary).toBeDefined();
    expect(mod.AgentContext).toBeDefined();
    expect(mod.DNAContext).toBeDefined();
  });
});

describe('barrel: src/domain/contexts/index', () => {
  it('should export AgentContext and DNAContext', async () => {
    const mod = await import('../domain/contexts/index');
    expect(Object.keys(mod).length).toBeGreaterThanOrEqual(2);
    expect(mod.AgentContext).toBeDefined();
    expect(mod.DNAContext).toBeDefined();
  });
});

describe('barrel: src/domain/anti-corruption/index', () => {
  it('should export ACL classes', async () => {
    const mod = await import('../domain/anti-corruption/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.AgentACL).toBeDefined();
    expect(mod.DataACL).toBeDefined();
    expect(mod.EventACL).toBeDefined();
  });
});

describe('barrel: src/domain/anti-corruption/acl.interface', () => {
  it('should load without error (interface file)', async () => {
    const mod = await import('../domain/anti-corruption/acl.interface');
    expect(mod).toBeDefined();
  });
});

describe('barrel: src/domain/boundaries/index', () => {
  it('should export boundary classes', async () => {
    const mod = await import('../domain/boundaries/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.AgentBoundary).toBeDefined();
    expect(mod.DNABoundary).toBeDefined();
    expect(mod.ExecutionBoundary).toBeDefined();
  });
});

describe('barrel: src/domain/boundaries/boundary.interface', () => {
  it('should load without error (interface file)', async () => {
    const mod = await import('../domain/boundaries/boundary.interface');
    expect(mod).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Engine barrels
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/engines/behavioral/index', () => {
  it('should export 10+ behavioral engine classes', async () => {
    const mod = await import('../engines/behavioral/index');
    expect(Object.keys(mod).length).toBeGreaterThan(10);
    expect(mod.BehaviorSelector).toBeDefined();
    expect(mod.DNAComposer).toBeDefined();
    expect(mod.DNALoader).toBeDefined();
    expect(mod.DNAValidator).toBeDefined();
    expect(mod.DnaResolver).toBeDefined();
    expect(mod.ConflictResolver).toBeDefined();
    expect(mod.EscalationManager).toBeDefined();
    expect(mod.BosGovernanceEngine).toBeDefined();
    expect(mod.BosLearningEngine).toBeDefined();
    expect(mod.AITMPLAdapter).toBeDefined();
    expect(mod.OpenDesignAdapter).toBeDefined();
  });
});

describe('barrel: src/engines/behavioral/audit-chain/index', () => {
  it('should export AuditChainVerifier and HashChain', async () => {
    const mod = await import('../engines/behavioral/audit-chain/index');
    expect(Object.keys(mod).length).toBeGreaterThanOrEqual(2);
    expect(mod.AuditChainVerifier).toBeDefined();
    expect(mod.HashChain).toBeDefined();
  });
});

describe('barrel: src/engines/audit/index', () => {
  it('should export AuditEngine', async () => {
    const mod = await import('../engines/audit/index');
    expect(Object.keys(mod).length).toBeGreaterThan(0);
    expect(mod.AuditEngine).toBeDefined();
  });
});

describe('barrel: src/engines/decision/index', () => {
  it('should export DecisionEngine', async () => {
    const mod = await import('../engines/decision/index');
    expect(Object.keys(mod).length).toBeGreaterThan(0);
    expect(mod.DecisionEngine).toBeDefined();
  });
});

describe('barrel: src/engines/governance/index', () => {
  it('should export GovernanceEngine and OpaEngine', async () => {
    const mod = await import('../engines/governance/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.GovernanceEngine).toBeDefined();
    expect(mod.OpaEngine).toBeDefined();
    expect(mod.AIGovernanceRegistry).toBeDefined();
  });
});

describe('barrel: src/engines/quality/index', () => {
  it('should export QualityEngine', async () => {
    const mod = await import('../engines/quality/index');
    expect(Object.keys(mod).length).toBeGreaterThan(0);
    expect(mod.QualityEngine).toBeDefined();
  });
});

describe('barrel: src/engines/learning/index', () => {
  it('should export LearningEngine', async () => {
    const mod = await import('../engines/learning/index');
    expect(Object.keys(mod).length).toBeGreaterThan(0);
    expect(mod.LearningEngine).toBeDefined();
  });
});

describe('barrel: src/engines/mission/index', () => {
  it('should export MissionEngine', async () => {
    const mod = await import('../engines/mission/index');
    expect(Object.keys(mod).length).toBeGreaterThan(0);
    expect(mod.MissionEngine).toBeDefined();
  });
});

describe('barrel: src/engines/observability/index', () => {
  it('should export observability engines', async () => {
    const mod = await import('../engines/observability/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.AlertEngine).toBeDefined();
    expect(mod.HealthEngine).toBeDefined();
    expect(mod.ProfilingEngine).toBeDefined();
  });
});

describe('barrel: src/engines/orchestrator/index', () => {
  it('should export orchestrator classes', async () => {
    const mod = await import('../engines/orchestrator/index');
    expect(Object.keys(mod).length).toBeGreaterThan(5);
    expect(mod.AutonomousOrchestrator).toBeDefined();
    expect(mod.AutonomousDecomposer).toBeDefined();
    expect(mod.HandoffProtocol).toBeDefined();
    expect(mod.LifecyclePipeline).toBeDefined();
    expect(mod.SkillRouter).toBeDefined();
    expect(mod.AutoDocumentationTrigger).toBeDefined();
  });
});

describe('barrel: src/engines/pipeline/types', () => {
  it('should load without error (type definitions)', async () => {
    const mod = await import('../engines/pipeline/types');
    expect(mod).toBeDefined();
  });
});

describe('barrel: src/engines/runtime/index', () => {
  it('should export runtime classes', async () => {
    const mod = await import('../engines/runtime/index');
    expect(Object.keys(mod).length).toBeGreaterThanOrEqual(9);
    expect(mod.LocalRuntime).toBeDefined();
    expect(mod.ParallelExecutor).toBeDefined();
    expect(mod.ResourceManager).toBeDefined();
    expect(mod.RetryManager).toBeDefined();
    expect(mod.SagaManager).toBeDefined();
    expect(mod.Scheduler).toBeDefined();
    expect(mod.TimeoutManager).toBeDefined();
    expect(mod.TimeoutError).toBeDefined();
    expect(mod.WorkflowEngine).toBeDefined();
  });
});

describe('barrel: src/engines/intelligence/index', () => {
  it('should export intelligence engines', async () => {
    const mod = await import('../engines/intelligence/index');
    expect(Object.keys(mod).length).toBeGreaterThan(10);
    expect(mod.ConflictResolver).toBeDefined();
    expect(mod.DecisionEvolver).toBeDefined();
    expect(mod.EscalationManager).toBeDefined();
    expect(mod.GoalEngine).toBeDefined();
    expect(mod.IntentEngine).toBeDefined();
    expect(mod.LearningEvolver).toBeDefined();
    expect(mod.MissionCompiler).toBeDefined();
    expect(mod.PatternDetector).toBeDefined();
    expect(mod.PlanningEngine).toBeDefined();
    expect(mod.ReasoningEngine).toBeDefined();
    expect(mod.StrategyEngine).toBeDefined();
  });
});

describe('barrel: src/engines/knowledge/index', () => {
  it('should export knowledge engines', async () => {
    const mod = await import('../engines/knowledge/index');
    expect(Object.keys(mod).length).toBeGreaterThanOrEqual(10);
    expect(mod.KnowledgeCache).toBeDefined();
    expect(mod.KnowledgeGraph).toBeDefined();
    expect(mod.EpisodicMemory).toBeDefined();
    expect(mod.LongTermMemory).toBeDefined();
    expect(mod.MemoryManager).toBeDefined();
    expect(mod.ProceduralMemory).toBeDefined();
    expect(mod.SemanticMemory).toBeDefined();
    expect(mod.ShortTermMemory).toBeDefined();
    expect(mod.WorkingMemory).toBeDefined();
    expect(mod.OntologyManager).toBeDefined();
  });
});

describe('barrel: src/engines/knowledge/memory/types', () => {
  it('should load without error (types)', async () => {
    const mod = await import('../engines/knowledge/memory/types');
    expect(mod).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Shadow barrel
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/shadow/index', () => {
  it('should export shadow pipeline classes', async () => {
    const mod = await import('../shadow/index');
    expect(Object.keys(mod).length).toBeGreaterThan(5);
    expect(mod.AlertManager).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Deploy barrels
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/deploy/index', () => {
  it('should export canary deployer classes', async () => {
    const mod = await import('../deploy/index');
    expect(Object.keys(mod).length).toBeGreaterThan(5);
    expect(mod.CanaryDeployer).toBeDefined();
  });
});

describe('barrel: src/deploy/canary-prompts/index', () => {
  it('should export canary prompt classes', async () => {
    const mod = await import('../deploy/canary-prompts/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.CanaryPromptRegistry).toBeDefined();
    expect(mod.CanaryPromptRunner).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// Compiler barrel
// ──────────────────────────────────────────────────────────────────

describe('barrel: src/compiler/index', () => {
  it('should export compiler classes', async () => {
    const mod = await import('../compiler/index');
    expect(Object.keys(mod).length).toBeGreaterThan(2);
    expect(mod.BehaviorCompiler).toBeDefined();
    expect(mod.OPAEvaluator).toBeDefined();
    expect(mod.PolicyStore).toBeDefined();
    expect(mod.YAMLToOPACompiler).toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────────
// RESIDUAL COVERAGE — branches not yet hit
// ──────────────────────────────────────────────────────────────────

describe('residual: shadow/traffic-capture', () => {
  it('should sample error-only strategy', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'error-only' });
    const result1 = tc.capture({
      method: 'GET',
      path: '/ok',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(result1).toBeNull();

    const result2 = tc.capture({
      method: 'GET',
      path: '/err',
      request: {},
      response: {},
      statusCode: 500,
      latencyMs: 10,
    });
    expect(result2).not.toBeNull();
  });

  it('should sample slow-only strategy', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'slow-only', slowThresholdMs: 50 });
    const result1 = tc.capture({
      method: 'GET',
      path: '/fast',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    expect(result1).toBeNull();

    const result2 = tc.capture({
      method: 'GET',
      path: '/slow',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 100,
    });
    expect(result2).not.toBeNull();
  });

  it('should sample head strategy', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 0.5 });
    for (let i = 0; i < 60; i++) {
      tc.capture({
        method: 'GET',
        path: `/item/${i}`,
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
    }
    expect(tc.getStats().totalCaptured).toBeLessThanOrEqual(60);
  });

  it('should sample tail strategy', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'tail', maxBufferSize: 100, sampleRate: 0.1 });

    for (let i = 0; i < 50; i++) {
      tc.capture({
        method: 'GET',
        path: `/pre/${i}`,
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
    }

    const capturedAfter = [];
    for (let i = 0; i < 100; i++) {
      const r = tc.capture({
        method: 'GET',
        path: `/post/${i}`,
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      if (r) capturedAfter.push(r);
    }
    expect(capturedAfter.length).toBeGreaterThan(0);
  });

  it('should sample deterministic strategy', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({
      strategy: 'deterministic',
      sampleRate: 0.5,
      maxBufferSize: 10000,
    });
    const captured: number[] = [];
    for (let i = 0; i < 100; i++) {
      const r = tc.capture({
        method: 'GET',
        path: `/det/${i}`,
        request: {},
        response: {},
        statusCode: 200,
        latencyMs: 10,
      });
      if (r) captured.push(i);
    }
    expect(captured.length).toBeGreaterThan(0);
  });

  it('should sanitize nested objects', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 1 });
    const result = tc.capture({
      method: 'POST',
      path: '/login',
      request: { password: 'secret123', nested: { token: 'abc' } },
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    expect(result!.request.password).toBe('[REDACTED]');
    expect((result!.request.nested as Record<string, unknown>).token).toBe('[REDACTED]');
  });

  it('should get entries by path pattern', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 1 });
    tc.capture({
      method: 'GET',
      path: '/api/users',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    tc.capture({
      method: 'GET',
      path: '/api/health',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    const apiEntries = tc.getEntriesByPath('/api/*');
    expect(apiEntries.length).toBe(2);
    const healthEntries = tc.getEntriesByPath('/api/health');
    expect(healthEntries.length).toBe(1);
  });

  it('should get error entries', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 1 });
    tc.capture({
      method: 'GET',
      path: '/ok',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    tc.capture({
      method: 'GET',
      path: '/err',
      request: {},
      response: {},
      statusCode: 500,
      latencyMs: 5,
      error: 'fail',
    });
    const errs = tc.getErrorEntries();
    expect(errs.length).toBe(1);
  });

  it('should get slow entries', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({
      strategy: 'head',
      maxBufferSize: 100,
      sampleRate: 1,
      slowThresholdMs: 50,
    });
    tc.capture({
      method: 'GET',
      path: '/fast',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 10,
    });
    tc.capture({
      method: 'GET',
      path: '/slow',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 100,
    });
    const slow = tc.getSlowEntries();
    expect(slow.length).toBe(1);
  });

  it('should flush and load from disk', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const { mkdtempSync, readFileSync, existsSync, unlinkSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'tc-test-'));
    const filePath = join(dir, 'traffic.json');

    const tc = new TrafficCapture({
      strategy: 'head',
      maxBufferSize: 100,
      sampleRate: 1,
      persistPath: filePath,
    });
    tc.capture({
      method: 'GET',
      path: '/flush',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    await tc.flush();

    expect(existsSync(filePath)).toBe(true);
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.totalCaptured).toBe(1);

    const tc2 = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 1 });
    await tc2.load(filePath);
    expect(tc2.getEntries().length).toBe(1);

    unlinkSync(filePath);
  });

  it('should fail load on missing file', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture();
    await expect(tc.load('/nonexistent/tc.json')).rejects.toThrow();
  });

  it('should clear buffer', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 1 });
    tc.capture({
      method: 'GET',
      path: '/clear',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    expect(tc.getEntries().length).toBe(1);
    tc.clear();
    expect(tc.getEntries().length).toBe(0);
  });

  it('should getConfig return config', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'random', sampleRate: 0.5 });
    const cfg = tc.getConfig();
    expect(cfg.sampleRate).toBe(0.5);
    expect(cfg.strategy).toBe('random');
  });

  it('should getEntryById', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture({ strategy: 'head', maxBufferSize: 100, sampleRate: 1 });
    const r = tc.capture({
      method: 'GET',
      path: '/byid',
      request: {},
      response: {},
      statusCode: 200,
      latencyMs: 5,
    });
    const found = tc.getEntryById(r!.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(r!.id);
    expect(tc.getEntryById('nonexistent')).toBeUndefined();
  });

  it('should default to random strategy in default config', async () => {
    const { TrafficCapture } = await import('../shadow/traffic-capture');
    const tc = new TrafficCapture();
    expect(tc.getConfig().strategy).toBe('random');
    expect(tc.getConfig().sampleRate).toBe(0.1);
  });
});

describe('residual: mesh/stream-bus', () => {
  it('should create consumer group with existing group', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    const mid1 = bus.createConsumerGroup('workers', () => {});
    const mid2 = bus.createConsumerGroup('workers', () => {});
    expect(mid1).not.toBe(mid2);
  });

  it('should deliver messages to consumer groups', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    const received: string[] = [];
    bus.createConsumerGroup('processors', (msg) => {
      received.push(msg.type);
    });
    await bus.send({ type: 'event1', payload: {}, metadata: { stream: 'test' } });
    await bus.send({ type: 'event2', payload: {}, metadata: { stream: 'test' } });
    expect(received).toEqual(['event1', 'event2']);
  });

  it('should replay from index', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    await bus.send({ type: 'a', payload: {}, metadata: { stream: 'events' } });
    await bus.send({ type: 'b', payload: {}, metadata: { stream: 'events' } });
    await bus.send({ type: 'c', payload: {}, metadata: { stream: 'events' } });
    const replayed = bus.replay('events', 1);
    expect(replayed.length).toBe(2);
    expect(replayed[0].type).toBe('b');
    expect(replayed[1].type).toBe('c');
  });

  it('should return empty for nonexistent stream replay', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    expect(bus.replay('nowhere', 0)).toEqual([]);
  });

  it('should return empty for nonexistent stream getStream', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    expect(bus.getStream('nowhere')).toEqual([]);
  });

  it('should subscribe with filter', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    const received: string[] = [];
    bus.subscribe(
      (msg) => {
        received.push(msg.type);
      },
      (msg) => msg.type === 'only-me',
    );
    await bus.send({ type: 'other', payload: {}, metadata: { stream: 'filter' } });
    await bus.send({ type: 'only-me', payload: {}, metadata: { stream: 'filter' } });
    expect(received).toEqual(['only-me']);
  });

  it('should unsubscribe', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    const received: string[] = [];
    const id = bus.subscribe((msg) => {
      received.push(msg.type);
    });
    await bus.send({ type: 'a', payload: {}, metadata: { stream: 'unsub' } });
    bus.unsubscribe(id);
    await bus.send({ type: 'b', payload: {}, metadata: { stream: 'unsub' } });
    expect(received).toEqual(['a']);
  });

  it('should get stream names', async () => {
    const { StreamBus } = await import('../mesh/stream-bus');
    const bus = new StreamBus();
    await bus.send({ type: 'a', payload: {}, metadata: { stream: 'alpha' } });
    await bus.send({ type: 'b', payload: {}, metadata: { stream: 'beta' } });
    const names = bus.getStreams();
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
  });
});

describe('residual: compiler/yaml-to-opa', () => {
  it('should compile governance rule with block action', async () => {
    const { YAMLToOPACompiler } = await import('../compiler/yaml-to-opa');
    const compiler = new YAMLToOPACompiler();
    const result = compiler.compile({
      id: 'test-dna',
      name: 'Test',
      version: '1',
      personas: [],
      governance: [
        { id: 'g1', name: 'BlockWrite', action: 'block', level: 'high', conditions: ['write'] },
      ],
    } as never);
    expect(result.rules.length).toBe(1);
    expect(result.rules[0].body).toContain('deny');
  });

  it('should compile governance rule with escalate action', async () => {
    const { YAMLToOPACompiler } = await import('../compiler/yaml-to-opa');
    const compiler = new YAMLToOPACompiler();
    const result = compiler.compile({
      id: 'test-dna',
      name: 'Test',
      version: '1',
      personas: [],
      governance: [
        { id: 'g2', name: 'Escalate', action: 'escalate', level: 'admin', conditions: ['delete'] },
      ],
    } as never);
    expect(result.rules.length).toBe(1);
    expect(result.rules[0].body).toContain('escalate');
  });

  it('should compile governance rule with default (allow) action', async () => {
    const { YAMLToOPACompiler } = await import('../compiler/yaml-to-opa');
    const compiler = new YAMLToOPACompiler();
    const result = compiler.compile({
      id: 'test-dna',
      name: 'Test',
      version: '1',
      personas: [],
      governance: [
        { id: 'g3', name: 'AllowRead', action: 'allow', level: 'viewer', conditions: ['read'] },
      ],
    } as never);
    expect(result.rules.length).toBe(1);
    // default fallback — action that is neither block nor escalate
    expect(result.rules[0].body).toContain('allow');
  });

  it('should compile boundary rule with forbidden type', async () => {
    const { YAMLToOPACompiler } = await import('../compiler/yaml-to-opa');
    const compiler = new YAMLToOPACompiler();
    const result = compiler.compile({
      id: 'test-dna',
      name: 'Test',
      version: '1',
      personas: [
        {
          role: 'admin',
          authority: 'senior',
          boundaries: [
            { id: 'b1', name: 'NoDelete', type: 'forbidden', value: 'delete', scope: 'global' },
          ],
        },
      ],
    } as never);
    expect(result.rules.length).toBe(1);
    expect(result.rules[0].body).toContain('deny');
  });

  it('should compile boundary rule with non-forbidden type', async () => {
    const { YAMLToOPACompiler } = await import('../compiler/yaml-to-opa');
    const compiler = new YAMLToOPACompiler();
    const result = compiler.compile({
      id: 'test-dna',
      name: 'Test',
      version: '1',
      personas: [
        {
          role: 'reader',
          authority: 'junior',
          boundaries: [
            { id: 'b2', name: 'ReadOnly', type: 'max_files', value: 'read', scope: 'global' },
          ],
        },
      ],
    } as never);
    expect(result.rules.length).toBe(1);
    expect(result.rules[0].body).toContain('allow');
  });

  it('should handle missing governance and personas gracefully', async () => {
    const { YAMLToOPACompiler } = await import('../compiler/yaml-to-opa');
    const compiler = new YAMLToOPACompiler();
    const result = compiler.compile({
      id: 'minimal',
      name: 'Minimal',
      version: '1',
    } as never);
    expect(result.rules).toEqual([]);
  });
});

describe('residual: compiler/behavior-compiler', () => {
  it('should compile with dryRun=true', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'dry-test',
      name: 'Dry Test',
      version: '1',
      description: 'Dry run test',
      author: 'tester',
      personas: [
        {
          role: 'engineer',
          authority: 'junior',
          description: 'Developer agent',
          skills: ['typescript'],
          boundaries: [
            { id: 'b', name: 'Test', type: 'max_files', value: 'read', scope: 'global' },
          ],
        },
      ],
      governance: [
        { id: 'g', name: 'Gate', action: 'block', level: 'high', conditions: ['write'] },
      ],
      patterns: [
        {
          name: 'check',
          type: 'review',
          triggers: ['pre-commit'],
          actions: ['lint'],
          config: { strict: true },
        },
      ],
      quality: [{ id: 'q', name: 'Coverage', type: 'custom' }],
    } as never);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.organization.name).toBe('Dry Test');
  });

  it('should compile with verbose=true (dryRun)', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true, verbose: true });
    const result = compiler.compile({
      id: 'verbose-test',
      name: 'Verbose',
      version: '1',
      personas: [{ role: 'engineer', authority: 'junior' }],
    } as never);
    expect(result.organization.agents.length).toBe(1);
  });

  it('should generate hooks from patterns with triggers', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'hook-test',
      name: 'Hook Test',
      version: '1',
      personas: [{ role: 'engineer', authority: 'junior' }],
      patterns: [
        { name: 'lint', type: 'review', triggers: ['pre-commit'], actions: ['lint'], config: {} },
      ],
      workflows: [{ id: 'w1', name: 'Release', next: ['build', 'deploy'] }],
    } as never);
    expect(result.organization.hooks.length).toBe(1);
    expect(result.organization.hooks[0].event).toBe('pre-commit');
    expect(result.organization.workflows.length).toBe(1);
  });

  it('should handle compileFromYAML with minimal yaml', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const { mkdtempSync, writeFileSync, unlinkSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'bc-test-'));
    const filePath = join(dir, 'test.yaml');
    writeFileSync(
      filePath,
      'id: yaml-test\nname: YAML Test\nversion: "1"\npersonas:\n  - role: engineer\n    authority: junior\n',
      'utf-8',
    );
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compileFromYAML(filePath);
    expect(result.organization.name).toBe('YAML Test');
    unlinkSync(filePath);
  });

  it('should handle patterns without triggers (no hooks generated)', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'no-hook',
      name: 'No Hook',
      version: '1',
      personas: [{ role: 'engineer', authority: 'junior' }],
      patterns: [{ name: 'silent', type: 'review' }],
    } as never);
    expect(result.organization.hooks).toEqual([]);
  });

  it('should generate system prompt with boundaries', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'prompt-test',
      name: 'Prompt',
      version: '1',
      personas: [
        {
          role: 'admin',
          authority: 'senior',
          description: 'Admin agent',
          skills: ['governance', 'audit'],
          boundaries: [
            { id: 'b', name: 'AdminOnly', type: 'max_files', value: 'admin', scope: 'global' },
          ],
        },
      ],
    } as never);
    expect(result.organization.agents[0].systemPrompt).toContain('Admin agent');
    expect(result.organization.agents[0].systemPrompt).toContain('Skills:');
    expect(result.organization.agents[0].systemPrompt).toContain('Boundaries:');
  });

  it('should generate system prompt without extras', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'minimal-prompt',
      name: 'Minimal',
      version: '1',
      personas: [{ role: 'engineer', authority: 'junior' }],
    } as never);
    expect(result.organization.agents[0].systemPrompt).toBe(
      'You are a engineer with junior authority level.',
    );
  });

  it('should generate docs sections', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'doc-test',
      name: 'Doc Test',
      version: '2',
      description: 'Docs',
      author: 'author',
      personas: [{ role: 'engineer', authority: 'junior' }],
    } as never);
    expect(result.organization.docs.readme).toContain('Doc Test');
    expect(result.organization.docs.architecture).toContain('Doc Test');
    expect(result.organization.docs.dna).toContain('doc-test');
  });

  it('should generate CI/CD gates from quality gates', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const compiler = new BehaviorCompiler({ dryRun: true });
    const result = compiler.compile({
      id: 'cicd-test',
      name: 'CI/CD',
      version: '1',
      personas: [{ role: 'engineer', authority: 'junior' }],
      quality: [
        { id: 'q1', name: 'Lint', type: 'lint' },
        { id: 'q2', name: 'Test', type: 'custom' },
      ],
    } as never);
    expect(result.organization.cicd.gates).toContain('Lint');
    expect(result.organization.cicd.gates).toContain('Test');
  });

  it('should write files when not dryRun', async () => {
    const { BehaviorCompiler } = await import('../compiler/behavior-compiler');
    const { mkdtempSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'bc-write-'));
    const compiler = new BehaviorCompiler({ outputDir: dir, verbose: true });
    const result = compiler.compile({
      id: 'write-test',
      name: 'Write Test',
      version: '1',
      personas: [{ role: 'engineer', authority: 'junior' }],
    } as never);
    expect(result.files.length).toBeGreaterThan(0);
    // At least the README should exist
    expect(existsSync(join(dir, 'README.md'))).toBe(true);
  });
});
