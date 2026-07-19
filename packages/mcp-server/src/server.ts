import { resolve } from 'node:path';
import {
  AuditChain,
  BehaviorOSEngine,
  BehaviorSelector,
  BosLearningEngine,
  ConflictResolver,
  DelegationEnforcementLayer,
  DNALoader,
  EscalationManager,
} from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCICDResources } from './resources/cicd-resources.js';
import { registerResources } from './resources.js';
import { bosCheckEscalation, bosCheckEscalationInput } from './tools/bos-check-escalation.js';
import { bosGetInsights, bosGetInsightsInput } from './tools/bos-get-insights.js';
import { bosListPatterns, bosListPatternsInput } from './tools/bos-list-patterns.js';
import { bosLspDiagnostics, bosLspDiagnosticsInput } from './tools/bos-lsp-diagnostics.js';
import { bosLspValidate, bosLspValidateInput } from './tools/bos-lsp-validate.js';
import { bosResolveConflict, bosResolveConflictInput } from './tools/bos-resolve-conflict.js';
import { bosResolveTruth, bosResolveTruthInput } from './tools/bos-resolve-truth.js';
import { bosRunAudit, bosRunAuditInput } from './tools/bos-run-audit.js';
// BOS Behavioral Tools
import { bosSelectDna, bosSelectDnaInput } from './tools/bos-select-dna.js';
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

// Safe __dirname — works in both CJS and ESM
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const _globalDirname = typeof __dirname !== 'undefined' ? __dirname : undefined;
const __dirname_safe = _globalDirname ?? resolve(process.cwd());

let _engine: BehaviorOSEngine | null = null;
let _server: McpServer | null = null;
let _delegationLayer: DelegationEnforcementLayer | null = null;

function getAgentId(): string {
  return process.env.BEHAVIOROS_AGENT_ID ?? 'unknown';
}

/**
 * Tools that are part of the delegation workflow itself — never blocked.
 * The orchestrator MUST call these to delegate properly.
 */
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
]);

/**
 * Wrapper that checks delegation enforcement before executing action tools.
 * Only blocks orchestrator agents that attempt direct execution without delegation.
 * Workflow tools (create-mission, bos_select_dna, etc.) are always allowed.
 */
async function withDelegationCheck<T>(toolName: string, fn: () => Promise<T>): Promise<T> {
  if (_delegationLayer && !DELEGATION_WORKFLOW_TOOLS.has(toolName)) {
    const agentId = getAgentId();
    const context = {
      id: crypto.randomUUID(),
      dnaId: '',
      dnaMode: 'transactional' as const,
      agentId,
      agentAuthority: 'lead',
      action: 'execute',
      payload: {},
      metadata: new Map<string, unknown>(),
      startTime: Date.now(),
      layerResults: [],
      currentLayerIndex: 0,
      failed: false,
    };

    const result = await _delegationLayer.execute(context);
    if (!result.passed) {
      const details = result.details as { reason?: string; requiredActions?: string[] };
      throw new Error(
        `Delegation enforcement failed: ${details.reason}\n` +
          `Required actions: ${details.requiredActions?.join(', ')}`,
      );
    }
  }
  return fn();
}

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

