import { randomUUID } from 'node:crypto';
import type { Mission } from '@behavioros/schemas';
import { MissionSchema } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  type DecisionContext,
  DecisionEngine,
  type DecisionVote,
} from '../engines/decision/decision-engine';
import { MissionEngine } from '../engines/mission/mission-engine';

function makeContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    id: randomUUID(),
    title: 'Test Decision',
    type: 'architecture',
    participants: [
      { id: 'alice', role: 'architect', authority: 3, weight: 2 },
      { id: 'bob', role: 'developer', authority: 1, weight: 1 },
      { id: 'carol', role: 'developer', authority: 1, weight: 1 },
    ],
    options: [
      { id: 'opt-a', title: 'Option A', pros: ['fast'], cons: ['risky'], risk: 'low' },
      { id: 'opt-b', title: 'Option B', pros: ['safe'], cons: ['slow'], risk: 'medium' },
    ],
    ...overrides,
  };
}

function vote(participantId: string, optionId: string, confidence = 0.8): DecisionVote {
  return { participantId, optionId, confidence };
}

// ─── DecisionEngine ──────────────────────────────────────────────────

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  describe('vote() — majority', () => {
    it('should pick winner by simple majority', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, [
        vote('alice', 'opt-a'),
        vote('bob', 'opt-a'),
        vote('carol', 'opt-b'),
      ]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.strategy).toBe('majority');
      expect(result.confidence).toBeCloseTo(2 / 3);
      expect(result.consensus).toBe(false);
    });

    it('should detect unanimous as consensus', () => {
      const ctx = makeContext({
        participants: [
          { id: 'a', role: 'dev', authority: 1, weight: 1 },
          { id: 'b', role: 'dev', authority: 1, weight: 1 },
          { id: 'c', role: 'dev', authority: 1, weight: 1 },
        ],
      });
      const result = engine.vote(ctx, [vote('a', 'opt-a'), vote('b', 'opt-a'), vote('c', 'opt-a')]);
      expect(result.consensus).toBe(true);
      expect(result.confidence).toBe(1);
    });

    it('should detect no consensus when split evenly', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a'), vote('bob', 'opt-b')]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.confidence).toBeCloseTo(0.5);
      expect(result.consensus).toBe(false);
    });

    it('should handle tie by picking first max', () => {
      const ctx = makeContext({
        participants: [
          { id: 'a', role: 'dev', authority: 1, weight: 1 },
          { id: 'b', role: 'dev', authority: 1, weight: 1 },
        ],
      });
      const result = engine.vote(ctx, [vote('a', 'opt-a'), vote('b', 'opt-b')]);
      expect(result.winningOption).toBe('opt-a');
    });

    it('should list dissenting participants', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, [
        vote('alice', 'opt-a'),
        vote('bob', 'opt-b'),
        vote('carol', 'opt-b'),
      ]);
      expect(result.winningOption).toBe('opt-b');
      expect(result.dissenting).toEqual(['alice']);
    });

    it('should handle empty votes', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, []);
      expect(result.winningOption).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle single voter', () => {
      const ctx = makeContext({
        participants: [{ id: 'a', role: 'dev', authority: 1, weight: 1 }],
      });
      const result = engine.vote(ctx, [vote('a', 'opt-a')]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.confidence).toBe(1);
      expect(result.consensus).toBe(true);
    });
  });

  describe('vote() — weighted', () => {
    it('should apply participant weights', () => {
      engine = new DecisionEngine('weighted');
      const ctx = makeContext({
        participants: [
          { id: 'senior', role: 'architect', authority: 5, weight: 5 },
          { id: 'junior', role: 'developer', authority: 1, weight: 1 },
        ],
      });
      const result = engine.vote(ctx, [
        { participantId: 'senior', optionId: 'opt-b', confidence: 0.9 },
        { participantId: 'junior', optionId: 'opt-a', confidence: 1 },
      ]);
      expect(result.winningOption).toBe('opt-b');
      expect(result.strategy).toBe('weighted');
    });

    it('should handle unknown participant with default weight 1', () => {
      engine = new DecisionEngine('weighted');
      const ctx = makeContext();
      const result = engine.vote(ctx, [
        { participantId: 'unknown', optionId: 'opt-a', confidence: 1 },
        { participantId: 'alice', optionId: 'opt-a', confidence: 0.5 },
      ]);
      expect(result.winningOption).toBe('opt-a');
    });

    it('should compute confidence correctly', () => {
      engine = new DecisionEngine('weighted');
      const ctx = makeContext({
        participants: [
          { id: 'a', role: 'dev', authority: 1, weight: 2 },
          { id: 'b', role: 'dev', authority: 1, weight: 2 },
        ],
      });
      const result = engine.vote(ctx, [
        { participantId: 'a', optionId: 'opt-a', confidence: 1 },
        { participantId: 'b', optionId: 'opt-b', confidence: 1 },
      ]);
      expect(result.confidence).toBeCloseTo(0.5);
    });

    it('should handle empty weighted votes (totalScore = 0)', () => {
      engine = new DecisionEngine('weighted');
      const ctx = makeContext();
      const result = engine.vote(ctx, []);
      expect(result.winningOption).toBeNull();
      expect(result.confidence).toBe(0);
    });
  });

  describe('vote() — unanimous', () => {
    it('should pass when all vote the same', () => {
      engine = new DecisionEngine('unanimous');
      const ctx = makeContext();
      const result = engine.vote(ctx, [
        vote('alice', 'opt-a'),
        vote('bob', 'opt-a'),
        vote('carol', 'opt-a'),
      ]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.consensus).toBe(true);
      expect(result.confidence).toBe(1);
    });

    it('should fail when votes differ', () => {
      engine = new DecisionEngine('unanimous');
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a'), vote('bob', 'opt-b')]);
      expect(result.winningOption).toBeNull();
      expect(result.consensus).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.dissenting).toEqual(['bob']);
    });

    it('should handle single vote as unanimous', () => {
      engine = new DecisionEngine('unanimous');
      const ctx = makeContext({
        participants: [{ id: 'a', role: 'dev', authority: 1, weight: 1 }],
      });
      const result = engine.vote(ctx, [vote('a', 'opt-a')]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.consensus).toBe(true);
    });

    it('should return null winner for empty votes', () => {
      engine = new DecisionEngine('unanimous');
      const result = engine.vote(makeContext(), []);
      expect(result.winningOption).toBeNull();
    });
  });

  describe('vote() — quorum', () => {
    it('should pass with enough voters', () => {
      engine = new DecisionEngine('quorum', 0.5);
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a'), vote('bob', 'opt-a')]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.consensus).toBe(true);
    });

    it('should fail without quorum', () => {
      engine = new DecisionEngine('quorum', 0.9);
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      expect(result.winningOption).toBeNull();
      expect(result.consensus).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should use default quorum threshold of 0.6', () => {
      engine = new DecisionEngine('quorum');
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      expect(result.winningOption).toBeNull();
    });
  });

  describe('vote() — byzantine', () => {
    it('should pass with enough honest nodes (2/3 + 1)', () => {
      engine = new DecisionEngine('byzantine');
      const ctx = makeContext();
      const result = engine.vote(ctx, [
        vote('alice', 'opt-a'),
        vote('bob', 'opt-a'),
        vote('carol', 'opt-a'),
      ]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.consensus).toBe(true);
    });

    it('should fail without enough nodes', () => {
      engine = new DecisionEngine('byzantine');
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      expect(result.winningOption).toBeNull();
      expect(result.consensus).toBe(false);
    });

    it('should require 2/3 + 1 = 3 for 3 participants', () => {
      engine = new DecisionEngine('byzantine');
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a'), vote('bob', 'opt-a')]);
      expect(result.winningOption).toBeNull();
    });
  });

  describe('vote() — default strategy', () => {
    it('should use majority for unknown strategy', () => {
      engine = new DecisionEngine('majority' as never);
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.strategy).toBe('majority');
    });

    it('should fall back to majority for invalid strategy in switch default', () => {
      engine = new DecisionEngine('invalid' as never);
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      expect(result.winningOption).toBe('opt-a');
      expect(result.strategy).toBe('majority');
    });
  });

  describe('evaluateRisk()', () => {
    it('should return low risk when diverse roles, no high-risk options, no deadline', () => {
      const ctx = makeContext();
      const risk = engine.evaluateRisk(ctx);
      expect(risk.level).toBe('low');
      expect(risk.factors).toHaveLength(0);
      expect(risk.mitigations).toHaveLength(0);
    });

    it('should detect low participant diversity', () => {
      const ctx = makeContext({
        participants: [
          { id: 'a', role: 'developer', authority: 1, weight: 1 },
          { id: 'b', role: 'developer', authority: 1, weight: 1 },
        ],
      });
      const risk = engine.evaluateRisk(ctx);
      expect(risk.level).toBe('medium');
      expect(risk.factors).toContain('Low participant diversity');
      expect(risk.mitigations).toHaveLength(2);
    });

    it('should detect high-risk options (riskScore=2 → medium)', () => {
      const ctx = makeContext({
        participants: [
          { id: 'a', role: 'architect', authority: 3, weight: 2 },
          { id: 'b', role: 'developer', authority: 1, weight: 1 },
        ],
        options: [{ id: 'risky', title: 'Risky', pros: [], cons: [], risk: 'high' }],
      });
      const risk = engine.evaluateRisk(ctx);
      expect(risk.factors).toContain('1 high-risk option(s)');
      expect(risk.level).toBe('medium');
    });

    it('should detect tight deadline (< 2 days)', () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const ctx = makeContext({ deadline: future.toISOString() });
      const risk = engine.evaluateRisk(ctx);
      expect(risk.factors).toContain('Tight deadline');
      expect(risk.level).toBe('medium');
    });

    it('should ignore relaxed deadline (>= 2 days)', () => {
      const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const ctx = makeContext({ deadline: future.toISOString() });
      const risk = engine.evaluateRisk(ctx);
      expect(risk.factors).not.toContain('Tight deadline');
    });

    it('should accumulate multiple risk factors to high (score >= 3)', () => {
      const ctx = makeContext({
        participants: [{ id: 'a', role: 'developer', authority: 1, weight: 1 }],
        options: [
          { id: 'risky', title: 'Risky', pros: [], cons: [], risk: 'high' },
          { id: 'risky2', title: 'Risky2', pros: [], cons: [], risk: 'high' },
        ],
        deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
      const risk = engine.evaluateRisk(ctx);
      expect(risk.level).toBe('high');
      expect(risk.factors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('summary()', () => {
    it('should produce a formatted summary with winner', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      const s = engine.summary(result);
      expect(s).toContain('Decision:');
      expect(s).toContain('opt-a');
      expect(s).toContain('majority');
      expect(s).toContain('100.0%');
    });

    it('should include dissenting when present', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a'), vote('bob', 'opt-b')]);
      const s = engine.summary(result);
      expect(s).toContain('Dissenting: bob');
    });

    it('should handle null winner', () => {
      const result = engine.vote(makeContext(), []);
      const s = engine.summary(result);
      expect(s).toContain('Decision:');
    });

    it('should show consensus emoji', () => {
      const ctx = makeContext();
      const result = engine.vote(ctx, [vote('alice', 'opt-a')]);
      const s = engine.summary(result);
      expect(s).toContain('✅');

      const result2 = engine.vote(ctx, [vote('alice', 'opt-a'), vote('bob', 'opt-b')]);
      const s2 = engine.summary(result2);
      expect(s2).toContain('❌');
    });
  });
});

// ─── MissionEngine ───────────────────────────────────────────────────

const _VALID_MISSION_TYPES = ['feature', 'bugfix', 'refactor', 'incident'] as const;

describe('MissionEngine', () => {
  let engine: MissionEngine;

  beforeEach(() => {
    engine = new MissionEngine();
  });

  function makeMission(overrides: Partial<Mission> = {}): Mission {
    return MissionSchema.parse({
      id: randomUUID(),
      title: 'Test Mission',
      description: 'A test mission',
      type: 'feature',
      priority: 'medium',
      status: 'draft',
      ...overrides,
    });
  }

  describe('decompose()', () => {
    it('should decompose a mission into sub-missions', () => {
      const mission = makeMission();
      const plan = engine.decompose(mission, [{ title: 'Sub-task 1' }, { title: 'Sub-task 2' }]);
      expect(plan.subMissions).toHaveLength(2);
      expect(plan.rootMission).toBe(mission.id);
      expect(plan.subMissions[0].title).toBe('Sub-task 1');
      expect(plan.subMissions[1].title).toBe('Sub-task 2');
    });

    it('should inherit type and priority from parent mission', () => {
      const mission = makeMission({ type: 'refactor', priority: 'high' });
      const plan = engine.decompose(mission, [{ title: 'Sub' }]);
      expect(plan.subMissions[0].type).toBe('refactor');
      expect(plan.subMissions[0].priority).toBe('high');
    });

    it('should set queued status on sub-missions', () => {
      const mission = makeMission();
      const plan = engine.decompose(mission, [{ title: 'Sub' }]);
      expect(plan.subMissions[0].status).toBe('queued');
    });

    it('should store missions in internal map', () => {
      const mission = makeMission();
      engine.decompose(mission, [{ title: 'Sub' }]);
      const all = engine.getAllMissions();
      expect(all).toHaveLength(1);
    });

    it('should generate default title when sub-mission has no title', () => {
      const mission = makeMission({ title: 'Parent Mission' });
      const plan = engine.decompose(mission, [{ description: 'No title' }]);
      expect(plan.subMissions[0].title).toBe('Sub-task of Parent Mission');
    });

    it('should link sub-mission context to parent', () => {
      const mission = makeMission({ context: { project: 'foo' } });
      const plan = engine.decompose(mission, [{ title: 'Sub' }]);
      expect(plan.subMissions[0].context).toEqual({
        project: 'foo',
        parentMission: mission.id,
      });
    });
  });

  describe('updateProgress()', () => {
    it('should create progress entry for new mission', () => {
      const progress = engine.updateProgress(randomUUID(), { progress: 50 });
      expect(progress.progress).toBe(50);
      expect(progress.status).toBe('queued');
      expect(progress.lastUpdated).toBeDefined();
    });

    it('should update existing progress', () => {
      const id = randomUUID();
      engine.updateProgress(id, { progress: 10 });
      const updated = engine.updateProgress(id, { progress: 75 });
      expect(updated.progress).toBe(75);
    });

    it('should reject invalid state transitions', () => {
      const id = randomUUID();
      expect(() => engine.updateProgress(id, { status: 'completed' })).toThrow(
        'Invalid mission transition: queued → completed',
      );
    });

    it('should allow valid transition queued → planning', () => {
      const id = randomUUID();
      const updated = engine.updateProgress(id, { status: 'planning' });
      expect(updated.status).toBe('planning');
    });

    it('should allow valid transition queued → executing → completed', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'executing' });
      const updated = engine.updateProgress(id, { status: 'completed' });
      expect(updated.status).toBe('completed');
    });

    it('should allow valid transition queued → executing → failed', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'executing' });
      const updated = engine.updateProgress(id, { status: 'failed' });
      expect(updated.status).toBe('failed');
    });

    it('should allow retry from failed → queued', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'executing' });
      engine.updateProgress(id, { status: 'failed' });
      const retry = engine.updateProgress(id, { status: 'queued' });
      expect(retry.status).toBe('queued');
    });

    it('should allow queued → executing → blocked → executing', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'executing' });
      engine.updateProgress(id, { status: 'blocked' });
      const unblocked = engine.updateProgress(id, { status: 'executing' });
      expect(unblocked.status).toBe('executing');
    });

    it('should allow queued → executing → review → completed', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'executing' });
      engine.updateProgress(id, { status: 'review' });
      const done = engine.updateProgress(id, { status: 'completed' });
      expect(done.status).toBe('completed');
    });

    it('should reject completed → anything', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'executing' });
      engine.updateProgress(id, { status: 'completed' });
      expect(() => engine.updateProgress(id, { status: 'executing' })).toThrow(
        'Invalid mission transition: completed → executing. Valid transitions: ',
      );
    });

    it('should reject cancelled → anything', () => {
      const id = randomUUID();
      engine.updateProgress(id, { status: 'cancelled' });
      expect(() => engine.updateProgress(id, { status: 'draft' })).toThrow(
        'Invalid mission transition: cancelled → draft',
      );
    });
  });

  describe('getProgress()', () => {
    it('should return progress for existing mission', () => {
      const id = randomUUID();
      engine.updateProgress(id, { progress: 42, status: 'executing' });
      const p = engine.getProgress(id);
      expect(p).toBeDefined();
      expect(p!.progress).toBe(42);
      expect(p!.status).toBe('executing');
    });

    it('should return undefined for unknown mission', () => {
      const p = engine.getProgress(randomUUID());
      expect(p).toBeUndefined();
    });
  });

  describe('getPlan()', () => {
    it('should return plan by id', () => {
      const mission = makeMission();
      const plan = engine.decompose(mission, [{ title: 'Sub' }]);
      const retrieved = engine.getPlan(plan.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(plan.id);
    });

    it('should return undefined for unknown plan', () => {
      const p = engine.getPlan('nonexistent');
      expect(p).toBeUndefined();
    });
  });

  describe('getAllMissions()', () => {
    it('should return empty array initially', () => {
      expect(engine.getAllMissions()).toHaveLength(0);
    });

    it('should return all decomposed missions', () => {
      const m1 = makeMission();
      const m2 = makeMission();
      engine.decompose(m1, [{ title: 'A' }, { title: 'B' }]);
      engine.decompose(m2, [{ title: 'C' }]);
      expect(engine.getAllMissions()).toHaveLength(3);
    });
  });

  describe('summary()', () => {
    it('should show zero missions and plans initially', () => {
      const s = engine.summary();
      expect(s).toContain('Missions: 0');
      expect(s).toContain('Plans: 0');
    });

    it('should list missions by status', () => {
      const m = makeMission();
      engine.decompose(m, [{ title: 'Sub' }]);
      const s = engine.summary();
      expect(s).toContain('Missions: 1');
      expect(s).toContain('queued: 1');
    });

    it('should show multiple plans count', () => {
      const m1 = makeMission();
      const m2 = makeMission();
      engine.decompose(m1, [{ title: 'A' }]);
      engine.decompose(m2, [{ title: 'B' }]);
      const s = engine.summary();
      expect(s).toContain('Plans: 2');
    });
  });
});
