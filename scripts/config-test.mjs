/**
 * Config Migration Integration Test
 *
 * Validates that:
 * 1. finpay-governance.yaml loads correctly
 * 2. finpay-squads.yaml loads correctly
 * 3. BosGovernanceEngine accepts the YAML config
 * 4. Authority matrix works (security veto = true)
 * 5. Escalation matrix resolves triggers
 * 6. Domain boundaries enforce correctly
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', 'config');
const CORE_DIR = join(__dirname, '..', 'packages', 'core');
const CORE_DIST =
  'file:///C:/Users/Ilvan/Desktop/GitHub%20Apps/behavioros/packages/core/dist/index.mjs';

// Use createRequire from core's directory to find yaml package
const require = createRequire(join(CORE_DIR, 'package.json'));
const { parse: parseYaml } = require('yaml');
const { BosGovernanceEngine } = await import(CORE_DIST);

const GOV_PATH = join(CONFIG_DIR, 'finpay-governance.yaml');
const SQUADS_PATH = join(CONFIG_DIR, 'finpay-squads.yaml');

console.log('═══════════════════════════════════════════════════════');
console.log('  FinPay Config Migration Test');
console.log('═══════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`   ✅ ${label}`);
    passed++;
  } else {
    console.log(`   ❌ FAIL: ${label}`);
    failed++;
  }
}

// ─── TEST 1: YAML files loadable ──────────────────────────
console.log('📋 TEST 1: YAML files are loadable');

let govRaw, squadsRaw;
try {
  govRaw = parseYaml(readFileSync(GOV_PATH, 'utf-8'));
  assert(true, 'finpay-governance.yaml parsed successfully');
} catch (err) {
  assert(false, `finpay-governance.yaml parse failed: ${err.message}`);
}

try {
  squadsRaw = parseYaml(readFileSync(SQUADS_PATH, 'utf-8'));
  assert(true, 'finpay-squads.yaml parsed successfully');
} catch (err) {
  assert(false, `finpay-squads.yaml parse failed: ${err.message}`);
}
console.log('');

// ─── TEST 2: Governance structure valid ───────────────────
console.log('📋 TEST 2: Governance YAML has required sections');

assert(govRaw.project === 'FinPay', 'project = FinPay');
assert(govRaw.authorityMatrix !== undefined, 'authorityMatrix exists');
assert(govRaw.domainBoundaries !== undefined, 'domainBoundaries exists');
assert(govRaw.escalationMatrix !== undefined, 'escalationMatrix exists');
assert(govRaw.conflictResolution !== undefined, 'conflictResolution exists');
assert(govRaw.compliance !== undefined, 'compliance exists');
assert(Array.isArray(govRaw.escalationMatrix), 'escalationMatrix is array');
assert(
  govRaw.escalationMatrix.length === 5,
  `escalationMatrix has 5 rules (got ${govRaw.escalationMatrix.length})`,
);
console.log('');

// ─── TEST 3: Squads structure valid ───────────────────────
console.log('📋 TEST 3: Squads YAML has all 6 squads');

const expectedSquads = ['frontend', 'backend', 'qa', 'security', 'devops', 'platform'];
for (const name of expectedSquads) {
  assert(squadsRaw.squads[name] !== undefined, `squad "${name}" exists`);
}

assert(squadsRaw.behavior_selector !== undefined, 'behavior_selector exists');
assert(
  squadsRaw.squads.backend.agents.includes('finpay-backend'),
  'backend has finpay-backend agent',
);
assert(squadsRaw.squads.frontend.dna === 'bee-colony', 'frontend dna = bee-colony');
assert(
  squadsRaw.squads.backend.performance_budgets.api_latency_p99 === '<200ms',
  'backend api_latency_p99 = <200ms',
);
console.log('');

// ─── TEST 4: BosGovernanceEngine instantiation ────────────
console.log('📋 TEST 4: BosGovernanceEngine accepts YAML config');

let engine;
try {
  engine = new BosGovernanceEngine(GOV_PATH);
  assert(true, 'Engine created from YAML path');
} catch (err) {
  assert(false, `Engine creation failed: ${err.message}`);
}

if (engine) {
  const config = engine.getConfig();
  assert(config.authorityMatrix !== undefined, 'getConfig().authorityMatrix present');
  assert(config.escalationMatrix.length === 5, 'getConfig() has 5 escalation rules');
}
console.log('');

// ─── TEST 5: Authority matrix — security veto ─────────────
console.log('📋 TEST 5: Authority matrix — security veto = true');

if (engine) {
  const result = engine.validate({
    agent: 'finpay-security',
    action: 'veto',
    target: 'apps/api/src/payment/payment.service.ts',
    agentRole: 'security',
    agentDomain: 'security',
  });
  assert(result.allowed === true, 'security agent can veto → allowed = true');

  const noVeto = engine.validate({
    agent: 'finpay-backend',
    action: 'veto',
    target: 'apps/api/src/payment/payment.service.ts',
    agentRole: 'backend',
    agentDomain: 'backend',
  });
  assert(noVeto.allowed === false, 'backend agent cannot veto → allowed = false');
}
console.log('');

// ─── TEST 6: Domain boundaries — frontend cannot touch api ─
console.log('📋 TEST 6: Domain boundaries — frontend cannot modify api');

if (engine) {
  const result = engine.validate({
    agent: 'finpay-frontend',
    action: 'modify_schema',
    target: 'apps/api/src/payment/payment.service.ts',
    agentRole: 'frontend',
    agentDomain: 'frontend',
  });
  assert(result.allowed === false, 'frontend cannot modify api files → blocked');
}
console.log('');

// ─── TEST 7: Escalation matrix ────────────────────────────
console.log('📋 TEST 7: Escalation matrix — triggers resolve');

if (engine) {
  const paymentEsc = engine.getEscalation('payment_failure');
  assert(paymentEsc !== null, 'payment_failure trigger found');
  assert(paymentEsc?.severity === 'critical', 'payment_failure severity = critical');
  assert(
    paymentEsc?.action === 'immediate_surgical_team',
    'payment_failure action = immediate_surgical_team',
  );

  const secEsc = engine.getEscalation('security_vulnerability');
  assert(secEsc !== null, 'security_vulnerability trigger found');
  assert(secEsc?.severity === 'critical', 'security_vulnerability severity = critical');

  const perfEsc = engine.getEscalation('performance_regression');
  assert(perfEsc?.timeout === '5min', 'performance_regression timeout = 5min');
}
console.log('');

// ─── TEST 8: Conflict resolution ──────────────────────────
console.log('📋 TEST 8: Conflict resolution protocols');

if (engine) {
  const secVsFeat = engine.getConflictResolution('security_vs_feature');
  assert(secVsFeat !== null, 'security_vs_feature protocol exists');
  assert(
    secVsFeat?.protocol.length === 4,
    `security_vs_feature has 4 steps (got ${secVsFeat?.protocol.length})`,
  );
  assert(secVsFeat?.escalation === 'cto', 'security_vs_feature escalation = cto');

  const schemaVsContract = engine.getConflictResolution('schema_vs_contract');
  assert(schemaVsContract !== null, 'schema_vs_contract protocol exists');
  assert(schemaVsContract?.timeout === '15min', 'schema_vs_contract timeout = 15min');
}
console.log('');

// ─── TEST 9: Compliance ───────────────────────────────────
console.log('📋 TEST 9: Compliance frameworks');

if (engine) {
  const ctx = engine.getContext('security');
  assert(ctx.compliance.requiredFrameworks.length === 3, '3 compliance frameworks');
  assert(
    ctx.compliance.requiredFrameworks.some((f) => f.name === 'PCI-DSS'),
    'PCI-DSS present',
  );
  assert(
    ctx.compliance.auditTrail.length >= 5,
    `auditTrail has >=5 entries (got ${ctx.compliance.auditTrail.length})`,
  );
}
console.log('');

// ─── TEST 10: CTO can deploy ──────────────────────────────
console.log('📋 TEST 10: CTO can deploy, others cannot');

if (engine) {
  const ctoDeploy = engine.validate({
    agent: 'cto',
    action: 'deploy',
    target: 'apps/api/src/main.ts',
    agentRole: 'cto',
    agentDomain: 'all',
  });
  assert(ctoDeploy.allowed === true, 'CTO can deploy → allowed = true');

  const backendDeploy = engine.validate({
    agent: 'finpay-backend',
    action: 'deploy',
    target: 'apps/api/src/main.ts',
    agentRole: 'backend',
    agentDomain: 'backend',
  });
  assert(backendDeploy.allowed === false, 'backend cannot deploy → blocked');
  assert(
    backendDeploy.requiresApproval === 'tech_lead',
    'backend deploy requires tech_lead approval',
  );
}
console.log('');

// ─── SUMMARY ──────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════');
if (failed === 0) {
  console.log(`  ✅ ALL TESTS PASSED (${passed}/${passed})`);
} else {
  console.log(`  ❌ ${failed} FAILED, ${passed} PASSED (${passed}/${passed + failed})`);
}
console.log('═══════════════════════════════════════════════════════');

process.exit(failed > 0 ? 1 : 0);
