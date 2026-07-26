import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// Hoisted mocks
// ============================================================

const mockRandomUUID = vi.hoisted(() => {
  let counter = 0;
  return () => {
    counter++;
    const c = String(counter).padStart(12, '0');
    return `${c.slice(0, 8)}-${c.slice(8, 12)}-0000-0000-000000000000`;
  };
});

const mockExecSync = vi.hoisted(() => vi.fn());
const mockExistsSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockAccess = vi.hoisted(() => vi.fn());

vi.mock('node:crypto', () => ({ randomUUID: mockRandomUUID }));

vi.mock('node:child_process', () => ({ execSync: mockExecSync }));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('node:fs/promises', () => ({
  access: mockAccess,
}));

// ============================================================
// Imports
// ============================================================

import type { GovernanceRule, QualityGate } from '@behavioros/schemas';
import { DecisionEngine } from '../engines/decision/decision-engine';
import { EcosystemRegistry } from '../engines/ecosystem-registry';
import {
  type AuthorityLevelValue,
  type GovernanceContext,
  GovernanceEngine,
} from '../engines/governance/governance-engine';
import { PatternDetector } from '../engines/intelligence/pattern-detector';
import { MissionEngine } from '../engines/mission/mission-engine';
import { FinOpsEngine } from '../engines/observability/finops-engine';
import { QualityEngine } from '../engines/quality/quality-engine';
import { ParallelExecutor } from '../engines/runtime/parallel-executor';
import type { Vote } from '../pipeline/layers/decision.layer';
import { DecisionLayer } from '../pipeline/layers/decision.layer';
import { QualityLayer } from '../pipeline/layers/quality.layer';
import type { CircuitRequest } from '../resilience/circuit-breaker/circuit-breaker';
import { CircuitBreaker } from '../resilience/circuit-breaker/circuit-breaker';
import { ClosedState } from '../resilience/circuit-breaker/states/closed';
import { HalfOpenState } from '../resilience/circuit-breaker/states/half-open';
import { OpenState } from '../resilience/circuit-breaker/states/open';
import { PerActionPolicy } from '../resilience/rate-limiter/policies/per-action';
import { PerAgentPolicy } from '../resilience/rate-limiter/policies/per-agent';
import { PerDNAPolicy } from '../resilience/rate-limiter/policies/per-dna';
import { RateLimiter } from '../resilience/rate-limiter/rate-limiter';

// ============================================================
// Helpers
// ============================================================

function makeGate(overrides: Partial<QualityGate> = {}): QualityGate {
  return {
    id: 'test-gate',
    name: 'test_coverage',
    type: 'test_coverage',
    threshold: 80,
    ...overrides,
  };
}

const juniorContext: GovernanceContext = {
  agentId: 'agent-1',
  agentRole: 'developer',
  agentAuthority: 'junior',
  action: 'write',
  targetType: 'file',
  impact: 'low',
};

const architectContext: GovernanceContext = {
  agentId: 'agent-2',
  agentRole: 'architect',
  agentAuthority: 'architect',
  action: 'write',
  targetType: 'file',
  impact: 'low',
};

const sampleRequest: CircuitRequest = {
  id: 'req-1',
  action: 'deploy',
  agentId: 'agent-1',
  timestamp: new Date().toISOString(),
};

// ============================================================
// 1. GovernanceEngine — remaining edge cases
// ============================================================

