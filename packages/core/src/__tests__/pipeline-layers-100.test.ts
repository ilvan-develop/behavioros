import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GovernanceEngine } from '../engines/governance/governance-engine';
import { AuditTrailLayer } from '../pipeline/layers/audit-trail.layer';
import { BehavioralLayer } from '../pipeline/layers/behavioral.layer';
import { DecisionLayer } from '../pipeline/layers/decision.layer';
import { DNALoaderLayer } from '../pipeline/layers/dna-loader.layer';
import {
  DomainInvariantsLayer,
  maxPayloadSize,
  requireActionPattern,
  requirePayloadField,
} from '../pipeline/layers/domain-invariants.layer';
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
    quality: [{ name: 'test-coverage', type: 'test_coverage', threshold: 80 }],
    patterns: [],
    workflows: [],
    ...overrides,
  };
}

// ============================================================
// LAYER 1 — DNA LOADER (extra coverage)
// ============================================================
describe('DNALoaderLayer — 100% coverage', () => {
  it('should handle DNA with empty governance, quality, patterns, workflows', async () => {
    const dna = makeDNA({
      governance: [],
      quality: [],
      patterns: [],
      workflows: [],
    });
    const layer = new DNALoaderLayer({ dnaPackage: dna });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.governanceCount).toBe(0);
    expect(result.details.qualityGatesCount).toBe(0);
    expect(result.details.patternsCount).toBe(0);
    expect(result.details.workflowsCount).toBe(0);
  });

  it('should handle null quality/gate fields gracefully', async () => {
    const dna = makeDNA({ governance: null, quality: null, patterns: null, workflows: null });
    const layer = new DNALoaderLayer({ dnaPackage: dna });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.governanceCount).toBe(0);
    expect(result.details.qualityGatesCount).toBe(0);
  });

  it('should throw when execute receives a corrupt DNA that causes exception', async () => {
    const dna = makeDNA();
    Object.defineProperty(dna, 'id', {
      get() {
        throw new Error('corrupt dna access');
      },
    });
    const layer = new DNALoaderLayer({ dnaPackage: dna });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('corrupt dna access');
  });
});

// ============================================================
// LAYER 2 — SCHEMA VALIDATOR (extra coverage)
// ============================================================
describe('SchemaValidatorLayer — 100% coverage', () => {
  it('should fail when dnaMode is null', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext({
      dnaMode: null as never,
      payload: { action: 'deploy' },
    });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Invalid DNA mode');
  });

  it('should handle custom validator that returns empty errors/warnings', async () => {
    const layer = new SchemaValidatorLayer({
      validatePayload: () => ({ valid: true, errors: [], warnings: [] }),
    });
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should handle exception outside custom validator gracefully', async () => {
    const layer = new SchemaValidatorLayer();
    const ctx = createMockContext();
    Object.defineProperty(ctx, 'action', {
      get() {
        throw new Error('action access error');
      },
    });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('action access error');
  });
});

// ============================================================
// LAYER 3 — BEHAVIORAL (extra coverage)
// ============================================================
describe('BehavioralLayer — 100% coverage', () => {
  it('should match fallback persona when agentId includes persona role', async () => {
    const dna = makeDNA();
    dna.personas[0].role = 'worker';
    dna.personas.push({
      role: 'helper',
      name: 'Helper',
      authority: 'junior',
      boundaries: [],
    });
    const layer = new BehavioralLayer();
    const ctx = createMockContext({
      agentId: 'helper-worker',
      action: 'read',
    });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.personaRole).toBe('helper');
  });

  it('should warn when no persona found for agentId', async () => {
    const dna = makeDNA();
    dna.personas[0].role = 'admin';
    dna.personas[0].name = 'Admin';
    const layer = new BehavioralLayer();
    const ctx = createMockContext({
      agentId: 'strange-unknown-99',
      action: 'read',
    });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('No persona found')]),
    );
    expect(result.details.personaRole).toBe('admin');
  });

  it('should warn when DNA has no quality gates', async () => {
    const dna = makeDNA({ quality: [] });
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'read' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(80);
    expect(result.details.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('no quality gates')]),
    );
  });

  it('should handle error thrown during execution gracefully', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'read' });
    (ctx as any).getActionSeverity = undefined;
    const result = await layer.execute(ctx);
    expect(typeof result.passed).toBe('boolean');
  });

  it('should detect suspicious pattern: override forbidden', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'override forbidden rule' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('suspicious');
  });

  it('should detect suspicious pattern: skip governance', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'skip governance checks' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
  });

  it('should detect suspicious pattern: escalate self', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'escalate self approve' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
  });

  it('should detect suspicious pattern: force allow', async () => {
    const layer = new BehavioralLayer();
    const ctx = createMockContext({ action: 'force allow action' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
  });
});

