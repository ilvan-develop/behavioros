import type { GovernanceRule, Mission } from '@behavioros/schemas';
import { describe, expect, it, vi } from 'vitest';
import { GovernanceTelemetryEngine } from '../governance-telemetry';

const RULE: GovernanceRule = {
  id: 'gov-test-rule',
  name: 'Test Rule',
  description: 'A rule used only in tests — must never leak into the summary.',
  level: 'critical',
  action: 'block',
};

function mission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'mission-1',
    title: 'Secret task: rotate payment gateway credentials',
    type: 'feature',
    priority: 'medium',
    status: 'draft',
    assignees: ['agent-1'],
    ...overrides,
  } as Mission;
}

describe('GovernanceTelemetryEngine', () => {
  it('records nothing when disabled (the default)', () => {
    const engine = new GovernanceTelemetryEngine();
    expect(engine.isEnabled()).toBe(false);

    engine.onGovernanceViolation(RULE, { agentId: 'agent-1' });
    engine.onGovernanceApproved(RULE, { agentId: 'agent-1' });
    engine.onMissionCompleted(mission());
    engine.onMissionFailed(mission(), new Error('boom'));

    const summary = engine.getSummary();
    expect(summary.violationsBlocked).toHaveLength(0);
    expect(summary.violationsApproved).toHaveLength(0);
    expect(summary.byAgent).toHaveLength(0);
    expect(summary.missionsCompleted).toBe(0);
    expect(summary.missionsFailed).toBe(0);
    expect(summary.agentEfficiency).toBeNull();
  });

  it('aggregates violations, approvals, and mission outcomes when enabled', () => {
    const engine = new GovernanceTelemetryEngine({ enabled: true });

    engine.onGovernanceViolation(RULE, { agentId: 'agent-1' });
    engine.onGovernanceViolation(RULE, { agentId: 'agent-1' });
    engine.onGovernanceViolation(RULE, { agentId: 'agent-2' });
    engine.onGovernanceApproved(RULE, { agentId: 'agent-1' });
    engine.onMissionCompleted(mission({ assignees: ['agent-1'] }));
    engine.onMissionCompleted(mission({ assignees: ['agent-1'] }));
    engine.onMissionFailed(mission({ assignees: ['agent-1'] }), new Error('boom'));

    const summary = engine.getSummary();

    expect(summary.violationsBlocked).toEqual([
      { ruleId: 'gov-test-rule', ruleName: 'Test Rule', level: 'critical', action: 'block', count: 3 },
    ]);
    expect(summary.violationsApproved).toEqual([
      { ruleId: 'gov-test-rule', ruleName: 'Test Rule', level: 'critical', action: 'block', count: 1 },
    ]);

    const agent1 = summary.byAgent.find((a) => a.agentId === 'agent-1');
    const agent2 = summary.byAgent.find((a) => a.agentId === 'agent-2');
    expect(agent1).toEqual({
      agentId: 'agent-1',
      violationsTriggered: 2,
      missionsCompleted: 2,
      missionsFailed: 1,
    });
    expect(agent2).toEqual({
      agentId: 'agent-2',
      violationsTriggered: 1,
      missionsCompleted: 0,
      missionsFailed: 0,
    });

    expect(summary.missionsCompleted).toBe(2);
    expect(summary.missionsFailed).toBe(1);
    expect(summary.agentEfficiency).toBeCloseTo(2 / 3);
  });

  it('falls back to "unknown" agent id when context has none', () => {
    const engine = new GovernanceTelemetryEngine({ enabled: true });
    engine.onGovernanceViolation(RULE, {});
    engine.onGovernanceViolation(RULE, undefined);
    engine.onGovernanceViolation(RULE, 'not-an-object');

    const summary = engine.getSummary();
    expect(summary.byAgent).toEqual([
      { agentId: 'unknown', violationsTriggered: 3, missionsCompleted: 0, missionsFailed: 0 },
    ]);
  });

  it('never includes free-text fields in the summary (only ids/counters/enums)', () => {
    const engine = new GovernanceTelemetryEngine({ enabled: true });
    engine.onGovernanceViolation(RULE, {
      agentId: 'agent-1',
      description: 'edit apps/api/src/payments/stripe-webhook.ts to bypass validation',
      filePath: '/home/user/secret-project/payments.ts',
    });
    engine.onMissionCompleted(
      mission({ title: 'Do not leak this title', description: 'nor this description' }),
    );

    const summary = engine.getSummary();
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain('bypass validation');
    expect(serialized).not.toContain('secret-project');
    expect(serialized).not.toContain('Do not leak this title');
    expect(serialized).not.toContain('nor this description');
  });

  it('exports via the webhook sender only when enabled and a URL is configured', async () => {
    const send = vi.fn().mockResolvedValue(undefined);

    const disabledEngine = new GovernanceTelemetryEngine({ enabled: false }, send);
    await disabledEngine.exportNow();
    expect(send).not.toHaveBeenCalled();

    const noUrlEngine = new GovernanceTelemetryEngine({ enabled: true }, send);
    await noUrlEngine.exportNow();
    expect(send).not.toHaveBeenCalled();

    const wiredEngine = new GovernanceTelemetryEngine(
      { enabled: true, webhookUrl: 'https://example.com/hook' },
      send,
    );
    wiredEngine.onGovernanceViolation(RULE, { agentId: 'agent-1' });
    await wiredEngine.exportNow();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ violationsBlocked: expect.any(Array) }),
    );
    wiredEngine.stop();
  });

  it('does not start an export timer when disabled', () => {
    vi.useFakeTimers();
    const send = vi.fn().mockResolvedValue(undefined);
    const engine = new GovernanceTelemetryEngine(
      { enabled: false, webhookUrl: 'https://example.com/hook' },
      send,
    );
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(send).not.toHaveBeenCalled();
    engine.stop();
    vi.useRealTimers();
  });
});