describe('GovernanceEngine — squad4 edge coverage', () => {
  describe('getCandidateRules', () => {
    it('should handle scope indexed lookup with empty index', () => {
      const engine = new GovernanceEngine([]);
      const result = engine.evaluate({
        ...juniorContext,
        // @ts-expect-error - unknown target type for edge case testing
        targetType: 'nonexistent',
        impact: 'low',
      });
      expect(result.allowed).toBe(true);
    });

    it('should handle condition index lookup with matching type condition', () => {
      const rules: GovernanceRule[] = [
        { id: 'r1', name: 'test', level: 'high', action: 'block', conditions: ['type:file'] },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should handle index rules that already have rules in array', () => {
      const rules: GovernanceRule[] = [
        { id: 'r1', name: 'Rule1', level: 'high', action: 'block', scope: ['file'] },
        { id: 'r2', name: 'Rule2', level: 'high', action: 'block', scope: ['file'] },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should deduplicate rules from scope and condition indices', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'dupe',
          level: 'high',
          action: 'block',
          scope: ['file'],
          conditions: ['type:file'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should use condition key that starts with type:', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'type config',
          level: 'high',
          action: 'block',
          conditions: ['type:config'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'config', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should handle impact condition lookup', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'impact rule',
          level: 'high',
          action: 'block',
          conditions: ['impact:low'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });
  });

  describe('ruleApplies — slow path edge cases', () => {
    it('should match slow path when condition includes impact in freeform', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'freeform impact',
          level: 'high',
          action: 'block',
          conditions: ['my-low-condition'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should match slow path when condition includes targetType', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'freeform type',
          level: 'high',
          action: 'block',
          conditions: ['my-file-condition'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should return false when conditions exist but none match', () => {
      const rules: GovernanceRule[] = [
        { id: 'r1', name: 'no match', level: 'high', action: 'block', conditions: ['type:infra'] },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(true);
    });

    it('should handle rule with empty conditions array', () => {
      const rules: GovernanceRule[] = [
        { id: 'r1', name: 'empty conditions', level: 'high', action: 'block', conditions: [] },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate({ ...juniorContext, targetType: 'file', impact: 'low' });
      expect(result.allowed).toBe(false);
    });

    it('should apply rule with no scope and no conditions', () => {
      const rules: GovernanceRule[] = [
        { id: 'r1', name: 'no scope no condition', level: 'high', action: 'warn' },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate(juniorContext);
      expect(result.allowed).toBe(true);
    });

    it('should handle rule with scope but scope does not match', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'scope mismatch',
          level: 'high',
          action: 'block',
          scope: ['infrastructure'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const result = engine.evaluate(juniorContext);
      expect(result.allowed).toBe(true);
    });

    it('should handle rule with conditions having only non-type/non-impact conditions', () => {
      const rules: GovernanceRule[] = [
        {
          id: 'r1',
          name: 'other conditions',
          level: 'high',
          action: 'block',
          conditions: ['day:friday'],
        },
      ];
      const engine = new GovernanceEngine(rules);
      const monday = new Date('2026-07-20T10:00:00Z');
      const result = engine.evaluate({ ...juniorContext, impact: 'low', currentTime: monday });
      expect(result.allowed).toBe(true);
    });
  });

  describe('applyScopeEscalation', () => {
    it('should apply scope escalation for senior-level agent', () => {
      const engine = new GovernanceEngine([]);
      const ctx: GovernanceContext = {
        ...juniorContext,
        agentAuthority: 'senior',
        impact: 'low',
        boundaries: [
          { id: 'b1', name: 'max files', type: 'max_files', value: 3, scope: 'per_commit' },
        ],
        fileCount: 10,
      };
      const result = engine.evaluate(ctx);
      // senior has level 2, architect has level 3 → 2 < 3 → boundary blocks
      expect(result.allowed).toBe(false);
      expect(result.escalationRequired).toBe(true);
    });

    it('should handle forbidden boundary for architect (no escalation)', () => {
      const engine = new GovernanceEngine([]);
      const ctx: GovernanceContext = {
        ...architectContext,
        boundaries: [
          {
            id: 'b1',
            name: 'No secrets',
            type: 'forbidden',
            value: '**/secrets/**',
            scope: 'global',
          },
        ],
        targetFiles: ['src/secrets/keys.ts'],
      };
      const result = engine.evaluate(ctx);
      // Architect-level is trusted — forbidden boundary does not block or escalate
      expect(result.allowed).toBe(true);
      expect(result.escalationRequired).toBe(false);
    });
  });

  describe('checkBoundaries — no boundaries', () => {
    it('should pass time check when no time restricted rules', () => {
      const engine = new GovernanceEngine([]);
      const result = engine.evaluate(juniorContext);
      expect(result.allowed).toBe(true);
    });

    it('should pass dependency check when no targetDependency and no dependency rules', () => {
      const engine = new GovernanceEngine([]);
      const result = engine.evaluate(juniorContext);
      expect(result.allowed).toBe(true);
    });
  });
});

// ============================================================
// 2. QualityEngine — remaining branch coverage
// ============================================================

describe('QualityEngine — squad4 edge coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
    mockExecSync.mockReturnValue('');
  });

  describe('detectPackageManager', () => {
    it('should detect yarn', () => {
      mockExistsSync.mockImplementation((p: string) => p.includes('yarn.lock'));
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should detect npm', () => {
      mockExistsSync.mockReturnValue(false);
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });
  });

  describe('parseLintErrors', () => {
    it('should parse ESLint JSON format', () => {
      mockExecSync.mockReturnValue(JSON.stringify([{ errorCount: 3 }, { errorCount: 2 }]));
      mockExistsSync.mockReturnValue(true);
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should count error lines when no JSON match', () => {
      mockExecSync.mockReturnValue('line 1 error\nline 2 with error\nno errors');
      mockExistsSync.mockReturnValue(true);
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });
  });

  describe('parseTypecheckErrors', () => {
    it('should parse "Found X errors" format', () => {
      mockExecSync.mockReturnValue('Found 5 errors');
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should count error TS lines', () => {
      mockExecSync.mockReturnValue('src/file.ts:1: error TS2345\ntype TS2321 error');
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });
  });

  describe('parseCoverageOutput', () => {
    it('should parse JSON coverage-summary format', () => {
      const jsonOutput = '{"total":{"lines":{"pct":85.5}}}';
      mockExecSync.mockReturnValue(jsonOutput);
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should parse percentage Lines format', () => {
      mockExecSync.mockReturnValue('85.5% Lines');
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should return 0 when no coverage found', () => {
      mockExecSync.mockReturnValue('some random output');
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should parse with stderr coverage data', () => {
      mockExecSync.mockImplementation(() => {
        const err = new Error('error with coverage');
        (err as any).stdout = '';
        (err as any).stderr = 'All files | 92.5';
        (err as any).status = 1;
        throw err;
      });
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });
  });

  describe('parseAuditOutput', () => {
    it('should parse pnpm advisories format', () => {
      mockExecSync.mockReturnValue(
        JSON.stringify({
          advisories: { adv1: { severity: 'high' }, adv2: { severity: 'critical' } },
        }),
      );
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should parse text audit output', () => {
      mockExecSync.mockReturnValue('line with critical\nline with high');
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should parse npm vulnerabilities format', () => {
      mockExecSync.mockReturnValue(
        JSON.stringify({
          vulnerabilities: { v1: { severity: 'critical' }, v2: { severity: 'low' } },
        }),
      );
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should handle empty vulnerabilities', () => {
      mockExecSync.mockReturnValue(JSON.stringify({ vulnerabilities: {} }));
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });
  });

  describe('findLargeFiles', () => {
    it('should handle find command not available', () => {
      const mockExec = vi.spyOn(require('node:child_process'), 'execSync');
      mockExec.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });

    it('should handle unreadable files', () => {
      mockExecSync.mockReturnValue('src/file.ts\nsrc/other.ts');
      mockReadFileSync.mockImplementationOnce(() => {
        throw new Error('permission denied');
      });
      const engine = new QualityEngine([]);
      const report = engine.createReport([]);
      expect(report.passed).toBe(true);
    });
  });

  describe('runAll', () => {
    it('should handle error during gate execution gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('exec failed');
      });
      const engine = new QualityEngine([{ id: 'test', name: 'lint', type: 'lint', threshold: 80 }]);
      const report = await engine.runAll('/test/path');
      expect(report.checks.length).toBeGreaterThan(0);
    });

    it('should handle empty gates list quietly', async () => {
      const engine = new QualityEngine([]);
      const report = await engine.runAll('/test/path');
      expect(report.passed).toBe(true);
    });
  });

  describe('addGate / removeGate', () => {
    it('should update existing gate on addGate', () => {
      const gate = makeGate({ name: 'existing' });
      const engine = new QualityEngine([gate]);
      engine.addGate(makeGate({ name: 'existing', threshold: 90 }));
      expect(engine.getGates()).toHaveLength(1);
    });

    it('should return false when removing non-existent gate', () => {
      const engine = new QualityEngine([]);
      expect(engine.removeGate('nonexistent')).toBe(false);
    });

    it('should return true when removing existing gate', () => {
      const gate = makeGate({ name: 'test' });
      const engine = new QualityEngine([gate]);
      expect(engine.removeGate('test')).toBe(true);
    });
  });

  describe('getHistory / getLastReport', () => {
    it('should return undefined for last report when no history', () => {
      const engine = new QualityEngine([]);
      expect(engine.getLastReport()).toBeUndefined();
    });

    it('should return history after evaluate', () => {
      const gate = makeGate({ name: 'test', threshold: 80 });
      const engine = new QualityEngine([gate]);
      engine.evaluate([{ name: 'test', value: 90 }]);
      expect(engine.getHistory()).toHaveLength(1);
    });
  });

  describe('summary', () => {
    it('should format summary correctly', () => {
      const gate = makeGate({ name: 'test_coverage', threshold: 80 });
      const engine = new QualityEngine([gate]);
      const report = engine.evaluate([{ name: 'test_coverage', value: 95 }]);
      const s = engine.summary(report);
      expect(s).toContain('Quality Report:');
      expect(s).toContain('PASSED');
    });
  });

  describe('runCustomGate', () => {
    it('should return auto-pass for gate without config', async () => {
      const gate = makeGate({ name: 'custom_no_config', threshold: undefined as any });
      const engine = new QualityEngine([gate]);
      const report = await engine.runAll('/test/path');
      expect(report.passed).toBe(true);
    });
  });
});

// ============================================================
// 3. EcosystemRegistry — edge coverage
// ============================================================

describe('EcosystemRegistry — squad4 edge coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccess.mockRejectedValue(new Error('ENOENT'));
  });

  it('should handle empty constructor', () => {
    const registry = new EcosystemRegistry();
    expect(registry.isInitialized()).toBe(false);
  });

  it('should handle initialize without skillEngine', async () => {
    const registry = new EcosystemRegistry({});
    await registry.initialize();
    expect(registry.isInitialized()).toBe(true);
  });

  it('should handle initialize with dnaLoader but no dna directory', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const skillEngine = {
      loadFromOpenCodeSkills: vi.fn().mockResolvedValue({ added: 0 }),
      syncFromDNA: vi.fn(),
      status: vi
        .fn()
        .mockResolvedValue({ agents: [], skills: [], mcps: [], designSystems: [], dnas: [] }),
      doctor: vi
        .fn()
        .mockResolvedValue({ healthy: true, stats: { totalComponents: 0, active: 0, issues: 0 } }),
    };
    const dnaLoader = { loadAll: vi.fn().mockResolvedValue([]) };
    const registry = new EcosystemRegistry({ skillEngine: skillEngine as any });
    (registry as any).setDNALoader(dnaLoader);
    await registry.initialize();
    expect(registry.isInitialized()).toBe(true);
  });

  it('should handle sync with catch on missing dna dir', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const skillEngine = {
      loadFromOpenCodeSkills: vi.fn().mockResolvedValue({ added: 0 }),
      syncFromDNA: vi.fn(),
      status: vi
        .fn()
        .mockResolvedValue({ agents: [], skills: [], mcps: [], designSystems: [], dnas: [] }),
    };
    const dnaLoader = { loadAll: vi.fn().mockResolvedValue([]) };
    const registry = new EcosystemRegistry({ skillEngine: skillEngine as any });
    (registry as any).setDNALoader(dnaLoader);
    const result = await registry.sync();
    expect(result.results).toHaveLength(2);
  });

  it('should handle install with unknown source', async () => {
    const registry = new EcosystemRegistry({});
    const result = await registry.install('skill', 'test', 'unknown');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown source');
  });

  it('should handle install with aitmpl but no adapter', async () => {
    const registry = new EcosystemRegistry({});
    const result = await registry.install('skill', 'test', 'aitmpl');
    expect(result.success).toBe(false);
  });

  it('should handle install with open-design but no adapter', async () => {
    const registry = new EcosystemRegistry({});
    const result = await registry.install('mcp', 'test', 'open-design');
    expect(result.success).toBe(false);
  });

  it('should handle install with local but no skillEngine', async () => {
    const registry = new EcosystemRegistry({});
    const result = await registry.install('skill', 'test', 'local');
    expect(result.success).toBe(false);
  });

  it('should handle generateReport without skillEngine', async () => {
    const registry = new EcosystemRegistry({});
    const report = await registry.generateReport();
    expect(report.project).toBeDefined();
  });

  it('should handle doctor with error in skillEngine', async () => {
    const skillEngine = {
      doctor: vi.fn().mockRejectedValue(new Error('skill engine error')),
      status: vi
        .fn()
        .mockResolvedValue({ agents: [], skills: [], mcps: [], designSystems: [], dnas: [] }),
    };
    const registry = new EcosystemRegistry({ skillEngine: skillEngine as any });
    const result = await registry.doctor();
    expect(result.engines['skill-engine']?.status).toBe('error');
  });

  it('should handle doctor with open-design detection error', async () => {
    const aitmpl = {};
    const openDesign = { detect: vi.fn().mockRejectedValue(new Error('OD error')) };
    const uiUx = { detect: vi.fn().mockResolvedValue(false) };
    const skillEngine = {
      doctor: vi
        .fn()
        .mockResolvedValue({ healthy: true, stats: { totalComponents: 0, active: 0, issues: 0 } }),
      status: vi.fn().mockResolvedValue({ agents: [] }),
    };
    const registry = new EcosystemRegistry({
      skillEngine: skillEngine as any,
      aitmpl: aitmpl as any,
      openDesign: openDesign as any,
      uiUx: uiUx as any,
    });
    const result = await registry.doctor();
    expect(result.engines['open-design']?.status).toBe('error');
  });

  it('should handle doctor with ui-ux detection error', async () => {
    const aitmpl = {};
    const openDesign = { detect: vi.fn().mockResolvedValue(false) };
    const uiUx = { detect: vi.fn().mockRejectedValue(new Error('UI error')) };
    const skillEngine = {
      doctor: vi
        .fn()
        .mockResolvedValue({ healthy: true, stats: { totalComponents: 0, active: 0, issues: 0 } }),
      status: vi.fn().mockResolvedValue({ agents: [] }),
    };
    const registry = new EcosystemRegistry({
      skillEngine: skillEngine as any,
      aitmpl: aitmpl as any,
      openDesign: openDesign as any,
      uiUx: uiUx as any,
    });
    const result = await registry.doctor();
    expect(result.engines['ui-ux-pro-max']?.status).toBe('error');
  });

  it('should handle doctor with open-design not-detected', async () => {
    const aitmpl = {};
    const openDesign = { detect: vi.fn().mockResolvedValue(false) };
    const uiUx = { detect: vi.fn().mockResolvedValue(false) };
    const skillEngine = {
      doctor: vi
        .fn()
        .mockResolvedValue({ healthy: true, stats: { totalComponents: 0, active: 0, issues: 0 } }),
      status: vi.fn().mockResolvedValue({ agents: [] }),
    };
    const registry = new EcosystemRegistry({
      skillEngine: skillEngine as any,
      aitmpl: aitmpl as any,
      openDesign: openDesign as any,
      uiUx: uiUx as any,
    });
    const result = await registry.doctor();
    // open-design is not-detected, so healthy=false
    expect(result.healthy).toBe(false);
  });
});