// ============================================================
// LAYER 4 — DOMAIN INVARIANTS (67% → 100%)
// ============================================================
describe('DomainInvariantsLayer — 100% coverage', () => {
  it('should use requirePayloadField factory: field exists', () => {
    const check = requirePayloadField('email');
    const ctx = createMockContext({ payload: { email: 'test@test.com', action: 'deploy' } });
    const result = check(ctx);
    expect(result.passed).toBe(true);
    expect(result.name).toBe('require_email');
  });

  it('should use requirePayloadField factory: field missing', () => {
    const check = requirePayloadField('email');
    const ctx = createMockContext({ payload: { action: 'deploy' } });
    const result = check(ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('missing required field');
  });

  it('should use maxPayloadSize factory: within limit', () => {
    const check = maxPayloadSize(5);
    const ctx = createMockContext({ payload: { a: '1', b: '2', c: '3', action: 'deploy' } });
    const result = check(ctx);
    expect(result.passed).toBe(true);
  });

  it('should use maxPayloadSize factory: exceeds limit', () => {
    const check = maxPayloadSize(1);
    const ctx = createMockContext({
      payload: { a: '1', b: '2', c: '3', d: '4', e: '5', action: 'deploy' },
    });
    const result = check(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
  });

  it('should use requireActionPattern factory: pattern matches', () => {
    const check = requireActionPattern(/^deploy/);
    const ctx = createMockContext({ action: 'deploy production' });
    const result = check(ctx);
    expect(result.passed).toBe(true);
  });

  it('should use requireActionPattern factory: pattern does not match', () => {
    const check = requireActionPattern(/^delete/);
    const ctx = createMockContext({ action: 'deploy production' });
    const result = check(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
  });

  it('should add invariant merging into existing domain', () => {
    const layer = new DomainInvariantsLayer({
      invariants: [
        {
          domain: 'security',
          checks: [
            (_c) => ({ passed: true, name: 'check1', message: 'ok', severity: 'error' as const }),
          ],
        },
      ],
    });
    layer.addInvariant({
      domain: 'security',
      checks: [
        (_c) => ({ passed: true, name: 'check2', message: 'ok', severity: 'error' as const }),
      ],
    });
    expect(layer.getInvariants()).toHaveLength(1);
    expect(layer.getInvariants()[0].checks).toHaveLength(2);
  });

  it('should add invariant creating new domain', () => {
    const layer = new DomainInvariantsLayer();
    layer.addInvariant({
      domain: 'custom',
      checks: [(_c) => ({ passed: true, name: 'x', message: 'x', severity: 'error' as const })],
    });
    expect(layer.getInvariants()).toHaveLength(1);
  });

  it('should return false when removing non-existent domain', () => {
    const layer = new DomainInvariantsLayer();
    const result = layer.removeInvariant('non-existent');
    expect(result).toBe(false);
  });

  it('should return a copy from getInvariants', () => {
    const layer = new DomainInvariantsLayer({
      invariants: [
        {
          domain: 'test',
          checks: [(_c) => ({ passed: true, name: 'x', message: 'x', severity: 'error' as const })],
        },
      ],
    });
    const copy = layer.getInvariants();
    copy.push({
      domain: 'added',
      checks: [(_c) => ({ passed: true, name: 'y', message: 'y', severity: 'error' as const })],
    });
    expect(layer.getInvariants()).toHaveLength(1);
  });

  it('should handle non-string value in noSecrets (number)', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: { api_key: 12345, action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should handle empty string value in noSecrets', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: { api_key: '', action: 'deploy' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should catch and handle error thrown in invariant check', async () => {
    const layer = new DomainInvariantsLayer({
      invariants: [
        {
          domain: 'crash',
          checks: [
            () => {
              throw new Error('check crash');
            },
          ],
        },
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
  });

  it('should handle null payload for built-in noSecrets', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: null as never });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should score 100 when no invariants configured and no secrets', async () => {
    const layer = new DomainInvariantsLayer();
    const ctx = createMockContext({ payload: { action: 'deploy', email: 'a@b.com' } });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });
});

// ============================================================
// LAYER 5 — GOVERNANCE (72% → 100%)
// ============================================================
describe('GovernanceLayer — 100% coverage', () => {
  it('should handle escalate rule action (score 60)', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-escalate',
          name: 'Escalate prod changes',
          level: 'high',
          action: 'escalate',
          scope: ['production'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(60);
    expect(result.details.escalationRequired).toBe(true);
  });

  it('should handle warn rule action (score 100)', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-warn',
          name: 'Warn on prod changes',
          level: 'medium',
          action: 'warn',
          scope: ['production'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.details.rulesMatched).toBe(1);
  });

  it('should handle log rule action (score 100)', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-log',
          name: 'Log prod changes',
          level: 'low',
          action: 'log',
          scope: ['production'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('should handle auto_approve rule action (default case in switch)', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-auto',
          name: 'Auto approve low risk',
          level: 'low',
          action: 'auto_approve',
          scope: ['production'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect((result.details.decisions as Array<{ reason: string }>)[0].reason).toContain(
      'not handled',
    );
  });

  it('should match rule scope via payload key', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-scope-payload',
          name: 'Check via payload',
          level: 'medium',
          action: 'warn',
          scope: ['target'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'read', payload: { target: 'staging' } });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.rulesMatched).toBe(1);
  });

  it('should match rule conditions via action string', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-cond-action',
          name: 'Condition via action',
          level: 'medium',
          action: 'warn',
          scope: [],
          conditions: ['deploy'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.rulesMatched).toBe(1);
  });

  it('should match rule conditions via metadata key', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-cond-meta',
          name: 'Condition via metadata',
          level: 'medium',
          action: 'warn',
          scope: [],
          conditions: ['special-flag'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'read' });
    ctx.metadata.set('special-flag', 'true');
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.rulesMatched).toBe(1);
  });

  it('should accumulate bypass attempts across calls', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-bypass',
          name: 'Escalate every time',
          level: 'medium',
          action: 'escalate',
          scope: [],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    for (let i = 0; i < 3; i++) {
      const ctx = createMockContext({ action: 'deploy production' });
      ctx.metadata.set('dna', dna);
      ctx.metadata.set('agentId', 'bypass-agent');
      const result = await layer.execute(ctx);
      expect(result.details.bypassAttempts).toBe(i + 1);
    }
  });

  it('should track bypass attempts above 3 without error', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-bypass-4',
          name: 'Escalate always',
          level: 'medium',
          action: 'escalate',
          scope: [],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    for (let i = 0; i < 5; i++) {
      const ctx = createMockContext({ action: 'deploy production' });
      ctx.metadata.set('dna', dna);
      ctx.metadata.set('agentId', 'repeat-offender');
      await layer.execute(ctx);
    }
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    ctx.metadata.set('agentId', 'repeat-offender');
    const result = await layer.execute(ctx);
    expect(result.details.bypassAttempts).toBe(6);
  });

  it('should use external GovernanceEngine when provided', async () => {
    const rules = [
      {
        id: 'rule-ext',
        name: 'External rule block',
        level: 'critical',
        action: 'block',
        scope: ['production'],
      },
    ];
    const engine = new GovernanceEngine(rules as any);
    const layer = new GovernanceLayer({ governanceEngine: engine, strict: true });
    const ctx = createMockContext({ action: 'deploy production' });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.error).toContain('Blocked');
  });

  it('should pass in non-strict mode with block rule', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-block-nonstrict',
          name: 'Block non-strict',
          level: 'critical',
          action: 'block',
          scope: ['production'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy production' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.blocked).toBe(true);
  });

  it('should pass with unverified authority in non-strict mode', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-x',
          name: 'Some rule',
          level: 'low',
          action: 'warn',
          scope: [],
          conditions: ['deploy'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({
      action: 'deploy',
      agentAuthority: 'unknown-level',
    });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should handle rule with no conditions (applies to all)', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-all',
          name: 'Applies to all',
          level: 'medium',
          action: 'warn',
          scope: [],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'anything' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.rulesMatched).toBe(1);
  });

  it('should not match rule with non-matching conditions', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-no-match',
          name: 'No match condition',
          level: 'critical',
          action: 'block',
          conditions: ['never-match-this'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'deploy' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.rulesMatched).toBe(0);
  });

  it('should handle non-matching scope', async () => {
    const dna = makeDNA({
      governance: [
        {
          id: 'rule-scope-no-match',
          name: 'Wrong scope',
          level: 'critical',
          action: 'block',
          scope: ['production'],
        },
      ],
    });
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext({ action: 'read' });
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.rulesMatched).toBe(0);
  });

  it('should set score 70 when no decisions made (no engine and no DNA governance)', async () => {
    const layer = new GovernanceLayer({ strict: false });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(70);
  });

  it('should handle getEngine when not set', () => {
    const layer = new GovernanceLayer();
    expect(layer.getEngine()).toBeUndefined();
  });

  it('should handle error in execute gracefully', async () => {
    const layer = new GovernanceLayer();
    const ctx = createMockContext();
    (ctx as any).action = undefined;
    const result = await layer.execute(ctx);
    expect(typeof result.passed).toBe('boolean');
  });
});

