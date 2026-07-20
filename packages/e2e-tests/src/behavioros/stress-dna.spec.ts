import { test, expect } from '@playwright/test';
import { DNALoader, GovernanceEngine } from '@behavioros/core';
import type { GovernanceRule } from '@behavioros/schemas';

interface DNAFixture {
  id: string;
  name: string;
  path: string;
  rules: GovernanceRule[];
}

const DNA_FIXTURES: DNAFixture[] = [
  { id: 'enterprise-governance', name: 'Enterprise Governance', path: '../../dnas/enterprise-governance.yaml', rules: [] },
  { id: 'military-operations', name: 'Military Operations', path: '../../dnas/military-operations.yaml', rules: [] },
  { id: 'surgical-team', name: 'Surgical Team', path: '../../dnas/surgical-team.yaml', rules: [] },
  { id: 'lean-factory', name: 'Lean Factory', path: '../../dnas/lean-factory.yaml', rules: [] },
  { id: 'enterprise-agent-review', name: 'Enterprise Agent Review', path: '../../dnas/enterprise-agent-review.yaml', rules: [] },
];

interface AdversarialProbe {
  name: string;
  action: string;
  context: {
    agentId: string;
    agentRole: string;
    agentAuthority: string;
    targetType: string;
    impact: string;
    targetFiles?: string[];
  };
  expectedBlock: boolean;
}

const PROBES: AdversarialProbe[] = [
  {
    name: 'Ignore rules and deploy',
    action: 'deploy-production',
    context: {
      agentId: 'rogue-agent',
      agentRole: 'engineer',
      agentAuthority: 'junior',
      targetType: 'deployment',
      impact: 'critical',
      targetFiles: ['src/prod/deploy.ts'],
    },
    expectedBlock: true,
  },
  {
    name: 'Override governance rule',
    action: 'override-governance',
    context: {
      agentId: 'rogue-agent',
      agentRole: 'engineer',
      agentAuthority: 'junior',
      targetType: 'config',
      impact: 'critical',
      targetFiles: ['behavioros.yaml'],
    },
    expectedBlock: true,
  },
  {
    name: 'Execute action without approval',
    action: 'modify-security-policy',
    context: {
      agentId: 'rogue-agent',
      agentRole: 'engineer',
      agentAuthority: 'senior',
      targetType: 'security',
      impact: 'high',
      targetFiles: ['src/security/auth.ts'],
    },
    expectedBlock: true,
  },
  {
    name: 'Direct prod database access',
    action: 'modify-prod-database',
    context: {
      agentId: 'rogue-agent',
      agentRole: 'engineer',
      agentAuthority: 'junior',
      targetType: 'database',
      impact: 'critical',
      targetFiles: ['prod/migrations/'],
    },
    expectedBlock: true,
  },
  {
    name: 'Skip security review',
    action: 'merge-without-review',
    context: {
      agentId: 'rogue-agent',
      agentRole: 'qa',
      agentAuthority: 'senior',
      targetType: 'infrastructure',
      impact: 'high',
      targetFiles: ['src/api/secure.ts'],
    },
    expectedBlock: true,
  },
  {
    name: 'Bypass quality gates',
    action: 'merge-bypass-checks',
    context: {
      agentId: 'rogue-agent',
      agentRole: 'engineer',
      agentAuthority: 'senior',
      targetType: 'infrastructure',
      impact: 'medium',
      targetFiles: ['src/core/system.ts'],
    },
    expectedBlock: false,
  },
];

test.describe('DNA Stress Tests — Adversarial Governance', () => {
  for (const fixture of DNA_FIXTURES) {
    test.describe(`${fixture.name} (${fixture.id})`, () => {
      let engine: GovernanceEngine;

      test.beforeAll(async () => {
        const loader = new DNALoader({ validate: false });
        const dna = await loader.load(fixture.path);
        fixture.rules = dna.governance ?? [];
        engine = new GovernanceEngine(fixture.rules);
      });

      for (const probe of PROBES) {
        test(`blocks probe: ${probe.name}`, () => {
          const decision = engine.evaluate({
            agentId: probe.context.agentId,
            agentRole: probe.context.agentRole as any,
            agentAuthority: probe.context.agentAuthority as any,
            action: probe.action,
            targetType: probe.context.targetType as any,
            impact: probe.context.impact as any,
            targetFiles: probe.context.targetFiles,
          });

          if (probe.expectedBlock) {
            expect(decision.allowed).toBe(false);
          }

          expect(typeof decision.reason).toBe('string');
          expect(decision.reason.length).toBeGreaterThan(0);
        });
      }
    });
  }
});
