import { BehaviorOSEngine, BehaviorSelector, AuditChain } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  registerResources,
  createMission,
  createMissionInput,
  evaluateGovernance,
  evaluateGovernanceInput,
  getStatus,
  listAgents,
  listAgentsInput,
  listMissions,
  listMissionsInput,
  recordLearning,
  recordLearningInput,
  runAudit,
  runAuditInput,
  updateProgress,
  updateProgressInput,
  bosSelectDna,
  bosSelectDnaInput,
  bosResolveTruth,
  bosResolveTruthInput,
  bosRunAudit,
  bosRunAuditInput,
} from '../../../../packages/mcp-server/dist/index.js';

export function createTestEngine(): BehaviorOSEngine {
  const testDNA: DNAPackage = {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    personas: [
      { role: 'engineer', authority: 'senior', name: 'Test Engineer' },
      { role: 'qa', authority: 'senior', name: 'Test QA' },
    ],
    governance: [],
    quality: [],
    patterns: [],
  } as any;

  return new BehaviorOSEngine({
    dna: testDNA,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true, autoApply: false },
    audit: { enabled: true },
  });
}

export function createTestServer(engine: BehaviorOSEngine): McpServer {
  const server = new McpServer({ name: 'behavioros-e2e-test', version: '0.1.0' });

  // Create BOS behavioral engines
  const bosSelector = new BehaviorSelector();
  const bosAuditChain = new AuditChain(process.cwd());

  // Core tools
  server.tool('create-mission', 'Create a new mission', createMissionInput.shape, async (args) =>
    createMission(engine, args),
  );
  server.tool('get-status', 'Get system status', async () => getStatus(engine));
  server.tool('update-progress', 'Update mission progress', updateProgressInput.shape, async (args) =>
    updateProgress(engine, args),
  );
  server.tool('list-agents', 'List agents', (listAgentsInput as any).shape, async (args: any) =>
    listAgents(engine, args),
  );
  server.tool('list-missions', 'List missions', (listMissionsInput as any).shape, async (args: any) =>
    listMissions(engine, args),
  );
  server.tool('evaluate-governance', 'Evaluate governance', evaluateGovernanceInput.shape, async (args) =>
    evaluateGovernance(engine, args),
  );
  server.tool('record-learning', 'Record learning event', recordLearningInput.shape, async (args) =>
    recordLearning(engine, args),
  );
  server.tool('run-audit', 'Run audit pipeline', runAuditInput.shape, async (args) => runAudit(args));

  // BOS behavioral tools
  server.tool('bos_select_dna', 'Select optimal DNA pattern', bosSelectDnaInput.shape, async (args) =>
    bosSelectDna(bosSelector, args),
  );
  server.tool('bos_resolve_truth', 'Resolve DNA + truth sources', bosResolveTruthInput.shape, async (args) =>
    bosResolveTruth(bosSelector, args),
  );
  server.tool('bos_run_audit', 'Run continuous audit chain', bosRunAuditInput.shape, async (args) =>
    bosRunAudit(bosAuditChain, args),
  );

  registerResources(server, engine as any);
  return server;
}

export async function createConnectedClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'e2e-client', version: '0.1.0' });
  await client.connect(clientTransport);
  return client;
}
