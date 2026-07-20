import { test, expect } from '@playwright/test';
import { BehaviorOS } from '@behavioros/sdk';
import { GovernanceEngine } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';

test.describe('Governance Engine', () => {
  test('allows an action that passes governance rules', async () => {
    const dna: DNAPackage = {
      id: 'permissive-dna',
      name: 'Permissive DNA',
      version: '1.0.0',
      personas: [{ role: 'engineer', authority: 'senior', name: 'Engineer' }],
      governance: [
        {
          id: 'block-deploy',
          name: 'Block Deploy',
          level: 'high',
          action: 'block',
          conditions: ['type:deployment'],
        },
      ],
      quality: [],
    };

    const bos = new BehaviorOS({ dnaPackage: dna });
    const result = await bos.evaluateGovernance('read-code', {
      type: 'file',
      impact: 'low',
      agentId: 'engineer-1',
      agentRole: 'engineer',
      agentAuthority: 'senior',
    });

    expect(result.approved).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test('blocks an action that violates governance rules', async () => {
    const dna: DNAPackage = {
      id: 'strict-dna',
      name: 'Strict DNA',
      version: '1.0.0',
      personas: [{ role: 'engineer', authority: 'senior', name: 'Engineer' }],
      governance: [
        {
          id: 'block-deploy-prod',
          name: 'Block Production Deploy',
          level: 'critical',
          action: 'block',
          conditions: ['type:deployment', 'impact:critical'],
        },
      ],
      quality: [],
    };

    const bos = new BehaviorOS({ dnaPackage: dna });
    const result = await bos.evaluateGovernance('deploy-production', {
      type: 'deployment',
      impact: 'critical',
      agentId: 'engineer-1',
      agentRole: 'engineer',
      agentAuthority: 'senior',
    });

    expect(result.approved).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].id).toBe('block-deploy-prod');
  });

  test('escalates an action that requires higher authority', async () => {
    const rules = [
      {
        id: 'escalate-payment',
        name: 'Payment Changes',
        level: 'high' as const,
        action: 'escalate' as const,
        conditions: ['type:payment', 'impact:high'],
      },
    ];

    const engine = new GovernanceEngine(rules);
    const decision = engine.evaluate({
      agentId: 'senior-dev',
      agentRole: 'engineer',
      agentAuthority: 'architect',
      action: 'modify-payment-flow',
      targetType: 'service',
      impact: 'high',
      targetFiles: ['src/payments/process.ts'],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.escalationRequired).toBe(true);
    expect(decision.reason).toContain('Payment Changes');
  });
});
