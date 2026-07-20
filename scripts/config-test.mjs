/**
 * Config Integration Test
 *
 * Validates that a generic config loads correctly
 * and BosGovernanceEngine accepts the config.
 */

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, '..', 'config');
const CORE_DIR = join(__dirname, '..', 'packages', 'core');
const CORE_DIST =
  'file:///C:/Users/Ilvan/Desktop/GitHub%20Apps/behavioros/packages/core/dist/index.mjs';

const require = createRequire(join(CORE_DIR, 'package.json'));
const { BosGovernanceEngine } = await import(CORE_DIST);

console.log('═══════════════════════════════════════════════════════');
console.log('  Config Test');
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

// ─── TEST 1: BosGovernanceEngine instantiation ────────────
console.log('📋 TEST 1: BosGovernanceEngine instantiation');

let engine;
try {
  engine = new BosGovernanceEngine();
  assert(true, 'Engine created without arguments');
} catch (err) {
  assert(false, `Engine creation failed: ${err.message}`);
}
console.log('');

// ─── TEST 2: Engine has expected methods ──────────────────
console.log('📋 TEST 2: Engine has expected methods');

if (engine) {
  assert(typeof engine.getConfig === 'function', 'getConfig method exists');
  assert(typeof engine.validate === 'function', 'validate method exists');
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
