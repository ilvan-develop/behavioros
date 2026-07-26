import type { GovernanceRule, QualityGate } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DecisionContext, DecisionVote } from '../engines/decision/decision-engine';
import { DecisionEngine } from '../engines/decision/decision-engine';
import type { GovernanceContext } from '../engines/governance/governance-engine';
import { GovernanceEngine } from '../engines/governance/governance-engine';
import { LearningEngine } from '../engines/learning/learning-engine';
import { MissionEngine } from '../engines/mission/mission-engine';
import { QualityEngine } from '../engines/quality/quality-engine';
import { SelfHealingEngine } from '../engines/quality/self-healing-engine';

// ============================================================
// Test Helpers
// ============================================================

function createGovernanceRules(): GovernanceRule[] {
  return [
    {
      id: 'block-prod',
      name: 'Block Prod Changes',
      level: 'critical',
      action: 'block',
      scope: ['infrastructure'],
    },
    {
      id: 'warn-module',
      name: 'Warn on Module',
      level: 'medium',
      action: 'warn',
      conditions: ['type:module'],
    },
    {
      id: 'escalate-db',
      name: 'Escalate DB Changes',
      level: 'high',
      action: 'escalate',
      scope: ['database'],
    },
    { id: 'log-low', name: 'Log Low Impact', level: 'low', action: 'log' },
  ];
}

function createContext(overrides: Partial<GovernanceContext> = {}): GovernanceContext {
  return {
    agentId: 'agent-1',
    agentRole: 'engineer',
    agentAuthority: 'senior',
    action: 'modify-module',
    targetType: 'module',
    impact: 'medium',
    ...overrides,
  };
}

function createDecisionContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    id: 'dec-1',
    title: 'Architecture Decision',
    type: 'architecture',
    participants: [
      { id: 'p1', role: 'architect', authority: 3, weight: 1 },
      { id: 'p2', role: 'engineer', authority: 2, weight: 1 },
      { id: 'p3', role: 'qa', authority: 2, weight: 1 },
    ],
    options: [
      { id: 'opt-a', title: 'Option A', pros: ['fast'], cons: ['risky'], risk: 'medium' },
      { id: 'opt-b', title: 'Option B', pros: ['safe'], cons: ['slow'], risk: 'low' },
    ],
    ...overrides,
  };
}

function createQualityGates(): QualityGate[] {
  return [
    { id: 'test_coverage', name: 'test_coverage', type: 'test_coverage', threshold: 80 },
    { id: 'lint', name: 'lint', type: 'lint', threshold: 100 },
    { id: 'typecheck', name: 'typecheck', type: 'typecheck', threshold: 100 },
  ];
}

// ============================================================
// 1. Governance → Quality → Audit Flow
// ============================================================

