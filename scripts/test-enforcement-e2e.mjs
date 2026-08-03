#!/usr/bin/env node
/**
 * Real end-to-end test of the PreToolUse enforcement hook (scripts/validate-protocol.js).
 *
 * Unlike the previous version of this script (which only printed echo statements and
 * asserted nothing), this one actually shells out to the hook with crafted stdin
 * payloads and asserts on its exit code, covering:
 *   1. No state file yet -> Edit is blocked.
 *   2. Signed state with dnaSelected=false -> Edit is blocked.
 *   3. Signed state with all required steps -> Edit is allowed.
 *   4. Tampered state (booleans flipped without resigning) -> blocked as tampering,
 *      not silently accepted.
 *   5. activeRole 'orchestrator' -> Edit is blocked, but Read is still allowed.
 *
 * Runs in an isolated temp project dir with its own state secret, so it never
 * touches the real ~/.behavioros/state.key or any real .agent_state.json.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const HOOK_PATH = join(REPO_ROOT, 'scripts', 'validate-protocol.js');

const SECRET = randomBytes(32).toString('hex');
const TEST_DIR = mkdtempSync(join(tmpdir(), 'bos-e2e-'));
const STATE_PATH = join(TEST_DIR, '.agent_state.json');

let failures = 0;
let passed = 0;

function canonicalPayload(protocol, sessionId, issuedAt) {
  return [
    !!protocol.dnaSelected,
    !!protocol.truthResolved,
    !!protocol.missionCreated,
    !!protocol.auditDone,
    !!protocol.learningRecorded,
    protocol.activeRole || '',
    sessionId,
    issuedAt,
  ].join('|');
}

function sign(protocol, sessionId, issuedAt) {
  return createHmac('sha256', SECRET).update(canonicalPayload(protocol, sessionId, issuedAt)).digest('hex');
}

function writeSignedState(protocol) {
  const sessionId = 'test-session';
  const issuedAt = new Date().toISOString();
  const signature = sign(protocol, sessionId, issuedAt);
  writeFileSync(
    STATE_PATH,
    JSON.stringify({ version: '1.0', protocol, security: { sessionId, issuedAt, signature } }, null, 2),
  );
}

function runHook(toolName) {
  const payload = JSON.stringify({ tool_name: toolName, cwd: TEST_DIR, tool_input: {} });
  const result = spawnSync(process.execPath, [HOOK_PATH], {
    input: payload,
    cwd: TEST_DIR,
    env: { ...process.env, BEHAVIOROS_STATE_SECRET: SECRET },
    encoding: 'utf-8',
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function assertBlocked(label, toolName, expectedSubstring) {
  const { status, stderr } = runHook(toolName);
  if (status === 0) {
    console.error(`FAIL: ${label} — expected block (non-zero exit), got exit 0`);
    failures++;
    return;
  }
  if (expectedSubstring && !stderr.includes(expectedSubstring)) {
    console.error(`FAIL: ${label} — expected stderr to contain "${expectedSubstring}", got: ${stderr}`);
    failures++;
    return;
  }
  console.log(`PASS: ${label}`);
  passed++;
}

function assertAllowed(label, toolName) {
  const { status, stderr } = runHook(toolName);
  if (status !== 0) {
    console.error(`FAIL: ${label} — expected allow (exit 0), got exit ${status}: ${stderr}`);
    failures++;
    return;
  }
  console.log(`PASS: ${label}`);
  passed++;
}

try {
  // 1. No state file at all
  assertBlocked('Edit blocked with no .agent_state.json', 'Edit');

  // 2. Signed state, protocol not started
  writeSignedState({
    dnaSelected: false,
    truthResolved: false,
    missionCreated: false,
    auditDone: false,
    learningRecorded: false,
    lastStep: null,
    lastUpdated: new Date().toISOString(),
  });
  assertBlocked(
    'Edit blocked before bos_select_dna',
    'Edit',
    'bos_select_dna must be called',
  );

  // 3. Fully signed-off state -> Edit allowed, and a read-only tool is never gated
  writeSignedState({
    dnaSelected: true,
    truthResolved: true,
    missionCreated: true,
    auditDone: false,
    learningRecorded: false,
    lastStep: 3,
    lastUpdated: new Date().toISOString(),
  });
  assertAllowed('Edit allowed once dna/truth/mission are complete', 'Edit');
  assertAllowed('Read is never gated', 'Read');

  // 4. Tamper: hand-edit the signed file without recomputing the HMAC
  const raw = JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  raw.protocol.auditDone = true; // flip a flag post-hoc, signature now stale
  writeFileSync(STATE_PATH, JSON.stringify(raw, null, 2));
  assertBlocked(
    'Tampered state (signature mismatch) is detected and blocked, not silently trusted',
    'Edit',
    'integrity check failed',
  );

  // 5. Orchestrator role blocks direct file edits, but not read-only tools
  writeSignedState({
    dnaSelected: true,
    truthResolved: true,
    missionCreated: true,
    auditDone: true,
    learningRecorded: true,
    lastStep: 5,
    lastUpdated: new Date().toISOString(),
    activeRole: 'orchestrator',
  });
  assertBlocked(
    'Orchestrator role blocks direct Edit',
    'Edit',
    'Permission denied: orchestrator may not edit files.',
  );
  assertAllowed('Orchestrator role does not block Read', 'Read');
} finally {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failures} failed.`);
process.exit(failures > 0 ? 1 : 0);