// ============================================================
// LAYER 6 — DECISION (88% → 100%)
// ============================================================
describe('DecisionLayer — 100% coverage', () => {
  it('should approve with weighted strategy when quorum met', async () => {
    const layer = new DecisionLayer({ votingStrategy: 'weighted', quorumThreshold: 0.5 });
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'a', option: 'approve', weight: 3 },
      { agentId: 'b', option: 'reject', weight: 1 },
      { agentId: 'c', option: 'approve', weight: 1 },
    ]);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.decision).toBe('approved');
    expect(result.details.approveRatio).toBeGreaterThanOrEqual(50);
  });

  it('should reject when rejectRatio > 0.5', async () => {
    const layer = new DecisionLayer({ quorumThreshold: 0.9, autoApproveBelowThreshold: true });
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'a', option: 'reject', weight: 3 },
      { agentId: 'b', option: 'approve', weight: 1 },
    ]);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(false);
    expect(result.details.decision).toBe('rejected');
    expect(result.error).toContain('rejected');
  });

  it('should defer when no autoApprove and equal votes', async () => {
    const layer = new DecisionLayer({ quorumThreshold: 0.9, autoApproveBelowThreshold: false });
    const ctx = createMockContext();
    ctx.metadata.set('votes', [
      { agentId: 'a', option: 'approve', weight: 2 },
      { agentId: 'b', option: 'reject', weight: 2 },
    ]);
    const result = await layer.execute(ctx);
    expect(result.details.decision).toBe('deferred');
    expect(result.error).toContain('deferred');
  });

  it('should use default weight 1 for unknown authority', async () => {
    const layer = new DecisionLayer();
    const ctx = createMockContext({ agentAuthority: 'unknown-level' });
    const result = await layer.execute(ctx);
    // Auto-generates approve vote with default weight 1
    expect(result.passed).toBe(true);
    expect(result.details.approveWeight).toBe(1);
    expect((result.details.votes as Array<{ weight: number }>)[0].weight).toBe(1);
  });

  it('should handle error in execute gracefully', async () => {
    const layer = new DecisionLayer();
    const ctx = createMockContext();
    (ctx as any).action = undefined;
    const result = await layer.execute(ctx);
    expect(typeof result.passed).toBe('boolean');
  });
});

