import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BehaviorOSEngine, DNALoader } from '@behavioros/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCICDResources } from './resources/cicd-resources.js';
import { registerResources } from './resources.js';
import {
  approveLayer,
  approveLayerInput,
  cicdRecordLearning,
  cicdRecordLearningInput,
  cicdRunAudit,
  cicdRunAuditInput,
  getAuditHistory,
  getAuditHistoryInput,
  getGateResults,
  getGateResultsInput,
  getLearningReport,
  getLearningReportInput,
  getPipelineReport,
  getPipelineReportInput,
  getPipelineStatus,
  getPipelineStatusInput,
  setEngine as setCICDEngine,
  startPipeline,
  startPipelineInput,
  validateLayer,
  validateLayerInput,
} from './tools/cicd-tools.js';
import { createMission, createMissionInput } from './tools/create-mission.js';
import { evaluateGovernance, evaluateGovernanceInput } from './tools/evaluate-governance.js';
import { getStatus } from './tools/get-status.js';
import {
  checkFraud,
  checkFraudInput,
  deployCanary,
  deployCanaryInput,
  getObservabilityMetrics,
  getObservabilityMetricsInput,
  getTrustScore,
  getTrustScoreInput,
  reconcilePayments,
  reconcilePaymentsInput,
  rollbackDeployment,
  rollbackDeploymentInput,
  runCompliance,
  runComplianceInput,
  setIntegrationEngine,
  syncBrocolisOrders,
  syncBrocolisOrdersInput,
  validatePayment,
  validatePaymentInput,
} from './tools/integration-tools.js';
import { listAgents, listAgentsInput } from './tools/list-agents.js';
import { listMissions, listMissionsInput } from './tools/list-missions.js';
import { recordLearning, recordLearningInput } from './tools/record-learning.js';
import { runAudit, runAuditInput } from './tools/run-audit.js';
import { updateProgress, updateProgressInput } from './tools/update-progress.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _engine: BehaviorOSEngine | null = null;
let _server: McpServer | null = null;

export function getEngine(): BehaviorOSEngine {
  if (!_engine) {
    throw new Error('Server not initialized. Call createServer() first.');
  }
  return _engine;
}

export function getServer(): McpServer {
  if (!_server) {
    throw new Error('Server not initialized. Call createServer() first.');
  }
  return _server;
}

