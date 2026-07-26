import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
  };
}

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
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
    return state;
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as ProtocolState;
  } catch {
    const state = defaultState();
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
    return state;
  }
}

function saveState(projectPath: string, state: ProtocolState): void {
  state.protocol.lastUpdated = new Date().toISOString();
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
