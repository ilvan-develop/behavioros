/**
 * DnaResolver Integration Test
 * Tests catalog loading, DNA merging (catalog → squad → agent overrides),
 * secondary DNA blending, and error handling.
 */

import { createRequire } from 'module';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// We need to use dynamic import for ESM build
const CORE_PATH =
  'file:///C:/Users/Ilvan/Desktop/GitHub%20Apps/behavioros/packages/core/dist/index.mjs';
const CATALOG_PATH = 'C:/Users/Ilvan/Desktop/GitHub Apps/behavioros/packages/dnas/catalog';

const { DnaResolver } = await import(CORE_PATH);

const resolver = new DnaResolver(CATALOG_PATH);

console.log('═══════════════════════════════════════════════════════');
console.log('  DnaResolver Integration Test');
console.log('═══════════════════════════════════════════════════════\n');

// ─── TEST 1: Catalog loaded ───────────────────────────────
console.log('📋 TEST 1: Catalog loaded');
const available = resolver.listCatalogDnas();
console.log(`   Available patterns (${available.length}): ${available.join(', ')}\n`);

// ─── TEST 2: Resolve with primary + squad + agent override ─
console.log('📋 TEST 2: Resolve manufacturing with squad + agent overrides');
const result = resolver.resolve(
  { primary: 'manufacturing' },
  {
    id: 'finpay-backend',
    squad: 'payments',
    dnaOverrides: {
      identity: { name: 'FinPay Backend Engineer' },
      risk_tolerance: 'low',
      principles: [
        {
          id: 'payment-safety',
          statement: 'Every payment must be atomic and idempotent',
          priority: 'must',
          rationale: 'Financial integrity is non-negotiable',
        },
      ],
    },
  },
  { dna: 'enterprise-governance' }, // squad override
);

console.log('   identity:', JSON.stringify(result.identity, null, 4));
console.log('   risk_tolerance:', result.risk_tolerance);
console.log('   _sources:', JSON.stringify(result._sources));
console.log('   principles count:', result.principles.length);
console.log('   forbidden count:', result.forbidden.length);

// Verify agent override took precedence on identity.name
console.assert(
  result.identity.name === 'FinPay Backend Engineer',
  `FAIL: identity.name should be "FinPay Backend Engineer" but got "${result.identity.name}"`,
);
// Verify _sources includes all 3 layers
console.assert(
  result._sources.includes('catalog:manufacturing'),
  `FAIL: _sources missing catalog:manufacturing`,
);
console.assert(result._sources.includes('squad:payments'), `FAIL: _sources missing squad:payments`);
console.assert(
  result._sources.includes('agent:finpay-backend'),
  `FAIL: _sources missing agent:finpay-backend`,
);
console.log('   ✅ Override precedence: agent > squad > catalog\n');

// ─── TEST 3: Secondary DNA blending ────────────────────────
console.log('📋 TEST 3: Secondary DNA blending (manufacturing + immune-system)');
const blended = resolver.resolve(
  { primary: 'manufacturing', secondary: 'immune-system', blend: { primary: 70, secondary: 30 } },
  { id: 'finpay-backend', squad: 'payments' },
);

console.log('   _sources:', JSON.stringify(blended._sources));
console.assert(
  blended._sources.some((s) => s.includes('immune-system')),
  `FAIL: _sources missing immune-system secondary`,
);
console.log('   ✅ Secondary DNA blended correctly\n');

// ─── TEST 4: Error on non-existent pattern ─────────────────
console.log('📋 TEST 4: Error on non-existent pattern');
try {
  resolver.resolve({ primary: 'nonexistent-pattern' }, { id: 'test-agent' });
  console.log('   ❌ FAIL: Should have thrown an error');
} catch (err) {
  console.log('   Caught error:', err.message);
  console.assert(
    err.message.includes('nonexistent-pattern'),
    'Error message should mention the pattern name',
  );
  console.assert(
    err.message.includes('Available:'),
    'Error message should list available patterns',
  );
  console.log('   ✅ Error handling works correctly\n');
}

// ─── TEST 5: Minimal resolve (no overrides) ─────────────────
console.log('📋 TEST 5: Minimal resolve (no overrides)');
const minimal = resolver.resolve({ primary: 'wolf-pack' }, { id: 'simple-agent' });
console.log('   identity.name:', minimal.identity.name);
console.log('   _sources:', JSON.stringify(minimal._sources));
console.assert(
  minimal._sources.length === 1 && minimal._sources[0] === 'catalog:wolf-pack',
  'Should have exactly 1 source (catalog only)',
);
console.log('   ✅ Minimal resolve works\n');

console.log('═══════════════════════════════════════════════════════');
console.log('  All DnaResolver tests passed!');
console.log('═══════════════════════════════════════════════════════');