describe('Governance → Quality → Audit Flow', () => {
  let govEngine: GovernanceEngine;
  let qualityEngine: QualityEngine;

  beforeEach(() => {
    govEngine = new GovernanceEngine(createGovernanceRules());
    qualityEngine = new QualityEngine(createQualityGates(), { minScore: 80 });
  });

  it('should block critical infrastructure action via governance', () => {
    const decision = govEngine.evaluate(
      createContext({ targetType: 'infrastructure', impact: 'critical' }),
    );
    expect(decision.allowed).toBe(false);
    expect(decision.escalationRequired).toBe(true);
  });

  it('should approve medium-impact module change', () => {
    const decision = govEngine.evaluate(createContext());
    expect(decision.allowed).toBe(true);
  });

  it('should warn on module-type actions via condition match', () => {
    const decision = govEngine.evaluate(createContext());
    expect(decision.allowed).toBe(true);
    const applicable = govEngine.getApplicableRules(createContext());
    expect(applicable.some((r) => r.action === 'warn')).toBe(true);
  });

  it('should escalate database changes to higher authority', () => {
    const decision = govEngine.evaluate(createContext({ targetType: 'database', impact: 'high' }));
    expect(decision.escalationRequired).toBe(true);
  });

  it('should require higher authority for critical impact', () => {
    const juniorDecision = govEngine.evaluate(
      createContext({ agentAuthority: 'junior', impact: 'critical' }),
    );
    expect(juniorDecision.allowed).toBe(false);
    expect(juniorDecision.requiredAuthority).toBeDefined();
  });

  it('should allow c-level agent on critical actions', () => {
    const decision = govEngine.evaluate(
      createContext({ agentAuthority: 'c-level', impact: 'critical' }),
    );
    expect(decision.allowed).toBe(true);
  });

  it('should evaluate quality metrics after governance approval', () => {
    const govDecision = govEngine.evaluate(createContext());
    expect(govDecision.allowed).toBe(true);

    const report = qualityEngine.evaluate([
      { name: 'test_coverage', value: 85 },
      { name: 'lint', value: 100 },
      { name: 'typecheck', value: 100 },
    ]);
    expect(report.passed).toBe(true);
    expect(report.score).toBe(100);
  });

  it('should fail quality when metrics below threshold', () => {
    const report = qualityEngine.evaluate([
      { name: 'test_coverage', value: 50 },
      { name: 'lint', value: 70 },
    ]);
    expect(report.passed).toBe(false);
    expect(report.checks.some((c) => !c.passed)).toBe(true);
  });

  it('should chain governance approval with quality evaluation', () => {
    const govDecision = govEngine.evaluate(createContext({ impact: 'medium' }));

    const qualityReport = govDecision.allowed
      ? qualityEngine.evaluate([
          { name: 'test_coverage', value: 90 },
          { name: 'lint', value: 100 },
          { name: 'typecheck', value: 100 },
        ])
      : null;

    expect(govDecision.allowed).toBe(true);
    expect(qualityReport).not.toBeNull();
    expect(qualityReport!.passed).toBe(true);
  });

  it('should block quality evaluation when governance denies', () => {
    const govDecision = govEngine.evaluate(
      createContext({ targetType: 'infrastructure', impact: 'critical' }),
    );

    let qualityRan = false;
    if (govDecision.allowed) {
      qualityRan = true;
      qualityEngine.evaluate([{ name: 'test_coverage', value: 90 }]);
    }

    expect(govDecision.allowed).toBe(false);
    expect(qualityRan).toBe(false);
  });

  it('should track quality reports in history', () => {
    govEngine.evaluate(createContext());
    qualityEngine.evaluate([{ name: 'test_coverage', value: 85 }]);

    expect(qualityEngine.getHistory()).toHaveLength(1);
    expect(qualityEngine.getHistory()[0].id).toBeDefined();
  });
});

// ============================================================
// 2. Memory → Recovery → Mission Flow
// ============================================================