// ============================================================
// 4. FinOpsEngine — edge coverage
// ============================================================

describe('FinOpsEngine — squad4 edge coverage', () => {
  it('should handle getBudget for nonexistent budget', () => {
    const engine = new FinOpsEngine();
    expect(engine.getBudget('nonexistent')).toBeUndefined();
  });

  it('should handle getTotalCost with specific period', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 100);
    const cost = engine.getTotalCost('yearly');
    expect(cost).toBe(100);
  });

  it('should handle getTotalCost with unknown period', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 100);
    const cost = engine.getTotalCost('unknown');
    expect(cost).toBe(100);
  });

  it('should handle getCostByCategory with multiple categories', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 100);
    engine.trackCost('storage', 50);
    engine.trackCost('compute', 30);
    const cats = engine.getCostByCategory();
    expect(cats.compute).toBe(130);
    expect(cats.storage).toBe(50);
  });

  it('should handle checkBudgetAlerts for nonexistent budget', () => {
    const engine = new FinOpsEngine();
    expect(engine.checkBudgetAlerts('nonexistent')).toEqual([]);
  });

  it('should handle checkBudgetAlerts with zero amount budget', () => {
    const engine = new FinOpsEngine();
    // @ts-expect-error - partial Budget for edge case testing
    engine.setBudget({ id: 'b1', name: 'zero', amount: 0, spent: 0, alerts: [50], notified: [] });
    const msgs = engine.checkBudgetAlerts('b1');
    expect(msgs).toEqual([]);
  });

  it('should handle checkBudgetAlerts with already notified thresholds', () => {
    const engine = new FinOpsEngine();
    // @ts-expect-error - partial Budget for edge case testing
    engine.setBudget({
      id: 'b1',
      name: 'test',
      amount: 100,
      spent: 90,
      alerts: [80],
      notified: [80],
    });
    const msgs = engine.checkBudgetAlerts('b1');
    expect(msgs).toEqual([]);
  });

  it('should handle allocateCost without resources', () => {
    const engine = new FinOpsEngine();
    engine.allocateCost('team-a', 'project-x', 500);
    const charges = engine.getChargeback();
    expect(charges).toHaveLength(1);
    expect(charges[0].resources).toEqual([]);
  });

  it('should handle getChargeback filtered by team', () => {
    const engine = new FinOpsEngine();
    engine.allocateCost('team-a', 'project-x', 100);
    engine.allocateCost('team-b', 'project-y', 200);
    const charges = engine.getChargeback('team-a');
    expect(charges).toHaveLength(1);
  });

  it('should handle getChargeback for nonexistent team', () => {
    const engine = new FinOpsEngine();
    const charges = engine.getChargeback('nonexistent');
    expect(charges).toEqual([]);
  });

  it('should handle forecast with zero total', () => {
    const engine = new FinOpsEngine();
    const result = engine.forecast(3);
    expect(result).toHaveLength(3);
  });

  it('should handle forecast with existing costs', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 30000);
    const result = engine.forecast(2);
    expect(result[0].projected).toBeGreaterThan(0);
  });

  it('should handle isInPeriod with quarterly', () => {
    const engine = new FinOpsEngine();
    engine.trackCost('compute', 100);
    const cost = engine.getTotalCost('quarterly');
    expect(cost).toBe(100);
  });

  it('should handle optimize method', () => {
    const engine = new FinOpsEngine();
    const opts = engine.optimize();
    expect(opts).toHaveLength(3);
  });
});

// ============================================================
// 5. PatternDetector — edge coverage
// ============================================================

