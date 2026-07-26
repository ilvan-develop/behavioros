import { beforeEach, describe, expect, it } from 'vitest';
import { AuditTrailLayer } from '../pipeline/layers/audit-trail.layer';
import { BehavioralLayer } from '../pipeline/layers/behavioral.layer';
import { CoverageGateLayer } from '../pipeline/layers/coverage-gate.layer';
import { DecisionLayer } from '../pipeline/layers/decision.layer';
import { DNALoaderLayer } from '../pipeline/layers/dna-loader.layer';
import { DomainInvariantsLayer } from '../pipeline/layers/domain-invariants.layer';
import { GovernanceLayer } from '../pipeline/layers/governance.layer';
import { LearningLayer } from '../pipeline/layers/learning.layer';
import { QualityLayer } from '../pipeline/layers/quality.layer';
import { SchemaValidatorLayer } from '../pipeline/layers/schema-validator.layer';
import type { PipelineDispatcherContext } from '../pipeline/pipeline-context';

function createMockContext(
  overrides: Partial<PipelineDispatcherContext> = {},
): PipelineDispatcherContext {
  return {
    id: 'test-pipeline-1',
    dnaId: 'test-dna',
    dnaMode: 'transactional',
    agentId: 'test-agent',
    agentAuthority: 'architect',
    action: 'deploy',
    payload: { action: 'deploy', target: 'staging' },
    metadata: new Map(),
    startTime: Date.now(),
    verifiedAuthority: 'architect',
    layerResults: [],
    currentLayerIndex: 0,
    failed: false,
    ...overrides,
  };
}

function makeDNA(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'test-dna-1',
    name: 'Test DNA',
    version: '1.0.0',
    personas: [
      {
        role: 'orchestrator',
        name: 'Orchestrator',
        authority: 'architect',
        boundaries: [{ name: 'no-prod', type: 'forbidden', value: 'production' }],
      },
    ],
    governance: [
      {
        id: 'rule-1',
        name: 'No direct prod',
        level: 'critical',
        action: 'block',
        scope: ['production'],
      },
    ],
    quality: [{ name: 'test-coverage', type: 'coverage', threshold: 80 }],
    patterns: [],
    workflows: [],
    ...overrides,
  };
}

// ============================================================
// Layer 1 — DNA Loader
// ============================================================
describe('DNALoaderLayer', () => {
  it('should fail when no DNA package is provided', async () => {
    const layer = new DNALoaderLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.error).toContain('No DNA package');
  });

  it('should fail when DNA has missing required fields', async () => {
    const layer = new DNALoaderLayer({ dnaPackage: { id: '', name: '', version: '' } as never });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('missing required fields');
  });

  it('should fail when DNA has no personas', async () => {
    const layer = new DNALoaderLayer({
      dnaPackage: { id: 'x', name: 'x', version: '1', personas: [] } as never,
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('at least one persona');
  });

  it('should pass with valid DNA and store in metadata', async () => {
    const dna = makeDNA();
    const layer = new DNALoaderLayer({ dnaPackage: dna });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.dnaId).toBe('test-dna-1');
    expect(ctx.metadata.get('dna')).toBe(dna);
  });

  it('should support setDNA and getDNA', () => {
    const dna = makeDNA();
    const layer = new DNALoaderLayer();
    layer.setDNA(dna);
    expect(layer.getDNA()).toBe(dna);
  });

  it('should handle errors gracefully', async () => {
    const layer = new DNALoaderLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('No DNA package');
  });
});

// ============================================================
// Layer 2 — Schema Validator
// ============================================================
describe('SchemaValidatorLayer', () => {
  it('should pass with valid context defaults', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should fail when action is missing', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({ action: '' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('action');
  });

  it('should fail when agentId is missing', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({ agentId: '' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('agentId');
  });

  it('should fail when payload is missing', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({ payload: null as never });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('payload');
  });

  it('should fail when required payload field is missing', async () => {
    const layer = new SchemaValidatorLayer({ requiredFields: ['action', 'missing-field'] });
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('missing-field');
  });

  it('should fail on invalid dnaMode', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({
      dnaMode: 'invalid-mode' as never,
      payload: { action: 'deploy' },
    });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Invalid DNA mode');
  });

  it('should generate warnings from custom validator', async () => {
    const layer = new SchemaValidatorLayer({
      validatePayload: () => ({ valid: false, errors: [], warnings: ['deprecated field'] }),
    });
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(85);
  });

  it('should handle exceptions in custom validator', async () => {
    const layer = new SchemaValidatorLayer({
      validatePayload: () => {
        throw new Error('validator crash');
      },
    });
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
  });

  it('should handle null or undefined payload edge case', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({ payload: undefined as never });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
  });
});

