import { createHmac, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Plugin } from '@opencode-ai/plugin';

const STATE_FILE = '.agent_state.json';

interface ProtocolState {
  protocol: {
    dnaSelected: boolean;
    truthResolved: boolean;
    missionCreated: boolean;
    auditDone: boolean;
    learningRecorded: boolean;
    lastStep: number | null;
    lastUpdated: string | null;
    activeRole?: string;
  };
  security?: { sessionId: string; issuedAt: string; signature: string };
}

// ─── Signed state (mirrors packages/core/src/state/agent-state-store.ts and
// scripts/validate-protocol.js — MUST stay in sync with both, and deliberately
// duplicated rather than imported so this plugin has zero build-time dependency
// on the workspace packages). Sharing the same secret/scheme here means state
// written by Claude Code's MCP server and state written by OpenCode's own
// delegation flow both verify against each other instead of one tool silently
// stripping the other's signature.

function getStateSecretPath(): string {
  return process.env.BEHAVIOROS_STATE_KEY_PATH || join(homedir(), '.behavioros', 'state.key');
}

function isStrictModeEnrolled(): boolean {
  if (process.env.BEHAVIOROS_STATE_SECRET) return true;
  return existsSync(getStateSecretPath());
}

function getOrCreateStateSecret(): string {
  if (process.env.BEHAVIOROS_STATE_SECRET) return process.env.BEHAVIOROS_STATE_SECRET;
  const keyPath = getStateSecretPath();
  if (existsSync(keyPath)) return readFileSync(keyPath, 'utf-8').trim();

  const secret = randomBytes(32).toString('hex');
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, secret, 'utf-8');
  try {
    chmodSync(keyPath, 0o600);
  } catch {
    // best-effort
  }
  return secret;
}

