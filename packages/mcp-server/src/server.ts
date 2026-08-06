import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AuditChain,
  AuditChainVerifier,
  BehaviorOSEngine,
  BehaviorSelector,
  BosLearningEngine,
  ConflictResolver,
  DNALoader,
  EscalationManager,
  ProtocolStateTracker,
} from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadOrCreateAuditChain, persistAuditChain } from './audit-chain-store.js';
import type { ToolHandler } from './http-bridge.js';
import { HttpBridge } from './http-bridge.js';
import { EnforcementMiddleware } from './middleware/enforcement-middleware.js';
import { registerCICDResources } from './resources/cicd-resources.js';
import { registerResources } from './resources.js';
import { saveLearning, saveMissions } from './store/json-store.js';
import { bosAgentHandoff, bosAgentHandoffInput } from './tools/bos-agent-handoff.js';
import { bosAutonomousTask, bosAutonomousTaskInput } from './tools/bos-autonomous-task.js';
import { bosCheckEscalation, bosCheckEscalationInput } from './tools/bos-check-escalation.js';
import {
  handleComplianceGenerate,
  handleComplianceGet,
  handleComplianceList,
  handleComplianceSummary,
} from './tools/bos-compliance.js';
import { bosEcosystemDoctor, bosEcosystemDoctorInput } from './tools/bos-ecosystem-doctor.js';
import { bosEcosystemInstall, bosEcosystemInstallInput } from './tools/bos-ecosystem-install.js';
import { bosEcosystemStatus, bosEcosystemStatusInput } from './tools/bos-ecosystem-status.js';
import {
  bosEventQuery,
  bosEventQueryInput,
  bosEventReplay,
  bosEventReplayInput,
  bosEventStats,
  bosEventStatsInput,
} from './tools/bos-event-query.js';
import { bosGetInsights, bosGetInsightsInput } from './tools/bos-get-insights.js';
import { bosListPatterns, bosListPatternsInput } from './tools/bos-list-patterns.js';
import { bosLspDiagnostics, bosLspDiagnosticsInput } from './tools/bos-lsp-diagnostics.js';
import { bosLspValidate, bosLspValidateInput } from './tools/bos-lsp-validate.js';
import {
  bosAgentMetrics,
  bosAgentMetricsInput,
  bosPipelineMetrics,
  bosPipelineMetricsInput,
  bosSystemHealth,
  bosSystemHealthInput,
  setObservabilityEngine,
} from './tools/bos-observability.js';
import { bosResetProtocol, bosResetProtocolInput } from './tools/bos-reset-protocol.js';
import { bosResolveConflict, bosResolveConflictInput } from './tools/bos-resolve-conflict.js';
import { bosResolveTruth, bosResolveTruthInput } from './tools/bos-resolve-truth.js';
import { bosRunAudit, bosRunAuditInput } from './tools/bos-run-audit.js';
// BOS Behavioral Tools
import { bosSelectDna, bosSelectDnaInput } from './tools/bos-select-dna.js';
import { bosSkillsList, bosSkillsListInput } from './tools/bos-skills-list.js';
import { bosSkillsValidate, bosSkillsValidateInput } from './tools/bos-skills-validate.js';
import { bosTelemetrySummary } from './tools/bos-telemetry-summary.js';
import { bosValidateProtocol, bosValidateProtocolInput } from './tools/bos-validate-protocol.js';
import { bosVerifyAuditChain, bosVerifyAuditChainInput } from './tools/bos-verify-audit-chain.js';
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
let _protocolTracker: ProtocolStateTracker | null = null;
let _enforcementMiddleware: EnforcementMiddleware | null = null;
let _bosSelector: BehaviorSelector | null = null;
let _bosConflictResolver: ConflictResolver | null = null;
let _bosEscalationManager: EscalationManager | null = null;
let _bosAuditChain: AuditChain | null = null;
let _bosAuditChainVerifier: AuditChainVerifier | null = null;
let _bosLearningEngine: BosLearningEngine | null = null;

