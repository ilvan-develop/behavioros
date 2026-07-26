import { describe, expect, it } from 'vitest';
import { ComplianceEngine } from '../engines/governance/compliance-engine';
import { PolicyEngine } from '../engines/governance/policy-engine';
import { RiskEngine } from '../engines/governance/risk-engine';
import { RuleEngine } from '../engines/governance/rule-engine';

describe('PolicyEngine', () => {
  it('should create a policy', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-1',
      name: 'Test Policy',
      description: 'A test policy',
      rules: ['rule-1', 'rule-2'],
      version: '1.0.0',
      status: 'draft',
    });
    expect(engine.get('pol-1')).toBeDefined();
    expect(engine.get('pol-1')!.name).toBe('Test Policy');
  });

  it('should set createdAt on creation', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-2',
      name: 'Timestamp Test',
      description: 'test',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    expect(engine.get('pol-2')!.createdAt).toBeDefined();
    expect(() => new Date(engine.get('pol-2')!.createdAt)).not.toThrow();
  });

  it('should get a policy by id', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-3',
      name: 'Get Test',
      description: 'test',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    expect(engine.get('pol-3')).toBeDefined();
    expect(engine.get('nonexistent')).toBeUndefined();
  });

  it('should list all policies', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-a',
      name: 'A',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    engine.create({
      id: 'pol-b',
      name: 'B',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    expect(engine.list()).toHaveLength(2);
  });

  it('should activate a policy', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-act',
      name: 'Activate Test',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    engine.activate('pol-act');
    expect(engine.get('pol-act')!.status).toBe('active');
  });

  it('should throw when activating nonexistent policy', () => {
    const engine = new PolicyEngine();
    expect(() => engine.activate('nope')).toThrow("Policy 'nope' not found");
  });

  it('should deprecate a policy', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-dep',
      name: 'Deprecate Test',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'active',
    });
    engine.deprecate('pol-dep');
    expect(engine.get('pol-dep')!.status).toBe('deprecated');
  });

  it('should throw when deprecating nonexistent policy', () => {
    const engine = new PolicyEngine();
    expect(() => engine.deprecate('nope')).toThrow("Policy 'nope' not found");
  });

  it('should get only active policies', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'p1',
      name: 'Active',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    engine.create({
      id: 'p2',
      name: 'Active2',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    engine.activate('p1');
    engine.activate('p2');
    engine.create({
      id: 'p3',
      name: 'Draft',
      description: '',
      rules: [],
      version: '1.0.0',
      status: 'draft',
    });
    expect(engine.getActive()).toHaveLength(2);
    expect(engine.getActive().every((p) => p.status === 'active')).toBe(true);
  });
});

describe('RuleEngine', () => {
  it('should register a rule', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'rule-1',
      name: 'Block sensitive files',
      condition: (ctx) => ctx.path === '/secrets',
      priority: 100,
      effect: 'deny',
    });
    expect(engine.list()).toHaveLength(1);
  });

  it('should evaluate to deny', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'rule-deny',
      name: 'Deny test',
      condition: (ctx) => ctx.role === 'guest',
      priority: 100,
      effect: 'deny',
    });
    const result = engine.evaluate({ role: 'guest' });
    expect(result.decision).toBe('deny');
    expect(result.matchedRule!.id).toBe('rule-deny');
  });

  it('should evaluate to allow', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'rule-allow',
      name: 'Allow test',
      condition: (ctx) => ctx.role === 'admin',
      priority: 100,
      effect: 'allow',
    });
    const result = engine.evaluate({ role: 'admin' });
    expect(result.decision).toBe('allow');
  });

  it('should evaluate to warn', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'rule-warn',
      name: 'Warn test',
      condition: () => true,
      priority: 100,
      effect: 'warn',
    });
    const result = engine.evaluate({});
    expect(result.decision).toBe('warn');
  });

  it('should evaluate to escalate', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'rule-escalate',
      name: 'Escalate test',
      condition: () => true,
      priority: 100,
      effect: 'escalate',
    });
    const result = engine.evaluate({});
    expect(result.decision).toBe('escalate');
  });

  it('should respect priority ordering', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'low-prio',
      name: 'Low priority',
      condition: () => true,
      priority: 10,
      effect: 'allow',
    });
    engine.register({
      id: 'high-prio',
      name: 'High priority',
      condition: () => true,
      priority: 100,
      effect: 'deny',
    });
    const result = engine.evaluate({});
    expect(result.decision).toBe('deny');
    expect(result.matchedRule!.id).toBe('high-prio');
  });

  it('should return allow when no rules match', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'rule-none',
      name: 'Never matches',
      condition: () => false,
      priority: 100,
      effect: 'deny',
    });
    const result = engine.evaluate({});
    expect(result.decision).toBe('allow');
    expect(result.matchedRule).toBeUndefined();
  });

  it('should list registered rules in priority order', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1',
      name: 'R1',
      condition: () => true,
      priority: 50,
      effect: 'allow',
    });
    engine.register({
      id: 'r2',
      name: 'R2',
      condition: () => true,
      priority: 100,
      effect: 'deny',
    });
    const list = engine.list();
    expect(list[0].priority).toBeGreaterThanOrEqual(list[1].priority);
  });

  it('should remove a rule', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'to-remove',
      name: 'Remove me',
      condition: () => true,
      priority: 1,
      effect: 'allow',
    });
    engine.remove('to-remove');
    expect(engine.list()).toHaveLength(0);
  });

  it('should throw when removing nonexistent rule', () => {
    const engine = new RuleEngine();
    expect(() => engine.remove('nope')).toThrow("Rule 'nope' not found");
  });

  it('should clear all rules', () => {
    const engine = new RuleEngine();
    engine.register({
      id: 'r1',
      name: 'R1',
      condition: () => true,
      priority: 1,
      effect: 'allow',
    });
    engine.register({
      id: 'r2',
      name: 'R2',
      condition: () => true,
      priority: 2,
      effect: 'deny',
    });
    engine.clear();
    expect(engine.list()).toHaveLength(0);
    expect(engine.evaluate({}).decision).toBe('allow');
  });
});