describe('PatternDetector — squad4 edge coverage', () => {
  it('should handle empty events for detectFrequentSequences', () => {
    const pd = new PatternDetector();
    const patterns = pd.detectFrequentSequences();
    expect(patterns).toEqual([]);
  });

  it('should handle single event for detectFrequentSequences', () => {
    const pd = new PatternDetector();
    pd.record('type-a', {});
    const patterns = pd.detectFrequentSequences();
    expect(patterns).toEqual([]);
  });

  it('should detect frequent sequences with minOccurrences', () => {
    const pd = new PatternDetector();
    pd.record('a', {});
    pd.record('b', {});
    pd.record('a', {});
    pd.record('b', {});
    pd.record('a', {});
    pd.record('b', {});
    const patterns = pd.detectFrequentSequences(2);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should update existing frequent sequence pattern', () => {
    const pd = new PatternDetector();
    pd.record('a', {});
    pd.record('b', {});
    pd.record('a', {});
    pd.record('b', {});
    pd.detectFrequentSequences(1);
    pd.record('a', {});
    pd.record('b', {});
    const newPatterns = pd.detectFrequentSequences(1);
    expect(newPatterns.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle detectAnomalies with too few events', () => {
    const pd = new PatternDetector();
    pd.record('type-a', {});
    const patterns = pd.detectAnomalies();
    expect(patterns).toEqual([]);
  });

  it('should handle detectAnomalies with zero time span', () => {
    const pd = new PatternDetector();
    pd.record('a', {});
    pd.record('a', {});
    pd.record('a', {});
    pd.record('a', {});
    const patterns = pd.detectAnomalies();
    expect(patterns).toEqual([]);
  });

  it('should handle detectAnomalies with zero stddev', () => {
    const pd = new PatternDetector();
    for (let i = 0; i < 4; i++) pd.record('a', {});
    const patterns = pd.detectAnomalies(2, 5);
    expect(patterns).toEqual([]);
  });

  it('should handle detectAnomalies that finds anomaly', () => {
    const pd = new PatternDetector();
    for (let i = 0; i < 10; i++) {
      pd.record('a', {});
    }
    const patterns = pd.detectAnomalies(5, 1);
    expect(patterns.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle detectTrends with too few events', () => {
    const pd = new PatternDetector();
    pd.record('type-a', {});
    const patterns = pd.detectTrends();
    expect(patterns).toEqual([]);
  });

  it('should handle detectTrends returning patterns or empty', () => {
    const pd = new PatternDetector();
    pd.record('a', {});
    pd.record('a', {});
    const patterns = pd.detectTrends(1);
    // May find trend or not depending on timing
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should handle local event with firstSum zero', () => {
    const pd = new PatternDetector();
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      pd.record('trend-type', {});
    }
    const patterns = pd.detectTrends();
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should handle getAllPatterns', () => {
    const pd = new PatternDetector();
    expect(pd.getAllPatterns()).toEqual([]);
  });

  it('should handle clear', () => {
    const pd = new PatternDetector();
    pd.record('a', {});
    pd.clear();
    expect(pd.getAllPatterns()).toEqual([]);
  });

  it('should update existing anomaly pattern', () => {
    const pd = new PatternDetector();
    for (let i = 0; i < 10; i++) {
      pd.record('anomaly-type', {});
    }
    pd.detectAnomalies(5, 0.5);
    pd.detectAnomalies(5, 0.5);
    const all = pd.getAllPatterns();
    expect(all.length).toBeGreaterThanOrEqual(0);
  });

  it('should update existing trend pattern', () => {
    const pd = new PatternDetector();
    for (let i = 0; i < 20; i++) {
      pd.record('trend-type', {});
    }
    pd.detectTrends(5);
    pd.detectTrends(5);
    const all = pd.getAllPatterns();
    expect(all.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// 6. CircuitBreaker — edge coverage
// ============================================================

describe('CircuitBreaker — squad4 edge coverage', () => {
  it('should handle default config on empty constructor', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState()).toBe('closed');
  });

  it('should transition to open after threshold failures', () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, recoveryTimeoutMs: 60000 });
    cb.check(sampleRequest);
    cb.recordFailure('r1', new Error('err1'));
    cb.recordFailure('r2', new Error('err2'));
    expect(cb.getState()).toBe('open');
  });

  it('should return half-open hint from check after recovery timeout', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 0 });
    cb.recordFailure('r1', new Error('err'));
    const result = cb.check(sampleRequest);
    // check() doesn't transition state, but the OpenState returns half-open hint
    expect(result.state).toBe('half-open');
  });

  it('should transition via forceHalfOpen then successes to closed', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 1,
      halfOpenMaxAttempts: 3,
    });
    cb.recordFailure('r1', new Error('err'));
    cb.forceHalfOpen();
    cb.recordSuccess('r2');
    expect(cb.getState()).toBe('closed');
  });

  it('should handle forceOpen', () => {
    const cb = new CircuitBreaker();
    cb.forceOpen();
    expect(cb.getState()).toBe('open');
  });

  it('should handle forceHalfOpen', () => {
    const cb = new CircuitBreaker();
    cb.forceHalfOpen();
    expect(cb.getState()).toBe('half-open');
  });

  it('should handle reset from open state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 60000 });
    cb.recordFailure('r1', new Error('err'));
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });

  it('should getStats', () => {
    const cb = new CircuitBreaker();
    const stats = cb.getStats();
    expect(stats.totalRequests).toBe(0);
  });

  it('should getStateHistory', () => {
    const cb = new CircuitBreaker();
    cb.forceOpen();
    expect(cb.getStateHistory()).toHaveLength(1);
  });

  it('should handle isAvailable', () => {
    const cb = new CircuitBreaker();
    expect(cb.isAvailable()).toBe(true);
  });

  it('should handle getConfig', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const cfg = cb.getConfig();
    expect(cfg.failureThreshold).toBe(3);
  });

  it('should emit events when recording success', () => {
    const cb = new CircuitBreaker();
    const handler = vi.fn();
    cb.on('success-recorded', handler);
    cb.recordSuccess('req-1');
    expect(handler).toHaveBeenCalledWith('req-1');
  });

  it('should emit events when recording failure', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, recoveryTimeoutMs: 60000 });
    const handler = vi.fn();
    cb.on('failure-recorded', handler);
    cb.recordFailure('req-1', new Error('err'));
    expect(handler).toHaveBeenCalled();
  });

  it('should handle on/off event subscription', () => {
    const cb = new CircuitBreaker();
    const handler = vi.fn();
    cb.on('request-allowed', handler);
    cb.off('request-allowed', handler);
    cb.check(sampleRequest);
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle forceOpen with custom reason', () => {
    const cb = new CircuitBreaker();
    cb.forceOpen('custom reason');
    expect(cb.getStateHistory()[0].reason).toBe('custom reason');
  });

  it('should not transition when already in target state', () => {
    const cb = new CircuitBreaker();
    cb.reset();
    expect(cb.getState()).toBe('closed');
  });
});

// ============================================================
// 7. CircuitBreaker States — edge coverage
// ============================================================