export async function createServer(): Promise<McpServer> {
  if (_server) return _server;

  // Load enterprise governance DNA
  // Try multiple paths: env var, relative to cwd, relative to __dirname
  const dnaEnvPath = process.env.BEHAVIOROS_DNA_PATH;
  let dnaPath: string;

  if (dnaEnvPath?.endsWith('.yaml')) {
    dnaPath = resolve(process.cwd(), dnaEnvPath);
  } else if (dnaEnvPath) {
    // Directory — look for enterprise-governance.yaml inside
    dnaPath = resolve(process.cwd(), dnaEnvPath, 'enterprise-governance.yaml');
  } else {
    dnaPath = resolve(process.cwd(), 'dnas/enterprise-governance.yaml');
  }

  const loader = new DNALoader({ basePath: process.cwd() });
  let dna: DNAPackage;
  try {
    dna = await loader.load(dnaPath);
  } catch {
    console.warn(`[behavioros] DNA file not found at ${dnaPath}. Using built-in fallback.`);
    const fallbackPath = resolve(process.cwd(), 'dnas/enterprise-governance.yaml');
    try {
      dna = await loader.load(fallbackPath);
    } catch {
      console.warn(`[behavioros] Fallback DNA also not found. Initializing with minimal config.`);
      throw new Error(
        `Failed to load DNA from ${dnaPath} and fallback ${fallbackPath}. ` +
          'Set BEHAVIOROS_DNA_PATH or place enterprise-governance.yaml in the dnas/ directory.',
      );
    }
  }

  // Initialize engine
  _engine = new BehaviorOSEngine({
    dna,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true, autoApply: false },
    audit: { enabled: true },
  });

  // Initialize delegation enforcement layer
  _delegationLayer = new DelegationEnforcementLayer();

  // Create MCP server
  _server = new McpServer({
    name: 'behavioros',
    version: '0.1.0',
  });

  // Register tools — action tools wrapped with delegation check, read-only tools pass through
  _server.tool(
    'create-mission',
    'Create a new mission in BehaviorOS',
    createMissionInput.shape,
    async (args) => withDelegationCheck('create-mission', () => createMission(_engine!, args)),
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
    async (args) => withDelegationCheck('update-progress', () => updateProgress(_engine!, args)),
  );

  _server.tool(
    'list-agents',
    'List all agents in the system',
    (listAgentsInput as any).shape,
    async (args: any) => listAgents(_engine!, args),
  );

  _server.tool(
    'list-missions',
    'List missions with optional filtering',
    (listMissionsInput as any).shape,
    async (args: any) => listMissions(_engine!, args),
  );

  _server.tool(
    'evaluate-governance',
    'Evaluate an action against governance rules',
    evaluateGovernanceInput.shape,
    async (args) =>
      withDelegationCheck('evaluate-governance', () => evaluateGovernance(_engine!, args)),
  );

  _server.tool(
    'record-learning',
    'Record a learning event',
    recordLearningInput.shape,
    async (args) => withDelegationCheck('record-learning', () => recordLearning(_engine!, args)),
  );

  _server.tool(
    'run-audit',
    'Run the audit pipeline on a project',
    runAuditInput.shape,
    async (args) => withDelegationCheck('run-audit', () => runAudit(args)),
  );

  // Register CI/CD engine references
  setCICDEngine(_engine);
  setIntegrationEngine(_engine);

  // Initialize BOS behavioral engines
  const bosProjectRoot = process.cwd();
  const bosSelector = new BehaviorSelector(resolve(bosProjectRoot, 'packages/dnas/catalog'));
  const bosConflictResolver = new ConflictResolver();
  const bosEscalationManager = new EscalationManager();
  if (dna.governance) {
    bosEscalationManager.loadGovernanceRules(dna.governance);
  }
  const bosAuditChain = new AuditChain(bosProjectRoot);
  const bosLearningEngine = new BosLearningEngine();

  // Register BOS Behavioral tools
  _server.tool(
    'bos_select_dna',
    'Select the optimal behavioral DNA pattern for a given task context. Returns pattern name, principles, forbidden rules, and confidence score.',
    bosSelectDnaInput.shape,
    async (args) => bosSelectDna(bosSelector, args),
  );

  _server.tool(
    'bos_resolve_conflict',
    'Resolve a conflict between two agents or squads. Returns resolution strategy and explanation.',
    bosResolveConflictInput.shape,
    async (args) => bosResolveConflict(bosConflictResolver, args),
  );

  _server.tool(
    'bos_check_escalation',
    'Check if a situation should be escalated to human oversight. Returns shouldEscalate, trigger, and reasoning.',
    bosCheckEscalationInput.shape,
    async (args) => bosCheckEscalation(bosEscalationManager, args),
  );

  _server.tool(
    'bos_run_audit',
    'Run the continuous audit chain for a given trigger (commit, PR, merge, staging, production). Returns gate results.',
    bosRunAuditInput.shape,
    async (args) => withDelegationCheck('bos_run_audit', () => bosRunAudit(bosAuditChain, args)),
  );

  _server.tool(
    'bos_get_insights',
    'Get behavioral pattern insights — which patterns are working, which need mutation, overall system health.',
    bosGetInsightsInput.shape,
    async () => bosGetInsights(bosLearningEngine),
  );

  _server.tool(
    'bos_list_patterns',
    'List all available behavioral DNA patterns in the catalog with their key properties.',
    bosListPatternsInput.shape,
    async () => bosListPatterns(bosSelector),
  );

  // Register BOS + Context7 Truth Source Integration
  _server.tool(
    'bos_resolve_truth',
    'Resolve behavioral DNA pattern + truth sources (context7 docs) for a task. Returns DNA pattern, principles, and instructions to fetch up-to-date library documentation. Use this before every delegation to ensure agents act with correct DNA and current docs.',
    bosResolveTruthInput.shape,
    async (args) => bosResolveTruth(bosSelector, args),
  );

  // Register BOS LSP tools
  _server.tool(
    'bos_lsp_diagnostics',
    'Run LSP diagnostics (TypeScript + ESLint) on a project and return structured results. Use for real-time feedback on code quality.',
    bosLspDiagnosticsInput.shape,
    async (args) => bosLspDiagnostics(args),
  );

  _server.tool(
    'bos_lsp_validate',
    'Validate a project passes LSP diagnostics (quality gate). Returns pass/fail with error/warning counts.',
    bosLspValidateInput.shape,
    async (args) => bosLspValidate(args),
  );

  // Register CI/CD tools
  _server.tool(
    'start-pipeline',
    'Start an EAARG pipeline for a project (brocolis/finpay)',
    startPipelineInput.shape,
    async (args) => withDelegationCheck('start-pipeline', () => startPipeline(args)),
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
    async (args) => withDelegationCheck('approve-layer', () => approveLayer(args)),
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
    async (args) => withDelegationCheck('cicd-run-audit', () => cicdRunAudit(args)),
  );

  _server.tool(
    'cicd-get-audit-history',
    'Get historical audit results from CI/CD pipelines',
    (getAuditHistoryInput as any).shape,
    async (args: any) => getAuditHistory(args),
  );

  _server.tool(
    'cicd-record-learning',
    'Record a learning event from CI/CD pipeline',
    cicdRecordLearningInput.shape,
    async (args) => withDelegationCheck('cicd-record-learning', () => cicdRecordLearning(args)),
  );

  _server.tool(
    'cicd-get-learning-report',
    'Get learning recommendations from CI/CD events',
    (getLearningReportInput as any).shape,
    async (args: any) => getLearningReport(args),
  );

  // Register integration tools
  _server.tool(
    'sync-brocolis-orders',
    'Sync Brocolis orders with FinPay payments',
    syncBrocolisOrdersInput.shape,
    async (args) => withDelegationCheck('sync-brocolis-orders', () => syncBrocolisOrders(args)),
  );

  _server.tool(
    'validate-payment',
    'Validate a payment through FinPay pipeline',
    validatePaymentInput.shape,
    async (args) => withDelegationCheck('validate-payment', () => validatePayment(args)),
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
    (getObservabilityMetricsInput as any).shape,
    async (args: any) => getObservabilityMetrics(args),
  );

  _server.tool(
    'deploy-canary',
    'Deploy canary version with BehaviorOS quality gates',
    deployCanaryInput.shape,
    async (args) => withDelegationCheck('deploy-canary', () => deployCanary(args)),
  );

  _server.tool(
    'rollback-deployment',
    'Rollback deployment if quality gates fail',
    rollbackDeploymentInput.shape,
    async (args) => withDelegationCheck('rollback-deployment', () => rollbackDeployment(args)),
  );

  // Register resources
  registerResources(_server, _engine);
  registerCICDResources(_server, _engine);

  return _server;
}

// --- CLI entry point ---
// Detect if this file is being executed directly (not imported)
const _argv1 = process.argv[1] ?? '';
const _isDirectExec =
  _argv1.endsWith('/server.js') ||
  _argv1.endsWith('/server.mjs') ||
  _argv1.endsWith('\\server.js') ||
  _argv1.endsWith('\\server.mjs');

if (_isDirectExec || process.env.BEHAVIOROS_MCP_AUTO_START === 'true') {
  createServer()
    .then(async (server) => {
      const transport = new StdioServerTransport();
      process.on('SIGINT', async () => {
        await server.close();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await server.close();
        process.exit(0);
      });

      await server.connect(transport);
    })
    .catch((err) => {
      console.error('Failed to start MCP server:', err);
      process.exit(1);
    });
}
