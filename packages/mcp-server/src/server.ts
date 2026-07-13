import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { BehaviorOSEngine, DNALoader } from '@behavioros/core'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerResources } from './resources.js'
import { createMission, createMissionInput } from './tools/create-mission.js'
import { getStatus } from './tools/get-status.js'
import {
  updateProgress,
  updateProgressInput,
} from './tools/update-progress.js'
import { listAgents, listAgentsInput } from './tools/list-agents.js'
import { listMissions, listMissionsInput } from './tools/list-missions.js'
import {
  evaluateGovernance,
  evaluateGovernanceInput,
} from './tools/evaluate-governance.js'
import {
  recordLearning,
  recordLearningInput,
} from './tools/record-learning.js'
import { runAudit, runAuditInput } from './tools/run-audit.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let _engine: BehaviorOSEngine | null = null
let _server: McpServer | null = null

export function getEngine(): BehaviorOSEngine {
  if (!_engine) {
    throw new Error('Server not initialized. Call createServer() first.')
  }
  return _engine
}

export function getServer(): McpServer {
  if (!_server) {
    throw new Error('Server not initialized. Call createServer() first.')
  }
  return _server
}

export function createServer(): McpServer {
  if (_server) return _server

  // Load enterprise governance DNA
  const dnaPath = resolve(__dirname, '../../../dnas/enterprise-governance.yaml')
  const loader = new DNALoader({ basePath: process.cwd() })
  const dna = loader.load(dnaPath)

  // Initialize engine
  _engine = new BehaviorOSEngine({
    dna,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true },
    audit: { enabled: true },
  })

  // Create MCP server
  _server = new McpServer({
    name: 'behavioros',
    version: '0.1.0',
  })

  // Register tools
  _server.tool(
    'create-mission',
    'Create a new mission in BehaviorOS',
    createMissionInput.shape,
    async (args) => createMission(_engine!, args),
  )

  _server.tool(
    'get-status',
    'Get the current system status including missions, agents, and audit events',
    async () => getStatus(_engine!),
  )

  _server.tool(
    'update-progress',
    'Update the progress/status of a mission',
    updateProgressInput.shape,
    async (args) => updateProgress(_engine!, args),
  )

  _server.tool(
    'list-agents',
    'List all agents in the system',
    listAgentsInput.shape,
    async (args) => listAgents(_engine!, args),
  )

  _server.tool(
    'list-missions',
    'List missions with optional filtering',
    listMissionsInput.shape,
    async (args) => listMissions(_engine!, args),
  )

  _server.tool(
    'evaluate-governance',
    'Evaluate an action against governance rules',
    evaluateGovernanceInput.shape,
    async (args) => evaluateGovernance(_engine!, args),
  )

  _server.tool(
    'record-learning',
    'Record a learning event',
    recordLearningInput.shape,
    async (args) => recordLearning(_engine!, args),
  )

  _server.tool(
    'run-audit',
    'Run the audit pipeline on a project',
    runAuditInput.shape,
    async (args) => runAudit(args),
  )

  // Register resources
  registerResources(_server, _engine)

  return _server
}

// --- CLI entry point ---
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('server.js')
) {
  const server = createServer()
  const transport = new StdioServerTransport()
  server.connect(transport).catch((err) => {
    console.error('Failed to start MCP server:', err)
    process.exit(1)
  })
}
