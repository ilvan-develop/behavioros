import { describe, it, expect, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { BehaviorOSEngine } from '@behavioros/core'
import type { DNAPackage } from '@behavioros/schemas'
import { registerResources } from '../resources.js'
import { createMission, createMissionInput } from '../tools/create-mission.js'
import { getStatus } from '../tools/get-status.js'
import {
  updateProgress,
  updateProgressInput,
} from '../tools/update-progress.js'
import { listAgents, listAgentsInput } from '../tools/list-agents.js'
import { listMissions, listMissionsInput } from '../tools/list-missions.js'
import {
  evaluateGovernance,
  evaluateGovernanceInput,
} from '../tools/evaluate-governance.js'
import {
  recordLearning,
  recordLearningInput,
} from '../tools/record-learning.js'
import { runAudit, runAuditInput } from '../tools/run-audit.js'

const testDNA: DNAPackage = {
  id: 'test-dna',
  name: 'Test DNA',
  version: '1.0.0',
  personas: [
    { role: 'engineer', authority: 'senior', name: 'Test Engineer' },
    { role: 'qa', authority: 'senior', name: 'Test QA' },
  ],
  governance: [
    {
      id: 'test-rule',
      name: 'Test Rule',
      level: 'medium',
      action: 'warn',
      conditions: ['type:feature'],
    },
  ],
  quality: [
    { id: 'test-coverage', name: 'Test Coverage', type: 'test_coverage', threshold: 80 },
  ],
  patterns: [
    {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'collaboration',
      triggers: ['agent:engineer'],
      actions: ['code-review'],
    },
  ],
}

function createTestEngine(): BehaviorOSEngine {
  return new BehaviorOSEngine({
    dna: testDNA,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true },
    audit: { enabled: true },
  })
}

function createTestServer(engine: BehaviorOSEngine): McpServer {
  const server = new McpServer({ name: 'behavioros-test', version: '0.1.0' })

  server.tool(
    'create-mission',
    'Create a new mission',
    createMissionInput.shape,
    async (args) => createMission(engine, args),
  )
  server.tool('get-status', 'Get system status', async () => getStatus(engine))
  server.tool(
    'update-progress',
    'Update mission progress',
    updateProgressInput.shape,
    async (args) => updateProgress(engine, args),
  )
  server.tool(
    'list-agents',
    'List agents',
    listAgentsInput.shape,
    async (args) => listAgents(engine, args),
  )
  server.tool(
    'list-missions',
    'List missions',
    listMissionsInput.shape,
    async (args) => listMissions(engine, args),
  )
  server.tool(
    'evaluate-governance',
    'Evaluate governance',
    evaluateGovernanceInput.shape,
    async (args) => evaluateGovernance(engine, args),
  )
  server.tool(
    'record-learning',
    'Record learning event',
    recordLearningInput.shape,
    async (args) => recordLearning(engine, args),
  )
  server.tool(
    'run-audit',
    'Run audit pipeline',
    runAuditInput.shape,
    async (args) => runAudit(args),
  )

  registerResources(server, engine)
  return server
}

async function createConnectedClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-client', version: '0.1.0' })
  await client.connect(clientTransport)
  return client
}

