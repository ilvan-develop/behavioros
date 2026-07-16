import type { DNAPackage } from '@behavioros/schemas';
import { describe, expect, it } from 'vitest';
import { BehaviorOSEngine, type BehaviorOSEngineConfig } from '../engines/core-engine';

// ============================================================
// BehaviorOS Core Engine Tests
// ============================================================

const createTestDNA = (): DNAPackage => ({
  id: 'test-dna',
  name: 'Test DNA',
  version: '1.0.0',
  description: 'Test DNA package',
  author: 'Test',
  personas: [
    {
      role: 'engineer',
      authority: 'senior',
      name: 'Test Engineer',
      skills: ['coding', 'testing'],
    },
    {
      role: 'qa',
      authority: 'senior',
      name: 'Test QA',
      skills: ['testing', 'review'],
    },
  ],
  governance: [
    {
      id: 'test-rule',
      name: 'Test Rule',
      level: 'medium',
      action: 'warn',
      conditions: ['type:feature'],
    },
  ],
  quality: [
    {
      id: 'test-coverage',
      name: 'Test Coverage',
      type: 'test_coverage',
      threshold: 80,
    },
  ],
  patterns: [
    {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'collaboration',
      triggers: ['agent:engineer'],
      actions: ['code-review'],
    },
  ],
});

const createTestConfig = (): BehaviorOSEngineConfig => ({
  dna: createTestDNA(),
  governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
  quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
  learning: { enabled: true, autoApply: false },
  audit: { enabled: true },
});

describe('BehaviorOSEngine', () => {
  it('should initialize with DNA package', () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const agents = engine.getAllAgents();
    expect(agents).toHaveLength(2);
    expect(agents[0].role).toBe('engineer');
    expect(agents[1].role).toBe('qa');
  });

  it('should create a mission', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const mission = await engine.createMission({
      title: 'Test Mission',
      type: 'feature',
      priority: 'high',
    });

    expect(mission.title).toBe('Test Mission');
    expect(mission.type).toBe('feature');
    expect(mission.priority).toBe('high');
    expect(mission.status).toBe('draft');
    expect(mission.id).toBeDefined();
  });

  it('should start a mission and assign agents', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const mission = await engine.createMission({ title: 'Test', type: 'feature' });
    const started = await engine.startMission(mission.id);

    expect(started.status).toBe('executing');
    expect(started.startedAt).toBeDefined();

    const agents = engine.getAllAgents();
    const workingAgents = agents.filter((a) => a.status === 'working');
    expect(workingAgents.length).toBeGreaterThan(0);
  });

  it('should complete a mission and release agents', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const mission = await engine.createMission({ title: 'Test', type: 'feature' });
    await engine.startMission(mission.id);
    const completed = await engine.completeMission(mission.id, { result: 'done' });

    expect(completed.status).toBe('completed');
    expect(completed.output).toEqual({ result: 'done' });

    const agents = engine.getAllAgents();
    const idleAgents = agents.filter((a) => a.status === 'idle');
    expect(idleAgents.length).toBe(2);
  });

  it('should fail a mission and penalize agents', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const mission = await engine.createMission({ title: 'Test', type: 'feature' });
    await engine.startMission(mission.id);
    const failed = await engine.failMission(mission.id, new Error('Test error'));

    expect(failed.status).toBe('failed');
    const agents = engine.getAllAgents();
    for (const agent of agents) {
      expect(agent.reputation).toBeLessThan(50);
    }
  });

  it('should track audit log', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    await engine.createMission({ title: 'Test', type: 'feature' });

    const log = engine.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].type).toBe('mission:created');
  });

  it('should evaluate governance rules', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const result = await engine.evaluateGovernance('create-feature', { type: 'feature' });
    expect(result.approved).toBe(true);
  });

  it('should evaluate quality metrics', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const result = await engine.evaluateQuality([{ name: 'Test Coverage', value: 90 }]);
    expect(result.passed).toBe(true);
    expect(result.metrics).toHaveLength(1);
  });

  it('should record learning events', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    const event = await engine.recordLearning({
      type: 'observation',
      source: 'test',
      data: { message: 'test event' },
      confidence: 0.8,
      applied: false,
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe('observation');
    expect(engine.getLearningEvents()).toHaveLength(1);
  });

  it('should get stats', async () => {
    const engine = new BehaviorOSEngine(createTestConfig());
    await engine.createMission({ title: 'Test', type: 'feature' });

    const stats = engine.getStats();
    expect(stats.missions.draft).toBe(1);
    expect(stats.agents.idle).toBe(2);
    expect(stats.auditEvents).toBeGreaterThan(0);
  });
});