describe('Memory → Recovery → Mission Flow', () => {
  let missionEngine: MissionEngine;
  let learningEngine: LearningEngine;

  beforeEach(() => {
    missionEngine = new MissionEngine();
    learningEngine = new LearningEngine();
  });

  it('should create a mission decomposition plan', () => {
    const plan = missionEngine.decompose(
      { id: 'm-1', title: 'Build Feature', type: 'feature', priority: 'high', status: 'queued' },
      [
        { id: 'sub-1', title: 'Design', type: 'feature', priority: 'high', status: 'queued' },
        { id: 'sub-2', title: 'Implement', type: 'feature', priority: 'high', status: 'queued' },
      ],
    );

    expect(plan.subMissions).toHaveLength(2);
    expect(plan.rootMission).toBe('m-1');
  });

  it('should update mission progress through valid state machine', () => {
    missionEngine.decompose(
      { id: 'm-2', title: 'Task', type: 'feature', priority: 'medium', status: 'queued' },
      [{ id: 'sub-1', title: 'Sub', type: 'feature', priority: 'medium', status: 'queued' }],
    );

    const progress = missionEngine.updateProgress('m-2', {
      status: 'executing',
      progress: 50,
      subTasks: 1,
      completedSubTasks: 0,
    });

    expect(progress.status).toBe('executing');
    expect(progress.progress).toBe(50);
  });

  it('should record learning events from mission outcomes', () => {
    const event = learningEngine.record({
      type: 'observation',
      source: 'mission-engine',
      data: { content: 'Mission completed successfully', impact: 'medium' },
      confidence: 0.9,
      applied: false,
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe('observation');
    expect(learningEngine.getEvents()).toHaveLength(1);
  });

  it('should detect patterns from multiple learning events', () => {
    for (let i = 0; i < 5; i++) {
      learningEngine.record({
        type: 'pattern',
        source: 'test',
        data: { content: `Pattern ${i}`, impact: 'medium' },
        confidence: 0.8,
        applied: false,
      });
    }

    expect(learningEngine.getEvents()).toHaveLength(5);
  });

  it('should track mission completion via valid transitions and record learning', () => {
    missionEngine.decompose(
      { id: 'm-3', title: 'Complete Task', type: 'feature', priority: 'high', status: 'queued' },
      [],
    );

    missionEngine.updateProgress('m-3', { status: 'executing', progress: 50 });
    missionEngine.updateProgress('m-3', { status: 'completed', progress: 100 });

    learningEngine.record({
      type: 'insight',
      source: 'post-mortem',
      data: { content: 'Mission completed on time', impact: 'high' },
      confidence: 0.95,
      applied: true,
    });

    const progress = missionEngine.getProgress('m-3');
    expect(progress?.status).toBe('completed');
    expect(learningEngine.getEvents()).toHaveLength(1);
  });

  it('should handle mission blocked by governance', () => {
    missionEngine.decompose(
      { id: 'm-4', title: 'Blocked Task', type: 'feature', priority: 'critical', status: 'queued' },
      [],
    );

    missionEngine.updateProgress('m-4', { status: 'executing', progress: 10 });
    missionEngine.updateProgress('m-4', {
      status: 'blocked',
      blockers: ['Governance: requires VP approval'],
    });

    const progress = missionEngine.getProgress('m-4');
    expect(progress?.status).toBe('blocked');
    expect(progress?.blockers).toContain('Governance: requires VP approval');
  });

  it('should generate learning report from mission events', () => {
    learningEngine.record({
      type: 'insight',
      source: 'mission',
      data: { content: 'Fast delivery pattern', impact: 'high' },
      confidence: 0.9,
      applied: true,
    });

    learningEngine.record({
      type: 'correction',
      source: 'mission',
      data: { content: 'Test coverage gap found', impact: 'medium' },
      confidence: 0.7,
      applied: false,
    });

    const report = learningEngine.generateReport();
    expect(report.totalEvents).toBe(2);
    expect(report.appliedCount).toBe(1);
    expect(report.pendingCount).toBe(1);
  });

  it('should track source reputation from mission events', () => {
    for (let i = 0; i < 3; i++) {
      learningEngine.record({
        type: 'insight',
        source: 'mission-controller',
        data: { content: `Insight ${i}` },
        confidence: 0.85,
        applied: true,
      });
    }

    learningEngine.record({
      type: 'correction',
      source: 'mission-controller',
      data: { content: 'Correction' },
      confidence: 0.6,
      applied: false,
    });

    const rep = learningEngine.getSourceReputation('mission-controller');
    expect(rep).not.toBeNull();
    expect(rep!.totalEvents).toBe(4);
    expect(rep!.insightCount).toBe(3);
    expect(rep!.correctionCount).toBe(1);
  });
});

// ============================================================
// 3. Decision → Governance Flow
// ============================================================

describe('Decision → Governance Flow', () => {
  let decisionEngine: DecisionEngine;
  let govEngine: GovernanceEngine;

  beforeEach(() => {
    decisionEngine = new DecisionEngine('majority', 0.6);
    govEngine = new GovernanceEngine(createGovernanceRules());
  });

  it('should reach consensus via majority vote (all agree)', () => {
    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-a', confidence: 0.8 },
      { participantId: 'p3', optionId: 'opt-a', confidence: 0.85 },
    ];

    const result = decisionEngine.vote(createDecisionContext(), votes);
    expect(result.winningOption).toBe('opt-a');
    expect(result.consensus).toBe(true);
  });

  it('should handle unanimous voting strategy', () => {
    const engine = new DecisionEngine('unanimous');
    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-a', confidence: 0.8 },
      { participantId: 'p3', optionId: 'opt-a', confidence: 0.85 },
    ];

    const result = engine.vote(createDecisionContext(), votes);
    expect(result.winningOption).toBe('opt-a');
    expect(result.consensus).toBe(true);
  });

  it('should fail unanimous vote when participants disagree', () => {
    const engine = new DecisionEngine('unanimous');
    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-b', confidence: 0.8 },
      { participantId: 'p3', optionId: 'opt-a', confidence: 0.85 },
    ];

    const result = engine.vote(createDecisionContext(), votes);
    expect(result.winningOption).toBeNull();
  });

  it('should use weighted voting with authority', () => {
    const engine = new DecisionEngine('weighted');
    const context = createDecisionContext({
      participants: [
        { id: 'p1', role: 'architect', authority: 5, weight: 2 },
        { id: 'p2', role: 'junior', authority: 1, weight: 1 },
      ],
    });

    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-b', confidence: 0.9 },
    ];

    const result = engine.vote(context, votes);
    expect(result.winningOption).toBe('opt-a');
  });

  it('should evaluate risk of high-risk options', () => {
    const context = createDecisionContext({
      options: [
        { id: 'opt-high', title: 'High Risk', pros: [], cons: ['dangerous'], risk: 'high' },
        { id: 'opt-low', title: 'Low Risk', pros: ['safe'], cons: [], risk: 'low' },
      ],
    });

    const risk = decisionEngine.evaluateRisk(context);
    expect(risk.level).toBeDefined();
    expect(risk.factors).toBeDefined();
  });

  it('should process quorum-based decision', () => {
    const engine = new DecisionEngine('quorum', 0.6);
    const context = createDecisionContext({
      participants: [
        { id: 'p1', role: 'lead', authority: 4, weight: 1 },
        { id: 'p2', role: 'engineer', authority: 2, weight: 1 },
        { id: 'p3', role: 'qa', authority: 2, weight: 1 },
        { id: 'p4', role: 'designer', authority: 2, weight: 1 },
        { id: 'p5', role: 'pm', authority: 3, weight: 1 },
      ],
    });

    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-a', confidence: 0.8 },
      { participantId: 'p3', optionId: 'opt-a', confidence: 0.7 },
    ];

    const result = engine.vote(context, votes);
    expect(result.winningOption).toBe('opt-a');
  });

  it('should handle dissenting votes and record them', () => {
    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-b', confidence: 0.8 },
      { participantId: 'p3', optionId: 'opt-b', confidence: 0.7 },
    ];

    const result = decisionEngine.vote(createDecisionContext(), votes);
    expect(result.dissenting.length).toBeGreaterThan(0);
  });

  it('should chain decision outcome to governance action', () => {
    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'opt-a', confidence: 0.9 },
      { participantId: 'p2', optionId: 'opt-a', confidence: 0.8 },
      { participantId: 'p3', optionId: 'opt-a', confidence: 0.85 },
    ];

    const decResult = decisionEngine.vote(createDecisionContext(), votes);

    if (decResult.winningOption && decResult.confidence > 0.7) {
      const govDecision = govEngine.evaluate(createContext({ impact: 'medium' }));
      expect(govDecision.allowed).toBe(true);
    }
  });
});

