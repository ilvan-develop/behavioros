import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { BehaviorOS } from '../index';

function createTestDNA(overrides?: Partial<DNAPackage>): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    description: 'DNA for testing',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Test Engineer',
      },
      {
        role: 'qa',
        authority: 'senior',
        name: 'Test QA',
      },
      {
        role: 'architect',
        authority: 'architect',
        name: 'Test Architect',
      },
    ],
    governance: [
      {
        id: 'security-review',
        name: 'Security Review',
        level: 'critical',
        action: 'block',
        conditions: ['type:security'],
      },
      {
        id: 'api-changes',
        name: 'API Changes',
        level: 'medium',
        action: 'warn',
        conditions: ['type:api'],
      },
    ],
    quality: [
      {
        id: 'test-coverage',
        name: 'test-coverage',
        type: 'test_coverage',
        threshold: 80,
      },
      {
        id: 'lint',
        name: 'lint',
        type: 'lint',
        pass: true,
      },
    ],
    ...overrides,
  };
}

describe('BehaviorOS', () => {
  let bos: BehaviorOS;

  beforeEach(() => {
    bos = new BehaviorOS({
      dnaPackage: createTestDNA(),
      governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
      quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
      learning: { enabled: true, autoApply: false },
    });
  });

  // ─── Constructor ────────────────────────────────────────────

  describe('Constructor', () => {
    it('creates instance with default config', () => {
      const instance = new BehaviorOS();
      expect(instance).toBeDefined();
    });

    it('creates instance with dnaPackage config', () => {
      expect(bos).toBeDefined();
      const status = bos.getStatus();
      expect(status.engine).toBe(true);
      expect(status.dna).toBe('Test DNA');
    });

    it('creates instance with custom config options', () => {
      const custom = new BehaviorOS({
        dnaPackage: createTestDNA(),
        governance: { enabled: true, level: 'strict', requireApproval: true, maxAgents: 5 },
        quality: { enabled: true, minCoverage: 90, enforceTypecheck: true, enforceLint: true },
        learning: { enabled: true, autoApply: false },
      });
      expect(custom).toBeDefined();
      expect(custom.getStatus().engine).toBe(true);
    });
  });

  // ─── init() ─────────────────────────────────────────────────

  describe('init()', () => {
    it('initializes engine when DNA is provided', async () => {
      const instance = new BehaviorOS({ dnaPackage: createTestDNA() });
      await instance.init();
      expect(instance.getStatus().engine).toBe(true);
    });

    it('throws when no DNA is provided', async () => {
      const instance = new BehaviorOS();
      await expect(instance.init()).rejects.toThrow('BehaviorOS not initialized: no DNA package');
    });

    it('is idempotent (safe to call multiple times)', async () => {
      await bos.init();
      await bos.init();
      expect(bos.getStatus().engine).toBe(true);
    });
  });

  // ─── createMission() ───────────────────────────────────────

  describe('createMission()', () => {
    it('creates mission with valid data', async () => {
      const mission = await bos.createMission({
        title: 'Implement auth module',
        type: 'feature',
        priority: 'high',
      });

      expect(mission).toBeDefined();
      expect(mission.id).toBeDefined();
      expect(mission.title).toBe('Implement auth module');
      expect(mission.type).toBe('feature');
      expect(mission.priority).toBe('high');
      expect(mission.status).toBe('draft');
    });

    it('creates mission with optional fields', async () => {
      const mission = await bos.createMission({
        title: 'Fix payment bug',
        type: 'bugfix',
        description: 'Critical payment processing bug',
        priority: 'critical',
        context: { environment: 'production' },
      });

      expect(mission.description).toBe('Critical payment processing bug');
      expect(mission.priority).toBe('critical');
      expect(mission.context).toEqual({ environment: 'production' });
    });

    it('defaults priority to medium', async () => {
      const mission = await bos.createMission({
        title: 'Research task',
        type: 'research',
      });
      expect(mission.priority).toBe('medium');
    });

    it('validates required fields', async () => {
      await expect(bos.createMission({ title: '', type: 'feature' })).rejects.toThrow();
    });
  });

  // ─── startMission() ────────────────────────────────────────

  describe('startMission()', () => {
    it('transitions mission to executing', async () => {
      const mission = await bos.createMission({
        title: 'Deploy service',
        type: 'feature',
      });
      const started = await bos.startMission(mission.id);

      expect(started.status).toBe('executing');
      expect(started.startedAt).toBeDefined();
    });

    it('throws for non-existent mission', async () => {
      await expect(bos.startMission('non-existent-id')).rejects.toThrow('Mission not found');
    });
  });

  // ─── completeMission() ─────────────────────────────────────

  describe('completeMission()', () => {
    it('marks mission completed with output', async () => {
      const mission = await bos.createMission({
        title: 'Write tests',
        type: 'feature',
      });
      await bos.startMission(mission.id);
      const completed = await bos.completeMission(mission.id, { pr: '#142' });

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.output).toEqual({ pr: '#142' });
    });

    it('marks mission completed without output', async () => {
      const mission = await bos.createMission({
        title: 'Quick fix',
        type: 'bugfix',
      });
      await bos.startMission(mission.id);
      const completed = await bos.completeMission(mission.id);

      expect(completed.status).toBe('completed');
      expect(completed.output).toBeUndefined();
    });

    it('throws for non-existent mission', async () => {
      await expect(bos.completeMission('fake-id')).rejects.toThrow('Mission not found');
    });
  });

  // ─── failMission() ─────────────────────────────────────────

  describe('failMission()', () => {
    it('marks mission failed with error', async () => {
      const mission = await bos.createMission({
        title: 'Deploy v2',
        type: 'feature',
      });
      await bos.startMission(mission.id);
      const failed = await bos.failMission(mission.id, new Error('Deploy failed'));

      expect(failed.status).toBe('failed');
      expect(failed.completedAt).toBeDefined();
    });

    it('throws for non-existent mission', async () => {
      await expect(bos.failMission('fake-id', new Error('Not found'))).rejects.toThrow(
        'Mission not found',
      );
    });
  });

  // ─── getMission() ──────────────────────────────────────────

  describe('getMission()', () => {
    it('retrieves mission by ID', async () => {
      const created = await bos.createMission({
        title: 'Test retrieval',
        type: 'feature',
      });
      const retrieved = bos.getMission(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test retrieval');
    });

    it('returns undefined for non-existent ID', () => {
      const result = bos.getMission('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ─── getAllMissions() ──────────────────────────────────────

  describe('getAllMissions()', () => {
    it('lists all missions', async () => {
      await bos.createMission({ title: 'Mission 1', type: 'feature' });
      await bos.createMission({ title: 'Mission 2', type: 'bugfix' });

      const missions = bos.getAllMissions();
      expect(missions).toHaveLength(2);
    });

    it('returns empty array when no missions', () => {
      const fresh = new BehaviorOS({ dnaPackage: createTestDNA() });
      expect(fresh.getAllMissions()).toEqual([]);
    });
  });

  // ─── getAllAgents() ────────────────────────────────────────

  describe('getAllAgents()', () => {
    it('lists all agents from DNA personas', () => {
      const agents = bos.getAllAgents();
      expect(agents.length).toBe(3);
      const roles = agents.map((a) => a.role);
      expect(roles).toContain('engineer');
      expect(roles).toContain('qa');
      expect(roles).toContain('architect');
    });

    it('returns empty array when no engine', () => {
      const fresh = new BehaviorOS();
      expect(fresh.getAllAgents()).toEqual([]);
    });
  });

  // ─── getAgentsByRole() ─────────────────────────────────────

  describe('getAgentsByRole()', () => {
    it('filters agents by role', () => {
      const engineers = bos.getAgentsByRole('engineer');
      expect(engineers.length).toBe(1);
      expect(engineers[0].role).toBe('engineer');
    });

    it('returns empty array for non-existent role', () => {
      const result = bos.getAgentsByRole('designer');
      expect(result).toEqual([]);
    });
  });

  // ─── evaluateGovernance() ──────────────────────────────────

  describe('evaluateGovernance()', () => {
    it('evaluates action and returns approved', async () => {
      const result = await bos.evaluateGovernance('deploy', { type: 'deployment' });
      expect(result.approved).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('returns violations for blocked actions', async () => {
      const result = await bos.evaluateGovernance('security-change', { type: 'security' });
      expect(result.approved).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('returns warnings for medium-level rules', async () => {
      const result = await bos.evaluateGovernance('api-change', { type: 'api' });
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('returns default approved when no engine', async () => {
      const fresh = new BehaviorOS();
      const result = await fresh.evaluateGovernance('anything', {});
      expect(result.approved).toBe(true);
    });
  });

  // ─── evaluateGovernanceDetailed() ──────────────────────────

  describe('evaluateGovernanceDetailed()', () => {
    it('returns detailed decision with reasoning', async () => {
      const decision = await bos.evaluateGovernanceDetailed({
        agentId: 'agent-engineer-1',
        agentRole: 'engineer',
        agentAuthority: 'senior',
        action: 'modify-file',
        targetType: 'file',
        impact: 'low',
      });

      expect(decision).toBeDefined();
      expect(typeof decision.allowed).toBe('boolean');
      expect(typeof decision.reason).toBe('string');
      expect(typeof decision.escalationRequired).toBe('boolean');
    });

    it('returns default when no governance engine', async () => {
      const noGov = new BehaviorOS({
        dnaPackage: createTestDNA({ governance: [] }),
      });
      const decision = await noGov.evaluateGovernanceDetailed({
        agentId: 'agent-1',
        agentRole: 'engineer',
        agentAuthority: 'senior',
        action: 'deploy',
        targetType: 'infrastructure',
        impact: 'critical',
      });
      expect(decision.allowed).toBe(true);
      expect(decision.escalationRequired).toBe(false);
    });
  });

  // ─── evaluateQuality() ─────────────────────────────────────

  describe('evaluateQuality()', () => {
    it('evaluates quality metrics against gates', async () => {
      const result = await bos.evaluateQuality([
        { name: 'test-coverage', value: 90, threshold: 80 },
        { name: 'lint', value: 100, threshold: 100 },
      ]);

      expect(result.passed).toBe(true);
      expect(result.failedGates).toEqual([]);
      expect(result.metrics).toHaveLength(2);
    });

    it('detects failed quality gates', async () => {
      const result = await bos.evaluateQuality([
        { name: 'test-coverage', value: 50, threshold: 80 },
      ]);

      expect(result.passed).toBe(false);
      expect(result.failedGates.length).toBeGreaterThan(0);
    });

    it('returns default passed when no engine', async () => {
      const fresh = new BehaviorOS();
      const result = await fresh.evaluateQuality([{ name: 'test', value: 100 }]);
      expect(result.passed).toBe(true);
    });
  });

  // ─── recordLearning() ──────────────────────────────────────

  describe('recordLearning()', () => {
    it('records learning event', async () => {
      const event = await bos.recordLearning({
        type: 'insight',
        source: 'test',
        data: { message: 'Learned something new' },
        confidence: 0.8,
      });

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('insight');
      expect(event.source).toBe('test');
      expect(event.data).toEqual({ message: 'Learned something new' });
      expect(event.confidence).toBe(0.8);
    });

    it('records event without confidence', async () => {
      const event = await bos.recordLearning({
        type: 'observation',
        source: 'manual',
        data: { note: 'observed pattern' },
      });

      expect(typeof event.id).toBe('string');
      expect(typeof event.timestamp).toBe('string');
    });
  });

  // ─── getLearningReport() ──────────────────────────────────

  describe('getLearningReport()', () => {
    it('returns report with patterns', () => {
      const report = bos.getLearningReport();
      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      expect(report.totalEvents).toBe(0);
      expect(report.insights).toEqual([]);
      expect(report.appliedCount).toBe(0);
      expect(report.timestamp).toBeDefined();
    });

    it('returns valid report structure', async () => {
      await bos.recordLearning({
        type: 'insight',
        source: 'test',
        data: { key: 'value' },
        confidence: 0.9,
      });

      const report = bos.getLearningReport();
      expect(report.id).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(Array.isArray(report.insights)).toBe(true);
    });
  });

  // ─── getStatus() ──────────────────────────────────────────

  describe('getStatus()', () => {
    it('returns status summary', () => {
      const status = bos.getStatus();
      expect(status.engine).toBe(true);
      expect(status.dna).toBe('Test DNA');
      expect(status.missions).toBe(0);
      expect(status.agents).toBe(3);
      expect(status.auditEvents).toBe(0);
      expect(typeof status.qualityMetrics).toBe('number');
      expect(typeof status.learningEvents).toBe('number');
    });

    it('reflects uninitialised state', () => {
      const fresh = new BehaviorOS();
      const status = fresh.getStatus();
      expect(status.engine).toBe(false);
      expect(status.dna).toBeNull();
      expect(status.missions).toBe(0);
      expect(status.agents).toBe(0);
    });

    it('updates after creating missions', async () => {
      await bos.createMission({ title: 'M1', type: 'feature' });
      await bos.createMission({ title: 'M2', type: 'bugfix' });

      const status = bos.getStatus();
      expect(status.missions).toBe(2);
    });
  });

  // ─── getStats() ───────────────────────────────────────────

  describe('getStats()', () => {
    it('returns detailed stats', () => {
      const stats = bos.getStats();
      expect(stats).toBeDefined();
      expect(stats.missions).toBeDefined();
      expect(stats.agents).toBeDefined();
      expect(stats.auditEvents).toBe(0);
      expect(stats.qualityMetrics).toBe(0);
      expect(stats.learningEvents).toBe(0);
    });

    it('returns default stats when no engine', () => {
      const fresh = new BehaviorOS();
      const stats = fresh.getStats();
      expect(stats.auditEvents).toBe(0);
      expect(stats.qualityMetrics).toBe(0);
      expect(stats.learningEvents).toBe(0);
    });

    it('tracks mission stats', async () => {
      await bos.createMission({ title: 'M1', type: 'feature' });
      const stats = bos.getStats();
      expect((stats.missions as Record<string, number>).draft).toBe(1);
    });
  });

  // ─── loadDNA() ─────────────────────────────────────────────

  describe('loadDNA()', () => {
    it('loads DNA from path (throws for invalid path)', () => {
      expect(() => bos.loadDNA('./non-existent-dna.yaml')).toThrow();
    });
  });

  // ─── Mission lifecycle ─────────────────────────────────────

  describe('Mission lifecycle — create → start → complete', () => {
    it('completes full happy path lifecycle', async () => {
      const created = await bos.createMission({
        title: 'Implement feature X',
        type: 'feature',
        priority: 'high',
      });
      expect(created.status).toBe('draft');

      const started = await bos.startMission(created.id);
      expect(started.status).toBe('executing');
      expect(started.startedAt).toBeDefined();

      const completed = await bos.completeMission(created.id, { deployed: true });
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
      expect(completed.output).toEqual({ deployed: true });

      const stored = bos.getMission(created.id);
      expect(stored?.status).toBe('completed');
    });
  });

  describe('Mission lifecycle — create → start → fail', () => {
    it('handles failure path lifecycle', async () => {
      const created = await bos.createMission({
        title: 'Deploy service',
        type: 'feature',
        priority: 'critical',
      });
      expect(created.status).toBe('draft');

      const started = await bos.startMission(created.id);
      expect(started.status).toBe('executing');

      const failed = await bos.failMission(created.id, new Error('Runtime crash'));
      expect(failed.status).toBe('failed');
      expect(failed.completedAt).toBeDefined();

      const stored = bos.getMission(created.id);
      expect(stored?.status).toBe('failed');
    });
  });

  // ─── Uninitialized state ───────────────────────────────────

  describe('Uninitialized state', () => {
    it('getMission returns undefined', () => {
      const fresh = new BehaviorOS();
      expect(fresh.getMission('any-id')).toBeUndefined();
    });

    it('getAllMissions returns empty array', () => {
      const fresh = new BehaviorOS();
      expect(fresh.getAllMissions()).toEqual([]);
    });

    it('createMission throws when not initialized', async () => {
      const fresh = new BehaviorOS();
      await expect(fresh.createMission({ title: 'Test', type: 'feature' })).rejects.toThrow(
        'BehaviorOS not initialized',
      );
    });

    it('startMission throws when not initialized', async () => {
      const fresh = new BehaviorOS();
      await expect(fresh.startMission('any-id')).rejects.toThrow('BehaviorOS not initialized');
    });
  });

  // ─── Real Engine Integration ──────────────────────────────

  describe('Real Engine Integration', () => {
    it('governance blocks junior agent on critical-impact infrastructure', async () => {
      const decision = await bos.evaluateGovernanceDetailed({
        agentId: 'agent-junior-1',
        agentRole: 'engineer',
        agentAuthority: 'junior',
        action: 'deploy-infrastructure',
        targetType: 'infrastructure',
        impact: 'critical',
      });
      expect(decision.allowed).toBe(false);
      expect(decision.escalationRequired).toBe(true);
    });

    it('governance allows senior agent on low-impact file change', async () => {
      const decision = await bos.evaluateGovernanceDetailed({
        agentId: 'agent-senior-1',
        agentRole: 'engineer',
        agentAuthority: 'senior',
        action: 'modify-file',
        targetType: 'file',
        impact: 'low',
      });
      expect(decision.allowed).toBe(true);
    });

    it('quality passes when all metrics meet thresholds', async () => {
      const result = await bos.evaluateQuality([
        { name: 'test-coverage', value: 90, threshold: 80 },
        { name: 'lint', value: 100, threshold: 100 },
      ]);
      expect(result.passed).toBe(true);
      expect(result.failedGates).toEqual([]);
      expect(result.metrics).toHaveLength(2);
    });

    it('quality fails when a metric is below threshold', async () => {
      const result = await bos.evaluateQuality([
        { name: 'test-coverage', value: 50, threshold: 80 },
        { name: 'lint', value: 100, threshold: 100 },
      ]);
      expect(result.passed).toBe(false);
      expect(result.failedGates.length).toBeGreaterThan(0);
    });

    it('mission lifecycle works end-to-end', async () => {
      const mission = await bos.createMission({
        title: 'Integration test mission',
        type: 'feature',
        priority: 'high',
      });
      expect(mission.id).toBeDefined();
      expect(mission.status).toBe('draft');

      await bos.startMission(mission.id);
      expect(bos.getMission(mission.id)?.status).toBe('executing');

      await bos.completeMission(mission.id, { deployed: true });
      expect(bos.getMission(mission.id)?.status).toBe('completed');
    });

    it('mission failure lifecycle works end-to-end', async () => {
      const mission = await bos.createMission({
        title: 'Fail test mission',
        type: 'bugfix',
        priority: 'critical',
      });
      expect(mission.status).toBe('draft');

      await bos.startMission(mission.id);
      expect(bos.getMission(mission.id)?.status).toBe('executing');

      await bos.failMission(mission.id, new Error('Test failure'));
      expect(bos.getMission(mission.id)?.status).toBe('failed');
    });

    it('governance warns on medium-level matching rules', async () => {
      const result = await bos.evaluateGovernance('api-change', { type: 'api' });
      expect(result.approved).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('learning records and returns event with id and timestamp', async () => {
      const event = await bos.recordLearning({
        type: 'insight',
        source: 'integration-test',
        data: { pattern: 'real-engine-test' },
        confidence: 0.95,
      });
      expect(event.id).toBeDefined();
      expect(typeof event.id).toBe('string');
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('insight');
      expect(event.source).toBe('integration-test');
      expect(event.data).toEqual({ pattern: 'real-engine-test' });
      expect(event.confidence).toBe(0.95);
    });

    it('agents are loaded from DNA personas', () => {
      const agents = bos.getAllAgents();
      expect(agents.length).toBeGreaterThan(0);
      const roles = agents.map((a) => a.role);
      expect(roles).toContain('engineer');
    });
  });
});