function _getAgentId(): string {
  return process.env.BEHAVIOROS_AGENT_ID ?? 'unknown';
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
      console.warn(
        `[behavioros] Fallback DNA also not found. Initializing with minimal in-memory DNA for PoV.`,
      );
      // Minimal DNA fallback for proof-of-value runs. This avoids requiring external files
      // and allows the MCP server to start with a safe, minimal governance configuration.
      dna = {
        name: 'enterprise-governance-fallback',
        version: '0.0.0-pov',
        patterns: [],
        personas: [],
        governance: [],
        quality: [],
        metadata: {},
      } as any;
    }
  }

  // Initialize engine
  // Ensure persist directory exists for learning/persistence during PoV runs
  const defaultPersistDir = resolve(process.cwd(), 'generated/mcp');
  try {
    await mkdir(defaultPersistDir, { recursive: true });
  } catch (_e) {
    // ignore mkdir errors; engine will report if persist fails
  }

  _engine = new BehaviorOSEngine({
    dna,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: {
      enabled: true,
      autoApply: false,
      persistPath: resolve(defaultPersistDir, 'learning.json'),
    },
    audit: { enabled: true },
    telemetry: {
      enabled: process.env.BEHAVIOROS_TELEMETRY_ENABLED === 'true',
      webhookUrl: process.env.BEHAVIOROS_TELEMETRY_WEBHOOK_URL,
      exportIntervalMs: process.env.BEHAVIOROS_TELEMETRY_INTERVAL_MS
        ? Number(process.env.BEHAVIOROS_TELEMETRY_INTERVAL_MS)
        : undefined,
    },
  });

  // Sync each persona's DNA-authored skills into the SkillEngine, then alias them onto the
  // actual generated agent ids (AgentManager creates ids like "agent-orchestrator-<uuid>",
  // not "orchestrator") — without this, bos-skills-validate/bos-agent-handoff always report
  // every agent as missing every skill, even skills its own DNA persona explicitly grants it.
  await _engine.skillEngine.syncFromDNA(dna);
  for (const agent of _engine.getAllAgents()) {
    _engine.skillEngine.assignPersonaSkillsToAgent(agent.id, agent.role);
  }

  // Initialize protocol state tracker for the 7-step delegation protocol
  _protocolTracker = new ProtocolStateTracker();

  // Initialize enforcement middleware (auto-loads from .agent_state.json)
  _enforcementMiddleware = new EnforcementMiddleware(
    _protocolTracker,
    _engine,
    process.env.BEHAVIOROS_ENFORCEMENT_LEVEL as any,
  );

  // Create MCP server
  _server = new McpServer({
    name: 'behavioros',
    version: '1.1.4',
  });

  // Register tools — each tool declares its own enforcement requirements
  _server.tool(
    'create-mission',
    'Create a new mission in BehaviorOS',
    createMissionInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth'],
        evaluateGovernance: false,
        toolName: 'create-mission',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      const result = await createMission(_engine!, args);
      try {
        await saveMissions(defaultPersistDir, _engine!.getAllMissions());
      } catch (e) {
        // non-fatal for PoV
        console.warn('Failed to persist missions for PoV:', e instanceof Error ? e.message : e);
      }
      _protocolTracker?.markMissionCreated();
      _enforcementMiddleware?.persist();
      return result;
    },
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
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'update-progress',
        toolName: 'update-progress',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      if (_protocolTracker && args.status === 'completed') {
        const validation = _protocolTracker.validateBeforeComplete();
        if (!validation.valid) {
          throw new Error(validation.message);
        }
      }
      return updateProgress(_engine!, args);
    },
  );

  _server.tool(
    'list-agents',
    'List all agents in the system',
    // listAgentsInput is `z.object({...}).optional()` — `.shape` doesn't exist on a
    // ZodOptional wrapper (it's `undefined`), which silently confused the MCP SDK's
    // overload resolution and dropped the real handler, crashing every call to this
    // tool with "Cannot use 'in' operator to search for 'createTask' in undefined".
    // .unwrap() gets back to the underlying ZodObject, which does have .shape.
    listAgentsInput.unwrap().shape,
    async (args: any) => listAgents(_engine!, args),
  );

  _server.tool(
    'list-missions',
    'List missions with optional filtering',
    listMissionsInput.unwrap().shape,
    async (args: any) => listMissions(_engine!, args),
  );

  _server.tool(
    'evaluate-governance',
    'Evaluate an action against governance rules',
    evaluateGovernanceInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'evaluate-governance',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return evaluateGovernance(_engine!, args);
    },
  );

  _server.tool(
    'record-learning',
    'Record a learning event',
    recordLearningInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission', 'audit'],
        evaluateGovernance: false,
        toolName: 'record-learning',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      const result = await recordLearning(_engine!, args);
      try {
        await saveLearning(defaultPersistDir, _engine!.getLearningEvents());
      } catch (e) {
        console.warn(
          'Failed to persist learning events for PoV:',
          e instanceof Error ? e.message : e,
        );
      }
      _protocolTracker?.markLearningRecorded();
      _enforcementMiddleware?.persist();
      return result;
    },
  );

  _server.tool(
    'run-audit',
    'Run the audit pipeline on a project',
    runAuditInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'run-audit',
        toolName: 'run-audit',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return runAudit(args);
    },
  );

  // Register CI/CD engine references
  setCICDEngine(_engine);

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
  const { chain: bosAuditHashChain, filePath: auditChainFilePath } =
    loadOrCreateAuditChain(defaultPersistDir);
  const bosAuditChainVerifier = new AuditChainVerifier(bosAuditHashChain);

  _bosSelector = bosSelector;
  _bosConflictResolver = bosConflictResolver;
  _bosEscalationManager = bosEscalationManager;
  _bosAuditChain = bosAuditChain;
  _bosAuditChainVerifier = bosAuditChainVerifier;
  _bosLearningEngine = bosLearningEngine;

  // Live verification found bosLearningEngine.record() was never called anywhere — the DNA
  // pattern performance meta-learning behind bos_get_insights ("which patterns are working,
  // which need mutation") had no data source at all, so it always returned zero insights
  // regardless of real usage. Wire it to the mission lifecycle so every mission's outcome
  // feeds it automatically, no separate tool call required. `quality` is a coarse 1/0
  // success heuristic, not a real quality-gate score — BosLearningEngine.analyze() only needs
  // a directional signal (reinforce/mutate/abandon), not a precise metric.
  _engine.on('mission:completed', (mission) => {
    const durationMs =
      mission.startedAt && mission.completedAt
        ? new Date(mission.completedAt).getTime() - new Date(mission.startedAt).getTime()
        : 0;
    bosLearningEngine
      .record({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        dna: dna.name,
        task: mission.type,
        agent: mission.assignees?.[0] ?? 'unknown',
        success: true,
        duration: Math.max(0, durationMs),
        quality: 1,
      })
      .catch(() => {
        // Non-fatal: mission completion must not fail because meta-learning couldn't record.
      });
  });
  _engine.on('mission:failed', (mission) => {
    const durationMs =
      mission.startedAt && mission.completedAt
        ? new Date(mission.completedAt).getTime() - new Date(mission.startedAt).getTime()
        : 0;
    bosLearningEngine
      .record({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        dna: dna.name,
        task: mission.type,
        agent: mission.assignees?.[0] ?? 'unknown',
        success: false,
        duration: Math.max(0, durationMs),
        quality: 0,
      })
      .catch(() => {
        // Non-fatal
      });
  });

  // Register BOS Behavioral tools
  _server.tool(
    'bos_select_dna',
    'Select the optimal behavioral DNA pattern for a given task context. Returns pattern name, principles, forbidden rules, and confidence score.',
    bosSelectDnaInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_select_dna',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      _protocolTracker?.markDnaSelected();
      if (args.role) _enforcementMiddleware?.setActiveRole(args.role);
      _enforcementMiddleware?.persist();
      return bosSelectDna(bosSelector, args);
    },
  );

  _server.tool(
    'bos_resolve_conflict',
    'Resolve a conflict between two agents or squads. Returns resolution strategy and explanation.',
    bosResolveConflictInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_resolve_conflict',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosResolveConflict(bosConflictResolver, args);
    },
  );

  _server.tool(
    'bos_check_escalation',
    'Check if a situation should be escalated to human oversight. Returns shouldEscalate, trigger, and reasoning.',
    bosCheckEscalationInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_check_escalation',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosCheckEscalation(bosEscalationManager, args);
    },
  );

  _server.tool(
    'bos_run_audit',
    'Run the continuous audit chain for a given trigger (commit, PR, merge, staging, production). Returns gate results.',
    bosRunAuditInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'bos_run_audit',
        toolName: 'bos_run_audit',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      const result = await bosRunAudit(bosAuditChain, args, bosAuditHashChain, _getAgentId());
      persistAuditChain(bosAuditHashChain, auditChainFilePath);
      _protocolTracker?.markAuditDone();
      _enforcementMiddleware?.persist();
      return result;
    },
  );

  _server.tool(
    'bos_verify_audit_chain',
    'Verify the tamper-evident hash chain of past bos_run_audit results. Detects broken links or altered entries.',
    bosVerifyAuditChainInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_verify_audit_chain',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosVerifyAuditChain(bosAuditChainVerifier, args);
    },
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

  // Register Autonomous Task Tool
  _server.tool(
    'bos-autonomous-task',
    'Process a task autonomously: select DNA, resolve truth, create mission, delegate, audit. Returns completed task result.',
    bosAutonomousTaskInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: true,
        governanceAction: 'bos-autonomous-task',
        toolName: 'bos-autonomous-task',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      _protocolTracker?.markDnaSelected();
      _protocolTracker?.markTruthResolved();
      _protocolTracker?.markMissionCreated();
      _enforcementMiddleware?.persist();
      return bosAutonomousTask(_engine!.autonomousOrchestrator, args);
    },
  );

  // Register Ghost Tools (bos_validate_protocol + bos_reset_protocol)
  _server.tool(
    'bos_validate_protocol',
    'Validate current protocol compliance status. Returns steps completed, missing steps, and any order violations.',
    bosValidateProtocolInput.shape,
    async (_args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_validate_protocol',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosValidateProtocol(_protocolTracker!);
    },
  );

  _server.tool(
    'bos_reset_protocol',
    'Reset protocol state to defaults. Requires confirm=true. Recovery use only.',
    bosResetProtocolInput.shape,
    async (args: any) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_reset_protocol',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      const result = await bosResetProtocol(_protocolTracker!, args);
      if (args.confirm) {
        _enforcementMiddleware!.clearTamperFlag();
        _enforcementMiddleware!.setActiveRole(undefined);
      }
      _enforcementMiddleware!.persist();
      return result;
    },
  );

  // Register BOS + Context7 Truth Source Integration
  _server.tool(
    'bos_resolve_truth',
    'Resolve behavioral DNA pattern + truth sources (context7 docs) for a task. Returns DNA pattern, principles, and instructions to fetch up-to-date library documentation. Use this before every delegation to ensure agents act with correct DNA and current docs.',
    bosResolveTruthInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos_resolve_truth',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);

      // Mock adapters mode: return canned truth for PoV and offline runs
      if (process.env.BEHAVIOROS_MOCK_ADAPTERS === 'true') {
        _protocolTracker?.markTruthResolved();
        _enforcementMiddleware?.persist();
        return {
          pattern: dna.name ?? 'enterprise-governance-fallback',
          confidence: 90,
          principles: ['poV-mode', 'mock-adapters'],
          docs: [],
        } as any;
      }

      _protocolTracker?.markTruthResolved();
      _enforcementMiddleware?.persist();
      return bosResolveTruth(bosSelector, args);
    },
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

  // Register Ecosystem Handoff tools
  _server.tool(
    'bos-agent-handoff',
    'Request, accept, reject, or check status of agent-to-agent handoff',
    bosAgentHandoffInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'bos-agent-handoff',
        toolName: 'bos-agent-handoff',
        // 'delegation' is what DNA orchestrator personas actually grant (see
        // enterprise-governance.yaml) — the literal string 'orchestration' required here
        // previously never matched any real skill in any bundled DNA, so this check always
        // failed for action: 'request'. Also: the requesting agent's real id is `args.from`
        // (already part of this tool's own input), not _getAgentId()'s BEHAVIOROS_AGENT_ID env
        // var, which can never be set correctly in advance since AgentManager generates agent
        // ids with a random suffix at runtime.
        requiredSkills: args.action === 'request' ? ['delegation'] : undefined,
        agentId: args.action === 'request' ? args.from : _getAgentId(),
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosAgentHandoff(_engine!.handoffProtocol, args);
    },
  );

  _server.tool(
    'bos-skills-validate',
    'Validate if an agent has required skills for a task. Blocks if skills are missing.',
    bosSkillsValidateInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: false,
        toolName: 'bos-skills-validate',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosSkillsValidate(_engine!.skillEngine, args);
    },
  );

  _server.tool(
    'bos-skills-list',
    'List available skills, optionally filtered by category or authority level',
    bosSkillsListInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-skills-list',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosSkillsList(_engine!.skillEngine, args);
    },
  );

  _server.tool(
    'bos-ecosystem-status',
    'Get full ecosystem status: agents, skills, MCPs, design systems, DNAs',
    (bosEcosystemStatusInput as any).shape,
    async (_args: any) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-ecosystem-status',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosEcosystemStatus(_engine!.ecosystemRegistry, _args);
    },
  );

  _server.tool(
    'bos-ecosystem-doctor',
    'Run full ecosystem diagnostics. Detects missing skills, offline MCPs, outdated components, conflicts.',
    (bosEcosystemDoctorInput as any).shape,
    async (_args: any) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-ecosystem-doctor',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosEcosystemDoctor(_engine!.ecosystemRegistry, _args);
    },
  );

  _server.tool(
    'bos-ecosystem-install',
    'Install a component (skill, MCP, design system) from any source',
    bosEcosystemInstallInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'bos-ecosystem-install',
        toolName: 'bos-ecosystem-install',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosEcosystemInstall(_engine!.ecosystemRegistry, args);
    },
  );

  // Register CI/CD tools
  _server.tool(
    'start-pipeline',
    'Start an EAARG pipeline for a project (any project)',
    startPipelineInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'start-pipeline',
        toolName: 'start-pipeline',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return startPipeline(args);
    },
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
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'validate-layer',
        toolName: 'validate-layer',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return validateLayer(args);
    },
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
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'approve-layer',
        toolName: 'approve-layer',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return approveLayer(args);
    },
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
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission'],
        evaluateGovernance: true,
        governanceAction: 'cicd-run-audit',
        toolName: 'cicd-run-audit',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return cicdRunAudit(args);
    },
  );

  _server.tool(
    'cicd-get-audit-history',
    'Get historical audit results from CI/CD pipelines',
    // See the list-agents registration above for why .unwrap() is required here.
    getAuditHistoryInput.unwrap().shape,
    async (args: any) => getAuditHistory(args),
  );

  _server.tool(
    'cicd-record-learning',
    'Record a learning event from CI/CD pipeline',
    cicdRecordLearningInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: ['dna', 'truth', 'mission', 'audit'],
        evaluateGovernance: true,
        governanceAction: 'cicd-record-learning',
        toolName: 'cicd-record-learning',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return cicdRecordLearning(args);
    },
  );

  _server.tool(
    'cicd-get-learning-report',
    'Get learning recommendations from CI/CD events',
    getLearningReportInput.unwrap().shape,
    async (args: any) => getLearningReport(args),
  );

  // Register Event Query tools
  _server.tool(
    'bos-event-query',
    'Query events from the Event Store',
    bosEventQueryInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-event-query',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosEventQuery(args);
    },
  );

  _server.tool(
    'bos-event-stats',
    'Get Event Store statistics',
    bosEventStatsInput.shape,
    async () => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-event-stats',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosEventStats();
    },
  );

  _server.tool(
    'bos-event-replay',
    'Replay events for an aggregate to rebuild state',
    bosEventReplayInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-event-replay',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosEventReplay(args);
    },
  );

  // Register Observability tools
  setObservabilityEngine(_engine);

  _server.tool(
    'bos-system-health',
    'Get overall system health status',
    bosSystemHealthInput.shape,
    async () => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-system-health',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosSystemHealth();
    },
  );

  _server.tool(
    'bos-telemetry-summary',
    'Get aggregate-only governance telemetry (violations blocked/approved by rule, per-agent mission counts, agent efficiency). Read-only; never enables telemetry collection.',
    async () => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-telemetry-summary',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosTelemetrySummary(_engine!);
    },
  );

  _server.tool(
    'bos-pipeline-metrics',
    'Get pipeline execution metrics',
    bosPipelineMetricsInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-pipeline-metrics',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosPipelineMetrics(args);
    },
  );

  _server.tool(
    'bos-agent-metrics',
    'Get agent performance metrics',
    bosAgentMetricsInput.shape,
    async (args) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-agent-metrics',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);
      return bosAgentMetrics(args);
    },
  );

  // Register Compliance tools — single tool with sub-commands
  // @ts-expect-error MCP SDK overload resolution incompatible with Zod return types
  _server.tool(
    'bos-compliance',
    'Compliance reporting: generate, get, list, or summarize compliance reports for SOC2, PCI-DSS, and EU AI Act',
    async (args: any) => {
      const enforcement = await _enforcementMiddleware!.enforce({
        requiredSteps: [],
        evaluateGovernance: false,
        toolName: 'bos-compliance',
      });
      if (enforcement.blocked) throw new Error(enforcement.reason);

      const command = args.command as string;
      switch (command) {
        case 'generate':
          return handleComplianceGenerate(args);
        case 'get':
          return handleComplianceGet(args);
        case 'list':
          return handleComplianceList(args);
        case 'summary':
          return handleComplianceSummary(args);
        default:
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: `Unknown command: ${command}`,
                    availableCommands: ['generate', 'get', 'list', 'summary'],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
      }
    },
  );

  // Register resources
  registerResources(_server, _engine);
  registerCICDResources(_server, _engine);

  return _server;
}