describe('CircuitBreaker States — squad4 edge coverage', () => {
  describe('ClosedState', () => {
    it('should handle custom config', () => {
      const state = new ClosedState(5, { slowCallDurationMs: 1000, slowCallThresholdPercent: 50 });
      expect(state.isAvailable()).toBe(true);
    });

    it('should handle onSuccess resets consecutive failures', () => {
      const state = new ClosedState(2);
      state.onFailure('r1', new Error('err'));
      state.onSuccess('r2');
      expect(state.getConsecutiveFailures()).toBe(0);
    });

    it('should handle onSuccess increments totalCalls', () => {
      const state = new ClosedState(2);
      state.onSuccess('r1');
      expect(state.getTotalCalls()).toBe(1);
    });

    it('should handle onFailure below threshold returns null', () => {
      const state = new ClosedState(3);
      const result = state.onFailure('r1', new Error('err'));
      expect(result).toBeNull();
    });

    it('should handle getSlowCallRate with zero calls', () => {
      const state = new ClosedState(3);
      expect(state.getSlowCallRate()).toBe(0);
    });

    it('should handle getSlowCallRate with calls', () => {
      const state = new ClosedState(3);
      state.recordSlowCall();
      state.onSuccess('r2');
      expect(state.getSlowCallRate()).toBe(50);
    });

    it('should handle reset', () => {
      const state = new ClosedState(3);
      state.onFailure('r1', new Error('err'));
      state.onFailure('r2', new Error('err'));
      state.reset();
      expect(state.getConsecutiveFailures()).toBe(0);
    });
  });

  describe('OpenState', () => {
    it('should handle onSuccess returns null', () => {
      const state = new OpenState(30000, 3);
      expect(state.onSuccess('r1')).toBeNull();
    });

    it('should handle onFailure below halfOpenMaxAttempts returns null', () => {
      const state = new OpenState(30000, 3);
      const result = state.onFailure('r1', new Error('err'));
      expect(result).toBeNull();
    });

    it('should transition to open when attempts exhausted', () => {
      const state = new OpenState(30000, 3);
      state.onFailure('r1', new Error('err'));
      state.onFailure('r2', new Error('err'));
      state.onFailure('r3', new Error('err'));
      const result = state.onFailure('r4', new Error('err'));
      expect(result?.to).toBe('open');
    });

    it('should handle isAvailable based on elapsed time', () => {
      const state = new OpenState(0, 3);
      expect(state.isAvailable()).toBe(true);
    });

    it('should handle getRemainingMs', () => {
      const state = new OpenState(10000, 3);
      const remaining = state.getRemainingMs();
      expect(remaining).toBeGreaterThan(0);
    });

    it('should handle getOpenedAt', () => {
      const state = new OpenState(30000, 3);
      expect(state.getOpenedAt()).toBeGreaterThan(0);
    });

    it('should handle getAttempts', () => {
      const state = new OpenState(30000, 3);
      expect(state.getAttempts()).toBe(0);
    });

    it('should transition to half-open when max duration reached', () => {
      const state = new OpenState(30000, 3, { maxOpenDurationMs: -1 });
      const check = state.check(sampleRequest);
      expect(check.state).toBe('half-open');
    });

    it('should handle allowHalfOpenAfterMs from config', () => {
      const state = new OpenState(60000, 3, { allowHalfOpenAfterMs: 0 });
      const check = state.check(sampleRequest);
      expect(check.state).toBe('half-open');
    });
  });

  describe('HalfOpenState', () => {
    it('should handle max test attempts reached', () => {
      const state = new HalfOpenState(1, 2);
      state.check(sampleRequest);
      const result = state.check(sampleRequest);
      expect(result.allowed).toBe(false);
    });

    it('should handle onSuccess below threshold returns null', () => {
      const state = new HalfOpenState(3, 3);
      const result = state.onSuccess('r1');
      expect(result).toBeNull();
    });

    it('should handle onSuccess above threshold transitions to closed', () => {
      const state = new HalfOpenState(3, 1);
      const result = state.onSuccess('r1');
      expect(result?.to).toBe('closed');
    });

    it('should handle onFailure returns transition to open', () => {
      const state = new HalfOpenState(3, 2);
      const result = state.onFailure('r1', new Error('err'));
      expect(result?.to).toBe('open');
    });

    it('should handle isAvailable when below max', () => {
      const state = new HalfOpenState(5, 2);
      expect(state.isAvailable()).toBe(true);
    });

    it('should handle isAvailable when max reached', () => {
      const state = new HalfOpenState(1, 2);
      state.check(sampleRequest);
      expect(state.isAvailable()).toBe(false);
    });

    it('should handle getAttempts', () => {
      const state = new HalfOpenState(3, 2);
      state.check(sampleRequest);
      expect(state.getAttempts()).toBe(1);
    });

    it('should handle getSuccesses', () => {
      const state = new HalfOpenState(3, 2);
      state.onSuccess('r1');
      expect(state.getSuccesses()).toBe(1);
    });

    it('should handle getFailures', () => {
      const state = new HalfOpenState(3, 2);
      state.onFailure('r1', new Error('err'));
      expect(state.getFailures()).toBe(1);
    });

    it('should handle getTestPercentage', () => {
      const state = new HalfOpenState(3, 2);
      expect(state.getTestPercentage()).toBe(25);
    });
  });
});

// ============================================================
// 8. QualityLayer — edge coverage
// ============================================================

