import { describe, expect, it } from 'vitest';
import { ConflictResolver } from '../engines/intelligence/conflict-resolver';
import { DecisionEvolver } from '../engines/intelligence/decision-evolver';
import { EscalationManager } from '../engines/intelligence/escalation-manager';

describe('DecisionEvolver', () => {
  const evolver = new DecisionEvolver();

  it('should pick winner by simple majority', () => {
    const result = evolver.decide(
      'What DB?',
      ['pg', 'mongo'],
      [
        { agentId: 'a', choice: 'pg', weight: 1 },
        { agentId: 'b', choice: 'pg', weight: 1 },
        { agentId: 'c', choice: 'mongo', weight: 1 },
      ],
    );
    expect(result.winner).toBe('pg');
    expect(result.score).toBe(2);
    expect(result.quorumReached).toBe(true);
    expect(result.vetoed).toBe(false);
  });

  it('should respect weighted voting', () => {
    const result = evolver.decide(
      'What stack?',
      ['react', 'vue'],
      [
        { agentId: 'senior', choice: 'vue', weight: 5 },
        { agentId: 'junior', choice: 'react', weight: 1 },
        { agentId: 'junior2', choice: 'react', weight: 1 },
      ],
    );
    expect(result.winner).toBe('vue');
    expect(result.score).toBe(5);
  });

  it('should not reach quorum when total weight is below threshold', () => {
    const result = evolver.decide(
      'Deploy now?',
      ['yes', 'no'],
      [{ agentId: 'a', choice: 'yes', weight: 0.3 }],
      0.5,
    );
    expect(result.quorumReached).toBe(false);
    expect(result.vetoed).toBe(true);
    expect(result.winner).toBe('');
  });

  it('should handle tie by returning empty winner', () => {
    const result = evolver.decide(
      'Which color?',
      ['red', 'blue'],
      [
        { agentId: 'a', choice: 'red', weight: 1 },
        { agentId: 'b', choice: 'blue', weight: 1 },
      ],
    );
    expect(result.winner).toBe('');
    expect(result.score).toBe(1);
  });

  it('should include all votes in result', () => {
    const votes = [
      { agentId: 'a', choice: 'x', weight: 1 },
      { agentId: 'b', choice: 'y', weight: 1 },
    ];
    const result = evolver.decide('Q', ['x', 'y'], votes);
    expect(result.votes).toHaveLength(2);
    expect(result.votes).toEqual(votes);
  });

  it('should include rationale when provided', () => {
    const result = evolver.decide(
      'Q',
      ['a', 'b'],
      [{ agentId: 'x', choice: 'a', weight: 1, rationale: 'Faster' }],
    );
    expect(result.votes[0].rationale).toBe('Faster');
  });

  it('should generate unique IDs for each decision', () => {
    const r1 = evolver.decide('Q', ['a'], [{ agentId: 'x', choice: 'a', weight: 1 }]);
    const r2 = evolver.decide('Q', ['a'], [{ agentId: 'x', choice: 'a', weight: 1 }]);
    expect(r1.id).not.toBe(r2.id);
  });

  it('should set decidedAt timestamp', () => {
    const result = evolver.decide('Q', ['a'], [{ agentId: 'x', choice: 'a', weight: 1 }]);
    expect(result.decidedAt).toBeDefined();
    expect(() => new Date(result.decidedAt)).not.toThrow();
  });
});

