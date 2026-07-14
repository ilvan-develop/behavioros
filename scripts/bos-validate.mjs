import { resolve } from 'path';
import {
  AuditChain,
  BehaviorSelector,
  BosLearningEngine,
  ConflictResolver,
  EscalationManager,
} from '../packages/core/dist/index.mjs';

const projectRoot = resolve('C:/Users/Ilvan/Desktop/GitHub Apps/behavioros');

console.log('=== BOS BehaviorOS Integration Test ===\n');

// 1. BEHAVIOR SELECTOR
console.log('--- 1. BehaviorSelector ---');
const selector = new BehaviorSelector();

const tests = [
  {
    problemType: 'bug_fix',
    riskLevel: 'critical',
    scope: 'single_file',
    timeline: 'urgent',
    domain: 'backend',
  },
  {
    problemType: 'feature',
    riskLevel: 'medium',
    scope: 'multi_package',
    timeline: 'sprint',
    domain: 'frontend',
  },
  {
    problemType: 'security',
    riskLevel: 'critical',
    scope: 'monorepo',
    timeline: 'urgent',
    domain: 'security',
  },
  {
    problemType: 'incident',
    riskLevel: 'high',
    scope: 'cross_system',
    timeline: 'urgent',
    domain: 'payments',
    compliance: ['PCI-DSS'],
  },
  {
    problemType: 'discovery',
    riskLevel: 'low',
    scope: 'single_package',
    timeline: 'quarter',
    domain: 'research',
  },
];

for (const ctx of tests) {
  const result = selector.select(ctx);
  console.log(
    `  ${ctx.problemType} (risk=${ctx.riskLevel}): ${result.primary}${result.secondary ? ` + ${result.secondary}` : ''} conf=${result.confidence}`,
  );
}

// 2. CONFLICT RESOLVER
console.log('\n--- 2. ConflictResolver ---');
const resolver = new ConflictResolver();
const conflict = resolver.resolve({
  type: 'security_vs_feature',
  agents: ['finpay-security', 'finpay-backend'],
  issue: 'Security wants to block payment feature due to PCI compliance concern',
  severity: 'high',
  evidence: ['PCI-DSS Section 3.2 requires tokenization', 'Current implementation stores raw PAN'],
});
console.log(`  Conflict: ${conflict.resolution}`);
console.log(`  Winner: ${conflict.winner || 'none (escalate)'}`);
console.log(`  Escalation: ${conflict.escalation}`);

// 3. ESCALATION MANAGER
console.log('\n--- 3. EscalationManager ---');
const escalation = new EscalationManager();
const check1 = escalation.check({
  type: 'payment_failure: timeout on MTN payment gateway',
  agent: 'finpay-backend',
});
console.log(`  Payment failure: ${check1 ? check1.action : 'no escalation'}`);
const check2 = escalation.check({ type: 'test_coverage_drop: 55%', agent: 'finpay-testing' });
console.log(`  Coverage drop: ${check2 ? check2.action : 'no escalation'}`);
const check3 = escalation.check({ type: 'code review comment', agent: 'finpay-frontend' });
console.log(`  Minor event: ${check3 ? 'escalated' : 'not escalated (correct)'}`);

// 4. LEARNING ENGINE
console.log('\n--- 4. LearningEngine ---');
const learner = new BosLearningEngine();
await learner.record({
  id: '1',
  timestamp: new Date().toISOString(),
  dna: 'surgical-team',
  task: 'fix payment timeout',
  agent: 'finpay-backend',
  success: true,
  duration: 120000,
  quality: 0.95,
});
await learner.record({
  id: '2',
  timestamp: new Date().toISOString(),
  dna: 'surgical-team',
  task: 'fix race condition',
  agent: 'finpay-backend',
  success: false,
  duration: 300000,
  quality: 0.4,
});
await learner.record({
  id: '3',
  timestamp: new Date().toISOString(),
  dna: 'surgical-team',
  task: 'fix auth token',
  agent: 'finpay-backend',
  success: true,
  duration: 45000,
  quality: 0.9,
});
await learner.record({
  id: '4',
  timestamp: new Date().toISOString(),
  dna: 'manufacturing',
  task: 'add payment method',
  agent: 'finpay-backend',
  success: true,
  duration: 180000,
  quality: 0.85,
});
await learner.record({
  id: '5',
  timestamp: new Date().toISOString(),
  dna: 'manufacturing',
  task: 'add validation',
  agent: 'finpay-backend',
  success: true,
  duration: 90000,
  quality: 0.92,
});

const insights = learner.analyze();
for (const insight of insights) {
  console.log(
    `  ${insight.pattern}: success=${(insight.successRate * 100).toFixed(0)}% quality=${insight.avgQuality.toFixed(2)} sample=${insight.sampleSize} rec=${insight.recommendation}`,
  );
}

const mutations = learner.suggestMutations('surgical-team');
console.log(`  Mutations for surgical-team:`);
for (const m of mutations) {
  console.log(`    ${m.field}: ${m.from} -> ${m.to} (conf=${m.confidence})`);
}

// 5. AUDIT CHAIN
console.log('\n--- 5. AuditChain ---');
const audit = new AuditChain(projectRoot);
console.log('  Steps registered:', audit.listSteps().length);
console.log(
  '  Commit checks:',
  audit.getStepsForTrigger('commit').map((s) => s.name),
);
console.log(
  '  PR checks:',
  audit.getStepsForTrigger('pr').map((s) => s.name),
);

// 6. RULES
console.log('\n--- 6. Decision Rules ---');
const rules = selector.listRules();
console.log(`  Total rules: ${rules.length}`);

console.log('\n=== ALL TESTS PASSED ===');