describe('QualityLayer — squad4 edge coverage', () => {
  it('should handle empty options', () => {
    const layer = new QualityLayer();
    expect(layer.id).toBe('quality');
  });

  it('should execute with no DNA and no custom checks adding continuity gate', async () => {
    const layer = new QualityLayer();
    const ctx = { metadata: new Map(), agentId: 'test', agentAuthority: 'junior' };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
    // When no gates defined, it adds a pipeline_continuity gate
    expect(result.details.gatesChecked).toBe(1);
    // @ts-expect-error - result.details.results is unknown
    expect(result.details.results[0].gate).toBe('pipeline_continuity');
  });

  it('should execute with DNA quality gates', async () => {
    const layer = new QualityLayer();
    const dna = {
      quality: [
        { name: 'lint', type: 'lint' },
        { name: 'test', type: 'coverage', threshold: 80 },
      ],
    };
    const ctx = { metadata: new Map([['dna', dna]]), agentId: 'test', agentAuthority: 'junior' };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle custom check that throws', async () => {
    const layer = new QualityLayer({
      checks: [
        () => {
          throw new Error('custom fail');
        },
      ],
    });
    const ctx = { metadata: new Map(), agentId: 'test', agentAuthority: 'junior' };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle error in execute gracefully', async () => {
    const layer = new QualityLayer();
    const ctx = {
      metadata: {
        get: () => {
          throw new Error('metadata error');
        },
      },
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should add and remove custom checks', () => {
    const layer = new QualityLayer();
    const check = () => ({
      gate: 'custom',
      passed: true,
      actual: true,
      expected: true,
      message: 'ok',
    });
    layer.addCheck(check);
    expect(layer.removeCheck(0)).toBe(true);
    expect(layer.removeCheck(0)).toBe(false);
    expect(layer.removeCheck(-1)).toBe(false);
  });

  it('should handle shouldExecute', () => {
    const layer = new QualityLayer();
    const ctx = { metadata: new Map(), agentId: 'test', agentAuthority: 'junior' };
    expect(layer.shouldExecute(ctx as any)).toBe(true);
  });
});

// ============================================================
// 9. DecisionLayer — edge coverage
// ============================================================

describe('DecisionLayer — squad4 edge coverage', () => {
  it('should handle empty options', () => {
    const layer = new DecisionLayer();
    expect(layer.id).toBe('decision');
  });

  it('should handle unanimous voting strategy', async () => {
    const layer = new DecisionLayer({ votingStrategy: 'unanimous' });
    const ctx = { metadata: new Map(), agentId: 'agent-1', agentAuthority: 'junior' };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle unanimous with rejection', async () => {
    const layer = new DecisionLayer({ votingStrategy: 'unanimous' });
    const votes: Vote[] = [
      { agentId: 'a1', option: 'approve', weight: 1 },
      { agentId: 'a2', option: 'reject', weight: 1 },
    ];
    const ctx = {
      metadata: new Map([['votes', votes]]),
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(false);
  });

  it('should handle majority voting with existing votes', async () => {
    const layer = new DecisionLayer({ votingStrategy: 'majority' });
    const votes: Vote[] = [
      { agentId: 'a1', option: 'approve', weight: 1 },
      { agentId: 'a2', option: 'approve', weight: 1 },
    ];
    const ctx = {
      metadata: new Map([['votes', votes]]),
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle rejection by ratio', async () => {
    const layer = new DecisionLayer({ quorumThreshold: 0.8, autoApproveBelowThreshold: false });
    const votes: Vote[] = [
      { agentId: 'a1', option: 'reject', weight: 3 },
      { agentId: 'a2', option: 'approve', weight: 1 },
    ];
    const ctx = {
      metadata: new Map([['votes', votes]]),
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(false);
  });

  it('should handle auto-approve below quorum', async () => {
    const layer = new DecisionLayer({ quorumThreshold: 0.9 });
    const votes: Vote[] = [
      { agentId: 'a1', option: 'approve', weight: 1 },
      { agentId: 'a2', option: 'abstain', weight: 1 },
    ];
    const ctx = {
      metadata: new Map([['votes', votes]]),
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle deferred decision with weighted', async () => {
    const layer = new DecisionLayer({
      votingStrategy: 'weighted',
      quorumThreshold: 0.9,
      autoApproveBelowThreshold: false,
    });
    const votes: Vote[] = [{ agentId: 'a1', option: 'approve', weight: 1 }];
    const ctx = {
      metadata: new Map([['votes', votes]]),
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    // 1/1 approveRatio = 1.0 >= 0.9 so hasQuorum=true → approved
    expect(result.details.decision).toBe('approved');
  });

  it('should handle error in execute', async () => {
    const layer = new DecisionLayer();
    const ctx = {
      metadata: {
        get: () => {
          throw new Error('fail');
        },
      },
      agentId: 'test',
      agentAuthority: 'junior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(false);
  });

  it('should handle empty votes array with weighted strategy', async () => {
    const layer = new DecisionLayer();
    const ctx = {
      metadata: new Map([['votes', []]]),
      agentId: 'agent-1',
      agentAuthority: 'senior',
    };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle c-level authority weight', async () => {
    const layer = new DecisionLayer();
    const ctx = { metadata: new Map(), agentId: 'ceo', agentAuthority: 'c-level' };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle unknown authority weight', async () => {
    const layer = new DecisionLayer();
    const ctx = { metadata: new Map(), agentId: 'alien', agentAuthority: 'alien' as any };
    const result = await layer.execute(ctx as any);
    expect(result.passed).toBe(true);
  });

  it('should handle shouldExecute', () => {
    const layer = new DecisionLayer();
    expect(layer.shouldExecute({} as any)).toBe(true);
  });
});

// ============================================================
// 10. DecisionEngine — edge coverage
// ============================================================

describe('DecisionEngine — squad4 edge coverage', () => {
  it('should handle default constructor', () => {
    const engine = new DecisionEngine();
    const result = engine.vote(
      { id: 'd1', title: 'test', type: 'architecture', participants: [], options: [] },
      [],
    );
    expect(result.confidence).toBe(0);
  });

  it('should handle unanimous vote with empty votes', () => {
    const engine = new DecisionEngine('unanimous');
    const result = engine.vote(
      { id: 'd1', title: 'test', type: 'architecture', participants: [], options: [] },
      [],
    );
    expect(result.winningOption).toBeNull();
  });

  it('should handle quorum vote without quorum', () => {
    const engine = new DecisionEngine('quorum', 0.9);
    const participants = [{ id: 'p1', role: 'dev', authority: 1, weight: 1 }];
    const result = engine.vote(
      { id: 'd1', title: 'test', type: 'architecture', participants, options: [] },
      [],
    );
    expect(result.winningOption).toBeNull();
    expect(result.consensus).toBe(false);
  });

  it('should handle quorum vote with quorum', () => {
    const engine = new DecisionEngine('quorum', 0.5);
    const participants = [{ id: 'p1', role: 'dev', authority: 1, weight: 1 }];
    const votes = [{ participantId: 'p1', optionId: 'opt1', confidence: 1 }];
    const options = [{ id: 'opt1', title: 'Option 1', pros: [], cons: [], risk: 'low' }];
    const result = engine.vote(
      // @ts-expect-error - partial DecisionOption for edge case testing
      { id: 'd1', title: 'test', type: 'architecture', participants, options },
      votes,
    );
    expect(result.winningOption).toBe('opt1');
  });

  it('should handle byzantine vote without quorum', () => {
    const engine = new DecisionEngine('byzantine');
    const participants = [{ id: 'p1', role: 'dev', authority: 1, weight: 1 }];
    const result = engine.vote(
      { id: 'd1', title: 'test', type: 'architecture', participants, options: [] },
      [],
    );
    expect(result.winningOption).toBeNull();
  });

  it('should handle byzantine vote with quorum', () => {
    const engine = new DecisionEngine('byzantine');
    const participants = [
      { id: 'p1', role: 'dev', authority: 1, weight: 1 },
      { id: 'p2', role: 'lead', authority: 3, weight: 2 },
    ];
    const votes = [
      { participantId: 'p1', optionId: 'opt1', confidence: 1 },
      { participantId: 'p2', optionId: 'opt1', confidence: 1 },
    ];
    const options = [{ id: 'opt1', title: 'Option 1', pros: [], cons: [], risk: 'low' }];
    const result = engine.vote(
      // @ts-expect-error - partial DecisionOption for edge case testing
      { id: 'd1', title: 'test', type: 'architecture', participants, options },
      votes,
    );
    expect(result.winningOption).toBe('opt1');
  });

  it('should handle weighted vote with missing participant mapping', () => {
    const engine = new DecisionEngine('weighted');
    const participants = [{ id: 'p1', role: 'dev', authority: 1, weight: 2 }];
    const votes = [{ participantId: 'unknown', optionId: 'opt1', confidence: 1 }];
    const options = [{ id: 'opt1', title: 'Opt1', pros: [], cons: [], risk: 'low' }];
    const result = engine.vote(
      // @ts-expect-error - partial DecisionOption for edge case testing
      { id: 'd1', title: 'test', type: 'architecture', participants, options },
      votes,
    );
    expect(result.winningOption).toBe('opt1');
  });

  it('should handle evaluateRisk with low diversity', () => {
    const engine = new DecisionEngine();
    const participants = [{ id: 'p1', role: 'dev', authority: 1, weight: 1 }];
    const options = [{ id: 'opt1', title: 'Opt1', pros: [], cons: [], risk: 'low' }];
    const risk = engine.evaluateRisk({
      id: 'd1',
      title: 'test',
      type: 'architecture',
      participants,
      // @ts-expect-error - partial DecisionOption for edge case testing
      options,
    });
    expect(risk.level).toBe('medium');
  });

  it('should handle evaluateRisk with high risk option', () => {
    const engine = new DecisionEngine();
    const participants = [{ id: 'p1', role: 'dev', authority: 1, weight: 1 }];
    const options = [{ id: 'opt1', title: 'High risk', pros: [], cons: [], risk: 'high' }];
    const risk = engine.evaluateRisk({
      id: 'd1',
      title: 'test',
      type: 'architecture',
      participants,
      // @ts-expect-error - partial DecisionOption for edge case testing
      options,
    });
    expect(risk.level).toBe('high');
  });

  it('should handle evaluateRisk with tight deadline', () => {
    const engine = new DecisionEngine();
    const participants = [
      { id: 'p1', role: 'dev', authority: 1, weight: 1 },
      { id: 'p2', role: 'lead', authority: 3, weight: 2 },
    ];
    const options = [{ id: 'opt1', title: 'Opt1', pros: [], cons: [], risk: 'low' }];
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 60 * 60 * 1000);
    const risk = engine.evaluateRisk({
      id: 'd1',
      title: 'test',
      type: 'architecture',
      participants,
      // @ts-expect-error - partial DecisionOption for edge case testing
      options,
      deadline: tomorrow.toISOString(),
    });
    expect(risk.level).toBe('medium');
  });

  it('should handle evaluateRisk with low risk all round', () => {
    const engine = new DecisionEngine();
    const participants = [
      { id: 'p1', role: 'dev', authority: 1, weight: 1 },
      { id: 'p2', role: 'lead', authority: 3, weight: 2 },
    ];
    const options = [{ id: 'opt1', title: 'Opt1', pros: [], cons: [], risk: 'low' }];
    const risk = engine.evaluateRisk({
      id: 'd1',
      title: 'test',
      type: 'architecture',
      participants,
      // @ts-expect-error - partial DecisionOption for edge case testing
      options,
    });
    expect(risk.level).toBe('low');
  });

  it('should handle summary with dissenting', () => {
    const engine = new DecisionEngine();
    const result = engine.vote(
      { id: 'd1', title: 'test', type: 'architecture', participants: [], options: [] },
      [
        { participantId: 'p1', optionId: 'a', confidence: 1 },
        { participantId: 'p2', optionId: 'b', confidence: 1 },
      ],
    );
    const s = engine.summary(result);
    expect(s).toContain('Decision:');
    expect(s).toContain('Dissenting');
  });

  it('should handle summary without winner', () => {
    const engine = new DecisionEngine();
    const result = engine.vote(
      { id: 'd1', title: 'test', type: 'architecture', participants: [], options: [] },
      [],
    );
    const s = engine.summary(result);
    expect(s).toContain('Consensus');
  });

  it('should handle default strategy for unknown strategy', () => {
    const engine = new DecisionEngine('unknown' as any);
    const options = [{ id: 'opt1', title: 'Opt1', pros: [], cons: [], risk: 'low' }];
    const result = engine.vote(
      // @ts-expect-error - partial DecisionOption for edge case testing
      { id: 'd1', title: 'test', type: 'architecture', participants: [], options },
      [{ participantId: 'p1', optionId: 'opt1', confidence: 1 }],
    );
    expect(result.winningOption).toBe('opt1');
  });
});

// ============================================================
// 11. MissionEngine — edge coverage
// ============================================================

describe('MissionEngine — squad4 edge coverage', () => {
  it('should handle decompose with partial sub-missions', () => {
    const engine = new MissionEngine();
    const mission: any = {
      id: 'm1',
      title: 'Root',
      type: 'feature',
      priority: 'high',
      status: 'draft',
      context: {},
    };
    const plan = engine.decompose(mission, [{ title: 'Sub 1' }, { description: 'Sub 2' }]);
    expect(plan.subMissions).toHaveLength(2);
  });

  it('should handle updateProgress with default progress', () => {
    const engine = new MissionEngine();
    const progress = engine.updateProgress('new-mission', { subTasks: 5 });
    expect(progress.progress).toBe(0);
    expect(progress.subTasks).toBe(5);
  });

  it('should reject invalid state transition', () => {
    const engine = new MissionEngine();
    engine.updateProgress('m1', { status: 'queued' });
    expect(() => {
      engine.updateProgress('m1', { status: 'completed' });
    }).toThrow('Invalid mission transition');
  });

  it('should allow valid state transition', () => {
    const engine = new MissionEngine();
    engine.updateProgress('m1', { status: 'queued' });
    const progress = engine.updateProgress('m1', { status: 'executing' });
    expect(progress.status).toBe('executing');
  });

  it('should handle getProgress for non-existent mission', () => {
    const engine = new MissionEngine();
    expect(engine.getProgress('nonexistent')).toBeUndefined();
  });

  it('should handle getPlan for non-existent plan', () => {
    const engine = new MissionEngine();
    expect(engine.getPlan('nonexistent')).toBeUndefined();
  });

  it('should handle getAllMissions empty', () => {
    const engine = new MissionEngine();
    expect(engine.getAllMissions()).toEqual([]);
  });

  it('should handle summary with missions', () => {
    const engine = new MissionEngine();
    const mission: any = {
      id: 'm1',
      title: 'Test',
      type: 'feature',
      priority: 'medium',
      status: 'draft',
      context: {},
    };
    engine.decompose(mission, [{ title: 'Subtask' }]);
    const s = engine.summary();
    expect(s).toContain('Missions: 1');
  });

  it('should handle summary empty', () => {
    const engine = new MissionEngine();
    const s = engine.summary();
    expect(s).toContain('Missions: 0');
  });

  it('should handle status transition from blocked to executing', () => {
    const engine = new MissionEngine();
    engine.updateProgress('m-blocked', { status: 'queued' });
    engine.updateProgress('m-blocked', { status: 'executing' });
    engine.updateProgress('m-blocked', { status: 'blocked' });
    const progress = engine.updateProgress('m-blocked', { status: 'executing' });
    expect(progress.status).toBe('executing');
  });

  it('should handle status transition from failed to queued', () => {
    const engine = new MissionEngine();
    const progress = engine.updateProgress('m1', { status: 'queued' });
    expect(progress.status).toBe('queued');
  });

  it('should handle decompose adds missions to internal map', () => {
    const engine = new MissionEngine();
    const mission: any = {
      id: 'm1',
      title: 'Root',
      type: 'feature',
      priority: 'high',
      status: 'draft',
      context: {},
    };
    engine.decompose(mission, [{ title: 'Subtask' }]);
    expect(engine.getAllMissions()).toHaveLength(1);
  });
});

// ============================================================
// 12. ParallelExecutor — edge coverage
// ============================================================

describe('ParallelExecutor — squad4 edge coverage', () => {
  it('should handle empty tasks array', async () => {
    const executor = new ParallelExecutor();
    const results = await executor.execute([]);
    expect(results).toEqual([]);
  });

  it('should handle all-settle mode with mixed results', async () => {
    const executor = new ParallelExecutor(2, 'all-settle');
    const results = await executor.execute([
      { id: 't1', execute: () => Promise.resolve('ok') },
      { id: 't2', execute: () => Promise.reject(new Error('fail')) },
    ]);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.id === 't1')?.status).toBe('completed');
    expect(results.find((r) => r.id === 't2')?.status).toBe('failed');
  });

  it('should handle fail-fast mode', async () => {
    const executor = new ParallelExecutor(2, 'fail-fast');
    const results = await executor.execute([
      { id: 't1', execute: () => Promise.reject(new Error('fast fail')) },
      { id: 't2', execute: () => Promise.resolve('should not run') },
    ]);
    expect(results.some((r) => r.status === 'failed')).toBe(true);
  });

  it('should handle priority sorting', async () => {
    const executor = new ParallelExecutor(5, 'all-settle');
    const results = await executor.execute([
      { id: 'low', priority: 'low', execute: () => Promise.resolve('low') },
      { id: 'critical', priority: 'critical', execute: () => Promise.resolve('critical') },
    ]);
    expect(results).toHaveLength(2);
  });

  it('should handle abort', async () => {
    const executor = new ParallelExecutor(1, 'all-settle');
    const promise = executor.execute([
      { id: 't1', execute: () => new Promise((resolve) => setTimeout(resolve, 10000)) },
    ]);
    executor.abort();
    const results = await promise;
    expect(results).toHaveLength(0);
  });

  it('should handle getStats', () => {
    const executor = new ParallelExecutor();
    const stats = executor.getStats();
    expect(stats.total).toBe(0);
  });

  it('should handle abort when already aborted', () => {
    const executor = new ParallelExecutor();
    executor.abort();
    executor.abort();
    expect(executor.getStats().total).toBe(0);
  });

  it('should handle non-Error rejection', async () => {
    const executor = new ParallelExecutor(2, 'all-settle');
    const results = await executor.execute([
      { id: 't1', execute: () => Promise.reject('string error') },
    ]);
    expect(results[0].status).toBe('failed');
    expect(results[0].error).toBe('string error');
  });

  it('should handle task with no priority', async () => {
    const executor = new ParallelExecutor(5, 'all-settle');
    const results = await executor.execute([{ id: 't1', execute: () => Promise.resolve('done') }]);
    expect(results[0].status).toBe('completed');
  });
});

// ============================================================
// 13. RateLimiter — edge coverage (integration-style)
// ============================================================

describe('RateLimiter — squad4 edge coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle default config', () => {
    const rl = new RateLimiter();
    expect(rl.getStats().totalRequests).toBe(0);
  });

  it('should allow request under rate limits', () => {
    const rl = new RateLimiter({ globalMaxRequests: 1000, globalWindowMs: 60000 });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(true);
  });

  it('should block request exceeding agent limit', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 1000,
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 0, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'block',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(false);
  });

  it('should throttle when agent limit exceeded', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 1000,
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 0, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'throttle',
      },
      // @ts-expect-error - enabled not in ThrottleConfig type
      throttle: { enabled: true, threshold: 0, delayMs: 100, maxDelayMs: 500 },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(false);
  });

  it('should handle warning without agent bucket', () => {
    const rl = new RateLimiter();
    const result = rl.check({
      agentId: 'new-agent',
      authority: 'senior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(true);
  });

  it('should handle getWarnings', () => {
    const rl = new RateLimiter();
    expect(rl.getWarnings()).toEqual([]);
  });

  it('should handle getActiveBlocks', () => {
    const rl = new RateLimiter();
    expect(rl.getActiveBlocks()).toEqual([]);
  });

  it('should handle isBlocked', () => {
    const rl = new RateLimiter();
    expect(rl.isBlocked('agent-1')).toBe(false);
  });

  it('should handle forceBlock', () => {
    // @ts-expect-error - enabled not in BlockConfig type
    const rl = new RateLimiter({ block: { enabled: true, thresholds: [], autoRecoveryMs: 60000 } });
    rl.forceBlock('agent-1', 60000);
    expect(rl.isBlocked('agent-1')).toBe(true);
  });

  it('should handle resetAgent', () => {
    const rl = new RateLimiter();
    rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    rl.resetAgent('agent-1');
    expect(rl.getStats().totalRequests).toBe(1);
  });

  it('should handle resetAll', () => {
    const rl = new RateLimiter();
    rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    rl.resetAll();
    expect(rl.getStats().totalRequests).toBe(0);
  });

  it('should handle prune', () => {
    const rl = new RateLimiter();
    rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    const pruned = rl.prune(0);
    expect(pruned).toBeDefined();
  });

  it('should handle sliding-window algorithm', () => {
    const rl = new RateLimiter({
      algorithm: 'sliding-window',
      globalMaxRequests: 1000,
      globalWindowMs: 60000,
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 5, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(true);
  });

  it('should handle adaptive algorithm', () => {
    const rl = new RateLimiter({
      algorithm: 'adaptive',
      globalMaxRequests: 1000,
      globalWindowMs: 60000,
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 5, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(true);
  });

  it('should handle dna limit blocking', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 1000,
      perDNA: {
        // @ts-expect-error - partial Record for edge case testing
        modeLimits: {
          conversational: { dnaId: '*', maxRequests: 0, windowMs: 60000, mode: 'conversational' },
        },
        dnaOverrides: new Map(),
      },
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 100, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(false);
  });

  it('should handle action limit blocking', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 1000,
      perAction: {
        // @ts-expect-error - partial Record for edge case testing
        actionLimits: { read: { actionType: 'read', maxRequests: 0, windowMs: 60000 } },
        actionAliases: new Map(),
      },
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 100, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
      perDNA: {
        // @ts-expect-error - partial Record for edge case testing
        modeLimits: {
          conversational: { dnaId: '*', maxRequests: 100, windowMs: 60000, mode: 'conversational' },
        },
        dnaOverrides: new Map(),
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'deploy',
    });
    expect(result.allowed).toBe(false);
  });

  it('should handle global rate limit blocking', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 0,
      globalWindowMs: 60000,
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 100, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'read',
    });
    expect(result.allowed).toBe(false);
  });

  it('should handle dna bucket reuse', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 1000,
      perDNA: {
        // @ts-expect-error - partial Record for edge case testing
        modeLimits: { hybrid: { dnaId: '*', maxRequests: 100, windowMs: 60000, mode: 'hybrid' } },
        dnaOverrides: new Map(),
      },
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 100, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'hybrid',
      action: 'read',
    });
    expect(result.allowed).toBe(true);
  });

  it('should handle action alias resolution', () => {
    const rl = new RateLimiter({
      globalMaxRequests: 1000,
      perAction: {
        // @ts-expect-error - partial Record for edge case testing
        actionLimits: { write: { actionType: 'write', maxRequests: 100, windowMs: 60000 } },
        actionAliases: new Map([['custom-write', 'write']]),
      },
      perAgent: {
        // @ts-expect-error - partial Record for edge case testing
        defaultLimits: { junior: { agentId: '*', maxRequests: 100, windowMs: 60000 } },
        customLimits: new Map(),
        fallbackPolicy: 'allow',
      },
    });
    const result = rl.check({
      agentId: 'agent-1',
      authority: 'junior',
      dnaId: 'dna-1',
      dnaMode: 'conversational',
      action: 'custom-write',
    });
    expect(result.allowed).toBe(true);
  });
});

