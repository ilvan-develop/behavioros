import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditChain } from '../engines/behavioral/audit-chain';
import { BehaviorSelector, type TaskContext } from '../engines/behavioral/behavior-selector';
import { type ConflictContext, ConflictResolver } from '../engines/behavioral/conflict-resolver';
import { DnaResolver } from '../engines/behavioral/dna-resolver';
import { EscalationManager } from '../engines/behavioral/escalation-manager';
import { type BehavioralRecord, BosLearningEngine } from '../engines/behavioral/learning-engine';

// ============================================================
// Helpers
// ============================================================

function makeContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    problemType: 'feature',
    riskLevel: 'medium',
    scope: 'single_package',
    timeline: 'sprint',
    domain: 'backend',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<BehavioralRecord> = {}): BehavioralRecord {
  return {
    id: `rec-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    dna: 'manufacturing',
    task: 'test-task',
    agent: 'test-agent',
    success: true,
    duration: 60_000,
    quality: 0.85,
    ...overrides,
  };
}

// ============================================================
// BehaviorSelector
// ============================================================

describe('BehaviorSelector', () => {
  let selector: BehaviorSelector;

  beforeEach(() => {
    selector = new BehaviorSelector();
  });

  it('should select surgical-team for bug_fix + critical', () => {
    const selection = selector.select(
      makeContext({ problemType: 'bug_fix', riskLevel: 'critical' }),
    );
    expect(selection.primary).toBe('surgical-team');
    // critical risk triggers immune-system overlay → blend becomes 70/30
    expect(selection.blend.primary).toBe(70);
    expect(selection.secondary).toBe('immune-system');
    expect(selection.rationale).toContain('Immune System overlay');
  });

  it('should select immune-system for security (any scope/risk)', () => {
    const selection = selector.select(makeContext({ problemType: 'security' }));
    expect(selection.primary).toBe('immune-system');
    expect(selection.rationale).toContain('immune system');
  });

  it('should select bee-colony + manufacturing for feature + multi_package', () => {
    const selection = selector.select(
      makeContext({
        problemType: 'feature',
        scope: 'multi_package',
        timeline: 'sprint',
      }),
    );
    expect(selection.primary).toBe('bee-colony');
    expect(selection.secondary).toBe('manufacturing');
  });

  it('should select bee-colony + manufacturing for feature + multi_package + urgent', () => {
    // multi_package rule (priority 90) beats feature-urgent (priority 85)
    const selection = selector.select(
      makeContext({
        problemType: 'feature',
        scope: 'multi_package',
        timeline: 'urgent',
      }),
    );
    expect(selection.primary).toBe('bee-colony');
    expect(selection.secondary).toBe('manufacturing');
  });

  it('should overlay immune-system for incident + high risk (non-security domain)', () => {
    const selection = selector.select(
      makeContext({
        problemType: 'incident',
        riskLevel: 'high',
        domain: 'backend',
      }),
    );
    expect(selection.primary).toBe('wolf-pack');
    expect(selection.secondary).toBe('immune-system');
    expect(selection.rationale).toContain('Immune System overlay');
  });

  it('should select research-lab for discovery', () => {
    const selection = selector.select(makeContext({ problemType: 'discovery' }));
    expect(selection.primary).toBe('research-lab');
  });

  it('should add enterprise-governance for compliance PCI-DSS', () => {
    const selection = selector.select(
      makeContext({
        problemType: 'feature',
        compliance: ['PCI-DSS'],
      }),
    );
    expect(selection.rationale).toContain('Enterprise Governance');
    expect(selection.rationale).toContain('PCI-DSS');
  });

  it('should return default manufacturing when no rule matches', () => {
    // Force no match with impossible combination (all rules are based on problemType first)
    const selection = selector.select(makeContext());
    // feature + single_package + sprint matches feature-default (priority 50)
    expect(selection.primary).toBe('manufacturing');
  });

  it('should return rule list', () => {
    const rules = selector.listRules();
    expect(rules.length).toBeGreaterThan(0);
  });
});

// ============================================================
// ConflictResolver
// ============================================================

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  it('should resolve security_vs_feature with security as winner', () => {
    const ctx: ConflictContext = {
      type: 'security_vs_feature',
      agents: ['security-agent', 'feature-agent'],
      issue: 'Security wants to halt feature delivery',
      evidence: ['OWASP vulnerability found', 'PCI-DSS non-compliance'],
      severity: 'high',
    };
    const resolution = resolver.resolve(ctx);
    expect(resolution.winner).toBe('security-agent');
    expect(resolution.resolution).toContain('Security vs delivery');
  });

  it('should resolve qa_vs_developer critical with qa as winner', () => {
    const ctx: ConflictContext = {
      type: 'qa_vs_developer',
      agents: ['qa-agent', 'dev-agent'],
      issue: 'QA blocks release',
      evidence: ['3 critical bugs open'],
      severity: 'critical',
    };
    const resolution = resolver.resolve(ctx);
    expect(resolution.winner).toBe('qa-agent');
  });

  it('should escalate custom conflict without evidence', () => {
    const ctx: ConflictContext = {
      type: 'custom',
      agents: ['agent-a', 'agent-b'],
      issue: 'Disagree on architecture approach',
      severity: 'medium',
    };
    const resolution = resolver.resolve(ctx);
    expect(resolution.escalation).toBe('architect -> cto');
    expect(resolution.winner).toBeUndefined();
  });

  it('should use correct template for backend_vs_frontend', () => {
    const ctx: ConflictContext = {
      type: 'backend_vs_frontend',
      agents: ['backend-agent', 'frontend-agent'],
      issue: 'Contract boundary dispute',
      severity: 'medium',
    };
    const resolution = resolver.resolve(ctx);
    expect(resolution.resolution).toContain('Contract boundary');
    expect(resolution.steps.length).toBeGreaterThan(0);
    expect(resolution.escalation).toContain('architect');
  });

  it('should track resolution history', () => {
    resolver.resolve({
      type: 'security_vs_feature',
      agents: ['sec', 'feat'],
      issue: 'test',
      severity: 'high',
    });
    resolver.resolve({
      type: 'qa_vs_developer',
      agents: ['qa', 'dev'],
      issue: 'test',
      severity: 'medium',
    });
    const allHistory = resolver.getResolutionHistory();
    expect(allHistory).toHaveLength(2);
    const securityOnly = resolver.getResolutionHistory('security_vs_feature');
    expect(securityOnly).toHaveLength(1);
  });
});

// ============================================================
// EscalationManager
// ============================================================

describe('EscalationManager', () => {
  let manager: EscalationManager;

  beforeEach(() => {
    manager = new EscalationManager();
  });

  it('should escalate payment_failure', () => {
    const event = manager.check({ type: 'payment_failure' });
    expect(event).not.toBeNull();
    expect(event!.action).toContain('surgical_team');
    expect(event!.status).toBe('triggered');
  });

  it('should escalate security vulnerability', () => {
    const event = manager.check({ type: 'security vulnerability' });
    expect(event).not.toBeNull();
    expect(event!.action).toContain('immune');
    expect(event!.status).toBe('triggered');
  });

  it('should NOT escalate normal event', () => {
    const event = manager.check({ type: 'code_review' });
    expect(event).toBeNull();
  });

  it('should resolve an escalation', () => {
    const event = manager.check({ type: 'production incident' });
    expect(event).not.toBeNull();
    const resolved = manager.resolve(event!.triggerId);
    expect(resolved).toBe(true);
    expect(manager.getActiveEscalations()).toHaveLength(0);
  });

  it('should retry and eventually fail', () => {
    // schema-migration has retry: 1
    const event = manager.check({ type: 'schema migration' });
    expect(event).not.toBeNull();

    // First retry should succeed
    const retry1 = manager.retry(event!.triggerId);
    expect(retry1).toBe(true);

    // Second retry should fail (exceeds retry: 1)
    const retry2 = manager.retry(event!.triggerId);
    expect(retry2).toBe(false);
    expect(manager.getActiveEscalations()).toHaveLength(0);
  });

  it('should prune old resolved events', () => {
    const event = manager.check({ type: 'payment_failure' });
    manager.resolve(event!.triggerId);

    // Manually backdate the timestamp
    const history = manager.getEscalationHistory();
    history[0].timestamp = new Date(Date.now() - 10_000).toISOString();

    const pruned = manager.prune(5_000); // prune events older than 5s
    expect(pruned).toBe(1);
    expect(manager.getEscalationHistory()).toHaveLength(0);
  });

  it('should list active escalations', () => {
    manager.check({ type: 'payment_failure' });
    manager.check({ type: 'security vulnerability' });
    expect(manager.getActiveEscalations()).toHaveLength(2);
  });

  it('should accept custom triggers', () => {
    const customManager = new EscalationManager([
      {
        id: 'custom-trigger',
        condition: 'custom_event',
        action: 'custom_action',
        timeout: 'immediate',
        retry: 0,
        severity: 'low',
      },
    ]);
    const event = customManager.check({ type: 'custom_event' });
    expect(event).not.toBeNull();
    expect(event!.action).toBe('custom_action');
  });
});

// ============================================================
// BosLearningEngine
// ============================================================

describe('BosLearningEngine', () => {
  let engine: BosLearningEngine;

  beforeEach(() => {
    engine = new BosLearningEngine();
  });

  it('should record a behavioral record and return stats', async () => {
    await engine.record(makeRecord({ dna: 'surgical-team', success: true }));
    await engine.record(makeRecord({ dna: 'surgical-team', success: true }));

    const stats = engine.getStats();
    expect(stats.totalRecords).toBe(2);
    expect(stats.patterns).toBe(1);
    expect(stats.overallSuccessRate).toBe(1);
  });

  it('should analyze with insufficient data (< 3 samples)', async () => {
    await engine.record(makeRecord({ dna: 'manufacturing' }));

    const insights = engine.analyze('manufacturing');
    expect(insights).toHaveLength(1);
    expect(insights[0].sampleSize).toBe(1);
    expect(insights[0].recommendation).toBe('reinforce');
    expect(insights[0].suggestedMutation).toBe('Insufficient data for analysis');
  });

  it('should analyze with sufficient data and recommend mutate', async () => {
    // 4 out of 6 succeed => 66.7% success rate => between 0.6 and 0.8 => mutate
    const records: BehavioralRecord[] = [
      makeRecord({ dna: 'manufacturing', success: true, quality: 0.8 }),
      makeRecord({ dna: 'manufacturing', success: true, quality: 0.8 }),
      makeRecord({ dna: 'manufacturing', success: false, quality: 0.5 }),
      makeRecord({ dna: 'manufacturing', success: true, quality: 0.75 }),
      makeRecord({ dna: 'manufacturing', success: false, quality: 0.4 }),
      makeRecord({ dna: 'manufacturing', success: true, quality: 0.9 }),
    ];
    for (const r of records) await engine.record(r);

    const insights = engine.analyze('manufacturing');
    expect(insights).toHaveLength(1);
    expect(insights[0].sampleSize).toBe(6);
    expect(insights[0].successRate).toBeCloseTo(4 / 6, 2);
    expect(insights[0].recommendation).toBe('mutate');
  });

  it('should analyze and recommend abandon for low success rate', async () => {
    // 2 out of 5 succeed => 40% < 0.6 => abandon
    const records: BehavioralRecord[] = [
      makeRecord({ dna: 'ant-colony', success: false }),
      makeRecord({ dna: 'ant-colony', success: true }),
      makeRecord({ dna: 'ant-colony', success: false }),
      makeRecord({ dna: 'ant-colony', success: false }),
      makeRecord({ dna: 'ant-colony', success: true }),
    ];
    for (const r of records) await engine.record(r);

    const insights = engine.analyze('ant-colony');
    expect(insights[0].recommendation).toBe('abandon');
    expect(insights[0].suggestedMutation).toContain('switching');
  });

  it('should suggestMutations when enough data', async () => {
    // 60% failure rate > 30% threshold => risk_tolerance mutation
    const records: BehavioralRecord[] = [
      makeRecord({ dna: 'bee-colony', success: false, quality: 0.5 }),
      makeRecord({ dna: 'bee-colony', success: false, quality: 0.4 }),
      makeRecord({ dna: 'bee-colony', success: false, quality: 0.3 }),
      makeRecord({ dna: 'bee-colony', success: true, quality: 0.6 }),
      makeRecord({ dna: 'bee-colony', success: true, quality: 0.55 }),
      makeRecord({ dna: 'bee-colony', success: true, quality: 0.5 }),
    ];
    for (const r of records) await engine.record(r);

    const mutations = engine.suggestMutations('bee-colony');
    expect(mutations.length).toBeGreaterThanOrEqual(1);
    expect(mutations[0].field).toBe('risk_tolerance');
  });

  it('should return empty mutations for insufficient data', async () => {
    await engine.record(makeRecord({ dna: 'manufacturing' }));
    const mutations = engine.suggestMutations('manufacturing');
    expect(mutations).toHaveLength(0);
  });

  it('should analyze all patterns when no dna specified', async () => {
    await engine.record(makeRecord({ dna: 'manufacturing' }));
    await engine.record(makeRecord({ dna: 'manufacturing' }));
    await engine.record(makeRecord({ dna: 'manufacturing' }));
    await engine.record(makeRecord({ dna: 'surgical-team' }));
    await engine.record(makeRecord({ dna: 'surgical-team' }));
    await engine.record(makeRecord({ dna: 'surgical-team' }));

    const insights = engine.analyze();
    expect(insights.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// AuditChain
// ============================================================

describe('AuditChain', () => {
  let chain: AuditChain;

  beforeEach(() => {
    chain = new AuditChain('/tmp/test-project');
  });

  it('should list 16 default steps', () => {
    const steps = chain.listSteps();
    expect(steps).toHaveLength(16);
  });

  it('should return lint + typecheck for commit trigger', () => {
    const commitSteps = chain.getStepsForTrigger('commit');
    expect(commitSteps).toHaveLength(2);
    expect(commitSteps.map((s) => s.name)).toEqual(['lint', 'typecheck']);
  });

  it('should add and remove steps', () => {
    chain.addStep({
      name: 'custom_check',
      trigger: 'pr',
      tool: 'custom',
      command: 'echo custom',
      gate: 'warn',
    });
    expect(chain.listSteps()).toHaveLength(17);

    chain.removeStep('custom_check');
    expect(chain.listSteps()).toHaveLength(16);
  });

  it('should return pr steps including unit_tests and contract_compatibility', () => {
    const prSteps = chain.getStepsForTrigger('pr');
    const names = prSteps.map((s) => s.name);
    expect(names).toContain('unit_tests');
    expect(names).toContain('contract_compatibility');
  });

  it('should remove existing step by name', () => {
    chain.removeStep('lint');
    const commitSteps = chain.getStepsForTrigger('commit');
    expect(commitSteps.map((s) => s.name)).not.toContain('lint');
    expect(commitSteps).toHaveLength(1);
  });
});

// ============================================================
// DnaResolver
// ============================================================

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

vi.mock('fs');
vi.mock('yaml');

describe('DnaResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupCatalogMock(catalogData: Record<string, Record<string, unknown>>) {
    const mockedReadFileSync = vi.mocked(readFileSync);
    const mockedParse = vi.mocked(parseYaml);

    mockedReadFileSync.mockImplementation((path: unknown) => {
      const fileName = String(path).split(/[/\\]/).pop() ?? '';
      const name = fileName.replace('.yaml', '');
      if (catalogData[name]) {
        return JSON.stringify(catalogData[name]);
      }
      throw new Error(`ENOENT: ${path}`);
    });

    mockedParse.mockImplementation((content: unknown) => {
      try {
        return JSON.parse(String(content));
      } catch {
        return {};
      }
    });
  }

  it('should initialize with catalogPath and load available DNAs', () => {
    const catalogData = {
      manufacturing: { identity: { name: 'Manufacturing' } },
      'immune-system': { identity: { name: 'Immune System' } },
    };
    setupCatalogMock(catalogData);

    const resolver = new DnaResolver('/fake/path');
    const available = resolver.listCatalogDnas();
    expect(available).toContain('manufacturing');
    expect(available).toContain('immune-system');
  });

  it('should resolve a primary DNA that exists in catalog', () => {
    const catalogData = {
      manufacturing: {
        identity: {
          name: 'Manufacturing',
          description: 'Pipeline',
          archetype: 'worker',
          category: 'execution',
        },
        personality: { precision: 'high' },
        principles: [
          { id: 'p1', statement: 'Plan first', priority: 'high', rationale: 'Reduce waste' },
        ],
        forbidden: [{ id: 'f1', action: 'Skip tests', consequence: 'Block', severity: 'critical' }],
        decision_model: {},
        communication: {},
        autonomy: { level: 'low' },
        risk_tolerance: 'low',
        parallelism: {},
        quality_gates: {},
        learning: {},
      },
    };
    setupCatalogMock(catalogData);

    const resolver = new DnaResolver('/fake/path');
    const resolved = resolver.resolve({ primary: 'manufacturing' }, { id: 'agent-1' });

    expect(resolved.identity.name).toBe('Manufacturing');
    expect(resolved.risk_tolerance).toBe('low');
    expect(resolved.principles).toHaveLength(1);
    expect(resolved._sources).toContain('catalog:manufacturing');
  });

  it('should throw when primary DNA does not exist', () => {
    setupCatalogMock({});

    const resolver = new DnaResolver('/fake/path');
    expect(() => resolver.resolve({ primary: 'non-existent-pattern' }, { id: 'agent-1' })).toThrow(
      'DNA pattern not found: non-existent-pattern',
    );
  });

  it('should merge squad and agent overrides', () => {
    const catalogData = {
      'surgical-team': {
        identity: {
          name: 'Surgical Team',
          description: 'Precision',
          archetype: 'surgeon',
          category: 'quality',
        },
        personality: { precision: 'very_high' },
        principles: [],
        forbidden: [],
        decision_model: {},
        communication: {},
        autonomy: { level: 'medium' },
        risk_tolerance: 'low',
        parallelism: {},
        quality_gates: {},
        learning: {},
      },
    };
    setupCatalogMock(catalogData);

    const resolver = new DnaResolver('/fake/path');
    const resolved = resolver.resolve(
      { primary: 'surgical-team', secondary: 'manufacturing' },
      {
        id: 'agent-1',
        dnaOverrides: {
          identity: { name: 'Custom Surgical Agent' },
        },
      },
    );

    expect(resolved.identity.name).toBe('Custom Surgical Agent');
    expect(resolved._sources).toContain('agent:agent-1');
    expect(resolved._sources.some((s) => s.startsWith('catalog:surgical-team'))).toBe(true);
  });
});
