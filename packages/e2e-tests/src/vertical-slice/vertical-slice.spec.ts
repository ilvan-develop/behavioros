import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  BehaviorOSEngine,
  CoverageEngine,
  MemoryEngine,
  ContextRecoveryEngine,
  SelfHealingEngine,
  SkillEngine,
  DNALoader,
} from '@behavioros/core';
import type { DNAPackage, QualityMetric } from '@behavioros/schemas';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..');
const AGENT_ID = 'vertical-slice-test';

function createTestDNA(): DNAPackage {
  return {
    id: 'vertical-slice-dna',
    name: 'Vertical Slice Test DNA',
    version: '1.0.0',
    description: 'DNA for vertical slice E2E testing',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Test Engineer',
        boundaries: [],
        allowedActions: ['*'],
      },
    ],
    governance: [
      {
        id: 'block-prod-deploy',
        name: 'Block Production Deploy',
        level: 'critical',
        action: 'block',
        conditions: ['type:deployment', 'impact:critical'],
      },
      {
        id: 'warn-large-change',
        name: 'Warn Large Change',
        level: 'low',
        action: 'warn',
        conditions: ['type:file'],
      },
    ],
    quality: [
      {
        id: 'lint-gate',
        name: 'lint',
        type: 'lint' as const,
        threshold: 0,
      },
      {
        id: 'typecheck-gate',
        name: 'typecheck',
        type: 'typecheck' as const,
        threshold: 0,
      },
      {
        id: 'coverage-gate',
        name: 'test_coverage',
        type: 'test_coverage' as const,
        threshold: 80,
      },
    ],
    patterns: [
      {
        name: 'strict-governance',
        type: 'governance',
        confidence: 0.9,
        principles: ['zero-defect', 'audit-before-deploy'],
        forbidden: ['skip-governance'],
      },
    ],
  };
}

function createMinimalDNA(): DNAPackage {
  return {
    id: 'minimal-test-dna',
    name: 'Minimal Test DNA',
    version: '1.0.0',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Test Engineer',
        boundaries: [],
        allowedActions: [],
      },
    ],
    governance: [],
    quality: [],
  };
}