describe('MCP Server Tools', () => {
  let engine: BehaviorOSEngine

  beforeEach(() => {
    engine = createTestEngine()
  })

  it('should initialize MCP server correctly', () => {
    const server = createTestServer(engine)
    expect(server).toBeInstanceOf(McpServer)
  })

  it('should create a mission via tool', async () => {
    const result = await createMission(engine, {
      title: 'Test Mission',
      type: 'feature',
      priority: 'high',
      description: 'A test mission',
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.title).toBe('Test Mission')
    expect(parsed.type).toBe('feature')
    expect(parsed.priority).toBe('high')
    expect(parsed.status).toBe('draft')
    expect(parsed.id).toBeDefined()
  })

  it('should get system status', async () => {
    const result = await getStatus(engine)
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveProperty('missions')
    expect(parsed).toHaveProperty('agents')
    expect(parsed).toHaveProperty('auditEvents')
    expect(parsed).toHaveProperty('qualityMetrics')
    expect(parsed).toHaveProperty('learningEvents')
    expect(parsed.agents).toHaveLength(2)
  })

  it('should update mission progress', async () => {
    const mission = await engine.createMission({
      title: 'Progress Test',
      type: 'feature',
    })

    const result = await updateProgress(engine, {
      missionId: mission.id,
      status: 'executing',
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.status).toBe('executing')
    expect(parsed.startedAt).toBeDefined()
  })

  it('should list agents', async () => {
    const result = await listAgents(engine)
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toHaveProperty('id')
    expect(parsed[0]).toHaveProperty('role')
    expect(parsed[0]).toHaveProperty('status')
  })

  it('should list agents filtered by role', async () => {
    const result = await listAgents(engine, { role: 'engineer' })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].role).toBe('engineer')
  })

  it('should list missions', async () => {
    await engine.createMission({ title: 'Mission 1', type: 'feature' })
    await engine.createMission({ title: 'Mission 2', type: 'bugfix' })

    const result = await listMissions(engine)
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveLength(2)
  })

  it('should list missions with limit', async () => {
    await engine.createMission({ title: 'M1', type: 'feature' })
    await engine.createMission({ title: 'M2', type: 'feature' })
    await engine.createMission({ title: 'M3', type: 'feature' })

    const result = await listMissions(engine, { limit: 2 })
    const parsed = JSON.parse(result.content[0].text)

    expect(parsed).toHaveLength(2)
  })

  it('should evaluate governance', async () => {
    const result = await evaluateGovernance(engine, {
      action: 'create-feature',
      context: { type: 'feature' },
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('approved')
    expect(parsed).toHaveProperty('violations')
    expect(parsed).toHaveProperty('warnings')
  })

  it('should record a learning event', async () => {
    const result = await recordLearning(engine, {
      type: 'observation',
      source: 'test',
      data: { message: 'test observation' },
      confidence: 0.8,
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.type).toBe('observation')
    expect(parsed.source).toBe('test')
    expect(parsed.confidence).toBe(0.8)
    expect(parsed.id).toBeDefined()
  })

  it('should run audit pipeline', async () => {
    const result = await runAudit({
      projectPath: '/tmp/test-project',
    })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toHaveProperty('id')
    expect(parsed).toHaveProperty('overall')
    expect(parsed).toHaveProperty('score')
    expect(parsed).toHaveProperty('stages')
    expect(parsed.stages.length).toBeGreaterThan(0)
  })

  it('should list resources via MCP client', async () => {
    const server = createTestServer(engine)
    const client = await createConnectedClient(server)

    const result = await client.listResources()

    expect(result.resources).toHaveLength(5)
    expect(result.resources.map((r) => r.uri)).toContain('behavioros://missions')
    expect(result.resources.map((r) => r.uri)).toContain('behavioros://agents')
    expect(result.resources.map((r) => r.uri)).toContain('behavioros://audit-log')
    expect(result.resources.map((r) => r.uri)).toContain('behavioros://quality-metrics')
    expect(result.resources.map((r) => r.uri)).toContain('behavioros://learning-events')

    await client.close()
    await server.close()
  })

  it('should read missions resource', async () => {
    await engine.createMission({ title: 'Resource Test', type: 'feature' })

    const server = createTestServer(engine)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    const client = new Client({ name: 'test-client', version: '0.1.0' })
    await client.connect(clientTransport)

    const result = await client.readResource({ uri: 'behavioros://missions' })
    const missions = JSON.parse(result.contents[0].text!)

    expect(missions).toHaveLength(1)
    expect(missions[0].title).toBe('Resource Test')

    await client.close()
    await server.close()
  })

  it('should complete full mission lifecycle via tools', async () => {
    const createResult = await createMission(engine, {
      title: 'Lifecycle Test',
      type: 'feature',
      priority: 'critical',
    })
    const mission = JSON.parse(createResult.content[0].text)

    const startResult = await updateProgress(engine, {
      missionId: mission.id,
      status: 'executing',
    })
    const started = JSON.parse(startResult.content[0].text)
    expect(started.status).toBe('executing')

    const completeResult = await updateProgress(engine, {
      missionId: mission.id,
      status: 'completed',
      notes: 'Done successfully',
    })
    const completed = JSON.parse(completeResult.content[0].text)
    expect(completed.status).toBe('completed')
    expect(completed.output).toEqual({ notes: 'Done successfully' })
  })
})