// ============================================================
// 4. Learning → Self-Healing Flow
// ============================================================

describe('Learning → Self-Healing Flow', () => {
  let learningEngine: LearningEngine;
  let healingEngine: SelfHealingEngine;

  beforeEach(() => {
    learningEngine = new LearningEngine();
    healingEngine = new SelfHealingEngine({ maxRetries: 3 });
  });

  it('should monitor failed gate and attempt auto-fix', async () => {
    healingEngine.registerFixPattern('lint', async () => true);

    const action = await healingEngine.monitor({
      gate: 'lint',
      passed: false,
      error: '3 lint errors found',
    });

    expect(action).not.toBeNull();
    expect(action!.type).toBe('auto-fix');
    expect(action!.success).toBe(true);
  });

  it('should alert when no fix pattern registered', async () => {
    const action = await healingEngine.monitor({
      gate: 'unknown-gate',
      passed: false,
      error: 'Unknown failure',
    });

    expect(action).not.toBeNull();
    expect(action!.type).toBe('alert');
  });

  it('should return null when gate passes', async () => {
    const action = await healingEngine.monitor({
      gate: 'lint',
      passed: true,
    });

    expect(action).toBeNull();
  });

  it('should escalate after max retries exceeded', async () => {
    healingEngine.registerFixPattern('typecheck', async () => false);

    for (let i = 0; i < 3; i++) {
      await healingEngine.monitor({
        gate: 'typecheck',
        passed: false,
        error: 'Type error',
      });
    }

    const action = await healingEngine.monitor({
      gate: 'typecheck',
      passed: false,
      error: 'Type error',
    });

    expect(action).not.toBeNull();
    expect(action!.type).toBe('alert');
    expect(action!.description).toMatch(/Max retries/i);
  });

  it('should track healing history', async () => {
    healingEngine.registerFixPattern('coverage', async () => true);

    await healingEngine.monitor({ gate: 'coverage', passed: false, error: 'Low coverage' });
    await healingEngine.monitor({ gate: 'coverage', passed: false, error: 'Low coverage' });

    const history = await healingEngine.getHistory();
    expect(history).toHaveLength(2);
    expect(history.every((h) => h.target === 'coverage')).toBe(true);
  });

  it('should provide healing stats', async () => {
    healingEngine.registerFixPattern('g1', async () => true);
    healingEngine.registerFixPattern('g2', async () => false);

    await healingEngine.monitor({ gate: 'g1', passed: false });
    await healingEngine.monitor({ gate: 'g2', passed: false });
    await healingEngine.monitor({ gate: 'g2', passed: false });

    const stats = await healingEngine.getStats();
    expect(stats.totalAttempts).toBe(3);
    expect(stats.successful).toBe(1);
    expect(stats.failed).toBe(2);
  });

  it('should record learning events from healing outcomes', async () => {
    healingEngine.registerFixPattern('security', async () => true);
    const action = await healingEngine.monitor({
      gate: 'security',
      passed: false,
      error: 'Security vulnerability',
    });

    learningEngine.record({
      type: 'insight',
      source: 'self-healing',
      data: { content: `Healing action ${action!.type} for ${action!.target}`, impact: 'high' },
      confidence: 0.9,
      applied: action!.success ?? false,
    });

    const events = learningEngine.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source).toBe('self-healing');
  });

  it('should detect repeated failures and generate pattern learning', async () => {
    healingEngine.registerFixPattern('perf', async () => false);

    for (let i = 0; i < 4; i++) {
      await healingEngine.monitor({ gate: 'perf', passed: false, error: 'Slow query' });
    }

    learningEngine.record({
      type: 'pattern',
      source: 'self-healing',
      data: { content: 'Repeated performance failures detected', impact: 'critical' },
      confidence: 0.95,
      applied: false,
    });

    const report = learningEngine.generateReport();
    expect(report.totalEvents).toBe(1);
  });

  it('should rollback to checkpoint on critical failure', async () => {
    const success = await healingEngine.rollback('checkpoint-abc-123');
    expect(success).toBe(true);

    const history = await healingEngine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].type).toBe('rollback');
  });
});

