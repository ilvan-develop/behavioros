#!/usr/bin/env node
'use strict';

/**
 * BehaviorOS PreToolUse enforcement hook.
 *
 * Reads the Claude Code hook payload from stdin (`{ tool_name, tool_input, cwd, ... }`),
 * verifies the signed `.agent_state.json` in the project root, and blocks (exit 2 — Claude
 * Code's specific "block this tool call" signal for PreToolUse hooks; exit 1 is treated as a
 * generic script error, not a block) when:
 *   - a write-capable tool (Edit/Write/NotebookEdit/MultiEdit/Bash) is invoked before
 *     bos_select_dna has run, OR
 *   - the signed state file was hand-edited without recomputing its HMAC signature
 *     (tamper detection), OR
 *   - the active persona role is 'orchestrator' and the tool is a direct file-edit tool
 *     (per docs/PROTOCOL.md's "Orchestrator edits files directly" rule).
 *
 * IMPORTANT: the signing scheme here (secret key location, canonical payload, HMAC
 * algorithm) MUST stay in sync with packages/core/src/state/agent-state-store.ts.
 * It's duplicated rather than imported because this hook must run standalone with
 * plain `node`, with zero build step, before any workspace package is compiled.
 */

const { createHmac } = require('node:crypto');
const { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } = require('node:fs');
const { homedir } = require('node:os');
const { dirname, join } = require('node:path');

// ─── Secret management (mirrors agent-state-store.ts) ──────────────

function getStateSecretPath() {
  return process.env.BEHAVIOROS_STATE_KEY_PATH || join(homedir(), '.behavioros', 'state.key');
}

function isStrictModeEnrolled() {
  if (process.env.BEHAVIOROS_STATE_SECRET) return true;
  return existsSync(getStateSecretPath());
}

function getOrCreateStateSecret() {
  if (process.env.BEHAVIOROS_STATE_SECRET) return process.env.BEHAVIOROS_STATE_SECRET;
  const keyPath = getStateSecretPath();
  if (existsSync(keyPath)) return readFileSync(keyPath, 'utf-8').trim();

  const secret = require('node:crypto').randomBytes(32).toString('hex');
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, secret, 'utf-8');
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // best-effort
  }
  return secret;
}

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

function signProtocolState(protocol, secret, sessionId, issuedAt) {
  return createHmac('sha256', secret).update(canonicalPayload(protocol, sessionId, issuedAt)).digest('hex');
}

/** @returns {{ ok: boolean, tampered: boolean, data?: object, reason: string }} */
function readState(filePath) {
  if (!existsSync(filePath)) return { ok: false, tampered: false, reason: 'not-found' };

  let raw;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return { ok: false, tampered: false, reason: 'read-error' };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, tampered: false, reason: 'corrupt-json' };
  }

  if (!data.protocol) return { ok: false, tampered: false, reason: 'missing-protocol' };

  if (data.security && data.security.signature) {
    const secret = getOrCreateStateSecret();
    const expected = signProtocolState(
      data.protocol,
      secret,
      data.security.sessionId,
      data.security.issuedAt,
    );
    if (expected !== data.security.signature) {
      return { ok: false, tampered: true, data, reason: 'signature-mismatch' };
    }
    return { ok: true, tampered: false, data, reason: 'ok' };
  }

  if (isStrictModeEnrolled()) {
    return { ok: false, tampered: true, data, reason: 'signature-required' };
  }
  return { ok: true, tampered: false, data, reason: 'ok' };
}

// ─── Hook payload handling ──────────────────────────────────────────

/** Tools that mutate files or execute arbitrary commands — the actual enforcement surface. */
const WRITE_CAPABLE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit', 'Bash']);
/** Direct file-edit tools specifically covered by the "orchestrator may not edit files" rule. */
const FILE_EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);

function readStdinPayload() {
  try {
    const raw = readFileSync(0, 'utf-8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isBehaviorosMcpTool(toolName) {
  // BehaviorOS's own MCP tools are self-gated by EnforcementMiddleware — re-gating them
  // here would create a chicken-and-egg problem (bos_select_dna blocked by a check that
  // itself requires bos_select_dna to have already run).
  return typeof toolName === 'string' && /^mcp__behavioros__/.test(toolName);
}

function main() {
  const payload = readStdinPayload();
  const toolName = payload.tool_name || '';
  const cwd = payload.cwd || process.cwd();
  const stateFile = join(cwd, '.agent_state.json');

  if (isBehaviorosMcpTool(toolName) || !WRITE_CAPABLE_TOOLS.has(toolName)) {
    process.exit(0);
  }

  const result = readState(stateFile);

  if (result.tampered) {
    console.error(
      `BOS: protocol state integrity check failed (${result.reason}). ` +
        '.agent_state.json was modified without going through BehaviorOS tools. ' +
        'Run bos_reset_protocol with confirm=true to acknowledge and reset.',
    );
    process.exit(2);
  }

  if (!result.ok || !result.data) {
    console.error('BOS: .agent_state.json not found or unreadable. Protocol state not initialized.');
    process.exit(2);
  }

  const p = result.data.protocol;

  if (!p.dnaSelected) {
    console.error('BOS: bos_select_dna must be called before any action tool.');
    process.exit(2);
  }
  if (!p.truthResolved) {
    console.error('BOS: bos_resolve_truth must be called before delegation.');
    process.exit(2);
  }
  if (!p.missionCreated) {
    console.error('BOS: create-mission must be called before starting work.');
    process.exit(2);
  }

  if (p.activeRole === 'orchestrator' && FILE_EDIT_TOOLS.has(toolName)) {
    console.error('Permission denied: orchestrator may not edit files.');
    process.exit(2);
  }

  console.log('BOS: Protocol validation passed.');
  process.exit(0);
}

main();