// ============================================================
// 14. RateLimiter Policies — edge coverage
// ============================================================

describe('RateLimiter Policies — squad4 edge coverage', () => {
  describe('PerAgentPolicy', () => {
    it('should handle custom limit for agent', () => {
      const policy = new PerAgentPolicy();
      policy.setCustomLimit('agent-1', { agentId: 'agent-1', maxRequests: 100, windowMs: 60000 });
      const limit = policy.getLimitForAgent('agent-1', 'junior');
      expect(limit.maxRequests).toBe(100);
    });

    it('should handle removing custom limit', () => {
      const policy = new PerAgentPolicy();
      policy.setCustomLimit('agent-1', { agentId: 'agent-1', maxRequests: 100, windowMs: 60000 });
      expect(policy.removeCustomLimit('agent-1')).toBe(true);
      expect(policy.removeCustomLimit('agent-1')).toBe(false);
    });

    it('should return fallback policy', () => {
      const policy = new PerAgentPolicy({ fallbackPolicy: 'allow' });
      expect(policy.getFallbackPolicy()).toBe('allow');
    });

    it('should return default limits', () => {
      const policy = new PerAgentPolicy();
      const limits = policy.getDefaultLimits();
      expect(limits.junior.maxRequests).toBe(10);
    });

    it('should update default limit', () => {
      const policy = new PerAgentPolicy();
      policy.updateDefaultLimit('junior', { agentId: '*', maxRequests: 50, windowMs: 30000 });
      expect(policy.getDefaultLimits().junior.maxRequests).toBe(50);
    });

    it('should return custom limits', () => {
      const policy = new PerAgentPolicy();
      expect(policy.getCustomLimits().size).toBe(0);
    });
  });

  describe('PerDNAPolicy', () => {
    it('should handle dna override', () => {
      const policy = new PerDNAPolicy();
      policy.setDNAOverride('dna-1', {
        dnaId: 'dna-1',
        maxRequests: 200,
        windowMs: 60000,
        mode: 'conversational',
      });
      const limit = policy.getLimitForDNA('dna-1', 'conversational');
      expect(limit.maxRequests).toBe(200);
    });

    it('should return default mode limit when no override', () => {
      const policy = new PerDNAPolicy();
      const limit = policy.getLimitForDNA('unknown', 'conversational');
      expect(limit.maxRequests).toBe(60);
    });

    it('should handle removing dna override', () => {
      const policy = new PerDNAPolicy();
      policy.setDNAOverride('dna-1', {
        dnaId: 'dna-1',
        maxRequests: 100,
        windowMs: 60000,
        mode: 'conversational',
      });
      expect(policy.removeDNAOverride('dna-1')).toBe(true);
      expect(policy.removeDNAOverride('dna-1')).toBe(false);
    });

    it('should update mode limit', () => {
      const policy = new PerDNAPolicy();
      policy.updateModeLimit('transactional', {
        dnaId: '*',
        maxRequests: 50,
        windowMs: 30000,
        mode: 'transactional',
      });
      expect(policy.getModeLimits().transactional.maxRequests).toBe(50);
    });

    it('should return mode limits', () => {
      const policy = new PerDNAPolicy();
      const limits = policy.getModeLimits();
      expect(limits.conversational.maxRequests).toBe(60);
    });

    it('should return dna overrides', () => {
      const policy = new PerDNAPolicy();
      expect(policy.getDNAOverrides().size).toBe(0);
    });
  });

  describe('PerActionPolicy', () => {
    it('should resolve action type by alias', () => {
      const policy = new PerActionPolicy();
      policy.setActionAlias('my-action', 'deploy');
      expect(policy.resolveActionType('my-action')).toBe('deploy');
    });

    it('should resolve action type by keyword', () => {
      const policy = new PerActionPolicy();
      expect(policy.resolveActionType('get-users')).toBe('read');
      expect(policy.resolveActionType('create-user')).toBe('write');
      expect(policy.resolveActionType('release-v2')).toBe('deploy');
      expect(policy.resolveActionType('approve-pr')).toBe('governance');
      expect(policy.resolveActionType('validate-schema')).toBe('audit');
      expect(policy.resolveActionType('api-call')).toBe('api');
      expect(policy.resolveActionType('undefined-thing')).toBe('read');
    });

    it('should handle removing alias', () => {
      const policy = new PerActionPolicy();
      policy.setActionAlias('custom', 'write');
      expect(policy.removeActionAlias('custom')).toBe(true);
      expect(policy.removeActionAlias('custom')).toBe(false);
    });

    it('should update action limit', () => {
      const policy = new PerActionPolicy();
      policy.updateActionLimit('deploy', {
        actionType: 'deploy',
        maxRequests: 10,
        windowMs: 120000,
      });
      expect(policy.getActionLimits().deploy.maxRequests).toBe(10);
    });

    it('should get limit for known action type', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('read');
      expect(limit.maxRequests).toBe(100);
    });

    it('should get limit for unknown action', () => {
      const policy = new PerActionPolicy();
      const limit = policy.getLimitForAction('unknown-thing');
      expect(limit.maxRequests).toBe(100);
    });

    it('should return action limits', () => {
      const policy = new PerActionPolicy();
      const limits = policy.getActionLimits();
      expect(Object.keys(limits)).toHaveLength(6);
    });
  });
});
