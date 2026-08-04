#!/usr/bin/env node
/**
 * Real comparison across every DNA in dnas/*.yaml, loaded through the actual DNALoader
 * (same code path the MCP server uses) — not hand-summarized. Prints how each DNA's
 * personas, boundaries, governance rules, and quality gates actually differ, plus a
 * concrete "does this DNA's boundary engine block a real orchestrator file-edit attempt"
 * check per file, using the real GovernanceEngine.
 *
 * Run: node scripts/compare-dna-catalog.mjs
 */

import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const DNAS_DIR = join(REPO_ROOT, 'dnas');

const { DNALoader } = await import(
  'file://' + join(REPO_ROOT, 'packages/core/dist/index.mjs')
);
const { GovernanceEngine } = await import(
  'file://' + join(REPO_ROOT, 'packages/core/dist/index.mjs')
);

const files = readdirSync(DNAS_DIR).filter((f) => f.endsWith('.yaml'));
const loader = new DNALoader({ basePath: DNAS_DIR });

console.log(`\nComparing ${files.length} DNAs in dnas/ — loaded via the real DNALoader.\n`);
console.log('='.repeat(100));

const summary = [];

for (const file of files) {
  let dna;
  try {
    dna = await loader.load(file);
  } catch (err) {
    console.log(`\n### ${file}\nFAILED TO LOAD: ${err.message}\n`);
    summary.push({ file, error: err.message });
    continue;
  }

  const personas = dna.personas ?? [];
  const roles = personas.map((p) => p.role).join(', ');
  const boundaryCount = personas.reduce((n, p) => n + (p.boundaries?.length ?? 0), 0);
  const forbiddenUnconditional = personas.flatMap((p) =>
    (p.boundaries ?? []).filter((b) => b.type === 'forbidden' && b.value === true).map((b) => `${p.role}:${b.id}`),
  );
  const governanceCount = dna.governance?.length ?? 0;
  const qualityCount = dna.quality?.length ?? 0;

  // Real check: does an orchestrator (or highest-authority-need role) actually get blocked
  // trying to edit a file, using this DNA's own boundaries, via the real GovernanceEngine?
  const engine = new GovernanceEngine(dna.governance ?? []);
  let liveBlockCheck = 'n/a (no orchestrator persona)';
  const orchestrator = personas.find((p) => p.role === 'orchestrator');
  if (orchestrator) {
    const decision = engine.evaluate({
      agentId: 'demo-agent',
      agentRole: 'orchestrator',
      agentAuthority: orchestrator.authority,
      action: 'edit-file',
      targetType: 'file',
      impact: 'medium',
      boundaries: orchestrator.boundaries ?? [],
      targetFiles: ['apps/api/src/payments.ts'],
    });
    liveBlockCheck = decision.allowed
      ? `NOT blocked (${decision.reason})`
      : `BLOCKED — "${decision.reason}"`;
  }

  console.log(`\n### ${dna.id ?? file}  (${file})`);
  console.log(`  Personas (${personas.length}): ${roles}`);
  console.log(`  Boundaries: ${boundaryCount} total, ${forbiddenUnconditional.length} unconditional-forbidden`);
  console.log(`  Governance rules: ${governanceCount} | Quality gates: ${qualityCount}`);
  console.log(`  Live orchestrator edit-file check: ${liveBlockCheck}`);

  summary.push({
    file,
    id: dna.id,
    personas: personas.length,
    roles,
    boundaries: boundaryCount,
    unconditionalForbidden: forbiddenUnconditional.length,
    governance: governanceCount,
    quality: qualityCount,
    orchestratorEditBlocked: orchestrator ? !engine.evaluate({
      agentId: 'demo-agent', agentRole: 'orchestrator', agentAuthority: orchestrator.authority,
      action: 'edit-file', targetType: 'file', impact: 'medium',
      boundaries: orchestrator.boundaries ?? [], targetFiles: ['apps/api/src/payments.ts'],
    }).allowed : null,
  });
}

console.log(`\n${'='.repeat(100)}\nSummary table\n`);
console.table(
  summary.map((s) => ({
    DNA: s.id ?? s.file,
    Personas: s.personas ?? '-',
    Boundaries: s.boundaries ?? '-',
    'Unconditional forbidden': s.unconditionalForbidden ?? '-',
    Governance: s.governance ?? '-',
    Quality: s.quality ?? '-',
    'Orchestrator edit blocked?': s.orchestratorEditBlocked === null ? 'n/a' : s.orchestratorEditBlocked ? 'YES' : 'no',
  })),
);
