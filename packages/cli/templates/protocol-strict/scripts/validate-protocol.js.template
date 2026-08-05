#!/usr/bin/env node
'use strict';

/**
 * BehaviorOS PreToolUse enforcement hook.
 *
 * Shared across several different hook contracts, normalized by `normalizeCall()` below:
 *   - Claude Code's `PreToolUse` payload: `{ tool_name, tool_input, cwd, ... }`.
 *   - VS Code Copilot's `preToolUse` payload (same PascalCase contract as Claude Code
 *     per its own docs, sharing `.claude/settings.json`): `{ tool_name, tool_input, cwd }` —
 *     but its native tool names (e.g. `editFiles`, `createFile`, `runInTerminal`) are NOT
 *     confirmed to equal Claude Code's (`Edit`/`Write`/`Bash`); see docs/COPILOT-INTEGRATION.md
 *     for why matching is pattern-based here rather than an exact-name allowlist.
 *   - Cursor's `beforeMCPExecution` payload: `{ tool_name, tool_input, server, ... }`
 *     (no `cwd`), and its `beforeShellExecution` payload: `{ command, ... }` — no
 *     `tool_name` at all, since that event only ever fires for a shell command.
 *   - Windsurf's Cascade pre-hooks: `{ agent_action_name, tool_info, ... }`, where
 *     `agent_action_name` is `pre_write_code` (`tool_info.file_path`), `pre_run_command`
 *     (`tool_info.command_line`, `tool_info.cwd`), or `pre_mcp_tool_use`
 *     (`tool_info.mcp_server_name`, `tool_info.mcp_tool_name`). See
 *     docs/WINDSURF-INTEGRATION.md — Windsurf is the one platform here whose hooks can
 *     genuinely block a native file edit before it lands.
 *
 * Verifies the signed `.agent_state.json` in the project root, and blocks (exit 2 — every
 * platform above treats exit 2 as "block this action"; exit 1 is a generic script error,
 * not a block) when:
 *   - a write-capable tool (edit/write/create or a shell command) is invoked before
 *     bos_select_dna has run, OR
 *   - the signed state file was hand-edited without recomputing its HMAC signature
 *     (tamper detection), OR
 *   - the active persona role is 'orchestrator' and the tool is a direct file-edit tool
 *     (per docs/PROTOCOL.md's "Orchestrator edits files directly" rule).
 *
 * Known gap (see docs/CURSOR-INTEGRATION.md, docs/CODEX-INTEGRATION.md): Cursor and Codex
 * have no "before a native file edit" hook at all — only shell commands and (for Cursor)
 * MCP tool calls are interceptable there. Windsurf and Claude Code do not have this gap.
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

/** File-edit tool names confirmed (Claude Code) or plausible-but-unverified (VS Code Copilot). */
const EDIT_TOOL_NAMES = new Set([
  'Edit', 'Write', 'NotebookEdit', 'MultiEdit', // Claude Code — verified
  'editFiles', 'createFile', 'edit_file', 'create_file', 'apply_patch', // VS Code Copilot — unverified, see docs/COPILOT-INTEGRATION.md
]);
/** Shell/command tool names confirmed (Claude Code) or plausible-but-unverified (VS Code Copilot). */
const BASH_TOOL_NAMES = new Set([
  'Bash', // Claude Code — verified
  'runInTerminal', 'runCommands', 'runTerminalCommand', 'run_terminal_command', // VS Code Copilot — unverified
]);

function readStdinPayload() {
  try {
    const raw = readFileSync(0, 'utf-8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Normalizes the several hook payload shapes documented at the top of this file into a
 * single { kind: 'edit'|'bash'|'mcp'|'other', toolName, server, cwd } shape.
 */
function classifyCall(payload) {
  // Windsurf Cascade pre-hooks: { agent_action_name, tool_info, ... }.
  if (typeof payload.agent_action_name === 'string') {
    const info = payload.tool_info || {};
    if (payload.agent_action_name === 'pre_write_code') {
      return { kind: 'edit', toolName: 'Edit', server: null, cwd: info.cwd };
    }
    if (payload.agent_action_name === 'pre_run_command') {
      return { kind: 'bash', toolName: 'Bash', server: null, cwd: info.cwd };
    }
    if (payload.agent_action_name === 'pre_mcp_tool_use') {
      return { kind: 'mcp', toolName: info.mcp_tool_name || '', server: info.mcp_server_name || null, cwd: undefined };
    }
    return { kind: 'other', toolName: '', server: null, cwd: info.cwd };
  }

  // Cursor's beforeShellExecution payload has no tool_name (it only ever fires for a
  // shell command) — a bare `command` field with no tool_name means "this is Bash".
  if (!payload.tool_name && typeof payload.command === 'string') {
    return { kind: 'bash', toolName: 'Bash', server: payload.server || null, cwd: payload.cwd };
  }

  const toolName = payload.tool_name || '';
  const server = payload.server || null;
  if (EDIT_TOOL_NAMES.has(toolName)) return { kind: 'edit', toolName, server, cwd: payload.cwd };
  if (BASH_TOOL_NAMES.has(toolName)) return { kind: 'bash', toolName, server, cwd: payload.cwd };
  return { kind: 'other', toolName, server, cwd: payload.cwd };
}

function isBehaviorosMcpTool(call) {
  // BehaviorOS's own MCP tools are self-gated by EnforcementMiddleware — re-gating them
  // here would create a chicken-and-egg problem (bos_select_dna blocked by a check that
  // itself requires bos_select_dna to have already run).
  // Claude Code names MCP tools "mcp__<server>__<tool>"; Cursor and Windsurf send the
  // bare tool name plus a separate server field — check both shapes.
  if (call.server === 'behavioros') return true;
  return typeof call.toolName === 'string' && /^mcp__behavioros__/.test(call.toolName);
}

function main() {
  const payload = readStdinPayload();
  const call = classifyCall(payload);
  const cwd = call.cwd || process.cwd();
  const stateFile = join(cwd, '.agent_state.json');

  if (isBehaviorosMcpTool(call) || (call.kind !== 'edit' && call.kind !== 'bash')) {
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

  if (p.activeRole === 'orchestrator' && call.kind === 'edit') {
    console.error('Permission denied: orchestrator may not edit files.');
    process.exit(2);
  }

  console.log('BOS: Protocol validation passed.');
  process.exit(0);
}

main();
