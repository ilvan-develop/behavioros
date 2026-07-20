import type { Plugin } from '@opencode-ai/plugin';

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

**Critical rules:**
- Call \`bos_select_dna\` before ANY task — no exceptions
- Never edit files directly — always delegate to subagents
- Always run \`bos_run_audit\` before marking mission complete
- Record learning events at the end of every mission
`;

const DELEGATION_WORKFLOW_TOOLS = new Set([
  'bos_select_dna',
  'bos_resolve_truth',
  'create-mission',
  'update-progress',
  'get-status',
  'list-agents',
  'list-missions',
  'bos_list_patterns',
  'bos_get_insights',
  'bos_check_escalation',
  'bos_resolve_conflict',
  'bos_run_audit',
  'evaluate-governance',
  'record-learning',
]);

const WRITE_COMMANDS = [
  /^echo\s+.*[>»]/,
  /^cat\s+<<.*[>»]/,
  /^printf\s+.*[>»]/,
  /^cp\s+/,
  /^mv\s+/,
  /^mkdir\s+/,
  /^rm\s+/,
  /^touch\s+/,
  /^write\s+/,
  /^fs\.write/,
  /^npx\s+.*create-/,
  /^npm\s+init/,
];

interface ProtocolState {
  dnaSelected: boolean;
  truthResolved: boolean;
  missionCreated: boolean;
  auditDone: boolean;
  learningRecorded: boolean;
}

const protocolState: ProtocolState = {
  dnaSelected: false,
  truthResolved: false,
  missionCreated: false,
  auditDone: false,
  learningRecorded: false,
};

function resetState(): void {
  protocolState.dnaSelected = false;
  protocolState.truthResolved = false;
  protocolState.missionCreated = false;
  protocolState.auditDone = false;
  protocolState.learningRecorded = false;
}

function updateState(toolName: string): void {
  switch (toolName) {
    case 'bos_select_dna':
      protocolState.dnaSelected = true;
      break;
    case 'bos_resolve_truth':
      protocolState.truthResolved = true;
      break;
    case 'create-mission':
      protocolState.missionCreated = true;
      break;
    case 'bos_run_audit':
      protocolState.auditDone = true;
      break;
    case 'record-learning':
      protocolState.learningRecorded = true;
      break;
  }
}

function isWriteCommand(command: string): boolean {
  return WRITE_COMMANDS.some((re) => re.test(command.trim()));
}

export const ProtocolEnforcerPlugin: Plugin = async () => {
  return {
    'tool.execute.before': async (input: { toolName: string; args: Record<string, unknown> }) => {
      const toolName = input?.toolName;

      if (!toolName) return;

      // Always allow delegation workflow tools
      if (DELEGATION_WORKFLOW_TOOLS.has(toolName)) {
        updateState(toolName);
        return;
      }

      // For task (delegation) tool: require DNA selected + truth resolved
      if (toolName === 'task') {
        if (!protocolState.dnaSelected) {
          throw new Error(
            'Delegation enforcement failed: bos_select_dna must be called before delegation.',
          );
        }
        if (!protocolState.truthResolved) {
          throw new Error(
            'Delegation enforcement failed: bos_resolve_truth must be called before delegation.',
          );
        }
        if (!protocolState.missionCreated) {
          throw new Error(
            'Delegation enforcement failed: create-mission must be called before delegation.',
          );
        }
        return;
      }

      // For file-editing tools: require DNA selected
      if (toolName === 'edit') {
        if (!protocolState.dnaSelected) {
          throw new Error(
            'Protocol violation: bos_select_dna must be called before any edit operation.',
          );
        }
        return;
      }

      // For bash: only block if the command is a write/create operation
      if (toolName === 'bash') {
        const command = input?.args?.command as string | undefined;
        if (command && isWriteCommand(command) && !protocolState.dnaSelected) {
          throw new Error(
            'Protocol violation: bos_select_dna must be called before modifying files.',
          );
        }
        return;
      }

      // Any other tool: require at least DNA selected
      if (!protocolState.dnaSelected) {
        throw new Error(
          'Delegation enforcement failed: bos_select_dna must be called before any action tool.',
        );
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
