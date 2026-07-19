import { describe, expect, it } from 'vitest';
import { DelegationEnforcementLayer } from '../pipeline/layers/delegation-enforcement.layer';
import type { PipelineDispatcherContext } from '../pipeline/pipeline-context';

function createContext(
  overrides: Partial<PipelineDispatcherContext> = {},
): PipelineDispatcherContext {
  return {
    id: 'test-context',
    dnaId: 'test-dna',
    dnaMode: 'transactional',
    agentId: 'engineer-1',
    agentAuthority: 'senior',
    action: 'test-action',
    payload: {},
    metadata: new Map(),
    startTime: Date.now(),
    layerResults: [],
    currentLayerIndex: 0,
    failed: false,
    ...overrides,
  };
}

describe('DelegationEnforcementLayer', () => {
  const layer = new DelegationEnforcementLayer();

  it('should have correct id and name', () => {
    expect(layer.id).toBe('delegation-enforcement');
    expect(layer.name).toBe('Delegation Enforcement');
  });

  describe('non-orchestrator agents', () => {
    it('should always pass for engineer agents', async () => {
      const ctx = createContext({ agentId: 'engineer-1' });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should always pass for qa agents', async () => {
      const ctx = createContext({ agentId: 'qa-1' });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should always pass for security agents', async () => {
      const ctx = createContext({ agentId: 'security-1' });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should always pass for architect agents', async () => {
      const ctx = createContext({ agentId: 'architect-1' });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should always pass for devops agents', async () => {
      const ctx = createContext({ agentId: 'devops-1' });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });

    it('should report skipped reason for non-orchestrator', async () => {
      const ctx = createContext({ agentId: 'engineer-42' });
      const result = await layer.execute(ctx);
      expect(result.details.skipped).toBe(true);
      expect(result.details.reason).toBe('Not an orchestrator agent');
    });
  });

  describe('orchestrator without metadata', () => {
    it('should block orchestrator with no metadata', async () => {
      const ctx = createContext({ agentId: 'orchestrator-1' });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details.blocked).toBe(true);
      expect(result.details.reason).toBe(
        'Orchestrator attempted direct execution without delegation',
      );
    });

    it('should block orchestrator with only missionId', async () => {
      const metadata = new Map<string, unknown>([['missionId', 'mission-123']]);
      const ctx = createContext({ agentId: 'orchestrator-1', metadata });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      const details = result.details as Record<string, unknown>;
      const missing = details.missing as Record<string, boolean>;
      expect(missing.dnaPattern).toBe(true);
      expect(missing.delegatedTo).toBe(true);
    });

    it('should block orchestrator with only dnaPattern', async () => {
      const metadata = new Map<string, unknown>([['dnaPattern', 'enterprise-governance']]);
      const ctx = createContext({ agentId: 'orchestrator-1', metadata });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      const details = result.details as Record<string, unknown>;
      const missing = details.missing as Record<string, boolean>;
      expect(missing.missionId).toBe(true);
      expect(missing.delegatedTo).toBe(true);
    });

    it('should block orchestrator with only delegatedTo', async () => {
      const metadata = new Map<string, unknown>([['delegatedTo', 'engineer-1']]);
      const ctx = createContext({ agentId: 'orchestrator-1', metadata });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      const details = result.details as Record<string, unknown>;
      const missing = details.missing as Record<string, boolean>;
      expect(missing.missionId).toBe(true);
      expect(missing.dnaPattern).toBe(true);
    });

    it('should list required actions when blocking', async () => {
      const ctx = createContext({ agentId: 'orchestrator-1' });
      const result = await layer.execute(ctx);
      const details = result.details as Record<string, unknown>;
      expect(details.requiredActions).toBeDefined();
      expect(Array.isArray(details.requiredActions)).toBe(true);
      expect((details.requiredActions as unknown[]).length).toBe(4);
    });
  });

  describe('orchestrator with full metadata', () => {
    it('should pass orchestrator with all required metadata', async () => {
      const metadata = new Map<string, unknown>([
        ['missionId', 'mission-123'],
        ['dnaPattern', 'enterprise-governance'],
        ['delegatedTo', 'engineer-1'],
      ]);
      const ctx = createContext({ agentId: 'orchestrator-1', metadata });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.details.delegationVerified).toBe(true);
    });

    it('should pass orchestrator with extra metadata', async () => {
      const metadata = new Map<string, unknown>([
        ['missionId', 'mission-456'],
        ['dnaPattern', 'military-operations'],
        ['delegatedTo', 'security-1'],
        ['extraField', 'extra-value'],
        ['anotherField', 42],
      ]);
      const ctx = createContext({ agentId: 'orchestrator-1', metadata });
      const result = await layer.execute(ctx);
      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
    });
  });
});
