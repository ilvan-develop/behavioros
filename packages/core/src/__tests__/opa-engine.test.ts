import { describe, expect, it } from 'vitest';
import { OpaEngine, type OpaPolicy } from '../engines/governance/opa-engine';

function makePolicy(overrides?: Partial<OpaPolicy>): OpaPolicy {
  return {
    id: 'policy-1',
    name: 'Test Policy',
    rules: [],
    defaultEffect: 'deny',
    ...overrides,
  };
}

describe('OpaEngine', () => {
  it('should load a policy and evaluate allow', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [{ name: 'admin-access', condition: "input.role == 'admin'", effect: 'allow' }],
      }),
    );

    const result = engine.evaluate('policy-1', { role: 'admin' });

    expect(result.allowed).toBe(true);
    expect(result.matchedRule).toBe('admin-access');
    expect(result.policyId).toBe('policy-1');
  });

  it('should evaluate deny', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [{ name: 'block-guest', condition: "input.role == 'guest'", effect: 'deny' }],
      }),
    );

    const result = engine.evaluate('policy-1', { role: 'guest' });

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe('block-guest');
  });

  it('should return default effect when no rule matches', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        defaultEffect: 'deny',
        rules: [{ name: 'admin-only', condition: "input.role == 'admin'", effect: 'allow' }],
      }),
    );

    const result = engine.evaluate('policy-1', { role: 'user' });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('default effect');
    expect(result.matchedRule).toBeUndefined();
  });

  it('should match the correct rule name', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [
          { name: 'view-allow', condition: "input.action == 'view'", effect: 'allow' },
          { name: 'edit-deny', condition: "input.action == 'edit'", effect: 'deny' },
        ],
      }),
    );

    const result = engine.evaluate('policy-1', { action: 'edit' });

    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe('edit-deny');
  });

  it('should list all loaded policies', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(makePolicy({ id: 'pol-1', name: 'Policy One' }));
    engine.loadPolicy(makePolicy({ id: 'pol-2', name: 'Policy Two' }));

    const policies = engine.listPolicies();

    expect(policies).toHaveLength(2);
    expect(policies.map((p) => p.id)).toEqual(['pol-1', 'pol-2']);
  });

  it('should remove a policy', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(makePolicy({ id: 'pol-1' }));
    engine.loadPolicy(makePolicy({ id: 'pol-2' }));

    engine.removePolicy('pol-1');

    expect(engine.listPolicies()).toHaveLength(1);
    expect(engine.listPolicies()[0].id).toBe('pol-2');
  });

  it('should evaluate all policies via evaluateAll', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        id: 'pol-1',
        rules: [{ name: 'admin', condition: "input.role == 'admin'", effect: 'allow' }],
      }),
    );
    engine.loadPolicy(
      makePolicy({
        id: 'pol-2',
        rules: [{ name: 'guest', condition: "input.role == 'guest'", effect: 'deny' }],
      }),
    );

    const results = engine.evaluateAll({ role: 'admin' });

    expect(results).toHaveLength(2);
    const pol1 = results.find((r) => r.policyId === 'pol-1');
    const pol2 = results.find((r) => r.policyId === 'pol-2');
    expect(pol1?.allowed).toBe(true);
    expect(pol2?.allowed).toBe(false);
  });

  it('should handle comparisons: >, <, >=, <=', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [{ name: 'high-tier', condition: 'input.level > 5', effect: 'allow' }],
      }),
    );

    expect(engine.evaluate('policy-1', { level: 10 }).allowed).toBe(true);
    expect(engine.evaluate('policy-1', { level: 3 }).allowed).toBe(false);

    const engine2 = new OpaEngine();
    engine2.loadPolicy(
      makePolicy({
        id: 'pol-2',
        rules: [{ name: 'threshold', condition: 'input.score >= 80', effect: 'allow' }],
        defaultEffect: 'deny',
      }),
    );

    expect(engine2.evaluate('pol-2', { score: 80 }).allowed).toBe(true);
    expect(engine2.evaluate('pol-2', { score: 79 }).allowed).toBe(false);
  });

  it('should handle .includes() on arrays', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [
          { name: 'has-payment', condition: "input.roles.includes('payment')", effect: 'allow' },
        ],
        defaultEffect: 'deny',
      }),
    );

    const result = engine.evaluate('policy-1', { roles: ['admin', 'payment', 'user'] });

    expect(result.allowed).toBe(true);
    expect(result.matchedRule).toBe('has-payment');
  });

  it('should handle logical && operator', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [
          {
            name: 'admin-with-level',
            condition: "input.role == 'admin' && input.level >= 3",
            effect: 'allow',
          },
        ],
        defaultEffect: 'deny',
      }),
    );

    expect(engine.evaluate('policy-1', { role: 'admin', level: 5 }).allowed).toBe(true);
    expect(engine.evaluate('policy-1', { role: 'admin', level: 1 }).allowed).toBe(false);
    expect(engine.evaluate('policy-1', { role: 'user', level: 5 }).allowed).toBe(false);
  });

  it('should handle logical || operator', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [
          {
            name: 'moderator-or-admin',
            condition: "input.role == 'admin' || input.role == 'moderator'",
            effect: 'allow',
          },
        ],
        defaultEffect: 'deny',
      }),
    );

    expect(engine.evaluate('policy-1', { role: 'admin' }).allowed).toBe(true);
    expect(engine.evaluate('policy-1', { role: 'moderator' }).allowed).toBe(true);
    expect(engine.evaluate('policy-1', { role: 'user' }).allowed).toBe(false);
  });

  it('should handle != operator', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [{ name: 'not-banned', condition: "input.status != 'banned'", effect: 'allow' }],
        defaultEffect: 'deny',
      }),
    );

    expect(engine.evaluate('policy-1', { status: 'active' }).allowed).toBe(true);
    expect(engine.evaluate('policy-1', { status: 'banned' }).allowed).toBe(false);
  });

  it('should respect rule priority ordering', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [
          { name: 'low-priority', condition: "input.role == 'admin'", effect: 'deny', priority: 1 },
          {
            name: 'high-priority',
            condition: "input.role == 'admin'",
            effect: 'allow',
            priority: 10,
          },
        ],
      }),
    );

    const result = engine.evaluate('policy-1', { role: 'admin' });

    expect(result.allowed).toBe(true);
    expect(result.matchedRule).toBe('high-priority');
  });

  it('should handle nested field access', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [
          {
            name: 'high-level-user',
            condition: 'input.user.level > 5',
            effect: 'allow',
          },
        ],
        defaultEffect: 'deny',
      }),
    );

    expect(engine.evaluate('policy-1', { user: { level: 10 } }).allowed).toBe(true);
    expect(engine.evaluate('policy-1', { user: { level: 2 } }).allowed).toBe(false);
  });

  it('should return not-found decision for missing policy', () => {
    const engine = new OpaEngine();

    const result = engine.evaluate('nonexistent', { role: 'admin' });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Policy not found');
  });

  it('should handle warn effect', () => {
    const engine = new OpaEngine();
    engine.loadPolicy(
      makePolicy({
        rules: [{ name: 'audit-log', condition: "input.action == 'delete'", effect: 'warn' }],
        defaultEffect: 'allow',
      }),
    );

    const result = engine.evaluate('policy-1', { action: 'delete' });

    expect(result.allowed).toBe(true);
    expect(result.matchedRule).toBe('audit-log');
    expect(result.reason).toContain('Warning');
  });
});
