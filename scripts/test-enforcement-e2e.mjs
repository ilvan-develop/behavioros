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
 *   6. Cursor's beforeShellExecution payload shape ({ command, no tool_name }) is
 *      recognized as an implicit Bash call and gated the same way.
 *   7. Cursor's beforeMCPExecution payload shape for BehaviorOS's own tools
 *      ({ server: 'behavioros', tool_name: 'bos_select_dna' }) is exempted, not
 *      re-gated (avoids the chicken-and-egg deadlock).
 *   8. Windsurf's Cascade pre_write_code payload ({ agent_action_name, tool_info })
 *      is recognized as a file edit and gated the same way — Windsurf is the one
 *      platform here that can genuinely block a native file edit pre-emptively.
 *   9. Windsurf's pre_mcp_tool_use payload for BehaviorOS's own tools is exempted.
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
  return runHookRaw(payload);
}

/** Cursor's beforeShellExecution payload: no tool_name, no cwd, just a command string. */
function runShellHook(command) {
  const payload = JSON.stringify({ command });
  return runHookRaw(payload, { cwd: TEST_DIR });
}

/** Cursor's beforeMCPExecution payload for a BehaviorOS-owned tool: server + bare tool_name, no cwd. */
function runCursorMcpHook(toolName) {
  const payload = JSON.stringify({ server: 'behavioros', tool_name: toolName, tool_input: '{}' });
  return runHookRaw(payload, { cwd: TEST_DIR });
}

/** Windsurf's Cascade pre_write_code payload: agent_action_name + tool_info.file_path, no top-level cwd. */
function runWindsurfWriteHook(filePath) {
  const payload = JSON.stringify({
    agent_action_name: 'pre_write_code',
    trajectory_id: 't1',
    execution_id: 'e1',
    tool_info: { file_path: filePath, edits: [{ old_string: 'a', new_string: 'b' }] },
  });
  return runHookRaw(payload, { cwd: TEST_DIR });
}

/** Windsurf's Cascade pre_mcp_tool_use payload for a BehaviorOS-owned tool. */
function runWindsurfMcpHook(toolName) {
  const payload = JSON.stringify({
    agent_action_name: 'pre_mcp_tool_use',
    tool_info: { mcp_server_name: 'behavioros', mcp_tool_name: toolName, mcp_tool_arguments: {} },
  });
  return runHookRaw(payload, { cwd: TEST_DIR });
}

function runHookRaw(payload, spawnOpts = {}) {
  const result = spawnSync(process.execPath, [HOOK_PATH], {
    input: payload,
    cwd: TEST_DIR,
    env: { ...process.env, BEHAVIOROS_STATE_SECRET: SECRET },
    encoding: 'utf-8',
    ...spawnOpts,
  });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function assertBlocked(label, toolName, expectedSubstring, runner = runHook) {
  const { status, stderr } = runner(toolName);
  // Claude Code's PreToolUse hooks specifically require exit code 2 to block a tool call —
  // exit 1 is treated as a generic script error and does NOT stop the tool from running.
  // (This was itself a real bug found during live verification: the hook used exit 1 and
  // silently never blocked anything in an actual Claude Code session.) Cursor's
  // command-hook contract treats exit 2 as a block too, so the same check covers both.
  if (status !== 2) {
    console.error(`FAIL: ${label} — expected block (exit 2), got exit ${status}`);
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

function assertAllowed(label, toolName, runner = runHook) {
  const { status, stderr } = runner(toolName);
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

  // 6. Cursor's beforeShellExecution shape ({ command }, no tool_name) before dna selection
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
    'Cursor beforeShellExecution payload (no tool_name) is treated as Bash and blocked',
    'rm -rf node_modules',
    'bos_select_dna must be called',
    runShellHook,
  );

  // 7. Cursor's beforeMCPExecution shape for BehaviorOS's own tools is exempted, not re-gated
  assertAllowed(
    "Cursor beforeMCPExecution payload for BehaviorOS's own tool is exempted (no chicken-and-egg block)",
    'bos_select_dna',
    runCursorMcpHook,
  );

  // 8. Windsurf's pre_write_code shape ({ agent_action_name, tool_info }) is a real file edit
  assertBlocked(
    'Windsurf pre_write_code payload is treated as a file edit and blocked',
    'src/index.ts',
    'bos_select_dna must be called',
    runWindsurfWriteHook,
  );

  // 9. Windsurf's pre_mcp_tool_use shape for BehaviorOS's own tools is exempted
  assertAllowed(
    "Windsurf pre_mcp_tool_use payload for BehaviorOS's own tool is exempted",
    'bos_select_dna',
    runWindsurfMcpHook,
  );
} finally {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

console.log(`\n${passed} passed, ${failures} failed.`);
process.exit(failures > 0 ? 1 : 0);