function canonicalPayload(protocol: ProtocolState['protocol'], sessionId: string, issuedAt: string): string {
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

function signProtocolState(protocol: ProtocolState['protocol'], secret: string, sessionId: string, issuedAt: string): string {
  return createHmac('sha256', secret).update(canonicalPayload(protocol, sessionId, issuedAt)).digest('hex');
}

const SESSION_ID = randomBytes(8).toString('hex');

function defaultState(): ProtocolState {
  return {
    protocol: {
      dnaSelected: false,
      truthResolved: false,
      missionCreated: false,
      auditDone: false,
      learningRecorded: false,
      lastStep: null,
      lastUpdated: null,
    },
  };
}

function getStatePath(projectPath: string): string {
  return join(projectPath, STATE_FILE);
}

function loadState(projectPath: string): ProtocolState {
  const path = getStatePath(projectPath);
  if (!existsSync(path)) {
    const state = defaultState();
    saveState(projectPath, state);
    return state;
  }

  let raw: string;
  let data: ProtocolState;
  try {
    raw = readFileSync(path, 'utf-8');
    data = JSON.parse(raw) as ProtocolState;
  } catch {
    const state = defaultState();
    saveState(projectPath, state);
    return state;
  }

  if (data.security?.signature) {
    const secret = getOrCreateStateSecret();
    const expected = signProtocolState(data.protocol, secret, data.security.sessionId, data.security.issuedAt);
    if (expected !== data.security.signature) {
      throw new Error(
        'BehaviorOS protocol state integrity check failed: .agent_state.json was modified ' +
          'without going through BehaviorOS tools (signature mismatch). Use bos_reset_protocol ' +
          '(confirm=true) to acknowledge and reset before continuing.',
      );
    }
    return data;
  }

  if (isStrictModeEnrolled()) {
    throw new Error(
      'BehaviorOS protocol state integrity check failed: .agent_state.json has no signature, ' +
        'but this machine has already enrolled in signed-state mode. Use bos_reset_protocol ' +
        '(confirm=true) to acknowledge and reset before continuing.',
    );
  }

  // Legacy/back-compat: unsigned file, and this machine has never enrolled in signed-state
  // mode (no secret key exists yet) — trust it as-is, matching pre-signing behavior.
  return data;
}

function saveState(projectPath: string, state: ProtocolState): void {
  state.protocol.lastUpdated = new Date().toISOString();
  const secret = getOrCreateStateSecret();
  const issuedAt = new Date().toISOString();
  const signature = signProtocolState(state.protocol, secret, SESSION_ID, issuedAt);
  state.security = { sessionId: SESSION_ID, issuedAt, signature };
  writeFileSync(getStatePath(projectPath), JSON.stringify(state, null, 2), 'utf-8');
}

function updateState(state: ProtocolState, toolName: string): void {
  switch (toolName) {
    case 'bos_select_dna':
      state.protocol.dnaSelected = true;
      state.protocol.lastStep = 1;
      break;
    case 'bos_resolve_truth':
      state.protocol.truthResolved = true;
      state.protocol.lastStep = 2;
      break;
    case 'create-mission':
      state.protocol.missionCreated = true;
      state.protocol.lastStep = 3;
      break;
    case 'bos_run_audit':
      state.protocol.auditDone = true;
      state.protocol.lastStep = 4;
      break;
    case 'record-learning':
      state.protocol.learningRecorded = true;
      state.protocol.lastStep = 5;
      break;
    case 'bos_reset_protocol':
      const fresh = defaultState();
      state.protocol.dnaSelected = fresh.protocol.dnaSelected;
      state.protocol.truthResolved = fresh.protocol.truthResolved;
      state.protocol.missionCreated = fresh.protocol.missionCreated;
      state.protocol.auditDone = fresh.protocol.auditDone;
      state.protocol.learningRecorded = fresh.protocol.learningRecorded;
      state.protocol.lastStep = fresh.protocol.lastStep;
      break;
  }
}

const PROTOCOL_REMINDER = `## BehaviorOS Protocol — 7 Mandatory Steps

Every task MUST pass through all 7 steps in order:

| # | Step | Tool |
|---|------|------|
| 1 | Select DNA | \`bos_select_dna\` |
| 2 | Display DNA Block | Visual template |
| 3 | Resolve Truth | \`bos_resolve_truth\` |
| 4 | Create Mission | \`create-mission\` |
| 5 | Delegate | Task tool |
| 6 | Run Audit | \`bos_run_audit\` |
| 7 | Record Learning | \`record-learning\` |

**Enforcement is now automatic (persistent state via .agent_state.json):**
- Action tools require steps 1+3+4 complete
- \`edit\` tool requires \`bos_select_dna\` first
- Use \`bos_validate_protocol\` to check current compliance status
- Use \`bos_reset_protocol\` to reset state (recovery only)
- Protocol state persists between sessions via .agent_state.json
`;

export const ProtocolEnforcerPlugin: Plugin = async () => {
  return {
    'tool.execute.before': async (input: { toolName: string; args: Record<string, unknown>; project?: { path: string } }) => {
      const toolName = input?.toolName;
      if (!toolName) return;

      const projectPath = input?.project?.path ?? process.cwd();
      const state = loadState(projectPath);

      updateState(state, toolName);

      let blocked = false;

      if (toolName === 'task') {
        const missing: string[] = [];
        if (!state.protocol.dnaSelected) missing.push('bos_select_dna');
        if (!state.protocol.truthResolved) missing.push('bos_resolve_truth');
        if (!state.protocol.missionCreated) missing.push('create-mission');
        if (missing.length > 0) {
          blocked = true;
          throw new Error(
            `Delegation enforcement failed: prerequisite steps must be completed before delegation. Missing: ${missing.join(', ')}. Use \`bos_validate_protocol\` for full status.`,
          );
        }
      }

      if (toolName === 'edit' || toolName === 'write') {
        if (!state.protocol.dnaSelected) {
          blocked = true;
          throw new Error(
            `Protocol violation: bos_select_dna must be called before any ${toolName} operation.`,
          );
        }
      }

      if (state.protocol.truthResolved && !state.protocol.dnaSelected) {
        blocked = true;
        throw new Error(
          'Protocol order violation: bos_select_dna must be called before bos_resolve_truth.',
        );
      }

      if (state.protocol.missionCreated && !state.protocol.truthResolved) {
        blocked = true;
        throw new Error(
          'Protocol order violation: bos_resolve_truth must be called before create-mission.',
        );
      }

      if (state.protocol.auditDone && !state.protocol.missionCreated) {
        blocked = true;
        throw new Error(
          'Protocol order violation: create-mission must be called before bos_run_audit.',
        );
      }

      if (state.protocol.learningRecorded && !state.protocol.auditDone) {
        blocked = true;
        throw new Error(
          'Protocol order violation: bos_run_audit must be called before record-learning.',
        );
      }

      if (!blocked) {
        saveState(projectPath, state);
      }
    },
    'experimental.chat.system.transform': async (
      _input: unknown,
      output: { content?: string },
    ) => {
      if (output && output.content && !output.content.includes('BehaviorOS Protocol')) {
        output.content = PROTOCOL_REMINDER + '\n' + output.content;
      }
    },
  };
};