describe('Vertical Slice — Full BehaviorOS Architecture', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'behavioros-vslice-'));
    mkdirSync(join(tmpDir, '.behavioros'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('1. DNA Loading', () => {
    it('loads a DNA package from inline object', async () => {
      const dna = createTestDNA();
      expect(dna.id).toBe('vertical-slice-dna');
      expect(dna.name).toBe('Vertical Slice Test DNA');
      expect(dna.version).toBe('1.0.0');
      expect(Array.isArray(dna.personas)).toBe(true);
      expect(dna.personas.length).toBeGreaterThanOrEqual(1);
      expect(dna.governance).toBeDefined();
      expect(dna.governance!.length).toBeGreaterThan(0);
      expect(dna.quality).toBeDefined();
      expect(dna.quality!.length).toBeGreaterThan(0);
    });

    it('loads and validates DNA via DNALoader from a YAML file', async () => {
      const loader = new DNALoader({ validate: true, basePath: REPO_ROOT });
      const dna = await loader.load('dnas/enterprise-governance.yaml');

      expect(dna).toBeDefined();
      expect(typeof dna.id).toBe('string');
      expect(dna.id.length).toBeGreaterThan(0);
      expect(typeof dna.name).toBe('string');
      expect(dna.name.length).toBeGreaterThan(0);
      expect(typeof dna.version).toBe('string');
      expect(Array.isArray(dna.personas)).toBe(true);
      expect(dna.personas.length).toBeGreaterThanOrEqual(1);
      expect(dna.governance).toBeDefined();
      expect(dna.quality).toBeDefined();
    });
  });

  describe('2. Engine Initialization', () => {
    it('creates BehaviorOSEngine with all sub-engines', () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna });

      expect(engine.governanceEngine).toBeDefined();
      expect(engine.qualityEngine).toBeDefined();
      expect(engine.learningEngine).toBeDefined();
      expect(engine.missionEngine).toBeDefined();
      expect(engine.auditEngine).toBeDefined();
      expect(engine.skillEngine).toBeDefined();

      expect(typeof engine.createMission).toBe('function');
      expect(typeof engine.evaluateGovernance).toBe('function');
      expect(typeof engine.runAudit).toBe('function');
      expect(typeof engine.recordLearning).toBe('function');
    });

    it('emits events on engine operations', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });
      const events: string[] = [];

      engine.on('mission:created', () => events.push('mission:created'));
      engine.on('mission:started', () => events.push('mission:started'));
      engine.on('mission:completed', () => events.push('mission:completed'));

      const mission = await engine.createMission({
        title: 'Event Test',
        type: 'feature',
      });
      expect(events).toContain('mission:created');

      await engine.startMission(mission.id);
      expect(events).toContain('mission:started');

      await engine.completeMission(mission.id);
      expect(events).toContain('mission:completed');
    });
  });

  describe('3. Mission Lifecycle', () => {
    it('creates a mission with correct fields', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      const mission = await engine.createMission({
        title: 'Implement feature X',
        type: 'feature',
        priority: 'high',
        description: 'Build the vertical slice feature',
      });

      expect(mission.id).toBeDefined();
      expect(mission.title).toBe('Implement feature X');
      expect(mission.type).toBe('feature');
      expect(mission.priority).toBe('high');
      expect(mission.status).toBe('draft');
    });

    it('transitions through statuses: draft -> executing -> completed', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      const mission = await engine.createMission({
        title: 'Mission lifecycle test',
        type: 'refactor',
        priority: 'medium',
      });
      expect(mission.status).toBe('draft');

      const started = await engine.startMission(mission.id);
      expect(started.status).toBe('executing');

      const completed = await engine.completeMission(mission.id, {
        result: 'success',
      });
      expect(completed.status).toBe('completed');
      expect(completed.output).toEqual({ result: 'success' });
    });

    it('lists all missions', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      await engine.createMission({ title: 'Mission A', type: 'feature' });
      await engine.createMission({ title: 'Mission B', type: 'bugfix' });

      const missions = engine.getAllMissions();
      expect(missions.length).toBe(2);
      expect(missions.map((m) => m.title)).toContain('Mission A');
      expect(missions.map((m) => m.title)).toContain('Mission B');
    });
  });

  describe('4. Governance Evaluation', () => {
    it('allows an action that passes governance rules', async () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna });

      const result = await engine.evaluateGovernance('read-code', {
        type: 'module',
        impact: 'low',
        agentAgent: AGENT_ID,
        agentRole: 'engineer',
        agentAuthority: 'senior',
      });

      expect(result.approved).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('blocks a critical action that violates governance rules', async () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna });

      const result = await engine.evaluateGovernance('deploy-production', {
        type: 'deployment',
        impact: 'critical',
        agentId: AGENT_ID,
        agentRole: 'engineer',
        agentAuthority: 'senior',
      });

      expect(result.approved).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0].id).toBe('block-prod-deploy');
    });

    it('returns warnings for low-level rule matches', async () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna });

      const result = await engine.evaluateGovernance('modify-source', {
        type: 'file',
        impact: 'medium',
        agentId: AGENT_ID,
        agentRole: 'engineer',
        agentAuthority: 'senior',
      });

      expect(result.approved).toBe(true);
    });
  });

  describe('5. Quality Gates', () => {
    it('checks quality gates with passing metrics', async () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna, quality: { enabled: true } });

      const metrics: QualityMetric[] = [
        { name: 'lint', value: 0, unit: 'errors', passed: true },
        { name: 'typecheck', value: 0, unit: 'errors', passed: true },
        { name: 'test_coverage', value: 85, unit: '%' },
      ];

      const result = await engine.evaluateQuality(metrics);
      expect(result.passed).toBe(true);
      expect(result.failedGates).toHaveLength(0);
    });

    it('detects failing quality gates', async () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna, quality: { enabled: true } });

      const metrics: QualityMetric[] = [
        { name: 'lint', value: 5, unit: 'errors', passed: false },
        { name: 'typecheck', value: 3, unit: 'errors', passed: false },
        { name: 'test_coverage', value: 45, unit: '%' },
      ];

      const result = await engine.evaluateQuality(metrics);
      expect(result.passed).toBe(false);
    });
  });

  describe('6. Audit Pipeline', () => {
    it('runs audit stages and returns results', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      const auditResult = await engine.runAudit(REPO_ROOT, ['static']);
      expect(auditResult).toBeDefined();
      expect(auditResult.id).toBeDefined();
      expect(Array.isArray(auditResult.stages)).toBe(true);

      for (const stage of auditResult.stages) {
        expect(stage.stage).toBeDefined();
        expect(stage.result).toBeDefined();
        expect(typeof stage.score).toBe('number');
      }
    });

    it('tracks audit history', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      await engine.runAudit(REPO_ROOT, ['static']);
      await engine.runAudit(REPO_ROOT, ['static']);

      const history = engine.getAuditHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('7. Learning Events', () => {
    it('records learning events', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      const event = await engine.recordLearning({
        type: 'insight',
        source: AGENT_ID,
        data: {
          content: 'Audit must pass before deployment',
          impact: 'high',
        },
        confidence: 0.9,
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('insight');
      expect(event.source).toBe(AGENT_ID);
      expect(event.confidence).toBe(0.9);
    });

    it('retrieves recorded learning events', async () => {
      const dna = createMinimalDNA();
      const engine = new BehaviorOSEngine({ dna });

      await engine.recordLearning({
        type: 'observation',
        source: AGENT_ID,
        data: { content: 'Test execution time: 2.3s' },
        confidence: 0.8,
      });

      await engine.recordLearning({
        type: 'pattern',
        source: AGENT_ID,
        data: { content: 'Tests run faster after cache warmup' },
        confidence: 0.7,
      });

      const events = engine.getLearningEvents();
      expect(events.length).toBe(2);
      expect(events.map((e) => e.type)).toContain('observation');
      expect(events.map((e) => e.type)).toContain('pattern');
    });
  });

  describe('8. Memory Persistence', () => {
    it('stores and retrieves memory entries', async () => {
      const memory = new MemoryEngine({
        basePath: join(tmpDir, '.behavioros'),
      });

      await memory.write({
        key: 'decision:architecture',
        value: 'Using hexagonal architecture with clear domain boundaries',
        category: 'decision',
        timestamp: new Date().toISOString(),
        source: AGENT_ID,
      });

      const entries = await memory.read('decision');
      expect(entries.length).toBe(1);
      expect(entries[0].key).toBe('decision:architecture');
      expect(entries[0].value).toContain('hexagonal architecture');
    });

    it('updates existing memory entries by key', async () => {
      const memory = new MemoryEngine({
        basePath: join(tmpDir, '.behavioros'),
      });

      await memory.write({
        key: 'context:project',
        value: 'Initial project context',
        category: 'context',
        timestamp: new Date().toISOString(),
      });

      await memory.write({
        key: 'context:project',
        value: 'Updated project context with new requirements',
        category: 'context',
        timestamp: new Date().toISOString(),
      });

      const entries = await memory.read('context');
      expect(entries.length).toBe(1);
      expect(entries[0].value).toContain('Updated');
    });

    it('searches memory entries by query', async () => {
      const memory = new MemoryEngine({
        basePath: join(tmpDir, '.behavioros'),
      });

      await memory.write({
        key: 'architecture:pattern',
        value: 'Event-driven architecture with CQRS',
        category: 'architecture',
        timestamp: new Date().toISOString(),
      });
      await memory.write({
        key: 'quality:coverage',
        value: 'Target coverage is 90%',
        category: 'quality',
        timestamp: new Date().toISOString(),
      });

      const results = await memory.search('coverage');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.key.includes('coverage'))).toBe(true);
    });
  });

  describe('9. Recovery Checkpoints', () => {
    it('creates and retrieves checkpoints', async () => {
      const recovery = new ContextRecoveryEngine({
        basePath: join(tmpDir, '.behavioros'),
      });

      const checkpoint = await recovery.createCheckpoint(
        'mission-1',
        'dna-loading',
        {
          dnaId: 'enterprise-governance',
          personasLoaded: 5,
          governanceRules: 12,
          qualityGates: 3,
        },
      );

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.missionId).toBe('mission-1');
      expect(checkpoint.phase).toBe('dna-loading');
      expect(checkpoint.coverage).toBeGreaterThan(0);
      expect(checkpoint.contextHash).toBeDefined();

      const latest = await recovery.getLatestCheckpoint();
      expect(latest).not.toBeNull();
      expect(latest!.id).toBe(checkpoint.id);
    });

    it('rebuilds context from the latest checkpoint', async () => {
      const recovery = new ContextRecoveryEngine({
        basePath: join(tmpDir, '.behavioros'),
      });

      await recovery.createCheckpoint('mission-2', 'execution', {
        task: 'Implement payment flow',
        status: 'in_progress',
        filesChanged: ['payment.ts'],
      });

      const result = await recovery.rebuildContext();
      expect(result.success).toBe(true);
      expect(result.restoredFrom).not.toBe('none');
      expect(result.actions.length).toBeGreaterThan(0);
    });
  });

  describe('10. Coverage Calculation', () => {
    it('calculates coverage for expected dimensions', async () => {
      const coverage = new CoverageEngine({ threshold: 90 });

      const report = await coverage.calculate(REPO_ROOT);

      expect(report.overallPercentage).toBeGreaterThan(0);
      expect(Array.isArray(report.dimensions)).toBe(true);
      expect(report.totalExpected).toBeGreaterThan(0);
      expect(report.timestamp).toBeDefined();
    });

    it('evaluates threshold enforcement', async () => {
      const coverage = new CoverageEngine({ threshold: 90 });

      const report = await coverage.calculate(REPO_ROOT);
      const result = coverage.checkThreshold(report);

      expect(typeof result.passed).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);

      if (report.overallPercentage >= 90) {
        expect(result.passed).toBe(true);
      }
    });
  });

  describe('11. Skill Resolution', () => {
    it('registers and resolves skills for an agent', async () => {
      const skillEngine = new SkillEngine();

      const result = await skillEngine.install({
        type: 'skill',
        id: 'typescript-skill',
        source: 'local',
        metadata: { description: 'TypeScript development skill' },
      });
      expect(result.success).toBe(true);

      const resolveResult = await skillEngine.resolve(AGENT_ID, 'typescript-skill');
      expect(resolveResult.hasSkill).toBe(false);

      const allSkills = await skillEngine.listAvailable();
      expect(allSkills.length).toBeGreaterThanOrEqual(1);
      expect(allSkills.some((s) => s.id === 'typescript-skill')).toBe(true);
    });

    it('validates delegation requirements', async () => {
      const skillEngine = new SkillEngine();

      await skillEngine.install({
        type: 'skill',
        id: 'database-skill',
        source: 'local',
      });

      const validation = await skillEngine.validateDelegation(
        'orchestrator',
        AGENT_ID,
        ['database-skill'],
      );

      expect(validation.allowed).toBe(false);
      expect(validation.missingSkills).toContain('database-skill');
    });
  });

  describe('12. Self-Healing', () => {
    it('monitors a failed gate and returns a healing action', async () => {
      const engine = new SelfHealingEngine({ enabled: true, maxRetries: 3 });

      const action = await engine.monitor({
        gate: 'lint',
        passed: false,
        error: '5 lint errors found',
      });

      expect(action).not.toBeNull();
      expect(action!.type).toBe('alert');
      expect(action!.target).toBe('lint');
      expect(action!.id).toBeDefined();
      expect(action!.timestamp).toBeDefined();
    });

    it('returns null for passing gates', async () => {
      const engine = new SelfHealingEngine({ enabled: true });

      const action = await engine.monitor({
        gate: 'typecheck',
        passed: true,
      });

      expect(action).toBeNull();
    });

    it('tracks healing history', async () => {
      const engine = new SelfHealingEngine({ enabled: true });

      await engine.monitor({ gate: 'lint', passed: false, error: 'error' });
      await engine.monitor({ gate: 'typecheck', passed: false, error: 'error' });

      const history = await engine.getHistory();
      expect(history.length).toBe(2);
      expect(history.map((h) => h.target)).toContain('lint');
      expect(history.map((h) => h.target)).toContain('typecheck');
    });

    it('escalates after max retries exceeded', async () => {
      const engine = new SelfHealingEngine({ enabled: true, maxRetries: 1 });

      await engine.monitor({ gate: 'security', passed: false, error: 'vuln' });

      const secondAttempt = await engine.monitor({
        gate: 'security',
        passed: false,
        error: 'vuln',
      });

      expect(secondAttempt).not.toBeNull();
      expect(secondAttempt!.type).toBe('alert');
    });
  });

  describe('13. Full System Integration', () => {
    it('runs a complete end-to-end flow', async () => {
      const dna = createTestDNA();
      const engine = new BehaviorOSEngine({ dna, quality: { enabled: true } });

      const coverageEngine = new CoverageEngine({ threshold: 80 });
      const recoveryEngine = new ContextRecoveryEngine({
        basePath: join(tmpDir, '.behavioros'),
      });
      const selfHealing = new SelfHealingEngine({ enabled: true });

      // Step 1: Create a checkpoint before starting
      await recoveryEngine.createCheckpoint('integration-test', 'init', {
        phase: 'start',
        components: ['engine', 'coverage', 'recovery', 'healing'],
      });

      // Step 2: Create and execute a mission
      const mission = await engine.createMission({
        title: 'Vertical Slice Integration',
        type: 'feature',
        priority: 'high',
        description: 'Full system E2E test',
      });
      expect(mission.status).toBe('draft');

      const started = await engine.startMission(mission.id);
      expect(started.status).toBe('executing');

      // Step 3: Evaluate governance
      const govResult = await engine.evaluateGovernance('modify-payment', {
        type: 'service',
        impact: 'medium',
        agentId: AGENT_ID,
        agentRole: 'engineer',
        agentAuthority: 'senior',
      });
      expect(govResult.approved).toBe(true);

      // Step 4: Check quality gates
      const qualityResult = await engine.evaluateQuality([
        { name: 'lint', value: 0, unit: 'errors', passed: true },
        { name: 'typecheck', value: 0, unit: 'errors', passed: true },
        { name: 'test_coverage', value: 85, unit: '%', passed: true },
      ]);
      expect(qualityResult.passed).toBe(true);

      // Step 5: Run audit
      const auditResult = await engine.runAudit(REPO_ROOT, ['static']);
      expect(auditResult.overall).toBeDefined();

      // Step 6: Record learning
      const learningEvent = await engine.recordLearning({
        type: 'insight',
        source: AGENT_ID,
        data: {
          content: 'Full integration flow completed successfully',
          impact: 'high',
          relatedPattern: 'vertical-slice',
        },
        confidence: 0.95,
      });
      expect(learningEvent.id).toBeDefined();

      // Step 7: Run coverage check
      const coverage = await coverageEngine.calculate(REPO_ROOT);
      expect(coverage.overallPercentage).toBeGreaterThan(0);

      // Step 8: Verify self-healing monitors properly
      const healAction = await selfHealing.monitor({
        gate: 'lint',
        passed: true,
      });
      expect(healAction).toBeNull();

      // Step 9: Complete mission
      const completed = await engine.completeMission(mission.id, {
        auditId: auditResult.id,
        coverage: coverage.overallPercentage,
        learningId: learningEvent.id,
      });
      expect(completed.status).toBe('completed');
      expect(completed.output).toBeDefined();

      // Step 10: Verify system stats
      const stats = engine.getStats();
      expect(stats.missions).toBeDefined();
      expect(stats.learningEvents).toBeGreaterThan(0);
      expect(stats.qualityMetrics).toBeGreaterThan(0);

      // Step 11: Verify checkpoint preserves state
      const latestCheckpoint = await recoveryEngine.getLatestCheckpoint();
      expect(latestCheckpoint).not.toBeNull();
      expect(latestCheckpoint!.phase).toBe('init');
    });
  });
});
