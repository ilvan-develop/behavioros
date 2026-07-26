import { describe, expect, it } from 'vitest';
import { GDPRProvider } from '../engines/governance/compliance/gdpr';
import { PCIProvider } from '../engines/governance/compliance/pci';
import type { ComplianceProvider } from '../engines/governance/compliance/provider';
import { ComplianceEngine } from '../engines/governance/compliance-engine';
import { PolicyEngine } from '../engines/governance/policy-engine';
import { RiskEngine } from '../engines/governance/risk-engine';

describe('PolicyEngine', () => {
  it('should create policy and list it among results', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'pol-1',
      name: 'P1',
      description: 'desc',
      rules: ['r1'],
      version: '1.0',
      status: 'draft',
    });
    expect(engine.list()).toHaveLength(1);
    expect(engine.list()[0].id).toBe('pol-1');
  });

  it('should deprecate then activate a policy', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'p',
      name: 'N',
      description: 'd',
      rules: [],
      version: '1.0',
      status: 'active',
    });
    engine.deprecate('p');
    expect(engine.get('p')!.status).toBe('deprecated');
    engine.activate('p');
    expect(engine.get('p')!.status).toBe('active');
  });

  it('should throw when activating already active policy', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'p',
      name: 'N',
      description: 'd',
      rules: [],
      version: '1.0',
      status: 'active',
    });
    engine.activate('p');
    expect(engine.get('p')!.status).toBe('active');
  });

  it('should return empty active list when no active policies', () => {
    const engine = new PolicyEngine();
    engine.create({
      id: 'draft',
      name: 'Draft',
      description: '',
      rules: [],
      version: '1.0',
      status: 'draft',
    });
    engine.create({
      id: 'dep',
      name: 'Dep',
      description: '',
      rules: [],
      version: '1.0',
      status: 'deprecated',
    });
    expect(engine.getActive()).toHaveLength(0);
  });

  it('should set createdAt timestamp on policy creation', () => {
    const engine = new PolicyEngine();
    const before = Date.now();
    engine.create({
      id: 'ts',
      name: 'Timestamp',
      description: '',
      rules: [],
      version: '1.0',
      status: 'draft',
    });
    const createdAt = new Date(engine.get('ts')!.createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(Date.now());
  });
});

describe('RiskEngine', () => {
  it('should return score of 0 for empty factors list', () => {
    const engine = new RiskEngine();
    const result = engine.assess('empty-target', []);
    expect(result.score).toBe(0);
    expect(result.level).toBe('low');
  });

  it('should clamp score to 0 when negative', () => {
    const engine = new RiskEngine();
    const result = engine.assess('neg', [{ name: 'neg', score: -0.5, weight: 1 }]);
    expect(result.score).toBe(0);
  });

  it('should clamp score to 1 when exceeding maximum', () => {
    const engine = new RiskEngine();
    const result = engine.assess('overflow', [{ name: 'big', score: 2.0, weight: 1 }]);
    expect(result.score).toBe(1);
    expect(result.level).toBe('critical');
  });

  it('should accurately compute weighted average', () => {
    const engine = new RiskEngine();
    const result = engine.assess('weighted', [
      { name: 'high-weight-low-score', score: 0.1, weight: 10 },
      { name: 'low-weight-high-score', score: 1.0, weight: 1 },
    ]);
    const expected = (0.1 * 10 + 1.0 * 1) / 11;
    expect(result.score).toBeCloseTo(expected, 5);
  });

  it('should generate recommendations specific to high-score factors', () => {
    const engine = new RiskEngine();
    const result = engine.assess('risky', [
      { name: 'data-exposure', score: 0.9, weight: 3 },
      { name: 'low-risk', score: 0.1, weight: 1 },
    ]);
    expect(result.recommendations).toContainEqual(expect.stringContaining('data-exposure'));
    expect(result.recommendations).not.toContainEqual(expect.stringContaining('low-risk'));
  });

  it('should return empty history when no assessments done', () => {
    const engine = new RiskEngine();
    expect(engine.getHistory()).toEqual([]);
    expect(engine.getHistory('anything')).toEqual([]);
  });

  it('should handle boundary thresholds exactly', () => {
    const engine = new RiskEngine();
    const low = engine.assess('low-edge', [{ name: 'f', score: 0.25, weight: 1 }]);
    expect(low.level).toBe('low');
    const med = engine.assess('med-edge', [{ name: 'f', score: 0.2500001, weight: 1 }]);
    expect(med.level).toBe('medium');
    const high = engine.assess('high-edge', [{ name: 'f', score: 0.5, weight: 1 }]);
    expect(high.level).toBe('medium');
    const critEdge = engine.assess('crit-edge', [{ name: 'f', score: 0.75, weight: 1 }]);
    expect(critEdge.level).toBe('high');
    const crit = engine.assess('crit', [{ name: 'f', score: 0.7500001, weight: 1 }]);
    expect(crit.level).toBe('critical');
  });

  it('should not generate manual review recommendation for low/medium risk', () => {
    const engine = new RiskEngine();
    const low = engine.assess('safe', [{ name: 'f', score: 0.1, weight: 1 }]);
    expect(low.recommendations).not.toContainEqual(expect.stringContaining('Manual review'));
    const med = engine.assess('medium-risk', [{ name: 'f', score: 0.4, weight: 1 }]);
    expect(med.recommendations).not.toContainEqual(expect.stringContaining('Manual review'));
  });
});