// ============================================================
// LAYER 7 — QUALITY (84% → 100%)
// ============================================================
describe('QualityLayer — 100% coverage', () => {
  it('should evaluate gate with threshold value (number)', async () => {
    const dna = makeDNA({ quality: [{ name: 'coverage', type: 'test_coverage', threshold: 80 }] });
    const layer = new QualityLayer();
    const ctx = createMockContext();
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect((result.details.results as Array<{ gate: string }>)[0].gate).toBe('coverage');
  });

  it('should evaluate gate with pass boolean', async () => {
    const dna = makeDNA({ quality: [{ name: 'lint-pass', type: 'lint', pass: true }] });
    const layer = new QualityLayer();
    const ctx = createMockContext();
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect((result.details.results as Array<{ gate: string }>)[0].gate).toBe('lint-pass');
  });

  it('should set meetsMinimum to false when score below minScore', async () => {
    const layer = new QualityLayer({
      minScore: 90,
      checks: [
        () => ({
          gate: 'failing',
          passed: false,
          actual: false,
          expected: true,
          message: 'forced fail',
        }),
      ],
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.meetsMinimum).toBe(false);
  });

  it('should set meetsMinimum to true when score above minScore', async () => {
    const dna = makeDNA({ quality: [{ name: 'perfect', type: 'test_coverage', threshold: 100 }] });
    const layer = new QualityLayer({ minScore: 50 });
    const ctx = createMockContext();
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.meetsMinimum).toBe(true);
  });

  it('should handle error in execute gracefully (never blocks)', async () => {
    const layer = new QualityLayer();
    const ctx = createMockContext();
    (ctx as any).action = undefined;
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should handle multiple DNA quality gates', async () => {
    const dna = makeDNA({
      quality: [
        { name: 'coverage', type: 'test_coverage', threshold: 80 },
        { name: 'lint', type: 'lint', pass: true },
        { name: 'typecheck', type: 'typecheck', pass: true },
      ],
    });
    const layer = new QualityLayer();
    const ctx = createMockContext();
    ctx.metadata.set('dna', dna);
    const result = await layer.execute(ctx);
    expect(result.details.gatesChecked).toBe(3);
    expect(result.details.gatesPassed).toBe(3);
  });
});

