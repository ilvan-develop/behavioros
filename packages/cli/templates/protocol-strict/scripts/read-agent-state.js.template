const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const stateFile = join(process.cwd(), '.agent_state.json');
if (!existsSync(stateFile)) {
  console.log('BOS: No .agent_state.json found. Starting fresh.');
  process.exit(0);
}

try {
  const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
  const p = state.protocol || {};
  const completed = [];
  if (p.dnaSelected) completed.push('Select DNA');
  if (p.truthResolved) completed.push('Resolve Truth');
  if (p.missionCreated) completed.push('Create Mission');
  if (p.auditDone) completed.push('Run Audit');
  if (p.learningRecorded) completed.push('Record Learning');

  if (completed.length > 0) {
    console.log(`BOS: Protocol state loaded. Previous steps completed: ${completed.join(', ')}`);
  } else {
    console.log('BOS: Protocol state loaded. No steps completed yet.');
  }
  process.exit(0);
} catch (err) {
  console.error('BOS: Failed to read .agent_state.json:', err.message);
  process.exit(0);
}