export function buildToolHandlers(): Map<string, ToolHandler> {
  const engine = _engine;
  if (!engine) {
    throw new Error('Server not initialized. Call createServer() first.');
  }
  const handlers = new Map<string, ToolHandler>();

  handlers.set('create-mission', (args) => createMission(engine, args as any));
  handlers.set('get-status', () => getStatus(engine));
  handlers.set('update-progress', (args) => updateProgress(engine, args as any));
  handlers.set('list-agents', (args) => listAgents(engine, args as any));
  handlers.set('list-missions', (args) => listMissions(engine, args as any));
  handlers.set('evaluate-governance', (args) => evaluateGovernance(engine, args as any));
  handlers.set('record-learning', (args) => recordLearning(engine, args as any));
  handlers.set('run-audit', (args) => runAudit(args as any));

  if (_bosSelector) {
    handlers.set('bos_select_dna', (args) => bosSelectDna(_bosSelector!, args as any));
    handlers.set('bos_list_patterns', () => bosListPatterns(_bosSelector!));
    handlers.set('bos_resolve_truth', (args) => bosResolveTruth(_bosSelector!, args as any));
  }

  if (_bosConflictResolver) {
    handlers.set('bos_resolve_conflict', (args) =>
      bosResolveConflict(_bosConflictResolver!, args as any),
    );
  }

  if (_bosEscalationManager) {
    handlers.set('bos_check_escalation', (args) =>
      bosCheckEscalation(_bosEscalationManager!, args as any),
    );
  }

  if (_bosAuditChain) {
    handlers.set('bos_run_audit', (args) => bosRunAudit(_bosAuditChain!, args as any));
  }

  if (_bosAuditChainVerifier) {
    handlers.set('bos_verify_audit_chain', (args) =>
      bosVerifyAuditChain(_bosAuditChainVerifier!, args as any),
    );
  }

  if (_bosLearningEngine) {
    handlers.set('bos_get_insights', () => bosGetInsights(_bosLearningEngine!));
  }

  if (_protocolTracker) {
    handlers.set('bos_validate_protocol', () => bosValidateProtocol(_protocolTracker!));
    handlers.set('bos_reset_protocol', (args) => bosResetProtocol(_protocolTracker!, args as any));
  }

  handlers.set('bos-autonomous-task', (args) =>
    bosAutonomousTask(engine.autonomousOrchestrator, args as any),
  );
  handlers.set('bos_lsp_diagnostics', (args) => bosLspDiagnostics(args as any));
  handlers.set('bos_lsp_validate', (args) => bosLspValidate(args as any));
  handlers.set('bos-agent-handoff', (args) => bosAgentHandoff(engine.handoffProtocol, args as any));
  handlers.set('bos-skills-validate', (args) => bosSkillsValidate(engine.skillEngine, args as any));
  handlers.set('bos-skills-list', (args) => bosSkillsList(engine.skillEngine, args as any));
  handlers.set('bos-ecosystem-status', (args) =>
    bosEcosystemStatus(engine.ecosystemRegistry, args as any),
  );
  handlers.set('bos-ecosystem-doctor', (args) =>
    bosEcosystemDoctor(engine.ecosystemRegistry, args as any),
  );
  handlers.set('bos-ecosystem-install', (args) =>
    bosEcosystemInstall(engine.ecosystemRegistry, args as any),
  );
  handlers.set('bos-event-query', (args) => bosEventQuery(args as any));
  handlers.set('bos-event-stats', () => bosEventStats());
  handlers.set('bos-event-replay', (args) => bosEventReplay(args as any));
  handlers.set('bos-system-health', () => bosSystemHealth());
  handlers.set('bos-telemetry-summary', () => bosTelemetrySummary(engine));
  handlers.set('bos-pipeline-metrics', (args) => bosPipelineMetrics(args as any));
  handlers.set('bos-agent-metrics', (args) => bosAgentMetrics(args as any));
  handlers.set('start-pipeline', (args) => startPipeline(args as any));
  handlers.set('get-pipeline-status', (args) => getPipelineStatus(args as any));
  handlers.set('validate-layer', (args) => validateLayer(args as any));
  handlers.set('get-pipeline-report', (args) => getPipelineReport(args as any));
  handlers.set('approve-layer', (args) => approveLayer(args as any));
  handlers.set('get-gate-results', (args) => getGateResults(args as any));
  handlers.set('cicd-run-audit', (args) => cicdRunAudit(args as any));
  handlers.set('cicd-get-audit-history', () => getAuditHistory());
  handlers.set('cicd-record-learning', (args) => cicdRecordLearning(args as any));

  return handlers;
}

export function getMcpServer(): McpServer {
  const srv = _server;
  if (!srv) throw new Error('Server not initialized. Call createServer() first.');
  return srv;
}

// --- CLI entry point ---
const _httpPort = parseInt(process.env.BEHAVIOROS_HTTP_PORT ?? '3000', 10);

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
      const handlers = buildToolHandlers();
      const httpBridge = new HttpBridge({
        toolHandlers: handlers,
        port: _httpPort,
        toolCount: handlers.size,
        version: '1.1.4',
        allowedOrigins: process.env.BEHAVIOROS_ALLOWED_ORIGINS
          ? process.env.BEHAVIOROS_ALLOWED_ORIGINS.split(',')
          : ['*'],
      });
      httpBridge.start();

      const transport = new StdioServerTransport();
      process.on('SIGINT', async () => {
        httpBridge.stop().catch(() => {});
        await server.close();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        httpBridge.stop().catch(() => {});
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