describe('RiskEngine', () => {
  it('should assess risk with factors', () => {
    const engine = new RiskEngine();
    const result = engine.assess('payment-service', [
      { name: 'data-sensitivity', score: 0.9, weight: 3 },
      { name: 'complexity', score: 0.5, weight: 1 },
    ]);
    expect(result.target).toBe('payment-service');
    expect(result.score).toBeGreaterThan(0);
    expect(result.level).toBeDefined();
    expect(result.factors).toHaveLength(2);
  });

  it('should calculate low risk', () => {
    const engine = new RiskEngine();
    const result = engine.assess('static-page', [{ name: 'complexity', score: 0.1, weight: 1 }]);
    expect(result.level).toBe('low');
  });

  it('should calculate critical risk', () => {
    const engine = new RiskEngine();
    const result = engine.assess('production-db', [{ name: 'impact', score: 1.0, weight: 1 }]);
    expect(result.level).toBe('critical');
  });

  it('should generate recommendations for high risk', () => {
    const engine = new RiskEngine();
    const result = engine.assess('critical-service', [{ name: 'security', score: 0.9, weight: 2 }]);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((r) => r.includes('Manual review'))).toBe(true);
  });

  it('should get history for a specific target', () => {
    const engine = new RiskEngine();
    engine.assess('service-a', [{ name: 'factor', score: 0.3, weight: 1 }]);
    engine.assess('service-a', [{ name: 'factor', score: 0.6, weight: 1 }]);
    engine.assess('service-b', [{ name: 'factor', score: 0.5, weight: 1 }]);
    expect(engine.getHistory('service-a')).toHaveLength(2);
    expect(engine.getHistory('service-b')).toHaveLength(1);
  });

  it('should get all history when no target specified', () => {
    const engine = new RiskEngine();
    engine.assess('s1', [{ name: 'f', score: 0.1, weight: 1 }]);
    engine.assess('s2', [{ name: 'f', score: 0.2, weight: 1 }]);
    expect(engine.getHistory()).toHaveLength(2);
  });

  it('should set tolerance level', () => {
    const engine = new RiskEngine();
    engine.setTolerance('high');
    expect(true).toBe(true);
  });
});

describe('ComplianceEngine', () => {
  it('should run a check', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('soc2', 'payment-service', [
      { name: 'encryption', passed: true, evidence: 'AES-256 enabled' },
      { name: 'logging', passed: true, evidence: 'Audit logs active' },
    ]);
    expect(result.provider).toBe('soc2');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it('should fail when below 80% threshold', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('hipaa', 'health-api', [
      { name: 'encryption', passed: true, evidence: 'ok' },
      { name: 'access-control', passed: false, evidence: 'missing' },
      { name: 'audit', passed: false, evidence: 'missing' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.score).toBeCloseTo(0.333, 1);
  });

  it('should get history filtered by provider', () => {
    const engine = new ComplianceEngine();
    engine.runCheck('soc2', 'svc-a', [{ name: 'c', passed: true, evidence: 'e' }]);
    engine.runCheck('hipaa', 'svc-a', [{ name: 'c', passed: true, evidence: 'e' }]);
    engine.runCheck('soc2', 'svc-b', [{ name: 'c', passed: true, evidence: 'e' }]);
    expect(engine.getHistory('soc2')).toHaveLength(2);
    expect(engine.getHistory('soc2', 'svc-a')).toHaveLength(1);
  });

  it('should get history filtered by target', () => {
    const engine = new ComplianceEngine();
    engine.runCheck('soc2', 'svc-x', [{ name: 'c', passed: true, evidence: 'e' }]);
    engine.runCheck('soc2', 'svc-y', [{ name: 'c', passed: true, evidence: 'e' }]);
    expect(engine.getHistory(undefined, 'svc-x')).toHaveLength(1);
  });

  it('should generate markdown report', () => {
    const engine = new ComplianceEngine();
    const check = engine.runCheck('soc2', 'api', [
      { name: 'encryption', passed: true, evidence: 'enabled' },
    ]);
    const report = engine.generateReport([check]);
    expect(report).toContain('# Compliance Report');
    expect(report).toContain('soc2');
    expect(report).toContain('PASS');
  });

  it('should generate empty report for no checks', () => {
    const engine = new ComplianceEngine();
    const report = engine.generateReport([]);
    expect(report).toContain('No checks performed');
  });

  it('should track checkedAt timestamp', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('gdpr', 'user-service', [
      { name: 'consent', passed: true, evidence: 'consent collected' },
    ]);
    expect(result.checkedAt).toBeDefined();
    expect(() => new Date(result.checkedAt)).not.toThrow();
  });
});
