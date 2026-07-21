import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'

import { createTestEngine, createTestServer, createConnectedClient } from '../helpers/createTestMcp'

const ROOT = process.cwd()
const AGENT_STATE = path.join(ROOT, '.agent_state.json')

async function writeAgentState(stage = 'ANALYSIS') {
  const state = {
    kernel_version: '1.0',
    current_workflow: { task_id: 'pov', description: 'e2e test', active_stage: stage, started_at: new Date().toISOString() },
    behavior_os_governance: { domain_compliance: true, pipeline_status: 'READY', enforcement_level: 'strict' },
    pipeline_history: []
  }
  await fs.writeFile(AGENT_STATE, JSON.stringify(state, null, 2), 'utf8')
}

describe('BehaviorOS protocol E2E (in-process MCP)', () => {
  let engine: any
  let server: any
  let client: any

  beforeEach(async () => {
    engine = createTestEngine()
    server = createTestServer(engine)
    client = await createConnectedClient(server)
    await writeAgentState('ANALYSIS')
  })

  it('executes full protocol flow via MCP tools', async () => {
    // 1) bos_select_dna
    const dnaRes = await client.callTool({ name: 'bos_select_dna', arguments: { taskType: 'feature', domain: 'payments' } })
    expect(dnaRes).toBeDefined()
    expect(dnaRes.content).toBeDefined()

    // 2) state check
    const raw = await fs.readFile(AGENT_STATE, 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.current_workflow.active_stage).toBe('ANALYSIS')

    // 3) bos_resolve_truth
    const truthRes = await client.callTool({ name: 'bos_resolve_truth', arguments: { taskType: 'feature', domain: 'payments' } })
    expect(truthRes).toBeDefined()
    expect(truthRes.content).toBeDefined()

    // 4) create-mission
    const missionRes = await client.callTool({ name: 'create-mission', arguments: { title: 'POV test', type: 'feature' } })
    expect(missionRes).toBeDefined()
    expect(missionRes.content).toBeDefined()

    // 5) record-learning (observation as proxy for handoff completion)
    const handoffRes = await client.callTool({ name: 'record-learning', arguments: { type: 'observation', source: 'e2e', data: { status: 'completed' }, confidence: 0.9 } })
    expect(handoffRes).toBeDefined()
    expect(handoffRes.content).toBeDefined()

    // 6) run audit
    const auditRes = await client.callTool({ name: 'bos_run_audit', arguments: { trigger: 'commit' } })
    expect(auditRes).toBeDefined()
    expect(auditRes.content).toBeDefined()

    // 7) record-learning
    const learningRes = await client.callTool({ name: 'record-learning', arguments: { type: 'observation', source: 'e2e', data: { ok: true }, confidence: 0.95 } })
    expect(learningRes).toBeDefined()
    expect(learningRes.content).toBeDefined()

    await client.close()
    await server.close()
  })
})