describe('ConflictResolver', () => {
  const resolver = new ConflictResolver();

  it('should resolve merge strategy by merging payloads', () => {
    const result = resolver.resolve(
      'agent-a',
      'agent-b',
      'API contract',
      'merge',
      { endpoint: '/users' },
      { method: 'GET' },
    );
    expect(result.strategy).toBe('merge');
    expect(result.resolution).toContain('Merged');
    expect(result.resolution).toContain('/users');
    expect(result.resolution).toContain('GET');
  });

  it('should resolve override strategy using agent A payload', () => {
    const result = resolver.resolve(
      'agent-a',
      'agent-b',
      'config conflict',
      'override',
      { port: 3000 },
      { port: 4000 },
    );
    expect(result.strategy).toBe('override');
    expect(result.resolution).toContain('agent-a');
    expect(result.resolution).toContain('3000');
  });

  it('should resolve human-review as pending', () => {
    const result = resolver.resolve(
      'agent-a',
      'agent-b',
      'auth flow',
      'human-review',
      { strategy: 'jwt' },
      { strategy: 'session' },
    );
    expect(result.strategy).toBe('human-review');
    expect(result.resolution).toContain('Pending human review');
  });

  it('should record resolution in history', () => {
    resolver.resolve('x', 'y', 'ctx', 'override', 'a', 'b');
    const history = resolver.getHistory();
    expect(history.length).toBeGreaterThan(0);
  });

  it('should getHistory by agent ID', () => {
    resolver.resolve('alice', 'bob', 'ctx1', 'override', 'a', 'b');
    resolver.resolve('charlie', 'dave', 'ctx2', 'merge', 'c', 'd');
    const aliceHistory = resolver.getHistory('alice');
    expect(aliceHistory.every((h) => h.agentA === 'alice' || h.agentB === 'alice')).toBe(true);
  });

  it('should getHistory return all when no agentId', () => {
    const all = resolver.getHistory();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('should set resolvedAt timestamp', () => {
    const result = resolver.resolve('a', 'b', 'ctx', 'merge', {}, {});
    expect(result.resolvedAt).toBeDefined();
    expect(() => new Date(result.resolvedAt)).not.toThrow();
  });
});

describe('EscalationManager', () => {
  const manager = new EscalationManager();

  it('should create escalation and return ID', () => {
    const id = manager.escalate('security', 'Vulnerability found in auth');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should approve a pending escalation', () => {
    const id = manager.escalate('production', 'Deploy to prod');
    manager.approve(id);
    const e = manager.get(id);
    expect(e?.status).toBe('approved');
    expect(e?.resolvedAt).toBeDefined();
  });

  it('should reject a pending escalation', () => {
    const id = manager.escalate('breaking-change', 'API v2');
    manager.reject(id);
    const e = manager.get(id);
    expect(e?.status).toBe('rejected');
  });

  it('should throw on approve non-existent', () => {
    expect(() => manager.approve('fake-id')).toThrow('not found');
  });

  it('should throw on reject non-existent', () => {
    expect(() => manager.reject('fake-id')).toThrow('not found');
  });

  it('should list all escalations', () => {
    const all = manager.list();
    expect(all.length).toBeGreaterThanOrEqual(3);
  });

  it('should list by status', () => {
    const pending = manager.list('pending');
    expect(pending.every((e) => e.status === 'pending')).toBe(true);
  });

  it('should store context and description', () => {
    const id = manager.escalate('critical-error', 'Out of memory', { memory: '92%', pod: 'api-3' });
    const e = manager.get(id)!;
    expect(e.description).toBe('Out of memory');
    expect(e.context.memory).toBe('92%');
  });

  it('should use default timeout of 300000', () => {
    const id = manager.escalate('payment', 'Payment failure');
    const e = manager.get(id)!;
    expect(e.timeout).toBe(300_000);
  });

  it('should accept custom timeout', () => {
    const id = manager.escalate('security', 'Breach', {}, 10_000);
    const e = manager.get(id)!;
    expect(e.timeout).toBe(10_000);
  });

  it('should auto-escalate timed-out escalations', async () => {
    const id = manager.escalate('security', 'Timeout test', {}, 1);
    await new Promise((r) => setTimeout(r, 10));
    manager.autoEscalate();
    const e = manager.get(id)!;
    expect(e.status).toBe('timed-out');
  });

  it('should list pending after auto-escalate', () => {
    const freshId = manager.escalate('payment', 'Fresh', {}, 300_000);
    manager.autoEscalate();
    const pending = manager.list('pending');
    expect(pending.some((e) => e.id === freshId)).toBe(true);
  });
});
