import { beforeEach, describe, expect, it } from 'vitest';
import type { GateLevel, GateStage } from '../engines/governance/governance-gate';
import { GovernanceGate } from '../engines/governance/governance-gate';

function baseContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agentId: 'engineer-1',
    agentAuthority: 'senior',
    action: 'edit-file',
    targetType: 'file',
    impact: 'low',
    boundaries: [],
    ...overrides,
  };
}

describe('GovernanceGate', () => {
  let gate: GovernanceGate;

  beforeEach(() => {
    gate = new GovernanceGate();
  });

  it('should pass all stages with default configuration', async () => {
    const report = await gate.evaluate(baseContext());

    expect(report.passed).toBe(true);
    expect(report.blocked).toBe(false);
    expect(report.results).toHaveLength(5);
    expect(report.results.every((r) => r.passed)).toBe(true);
    expect(report.results.every((r) => r.duration >= 0)).toBe(true);
  });

  it('should block on boundary violation and skip subsequent stages', async () => {
    const report = await gate.evaluate(
      baseContext({
        boundaries: [{ type: 'max_files', value: 1, name: 'max-files', scope: 'global' }],
        fileCount: 5,
      }),
    );

    expect(report.blocked).toBe(true);
    expect(report.passed).toBe(false);

    expect(report.results[0].stage).toBe('boundary');
    expect(report.results[0].passed).toBe(false);

    for (let i = 1; i < report.results.length; i++) {
      expect(report.results[i].passed).toBe(false);
      expect(report.results[i].message).toContain('Skipped');
    }
  });

  it('should continue on non-blocking failures when stage level is warn', async () => {
    gate.setStageLevel('authority', 'warn');

    const report = await gate.evaluate(
      baseContext({ agentAuthority: 'junior', impact: 'critical' }),
    );

    expect(report.passed).toBe(false);
    expect(report.blocked).toBe(false);

    const failedStages = report.results.filter((r) => !r.passed);
    expect(failedStages.length).toBeGreaterThanOrEqual(1);

    const nonSkipped = report.results.filter((r) => !r.message.includes('Skipped'));
    expect(nonSkipped.length).toBe(report.results.length);
  });

  it('should continue on failure when stage level is log', async () => {
    gate.setStageLevel('risk', 'log');

    const report = await gate.evaluate(
      baseContext({ impact: 'critical', riskThreshold: 1, agentAuthority: 'lead' }),
    );

    expect(report.passed).toBe(false);
    expect(report.blocked).toBe(false);

    const riskResult = report.results.find((r) => r.stage === 'risk');
    expect(riskResult?.passed).toBe(false);
    expect(riskResult?.level).toBe('log');

    const complianceResult = report.results.find((r) => r.stage === 'compliance');
    expect(complianceResult?.passed).toBe(true);
  });

  it('should isolate boundary stage and skip after block-level failure', async () => {
    const report = await gate.evaluate(
      baseContext({
        boundaries: [{ type: 'max_files', value: 1, name: 'max-files', scope: 'global' }],
        fileCount: 10,
      }),
    );

    const boundaryResult = report.results[0];
    expect(boundaryResult.stage).toBe('boundary');
    expect(boundaryResult.level).toBe('block');
    expect(boundaryResult.passed).toBe(false);

    for (let i = 1; i < report.results.length; i++) {
      expect(report.results[i].passed).toBe(false);
      expect(report.results[i].message).toContain('Skipped');
    }
  });

  it('should respect custom stage levels', async () => {
    const levels: [GateStage, GateLevel][] = [
      ['boundary', 'log'],
      ['authority', 'warn'],
      ['policy', 'block'],
      ['risk', 'log'],
      ['compliance', 'warn'],
    ];
    for (const [stage, level] of levels) {
      gate.setStageLevel(stage, level);
    }

    const report = await gate.evaluate(baseContext());

    for (let i = 0; i < levels.length; i++) {
      expect(report.results[i].level).toBe(levels[i][1]);
    }
  });

  it('should record timing for every stage', async () => {
    const report = await gate.evaluate(baseContext());

    for (const result of report.results) {
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    }
  });

  it('should store reports in history', async () => {
    const report1 = await gate.evaluate(baseContext());
    const report2 = await gate.evaluate(baseContext());

    const history = gate.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].pipelineId).toBe(report1.pipelineId);
    expect(history[1].pipelineId).toBe(report2.pipelineId);
  });

  it('should filter history by pipelineId', async () => {
    const report = await gate.evaluate(baseContext());

    const filtered = gate.getHistory(report.pipelineId);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].pipelineId).toBe(report.pipelineId);

    const notFound = gate.getHistory('non-existent');
    expect(notFound).toHaveLength(0);
  });

  it('should clear history and stage levels on reset', async () => {
    await gate.evaluate(baseContext());
    await gate.evaluate(baseContext());
    gate.setStageLevel('boundary', 'warn');

    expect(gate.getHistory()).toHaveLength(2);

    gate.reset();

    expect(gate.getHistory()).toHaveLength(0);

    const report = await gate.evaluate(baseContext());
    expect(report.results[0].level).toBe('block');
  });

  it('should use defaultLevel constructor parameter', async () => {
    const warnGate = new GovernanceGate('warn');

    const report = await warnGate.evaluate(
      baseContext({
        boundaries: [{ type: 'max_files', value: 1, name: 'max-files', scope: 'global' }],
        fileCount: 10,
      }),
    );

    expect(report.passed).toBe(false);
    expect(report.blocked).toBe(false);

    const nonSkipped = report.results.filter((r) => !r.message.includes('Skipped'));
    expect(nonSkipped.length).toBe(5);
  });

  it('should pass compliance stage when all policies are satisfied', async () => {
    const report = await gate.evaluate(
      baseContext({
        compliancePolicies: ['soc2', 'gdpr', 'pci-dss'],
        requiredCompliancePolicies: ['soc2', 'gdpr'],
      }),
    );

    const complianceResult = report.results.find((r) => r.stage === 'compliance');
    expect(complianceResult?.passed).toBe(true);
    expect(complianceResult?.message).toContain('All');
  });

  it('should fail compliance stage when policies are missing', async () => {
    const report = await gate.evaluate(
      baseContext({
        compliancePolicies: ['soc2'],
        requiredCompliancePolicies: ['soc2', 'gdpr', 'pci-dss'],
      }),
    );

    const complianceResult = report.results.find((r) => r.stage === 'compliance');
    expect(complianceResult?.passed).toBe(false);
    expect(complianceResult?.message).toContain('Missing');
    expect(complianceResult?.details?.missing).toEqual(['gdpr', 'pci-dss']);
  });

  it('should generate unique pipelineIds', async () => {
    const report1 = await gate.evaluate(baseContext());
    const report2 = await gate.evaluate(baseContext());

    expect(report1.pipelineId).not.toBe(report2.pipelineId);
  });

  it('should produce report with all required fields', async () => {
    const report = await gate.evaluate(baseContext());

    expect(report).toHaveProperty('pipelineId');
    expect(report).toHaveProperty('results');
    expect(report).toHaveProperty('passed');
    expect(report).toHaveProperty('blocked');
    expect(report).toHaveProperty('timestamp');
    expect(typeof report.pipelineId).toBe('string');
    expect(typeof report.timestamp).toBe('string');
    expect(Array.isArray(report.results)).toBe(true);
  });

  it('should handle boundary violations even with senior authority', async () => {
    const report = await gate.evaluate(
      baseContext({
        boundaries: [{ type: 'max_files', value: 1, name: 'max-files', scope: 'global' }],
        fileCount: 3,
        agentAuthority: 'senior',
      }),
    );

    expect(report.blocked).toBe(true);
    expect(report.results[0].stage).toBe('boundary');
    expect(report.results[0].passed).toBe(false);
    expect(report.results[0].message).toContain('Boundary violation');
  });
});