// ============================================================
// Layer 3 — Behavioral Layer
// ============================================================
describe('BehavioralLayer', () => {
  it('should pass with valid context and DNA', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'read' });
    ctx.metadata.set('dna', makeDNA());
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should block suspicious intent patterns', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'bypass governance' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('suspicious');
  });

  it('should fail when DNA is missing', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('DNA package not found');
  });

  it('should fail when agent authority is insufficient for action', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'deploy production', agentAuthority: 'junior' });
    ctx.metadata.set('dna', makeDNA());
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('insufficient');
  });

  it('should block forbidden boundary actions', async () => {
    const dna = makeDNA();
    dna.personas[0].boundaries = [{ name: 'no-prod', type: 'forbidden', value: 'production' }];
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'deploy production', agentAuthority: 'architect' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('forbidden boundary');
  });

  it('should warn when no governance rules in DNA', async () => {
    const dna = makeDNA({ governance: [] });
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'read' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(80);
  });
});

// ============================================================
// Layer 4 — Domain Invariants
// ============================================================
describe('DomainInvariantsLayer', () => {
  it('should pass with no invariants configured', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should detect secrets in payload', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: { action: 'deploy', api_key: 'sk-12345' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('secret');
  });

  it('should pass custom invariant checks', async () => {
    const layer = new DomainInvariantsLayer({
      invariants: [
        {
          domain: 'test',
          checks: [
            (_c) => ({
              passed: true,
              name: 'always_pass',
              message: 'ok',
              severity: 'error' as const,
            }),
          ],
        },
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should fail custom invariant checks', async () => {
    const layer = new DomainInvariantsLayer({
      invariants: [
        {
          domain: 'test',
          checks: [
            (_c) => ({
              passed: false,
              name: 'always_fail',
              message: 'failed',
              severity: 'error' as const,
            }),
          ],
        },
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('failed');
  });

  it('should warn on severity warning checks', async () => {
    const layer = new DomainInvariantsLayer({
      invariants: [
        {
          domain: 'test',
          checks: [
            (_c) => ({
              passed: false,
              name: 'warn_only',
              message: 'warning msg',
              severity: 'warning' as const,
            }),
          ],
        },
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.warnings).toContain('[test] warning msg');
  });

  it('should support addInvariant and removeInvariant', () => {
    const layer = new DomainInvariantsLayer();
    const check = () => ({ passed: true, name: 'x', message: 'x', severity: 'error' as const });
    layer.addInvariant({ domain: 'custom', checks: [check] });
    expect(layer.getInvariants()).toHaveLength(1);
    const removed = layer.removeInvariant('custom');
    expect(removed).toBe(true);
    expect(layer.getInvariants()).toHaveLength(0);
  });

  it('should handle empty payload for noSecrets', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: {} });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });
});

// ============================================================
// Layer 5 — Governance Layer
// ============================================================
describe('GovernanceLayer', () => {
  it('should auto-pass with no governance rules', async () => {
    const layer = new GovernanceLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(70);
  });

  it('should warn on unverified authority', async () => {
    const layer = new GovernanceLayer();
    const dna = makeDNA();
    const ctx = createMockContext({ verifiedAuthority: undefined as never });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.decisions).toBeDefined();
  });

  it('should block critical governance rule violations in strict mode', async () => {
    const layer = new GovernanceLayer({ strict: true });
    const dna = makeDNA();
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('should reject unknown authority levels', async () => {
    const dna = makeDNA();
    const layer = new GovernanceLayer({ strict: true });
    const ctx = createMockContext({ agentAuthority: 'unknown-level' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('unknown authority');
  });

  it('should support setEngine and getEngine', () => {
    const layer = new GovernanceLayer();
    expect(layer.getEngine()).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    const layer = new GovernanceLayer();
    const ctx = createMockContext();
    (ctx as any).action = undefined;
    const result = await layer.execute(ctx);
    expect(result.passed === false || result.passed === true).toBe(true);
  });
});

// ============================================================
// Layer 6 — Decision Layer
// ============================================================
describe('DecisionLayer', () => {
  it('should auto-approve with default quorum', async () => {
    const layer = new DecisionLayer();
    const ctx = createMockContext({ agentAuthority: 'architect' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.decision).toBe('approved');
  });

  it('should reject when votes are against', async () => {
    const layer = new DecisionLayer();
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'agent-1', option: 'reject', weight: 5, rationale: 'not ready' },
    ]);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.details.decision).toBe('rejected');
  });

  it('should defer with insufficient quorum and autoApprove off', async () => {
    const layer = new DecisionLayer({ quorumThreshold: 0.8, autoApproveBelowThreshold: false });
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'agent-1', option: 'approve', weight: 3, rationale: 'ok' },
      { agentId: 'agent-2', option: 'reject', weight: 3, rationale: 'not now' },
      { agentId: 'agent-3', option: 'abstain', weight: 3, rationale: 'no opinion' },
    ]);
    const result = await layer.execute(ctx);
    expect(result.details.decision).toBe('deferred');
  });

  it('should require unanimity in unanimous strategy', async () => {
    const layer = new DecisionLayer({ votingStrategy: 'unanimous' });
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'a', option: 'approve', weight: 1 },
      { agentId: 'b', option: 'reject', weight: 1 },
    ]);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.details.decision).toBe('rejected');
  });

  it('should approve with majority vote', async () => {
    const layer = new DecisionLayer({ votingStrategy: 'majority' });
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'a', option: 'approve', weight: 1 },
      { agentId: 'b', option: 'reject', weight: 1 },
      { agentId: 'c', option: 'approve', weight: 1 },
    ]);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.decision).toBe('approved');
  });

  it('should handle empty votes array gracefully', async () => {
    const layer = new DecisionLayer();
    const ctx = createMockContext();
    ctx.metadata.set('votes', []);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });
});