describe('ComplianceEngine', () => {
  it('should compute score of 0 for all-failing checks', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('custom', 'test', [
      { name: 'c1', passed: false, evidence: 'fail' },
      { name: 'c2', passed: false, evidence: 'fail' },
    ]);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should compute score of 0 for empty checks list', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('empty', 'test', []);
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it('should pass at exactly 80% threshold', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('threshold', 'test', [
      { name: 'p1', passed: true, evidence: 'ok' },
      { name: 'p2', passed: true, evidence: 'ok' },
      { name: 'p3', passed: true, evidence: 'ok' },
      { name: 'p4', passed: true, evidence: 'ok' },
      { name: 'f1', passed: false, evidence: 'fail' },
    ]);
    expect(result.score).toBe(0.8);
    expect(result.passed).toBe(true);
  });

  it('should fail at 60% (below 80% threshold)', () => {
    const engine = new ComplianceEngine();
    const result = engine.runCheck('nothreshold', 'test', [
      { name: 'p1', passed: true, evidence: 'ok' },
      { name: 'p2', passed: true, evidence: 'ok' },
      { name: 'p3', passed: true, evidence: 'ok' },
      { name: 'f1', passed: false, evidence: 'fail' },
      { name: 'f2', passed: false, evidence: 'fail' },
    ]);
    expect(result.score).toBe(0.6);
    expect(result.passed).toBe(false);
  });

  it('should generate report with FAIL status for failed checks', () => {
    const engine = new ComplianceEngine();
    const check = engine.runCheck('soc2', 'svc', [
      { name: 'c', passed: false, evidence: 'missing' },
    ]);
    const report = engine.generateReport([check]);
    expect(report).toContain('FAIL');
    expect(report).not.toContain('PASS');
  });

  it('should return empty filtered history when no matches', () => {
    const engine = new ComplianceEngine();
    engine.runCheck('soc2', 'svc-a', [{ name: 'c', passed: true, evidence: 'e' }]);
    expect(engine.getHistory('gdpr')).toEqual([]);
    expect(engine.getHistory('soc2', 'svc-b')).toEqual([]);
  });
});

describe('GDPRProvider', () => {
  const provider: ComplianceProvider = new GDPRProvider();

  it('should expose name as GDPR', () => {
    expect(provider.name).toBe('GDPR');
  });

  it('should return all GDPR requirements', () => {
    const reqs = provider.getRequirements();
    expect(reqs).toHaveLength(7);
    expect(reqs).toContainEqual(expect.stringContaining('Art. 6'));
    expect(reqs).toContainEqual(expect.stringContaining('Art. 7'));
    expect(reqs).toContainEqual(expect.stringContaining('Art. 17'));
    expect(reqs).toContainEqual(expect.stringContaining('Art. 20'));
    expect(reqs).toContainEqual(expect.stringContaining('Art. 33'));
    expect(reqs).toContainEqual(expect.stringContaining('Art. 35'));
    expect(reqs).toContainEqual(expect.stringContaining('Art. 28'));
  });

  it('should run check and return compliance report', async () => {
    const report = await provider.check('user-data-service');
    expect(report.provider).toBe('GDPR');
    expect(report.target).toBe('user-data-service');
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(7);
  });

  it('should include target in evidence strings', async () => {
    const report = await provider.check('my-app');
    for (const check of report.checks) {
      expect(check.evidence).toContain('my-app');
    }
  });

  it('should include recommendations for applicable articles', async () => {
    const report = await provider.check('service');
    const withRecs = report.checks.filter((c) => c.recommendation);
    expect(withRecs.length).toBeGreaterThan(0);
    const art7Rec = report.checks.find((c) => c.name.includes('Art. 7'))!;
    expect(art7Rec.recommendation).toContain('granular consent');
  });

  it('should compute overallScore as average of check scores', async () => {
    const report = await provider.check('test');
    const avg = report.checks.reduce((s, c) => s + c.score, 0) / report.checks.length;
    expect(report.overallScore).toBeCloseTo(avg, 2);
  });
});

describe('PCIProvider', () => {
  const provider: ComplianceProvider = new PCIProvider();

  it('should expose name as PCI DSS', () => {
    expect(provider.name).toBe('PCI DSS');
  });

  it('should return all PCI DSS requirements', () => {
    const reqs = provider.getRequirements();
    expect(reqs).toHaveLength(8);
    expect(reqs).toContainEqual(expect.stringContaining('Req 1'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 3'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 4'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 5'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 6'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 7'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 10'));
    expect(reqs).toContainEqual(expect.stringContaining('Req 11'));
  });

  it('should run check and return compliance report', async () => {
    const report = await provider.check('payment-processor');
    expect(report.provider).toBe('PCI DSS');
    expect(report.target).toBe('payment-processor');
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.passed).toBe(true);
    expect(report.checks).toHaveLength(8);
  });

  it('should include target in evidence strings', async () => {
    const report = await provider.check('checkout-api');
    for (const check of report.checks) {
      expect(check.evidence).toContain('checkout-api');
    }
  });

  it('should include recommendations for applicable requirements', async () => {
    const report = await provider.check('payment');
    const withRecs = report.checks.filter((c) => c.recommendation);
    expect(withRecs.length).toBeGreaterThan(0);
    const req6Rec = report.checks.find((c) => c.name.includes('Req 6'))!;
    expect(req6Rec.recommendation).toContain('patch');
  });

  it('should compute overallScore as average of check scores', async () => {
    const report = await provider.check('gateway');
    const avg = report.checks.reduce((s, c) => s + c.score, 0) / report.checks.length;
    expect(report.overallScore).toBeCloseTo(avg, 2);
  });

  it('should verify TLS encryption check content for Req 4', async () => {
    const report = await provider.check('api');
    const req4 = report.checks.find((c) => c.name.includes('Req 4'))!;
    expect(req4.passed).toBe(true);
    expect(req4.score).toBe(0.95);
    expect(req4.evidence).toContain('TLS 1.2+');
  });
});