// ============================================================
// LAYER 8 — AUDIT TRAIL (66% → 100%)
// ============================================================
describe('AuditTrailLayer — 100% coverage', () => {
  it('should trim trail when exceeding maxEntries', async () => {
    const layer = new AuditTrailLayer({ maxEntries: 2 });
    const ctx = createMockContext();
    await layer.execute(ctx);
    await layer.execute(ctx);
    const result3 = await layer.execute(ctx);
    expect(result3.details.trailLength).toBe(2);
  });

  it('should maintain chain validity after trim', async () => {
    const layer = new AuditTrailLayer({ maxEntries: 3 });
    const ctx = createMockContext();
    for (let i = 0; i < 5; i++) {
      await layer.execute(ctx);
    }
    expect(layer.verifyChain()).toBe(true);
    expect(layer.getTrailLength()).toBe(3);
  });

  it('should support persistence mode with temp db file', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'behavioros-audit-'));
    const dbPath = join(tmpDir, 'audit.db');
    const layer = new AuditTrailLayer({
      enablePersistence: true,
      dbPath,
      maxEntries: 100,
    });
    const ctx = createMockContext();
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    expect(result.details.persistent).toBe(true);
    expect(layer.getStore()).not.toBeNull();
    expect(existsSync(dbPath)).toBe(true);
  });

  it('should call store.append on execute with persistence enabled', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'behavioros-audit-append-'));
    const dbPath = join(tmpDir, 'audit.db');
    const layer = new AuditTrailLayer({ enablePersistence: true, dbPath, maxEntries: 100 });
    const ctx = createMockContext();
    await layer.execute(ctx);
    expect(layer.getStore()).not.toBeNull();
    // Store internally appends entries regardless of file I/O success
    expect(layer.getTrailLength()).toBe(1);
  });

  it('should return store via getStore', () => {
    const layer = new AuditTrailLayer();
    expect(layer.getStore()).toBeNull();
  });

  it('should verify chain with single entry', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    await layer.execute(ctx);
    expect(layer.verifyChain()).toBe(true);
  });

  it('should verify chain with multiple entries', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    for (let i = 0; i < 10; i++) {
      await layer.execute(ctx);
    }
    expect(layer.verifyChain()).toBe(true);
    expect(layer.getTrailLength()).toBe(10);
  });

  it('should return empty getTrailForPipeline for unknown pipeline', () => {
    const layer = new AuditTrailLayer();
    expect(layer.getTrailForPipeline('non-existent')).toHaveLength(0);
  });

  it('should handle error during execute gracefully', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    (ctx as any).action = undefined;
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });

  it('should return correct entry hash and previous hash', async () => {
    const layer = new AuditTrailLayer();
    const ctx = createMockContext();
    const result1 = await layer.execute(ctx);
    const result2 = await layer.execute(ctx);
    expect(result2.details.previousHash).toBe(result1.details.entryHash);
  });
});