// ============================================================
// 5. Mission Lifecycle with All Engines
// ============================================================

describe('Mission Lifecycle with All Engines', () => {
  let govEngine: GovernanceEngine;
  let qualityEngine: QualityEngine;
  let missionEngine: MissionEngine;
  let learningEngine: LearningEngine;
  let healingEngine: SelfHealingEngine;
  let decisionEngine: DecisionEngine;

  beforeEach(() => {
    govEngine = new GovernanceEngine(createGovernanceRules());
    qualityEngine = new QualityEngine(createQualityGates(), { minScore: 80 });
    missionEngine = new MissionEngine();
    learningEngine = new LearningEngine();
    healingEngine = new SelfHealingEngine({ maxRetries: 2 });
    decisionEngine = new DecisionEngine('majority');
  });

  it('should complete full mission lifecycle: governance → quality → learning', () => {
    const govDecision = govEngine.evaluate(createContext({ impact: 'medium' }));
    expect(govDecision.allowed).toBe(true);

    const qualityReport = qualityEngine.evaluate([
      { name: 'test_coverage', value: 90 },
      { name: 'lint', value: 100 },
      { name: 'typecheck', value: 100 },
    ]);
    expect(qualityReport.passed).toBe(true);

    missionEngine.decompose(
      { id: 'lc-1', title: 'Full Lifecycle', type: 'feature', priority: 'high', status: 'queued' },
      [{ id: 'sub-1', title: 'Sub Task', type: 'feature', priority: 'high', status: 'queued' }],
    );
    missionEngine.updateProgress('lc-1', { status: 'executing', progress: 50 });
    missionEngine.updateProgress('lc-1', { status: 'completed', progress: 100 });

    learningEngine.record({
      type: 'insight',
      source: 'lifecycle',
      data: { content: 'Full lifecycle completed successfully', impact: 'high' },
      confidence: 0.95,
      applied: true,
    });

    const progress = missionEngine.getProgress('lc-1');
    expect(progress?.status).toBe('completed');
    expect(learningEngine.getEvents()).toHaveLength(1);
  });

  it('should handle mission blocked by governance with escalation', () => {
    const govDecision = govEngine.evaluate(
      createContext({ targetType: 'infrastructure', impact: 'critical' }),
    );
    expect(govDecision.allowed).toBe(false);
    expect(govDecision.escalationRequired).toBe(true);

    missionEngine.decompose(
      {
        id: 'lc-2',
        title: 'Blocked Mission',
        type: 'feature',
        priority: 'critical',
        status: 'queued',
      },
      [],
    );
    missionEngine.updateProgress('lc-2', { status: 'executing', progress: 5 });
    missionEngine.updateProgress('lc-2', {
      status: 'blocked',
      blockers: [`Governance: ${govDecision.reason}`],
    });

    learningEngine.record({
      type: 'observation',
      source: 'governance',
      data: { content: `Mission blocked: ${govDecision.reason}`, impact: 'high' },
      confidence: 1,
      applied: false,
    });

    const progress = missionEngine.getProgress('lc-2');
    expect(progress?.status).toBe('blocked');
    expect(progress?.blockers).toHaveLength(1);
  });

  it('should handle quality failure with self-healing', async () => {
    healingEngine.registerFixPattern('test_coverage', async () => true);

    const govDecision = govEngine.evaluate(createContext());
    expect(govDecision.allowed).toBe(true);

    const qualityReport = qualityEngine.evaluate([{ name: 'test_coverage', value: 50 }]);
    expect(qualityReport.passed).toBe(false);

    const failedCheck = qualityReport.checks.find((c) => !c.passed);
    const healingAction = await healingEngine.monitor({
      gate: failedCheck!.gate,
      passed: false,
      error: failedCheck!.message,
    });

    expect(healingAction).not.toBeNull();
    expect(healingAction!.type).toBe('auto-fix');

    learningEngine.record({
      type: 'correction',
      source: 'self-healing',
      data: { content: `Auto-fix applied for ${failedCheck!.gate}`, impact: 'medium' },
      confidence: 0.8,
      applied: true,
    });

    expect(learningEngine.getEvents()).toHaveLength(1);
  });

  it('should use decision engine for mission prioritization', () => {
    const context = createDecisionContext({
      title: 'Mission Priority',
      type: 'process',
      options: [
        {
          id: 'high',
          title: 'High Priority',
          pros: ['urgent'],
          cons: ['resource-heavy'],
          risk: 'medium',
        },
        { id: 'low', title: 'Low Priority', pros: ['cheap'], cons: ['delayed'], risk: 'low' },
      ],
    });

    const votes: DecisionVote[] = [
      { participantId: 'p1', optionId: 'high', confidence: 0.9 },
      { participantId: 'p2', optionId: 'high', confidence: 0.8 },
      { participantId: 'p3', optionId: 'high', confidence: 0.85 },
    ];

    const result = decisionEngine.vote(context, votes);
    expect(result.winningOption).toBe('high');

    if (result.winningOption === 'high') {
      const govDecision = govEngine.evaluate(createContext({ impact: 'high' }));
      expect(govDecision.escalationRequired).toBe(true);
    }
  });

  it('should decompose mission and track sub-mission progress', () => {
    const plan = missionEngine.decompose(
      { id: 'lc-5', title: 'Complex Feature', type: 'feature', priority: 'high', status: 'queued' },
      [
        { id: 'sub-a', title: 'Design', type: 'feature', priority: 'high', status: 'queued' },
        { id: 'sub-b', title: 'Implement', type: 'feature', priority: 'high', status: 'queued' },
        { id: 'sub-c', title: 'Test', type: 'feature', priority: 'high', status: 'queued' },
      ],
    );

    expect(plan.subMissions).toHaveLength(3);

    const subA = plan.subMissions[0];
    missionEngine.updateProgress(subA.id, { status: 'executing', progress: 50 });
    missionEngine.updateProgress(subA.id, { status: 'completed', progress: 100 });

    const subB = plan.subMissions[1];
    missionEngine.updateProgress(subB.id, { status: 'executing', progress: 60 });

    const progressA = missionEngine.getProgress(subA.id);
    const progressB = missionEngine.getProgress(subB.id);

    expect(progressA?.status).toBe('completed');
    expect(progressB?.status).toBe('executing');
  });

  it('should handle mission failure and recovery learning', () => {
    missionEngine.decompose(
      {
        id: 'lc-6',
        title: 'Failing Mission',
        type: 'bugfix',
        priority: 'critical',
        status: 'queued',
      },
      [],
    );

    missionEngine.updateProgress('lc-6', { status: 'executing', progress: 20 });
    missionEngine.updateProgress('lc-6', { status: 'failed', blockers: ['Dependency conflict'] });

    learningEngine.record({
      type: 'correction',
      source: 'mission-controller',
      data: { content: 'Mission failed due to dependency conflict', impact: 'critical' },
      confidence: 0.9,
      applied: false,
    });

    const progress = missionEngine.getProgress('lc-6');
    expect(progress?.status).toBe('failed');

    const report = learningEngine.generateReport();
    expect(report.totalEvents).toBe(1);
    expect(report.pendingCount).toBe(1);
  });

  it('should validate complete audit trail from mission start to finish', () => {
    const govDecision = govEngine.evaluate(createContext());
    expect(govDecision.allowed).toBe(true);

    const qualityReport = qualityEngine.evaluate([
      { name: 'test_coverage', value: 95 },
      { name: 'lint', value: 100 },
      { name: 'typecheck', value: 100 },
    ]);
    expect(qualityReport.passed).toBe(true);

    missionEngine.decompose(
      { id: 'lc-7', title: 'Audited Mission', type: 'feature', priority: 'high', status: 'queued' },
      [],
    );
    missionEngine.updateProgress('lc-7', { status: 'executing', progress: 50 });
    missionEngine.updateProgress('lc-7', { status: 'completed', progress: 100 });

    learningEngine.record({
      type: 'observation',
      source: 'audit',
      data: { content: 'Audit trail complete', impact: 'medium' },
      confidence: 1,
      applied: false,
    });

    const progress = missionEngine.getProgress('lc-7');
    expect(progress?.status).toBe('completed');
    expect(qualityEngine.getHistory()).toHaveLength(1);
    expect(learningEngine.getEvents()).toHaveLength(1);
  });
});