export function createServer(): McpServer {
  if (_server) return _server;

  // Load enterprise governance DNA
  const dnaPath = resolve(__dirname, '../../../dnas/enterprise-governance.yaml');
  const loader = new DNALoader({ basePath: process.cwd() });
  const dna = loader.load(dnaPath);

  // Initialize engine
  _engine = new BehaviorOSEngine({
    dna,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true },
    audit: { enabled: true },
  });

  // Create MCP server
  _server = new McpServer({
    name: 'behavioros',
    version: '0.1.0',
  });

  // Register tools
  _server.tool(
    'create-mission',
    'Create a new mission in BehaviorOS',
    createMissionInput.shape,
    async (args) => createMission(_engine!, args),
  );

  _server.tool(
    'get-status',
    'Get the current system status including missions, agents, and audit events',
    async () => getStatus(_engine!),
  );

  _server.tool(
    'update-progress',
    'Update the progress/status of a mission',
    updateProgressInput.shape,
    async (args) => updateProgress(_engine!, args),
  );

  _server.tool(
    'list-agents',
    'List all agents in the system',
    listAgentsInput.shape,
    async (args) => listAgents(_engine!, args),
  );

  _server.tool(
    'list-missions',
    'List missions with optional filtering',
    listMissionsInput.shape,
    async (args) => listMissions(_engine!, args),
  );

  _server.tool(
    'evaluate-governance',
    'Evaluate an action against governance rules',
    evaluateGovernanceInput.shape,
    async (args) => evaluateGovernance(_engine!, args),
  );

  _server.tool(
    'record-learning',
    'Record a learning event',
    recordLearningInput.shape,
    async (args) => recordLearning(_engine!, args),
  );

  _server.tool(
    'run-audit',
    'Run the audit pipeline on a project',
    runAuditInput.shape,
    async (args) => runAudit(args),
  );

  // Register CI/CD engine references
  setCICDEngine(_engine);
  setIntegrationEngine(_engine);

  // Register CI/CD tools
  _server.tool(
    'start-pipeline',
    'Start an EAARG pipeline for a project (brocolis/finpay)',
    startPipelineInput.shape,
    async (args) => startPipeline(args),
  );

  _server.tool(
    'get-pipeline-status',
    'Get current pipeline status and progress',
    getPipelineStatusInput.shape,
    async (args) => getPipelineStatus(args),
  );

  _server.tool(
    'validate-layer',
    'Validate a specific layer with evidence',
    validateLayerInput.shape,
    async (args) => validateLayer(args),
  );

  _server.tool(
    'get-pipeline-report',
    'Get full pipeline report with gate results',
    getPipelineReportInput.shape,
    async (args) => getPipelineReport(args),
  );

  _server.tool(
    'approve-layer',
    'Approve a layer after manual review',
    approveLayerInput.shape,
    async (args) => approveLayer(args),
  );

  _server.tool(
    'get-gate-results',
    'Get gate check results for a layer',
    getGateResultsInput.shape,
    async (args) => getGateResults(args),
  );

  _server.tool(
    'cicd-run-audit',
    'Run the BehaviorOS audit pipeline (lint, typecheck, security, coverage)',
    cicdRunAuditInput.shape,
    async (args) => cicdRunAudit(args),
  );

  _server.tool(
    'cicd-get-audit-history',
    'Get historical audit results from CI/CD pipelines',
    getAuditHistoryInput.shape,
    async (args) => getAuditHistory(args),
  );

  _server.tool(
    'cicd-record-learning',
    'Record a learning event from CI/CD pipeline',
    cicdRecordLearningInput.shape,
    async (args) => cicdRecordLearning(args),
  );

  _server.tool(
    'cicd-get-learning-report',
    'Get learning recommendations from CI/CD events',
    getLearningReportInput.shape,
    async (args) => getLearningReport(args),
  );

  // Register integration tools
  _server.tool(
    'sync-brocolis-orders',
    'Sync Brocolis orders with FinPay payments',
    syncBrocolisOrdersInput.shape,
    async (args) => syncBrocolisOrders(args),
  );

  _server.tool(
    'validate-payment',
    'Validate a payment through FinPay pipeline',
    validatePaymentInput.shape,
    async (args) => validatePayment(args),
  );

  _server.tool(
    'get-trust-score',
    'Get trust score for a payment',
    getTrustScoreInput.shape,
    async (args) => getTrustScore(args),
  );

  _server.tool(
    'check-fraud',
    'Check for fraud signals in a payment',
    checkFraudInput.shape,
    async (args) => checkFraud(args),
  );

  _server.tool(
    'run-compliance',
    'Run compliance check (payment, data, audit)',
    runComplianceInput.shape,
    async (args) => runCompliance(args),
  );

  _server.tool(
    'reconcile-payments',
    'Reconcile payment ledger between Brocolis and FinPay',
    reconcilePaymentsInput.shape,
    async (args) => reconcilePayments(args),
  );

  _server.tool(
    'get-observability-metrics',
    'Get unified metrics from Brocolis, FinPay, and BehaviorOS',
    getObservabilityMetricsInput.shape,
    async (args) => getObservabilityMetrics(args),
  );

  _server.tool(
    'deploy-canary',
    'Deploy canary version with BehaviorOS quality gates',
    deployCanaryInput.shape,
    async (args) => deployCanary(args),
  );

  _server.tool(
    'rollback-deployment',
    'Rollback deployment if quality gates fail',
    rollbackDeploymentInput.shape,
    async (args) => rollbackDeployment(args),
  );

  // Register resources
  registerResources(_server, _engine);
  registerCICDResources(_server, _engine);

  return _server;
}

// --- CLI entry point ---
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('server.js')) {
  const server = createServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
}
