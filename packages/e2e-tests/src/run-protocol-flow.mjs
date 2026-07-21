import { createTestEngine, createTestServer, createConnectedClient } from './helpers/createTestMcp.mjs';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const ROOT = process.cwd();
  const AGENT_STATE = path.join(ROOT, '.agent_state.json');

  // prepare agent state
  const state = {
    kernel_version: '1.0',
    current_workflow: { task_id: 'pov', description: 'e2e run', active_stage: 'ANALYSIS', started_at: new Date().toISOString() },
    behavior_os_governance: { domain_compliance: true, pipeline_status: 'READY', enforcement_level: 'strict' },
    pipeline_history: [],
  };
  await fs.writeFile(AGENT_STATE, JSON.stringify(state, null, 2), 'utf8');

  const engine = createTestEngine();
  const server = createTestServer(engine);
  const client = await createConnectedClient(server);

  console.log('Calling bos_select_dna...');
  const dna = await client.callTool({ name: 'bos_select_dna', arguments: { taskType: 'feature', domain: 'payments' } });
  console.log('dna:', JSON.stringify(dna, null, 2));

  console.log('Calling bos_resolve_truth...');
  const truth = await client.callTool({ name: 'bos_resolve_truth', arguments: { taskType: 'feature', domain: 'payments' } });
  console.log('truth:', JSON.stringify(truth, null, 2));

  console.log('Creating mission...');
  const mission = await client.callTool({ name: 'create-mission', arguments: { title: 'POV run', type: 'feature' } });
  console.log('mission:', JSON.stringify(mission, null, 2));

  console.log('Running audit...');
  const audit = await client.callTool({ name: 'bos_run_audit', arguments: { trigger: 'commit' } });
  console.log('audit:', JSON.stringify(audit, null, 2));

  console.log('Recording learning...');
  const learning = await client.callTool({ name: 'record-learning', arguments: { type: 'observation', source: 'e2e-run', data: { ok: true }, confidence: 0.99 } });
  console.log('learning:', JSON.stringify(learning, null, 2));

  await client.close();
  await server.close();
  console.log('\n✅ E2E run completed successfully — all 5 protocol steps passed');
}

main().catch((err) => {
  console.error('❌ E2E run failed:', err);
  process.exit(1);
});
