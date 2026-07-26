const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const stateFile = join(process.cwd(), '.agent_state.json');
if (!existsSync(stateFile)) {
  console.error('BOS: .agent_state.json not found. Protocol state not initialized.');
  process.exit(1);
}

try {
  const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
  const p = state.protocol || {};

  if (!p.dnaSelected) {
    console.error('BOS: bos_select_dna must be called before any action tool.');
    process.exit(1);
  }
  if (!p.truthResolved) {
    console.error('BOS: bos_resolve_truth must be called before delegation.');
    process.exit(1);
  }
  if (!p.missionCreated) {
    console.error('BOS: create-mission must be called before starting work.');
    process.exit(1);
  }

  console.log('BOS: Protocol validation passed.');
  process.exit(0);
} catch (err) {
  console.error('BOS: Failed to read protocol state:', err.message);
  process.exit(1);
}