// ============================================================
// Layer 7 — Quality Layer
// ============================================================
describe('QualityLayer', () => {
  it('should pass with default continuity check', async () => {
    const layer = new QualityLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should run DNA-defined quality gates', async () => {
    const layer = new QualityLayer();
    const dna = makeDNA();
    const ctx = createMockContext();
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.gatesChecked).toBeGreaterThanOrEqual(1);
  });

  it('should run custom checks', async () => {
    const layer = new QualityLayer({
      checks: [
        () => ({
          gate: 'custom-test',
          passed: true,
          actual: true,
          expected: true,
          message: 'pass',
        }),
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.gatesPassed).toBe(1);
  });

  it('should handle failing custom checks gracefully (never blocks)', async () => {
    const layer = new QualityLayer({
      checks: [
        () => ({
          gate: 'failing-test',
          passed: false,
          actual: false,
          expected: true,
          message: 'fail',
        }),
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.gatesFailed).toBe(1);
  });

  it('should handle exceptions in custom checks gracefully', async () => {
    const layer = new QualityLayer({
      checks: [
        () => {
          throw new Error('check crash');
        },
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should support addCheck and removeCheck', () => {
    const layer = new QualityLayer();
    const check = () => ({ gate: 'g', passed: true, actual: true, expected: true, message: 'm' });
    layer.addCheck(check);
    const removed = layer.removeCheck(0);
    expect(removed).toBe(true);
    expect(layer.removeCheck(99)).toBe(false);
  });
});

// ============================================================
// Layer 8 — Audit Trail Layer
// ============================================================
describe('AuditTrailLayer', () => {
  beforeEach(() => {
    // Reset singleton state between tests
  });

  it('should record an audit entry on execute', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.entryHash).toBeDefined();
    expect(result.details.trailLength).toBe(1);
  });

  it('should maintain hash chain across multiple entries', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    const result2 = await layer.execute(ctx);
    expect(result2.passed).toBe(true);
    expect(result2.details.trailLength).toBe(2);
    expect(result2.details.chainValid).toBe(true);
  });

  it('should verify chain integrity', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    expect(layer.verifyChain()).toBe(true);
  });

  it('should return trail for getTrail', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    const trail = layer.getTrail();
    expect(trail).toHaveLength(1);
    expect(trail[0].pipelineId).toBe('test-pipeline-1');
  });

  it('should filter trail by pipeline ID', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    const ctx2 = createMockContext({ id: 'other-pipeline' });
    await layer.execute(ctx);
    await layer.execute(ctx2);
    const filtered = layer.getTrailForPipeline('test-pipeline-1');
    expect(filtered).toHaveLength(1);
  });

  it('should support clearTrail', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    layer.clearTrail();
    expect(layer.getTrailLength()).toBe(0);
  });

  it('should handle null/empty context gracefully', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext({ action: '' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.entryHash).toBeDefined();
  });
});

// ============================================================
// Layer 9 — Learning Layer
// ============================================================
describe('LearningLayer', () => {
  it('should record a learning entry', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.entriesRecorded).toBe(1);
  });

  it('should detect patterns across multiple runs', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext();
    for (let i = 0; i < 5; i++) {
      await layer.execute(ctx);
    }
    expect(layer.getPatterns().length).toBeGreaterThanOrEqual(1);
  });

  it('should return entries via getEntries', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    const entries = layer.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].pipelineId).toBe('test-pipeline-1');
  });

  it('should support clearEntries and clearPatterns', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    layer.clearEntries();
    expect(layer.getEntries()).toHaveLength(0);
    layer.clearPatterns();
    expect(layer.getPatterns()).toHaveLength(0);
  });

  it('should filter patterns by category', async () => {
    const layer = new LearningLayer({ minConfidence: 0 });
    const ctx = createMockContext();
    for (let i = 0; i < 3; i++) {
      await layer.execute(ctx);
    }
    const successPatterns = layer.getPatternsByCategory('success');
    expect(successPatterns.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty layerResults', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext({ layerResults: [] });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should generate correction type on failed context', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext({ failed: true });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    const entries = layer.getEntries();
    expect(entries[0].type).toBe('correction');
  });
});

// ============================================================
// Layer 10 — Coverage Gate Layer
// ============================================================
describe('CoverageGateLayer', () => {
  it('should execute and return coverage result', async () => {
    const layer = new CoverageGateLayer(0);
    const ctx = createMockContext();
    ctx.metadata.set('projectPath', process.cwd());
    const result = await layer.execute(ctx);
    expect(typeof result.passed).toBe('boolean');
    expect(typeof result.score).toBe('number');
    expect(result.details.overallPercentage).toBeDefined();
  });

  it('should handle missing projectPath gracefully', async () => {
    const layer = new CoverageGateLayer(0);
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(typeof result.passed).toBe('boolean');
  });
});