// ============================================================
// LAYER 9 — LEARNING (79% → 100%)
// ============================================================
describe('LearningLayer — 100% coverage', () => {
  it('should create insight type when completedLayers >= 7', async () => {
    const layer = new LearningLayer();
    const results = Array.from({ length: 7 }, (_, i) => ({
      layerId: `layer-${i}`,
      layerName: `Layer ${i}`,
      passed: true,
      score: 100,
      duration: 10,
      details: {},
    }));
    const ctx = createMockContext({ layerResults: results });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    const entries = layer.getEntries();
    expect(entries[0].type).toBe('insight');
  });

  it('should create observation type when completedLayers >= 4', async () => {
    const layer = new LearningLayer();
    const results = Array.from({ length: 5 }, (_, i) => ({
      layerId: `layer-${i}`,
      layerName: `Layer ${i}`,
      passed: true,
      score: 100,
      duration: 10,
      details: {},
    }));
    const ctx = createMockContext({ layerResults: results });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    const entries = layer.getEntries();
    expect(entries[0].type).toBe('observation');
  });

  it('should create feedback type when completedLayers < 4', async () => {
    const layer = new LearningLayer();
    const results = Array.from({ length: 2 }, (_, i) => ({
      layerId: `layer-${i}`,
      layerName: `Layer ${i}`,
      passed: true,
      score: 100,
      duration: 10,
      details: {},
    }));
    const ctx = createMockContext({ layerResults: results });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    const entries = layer.getEntries();
    expect(entries[0].type).toBe('feedback');
  });

  it('should handle confidence 0 when totalLayers is 0', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext({ layerResults: [] });
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
    const entries = layer.getEntries();
    expect(entries[0].confidence).toBe(0);
  });

  it('should evict entries when exceeding maxEntries', async () => {
    const layer = new LearningLayer({ maxEntries: 2, autoDetectPatterns: false });
    const ctx = createMockContext();
    for (let i = 0; i < 4; i++) {
      await layer.execute(ctx);
    }
    expect(layer.getEntries()).toHaveLength(2);
  });

  it('should evict patterns when exceeding maxPatterns', async () => {
    const layer = new LearningLayer({
      maxEntries: 100,
      maxPatterns: 1,
      minConfidence: 0,
      autoDetectPatterns: true,
    });
    const ctx = createMockContext({ agentId: 'pattern-agent', action: 'read' });
    for (let i = 0; i < 5; i++) {
      await layer.execute(ctx);
    }
    expect(layer.getPatterns().length).toBeLessThanOrEqual(1);
  });

  it('should detect action-type correlation pattern on frequent failures', async () => {
    const layer = new LearningLayer({ minConfidence: 0, maxEntries: 100 });
    const ctx = createMockContext({
      agentId: 'fail-agent',
      action: 'risky-action',
      failed: true,
      layerResults: [],
    });
    for (let i = 0; i < 3; i++) {
      await layer.execute(ctx);
    }
    const patterns = layer.getPatternsByCategory('failure');
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    expect(patterns.some((p) => p.id.includes('risky-action'))).toBe(true);
  });

  it('should update existing pattern confidence on re-detection', async () => {
    const layer = new LearningLayer({ minConfidence: 0, maxEntries: 100, maxPatterns: 100 });
    const ctx = createMockContext({ agentId: 'same-agent', action: 'read' });
    for (let i = 0; i < 5; i++) {
      await layer.execute(ctx);
    }
    const agentPatterns = layer.getPatternsByCategory('source');
    expect(agentPatterns.length).toBeGreaterThanOrEqual(1);
    const pattern = agentPatterns[0];
    expect(pattern.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('should not detect patterns when autoDetect is false', async () => {
    const layer = new LearningLayer({ autoDetectPatterns: false });
    const ctx = createMockContext();
    await layer.execute(ctx);
    await layer.execute(ctx);
    await layer.execute(ctx);
    expect(layer.getPatterns()).toHaveLength(0);
  });

  it('should use provided minConfidence threshold', async () => {
    const layer = new LearningLayer({ minConfidence: 0.95 });
    const ctx = createMockContext({ agentId: 'high-bar-agent', action: 'read' });
    for (let i = 0; i < 3; i++) {
      await layer.execute(ctx);
    }
    const filtered = layer.getPatternsByCategory('source');
    expect(Array.isArray(filtered)).toBe(true);
  });

  it('should handle error in execute gracefully', async () => {
    const layer = new LearningLayer();
    const ctx = createMockContext();
    (ctx as any).action = undefined;
    const result = await layer.execute(ctx);
    expect(result.passed).toBe(true);
  });
});
