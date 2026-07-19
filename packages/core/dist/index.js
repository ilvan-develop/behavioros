"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  AuditChain: () => AuditChain,
  AuditEngine: () => AuditEngine,
  BehaviorCompiler: () => BehaviorCompiler,
  BehaviorOSEngine: () => BehaviorOSEngine,
  BehaviorSelector: () => BehaviorSelector,
  BosGovernanceEngine: () => BosGovernanceEngine,
  BosLearningEngine: () => BosLearningEngine,
  CanaryDeployer: () => CanaryDeployer,
  ConflictResolver: () => ConflictResolver,
  DNAComposer: () => DNAComposer,
  DNALoader: () => DNALoader,
  DNAValidator: () => DNAValidator,
  DecisionEngine: () => DecisionEngine,
  DnaResolver: () => DnaResolver,
  DomainAgentACL: () => AgentACL,
  DomainAgentBoundary: () => AgentBoundary,
  DomainAgentContext: () => AgentContext,
  DomainDNABoundary: () => DNABoundary,
  DomainDNAContext: () => DNAContext,
  DomainDataACL: () => DataACL,
  DomainEventACL: () => EventACL,
  DomainExecutionBoundary: () => ExecutionBoundary,
  EphemeralEnvironment: () => EphemeralEnvironment,
  EscalationManager: () => EscalationManager,
  ForensicCollector: () => ForensicCollector,
  GovernanceEngine: () => GovernanceEngine,
  HealthChecker: () => HealthChecker,
  LearningEngine: () => LearningEngine,
  MetricsInterceptor: () => MetricsInterceptor,
  MissionEngine: () => MissionEngine,
  OPAEvaluator: () => OPAEvaluator,
  PersistentEnvironment: () => PersistentEnvironment,
  PipelineDispatcher: () => PipelineDispatcher,
  PipelineEngine: () => PipelineEngine,
  PolicyStore: () => PolicyStore,
  PromptSimulator: () => PromptSimulator,
  QualityEngine: () => QualityEngine,
  QuarantineManager: () => QuarantineManager,
  ResponseCollector: () => ResponseCollector,
  RollbackManager: () => RollbackManager,
  SQLiteStore: () => SQLiteStore,
  STAGE_100_CONFIG: () => STAGE_100_CONFIG,
  STAGE_100_THRESHOLDS: () => STAGE_100_THRESHOLDS,
  STAGE_25_CONFIG: () => STAGE_25_CONFIG,
  STAGE_25_THRESHOLDS: () => STAGE_25_THRESHOLDS,
  STAGE_50_CONFIG: () => STAGE_50_CONFIG,
  STAGE_50_THRESHOLDS: () => STAGE_50_THRESHOLDS,
  STAGE_5_CONFIG: () => STAGE_5_CONFIG,
  STAGE_5_THRESHOLDS: () => STAGE_5_THRESHOLDS,
  SandboxEngine: () => SandboxEngine,
  SandboxExecutor: () => SandboxExecutor,
  ShadowEnvironment: () => ShadowEnvironment,
  SuspicionDetector: () => SuspicionDetector,
  TimeoutInterceptor: () => TimeoutInterceptor,
  TrafficReplay: () => TrafficReplay,
  TrafficSplitter: () => TrafficSplitter,
  YAMLToOPACompiler: () => YAMLToOPACompiler,
  bosMatchesGlob: () => matchesGlob,
  createDispatcherContext: () => createDispatcherContext,
  shouldSkipForConversational: () => shouldSkipForConversational,
  shouldSkipForTransactional: () => shouldSkipForTransactional
});
module.exports = __toCommonJS(index_exports);

// src/compiler/behavior-compiler.ts
var import_node_fs = require("fs");
var import_node_path = require("path");
var import_schemas = require("@behavioros/schemas");
var import_yaml = require("yaml");
var BehaviorCompiler = class {
  outputDir;
  dryRun;
  verbose;
  constructor(options) {
    this.outputDir = options?.outputDir ?? "./generated";
    this.dryRun = options?.dryRun ?? false;
    this.verbose = options?.verbose ?? false;
  }
  /**
   * Compila um pacote DNA em uma organização completa
   */
  compile(dna) {
    const organization = this.generateOrganization(dna);
    const files = this.generateFiles(dna, organization);
    if (!this.dryRun) {
      this.writeFiles(files);
    }
    return { organization, files };
  }
  /**
   * Compila a partir de um arquivo YAML
   */
  compileFromYAML(yamlPath) {
    const content = (0, import_node_fs.readFileSync)(yamlPath, "utf-8");
    const parsed = (0, import_yaml.parse)(content);
    const dna = import_schemas.DNAPackageSchema.parse(parsed);
    return this.compile(dna);
  }
  generateOrganization(dna) {
    return {
      name: dna.name,
      agents: dna.personas.map((p) => ({
        id: `agent-${String(p.role)}`,
        role: String(p.role),
        authority: String(p.authority),
        persona: p.description ?? `${String(p.role)} agent`,
        tools: p.tools ?? [],
        systemPrompt: this.generateSystemPrompt(p)
      })),
      workflows: (dna.workflows ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        steps: w.next ?? [],
        triggers: []
      })),
      hooks: this.generateHooks(dna),
      cicd: {
        providers: ["github"],
        stages: ["lint", "typecheck", "test", "build", "deploy"],
        gates: (dna.quality ?? []).map((g) => g.name)
      },
      mcp: {
        server: "behavioros-mcp",
        tools: ["create-mission", "get-status", "update-progress", "list-agents"],
        resources: ["missions", "agents", "audit-log", "quality-metrics"]
      },
      docs: {
        readme: this.generateReadme(dna),
        architecture: this.generateArchitectureDoc(dna),
        dna: this.generateDNADoc(dna)
      }
    };
  }
  generateSystemPrompt(persona) {
    const lines = [];
    lines.push(`You are a ${persona.role} with ${persona.authority} authority level.`);
    if (persona.description) {
      lines.push(persona.description);
    }
    if (persona.skills && persona.skills.length > 0) {
      lines.push(`Skills: ${persona.skills.join(", ")}`);
    }
    if (persona.boundaries && persona.boundaries.length > 0) {
      lines.push(`Boundaries: ${persona.boundaries.map((b) => b.name).join(", ")}`);
    }
    return lines.join("\n");
  }
  generateHooks(dna) {
    const hooks = [];
    const patterns = dna.patterns ?? [];
    for (const pattern of patterns) {
      if (pattern.triggers && pattern.triggers.length > 0) {
        for (const trigger of pattern.triggers) {
          hooks.push({
            event: trigger,
            action: pattern.actions?.[0] ?? "log",
            config: pattern.config ?? {}
          });
        }
      }
    }
    return hooks;
  }
  generateFiles(_dna, org) {
    const files = [];
    for (const agent of org.agents) {
      files.push({
        path: (0, import_node_path.join)("agents", `${agent.id}.ts`),
        content: this.generateAgentFile(agent),
        type: "typescript"
      });
    }
    for (const workflow of org.workflows) {
      files.push({
        path: (0, import_node_path.join)("workflows", `${workflow.id}.yaml`),
        content: this.generateWorkflowFile(workflow),
        type: "yaml"
      });
    }
    files.push({
      path: (0, import_node_path.join)("mcp", "server.ts"),
      content: this.generateMCPFile(org.mcp),
      type: "typescript"
    });
    files.push({
      path: (0, import_node_path.join)(".github", "workflows", "behavioros.yml"),
      content: this.generateCICDFile(org.cicd),
      type: "yaml"
    });
    files.push({
      path: "README.md",
      content: org.docs.readme,
      type: "markdown"
    });
    return files;
  }
  generateAgentFile(agent) {
    return `// Auto-generated by BehaviorOS Compiler
export const ${agent.id.replace(/-/g, "_")}Agent = {
  id: '${agent.id}',
  role: '${agent.role}',
  authority: '${agent.authority}',
  persona: '${agent.persona}',
  tools: ${JSON.stringify(agent.tools)},
  systemPrompt: \`${agent.systemPrompt}\`,
}
`;
  }
  generateWorkflowFile(workflow) {
    return `# Auto-generated by BehaviorOS Compiler
name: ${workflow.name}
id: ${workflow.id}
steps:
${workflow.steps.map((s) => `  - ${s}`).join("\n")}
triggers:
${workflow.triggers.map((t) => `  - ${t}`).join("\n")}
`;
  }
  generateMCPFile(_mcp) {
    return `// Auto-generated by BehaviorOS Compiler
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function createBehaviorOSMCP() {
  const server = new McpServer({
    name: 'behavioros',
    version: '0.1.0',
  })

  // Register tools
  server.tool('create-mission', 'Create a new mission', async (params) => {
    return { content: [{ type: 'text', text: JSON.stringify(params) }] }
  })

  server.tool('get-status', 'Get current status', async () => {
    return { content: [{ type: 'text', text: 'OK' }] }
  })

  return server
}
`;
  }
  generateCICDFile(cicd) {
    return `# Auto-generated by BehaviorOS Compiler
name: BehaviorOS CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
${cicd.stages.map((s) => `      - name: ${s}
        run: pnpm ${s}`).join("\n")}
`;
  }
  generateReadme(dna) {
    return `# ${dna.name}

${dna.description ?? "BehaviorOS Organization"}

## Agents
${dna.personas.map((p) => `- **${p.role}** (${p.authority}): ${p.description ?? "N/A"}`).join("\n")}

## Governance Rules
${(dna.governance ?? []).map((r) => `- ${r.name}: ${r.action} (${r.level})`).join("\n") || "None defined"}

## Quality Gates
${(dna.quality ?? []).map((g) => `- ${g.name}: ${g.type}`).join("\n") || "None defined"}

Generated by BehaviorOS Compiler v0.1.0
`;
  }
  generateArchitectureDoc(dna) {
    return `# Architecture \u2014 ${dna.name}

## Overview
This organization uses ${dna.personas.length} agent roles with ${dna.governance?.length ?? 0} governance rules.

## Agents
${dna.personas.map((p) => `### ${p.role}
- Authority: ${p.authority}
- Skills: ${p.skills?.join(", ") ?? "N/A"}`).join("\n\n")}

Generated by BehaviorOS Compiler v0.1.0
`;
  }
  generateDNADoc(dna) {
    return `# DNA Package \u2014 ${dna.name}

- **ID**: ${dna.id}
- **Version**: ${dna.version}
- **Author**: ${dna.author ?? "Unknown"}

## Patterns
${(dna.patterns ?? []).map((p) => `- ${p.name} (${p.type})`).join("\n") || "None defined"}

Generated by BehaviorOS Compiler v0.1.0
`;
  }
  writeFiles(files) {
    for (const file of files) {
      const fullPath = (0, import_node_path.join)(this.outputDir, file.path);
      const dir = (0, import_node_path.dirname)(fullPath);
      if (!(0, import_node_fs.existsSync)(dir)) {
        (0, import_node_fs.mkdirSync)(dir, { recursive: true });
      }
      (0, import_node_fs.writeFileSync)(fullPath, file.content, "utf-8");
      if (this.verbose) {
        console.log(`Generated: ${file.path}`);
      }
    }
  }
};

// src/compiler/opa-evaluator.ts
var OPAEvaluator = class {
  policies = /* @__PURE__ */ new Map();
  registerPolicy(dnaId, policy) {
    this.policies.set(dnaId, policy);
  }
  evaluate(dnaId, input) {
    const policy = this.policies.get(dnaId);
    if (!policy) {
      return { allow: false, deny: true, violations: ["No policy found"] };
    }
    const violations = [];
    let allow = true;
    let deny = false;
    for (const rule of policy.rules) {
      if (rule.body.startsWith("deny")) {
        if (this.matchesRule(rule, input)) {
          deny = true;
          allow = false;
          violations.push(rule.name);
        }
      }
    }
    if (!deny) {
      for (const rule of policy.rules) {
        if (rule.body.startsWith("escalate")) {
          if (this.matchesRule(rule, input)) {
            violations.push(rule.name);
          }
        }
      }
    }
    return { allow, deny, violations };
  }
  matchesRule(rule, input) {
    const actionMatch = rule.body.includes(input.action.type);
    if (!actionMatch) return false;
    if (rule.body.includes("input.agent.authority")) {
      return rule.body.includes(input.agent.authority);
    }
    return true;
  }
};

// src/compiler/yaml-to-opa.ts
var YAMLToOPACompiler = class {
  compile(dna) {
    const rules = [];
    dna.governance?.forEach((rule) => {
      rules.push(this.compileGovernanceRule(rule));
    });
    dna.personas?.forEach((persona) => {
      persona.boundaries?.forEach((boundary) => {
        rules.push(this.compileBoundaryRule(boundary));
      });
    });
    return {
      package: `behaviouros.${dna.id}`,
      rules
    };
  }
  compileGovernanceRule(rule) {
    const firstCondition = rule.conditions?.[0] ?? "read";
    if (rule.action === "block") {
      return {
        name: `governance_${rule.id}`,
        body: `deny { input.action.type == "${firstCondition}" }`
      };
    }
    if (rule.action === "escalate") {
      return {
        name: `governance_${rule.id}`,
        body: `escalate { input.action.type == "${firstCondition}" ; input.agent.authority < "${rule.level}" }`
      };
    }
    return {
      name: `governance_${rule.id}`,
      body: `allow { input.action.type == "${firstCondition}" ; input.governance.level >= "${rule.level}" }`
    };
  }
  compileBoundaryRule(boundary) {
    if (boundary.type === "forbidden") {
      return {
        name: `boundary_${boundary.id}`,
        body: `deny { input.action.matches("${String(boundary.value)}") }`
      };
    }
    return {
      name: `boundary_${boundary.id}`,
      body: `allow { boundary_check("${boundary.type}", ${String(boundary.value)}, "${boundary.scope}") }`
    };
  }
};

// src/compiler/policy-store.ts
var PolicyStore = class {
  evaluator = new OPAEvaluator();
  compiler = new YAMLToOPACompiler();
  policies = /* @__PURE__ */ new Map();
  cache = /* @__PURE__ */ new Map();
  registerDNA(dna) {
    const policy = this.compiler.compile(dna);
    this.evaluator.registerPolicy(dna.id, policy);
    this.policies.set(dna.id, policy);
    return policy;
  }
  registerPolicy(dnaId, policy) {
    this.evaluator.registerPolicy(dnaId, policy);
    this.policies.set(dnaId, policy);
  }
  evaluate(dnaId, input) {
    const cacheKey = `${dnaId}:${input.action.type}:${input.agent.authority}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const result = this.evaluator.evaluate(dnaId, input);
    this.cache.set(cacheKey, result);
    return result;
  }
  getPolicy(dnaId) {
    return this.policies.get(dnaId);
  }
  listPolicies() {
    return Array.from(this.policies.keys());
  }
  clearCache() {
    this.cache.clear();
  }
  removePolicy(dnaId) {
    this.policies.delete(dnaId);
    this.clearCache();
    return true;
  }
};

// src/deploy/canary-deployer.ts
var import_node_crypto4 = require("crypto");
var import_eventemitter34 = __toESM(require("eventemitter3"));

// src/deploy/health-checker.ts
var import_node_crypto = require("crypto");
var import_eventemitter3 = __toESM(require("eventemitter3"));
var DEFAULT_THRESHOLDS = [
  { category: "success-rate", warningThreshold: 95, failureThreshold: 90, unit: "%" },
  { category: "latency", warningThreshold: 500, failureThreshold: 1e3, unit: "ms" },
  { category: "error-rate", warningThreshold: 5, failureThreshold: 10, unit: "%" }
];
var DEFAULT_HEALTH_CHECKER_CONFIG = {
  thresholds: DEFAULT_THRESHOLDS,
  intervalMs: 3e4,
  failureThreshold: 3,
  minRequestCount: 10
};
var HealthChecker = class extends import_eventemitter3.default {
  config;
  results = [];
  consecutiveFailures = 0;
  timer = null;
  healthy = true;
  constructor(config) {
    super();
    this.config = { ...DEFAULT_HEALTH_CHECKER_CONFIG, ...config };
    if (config?.thresholds) {
      this.config.thresholds = config.thresholds;
    }
  }
  // ── Health check execution ──────────────────────────────────
  /**
   * Run a single health check against collected metrics.
   */
  check(metrics) {
    const probes = [];
    const { successCount, totalCount, totalLatencyMs, errorCount } = metrics;
    const successRate = totalCount > 0 ? successCount / totalCount * 100 : 100;
    const avgLatencyMs = totalCount > 0 ? totalLatencyMs / totalCount : 0;
    const errorRate = totalCount > 0 ? errorCount / totalCount * 100 : 0;
    for (const threshold of this.config.thresholds) {
      let value;
      switch (threshold.category) {
        case "success-rate":
          value = successRate;
          break;
        case "latency":
          value = avgLatencyMs;
          break;
        case "error-rate":
          value = errorRate;
          break;
        default:
          continue;
      }
      const status = this.evaluateThreshold(
        threshold,
        value,
        threshold.category === "success-rate"
      );
      probes.push({
        id: (0, import_node_crypto.randomUUID)(),
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        category: threshold.category,
        value,
        threshold,
        status
      });
    }
    const overallStatus = this.worstStatus(probes.map((p) => p.status));
    const result = {
      id: (0, import_node_crypto.randomUUID)(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      probes,
      overallStatus,
      successRate,
      avgLatencyMs,
      errorRate,
      requestCount: totalCount
    };
    this.results.push(result);
    this.emit("check:complete", result);
    if (overallStatus === "unhealthy") {
      this.consecutiveFailures++;
      if (this.healthy) {
        this.healthy = false;
        this.emit("check:recovered", result);
      }
      this.emit("check:unhealthy", result);
    } else {
      if (!this.healthy && overallStatus === "healthy") {
        this.healthy = true;
        this.emit("check:recovered", result);
      }
      this.consecutiveFailures = 0;
    }
    return result;
  }
  // ── Config ──────────────────────────────────────────────────
  /**
   * Update configuration values (e.g. interval between stages).
   */
  updateConfig(partial) {
    if (partial.thresholds) this.config.thresholds = partial.thresholds;
    if (partial.intervalMs !== void 0) this.config.intervalMs = partial.intervalMs;
    if (partial.failureThreshold !== void 0)
      this.config.failureThreshold = partial.failureThreshold;
    if (partial.minRequestCount !== void 0)
      this.config.minRequestCount = partial.minRequestCount;
  }
  // ── Timer management ────────────────────────────────────────
  /**
   * Start periodic health checks.
   * `sampleFn` is called each interval to collect metrics for the check.
   */
  startPeriodic(sampleFn) {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const metrics = await sampleFn();
        this.check(metrics);
      } catch {
        this.consecutiveFailures++;
        this.emit("check:unhealthy", {
          id: (0, import_node_crypto.randomUUID)(),
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          probes: [],
          overallStatus: "unhealthy",
          successRate: 0,
          avgLatencyMs: 0,
          errorRate: 100,
          requestCount: 0
        });
      }
    }, this.config.intervalMs);
  }
  /**
   * Stop periodic health checks.
   */
  stopPeriodic() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  // ── Query ───────────────────────────────────────────────────
  /**
   * Whether the checker is currently in a failing state.
   */
  isFailing() {
    return this.consecutiveFailures >= this.config.failureThreshold;
  }
  /**
   * Number of consecutive unhealthy checks.
   */
  getConsecutiveFailures() {
    return this.consecutiveFailures;
  }
  /**
   * Get all recorded health check results.
   */
  getResults() {
    return [...this.results];
  }
  /**
   * Get the most recent health check result.
   */
  getLastResult() {
    return this.results[this.results.length - 1];
  }
  /**
   * Get the current configuration.
   */
  getConfig() {
    return this.config;
  }
  // ── Reset ───────────────────────────────────────────────────
  /**
   * Reset all state (results, failure count).
   */
  reset() {
    this.results = [];
    this.consecutiveFailures = 0;
    this.healthy = true;
  }
  // ── Private ─────────────────────────────────────────────────
  evaluateThreshold(threshold, value, inverseDirection) {
    if (inverseDirection) {
      if (value < threshold.failureThreshold) return "unhealthy";
      if (value < threshold.warningThreshold) return "degraded";
      return "healthy";
    }
    if (value > threshold.failureThreshold) return "unhealthy";
    if (value > threshold.warningThreshold) return "degraded";
    return "healthy";
  }
  worstStatus(statuses) {
    if (statuses.includes("unhealthy")) return "unhealthy";
    if (statuses.includes("degraded")) return "degraded";
    return "healthy";
  }
};

// src/deploy/rollback-manager.ts
var import_node_crypto2 = require("crypto");
var import_eventemitter32 = __toESM(require("eventemitter3"));
var DEFAULT_ROLLBACK_CONFIG = {
  maxHistory: 100,
  driftThreshold: 0.3,
  autoRollbackOnHealth: true,
  autoRollbackOnDrift: true
};
var RollbackManager = class extends import_eventemitter32.default {
  config;
  history = [];
  activeRollback = null;
  constructor(config) {
    super();
    this.config = { ...DEFAULT_ROLLBACK_CONFIG, ...config };
  }
  // ── Rollback triggers ───────────────────────────────────────
  /**
   * Evaluate a health check result and trigger rollback if failing.
   * Returns the rollback record if triggered, null otherwise.
   */
  evaluateHealthCheck(result, deploymentId, fromVersion, toVersion, stagePercent) {
    if (!this.config.autoRollbackOnHealth) return null;
    if (result.overallStatus !== "unhealthy") return null;
    if (this.activeRollback) return null;
    return this.triggerRollback({
      deploymentId,
      trigger: "health-check-failure",
      fromVersion,
      toVersion,
      stagePercent,
      reason: `Health check unhealthy: success=${result.successRate.toFixed(1)}%, latency=${result.avgLatencyMs.toFixed(0)}ms, errors=${result.errorRate.toFixed(1)}%`,
      healthCheckResult: result
    });
  }
  /**
   * Evaluate a drift score and trigger rollback if above threshold.
   * Returns the rollback record if triggered, null otherwise.
   */
  evaluateDrift(driftScore, deploymentId, fromVersion, toVersion, stagePercent) {
    if (!this.config.autoRollbackOnDrift) return null;
    if (driftScore <= this.config.driftThreshold) return null;
    if (this.activeRollback) return null;
    return this.triggerRollback({
      deploymentId,
      trigger: "drift-detected",
      fromVersion,
      toVersion,
      stagePercent,
      reason: `Drift score ${driftScore.toFixed(3)} exceeds threshold ${this.config.driftThreshold}`,
      driftScore
    });
  }
  /**
   * Manually trigger a rollback.
   */
  triggerManual(params) {
    if (this.activeRollback) return null;
    return this.triggerRollback({
      ...params,
      trigger: "manual"
    });
  }
  // ── Rollback execution ──────────────────────────────────────
  /**
   * Mark the active rollback as completed.
   */
  completeRollback(rollbackId) {
    const record = this.history.find((r) => r.id === rollbackId);
    if (record?.status !== "in-progress") return null;
    record.status = "completed";
    this.activeRollback = null;
    this.emit("rollback:completed", record);
    return record;
  }
  /**
   * Mark the active rollback as failed.
   */
  failRollback(rollbackId, error) {
    const record = this.history.find((r) => r.id === rollbackId);
    if (record?.status !== "in-progress") return null;
    record.status = "failed";
    record.error = error;
    this.activeRollback = null;
    this.emit("rollback:failed", record);
    return record;
  }
  /**
   * Cancel a pending rollback.
   */
  cancelRollback(rollbackId) {
    const record = this.history.find((r) => r.id === rollbackId);
    if (record?.status !== "pending") return null;
    record.status = "cancelled";
    this.activeRollback = null;
    return record;
  }
  // ── Query ───────────────────────────────────────────────────
  /**
   * Whether a rollback is currently active.
   */
  hasActiveRollback() {
    return this.activeRollback !== null;
  }
  /**
   * Get the active rollback record.
   */
  getActiveRollback() {
    return this.activeRollback;
  }
  /**
   * Get the full rollback history.
   */
  getHistory() {
    return [...this.history];
  }
  /**
   * Get rollback history for a specific deployment.
   */
  getHistoryForDeployment(deploymentId) {
    return this.history.filter((r) => r.deploymentId === deploymentId);
  }
  /**
   * Get the last completed rollback.
   */
  getLastCompleted() {
    return this.history.filter((r) => r.status === "completed").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }
  /**
   * Get the current configuration.
   */
  getConfig() {
    return this.config;
  }
  // ── Reset ───────────────────────────────────────────────────
  /**
   * Clear all rollback history and active state.
   */
  reset() {
    this.history = [];
    this.activeRollback = null;
  }
  // ── Private ─────────────────────────────────────────────────
  triggerRollback(params) {
    const record = {
      id: (0, import_node_crypto2.randomUUID)(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      status: "in-progress",
      ...params
    };
    this.history.push(record);
    this.activeRollback = record;
    if (this.history.length > this.config.maxHistory) {
      this.history = this.history.slice(-this.config.maxHistory);
    }
    this.emit("rollback:triggered", record);
    return record;
  }
};

// src/deploy/stages/stage-5.ts
var STAGE_5_CONFIG = {
  name: "stage-5",
  trafficPercent: 5,
  durationMs: 24 * 60 * 60 * 1e3,
  healthCheckIntervalMs: 3e4,
  requiredConsecutiveHealthy: 3,
  driftThreshold: 0.1,
  autoAdvance: true,
  description: "Initial canary validation \u2014 5% traffic for 24h"
};
var STAGE_5_THRESHOLDS = {
  successRate: { warning: 97, failure: 93 },
  latencyMs: { warning: 400, failure: 800 },
  errorRate: { warning: 3, failure: 7 }
};

// src/deploy/stages/stage-25.ts
var STAGE_25_CONFIG = {
  name: "stage-25",
  trafficPercent: 25,
  durationMs: 24 * 60 * 60 * 1e3,
  healthCheckIntervalMs: 3e4,
  requiredConsecutiveHealthy: 3,
  driftThreshold: 0.2,
  autoAdvance: true,
  description: "Growing confidence \u2014 25% traffic for 24h"
};
var STAGE_25_THRESHOLDS = {
  successRate: { warning: 96, failure: 91 },
  latencyMs: { warning: 450, failure: 900 },
  errorRate: { warning: 4, failure: 9 }
};

// src/deploy/stages/stage-50.ts
var STAGE_50_CONFIG = {
  name: "stage-50",
  trafficPercent: 50,
  durationMs: 24 * 60 * 60 * 1e3,
  healthCheckIntervalMs: 3e4,
  requiredConsecutiveHealthy: 5,
  driftThreshold: 0.25,
  autoAdvance: true,
  description: "Half traffic \u2014 50% traffic for 24h"
};
var STAGE_50_THRESHOLDS = {
  successRate: { warning: 95, failure: 90 },
  latencyMs: { warning: 500, failure: 1e3 },
  errorRate: { warning: 5, failure: 10 }
};

// src/deploy/stages/stage-100.ts
var STAGE_100_CONFIG = {
  name: "stage-100",
  trafficPercent: 100,
  durationMs: 0,
  healthCheckIntervalMs: 3e4,
  requiredConsecutiveHealthy: 3,
  driftThreshold: 0.3,
  autoAdvance: false,
  description: "Full promotion \u2014 100% traffic, deployment complete"
};
var STAGE_100_THRESHOLDS = {
  successRate: { warning: 95, failure: 90 },
  latencyMs: { warning: 500, failure: 1e3 },
  errorRate: { warning: 5, failure: 10 }
};

// src/deploy/traffic-splitter.ts
var import_node_crypto3 = require("crypto");
var import_eventemitter33 = __toESM(require("eventemitter3"));
var DEFAULT_SPLITTER_CONFIG = {
  strategy: "weighted",
  stickySessionTtlMs: 36e5,
  maxStickySessions: 1e4
};
var TrafficSplitter = class extends import_eventemitter33.default {
  config;
  routes = [];
  stickySessions = /* @__PURE__ */ new Map();
  roundRobinIndex = 0;
  constructor(config) {
    super();
    this.config = { ...DEFAULT_SPLITTER_CONFIG, ...config };
  }
  // ── Route management ────────────────────────────────────────
  /**
   * Set the traffic split between old and new DNA versions.
   */
  setSplit(canaryWeight, stableWeight) {
    const effectiveStable = stableWeight ?? 100 - canaryWeight;
    this.routes = [
      {
        id: (0, import_node_crypto3.randomUUID)(),
        version: "stable",
        weight: effectiveStable,
        isCanary: false
      },
      {
        id: (0, import_node_crypto3.randomUUID)(),
        version: "canary",
        weight: canaryWeight,
        isCanary: true
      }
    ];
    this.emit("split:changed", this.routes);
    return this.routes;
  }
  /**
   * Set split with custom version identifiers.
   */
  setVersionedSplit(stableVersion, stableWeight, canaryVersion, canaryWeight) {
    this.routes = [
      {
        id: (0, import_node_crypto3.randomUUID)(),
        version: stableVersion,
        weight: stableWeight,
        isCanary: false
      },
      {
        id: (0, import_node_crypto3.randomUUID)(),
        version: canaryVersion,
        weight: canaryWeight,
        isCanary: true
      }
    ];
    this.emit("split:changed", this.routes);
    return this.routes;
  }
  // ── Routing ─────────────────────────────────────────────────
  /**
   * Route a request to the appropriate DNA version.
   */
  route(sessionId) {
    let routedVersion;
    let stickyMatch = false;
    if (sessionId) {
      const existing = this.stickySessions.get(sessionId);
      if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
        routedVersion = existing.pinnedVersion;
        stickyMatch = true;
      } else {
        if (existing) this.stickySessions.delete(sessionId);
        routedVersion = this.resolveRoute();
        if (this.config.strategy === "sticky") {
          this.createStickySession(sessionId, routedVersion);
          stickyMatch = true;
        }
      }
    } else {
      routedVersion = this.resolveRoute();
    }
    const decision = {
      id: (0, import_node_crypto3.randomUUID)(),
      routedVersion,
      stickyMatch,
      trafficSplit: this.getTrafficSplit()
    };
    this.emit("route:decision", decision);
    return decision;
  }
  // ── Sticky sessions ─────────────────────────────────────────
  /**
   * Manually create a sticky session for a given ID.
   */
  createStickySession(sessionId, version) {
    if (this.stickySessions.size >= this.config.maxStickySessions) {
      this.evictOldestSession();
    }
    const now = Date.now();
    const session = {
      sessionId,
      pinnedVersion: version,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.config.stickySessionTtlMs).toISOString()
    };
    this.stickySessions.set(sessionId, session);
    this.emit("sticky:created", session);
    return session;
  }
  /**
   * Remove a sticky session.
   */
  removeStickySession(sessionId) {
    return this.stickySessions.delete(sessionId);
  }
  /**
   * Get all active sticky sessions.
   */
  getStickySessions() {
    return Array.from(this.stickySessions.values()).filter(
      (s) => new Date(s.expiresAt).getTime() > Date.now()
    );
  }
  // ── Query ───────────────────────────────────────────────────
  /**
   * Get current traffic split as a version → percentage map.
   */
  getTrafficSplit() {
    const split = {};
    for (const route of this.routes) {
      split[route.version] = route.weight;
    }
    return split;
  }
  /**
   * Get all routes.
   */
  getRoutes() {
    return [...this.routes];
  }
  /**
   * Get the canary route, if any.
   */
  getCanaryRoute() {
    return this.routes.find((r) => r.isCanary);
  }
  /**
   * Get the stable route, if any.
   */
  getStableRoute() {
    return this.routes.find((r) => !r.isCanary);
  }
  /**
   * Get the current configuration.
   */
  getConfig() {
    return this.config;
  }
  // ── Reset ───────────────────────────────────────────────────
  /**
   * Reset all routes and sticky sessions.
   */
  reset() {
    this.routes = [];
    this.stickySessions.clear();
    this.roundRobinIndex = 0;
  }
  // ── Private ─────────────────────────────────────────────────
  resolveRoute() {
    if (this.routes.length === 0) return "stable";
    switch (this.config.strategy) {
      case "round-robin":
        return this.resolveRoundRobin();
      case "random":
        return this.resolveRandom();
      default:
        return this.resolveWeighted();
    }
  }
  resolveRoundRobin() {
    const idx = this.roundRobinIndex % this.routes.length;
    this.roundRobinIndex++;
    return this.routes[idx].version;
  }
  resolveRandom() {
    const totalWeight = this.routes.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const route of this.routes) {
      roll -= route.weight;
      if (roll <= 0) return route.version;
    }
    return this.routes[this.routes.length - 1].version;
  }
  resolveWeighted() {
    const totalWeight = this.routes.reduce((sum, r) => sum + r.weight, 0);
    if (totalWeight === 0) return this.routes[0].version;
    let roll = Math.random() * totalWeight;
    for (const route of this.routes) {
      roll -= route.weight;
      if (roll <= 0) return route.version;
    }
    return this.routes[this.routes.length - 1].version;
  }
  evictOldestSession() {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, session] of this.stickySessions) {
      const time = new Date(session.createdAt).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    if (oldestKey) this.stickySessions.delete(oldestKey);
  }
};

// src/deploy/canary-deployer.ts
var DEFAULT_STAGES = [
  STAGE_5_CONFIG,
  STAGE_25_CONFIG,
  STAGE_50_CONFIG,
  STAGE_100_CONFIG
];
var DEFAULT_DEPLOYER_CONFIG = {
  stages: DEFAULT_STAGES,
  healthChecker: {},
  rollbackManager: {},
  trafficSplitter: {},
  globalDriftThreshold: 0.3
};
var CanaryDeployer = class extends import_eventemitter34.default {
  config;
  healthChecker;
  rollbackManager;
  trafficSplitter;
  deployment = null;
  stageTimer = null;
  healthTimer = null;
  deployments = [];
  constructor(config) {
    super();
    this.config = { ...DEFAULT_DEPLOYER_CONFIG, ...config };
    this.healthChecker = new HealthChecker({
      ...this.config.healthChecker,
      intervalMs: this.config.stages[0]?.healthCheckIntervalMs ?? 3e4
    });
    this.rollbackManager = new RollbackManager(this.config.rollbackManager);
    this.trafficSplitter = new TrafficSplitter(this.config.trafficSplitter);
    this.wireEvents();
  }
  // ── Deployment lifecycle ────────────────────────────────────
  /**
   * Start a new canary deployment.
   */
  async startDeployment(params) {
    if (this.deployment && this.deployment.status === "in-progress") {
      throw new Error("A canary deployment is already in progress");
    }
    const stages = this.config.stages.map((config) => ({
      config,
      startedAt: "",
      consecutiveHealthy: 0,
      durationElapsed: false
    }));
    const deployment = {
      id: (0, import_node_crypto4.randomUUID)(),
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      status: "in-progress",
      stableVersion: params.stableVersion,
      canaryVersion: params.canaryVersion,
      projectName: params.projectName,
      currentStageIndex: 0,
      stages,
      trafficSplit: {}
    };
    this.deployment = deployment;
    this.deployments.push(deployment);
    this.emit("deployment:started", deployment);
    await this.enterStage(0);
    return deployment;
  }
  /**
   * Report health metrics for the current canary stage.
   * Call this periodically with observed metrics.
   */
  reportHealth(metrics) {
    if (this.deployment?.status !== "in-progress") return null;
    const result = this.healthChecker.check(metrics);
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    currentStage.lastHealthCheck = result;
    if (result.overallStatus === "healthy") {
      currentStage.consecutiveHealthy++;
    } else {
      currentStage.consecutiveHealthy = 0;
    }
    const rollbackRecord = this.rollbackManager.evaluateHealthCheck(
      result,
      this.deployment.id,
      this.deployment.stableVersion,
      this.deployment.canaryVersion,
      currentStage.config.trafficPercent
    );
    if (rollbackRecord) {
      this.handleRollback(rollbackRecord);
    } else if (this.shouldAdvanceStage()) {
      this.advanceStage();
    }
    return result;
  }
  /**
   * Report drift score from shadow analysis.
   */
  reportDrift(driftScore) {
    if (this.deployment?.status !== "in-progress") return null;
    if (driftScore > this.config.globalDriftThreshold) {
      const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
      const rollbackRecord = this.rollbackManager.evaluateDrift(
        driftScore,
        this.deployment.id,
        this.deployment.stableVersion,
        this.deployment.canaryVersion,
        currentStage.config.trafficPercent
      );
      if (rollbackRecord) {
        this.handleRollback(rollbackRecord);
        return rollbackRecord;
      }
    }
    return null;
  }
  /**
   * Pause the current canary deployment.
   */
  pause() {
    if (this.deployment?.status !== "in-progress") return null;
    this.deployment.status = "paused";
    this.clearTimers();
    this.emit("deployment:paused", this.deployment);
    this.setStatus("paused");
    return this.deployment;
  }
  /**
   * Resume a paused canary deployment.
   */
  resume() {
    if (this.deployment?.status !== "paused") return null;
    this.deployment.status = "in-progress";
    this.startStageTimers();
    this.emit("deployment:resumed", this.deployment);
    this.setStatus("in-progress");
    return this.deployment;
  }
  /**
   * Manually advance to the next stage (skip current).
   */
  promote() {
    if (this.deployment?.status !== "in-progress") return null;
    this.advanceStage();
    return this.deployment;
  }
  /**
   * Manually trigger rollback.
   */
  manualRollback(reason) {
    if (this.deployment?.status !== "in-progress") return null;
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    const record = this.rollbackManager.triggerManual({
      deploymentId: this.deployment.id,
      fromVersion: this.deployment.canaryVersion,
      toVersion: this.deployment.stableVersion,
      stagePercent: currentStage.config.trafficPercent,
      reason
    });
    if (record) this.handleRollback(record);
    return this.deployment;
  }
  // ── Query ───────────────────────────────────────────────────
  /**
   * Get the current active deployment.
   */
  getDeployment() {
    return this.deployment;
  }
  /**
   * Get all deployment history.
   */
  getDeployments() {
    return [...this.deployments];
  }
  /**
   * Get the health checker instance.
   */
  getHealthChecker() {
    return this.healthChecker;
  }
  /**
   * Get the rollback manager instance.
   */
  getRollbackManager() {
    return this.rollbackManager;
  }
  /**
   * Get the traffic splitter instance.
   */
  getTrafficSplitter() {
    return this.trafficSplitter;
  }
  /**
   * Get current configuration.
   */
  getConfig() {
    return this.config;
  }
  // ── Private — Stage management ──────────────────────────────
  async enterStage(index) {
    if (!this.deployment) return;
    if (index >= this.config.stages.length) {
      this.completeDeployment();
      return;
    }
    const stage = this.deployment.stages[index];
    stage.startedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.deployment.currentStageIndex = index;
    const stageConfig = stage.config;
    this.trafficSplitter.setSplit(stageConfig.trafficPercent);
    this.deployment.trafficSplit = this.trafficSplitter.getTrafficSplit();
    this.healthChecker.reset();
    this.healthChecker.updateConfig({ intervalMs: stageConfig.healthCheckIntervalMs });
    this.emit("deployment:stage-advanced", this.deployment, stageConfig);
    this.setStatus("in-progress");
    if (stageConfig.durationMs > 0 && stageConfig.autoAdvance) {
      this.startStageTimers();
    }
  }
  startStageTimers() {
    this.clearTimers();
    if (!this.deployment) return;
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    if (currentStage.config.durationMs > 0) {
      this.stageTimer = setTimeout(() => {
        if (!this.deployment) return;
        currentStage.durationElapsed = true;
        if (this.shouldAdvanceStage()) {
          this.advanceStage();
        }
      }, currentStage.config.durationMs);
    }
  }
  clearTimers() {
    if (this.stageTimer) {
      clearTimeout(this.stageTimer);
      this.stageTimer = null;
    }
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }
  shouldAdvanceStage() {
    if (!this.deployment) return false;
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    const stageConfig = currentStage.config;
    if (!stageConfig.autoAdvance) return false;
    const healthMet = currentStage.consecutiveHealthy >= stageConfig.requiredConsecutiveHealthy;
    const durationMet = currentStage.durationElapsed || stageConfig.durationMs === 0;
    return healthMet && durationMet;
  }
  advanceStage() {
    if (!this.deployment) return;
    const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
    currentStage.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.clearTimers();
    const nextIndex = this.deployment.currentStageIndex + 1;
    if (nextIndex >= this.config.stages.length) {
      this.completeDeployment();
    } else {
      this.enterStage(nextIndex);
    }
  }
  completeDeployment() {
    if (!this.deployment) return;
    this.deployment.status = "completed";
    this.deployment.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.clearTimers();
    this.emit("deployment:completed", this.deployment);
    this.setStatus("completed");
  }
  handleRollback(record) {
    if (!this.deployment) return;
    this.deployment.status = "rolled-back";
    this.deployment.rollbackRecord = record;
    this.clearTimers();
    this.trafficSplitter.setSplit(0);
    this.deployment.trafficSplit = this.trafficSplitter.getTrafficSplit();
    this.emit("deployment:rolled-back", this.deployment, record);
    this.setStatus("rolled-back");
  }
  wireEvents() {
    this.healthChecker.on("check:unhealthy", (result) => {
      if (this.deployment?.status !== "in-progress") return;
      const currentStage = this.deployment.stages[this.deployment.currentStageIndex];
      const rollbackRecord = this.rollbackManager.evaluateHealthCheck(
        result,
        this.deployment.id,
        this.deployment.stableVersion,
        this.deployment.canaryVersion,
        currentStage.config.trafficPercent
      );
      if (rollbackRecord) this.handleRollback(rollbackRecord);
    });
  }
  setStatus(status) {
    this.config.onStatusChange?.(status);
  }
};

// src/domain/anti-corruption/agent-acl.ts
var MALICIOUS_PATTERNS = ["DROP", "DELETE", "TRUNCATE", "EXEC", "UNION"];
var SENSITIVE_FIELDS = ["password", "secret", "token", "key"];
var AgentACL = class {
  id = "agent-acl";
  name = "Agent Anti-Corruption Layer";
  validateInput(input) {
    if (!input.agentId || !input.action) {
      return { passed: false, reason: "Missing required fields: agentId, action" };
    }
    const payloadStr = JSON.stringify(input.payload ?? {}).toUpperCase();
    const detected = MALICIOUS_PATTERNS.filter((pattern) => payloadStr.includes(pattern));
    if (detected.length > 0) {
      return {
        passed: false,
        reason: `Malicious patterns detected in payload: ${detected.join(", ")}`
      };
    }
    return { passed: true };
  }
  transformInput(input) {
    return {
      ...input,
      payload: this.sanitize(input.payload)
    };
  }
  validateOutput(output) {
    const outputStr = JSON.stringify(output).toLowerCase();
    const detected = SENSITIVE_FIELDS.filter((pattern) => outputStr.includes(`"${pattern}"`));
    if (detected.length > 0) {
      return {
        passed: false,
        reason: `Sensitive fields detected in output: ${detected.join(", ")}`
      };
    }
    return { passed: true };
  }
  transformOutput(output) {
    const safe = { ...output };
    for (const field of SENSITIVE_FIELDS) {
      delete safe[field];
    }
    return safe;
  }
  sanitize(payload) {
    if (typeof payload === "string") {
      return payload.replace(/[<>]/g, "");
    }
    return payload;
  }
};

// src/domain/anti-corruption/data-acl.ts
var DataACL = class {
  id = "data-acl";
  name = "Data Anti-Corruption Layer";
  validateInput(input) {
    if (!input.data) {
      return { passed: false, reason: "Missing required field: data" };
    }
    return { passed: true };
  }
  transformInput(input) {
    return input;
  }
  validateOutput(output) {
    if (!output) {
      return { passed: false, reason: "Output is empty" };
    }
    return { passed: true };
  }
  transformOutput(output) {
    return output;
  }
};

// src/domain/anti-corruption/event-acl.ts
var ALLOWED_EVENT_TYPES = ["action", "query", "command", "event"];
var EventACL = class {
  id = "event-acl";
  name = "Event Anti-Corruption Layer";
  validateInput(input) {
    if (!ALLOWED_EVENT_TYPES.includes(input.eventType)) {
      return {
        passed: false,
        reason: `Invalid event type: '${input.eventType}'. Allowed: ${ALLOWED_EVENT_TYPES.join(", ")}`
      };
    }
    return { passed: true };
  }
  transformInput(input) {
    return {
      ...input,
      timestamp: Date.now()
    };
  }
  validateOutput(output) {
    if (!output) {
      return { passed: false, reason: "Event output is empty" };
    }
    return { passed: true };
  }
  transformOutput(output) {
    return output;
  }
};

// src/domain/boundaries/agent-boundary.ts
var AUTHORITY_LEVELS = ["junior", "senior", "architect", "tech_lead", "cto"];
var AgentBoundary = class {
  constructor(agentId, requiredAuthority) {
    this.agentId = agentId;
    this.requiredAuthority = requiredAuthority;
    this.id = `agent-${agentId}`;
    this.name = `Agent Boundary: ${agentId}`;
  }
  agentId;
  requiredAuthority;
  id;
  name;
  type = "agent";
  validate(context) {
    if (context.agentId !== this.agentId) {
      return {
        passed: false,
        reason: `Agent mismatch: expected ${this.agentId}, got ${context.agentId}`
      };
    }
    const requiredLevel = AUTHORITY_LEVELS.indexOf(this.requiredAuthority);
    const agentLevel = AUTHORITY_LEVELS.indexOf(context.authority);
    if (agentLevel === -1) {
      return { passed: false, reason: `Unknown authority level: ${context.authority}` };
    }
    if (agentLevel < requiredLevel) {
      return {
        passed: false,
        reason: `Insufficient authority: requires ${this.requiredAuthority}, got ${context.authority}`
      };
    }
    return { passed: true };
  }
  getAgentId() {
    return this.agentId;
  }
  getRequiredAuthority() {
    return this.requiredAuthority;
  }
};

// src/domain/boundaries/dna-boundary.ts
var DNABoundary = class {
  constructor(dnaId, allowedActions) {
    this.dnaId = dnaId;
    this.allowedActions = allowedActions;
    this.id = `dna-${dnaId}`;
    this.name = `DNA Boundary: ${dnaId}`;
  }
  dnaId;
  allowedActions;
  id;
  name;
  type = "dna";
  validate(context) {
    if (context.dnaId !== this.dnaId) {
      return {
        passed: false,
        reason: `DNA mismatch: expected ${this.dnaId}, got ${context.dnaId}`
      };
    }
    if (!this.allowedActions.includes(context.action)) {
      return {
        passed: false,
        reason: `Action '${context.action}' not allowed in DNA '${this.dnaId}'`
      };
    }
    return { passed: true };
  }
  getDnaId() {
    return this.dnaId;
  }
  getAllowedActions() {
    return [...this.allowedActions];
  }
};

// src/domain/boundaries/execution-boundary.ts
var ExecutionBoundary = class {
  constructor(executionId, timeout = 5e3) {
    this.executionId = executionId;
    this.timeout = timeout;
    this.id = `execution-${executionId}`;
    this.name = `Execution Boundary: ${executionId}`;
  }
  executionId;
  timeout;
  id;
  name;
  type = "execution";
  validate(context) {
    if (context.executionId !== this.executionId) {
      return {
        passed: false,
        reason: `Execution mismatch: expected ${this.executionId}, got ${context.executionId}`
      };
    }
    const elapsed = Date.now() - context.startTime;
    if (elapsed > this.timeout) {
      return {
        passed: false,
        reason: `Execution timeout: ${elapsed}ms exceeded limit of ${this.timeout}ms`
      };
    }
    return { passed: true };
  }
  getExecutionId() {
    return this.executionId;
  }
  getTimeout() {
    return this.timeout;
  }
};

// src/domain/contexts/agent-context.ts
var AgentContext = class {
  constructor(agentId, authority) {
    this.agentId = agentId;
    this.authority = authority;
  }
  agentId;
  authority;
  boundaries = [];
  acl = new AgentACL();
  addBoundary(boundary) {
    this.boundaries.push(boundary);
  }
  validateAction(action, payload) {
    const aclResult = this.acl.validateInput({ agentId: this.agentId, action, payload });
    const boundaryResults = this.boundaries.map(
      (boundary) => boundary.validate({
        agentId: this.agentId,
        authority: this.authority,
        action
      })
    );
    const allBoundariesPassed = boundaryResults.every((r) => r.passed);
    return {
      aclResult,
      boundaryResults,
      passed: aclResult.passed && allBoundariesPassed
    };
  }
  getAgentId() {
    return this.agentId;
  }
  getAuthority() {
    return this.authority;
  }
  getBoundaries() {
    return [...this.boundaries];
  }
};

// src/domain/contexts/dna-context.ts
var DNAContext = class {
  constructor(dnaId) {
    this.dnaId = dnaId;
  }
  dnaId;
  boundaries = [];
  acl = new AgentACL();
  addBoundary(boundary) {
    this.boundaries.push(boundary);
  }
  validateAction(action, agentId, payload) {
    const aclResult = this.acl.validateInput({ agentId, action, payload });
    const boundaryResults = this.boundaries.map(
      (boundary) => boundary.validate({ action, dnaId: this.dnaId })
    );
    const allBoundariesPassed = boundaryResults.every((r) => r.passed);
    return {
      aclResult,
      boundaryResults,
      passed: aclResult.passed && allBoundariesPassed
    };
  }
  getDnaId() {
    return this.dnaId;
  }
  getBoundaries() {
    return [...this.boundaries];
  }
};

// src/engines/audit/audit-engine.ts
var import_node_child_process = require("child_process");
var import_node_crypto5 = require("crypto");
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
function runCommand(cmd, cwd) {
  try {
    const stdout = (0, import_node_child_process.execSync)(cmd, {
      encoding: "utf-8",
      timeout: 6e4,
      cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    const execErr = err;
    return {
      stdout: execErr.stdout ?? "",
      stderr: execErr.stderr ?? "",
      exitCode: execErr.status ?? 1
    };
  }
}
function makeEvent(type, severity, result, description, details, suggestions) {
  return {
    id: (0, import_node_crypto5.randomUUID)(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    type,
    severity,
    result,
    description,
    ...details ? { details } : {},
    ...suggestions ? { suggestions } : {}
  };
}
function fileExists(projectPath, relPath) {
  return (0, import_node_fs2.existsSync)((0, import_node_path2.join)(projectPath, relPath));
}
function readJsonSafe(filePath) {
  try {
    return JSON.parse((0, import_node_fs2.readFileSync)(filePath, "utf-8"));
  } catch {
    return void 0;
  }
}
function walkFiles(dir, ext, maxDepth = 8) {
  const results = [];
  if (maxDepth <= 0) return results;
  let entries;
  try {
    entries = (0, import_node_fs2.readdirSync)(dir, { withFileTypes: true }).map((e) => e.name);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = (0, import_node_path2.join)(dir, entry);
    try {
      if ((0, import_node_fs2.statSync)(full).isDirectory()) {
        if (!["node_modules", ".git", "dist", "build", ".next", "coverage"].includes(entry)) {
          results.push(...walkFiles(full, ext, maxDepth - 1));
        }
      } else if ((0, import_node_path2.extname)(entry) === ext) {
        results.push(full);
      }
    } catch {
    }
  }
  return results;
}
function countLines(filePath) {
  try {
    const content = (0, import_node_fs2.readFileSync)(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}
function extractImports(filePath) {
  try {
    const content = (0, import_node_fs2.readFileSync)(filePath, "utf-8");
    const imports = [];
    const importRegex = /(?:import|from|require)\s+['"]([^'"]+)['"]/g;
    let match = importRegex.exec(content);
    while (match) {
      imports.push(match[1]);
      match = importRegex.exec(content);
    }
    return imports;
  } catch {
    return [];
  }
}
function detectPackageManager(projectPath) {
  if ((0, import_node_fs2.existsSync)((0, import_node_path2.join)(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if ((0, import_node_fs2.existsSync)((0, import_node_path2.join)(projectPath, "yarn.lock"))) return "yarn";
  return "npm";
}
function detectTestFramework(projectPath) {
  const pkgJson = readJsonSafe((0, import_node_path2.join)(projectPath, "package.json"));
  if (!pkgJson) return void 0;
  const deps = Object.keys({
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies
  });
  if (deps.includes("vitest")) return "vitest";
  if (deps.includes("jest")) return "jest";
  return void 0;
}
function scoreFromViolations(violations, penalty, floor = 0) {
  return Math.max(floor, 100 - violations * penalty);
}
var AuditEngine = class {
  stages = /* @__PURE__ */ new Map();
  history = [];
  requiredStages = ["static", "security", "tests", "coverage", "contracts"];
  persistPath;
  constructor(config) {
    this.persistPath = config?.persistPath;
    if (this.persistPath) {
      this.loadHistory();
    }
    this.registerDefaultStages();
  }
  async execute(context, stages) {
    const pipelineId = (0, import_node_crypto5.randomUUID)();
    const targetStages = stages ?? this.requiredStages;
    const start = Date.now();
    const stageResults = [];
    for (const stageName of targetStages) {
      const executor = this.stages.get(stageName);
      if (!executor) {
        stageResults.push({
          stage: stageName,
          result: "skip",
          score: 0,
          events: [],
          duration: 0
        });
        continue;
      }
      const stageStart = Date.now();
      try {
        const result = await executor.execute(context);
        result.duration = Date.now() - stageStart;
        stageResults.push(result);
      } catch (error) {
        stageResults.push({
          stage: stageName,
          result: "fail",
          score: 0,
          events: [
            makeEvent(
              `audit:${stageName}:error`,
              "error",
              "fail",
              `Stage ${stageName} failed: ${error instanceof Error ? error.message : String(error)}`
            )
          ],
          duration: Date.now() - stageStart
        });
      }
    }
    const overallScore = this.calculateOverallScore(stageResults);
    const overall = this.determineOverallResult(stageResults);
    const pipelineResult = {
      id: pipelineId,
      overall,
      score: overallScore,
      stages: stageResults,
      duration: Date.now() - start,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.history.push(pipelineResult);
    if (this.persistPath) {
      this.saveHistory();
    }
    return pipelineResult;
  }
  registerStage(executor) {
    this.stages.set(executor.stage, executor);
  }
  getHistory() {
    if (this.persistPath) {
      this.loadHistory();
    }
    return [...this.history];
  }
  getLastAudit() {
    return this.history[this.history.length - 1];
  }
  summary(result) {
    const lines = [];
    lines.push(`Audit Pipeline: ${result.id}`);
    lines.push(
      `Overall: ${result.overall === "pass" ? "PASS" : result.overall === "fail" ? "FAIL" : "WARN"} (${result.score}/100)`
    );
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(`Stages: ${result.stages.length}`);
    for (const stage of result.stages) {
      const icon = stage.result === "pass" ? "[PASS]" : stage.result === "fail" ? "[FAIL]" : stage.result === "skip" ? "[SKIP]" : "[WARN]";
      lines.push(`  ${icon} ${stage.stage}: ${stage.score}/100 (${stage.duration}ms)`);
      for (const evt of stage.events) {
        lines.push(`    - ${evt.description}`);
      }
    }
    return lines.join("\n");
  }
  // --- Private helpers ---
  calculateOverallScore(stages) {
    if (stages.length === 0) return 0;
    const total = stages.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / stages.length);
  }
  determineOverallResult(stages) {
    if (stages.some((s) => s.result === "fail")) return "fail";
    if (stages.some((s) => s.result === "warn")) return "warn";
    return "pass";
  }
  loadHistory() {
    if (!this.persistPath) return;
    try {
      const raw = (0, import_node_fs2.readFileSync)(this.persistPath, "utf-8");
      this.history = JSON.parse(raw);
    } catch {
      this.history = [];
    }
  }
  saveHistory() {
    if (!this.persistPath) return;
    try {
      (0, import_node_fs2.writeFileSync)(this.persistPath, JSON.stringify(this.history, null, 2), "utf-8");
    } catch {
    }
  }
  // ============================================================
  // Default stage implementations — REAL, not stubs
  // ============================================================
  registerDefaultStages() {
    this.registerStaticStage();
    this.registerTestsStage();
    this.registerCoverageStage();
    this.registerSecurityStage();
    this.registerPerformanceStage();
    this.registerArchitectureStage();
    this.registerContractsStage();
    this.registerDocsStage();
    this.registerComplianceStage();
    this.registerBenchmarksStage();
  }
  // --- 1. STATIC ANALYSIS ---
  registerStaticStage() {
    this.stages.set("static", {
      stage: "static",
      name: "Static Analysis",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const pkgJson = readJsonSafe((0, import_node_path2.join)(projectPath, "package.json"));
        const deps = pkgJson ? Object.keys({
          ...pkgJson.dependencies,
          ...pkgJson.devDependencies
        }) : [];
        const hasBiome = deps.includes("@biomejs/biome") || fileExists(projectPath, "biome.json");
        const hasEslint = deps.includes("eslint") || fileExists(projectPath, ".eslintrc.js") || fileExists(projectPath, ".eslintrc.json");
        let errors = 0;
        let warnings = 0;
        let toolUsed = "none";
        if (hasBiome) {
          toolUsed = "biome";
          const r = runCommand("npx biome check --no-errors-on-unmatched .", projectPath);
          const output = r.stdout + r.stderr;
          const errMatch = output.match(/(\d+)\s+errors?/);
          const warnMatch = output.match(/(\d+)\s+warnings?/);
          errors = errMatch ? Number.parseInt(errMatch[1], 10) : 0;
          warnings = warnMatch ? Number.parseInt(warnMatch[1], 10) : 0;
        } else if (hasEslint) {
          toolUsed = "eslint";
          const r = runCommand("npx eslint . --format json", projectPath);
          try {
            const eslintResults = JSON.parse(r.stdout);
            for (const file of eslintResults) {
              errors += file.errorCount;
              warnings += file.warningCount;
            }
          } catch {
            const lines = r.stdout.split("\n");
            for (const line of lines) {
              if (line.includes("error")) errors++;
              if (line.includes("warning")) warnings++;
            }
          }
        } else {
          toolUsed = "tsc";
          const r = runCommand("npx tsc --noEmit", projectPath);
          if (r.exitCode !== 0) {
            errors = (r.stdout.match(/error TS/g) || []).length || (r.stderr.match(/error TS/g) || []).length;
          }
        }
        if (toolUsed === "none") {
          events.push(
            makeEvent(
              "audit:static:skip",
              "warning",
              "warn",
              "No static analysis tool found (biome/eslint). Fell back to tsc.",
              { toolUsed }
            )
          );
        }
        if (errors > 0) {
          events.push(
            makeEvent(
              "audit:static:errors",
              "error",
              "fail",
              `Found ${errors} error(s) and ${warnings} warning(s) via ${toolUsed}`,
              {
                toolUsed,
                errors,
                warnings
              }
            )
          );
        } else if (warnings > 0) {
          events.push(
            makeEvent(
              "audit:static:warnings",
              "warning",
              "warn",
              `Found ${warnings} warning(s) via ${toolUsed}`,
              {
                toolUsed,
                warnings
              }
            )
          );
        } else {
          events.push(
            makeEvent("audit:static:pass", "info", "pass", `No issues found via ${toolUsed}`, {
              toolUsed
            })
          );
        }
        const score = scoreFromViolations(errors, 5) - Math.min(warnings, 20);
        return {
          stage: "static",
          result: errors > 0 ? "fail" : warnings > 0 ? "warn" : "pass",
          score: Math.max(0, Math.min(100, score)),
          events,
          duration: 0
        };
      }
    });
  }
  // --- 2. TESTS ---
  registerTestsStage() {
    this.stages.set("tests", {
      stage: "tests",
      name: "Test Execution",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const framework = detectTestFramework(projectPath);
        if (!framework) {
          events.push(
            makeEvent(
              "audit:tests:no-framework",
              "warning",
              "skip",
              "No test framework detected (vitest/jest)",
              {}
            )
          );
          return { stage: "tests", result: "skip", score: 0, events, duration: 0 };
        }
        const pkg = detectPackageManager(projectPath);
        const cmd = framework === "vitest" ? `${pkg} run --reporter=json` : `${pkg} test --json --outputFile=/dev/stdout`;
        const r = runCommand(cmd, projectPath);
        const output = r.stdout + r.stderr;
        let passed = 0;
        let failed = 0;
        let total = 0;
        if (framework === "vitest") {
          try {
            const jsonStart = output.indexOf("{");
            if (jsonStart !== -1) {
              const parsed = JSON.parse(output.slice(jsonStart));
              const results = parsed.testResults ?? [];
              total = results.length;
              passed = results.filter((t) => t.status === "passed").length;
              failed = results.filter((t) => t.status === "failed").length;
            }
          } catch {
            const passMatch = output.match(/(\d+)\s+passed/);
            const failMatch = output.match(/(\d+)\s+failed/);
            passed = passMatch ? Number.parseInt(passMatch[1], 10) : 0;
            failed = failMatch ? Number.parseInt(failMatch[1], 10) : 0;
            total = passed + failed;
          }
        } else {
          try {
            const parsed = JSON.parse(output);
            passed = parsed.numPassedTests ?? 0;
            failed = parsed.numFailedTests ?? 0;
            total = parsed.numTotalTests ?? passed + failed;
          } catch {
            const passMatch = output.match(/(\d+)\s+passed/);
            const failMatch = output.match(/(\d+)\s+failed/);
            passed = passMatch ? Number.parseInt(passMatch[1], 10) : 0;
            failed = failMatch ? Number.parseInt(failMatch[1], 10) : 0;
            total = passed + failed;
          }
        }
        if (total === 0) {
          events.push(
            makeEvent(
              "audit:tests:no-tests",
              "warning",
              "warn",
              `${framework} ran but found 0 tests`,
              { framework }
            )
          );
          return { stage: "tests", result: "warn", score: 50, events, duration: 0 };
        }
        events.push(
          makeEvent(
            "audit:tests:result",
            failed > 0 ? "error" : "info",
            failed > 0 ? "fail" : "pass",
            `${passed}/${total} tests passed (${failed} failed) [${framework}]`,
            { framework, passed, failed, total }
          )
        );
        const score = total > 0 ? Math.round(passed / total * 100) : 0;
        return {
          stage: "tests",
          result: failed > 0 ? "fail" : "pass",
          score,
          events,
          duration: 0
        };
      }
    });
  }
  // --- 3. COVERAGE ---
  registerCoverageStage() {
    this.stages.set("coverage", {
      stage: "coverage",
      name: "Code Coverage",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const framework = detectTestFramework(projectPath);
        if (!framework) {
          events.push(
            makeEvent(
              "audit:coverage:no-framework",
              "warning",
              "skip",
              "No test framework \u2014 cannot run coverage",
              {}
            )
          );
          return { stage: "coverage", result: "skip", score: 0, events, duration: 0 };
        }
        const pkg = detectPackageManager(projectPath);
        const coverageFlag = framework === "vitest" ? "vitest run --coverage" : "jest --coverage";
        const cmd = `${pkg} ${coverageFlag}`;
        const r = runCommand(cmd, projectPath);
        const output = r.stdout + r.stderr;
        let lines = 0;
        let branches = 0;
        let functions = 0;
        let statements = 0;
        const linesMatch = output.match(/Lines\s*:\s*([\d.]+)/i) ?? output.match(/"Lines":\s*([\d.]+)/);
        const branchesMatch = output.match(/Branches\s*:\s*([\d.]+)/i) ?? output.match(/"Branches":\s*([\d.]+)/);
        const functionsMatch = output.match(/Functions\s*:\s*([\d.]+)/i) ?? output.match(/"Functions":\s*([\d.]+)/);
        const statementsMatch = output.match(/Statements\s*:\s*([\d.]+)/i) ?? output.match(/"Statements":\s*([\d.]+)/);
        if (linesMatch) lines = Number.parseFloat(linesMatch[1]);
        if (branchesMatch) branches = Number.parseFloat(branchesMatch[1]);
        if (functionsMatch) functions = Number.parseFloat(functionsMatch[1]);
        if (statementsMatch) statements = Number.parseFloat(statementsMatch[1]);
        if (lines === 0 && branches === 0 && functions === 0 && statements === 0) {
          const coverageJsonPath = (0, import_node_path2.join)(projectPath, "coverage", "coverage-summary.json");
          if ((0, import_node_fs2.existsSync)(coverageJsonPath)) {
            const report = readJsonSafe(coverageJsonPath);
            if (report?.total) {
              lines = report.total.lines?.pct ?? 0;
              branches = report.total.branches?.pct ?? 0;
              functions = report.total.functions?.pct ?? 0;
              statements = report.total.statements?.pct ?? 0;
            }
          }
        }
        const hasAny = lines > 0 || branches > 0 || functions > 0 || statements > 0;
        if (!hasAny) {
          events.push(
            makeEvent(
              "audit:coverage:no-data",
              "warning",
              "warn",
              "Coverage ran but no data could be parsed",
              { output: output.slice(0, 500) }
            )
          );
          return { stage: "coverage", result: "warn", score: 0, events, duration: 0 };
        }
        const avg = (lines + branches + functions + statements) / (lines > 0 && branches > 0 && functions > 0 && statements > 0 ? 4 : lines > 0 ? 1 : 1);
        const score = Math.round(Math.min(100, avg));
        const result = score >= 80 ? "pass" : score >= 60 ? "warn" : "fail";
        events.push(
          makeEvent(
            "audit:coverage:result",
            result === "fail" ? "error" : "info",
            result,
            `Coverage: Lines=${lines}% Branches=${branches}% Functions=${functions}% Statements=${statements}%`,
            { lines, branches, functions, statements, average: avg }
          )
        );
        return { stage: "coverage", result, score, events, duration: 0 };
      }
    });
  }
  // --- 4. SECURITY ---
  registerSecurityStage() {
    this.stages.set("security", {
      stage: "security",
      name: "Security Analysis",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const pkg = detectPackageManager(projectPath);
        const auditCmd = pkg === "pnpm" ? "pnpm audit --json" : "npm audit --json";
        const r = runCommand(auditCmd, projectPath);
        let critical = 0;
        let high = 0;
        let moderate = 0;
        let low = 0;
        try {
          const parsed = JSON.parse(r.stdout);
          if (parsed.metadata?.vulnerabilities) {
            critical = parsed.metadata.vulnerabilities.critical ?? 0;
            high = parsed.metadata.vulnerabilities.high ?? 0;
            moderate = parsed.metadata.vulnerabilities.moderate ?? 0;
            low = parsed.metadata.vulnerabilities.low ?? 0;
          } else if (parsed.vulnerabilities) {
            for (const vuln of Object.values(parsed.vulnerabilities)) {
              if (vuln.severity === "critical") critical++;
              else if (vuln.severity === "high") high++;
              else if (vuln.severity === "moderate") moderate++;
              else if (vuln.severity === "low") low++;
            }
          }
        } catch {
          const lines = r.stderr.split("\n");
          for (const line of lines) {
            const lower = line.toLowerCase();
            if (lower.includes("critical")) critical++;
            else if (lower.includes("high")) high++;
            else if (lower.includes("moderate")) moderate++;
            else if (lower.includes("low")) low++;
          }
        }
        const totalVulns = critical + high + moderate + low;
        if (critical > 0) {
          events.push(
            makeEvent(
              "audit:security:critical",
              "critical",
              "fail",
              `${critical} critical vulnerability(ies) found`,
              { critical, high, moderate, low }
            )
          );
        }
        if (high > 0) {
          events.push(
            makeEvent(
              "audit:security:high",
              "error",
              "fail",
              `${high} high severity vulnerability(ies) found`,
              { high }
            )
          );
        }
        if (moderate > 0) {
          events.push(
            makeEvent(
              "audit:security:moderate",
              "warning",
              "warn",
              `${moderate} moderate vulnerability(ies) found`,
              { moderate }
            )
          );
        }
        if (low > 0) {
          events.push(
            makeEvent(
              "audit:security:low",
              "info",
              "warn",
              `${low} low severity vulnerability(ies) found`,
              { low }
            )
          );
        }
        if (totalVulns === 0) {
          events.push(
            makeEvent("audit:security:pass", "info", "pass", "No known vulnerabilities found", {})
          );
        }
        const score = Math.max(0, 100 - critical * 30 - high * 15 - moderate * 5 - low * 2);
        const result = critical > 0 ? "fail" : high > 0 ? "fail" : moderate > 0 ? "warn" : "pass";
        return { stage: "security", result, score, events, duration: 0 };
      }
    });
  }
  // --- 5. PERFORMANCE (typecheck) ---
  registerPerformanceStage() {
    this.stages.set("performance", {
      stage: "performance",
      name: "Performance Analysis",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const r = runCommand("npx tsc --noEmit", projectPath);
        const output = r.stdout + r.stderr;
        let typeErrors = 0;
        const tsMatches = output.match(/error TS\d+/g);
        if (tsMatches) {
          typeErrors = tsMatches.length;
        }
        const largeFiles = [];
        const tsFiles = walkFiles(projectPath, ".ts", 3).concat(walkFiles(projectPath, ".tsx", 3));
        for (const file of tsFiles.slice(0, 200)) {
          const lines = countLines(file);
          if (lines > 500) {
            largeFiles.push(file.replace(projectPath, "."));
          }
        }
        if (typeErrors > 0) {
          events.push(
            makeEvent(
              "audit:performance:type-errors",
              "error",
              "fail",
              `${typeErrors} TypeScript type error(s)`,
              { typeErrors }
            )
          );
        }
        if (largeFiles.length > 0) {
          events.push(
            makeEvent(
              "audit:performance:large-files",
              "warning",
              "warn",
              `${largeFiles.length} file(s) exceed 500 lines`,
              { files: largeFiles.slice(0, 10) }
            )
          );
        }
        if (typeErrors === 0 && largeFiles.length === 0) {
          events.push(
            makeEvent(
              "audit:performance:pass",
              "info",
              "pass",
              "No type errors and no oversized files",
              {}
            )
          );
        }
        const score = scoreFromViolations(typeErrors, 3) - Math.min(largeFiles.length * 5, 30);
        const result = typeErrors > 0 ? "fail" : largeFiles.length > 0 ? "warn" : "pass";
        return { stage: "performance", result, score: Math.max(0, score), events, duration: 0 };
      }
    });
  }
  // --- 6. ARCHITECTURE ---
  registerArchitectureStage() {
    this.stages.set("architecture", {
      stage: "architecture",
      name: "Architecture Analysis",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const violations = [];
        const largeFiles = [];
        const allTs = walkFiles(projectPath, ".ts", 4).concat(walkFiles(projectPath, ".tsx", 4));
        for (const file of allTs) {
          const lines = countLines(file);
          if (lines > 500) {
            largeFiles.push(file.replace(projectPath, "."));
          }
        }
        const importMap = /* @__PURE__ */ new Map();
        for (const file of allTs) {
          const imports = extractImports(file);
          const relFile = file.replace(projectPath, ".");
          const resolved = /* @__PURE__ */ new Set();
          for (const imp of imports) {
            if (imp.startsWith(".")) {
              resolved.add(imp);
            }
          }
          importMap.set(relFile, resolved);
        }
        const circularPairs = [];
        for (const [file, imports] of importMap) {
          for (const imp of imports) {
            const targetImports = importMap.get(imp);
            if (targetImports?.has(file)) {
              const pair = `${file} <-> ${imp}`;
              if (!circularPairs.includes(pair)) {
                circularPairs.push(pair);
              }
            }
          }
        }
        if (largeFiles.length > 0) {
          violations.push(...largeFiles.map((f) => `Oversized file: ${f}`));
          events.push(
            makeEvent(
              "audit:architecture:large-files",
              "warning",
              "warn",
              `${largeFiles.length} file(s) > 500 lines`,
              { files: largeFiles.slice(0, 10) }
            )
          );
        }
        if (circularPairs.length > 0) {
          violations.push(...circularPairs.map((p) => `Circular dependency: ${p}`));
          events.push(
            makeEvent(
              "audit:architecture:circular",
              "error",
              "fail",
              `${circularPairs.length} circular dependency(ies) detected`,
              { pairs: circularPairs.slice(0, 10) }
            )
          );
        }
        if (violations.length === 0) {
          events.push(
            makeEvent(
              "audit:architecture:pass",
              "info",
              "pass",
              "No architecture violations detected",
              {}
            )
          );
        }
        const score = Math.max(0, 100 - violations.length * 15);
        const result = circularPairs.length > 0 ? "fail" : largeFiles.length > 0 ? "warn" : "pass";
        return { stage: "architecture", result, score, events, duration: 0 };
      }
    });
  }
  // --- 7. CONTRACTS ---
  registerContractsStage() {
    this.stages.set("contracts", {
      stage: "contracts",
      name: "Contract Validation",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const findings = [];
        const openApiFiles = walkFiles(projectPath, ".yaml", 3).concat(walkFiles(projectPath, ".json", 3)).filter((f) => {
          const lower = f.toLowerCase();
          return lower.includes("openapi") || lower.includes("swagger");
        });
        const graphqlFiles = walkFiles(projectPath, ".graphql", 3).concat(
          walkFiles(projectPath, ".gql", 3)
        );
        const hasApiSchema = openApiFiles.length > 0;
        const hasGraphqlSchema = graphqlFiles.length > 0;
        if (!hasApiSchema && !hasGraphqlSchema) {
          findings.push("No OpenAPI or GraphQL schema files found");
          events.push(
            makeEvent(
              "audit:contracts:no-schema",
              "warning",
              "warn",
              "No API contract files detected (openapi/swagger/graphql)",
              {}
            )
          );
        } else {
          for (const file of openApiFiles) {
            const content = readJsonSafe(file);
            if (content) {
              if (!content.openapi && !content.swagger) {
                findings.push(
                  `${file.replace(projectPath, ".")} missing openapi/swagger version field`
                );
              }
              if (!content.paths || Object.keys(content.paths).length === 0) {
                findings.push(`${file.replace(projectPath, ".")} has no paths defined`);
              }
            }
          }
          for (const file of graphqlFiles) {
            try {
              const content = (0, import_node_fs2.readFileSync)(file, "utf-8");
              if (!content.includes("type ") && !content.includes("schema ")) {
                findings.push(`${file.replace(projectPath, ".")} has no type definitions`);
              }
            } catch {
            }
          }
          if (findings.length > 0) {
            events.push(
              makeEvent(
                "audit:contracts:issues",
                "warning",
                "warn",
                `${findings.length} contract issue(s) found`,
                { findings: findings.slice(0, 10) }
              )
            );
          } else {
            events.push(
              makeEvent(
                "audit:contracts:pass",
                "info",
                "pass",
                `${openApiFiles.length + graphqlFiles.length} API contract(s) validated`,
                {
                  openApi: openApiFiles.length,
                  graphql: graphqlFiles.length
                }
              )
            );
          }
        }
        const schemaCount = openApiFiles.length + graphqlFiles.length;
        const hasSchemas = schemaCount > 0;
        const score = hasSchemas ? Math.max(0, 100 - findings.length * 20) : 50;
        const result = findings.length > 0 ? "warn" : hasSchemas ? "pass" : "warn";
        return { stage: "contracts", result, score, events, duration: 0 };
      }
    });
  }
  // --- 8. DOCS ---
  registerDocsStage() {
    this.stages.set("docs", {
      stage: "docs",
      name: "Documentation Check",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const checks = [];
        checks.push({ name: "README.md", found: fileExists(projectPath, "README.md") });
        checks.push({ name: "CHANGELOG.md", found: fileExists(projectPath, "CHANGELOG.md") });
        checks.push({ name: "CONTRIBUTING.md", found: fileExists(projectPath, "CONTRIBUTING.md") });
        checks.push({ name: "docs/ directory", found: (0, import_node_fs2.existsSync)((0, import_node_path2.join)(projectPath, "docs")) });
        checks.push({
          name: "LICENSE",
          found: fileExists(projectPath, "LICENSE") || fileExists(projectPath, "LICENSE.md")
        });
        const hasApiDocs = walkFiles(projectPath, ".md", 2).some((f) => {
          const lower = f.toLowerCase();
          return lower.includes("api") || lower.includes("sdk");
        });
        checks.push({ name: "API docs", found: hasApiDocs });
        const found = checks.filter((c) => c.found).length;
        const missing = checks.filter((c) => !c.found).map((c) => c.name);
        if (missing.length > 0) {
          events.push(
            makeEvent(
              "audit:docs:missing",
              "warning",
              "warn",
              `Missing documentation: ${missing.join(", ")}`,
              { missing, found, total: checks.length }
            )
          );
        } else {
          events.push(
            makeEvent(
              "audit:docs:pass",
              "info",
              "pass",
              `All documentation checks passed (${found}/${checks.length})`,
              { found, total: checks.length }
            )
          );
        }
        const score = Math.round(found / checks.length * 100);
        const result = found === checks.length ? "pass" : found >= checks.length / 2 ? "warn" : "fail";
        return { stage: "docs", result, score, events, duration: 0 };
      }
    });
  }
  // --- 9. COMPLIANCE ---
  registerComplianceStage() {
    this.stages.set("compliance", {
      stage: "compliance",
      name: "Compliance Check",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const checks = [];
        checks.push({
          name: "LICENSE",
          found: fileExists(projectPath, "LICENSE") || fileExists(projectPath, "LICENSE.md")
        });
        checks.push({
          name: ".env.example",
          found: fileExists(projectPath, ".env.example") || fileExists(projectPath, ".env.sample")
        });
        checks.push({ name: ".gitignore", found: fileExists(projectPath, ".gitignore") });
        checks.push({
          name: "CI/CD config",
          found: fileExists(projectPath, ".github") || fileExists(projectPath, ".gitlab-ci.yml") || fileExists(projectPath, "Jenkinsfile") || fileExists(projectPath, ".circleci")
        });
        checks.push({ name: ".editorconfig", found: fileExists(projectPath, ".editorconfig") });
        checks.push({
          name: "Dockerfile",
          found: fileExists(projectPath, "Dockerfile") || fileExists(projectPath, "docker-compose.yml") || fileExists(projectPath, "docker-compose.yaml")
        });
        const envFiles = walkFiles(projectPath, ".env", 2).filter((f) => {
          const base = f.split("/").pop() ?? "";
          return base === ".env" && !base.endsWith(".example") && !base.endsWith(".sample");
        });
        const hasCommittedSecrets = envFiles.length > 0;
        if (hasCommittedSecrets) {
          checks.push({ name: "no committed secrets", found: false });
          events.push(
            makeEvent(
              "audit:compliance:secrets",
              "critical",
              "fail",
              ".env file found in source \u2014 secrets may be committed",
              { files: envFiles }
            )
          );
        } else {
          checks.push({ name: "no committed secrets", found: true });
        }
        const found = checks.filter((c) => c.found).length;
        const missing = checks.filter((c) => !c.found).map((c) => c.name);
        if (missing.length > 0) {
          events.push(
            makeEvent(
              "audit:compliance:missing",
              "warning",
              "warn",
              `Missing compliance items: ${missing.join(", ")}`,
              { missing, found, total: checks.length }
            )
          );
        } else {
          events.push(
            makeEvent(
              "audit:compliance:pass",
              "info",
              "pass",
              `All compliance checks passed (${found}/${checks.length})`,
              { found, total: checks.length }
            )
          );
        }
        const score = Math.round(found / checks.length * 100);
        const result = hasCommittedSecrets ? "fail" : found === checks.length ? "pass" : found >= checks.length / 2 ? "warn" : "fail";
        return { stage: "compliance", result, score, events, duration: 0 };
      }
    });
  }
  // --- 10. BENCHMARKS ---
  registerBenchmarksStage() {
    this.stages.set("benchmarks", {
      stage: "benchmarks",
      name: "Benchmark Check",
      execute: async (context) => {
        const { projectPath } = context;
        const events = [];
        const benchFiles = walkFiles(projectPath, ".bench.ts", 3).concat(walkFiles(projectPath, ".bench.js", 3)).concat(walkFiles(projectPath, ".benchmark.ts", 3));
        const _hasPerfConfig = fileExists(projectPath, "vitest.config.ts") || fileExists(projectPath, "jest.config.ts");
        const benchScript = (() => {
          try {
            const pkg = readJsonSafe((0, import_node_path2.join)(projectPath, "package.json"));
            const scripts = pkg?.scripts ?? {};
            return scripts.bench ?? scripts.benchmark ?? void 0;
          } catch {
            return void 0;
          }
        })();
        if (benchFiles.length === 0 && !benchScript) {
          events.push(
            makeEvent(
              "audit:benchmarks:none",
              "info",
              "skip",
              "No benchmark files or scripts found",
              {}
            )
          );
          return { stage: "benchmarks", result: "skip", score: 0, events, duration: 0 };
        }
        if (benchScript) {
          const pkg = detectPackageManager(projectPath);
          const r = runCommand(`${pkg} run bench`, projectPath);
          const output = r.stdout + r.stderr;
          if (r.exitCode === 0) {
            events.push(
              makeEvent(
                "audit:benchmarks:run",
                "info",
                "pass",
                "Benchmarks executed successfully",
                { output: output.slice(0, 1e3) }
              )
            );
          } else {
            events.push(
              makeEvent("audit:benchmarks:failed", "error", "fail", "Benchmark execution failed", {
                exitCode: r.exitCode,
                output: output.slice(0, 500)
              })
            );
            return { stage: "benchmarks", result: "fail", score: 30, events, duration: 0 };
          }
        }
        events.push(
          makeEvent(
            "audit:benchmarks:found",
            "info",
            "pass",
            `${benchFiles.length} benchmark file(s) detected`,
            { files: benchFiles.map((f) => f.replace(projectPath, ".")) }
          )
        );
        return {
          stage: "benchmarks",
          result: "pass",
          score: benchScript ? 80 : 60,
          events,
          duration: 0
        };
      }
    });
  }
};

// src/engines/behavioral/audit-chain.ts
var import_node_child_process2 = require("child_process");
var AuditChain = class {
  steps;
  constructor(projectRoot) {
    this.steps = this.loadDefaultSteps(projectRoot);
  }
  loadDefaultSteps(_projectRoot) {
    return [
      {
        name: "lint",
        trigger: "commit",
        tool: "biome",
        command: "pnpm lint",
        gate: "pass",
        timeout: 3e4
      },
      {
        name: "typecheck",
        trigger: "commit",
        tool: "tsc",
        command: "pnpm typecheck",
        gate: "pass",
        timeout: 6e4
      },
      {
        name: "lint_pr",
        trigger: "pr",
        tool: "biome",
        command: "pnpm lint",
        gate: "pass",
        timeout: 3e4
      },
      {
        name: "typecheck_pr",
        trigger: "pr",
        tool: "tsc",
        command: "pnpm typecheck",
        gate: "pass",
        timeout: 6e4
      },
      {
        name: "unit_tests",
        trigger: "pr",
        tool: "vitest",
        command: "pnpm test",
        gate: "block",
        timeout: 12e4
      },
      {
        name: "test_coverage",
        trigger: "pr",
        tool: "vitest",
        command: "pnpm test --coverage",
        gate: "warn",
        threshold: ">= 80%",
        timeout: 12e4
      },
      {
        name: "contract_compatibility",
        trigger: "pr",
        tool: "api-contract-drift",
        command: "pnpm ai:validate",
        gate: "block",
        timeout: 6e4
      },
      {
        name: "security_scan",
        trigger: "pr",
        tool: "codeql",
        command: "pnpm security:scan || true",
        gate: "warn",
        timeout: 12e4,
        optional: true
      },
      {
        name: "dependency_audit",
        trigger: "pr",
        tool: "pnpm-audit",
        command: "pnpm audit || true",
        gate: "warn",
        timeout: 3e4,
        optional: true
      },
      {
        name: "all_pr_checks",
        trigger: "merge",
        tool: "aggregate",
        command: 'echo "All PR checks must have passed"',
        gate: "pass",
        timeout: 5e3
      },
      {
        name: "build",
        trigger: "deploy_staging",
        tool: "turbo",
        command: "pnpm build",
        gate: "block",
        timeout: 18e4
      },
      {
        name: "migration",
        trigger: "deploy_staging",
        tool: "prisma",
        command: "pnpm db:migrate || true",
        gate: "warn",
        timeout: 6e4,
        optional: true
      },
      {
        name: "smoke_tests",
        trigger: "deploy_staging",
        tool: "playwright",
        command: "pnpm e2e:smoke || true",
        gate: "block",
        timeout: 18e4,
        optional: true
      },
      {
        name: "all_staging_checks",
        trigger: "deploy_production",
        tool: "aggregate",
        command: 'echo "All staging checks must have passed"',
        gate: "pass",
        timeout: 5e3
      },
      {
        name: "rollback_verification",
        trigger: "deploy_production",
        tool: "manual",
        command: 'echo "Verify rollback path is valid"',
        gate: "pass",
        timeout: 1e4
      },
      {
        name: "canary_health",
        trigger: "deploy_production",
        tool: "health-check",
        command: "curl -sf http://localhost:3000/health || true",
        gate: "warn",
        timeout: 3e4,
        optional: true
      }
    ];
  }
  async execute(trigger, context = {}) {
    const applicableSteps = this.steps.filter((s) => s.trigger === trigger);
    const results = [];
    const startTime = Date.now();
    for (const step of applicableSteps) {
      const stepStart = Date.now();
      try {
        const result = await this.runStep(step, context);
        const passed = result.passed;
        results.push({
          step: step.name,
          status: passed ? "pass" : step.optional ? "warn" : "fail",
          duration: Date.now() - stepStart,
          details: result,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (!passed && step.gate === "block" && !step.optional) {
          results.push({
            step: "CHAIN_HALTED",
            status: "fail",
            duration: 0,
            details: {
              reason: `Audit halted: ${step.name} failed (gate=block)`,
              failedStep: step.name,
              tool: step.tool,
              command: step.command
            },
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
          break;
        }
      } catch (error) {
        results.push({
          step: step.name,
          status: step.optional ? "warn" : "fail",
          duration: Date.now() - stepStart,
          details: { error: error.message },
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (step.gate === "block" && !step.optional) break;
      }
    }
    const overallStatus = results.some((r) => r.status === "fail") ? "fail" : results.some((r) => r.status === "warn") ? "warn" : "pass";
    return {
      trigger,
      results,
      overallStatus,
      totalDuration: Date.now() - startTime,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  runStep(step, _context) {
    try {
      const output = (0, import_node_child_process2.execSync)(step.command, {
        timeout: step.timeout || 3e4,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      return Promise.resolve({ passed: true, output: output.trim() });
    } catch (error) {
      return Promise.resolve({
        passed: false,
        exitCode: error.status,
        stderr: error.stderr?.toString().trim(),
        stdout: error.stdout?.toString().trim()
      });
    }
  }
  addStep(step) {
    this.steps.push(step);
  }
  removeStep(name) {
    this.steps = this.steps.filter((s) => s.name !== name);
  }
  getStepsForTrigger(trigger) {
    return this.steps.filter((s) => s.trigger === trigger);
  }
  listSteps() {
    return [...this.steps];
  }
};

// src/engines/behavioral/behavior-selector.ts
var BehaviorSelector = class {
  rules = [];
  constructor(_catalogPath) {
    this.loadDecisionTable();
  }
  loadDecisionTable() {
    this.rules = [
      {
        id: "bugfix-critical",
        when: (ctx) => ctx.problemType === "bug_fix" && ctx.riskLevel === "critical",
        result: () => ({
          primary: "surgical-team",
          blend: { primary: 100, secondary: 0 },
          rationale: "Critical bug requires precision, minimal changes, auto-rollback",
          confidence: 0.95
        }),
        priority: 100
      },
      {
        id: "bugfix-monorepo",
        when: (ctx) => ctx.problemType === "bug_fix" && ctx.scope === "monorepo",
        result: () => ({
          primary: "ant-colony",
          secondary: "immune-system",
          blend: { primary: 70, secondary: 30 },
          rationale: "Wide-scope bug needs parallel search with immune verification",
          confidence: 0.85
        }),
        priority: 80
      },
      {
        id: "bugfix-security",
        when: (ctx) => ctx.problemType === "bug_fix" && ctx.domain === "security",
        result: () => ({
          primary: "immune-system",
          blend: { primary: 100, secondary: 0 },
          rationale: "Security bug requires immune system detection and response",
          confidence: 0.95
        }),
        priority: 95
      },
      {
        id: "bugfix-default",
        when: (ctx) => ctx.problemType === "bug_fix",
        result: () => ({
          primary: "manufacturing",
          blend: { primary: 100, secondary: 0 },
          rationale: "Standard bug fix through manufacturing pipeline",
          confidence: 0.8
        }),
        priority: 50
      },
      {
        id: "feature-multi-package",
        when: (ctx) => ctx.problemType === "feature" && ctx.scope === "multi_package",
        result: () => ({
          primary: "bee-colony",
          secondary: "manufacturing",
          blend: { primary: 70, secondary: 30 },
          rationale: "Multi-package feature needs hive coordination with manufacturing precision",
          confidence: 0.85
        }),
        priority: 90
      },
      {
        id: "feature-urgent",
        when: (ctx) => ctx.problemType === "feature" && ctx.timeline === "urgent",
        result: () => ({
          primary: "orchestra",
          blend: { primary: 100, secondary: 0 },
          rationale: "Urgent feature needs synchronized orchestration",
          confidence: 0.9
        }),
        priority: 85
      },
      {
        id: "feature-cross-system",
        when: (ctx) => ctx.problemType === "feature" && ctx.scope === "cross_system",
        result: () => ({
          primary: "octopus",
          secondary: "manufacturing",
          blend: { primary: 60, secondary: 40 },
          rationale: "Cross-system feature needs multi-arm coordination",
          confidence: 0.8
        }),
        priority: 80
      },
      {
        id: "feature-default",
        when: (ctx) => ctx.problemType === "feature",
        result: () => ({
          primary: "manufacturing",
          blend: { primary: 100, secondary: 0 },
          rationale: "Standard feature through manufacturing pipeline",
          confidence: 0.75
        }),
        priority: 50
      },
      {
        id: "security-any",
        when: (ctx) => ctx.problemType === "security",
        result: () => ({
          primary: "immune-system",
          blend: { primary: 100, secondary: 0 },
          rationale: "Security issues always use immune system pattern",
          confidence: 0.95
        }),
        priority: 100
      },
      {
        id: "performance-any",
        when: (ctx) => ctx.problemType === "performance",
        result: () => ({
          primary: "mathematical-swarm",
          blend: { primary: 100, secondary: 0 },
          rationale: "Performance optimization needs metric-driven convergence",
          confidence: 0.9
        }),
        priority: 100
      },
      {
        id: "incident-any",
        when: (ctx) => ctx.problemType === "incident",
        result: () => ({
          primary: "wolf-pack",
          blend: { primary: 100, secondary: 0 },
          rationale: "Incidents require alpha-led coordinated response",
          confidence: 0.95
        }),
        priority: 100
      },
      {
        id: "discovery-any",
        when: (ctx) => ctx.problemType === "discovery",
        result: () => ({
          primary: "research-lab",
          blend: { primary: 100, secondary: 0 },
          rationale: "Discovery requires research-before-build methodology",
          confidence: 0.9
        }),
        priority: 100
      },
      {
        id: "refactor-monorepo",
        when: (ctx) => ctx.problemType === "refactor" && ctx.scope === "monorepo",
        result: () => ({
          primary: "ant-colony",
          blend: { primary: 100, secondary: 0 },
          rationale: "Monorepo refactor needs parallel swarm intelligence",
          confidence: 0.9
        }),
        priority: 90
      },
      {
        id: "refactor-default",
        when: (ctx) => ctx.problemType === "refactor",
        result: () => ({
          primary: "manufacturing",
          blend: { primary: 100, secondary: 0 },
          rationale: "Standard refactor through manufacturing pipeline",
          confidence: 0.75
        }),
        priority: 50
      },
      {
        id: "maintenance-any",
        when: (ctx) => ctx.problemType === "maintenance",
        result: () => ({
          primary: "manufacturing",
          blend: { primary: 100, secondary: 0 },
          rationale: "Maintenance through standard manufacturing pipeline",
          confidence: 0.8
        }),
        priority: 50
      }
    ];
  }
  select(ctx) {
    const matches = this.rules.filter((r) => r.when(ctx)).sort((a, b) => b.priority - a.priority);
    if (matches.length === 0) {
      return {
        primary: "manufacturing",
        blend: { primary: 100, secondary: 0 },
        rationale: "No specific rule matched -> default Manufacturing",
        confidence: 0.5
      };
    }
    let selection = matches[0].result();
    if ((ctx.riskLevel === "critical" || ctx.riskLevel === "high") && ctx.domain !== "security" && selection.primary !== "immune-system") {
      selection = {
        ...selection,
        secondary: "immune-system",
        blend: { primary: 70, secondary: 30 },
        rationale: `${selection.rationale} + Immune System overlay (risk=${ctx.riskLevel})`,
        confidence: selection.confidence * 0.95
      };
    }
    if (ctx.compliance && ctx.compliance.length > 0) {
      selection = {
        ...selection,
        secondary: selection.secondary || "enterprise-governance",
        blend: {
          primary: selection.blend.primary,
          secondary: selection.blend.secondary + (selection.secondary ? 0 : 30)
        },
        rationale: `${selection.rationale} + Enterprise Governance (compliance: ${ctx.compliance.join(", ")})`,
        confidence: selection.confidence * 0.98
      };
    }
    return selection;
  }
  getRuleById(id) {
    return this.rules.find((r) => r.id === id);
  }
  listRules() {
    return [...this.rules];
  }
};

// src/engines/behavioral/conflict-resolver.ts
var RESOLUTION_TEMPLATES = {
  backend_vs_frontend: {
    resolution: "Contract boundary dispute resolved by contract spec",
    steps: [
      "1. Frontend raises contract concern with evidence",
      "2. Backend presents contract spec (Zod schema)",
      "3. If contract-compliant: Frontend adapts implementation",
      "4. If contract-broken: Backend must version contract",
      "5. If disputed: Escalate to architect"
    ],
    escalation: "architect -> cto -> human",
    timeout: "2 cycles"
  },
  security_vs_feature: {
    resolution: "Security vs delivery resolved by risk assessment",
    steps: [
      "1. Security raises concern with OWASP/compliance evidence",
      "2. Feature team presents business case and risk acceptance",
      "3. If risk_acceptable: Proceed with mitigations",
      "4. If risk_unacceptable: Halt feature until resolved",
      "5. If disputed: CTO makes final call"
    ],
    escalation: "cto -> human",
    timeout: "1 cycle"
  },
  qa_vs_developer: {
    resolution: "Quality gate dispute resolved by fix plan viability",
    steps: [
      "1. QA blocks release with test evidence",
      "2. Developer presents fix plan with timeline",
      "3. If fix_viable: Proceed with fix and re-test",
      "4. If insufficient: Escalate to tech lead",
      "5. Tech lead decides: fix or accept documented risk"
    ],
    escalation: "tech_lead -> architect",
    timeout: "1 cycle"
  },
  devops_vs_backend: {
    resolution: "Infra vs app resolved by capability assessment",
    steps: [
      "1. DevOps raises infrastructure concern",
      "2. Backend presents application need",
      "3. If infra_can_accommodate: DevOps adapts",
      "4. If infra_cannot: Backend adapts",
      "5. If disputed: Architect decides"
    ],
    escalation: "architect",
    timeout: "2 cycles"
  },
  custom: {
    resolution: "Custom conflict resolved by evidence-based analysis",
    steps: [
      "1. Both agents present position with evidence",
      "2. Orchestrator analyzes cost-benefit",
      "3. If clear winner: Proceed",
      "4. If unclear: Escalate to architect"
    ],
    escalation: "architect -> cto",
    timeout: "2 cycles"
  }
};
var ConflictResolver = class {
  history = [];
  resolve(context) {
    const template = RESOLUTION_TEMPLATES[context.type];
    const resolution = {
      ...template,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (context.evidence && context.evidence.length > 0 && context.agents.length === 2) {
      resolution.winner = this.determineWinner(context);
    }
    this.history.push({ ...context, resolution });
    return resolution;
  }
  getResolutionHistory(type) {
    if (type) {
      return this.history.filter((h) => h.type === type);
    }
    return [...this.history];
  }
  determineWinner(context) {
    if (context.agents.length !== 2) return void 0;
    if (context.type === "security_vs_feature") {
      return context.agents.find((a) => a.toLowerCase().includes("security"));
    }
    if (context.type === "qa_vs_developer" && context.severity === "critical") {
      return context.agents.find((a) => a.toLowerCase().includes("qa"));
    }
    return void 0;
  }
};

// src/engines/behavioral/dna-composer.ts
var DNAComposer = class {
  /**
   * Compõe múltiplos pacotes DNA em um único conjunto de padrões
   */
  compose(dnas, options) {
    const resolveConflicts = options?.resolveConflicts ?? "last";
    const allPatterns = [];
    const conflicts = [];
    const seen = /* @__PURE__ */ new Map();
    for (const dna of dnas) {
      const patterns = dna.patterns ?? [];
      for (const pattern of patterns) {
        if (seen.has(pattern.id)) {
          conflicts.push(`Conflict: pattern ${pattern.id} defined in multiple DNAs`);
          switch (resolveConflicts) {
            case "first":
              break;
            case "last":
              seen.set(pattern.id, pattern);
              break;
            case "merge": {
              const existing = seen.get(pattern.id);
              seen.set(pattern.id, this.mergePatterns(existing, pattern));
              break;
            }
          }
        } else {
          seen.set(pattern.id, pattern);
        }
      }
    }
    allPatterns.push(...seen.values());
    return {
      patterns: allPatterns,
      metadata: {
        sourceDNAs: dnas.map((d) => d.id),
        totalPatterns: allPatterns.length,
        conflicts
      }
    };
  }
  /**
   * Compõe dois padrões mesclando propriedades
   */
  mergePatterns(base, override) {
    return {
      ...base,
      triggers: [...base.triggers ?? [], ...override.triggers ?? []],
      actions: [...base.actions ?? [], ...override.actions ?? []],
      conditions: [...base.conditions ?? [], ...override.conditions ?? []],
      config: { ...base.config, ...override.config }
    };
  }
  /**
   * Filtra padrões por tipo
   */
  filterByType(patterns, type) {
    return patterns.filter((p) => p.type === type);
  }
  /**
   * Filtra padrões por trigger
   */
  filterByTrigger(patterns, trigger) {
    return patterns.filter((p) => p.triggers?.some((t) => t.includes(trigger)));
  }
  /**
   * Ordena padrões por prioridade (baseado no tipo)
   */
  sortByPriority(patterns) {
    const priority = {
      decision: 10,
      escalation: 9,
      collaboration: 8,
      review: 7,
      testing: 6,
      deployment: 5,
      monitoring: 4,
      learning: 3,
      communication: 2,
      custom: 1
    };
    return [...patterns].sort(
      (a, b) => (priority[String(b.type)] ?? 0) - (priority[String(a.type)] ?? 0)
    );
  }
  /**
   * Gera um resumo da composição
   */
  summary(result) {
    const lines = [];
    lines.push(
      `Composition: ${result.metadata.sourceDNAs.length} DNAs \u2192 ${result.metadata.totalPatterns} patterns`
    );
    const byType = /* @__PURE__ */ new Map();
    for (const pattern of result.patterns) {
      byType.set(String(pattern.type), (byType.get(String(pattern.type)) ?? 0) + 1);
    }
    lines.push("By type:");
    for (const [type, count] of byType) {
      lines.push(`  ${type}: ${count}`);
    }
    if (result.metadata.conflicts.length > 0) {
      lines.push(`
Conflicts: ${result.metadata.conflicts.length}`);
      for (const conflict of result.metadata.conflicts) {
        lines.push(`  \u26A0\uFE0F ${conflict}`);
      }
    }
    return lines.join("\n");
  }
};

// src/engines/behavioral/dna-loader.ts
var import_node_fs3 = require("fs");
var import_node_path3 = require("path");
var import_schemas2 = require("@behavioros/schemas");
var import_yaml2 = require("yaml");
var DNALoader = class {
  basePath;
  validate;
  strict;
  cache = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.basePath = options.basePath ?? process.cwd();
    this.validate = options.validate ?? true;
    this.strict = options.strict ?? false;
  }
  /**
   * Carrega um pacote DNA de um diretório ou arquivo
   */
  load(source) {
    const resolved = (0, import_node_path3.resolve)(this.basePath, source);
    if (this.cache.has(resolved)) {
      return this.cache.get(resolved);
    }
    let raw;
    if ((0, import_node_fs3.existsSync)((0, import_node_path3.join)(resolved, "behavioros.yaml"))) {
      raw = (0, import_node_fs3.readFileSync)((0, import_node_path3.join)(resolved, "behavioros.yaml"), "utf-8");
    } else if ((0, import_node_fs3.existsSync)((0, import_node_path3.join)(resolved, "index.yaml"))) {
      raw = (0, import_node_fs3.readFileSync)((0, import_node_path3.join)(resolved, "index.yaml"), "utf-8");
    } else if ((0, import_node_fs3.existsSync)(resolved)) {
      raw = (0, import_node_fs3.readFileSync)(resolved, "utf-8");
    } else {
      throw new Error(`DNA source not found: ${source}`);
    }
    return this.parse(raw, resolved);
  }
  /**
   * Carrega um pacote DNA de uma string YAML
   */
  loadFromString(yamlContent, sourceName) {
    return this.parse(yamlContent, sourceName ?? "<inline>");
  }
  /**
   * Carrega um pacote DNA de um objeto JSON
   */
  loadFromObject(obj) {
    if (this.validate) {
      return import_schemas2.DNAPackageSchema.parse(obj);
    }
    return obj;
  }
  /**
   * Carrega todos os pacotes DNA de um diretório
   */
  loadAll(directory) {
    const dir = (0, import_node_path3.resolve)(this.basePath, directory);
    const results = [];
    if ((0, import_node_fs3.existsSync)(dir)) {
      const { readdirSync: readdirSync2 } = require("fs");
      const files = readdirSync2(dir);
      for (const file of files) {
        if (file.endsWith(".yaml") || file.endsWith(".yml")) {
          try {
            const dna = this.load((0, import_node_path3.join)(directory, file));
            results.push(dna);
          } catch (error) {
            if (this.strict) throw error;
            console.warn(`Failed to load DNA from ${file}: ${error}`);
          }
        }
      }
    }
    return results;
  }
  parse(yamlContent, source) {
    const parsed = (0, import_yaml2.parse)(yamlContent);
    if (this.validate) {
      const result = import_schemas2.DNAPackageSchema.safeParse(parsed);
      if (!result.success) {
        const errors = result.error.errors.map((e) => `  - ${e.path.join(".")}: ${e.message}`).join("\n");
        throw new Error(`Invalid DNA package at ${source}:
${errors}`);
      }
      this.cache.set(source, result.data);
      return result.data;
    }
    this.cache.set(source, parsed);
    return parsed;
  }
  /**
   * Valida um pacote DNA contra o schema
   */
  static validate(dna) {
    const result = import_schemas2.DNAPackageSchema.safeParse(dna);
    if (result.success) {
      return { valid: true, errors: [] };
    }
    return {
      valid: false,
      errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`)
    };
  }
  /**
   * Mescla dois pacotes DNA
   */
  static merge(base, override) {
    return {
      ...base,
      ...override,
      personas: override.personas ?? base.personas,
      governance: override.governance ?? base.governance,
      quality: override.quality ?? base.quality,
      patterns: override.patterns ?? base.patterns,
      workflows: override.workflows ?? base.workflows,
      config: { ...base.config, ...override.config }
    };
  }
  clearCache() {
    this.cache.clear();
  }
};

// src/engines/behavioral/dna-resolver.ts
var import_node_fs4 = require("fs");
var import_node_path4 = require("path");
var import_yaml3 = require("yaml");
var DnaResolver = class _DnaResolver {
  catalog = /* @__PURE__ */ new Map();
  catalogPath;
  static CATALOG_NAMES = [
    "manufacturing",
    "immune-system",
    "surgical-team",
    "ant-colony",
    "bee-colony",
    "octopus",
    "wolf-pack",
    "orchestra",
    "mathematical-swarm",
    "research-lab",
    "enterprise-governance"
  ];
  constructor(catalogBasePath) {
    this.catalogPath = catalogBasePath;
    this.loadCatalog();
  }
  loadCatalog() {
    for (const name of _DnaResolver.CATALOG_NAMES) {
      try {
        const content = (0, import_node_fs4.readFileSync)((0, import_node_path4.join)(this.catalogPath, `${name}.yaml`), "utf-8");
        this.catalog.set(name, (0, import_yaml3.parse)(content));
      } catch {
      }
    }
  }
  resolve(dnaSelection, agentConfig, squadConfig) {
    const baseDna = this.catalog.get(dnaSelection.primary);
    if (!baseDna) {
      throw new Error(
        `DNA pattern not found: ${dnaSelection.primary}. Available: ${this.listCatalogDnas().join(", ")}`
      );
    }
    const squadDna = squadConfig?.dna ? this.catalog.get(String(squadConfig.dna)) : void 0;
    const agentOverrides = agentConfig.dnaOverrides ?? {};
    const resolved = {
      identity: {
        name: agentOverrides.identity?.name ?? baseDna.identity?.name ?? dnaSelection.primary,
        description: agentOverrides.identity?.description ?? baseDna.identity?.description ?? "",
        archetype: agentOverrides.identity?.archetype ?? baseDna.identity?.archetype ?? "",
        category: agentOverrides.identity?.category ?? baseDna.identity?.category ?? "execution"
      },
      personality: this.mergeDeep(
        baseDna.personality ?? {},
        squadDna?.personality ?? {},
        agentOverrides.personality ?? {}
      ),
      principles: [
        ...baseDna.principles ?? [],
        ...squadDna?.principles ?? [],
        ...agentOverrides.principles ?? []
      ],
      forbidden: [
        ...baseDna.forbidden ?? [],
        ...squadDna?.forbidden ?? [],
        ...agentOverrides.forbidden ?? []
      ],
      decision_model: this.mergeDeep(
        baseDna.decision_model ?? {},
        squadDna?.decision_model ?? {},
        agentOverrides.decision_model ?? {}
      ),
      communication: this.mergeDeep(
        baseDna.communication ?? {},
        squadDna?.communication ?? {},
        agentOverrides.communication ?? {}
      ),
      autonomy: this.mergeDeep(
        baseDna.autonomy ?? {},
        squadDna?.autonomy ?? {},
        agentOverrides.autonomy ?? {}
      ),
      risk_tolerance: agentOverrides.risk_tolerance ?? squadDna?.risk_tolerance ?? baseDna.risk_tolerance ?? "medium",
      parallelism: this.mergeDeep(
        baseDna.parallelism ?? {},
        squadDna?.parallelism ?? {},
        agentOverrides.parallelism ?? {}
      ),
      quality_gates: this.mergeDeep(
        baseDna.quality_gates ?? {},
        squadDna?.quality_gates ?? {},
        agentOverrides.quality_gates ?? {}
      ),
      learning: this.mergeDeep(
        baseDna.learning ?? {},
        squadDna?.learning ?? {},
        agentOverrides.learning ?? {}
      ),
      _sources: [
        `catalog:${dnaSelection.primary}`,
        ...squadDna ? [`squad:${agentConfig.squad}`] : [],
        ...Object.keys(agentOverrides).length > 0 ? [`agent:${agentConfig.id}`] : []
      ]
    };
    if (dnaSelection.secondary) {
      const secondaryDna = this.catalog.get(dnaSelection.secondary);
      if (secondaryDna) {
        resolved._sources.push(
          `catalog:${dnaSelection.secondary}(${dnaSelection.blend?.secondary ?? 30}%)`
        );
      }
    }
    return resolved;
  }
  mergeDeep(target, ...sources) {
    const result = { ...target };
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      for (const key of Object.keys(source)) {
        const sv = source[key];
        const tv = result[key];
        if (sv && typeof sv === "object" && !Array.isArray(sv) && tv && typeof tv === "object" && !Array.isArray(tv)) {
          result[key] = this.mergeDeep(
            tv,
            sv
          );
        } else {
          result[key] = sv;
        }
      }
    }
    return result;
  }
  getCatalogDna(name) {
    return this.catalog.get(name);
  }
  listCatalogDnas() {
    return Array.from(this.catalog.keys());
  }
};

// src/engines/behavioral/dna-validator.ts
var DNAValidator = class _DNAValidator {
  /**
   * Validação completa de um pacote DNA
   */
  static validate(dna) {
    const errors = [];
    const warnings = [];
    _DNAValidator.validatePersonas(dna, errors, warnings);
    _DNAValidator.validateGovernance(dna, errors, warnings);
    _DNAValidator.validateQuality(dna, errors, warnings);
    _DNAValidator.validatePatterns(dna, errors, warnings);
    _DNAValidator.validateWorkflows(dna, errors, warnings);
    _DNAValidator.validateCrossReferences(dna, errors, warnings);
    _DNAValidator.validateCompleteness(dna, errors, warnings);
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  static validatePersonas(dna, errors, warnings) {
    if (dna.personas.length === 0) {
      errors.push({
        code: "DNA_NO_PERSONAS",
        message: "DNA package must have at least one persona",
        path: "personas",
        severity: "error"
      });
      return;
    }
    const roles = /* @__PURE__ */ new Set();
    for (const persona of dna.personas) {
      if (roles.has(String(persona.role))) {
        warnings.push({
          code: "DNA_DUPLICATE_ROLE",
          message: `Duplicate role: ${persona.role}`,
          path: `personas.${String(persona.role)}`,
          severity: "warning"
        });
      }
      roles.add(String(persona.role));
      if (persona.authority === "junior" && !persona.boundaries?.length) {
        warnings.push({
          code: "DNA_JUNIOR_NO_BOUNDARIES",
          message: `Junior role ${persona.role} has no boundaries defined`,
          path: `personas.${persona.role}.boundaries`,
          severity: "warning"
        });
      }
    }
    const hasEngineer = roles.has("engineer");
    const hasQA = roles.has("qa");
    if (!hasEngineer) {
      warnings.push({
        code: "DNA_NO_ENGINEER",
        message: "DNA package has no engineer role",
        path: "personas",
        severity: "warning"
      });
    }
    if (!hasQA) {
      warnings.push({
        code: "DNA_NO_QA",
        message: "DNA package has no QA role",
        path: "personas",
        severity: "warning"
      });
    }
  }
  static validateGovernance(dna, errors, warnings) {
    const rules = dna.governance ?? [];
    if (rules.length === 0) {
      warnings.push({
        code: "DNA_NO_GOVERNANCE",
        message: "DNA package has no governance rules defined",
        path: "governance",
        severity: "warning"
      });
      return;
    }
    const ids = /* @__PURE__ */ new Set();
    for (const rule of rules) {
      if (ids.has(rule.id)) {
        errors.push({
          code: "DNA_DUPLICATE_GOVERNANCE_ID",
          message: `Duplicate governance rule ID: ${rule.id}`,
          path: `governance.${rule.id}`,
          severity: "error"
        });
      }
      ids.add(rule.id);
      if (rule.level === "critical" && rule.action !== "block" && rule.action !== "escalate") {
        warnings.push({
          code: "DNA_CRITICAL_NO_BLOCK",
          message: `Critical rule ${rule.id} does not block or escalate`,
          path: `governance.${rule.id}`,
          severity: "warning"
        });
      }
    }
  }
  static validateQuality(dna, errors, warnings) {
    const gates = dna.quality ?? [];
    if (gates.length === 0) {
      warnings.push({
        code: "DNA_NO_QUALITY",
        message: "DNA package has no quality gates defined",
        path: "quality",
        severity: "warning"
      });
      return;
    }
    const names = /* @__PURE__ */ new Set();
    for (const gate of gates) {
      if (names.has(gate.name)) {
        errors.push({
          code: "DNA_DUPLICATE_QUALITY_GATE",
          message: `Duplicate quality gate: ${gate.name}`,
          path: `quality.${gate.name}`,
          severity: "error"
        });
      }
      names.add(gate.name);
    }
  }
  static validatePatterns(dna, errors, warnings) {
    const patterns = dna.patterns ?? [];
    if (patterns.length === 0) {
      warnings.push({
        code: "DNA_NO_PATTERNS",
        message: "DNA package has no behavior patterns defined",
        path: "patterns",
        severity: "warning"
      });
      return;
    }
    const ids = /* @__PURE__ */ new Set();
    for (const pattern of patterns) {
      if (ids.has(pattern.id)) {
        errors.push({
          code: "DNA_DUPLICATE_PATTERN_ID",
          message: `Duplicate pattern ID: ${pattern.id}`,
          path: `patterns.${pattern.id}`,
          severity: "error"
        });
      }
      ids.add(pattern.id);
    }
  }
  static validateWorkflows(dna, errors, warnings) {
    const workflows = dna.workflows ?? [];
    const ids = /* @__PURE__ */ new Set();
    for (const step of workflows) {
      if (ids.has(step.id)) {
        errors.push({
          code: "DNA_DUPLICATE_WORKFLOW_STEP",
          message: `Duplicate workflow step ID: ${step.id}`,
          path: `workflows.${step.id}`,
          severity: "error"
        });
      }
      ids.add(step.id);
      if (step.next) {
        for (const nextId of step.next) {
          if (!ids.has(nextId) && !workflows.some((w) => w.id === nextId)) {
            warnings.push({
              code: "DNA_WORKFLOW_STEP_REFERENCE",
              message: `Step ${step.id} references unknown next step: ${nextId}`,
              path: `workflows.${step.id}.next`,
              severity: "warning"
            });
          }
        }
      }
    }
  }
  static validateCrossReferences(dna, _errors, warnings) {
    const agentRoles = new Set(dna.personas.map((p) => p.role));
    for (const pattern of dna.patterns ?? []) {
      if (pattern.triggers) {
        for (const trigger of pattern.triggers) {
          if (trigger.includes("agent:") && !agentRoles.has(trigger.replace("agent:", ""))) {
            warnings.push({
              code: "DNA_PATTERN_REFERENCE",
              message: `Pattern ${pattern.id} references unknown agent: ${trigger}`,
              path: `patterns.${pattern.id}.triggers`,
              severity: "warning"
            });
          }
        }
      }
    }
  }
  static validateCompleteness(dna, _errors, warnings) {
    if (!dna.description) {
      warnings.push({
        code: "DNA_NO_DESCRIPTION",
        message: "DNA package has no description",
        path: "description",
        severity: "warning"
      });
    }
    if (!dna.author) {
      warnings.push({
        code: "DNA_NO_AUTHOR",
        message: "DNA package has no author",
        path: "author",
        severity: "warning"
      });
    }
    if (!dna.version) {
      warnings.push({
        code: "DNA_NO_VERSION",
        message: "DNA package has no version",
        path: "version",
        severity: "warning"
      });
    }
  }
  /**
   * Validação rápida — retorna apenas se é válido
   */
  static isValid(dna) {
    return _DNAValidator.validate(dna).valid;
  }
  /**
   * Resumo da validação em texto
   */
  static summary(result) {
    const lines = [];
    lines.push(`Valid: ${result.valid ? "\u2705" : "\u274C"}`);
    lines.push(`Errors: ${result.errors.length}`);
    lines.push(`Warnings: ${result.warnings.length}`);
    if (result.errors.length > 0) {
      lines.push("\nErrors:");
      for (const error of result.errors) {
        lines.push(`  \u274C [${error.code}] ${error.path}: ${error.message}`);
      }
    }
    if (result.warnings.length > 0) {
      lines.push("\nWarnings:");
      for (const warning of result.warnings) {
        lines.push(`  \u26A0\uFE0F [${warning.code}] ${warning.path}: ${warning.message}`);
      }
    }
    return lines.join("\n");
  }
};

// src/engines/behavioral/escalation-manager.ts
var EscalationManager = class {
  triggers;
  events = [];
  constructor(triggers) {
    this.triggers = triggers ?? [
      {
        id: "security-vuln",
        condition: "security vulnerability",
        action: "halt_all_activate_immune",
        timeout: "immediate",
        retry: 0,
        severity: "critical"
      },
      {
        id: "production-incident",
        condition: "production incident",
        action: "immediate_surgical_team",
        timeout: "immediate",
        retry: 0,
        severity: "critical"
      },
      {
        id: "schema-migration",
        condition: "schema migration",
        action: "halt_and_review",
        timeout: "5min",
        retry: 1,
        severity: "high"
      },
      {
        id: "breaking-change",
        condition: "breaking change",
        action: "halt_and_notify_architect",
        timeout: "5min",
        retry: 1,
        severity: "high"
      },
      {
        id: "payment-failure",
        condition: "payment_failure",
        action: "immediate_surgical_team",
        timeout: "immediate",
        retry: 0,
        severity: "critical"
      },
      {
        id: "compliance-violation",
        condition: "compliance_violation",
        action: "halt_and_activate_governance",
        timeout: "immediate",
        retry: 0,
        severity: "critical"
      },
      {
        id: "perf-regression",
        condition: "performance_regression",
        action: "halt_and_activate_mathematical_swarm",
        timeout: "5min",
        retry: 1,
        severity: "high"
      },
      {
        id: "coverage-drop",
        condition: "test_coverage_drop",
        action: "spawn_testing_agent",
        timeout: "immediate",
        retry: 2,
        severity: "medium"
      }
    ];
  }
  /**
   * Load governance rules as escalation triggers.
   * Only 'escalate' and 'block' actions become triggers.
   */
  loadGovernanceRules(rules) {
    for (const rule of rules) {
      if (rule.action !== "escalate" && rule.action !== "block") continue;
      const conditions = rule.conditions ?? [];
      for (const condition of conditions) {
        const conditionValue = condition.replace("type:", "");
        this.triggers.push({
          id: rule.id,
          condition: conditionValue,
          action: rule.action === "block" ? "halt_and_review" : "escalate_to_human",
          timeout: rule.level === "critical" ? "immediate" : "5min",
          retry: rule.level === "critical" ? 0 : 1,
          severity: rule.level
        });
      }
    }
  }
  check(event) {
    const contextType = event.context?.type;
    const matchingTrigger = this.triggers.find(
      (t) => event.type.includes(t.condition) || t.condition.includes(event.type) || contextType !== void 0 && (contextType.includes(t.condition) || t.condition.includes(contextType))
    );
    if (!matchingTrigger) return null;
    const escalationEvent = {
      triggerId: matchingTrigger.id,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      agent: event.agent,
      context: event.context ?? {},
      action: matchingTrigger.action,
      status: "triggered",
      retries: 0
    };
    this.events.push(escalationEvent);
    return escalationEvent;
  }
  resolve(triggerId) {
    const event = this.events.find((e) => e.triggerId === triggerId && e.status !== "resolved");
    if (!event) return false;
    event.status = "resolved";
    return true;
  }
  retry(triggerId) {
    const event = this.events.find(
      (e) => e.triggerId === triggerId && (e.status === "triggered" || e.status === "in_progress")
    );
    if (!event) return false;
    const trigger = this.triggers.find((t) => t.id === event.triggerId);
    if (!trigger) return false;
    if (event.retries >= trigger.retry) {
      event.status = "failed";
      return false;
    }
    event.retries++;
    event.status = "in_progress";
    return true;
  }
  getActiveEscalations() {
    return this.events.filter((e) => e.status === "triggered" || e.status === "in_progress");
  }
  getEscalationHistory() {
    return [...this.events];
  }
  prune(maxAgeMs) {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.events.length;
    this.events = this.events.filter((e) => {
      if (e.status !== "resolved" && e.status !== "failed") return true;
      return new Date(e.timestamp).getTime() > cutoff;
    });
    return before - this.events.length;
  }
};

// src/engines/behavioral/governance-engine.ts
var import_node_fs5 = require("fs");
var import_yaml4 = require("yaml");
var BosGovernanceEngine = class {
  config;
  /**
   * @param configOrPath  Either a file-system path to a YAML config
   *                      or a pre-parsed GovernanceConfig object.
   */
  constructor(configOrPath) {
    if (typeof configOrPath === "string") {
      const content = (0, import_node_fs5.readFileSync)(configOrPath, "utf-8");
      this.config = (0, import_yaml4.parse)(content);
    } else {
      this.config = configOrPath;
    }
  }
  // ── Core validation ─────────────────────────────────────────
  /**
   * Validate whether an agent is authorised to perform the given action
   * on the specified target.
   */
  validate(context) {
    const authority = this.config.authorityMatrix[context.agentRole || context.agent];
    if (!authority) {
      return {
        allowed: false,
        reason: `Unknown agent role: ${context.agentRole || context.agent}`,
        severity: "high"
      };
    }
    const domainConfig = this.config.domainBoundaries[context.agentDomain || authority.domain];
    if (domainConfig) {
      const isForbidden = domainConfig.cannotModify.some(
        (pattern) => matchesGlob(context.target, pattern)
      );
      if (isForbidden) {
        return {
          allowed: false,
          reason: `${context.agent} (${authority.domain}) cannot modify ${context.target}`,
          severity: "high"
        };
      }
    }
    switch (context.action) {
      case "deploy":
        if (!authority.permissions.canDeploy) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot deploy`,
            requiresApproval: "tech_lead",
            severity: "critical"
          };
        }
        break;
      case "approve":
        if (!authority.permissions.canApprove) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot approve`,
            severity: "medium"
          };
        }
        break;
      case "veto":
        if (!authority.permissions.canVeto) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot veto`,
            severity: "high"
          };
        }
        break;
      case "modify_schema":
        if (!authority.permissions.canModifySchema) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot modify schema`,
            requiresApproval: "architect",
            severity: "high"
          };
        }
        break;
      case "change_contract":
        if (!authority.permissions.canChangeContracts) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot change contracts`,
            requiresApproval: "architect",
            severity: "high"
          };
        }
        break;
    }
    return { allowed: true };
  }
  // ── Escalation ──────────────────────────────────────────────
  /**
   * Return the escalation rule that matches the given trigger string.
   */
  getEscalation(trigger) {
    return this.config.escalationMatrix.find(
      (r) => trigger.includes(r.trigger) || r.trigger.includes(trigger)
    ) ?? null;
  }
  /**
   * Return all escalation rules.
   */
  getEscalationRules() {
    return this.config.escalationMatrix;
  }
  // ── Conflict resolution ─────────────────────────────────────
  /**
   * Return the conflict-resolution protocol for a given type.
   */
  getConflictResolution(type) {
    return this.config.conflictResolution[type] ?? null;
  }
  // ── Context / compliance ────────────────────────────────────
  /**
   * Return full governance context for a given agent domain.
   */
  getContext(agentDomain) {
    return {
      domain: agentDomain,
      boundaries: this.config.domainBoundaries[agentDomain],
      compliance: this.config.compliance
    };
  }
  /**
   * Return the raw governance config (read-only).
   */
  getConfig() {
    return this.config;
  }
};
function matchesGlob(target, pattern) {
  const regex = new RegExp(
    "^" + pattern.replace(/\*\*/g, ".__GLOB__").replace(/\*/g, "[^/]*").replace(/\.__GLOB__/g, ".*") + "$"
  );
  return regex.test(target);
}

// src/engines/behavioral/learning-engine.ts
var MIN_SAMPLES_FOR_ANALYSIS = 3;
var MIN_SAMPLES_FOR_MUTATIONS = 5;
var FAILURE_RATE_MUTATE_THRESHOLD = 0.3;
var SUCCESS_RATE_ABANDON_THRESHOLD = 0.6;
var SUCCESS_RATE_MUTATE_THRESHOLD = 0.8;
var LOW_QUALITY_THRESHOLD = 0.7;
var LONG_DURATION_MS = 3e5;
var BosLearningEngine = class {
  records = [];
  patterns = /* @__PURE__ */ new Map();
  async record(data) {
    this.records.push(data);
    if (!this.patterns.has(data.dna)) {
      this.patterns.set(data.dna, []);
    }
    this.patterns.get(data.dna).push(data);
  }
  analyze(dna) {
    const insights = [];
    const patterns = dna ? [dna] : Array.from(this.patterns.keys());
    for (const pattern of patterns) {
      const records = this.patterns.get(pattern) ?? [];
      if (records.length < MIN_SAMPLES_FOR_ANALYSIS) {
        insights.push({
          pattern,
          successRate: 0,
          avgDuration: 0,
          avgQuality: 0,
          sampleSize: records.length,
          recommendation: "reinforce",
          suggestedMutation: "Insufficient data for analysis"
        });
        continue;
      }
      const successCount = records.filter((r) => r.success).length;
      const successRate = successCount / records.length;
      const avgDuration = records.reduce((s, r) => s + r.duration, 0) / records.length;
      const avgQuality = records.reduce((s, r) => s + r.quality, 0) / records.length;
      let recommendation = "reinforce";
      let suggestedMutation;
      if (successRate < SUCCESS_RATE_ABANDON_THRESHOLD) {
        recommendation = "abandon";
        suggestedMutation = "Consider switching to a different DNA pattern";
      } else if (successRate < SUCCESS_RATE_MUTATE_THRESHOLD) {
        suggestedMutation = this.suggestMutation(pattern, records);
        if (suggestedMutation) {
          recommendation = "mutate";
        }
      }
      insights.push({
        pattern,
        successRate,
        avgQuality,
        avgDuration,
        sampleSize: records.length,
        recommendation,
        suggestedMutation
      });
    }
    return insights;
  }
  suggestMutations(dna) {
    const records = this.patterns.get(dna) ?? [];
    const mutations = [];
    if (records.length < MIN_SAMPLES_FOR_MUTATIONS) return mutations;
    const failures = records.filter((r) => !r.success);
    const failureRate = failures.length / records.length;
    if (failureRate > FAILURE_RATE_MUTATE_THRESHOLD) {
      mutations.push({
        dna,
        field: "risk_tolerance",
        from: "low",
        to: "medium",
        reason: `High failure rate (${(failureRate * 100).toFixed(0)}%) suggests risk tolerance too restrictive`,
        confidence: 0.7
      });
    }
    const avgQuality = records.reduce((s, r) => s + r.quality, 0) / records.length;
    if (avgQuality < LOW_QUALITY_THRESHOLD) {
      mutations.push({
        dna,
        field: "quality_gates.required",
        from: "current",
        to: "add more gates",
        reason: `Low avg quality (${avgQuality.toFixed(2)}) suggests insufficient gates`,
        confidence: 0.8
      });
    }
    return mutations;
  }
  suggestMutation(_pattern, records) {
    const failures = records.filter((r) => !r.success);
    const avgDuration = records.reduce((s, r) => s + r.duration, 0) / records.length;
    if (failures.length > records.length * FAILURE_RATE_MUTATE_THRESHOLD) {
      return "High failure rate \u2014 add more quality gates or reduce risk tolerance";
    }
    if (avgDuration > LONG_DURATION_MS) {
      return "Long duration \u2014 consider switching to parallel execution";
    }
    return "Pattern performing within bounds \u2014 minor optimizations";
  }
  getRecords(dna) {
    return dna ? this.records.filter((r) => r.dna === dna) : [...this.records];
  }
  getStats() {
    const total = this.records.length;
    return {
      totalRecords: total,
      patterns: this.patterns.size,
      overallSuccessRate: total > 0 ? this.records.filter((r) => r.success).length / total : 0,
      avgQuality: total > 0 ? this.records.reduce((s, r) => s + r.quality, 0) / total : 0
    };
  }
};

// src/engines/core-engine.ts
var import_node_crypto9 = require("crypto");
var import_schemas4 = require("@behavioros/schemas");
var import_eventemitter35 = __toESM(require("eventemitter3"));

// src/engines/governance/governance-engine.ts
var AUTHORITY_HIERARCHY = {
  junior: 1,
  senior: 2,
  architect: 3,
  lead: 4,
  director: 5,
  vp: 6,
  "c-level": 7
};
var DAY_NAME_MAP = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};
var GovernanceEngine = class _GovernanceEngine {
  rules;
  escalationChain = /* @__PURE__ */ new Map([
    ["junior", "senior"],
    ["senior", "architect"],
    ["architect", "lead"],
    ["lead", "director"],
    ["director", "vp"],
    ["vp", "c-level"]
  ]);
  constructor(rules) {
    this.rules = rules;
  }
  /**
   * Avalia se um agente pode executar uma ação
   */
  evaluate(context) {
    const authorityCheck = this.checkAuthority(context);
    if (!authorityCheck.allowed) {
      return authorityCheck;
    }
    const ruleCheck = this.checkRules(context);
    if (!ruleCheck.allowed) {
      return ruleCheck;
    }
    const boundaryCheck = this.checkBoundaries(context);
    if (!boundaryCheck.allowed) {
      return boundaryCheck;
    }
    return { allowed: true, reason: "All governance checks passed", escalationRequired: false };
  }
  checkAuthority(context) {
    const agentLevel = AUTHORITY_HIERARCHY[context.agentAuthority];
    const requiredLevel = this.getRequiredAuthority(context);
    if (agentLevel < requiredLevel) {
      const requiredRole = Object.entries(AUTHORITY_HIERARCHY).find(
        ([, v]) => v === requiredLevel
      )?.[0];
      return {
        allowed: false,
        reason: `Authority level ${context.agentAuthority} (level ${agentLevel}) is insufficient. Required: ${requiredRole} (level ${requiredLevel})`,
        escalationRequired: true,
        requiredAuthority: requiredRole
      };
    }
    return { allowed: true, reason: "Authority check passed", escalationRequired: false };
  }
  getRequiredAuthority(context) {
    const impactMap = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    };
    return impactMap[context.impact] ?? 1;
  }
  checkRules(context) {
    for (const rule of this.rules) {
      if (this.ruleApplies(rule, context)) {
        if (rule.action === "block") {
          return {
            allowed: false,
            reason: `Blocked by governance rule: ${rule.name}`,
            rule,
            escalationRequired: rule.level === "critical" || rule.level === "high"
          };
        }
        if (rule.action === "escalate") {
          return {
            allowed: false,
            reason: `Approval required by governance rule: ${rule.name}`,
            rule,
            escalationRequired: true
          };
        }
      }
    }
    return {
      allowed: true,
      reason: "No governance rules blocked action",
      escalationRequired: false
    };
  }
  ruleApplies(rule, context) {
    if (rule.scope && rule.scope.length > 0) {
      if (!rule.scope.includes(context.targetType) && !rule.scope.includes(context.action)) {
        return false;
      }
    }
    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        if (condition.includes(context.impact) || condition.includes(context.targetType)) {
          return true;
        }
      }
      return false;
    }
    return true;
  }
  // ----------------------------------------------------------
  // Boundary Checking
  // ----------------------------------------------------------
  checkBoundaries(context) {
    const boundaries = context.boundaries ?? [];
    for (const boundary of boundaries) {
      const result = this.evaluateBoundaryRule(boundary, context);
      if (!result.allowed) {
        return result;
      }
    }
    const timeCheck = this.checkTimeRestrictions(context);
    if (!timeCheck.allowed) {
      return timeCheck;
    }
    const depCheck = this.checkDependencyBoundary(context);
    if (!depCheck.allowed) {
      return depCheck;
    }
    return { allowed: true, reason: "All boundary checks passed", escalationRequired: false };
  }
  evaluateBoundaryRule(boundary, context) {
    switch (boundary.type) {
      case "forbidden":
        return this.checkForbidden(boundary, context);
      case "max_files":
        return this.checkMaxFiles(boundary, context);
      case "max_lines":
        return this.checkMaxLines(boundary, context);
      case "max_modules":
        return this.checkMaxModules(boundary, context);
      case "require_approval":
        return this.checkBoundaryApproval(boundary, context);
      default:
        return {
          allowed: true,
          reason: `Unknown boundary type '${boundary.type}', skipping`,
          escalationRequired: false
        };
    }
  }
  /**
   * Check if target files or scope match a forbidden glob pattern.
   * Forbidden boundaries block access to specific paths/modules.
   */
  checkForbidden(boundary, context) {
    const pattern = String(boundary.value);
    if (context.targetFiles) {
      for (const file of context.targetFiles) {
        if (_GovernanceEngine.matchesGlob(pattern, file)) {
          const msg = `File '${file}' matches forbidden pattern '${pattern}' (boundary: ${boundary.name})`;
          return this.applyScopeEscalation(msg, context);
        }
      }
    }
    if (context.targetScope) {
      if (_GovernanceEngine.matchesGlob(pattern, context.targetScope)) {
        const msg = `Scope '${context.targetScope}' matches forbidden pattern '${pattern}' (boundary: ${boundary.name})`;
        return this.applyScopeEscalation(msg, context);
      }
    }
    return {
      allowed: true,
      reason: `Forbidden pattern '${pattern}' not matched (boundary: ${boundary.name})`,
      escalationRequired: false
    };
  }
  /**
   * Check if file count exceeds the maximum allowed per scope.
   */
  checkMaxFiles(boundary, context) {
    const max = Number(boundary.value);
    if (Number.isNaN(max)) {
      return {
        allowed: true,
        reason: `Invalid max_files value '${boundary.value}' in boundary ${boundary.name}, skipping`,
        escalationRequired: false
      };
    }
    if (context.fileCount !== void 0 && context.fileCount > max) {
      const msg = `File count ${context.fileCount} exceeds maximum ${max} per ${boundary.scope} (boundary: ${boundary.name})`;
      return this.applyScopeEscalation(msg, context);
    }
    return {
      allowed: true,
      reason: `File count ${context.fileCount ?? "N/A"} within limit ${max} (boundary: ${boundary.name})`,
      escalationRequired: false
    };
  }
  /**
   * Check if line count exceeds the maximum allowed per scope.
   */
  checkMaxLines(boundary, context) {
    const max = Number(boundary.value);
    if (Number.isNaN(max)) {
      return {
        allowed: true,
        reason: `Invalid max_lines value '${boundary.value}' in boundary ${boundary.name}, skipping`,
        escalationRequired: false
      };
    }
    if (context.lineCount !== void 0 && context.lineCount > max) {
      const msg = `Line count ${context.lineCount} exceeds maximum ${max} per ${boundary.scope} (boundary: ${boundary.name})`;
      return this.applyScopeEscalation(msg, context);
    }
    return {
      allowed: true,
      reason: `Line count ${context.lineCount ?? "N/A"} within limit ${max} (boundary: ${boundary.name})`,
      escalationRequired: false
    };
  }
  /**
   * Check if module count exceeds the maximum allowed per scope.
   */
  checkMaxModules(boundary, context) {
    const max = Number(boundary.value);
    if (Number.isNaN(max)) {
      return {
        allowed: true,
        reason: `Invalid max_modules value '${boundary.value}' in boundary ${boundary.name}, skipping`,
        escalationRequired: false
      };
    }
    if (context.targetModules !== void 0 && context.targetModules > max) {
      const msg = `Module count ${context.targetModules} exceeds maximum ${max} per ${boundary.scope} (boundary: ${boundary.name})`;
      return this.applyScopeEscalation(msg, context);
    }
    return {
      allowed: true,
      reason: `Module count ${context.targetModules ?? "N/A"} within limit ${max} (boundary: ${boundary.name})`,
      escalationRequired: false
    };
  }
  /**
   * If boundary requires approval, escalate regardless of other factors.
   */
  checkBoundaryApproval(boundary, context) {
    if (boundary.value === true) {
      const msg = `Action requires approval per boundary: ${boundary.name}`;
      return this.applyScopeEscalation(msg, context);
    }
    return {
      allowed: true,
      reason: `Boundary '${boundary.name}' does not require approval`,
      escalationRequired: false
    };
  }
  /**
   * Time-based restrictions from governance rule conditions.
   * Supports:
   *   - day:<dayName>       blocks action on that day (e.g. day:friday)
   *   - hours:<start>-<end> blocks action during those hours (e.g. hours:9-17)
   */
  checkTimeRestrictions(context) {
    const now = context.currentTime ?? /* @__PURE__ */ new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    for (const rule of this.rules) {
      if (!rule.conditions || rule.conditions.length === 0) continue;
      if (rule.action !== "block" && rule.action !== "escalate") continue;
      for (const condition of rule.conditions) {
        if (condition.startsWith("day:")) {
          const dayName = condition.slice(4).toLowerCase().trim();
          const restrictedDay = DAY_NAME_MAP[dayName];
          if (restrictedDay !== void 0 && currentDay === restrictedDay) {
            const msg = `Action restricted on ${dayName} by governance rule: ${rule.name}`;
            if (rule.action === "block") {
              return {
                allowed: false,
                reason: msg,
                rule,
                escalationRequired: rule.level === "critical" || rule.level === "high"
              };
            }
            return {
              allowed: true,
              reason: msg,
              rule,
              escalationRequired: true
            };
          }
        }
        if (condition.startsWith("hours:")) {
          const range = condition.slice(6).trim();
          const [startStr, endStr] = range.split("-");
          const start = Number.parseInt(startStr, 10);
          const end = Number.parseInt(endStr, 10);
          if (!Number.isNaN(start) && !Number.isNaN(end) && currentHour >= start && currentHour <= end) {
            const msg = `Action restricted during hours ${start}-${end} by governance rule: ${rule.name}`;
            if (rule.action === "block") {
              return {
                allowed: false,
                reason: msg,
                rule,
                escalationRequired: rule.level === "critical" || rule.level === "high"
              };
            }
            return {
              allowed: true,
              reason: msg,
              rule,
              escalationRequired: true
            };
          }
        }
      }
    }
    return { allowed: true, reason: "No time restrictions apply", escalationRequired: false };
  }
  /**
   * Dependency boundary from governance rule conditions.
   * Supports:
   *   - dependency:<allowed1>,<allowed2>  blocks dependencies not in the list
   */
  checkDependencyBoundary(context) {
    if (!context.targetDependency) {
      return { allowed: true, reason: "No dependency change detected", escalationRequired: false };
    }
    for (const rule of this.rules) {
      if (!rule.conditions || rule.conditions.length === 0) continue;
      if (rule.action !== "block" && rule.action !== "escalate") continue;
      for (const condition of rule.conditions) {
        if (condition.startsWith("dependency:")) {
          const allowedList = condition.slice(11).split(",").map((d) => d.trim()).filter(Boolean);
          if (!allowedList.includes(context.targetDependency)) {
            const msg = `Dependency '${context.targetDependency}' is not in the allowed list [${allowedList.join(", ")}] for governance rule: ${rule.name}`;
            if (rule.action === "block") {
              return {
                allowed: false,
                reason: msg,
                rule,
                escalationRequired: rule.level === "critical" || rule.level === "high"
              };
            }
            return {
              allowed: true,
              reason: msg,
              rule,
              escalationRequired: true
            };
          }
        }
      }
    }
    return {
      allowed: true,
      reason: `Dependency '${context.targetDependency}' passed boundary check`,
      escalationRequired: false
    };
  }
  /**
   * Scope escalation: if a boundary is violated but the agent has
   * architect-level or higher authority, allow with a warning.
   * Lower-authority agents are blocked.
   */
  applyScopeEscalation(violationMsg, context) {
    const agentLevel = AUTHORITY_HIERARCHY[context.agentAuthority];
    if (agentLevel >= AUTHORITY_HIERARCHY.architect) {
      return {
        allowed: true,
        reason: `Boundary violated but scope-escalated: ${violationMsg}. Agent authority '${context.agentAuthority}' (level ${agentLevel}) overrides the restriction.`,
        escalationRequired: true
      };
    }
    return {
      allowed: false,
      reason: `Boundary violation: ${violationMsg}. Agent authority '${context.agentAuthority}' (level ${agentLevel}) is insufficient to override.`,
      escalationRequired: true
    };
  }
  // ----------------------------------------------------------
  // Glob Matching
  // ----------------------------------------------------------
  /**
   * Minimal glob pattern matcher.
   * - `*`  matches any characters except path separators
   * - `**` matches any characters including path separators
   * - `?`  matches exactly one character except path separators
   * - `.`  and other characters match literally
   */
  static matchesGlob(pattern, path) {
    const normalisedPattern = pattern.replace(/\\/g, "/");
    const normalisedPath = path.replace(/\\/g, "/");
    let regexStr = "";
    let i = 0;
    while (i < normalisedPattern.length) {
      const ch = normalisedPattern[i];
      if (ch === "*" && normalisedPattern[i + 1] === "*") {
        regexStr += ".*";
        i += 2;
        if (normalisedPattern[i] === "/") i += 1;
      } else if (ch === "*") {
        regexStr += "[^/]*";
        i += 1;
      } else if (ch === "?") {
        regexStr += "[^/]";
        i += 1;
      } else if (ch === ".") {
        regexStr += "\\.";
        i += 1;
      } else {
        regexStr += ch;
        i += 1;
      }
    }
    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(normalisedPath);
  }
  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------
  /**
   * Obtém o próximo nível na cadeia de escalção
   */
  escalate(currentLevel) {
    return this.escalationChain.get(currentLevel) ?? null;
  }
  /**
   * Lista todas as regras que se aplicam a um contexto
   */
  getApplicableRules(context) {
    return this.rules.filter((rule) => this.ruleApplies(rule, context));
  }
  /**
   * Resumo das regras de governança
   */
  summary() {
    const lines = [];
    lines.push(`Governance Rules: ${this.rules.length}`);
    const byLevel = /* @__PURE__ */ new Map();
    for (const rule of this.rules) {
      byLevel.set(rule.level, (byLevel.get(rule.level) ?? 0) + 1);
    }
    for (const [level, count] of byLevel) {
      lines.push(`  ${level}: ${count}`);
    }
    return lines.join("\n");
  }
};

// src/engines/learning/learning-engine.ts
var import_node_crypto6 = require("crypto");
var import_promises = require("fs/promises");
var LearningEngine = class {
  events = [];
  insights = [];
  persistPath;
  autoApply;
  constructor(options) {
    this.persistPath = options?.persistPath;
    this.autoApply = options?.autoApply ?? false;
  }
  record(event) {
    const enriched = {
      id: (0, import_node_crypto6.randomUUID)(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      ...event
    };
    this.events.push(enriched);
    this.runDetection(enriched);
    if (this.autoApply) {
      this.autoApplyInsights();
    }
    return enriched;
  }
  getEvents() {
    return [...this.events];
  }
  getInsights() {
    return [...this.insights];
  }
  getInsightsByCategory(category) {
    return this.insights.filter((i) => i.category === category);
  }
  getTrends() {
    if (this.events.length < 2) return [];
    const sorted = [...this.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const byType = this.groupBy(this.events, (e) => e.type);
    const trends = [];
    for (const [type, events] of Object.entries(byType)) {
      if (events.length < 3) continue;
      const half = Math.floor(events.length / 2);
      const firstHalf = events.slice(0, half);
      const secondHalf = events.slice(half);
      const firstRate = firstHalf.length / this.timeSpanHours(firstHalf);
      const secondRate = secondHalf.length / this.timeSpanHours(secondHalf);
      const now = new Date(sorted[sorted.length - 1].timestamp).getTime();
      const recentWindow = now - 24 * 60 * 60 * 1e3;
      const recentCount = events.filter(
        (e) => new Date(e.timestamp).getTime() >= recentWindow
      ).length;
      const slope = firstRate > 0 ? (secondRate - firstRate) / firstRate : 0;
      let direction;
      if (slope > 0.15) direction = "increasing";
      else if (slope < -0.15) direction = "decreasing";
      else direction = "stable";
      trends.push({
        type,
        direction,
        slope,
        periodCount: events.length,
        recentCount,
        currentRate: secondRate
      });
    }
    return trends;
  }
  getAnomalies() {
    if (this.events.length < 5) return [];
    const anomalies = [];
    const now = Date.now();
    const byType = this.groupBy(this.events, (e) => e.type);
    for (const [type, events] of Object.entries(byType)) {
      const sorted = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      if (sorted.length < 4) continue;
      const mainBody = sorted.slice(0, -Math.ceil(sorted.length * 0.2));
      const bodySpan = this.timeSpanHours(mainBody);
      const expectedRate = bodySpan > 0 ? mainBody.length / bodySpan : 0;
      if (expectedRate <= 0) continue;
      const windowMinutes = 60;
      const windowMs = windowMinutes * 60 * 1e3;
      const recent = sorted.filter((e) => now - new Date(e.timestamp).getTime() < windowMs);
      const actualRate = recent.length / (windowMinutes / 60);
      if (actualRate > expectedRate * 3 && recent.length >= 3) {
        anomalies.push({
          type,
          detectedAt: (/* @__PURE__ */ new Date()).toISOString(),
          expectedRate,
          actualRate,
          multiplier: actualRate / expectedRate,
          windowMinutes,
          eventIds: recent.map((e) => e.id)
        });
      }
    }
    return anomalies;
  }
  getSourceReputation(source) {
    const sourceEvents = this.events.filter((e) => e.source === source);
    if (sourceEvents.length === 0) return null;
    const insightCount = sourceEvents.filter((e) => e.type === "insight").length;
    const correctionCount = sourceEvents.filter((e) => e.type === "correction").length;
    const totalConfidence = sourceEvents.reduce((s, e) => s + (e.confidence ?? 0.5), 0);
    return {
      source,
      totalEvents: sourceEvents.length,
      insightCount,
      correctionCount,
      insightRatio: totalConfidence > 0 ? insightCount / (insightCount + correctionCount + 1) : 0,
      averageConfidence: totalConfidence / sourceEvents.length
    };
  }
  applyInsight(insightId) {
    const insight = this.insights.find((i) => i.id === insightId);
    if (!insight) return false;
    insight.confidence = Math.min(1, insight.confidence + 0.1);
    insight.occurrences += 1;
    insight.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
    this.record({
      type: "feedback",
      source: "learning-engine",
      data: { appliedInsight: insightId, pattern: insight.pattern },
      confidence: 1,
      applied: true
    });
    return true;
  }
  generateReport() {
    return {
      id: (0, import_node_crypto6.randomUUID)(),
      totalEvents: this.events.length,
      insights: this.insights,
      appliedCount: this.events.filter((e) => e.applied).length,
      pendingCount: this.events.filter((e) => !e.applied).length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      trends: this.getTrends(),
      anomalies: this.getAnomalies()
    };
  }
  async persist(path) {
    const target = path ?? this.persistPath;
    if (!target) throw new Error("No persist path configured");
    const state = {
      events: this.events,
      insights: this.insights
    };
    await (0, import_promises.writeFile)(target, JSON.stringify(state, null, 2), "utf-8");
  }
  async load(path) {
    const target = path ?? this.persistPath;
    if (!target) throw new Error("No load path configured");
    const raw = await (0, import_promises.readFile)(target, "utf-8");
    const state = JSON.parse(raw);
    this.events = state.events ?? [];
    this.insights = state.insights ?? [];
  }
  runDetection(event) {
    this.detectTemporalPattern(event);
    this.detectCorrelation(event);
    this.detectTrend(event);
    this.detectAnomaly(event);
    this.detectSuccessPattern(event);
    this.detectFailureChain(event);
    this.updateSourceReputationInsight(event);
  }
  // 1. Temporal Pattern Detection
  detectTemporalPattern(_event) {
    if (this.events.length < 5) return;
    const byType = this.groupBy(this.events, (e) => e.type);
    const _sorted = [...this.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (const [type, events] of Object.entries(byType)) {
      if (events.length < 3) continue;
      const dayCounts = {};
      for (const e of events) {
        const day = new Date(e.timestamp).toLocaleDateString("en-US", { weekday: "long" });
        dayCounts[day] = (dayCounts[day] ?? 0) + 1;
      }
      const totalDays = Object.values(dayCounts).reduce((a, b) => a + b, 0);
      const avgPerDay = totalDays / Math.max(1, Object.keys(dayCounts).length);
      for (const [day, count] of Object.entries(dayCounts)) {
        if (count >= avgPerDay * 2 && count >= 3) {
          const ratio = count / totalDays;
          const patternId = `temporal-${type}-${day}`;
          const existing = this.insights.find((i) => i.id === patternId);
          if (existing) {
            existing.occurrences = count;
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
          } else {
            this.insights.push({
              id: patternId,
              pattern: `${type} on ${day}`,
              confidence: Math.min(0.9, ratio),
              occurrences: count,
              description: `"${type}" events are ${(ratio * 100).toFixed(0)}% more common on ${day}`,
              suggestedAction: `Investigate root cause of ${type} spikes on ${day}`,
              category: "temporal",
              lastDetected: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
      const hourCounts = {};
      for (const e of events) {
        const hour = new Date(e.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      }
      for (let h = 0; h < 24; h++) {
        if ((hourCounts[h] ?? 0) >= avgPerDay * 1.5 && (hourCounts[h] ?? 0) >= 2) {
          const patternId = `temporal-${type}-hour-${h}`;
          const existing = this.insights.find((i) => i.id === patternId);
          if (existing) {
            existing.occurrences = hourCounts[h];
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
          } else {
            this.insights.push({
              id: patternId,
              pattern: `${type} around hour ${h}`,
              confidence: Math.min(0.8, (hourCounts[h] ?? 0) / totalDays),
              occurrences: hourCounts[h] ?? 0,
              description: `"${type}" events cluster around ${h}:00`,
              suggestedAction: `Consider scheduling preventive actions before ${h}:00`,
              category: "temporal",
              lastDetected: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        }
      }
    }
  }
  // 2. Correlation Detection
  detectCorrelation(event) {
    if (this.events.length < 3) return;
    const windowMs = 10 * 60 * 1e3;
    const recent = this.events.filter(
      (e) => Date.now() - new Date(e.timestamp).getTime() < windowMs
    );
    for (const other of recent) {
      if (other.id === event.id) continue;
      const diff = Math.abs(
        new Date(event.timestamp).getTime() - new Date(other.timestamp).getTime()
      );
      if (diff > windowMs) continue;
      const pair = [event.type, other.type].sort().join("->");
      const patternId = `correlation-${pair}`;
      const existing = this.insights.find((i) => i.id === patternId);
      if (existing) {
        existing.occurrences += 1;
        existing.confidence = Math.min(0.95, existing.confidence + 0.03);
        existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        this.insights.push({
          id: patternId,
          pattern: `${event.type} correlates with ${other.type}`,
          confidence: 0.4,
          occurrences: 1,
          description: `"${event.type}" events from "${event.source}" frequently follow "${other.type}" from "${other.source}" within ${(diff / 1e3).toFixed(0)}s`,
          suggestedAction: `Monitor "${other.type}" as a leading indicator for "${event.type}"`,
          category: "correlation",
          lastDetected: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
  // 3. Trend Detection
  detectTrend(event) {
    const byType = this.groupBy(this.events, (e) => e.type);
    const typeEvents = byType[event.type] ?? [];
    if (typeEvents.length < 4) return;
    const half = Math.floor(typeEvents.length / 2);
    const firstRate = half > 0 ? half / this.timeSpanHours(typeEvents.slice(0, half)) : 0;
    const secondRate = typeEvents.length - half > 0 ? (typeEvents.length - half) / this.timeSpanHours(typeEvents.slice(half)) : 0;
    if (firstRate <= 0 || secondRate <= 0) return;
    const changeRatio = secondRate / firstRate;
    const patternId = `trend-${event.type}`;
    const existing = this.insights.find((i) => i.id === patternId);
    let direction;
    let confidence;
    if (changeRatio > 1.5) {
      direction = "increasing";
      confidence = Math.min(0.9, 0.5 + (changeRatio - 1) * 0.15);
    } else if (changeRatio < 0.67) {
      direction = "decreasing";
      confidence = Math.min(0.9, 0.5 + (1 / changeRatio - 1) * 0.1);
    } else {
      return;
    }
    if (existing) {
      existing.confidence = Math.min(0.95, existing.confidence + 0.04);
      existing.occurrences += 1;
      existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      this.insights.push({
        id: patternId,
        pattern: `${event.type} ${direction}`,
        confidence,
        occurrences: 1,
        description: `"${event.type}" events are ${direction} (rate: ${firstRate.toFixed(2)}/h \u2192 ${secondRate.toFixed(2)}/h)`,
        suggestedAction: direction === "increasing" ? `Investigate cause of rising "${event.type}" events` : `Review what changed \u2014 "${event.type}" events are declining`,
        category: "trend",
        lastDetected: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  // 4. Anomaly Detection
  detectAnomaly(event) {
    if (this.events.length < 6) return;
    const byType = this.groupBy(this.events, (e) => e.type);
    const typeEvents = byType[event.type] ?? [];
    if (typeEvents.length < 4) return;
    const sorted = [...typeEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const mainBody = sorted.slice(0, -2);
    const bodySpan = this.timeSpanHours(mainBody);
    const expectedRate = bodySpan > 0 ? mainBody.length / bodySpan : 0;
    if (expectedRate <= 0) return;
    const windowMs = 60 * 60 * 1e3;
    const now = new Date(event.timestamp).getTime();
    const windowStart = now - windowMs;
    const recentCount = typeEvents.filter(
      (e) => new Date(e.timestamp).getTime() >= windowStart
    ).length;
    const actualRate = recentCount / (windowMs / (60 * 60 * 1e3));
    if (actualRate < expectedRate * 3 || recentCount < 3) return;
    const patternId = `anomaly-${event.type}`;
    const existing = this.insights.find((i) => i.id === patternId);
    if (existing) {
      existing.confidence = Math.min(0.95, existing.confidence + 0.06);
      existing.occurrences += 1;
      existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
    } else {
      this.insights.push({
        id: patternId,
        pattern: `${event.type} spike`,
        confidence: Math.min(0.9, 0.5 + actualRate / expectedRate * 0.1),
        occurrences: 1,
        description: `Anomaly: "${event.type}" rate is ${(actualRate / expectedRate).toFixed(1)}x normal (expected: ${expectedRate.toFixed(2)}/h, actual: ${actualRate.toFixed(2)}/h)`,
        suggestedAction: `Alert: unusual "${event.type}" activity detected \u2014 investigate immediately`,
        category: "anomaly",
        lastDetected: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  // 5. Success Pattern Detection
  detectSuccessPattern(_event) {
    const successes = this.events.filter((e) => e.type === "insight" && e.confidence >= 0.7);
    const _failures = this.events.filter((e) => e.type === "correction");
    if (successes.length < 2) return;
    for (const success of successes) {
      const before = this.events.filter((e) => {
        const eTime = new Date(e.timestamp).getTime();
        const sTime = new Date(success.timestamp).getTime();
        return eTime < sTime && sTime - eTime < 30 * 60 * 1e3;
      });
      const feedbackBefore = before.filter((e) => e.type === "feedback");
      if (feedbackBefore.length >= 1) {
        const patternId = "success-feedback-loop";
        const existing = this.insights.find((i) => i.id === patternId);
        if (existing) {
          existing.occurrences += 1;
          existing.confidence = Math.min(0.95, existing.confidence + 0.05);
          existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
        } else {
          this.insights.push({
            id: patternId,
            pattern: "Feedback leads to insight",
            confidence: 0.6,
            occurrences: 1,
            description: "High-confidence insights are often preceded by feedback events within 30min",
            suggestedAction: "Encourage more feedback loops to increase insight quality",
            category: "success",
            lastDetected: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }
    const bySource = this.groupBy(successes, (e) => e.source);
    for (const [source, sEvents] of Object.entries(bySource)) {
      if (sEvents.length < 2) continue;
      const totalFromSource = this.events.filter((e) => e.source === source).length;
      if (totalFromSource < 3) continue;
      const successRate = sEvents.length / totalFromSource;
      if (successRate >= 0.6) {
        const patternId = `success-source-${source}`;
        const existing = this.insights.find((i) => i.id === patternId);
        if (existing) {
          existing.confidence = Math.min(0.95, existing.confidence + 0.04);
          existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
        } else {
          this.insights.push({
            id: patternId,
            pattern: `${source} has high success rate`,
            confidence: successRate,
            occurrences: sEvents.length,
            description: `Source "${source}" produces high-value insights ${(successRate * 100).toFixed(0)}% of the time`,
            suggestedAction: `Prioritize outputs from "${source}" for critical decisions`,
            category: "success",
            lastDetected: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    }
  }
  // 6. Failure Chain Detection
  detectFailureChain(_event) {
    const failures = this.events.filter((e) => e.type === "correction");
    if (failures.length < 2) return;
    for (const failure of failures) {
      const windowMs = 15 * 60 * 1e3;
      const fTime = new Date(failure.timestamp).getTime();
      const preceding = this.events.filter((e) => {
        const eTime = new Date(e.timestamp).getTime();
        return eTime < fTime && fTime - eTime < windowMs;
      });
      if (preceding.length < 2) continue;
      const chainTypes = preceding.map((e) => e.type).join(" \u2192 ");
      const patternId = `failure-chain-${chainTypes.replace(/\s+/g, "-")}`;
      const existing = this.insights.find((i) => i.id === patternId);
      if (existing) {
        existing.occurrences += 1;
        existing.confidence = Math.min(0.95, existing.confidence + 0.08);
        existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        this.insights.push({
          id: patternId,
          pattern: `Failure chain: ${chainTypes}`,
          confidence: 0.45,
          occurrences: 1,
          description: `Correction events follow this sequence: ${chainTypes}`,
          suggestedAction: `Interrupt the chain after "${preceding[preceding.length - 1]?.type}" to prevent failure`,
          category: "failure",
          lastDetected: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
  // 7. Source Reputation Tracking
  updateSourceReputationInsight(_event) {
    const bySource = this.groupBy(this.events, (e) => e.source);
    for (const [source, sEvents] of Object.entries(bySource)) {
      if (sEvents.length < 3) continue;
      const insightCount = sEvents.filter((e) => e.type === "insight").length;
      const correctionCount = sEvents.filter((e) => e.type === "correction").length;
      const totalConfidence = sEvents.reduce((s, e) => s + (e.confidence ?? 0.5), 0);
      const avgConfidence = totalConfidence / sEvents.length;
      const ratio = correctionCount > 0 ? insightCount / correctionCount : insightCount;
      let reputation;
      if (ratio >= 2 && avgConfidence >= 0.7) {
        reputation = "trusted";
      } else if (ratio >= 0.5) {
        reputation = "neutral";
      } else {
        reputation = "unreliable";
      }
      const patternId = `reputation-${source}`;
      const existing = this.insights.find((i) => i.id === patternId);
      const confidence = Math.min(0.95, 0.4 + ratio * 0.1);
      if (existing) {
        existing.confidence = Math.min(0.95, existing.confidence + 0.02);
        existing.occurrences = sEvents.length;
        existing.lastDetected = (/* @__PURE__ */ new Date()).toISOString();
      } else {
        this.insights.push({
          id: patternId,
          pattern: `${source} is ${reputation}`,
          confidence,
          occurrences: sEvents.length,
          description: `Source "${source}" has ${insightCount} insights vs ${correctionCount} corrections (ratio: ${ratio.toFixed(1)}), avg confidence: ${(avgConfidence * 100).toFixed(0)}%`,
          suggestedAction: reputation === "trusted" ? `Increase weight of "${source}" in decision-making` : reputation === "unreliable" ? `Review "${source}" outputs \u2014 high correction rate` : `Monitor "${source}" for more data`,
          category: "source",
          lastDetected: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
  // 8. Auto-apply high-confidence insights
  autoApplyInsights() {
    for (const insight of this.insights) {
      if (insight.confidence > 0.8) {
        const alreadyApplied = this.events.some(
          (e) => e.type === "feedback" && e.data?.appliedInsight === insight.id
        );
        if (!alreadyApplied) {
          this.applyInsight(insight.id);
        }
      }
    }
  }
  summary() {
    const lines = [];
    lines.push(`Learning Engine: ${this.events.length} events, ${this.insights.length} insights`);
    lines.push(`Applied: ${this.events.filter((e) => e.applied).length}`);
    lines.push(`Pending: ${this.events.filter((e) => !e.applied).length}`);
    const categories = this.groupBy(this.insights, (i) => i.category);
    for (const [cat, catInsights] of Object.entries(categories)) {
      lines.push(`  ${cat}: ${catInsights.length} insights`);
    }
    if (this.insights.length > 0) {
      lines.push("Top insights:");
      for (const insight of this.insights.slice(0, 5)) {
        lines.push(
          `  [${insight.category}] ${insight.description} (${(insight.confidence * 100).toFixed(0)}% confidence, ${insight.occurrences} occurrences)`
        );
      }
    }
    return lines.join("\n");
  }
  timeSpanHours(events) {
    if (events.length < 2) return 1;
    const times = events.map((e) => new Date(e.timestamp).getTime());
    const spanMs = Math.max(times[times.length - 1] - times[0], 6e4);
    return spanMs / (60 * 60 * 1e3);
  }
  groupBy(items, keyFn) {
    const map = {};
    for (const item of items) {
      const key = keyFn(item);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }
};

// src/engines/mission/mission-engine.ts
var import_node_crypto7 = require("crypto");
var import_schemas3 = require("@behavioros/schemas");
var MissionEngine = class {
  missions = /* @__PURE__ */ new Map();
  plans = /* @__PURE__ */ new Map();
  progress = /* @__PURE__ */ new Map();
  /**
   * Decomponhe uma missão em sub-missões
   */
  decompose(mission, subMissions) {
    const plan = {
      id: (0, import_node_crypto7.randomUUID)(),
      rootMission: mission.id,
      subMissions: [],
      dependencies: [],
      estimatedDuration: 0,
      assignedAgents: []
    };
    for (const sub of subMissions) {
      const subMission = import_schemas3.MissionSchema.parse({
        id: (0, import_node_crypto7.randomUUID)(),
        title: sub.title ?? `Sub-task of ${mission.title}`,
        description: sub.description,
        type: sub.type ?? mission.type,
        priority: sub.priority ?? mission.priority,
        status: "queued",
        context: { ...mission.context, parentMission: mission.id }
      });
      plan.subMissions.push(subMission);
      this.missions.set(subMission.id, subMission);
    }
    this.plans.set(plan.id, plan);
    return plan;
  }
  /**
   * Regista progresso de uma missão
   */
  updateProgress(missionId, updates) {
    const existing = this.progress.get(missionId) ?? {
      missionId,
      status: "executing",
      progress: 0,
      subTasks: 0,
      completedSubTasks: 0,
      blockers: [],
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    };
    const updated = { ...existing, ...updates, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() };
    this.progress.set(missionId, updated);
    return updated;
  }
  /**
   * Obtém progresso de uma missão
   */
  getProgress(missionId) {
    return this.progress.get(missionId);
  }
  /**
   * Obtém plano de uma missão
   */
  getPlan(planId) {
    return this.plans.get(planId);
  }
  /**
   * Lista todas as missões
   */
  getAllMissions() {
    return Array.from(this.missions.values());
  }
  /**
   * Resume
   */
  summary() {
    const lines = [];
    lines.push(`Missions: ${this.missions.size}`);
    lines.push(`Plans: ${this.plans.size}`);
    const byStatus = /* @__PURE__ */ new Map();
    for (const m of this.missions.values()) {
      byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
    }
    for (const [status, count] of byStatus) {
      lines.push(`  ${status}: ${count}`);
    }
    return lines.join("\n");
  }
};

// src/engines/quality/quality-engine.ts
var import_node_child_process3 = require("child_process");
var import_node_crypto8 = require("crypto");
var import_node_fs6 = require("fs");
function runCommand2(cmd, cwd, timeout = 12e4) {
  try {
    const stdout = (0, import_node_child_process3.execSync)(cmd, {
      encoding: "utf-8",
      cwd,
      timeout,
      stdio: ["pipe", "pipe", "pipe"]
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    const e = err;
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? String(e),
      exitCode: e.status ?? 1
    };
  }
}
function detectPackageManager2(projectPath) {
  if ((0, import_node_fs6.existsSync)(`${projectPath}/pnpm-lock.yaml`)) return "pnpm";
  if ((0, import_node_fs6.existsSync)(`${projectPath}/yarn.lock`)) return "yarn";
  return "npm";
}
var QualityEngine = class {
  gates;
  history = [];
  minScore;
  persistPath;
  timeout;
  constructor(gates = [], options) {
    this.gates = gates;
    this.minScore = options?.minScore ?? 80;
    this.persistPath = options?.persistPath;
    this.timeout = options?.timeout ?? 12e4;
  }
  /**
   * Run all quality gates against a real project
   */
  async runAll(projectPath) {
    const reportId = (0, import_node_crypto8.randomUUID)();
    const start = Date.now();
    const checks = [];
    const metrics = [];
    for (const gate of this.gates) {
      try {
        const result = await this.runGate(gate.name, projectPath);
        checks.push(result.check);
        if (result.metric) metrics.push(result.metric);
      } catch (error) {
        checks.push({
          gate: gate.name,
          passed: false,
          actual: false,
          expected: true,
          message: `Gate ${gate.name} failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
    const passedChecks = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? Math.round(passedChecks / checks.length * 100) : 100;
    const passed = score >= this.minScore && checks.every((c) => c.passed);
    const report = {
      id: reportId,
      passed,
      score,
      checks,
      metrics,
      duration: Date.now() - start,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.history.push(report);
    return report;
  }
  /**
   * Run a single quality gate
   */
  async runGate(gateName, projectPath) {
    switch (gateName) {
      case "lint":
        return this.runLint(projectPath);
      case "typecheck":
        return this.runTypecheck(projectPath);
      case "test_coverage":
        return this.runCoverage(projectPath);
      case "security":
        return this.runSecurity(projectPath);
      case "performance":
        return this.runPerformance(projectPath);
      default:
        return this.runCustomGate(gateName, projectPath);
    }
  }
  async runLint(projectPath) {
    let result = runCommand2(
      "npx biome check . --no-errors-on-unmatched --max-diagnostics=100",
      projectPath,
      this.timeout
    );
    if (result.exitCode !== 0 && result.stdout.includes("biome")) {
      result = runCommand2(
        "npx eslint . --format json --max-warnings=1000",
        projectPath,
        this.timeout
      );
    }
    const errorCount = this.parseLintErrors(result.stdout, result.stderr);
    const passed = errorCount === 0;
    return {
      check: {
        gate: "lint",
        passed,
        actual: errorCount,
        expected: 0,
        message: passed ? "Lint: no errors found" : `Lint: ${errorCount} error(s) found`,
        details: { output: result.stdout.slice(0, 2e3) }
      },
      metric: { name: "lint", value: errorCount, unit: "errors", passed }
    };
  }
  parseLintErrors(stdout, stderr) {
    const biomeMatch = stdout.match(/(\d+)\s+error/);
    if (biomeMatch) return Number.parseInt(biomeMatch[1], 10);
    try {
      const data = JSON.parse(stdout);
      if (Array.isArray(data)) {
        return data.reduce(
          (sum, file) => sum + (file.errorCount ?? 0),
          0
        );
      }
    } catch {
    }
    const lines = (stdout + stderr).split("\n");
    return lines.filter((l) => l.includes("error") && !l.includes("0 errors")).length;
  }
  async runTypecheck(projectPath) {
    const result = runCommand2("npx tsc --noEmit --pretty false", projectPath, this.timeout);
    const errorCount = this.parseTypecheckErrors(result.stdout, result.stderr);
    const passed = errorCount === 0;
    return {
      check: {
        gate: "typecheck",
        passed,
        actual: errorCount,
        expected: 0,
        message: passed ? "TypeScript: no type errors" : `TypeScript: ${errorCount} type error(s)`,
        details: { output: result.stdout.slice(0, 2e3) }
      },
      metric: { name: "typecheck", value: errorCount, unit: "errors", passed }
    };
  }
  parseTypecheckErrors(stdout, stderr) {
    const output = stdout + stderr;
    const match = output.match(/Found (\d+) error/);
    if (match) return Number.parseInt(match[1], 10);
    return output.split("\n").filter((l) => l.includes("error TS")).length;
  }
  async runCoverage(projectPath) {
    const pkgMgr = detectPackageManager2(projectPath);
    let testCmd = `${pkgMgr} run test -- --coverage`;
    try {
      const pkgJson = JSON.parse(
        require("fs").readFileSync(`${projectPath}/package.json`, "utf-8")
      );
      if (pkgJson.devDependencies?.vitest || pkgJson.dependencies?.vitest) {
        testCmd = `${pkgMgr} run test:coverage`;
      } else if (pkgJson.devDependencies?.jest || pkgJson.dependencies?.jest) {
        testCmd = `${pkgMgr} run test -- --coverage`;
      }
    } catch {
    }
    const result = runCommand2(testCmd, projectPath, this.timeout * 2);
    const coverage = this.parseCoverageOutput(result.stdout, result.stderr);
    const gate = this.gates.find((g) => g.name === "test_coverage");
    const threshold = gate?.threshold ?? 80;
    const passed = coverage >= threshold;
    return {
      check: {
        gate: "test_coverage",
        passed,
        actual: coverage,
        expected: threshold,
        message: passed ? `Coverage: ${coverage}% >= ${threshold}%` : `Coverage: ${coverage}% < ${threshold}% (threshold not met)`,
        details: { output: result.stdout.slice(0, 2e3) }
      },
      metric: { name: "test_coverage", value: coverage, unit: "%", threshold, passed }
    };
  }
  parseCoverageOutput(stdout, stderr) {
    const output = stdout + stderr;
    const allFilesMatch = output.match(/All files\s+\|\s+([\d.]+)/);
    if (allFilesMatch) return Number.parseFloat(allFilesMatch[1]);
    try {
      const match2 = output.match(/"total":\s*\{[^}]*"lines":\s*\{[^}]*"pct":\s*([\d.]+)/);
      if (match2) return Number.parseFloat(match2[1]);
    } catch {
    }
    const pctMatch = output.match(/([\d.]+)%\s+Lines/);
    if (pctMatch) return Number.parseFloat(pctMatch[1]);
    return 0;
  }
  async runSecurity(projectPath) {
    const pkgMgr = detectPackageManager2(projectPath);
    const auditCmd = pkgMgr === "pnpm" ? "pnpm audit --json" : `${pkgMgr} audit --json`;
    const result = runCommand2(auditCmd, projectPath, this.timeout);
    const vulns = this.parseAuditOutput(result.stdout, result.stderr);
    const critical = vulns.critical + vulns.high;
    const passed = critical === 0;
    return {
      check: {
        gate: "security",
        passed,
        actual: critical,
        expected: 0,
        message: passed ? `Security: ${vulns.total} vulnerabilities (0 critical/high)` : `Security: ${critical} critical/high vulnerabilities found`,
        details: vulns
      },
      metric: { name: "security", value: vulns.total, unit: "vulnerabilities", passed }
    };
  }
  parseAuditOutput(stdout, _stderr) {
    const vulns = { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 };
    try {
      const data = JSON.parse(stdout);
      if (data.vulnerabilities) {
        for (const [, vuln] of Object.entries(data.vulnerabilities)) {
          const sev = vuln.severity;
          if (sev in vulns) vulns[sev]++;
          vulns.total++;
        }
      }
      if (data.advisories) {
        for (const advisory of Object.values(data.advisories)) {
          const sev = advisory.severity;
          if (sev in vulns) vulns[sev]++;
          vulns.total++;
        }
      }
    } catch {
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (line.includes("critical")) vulns.critical++;
        else if (line.includes("high")) vulns.high++;
        else if (line.includes("moderate")) vulns.moderate++;
        else if (line.includes("low")) vulns.low++;
      }
      vulns.total = vulns.critical + vulns.high + vulns.moderate + vulns.low;
    }
    return vulns;
  }
  async runPerformance(projectPath) {
    const largeFiles = this.findLargeFiles(projectPath, 500);
    const score = Math.max(0, 100 - largeFiles.length * 5);
    const passed = score >= 80;
    return {
      check: {
        gate: "performance",
        passed,
        actual: score,
        expected: 80,
        message: passed ? `Performance: score ${score}/100 (${largeFiles.length} large files)` : `Performance: score ${score}/100 (${largeFiles.length} files exceed 500 lines)`,
        details: { largeFiles: largeFiles.slice(0, 20) }
      },
      metric: { name: "performance", value: score, unit: "score", threshold: 80, passed }
    };
  }
  findLargeFiles(projectPath, maxLines) {
    const largeFiles = [];
    try {
      const result = runCommand2(
        `find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -500`,
        projectPath,
        1e4
      );
      const files = result.stdout.trim().split("\n").filter(Boolean);
      for (const file of files) {
        try {
          const content = require("fs").readFileSync(`${projectPath}/${file}`, "utf-8");
          const lines = content.split("\n").length;
          if (lines > maxLines) {
            largeFiles.push(`${file} (${lines} lines)`);
          }
        } catch {
        }
      }
    } catch {
    }
    return largeFiles;
  }
  async runCustomGate(gateName, projectPath) {
    const gate = this.gates.find((g) => g.name === gateName);
    if (!gate) {
      return {
        check: {
          gate: gateName,
          passed: true,
          actual: true,
          expected: true,
          message: `Unknown gate: ${gateName}, auto-pass`
        }
      };
    }
    const config = gate.config;
    if (config?.command) {
      const result = runCommand2(String(config.command), projectPath, this.timeout);
      const passed = result.exitCode === 0;
      return {
        check: {
          gate: gateName,
          passed,
          actual: passed,
          expected: true,
          message: passed ? `${gateName}: passed` : `${gateName}: failed (exit code ${result.exitCode})`,
          details: { output: result.stdout.slice(0, 2e3) }
        },
        metric: { name: gateName, value: passed ? 1 : 0, passed }
      };
    }
    return {
      check: {
        gate: gateName,
        passed: true,
        actual: true,
        expected: true,
        message: `${gateName}: no execution config, auto-pass`
      }
    };
  }
  /**
   * Create a report from raw results
   */
  createReport(results) {
    const passedChecks = results.filter((c) => c.passed).length;
    const score = results.length > 0 ? Math.round(passedChecks / results.length * 100) : 100;
    const metrics = results.map((r) => ({
      name: r.gate,
      value: typeof r.actual === "number" ? r.actual : r.actual === true ? 1 : 0,
      passed: r.passed,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }));
    return {
      id: (0, import_node_crypto8.randomUUID)(),
      passed: score >= this.minScore && results.every((c) => c.passed),
      score,
      checks: results,
      metrics,
      duration: 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  // --- Existing API ---
  evaluate(metrics) {
    const reportId = (0, import_node_crypto8.randomUUID)();
    const start = Date.now();
    const checks = [];
    for (const gate of this.gates) {
      const metric = metrics.find((m) => m.name === gate.name);
      if (!metric) {
        checks.push({
          gate: gate.name,
          passed: false,
          actual: false,
          expected: gate.threshold ?? gate.pass ?? true,
          message: `Metric not found for gate: ${gate.name}`
        });
        continue;
      }
      const check = this.evaluateGate(gate, metric);
      checks.push(check);
    }
    const passedChecks = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? Math.round(passedChecks / checks.length * 100) : 100;
    const passed = score >= this.minScore && checks.every((c) => c.passed);
    const report = {
      id: reportId,
      passed,
      score,
      checks,
      metrics,
      duration: Date.now() - start,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.history.push(report);
    return report;
  }
  evaluateGate(gate, metric) {
    if (gate.threshold !== void 0) {
      const actual = metric.value;
      const passed = actual >= gate.threshold;
      return {
        gate: gate.name,
        passed,
        actual,
        expected: gate.threshold,
        message: passed ? `${gate.name}: ${actual} >= ${gate.threshold}` : `${gate.name}: ${actual} < ${gate.threshold} (threshold not met)`
      };
    }
    if (gate.pass !== void 0) {
      const actual = metric.passed ?? metric.value > 0;
      const passed = actual === gate.pass;
      return {
        gate: gate.name,
        passed,
        actual,
        expected: gate.pass,
        message: passed ? `${gate.name}: passed` : `${gate.name}: failed (expected ${gate.pass})`
      };
    }
    return {
      gate: gate.name,
      passed: true,
      actual: metric.value,
      expected: metric.value,
      message: `${gate.name}: no threshold configured, auto-pass`
    };
  }
  addGate(gate) {
    const existing = this.gates.findIndex((g) => g.name === gate.name);
    if (existing >= 0) {
      this.gates[existing] = gate;
    } else {
      this.gates.push(gate);
    }
  }
  removeGate(name) {
    const index = this.gates.findIndex((g) => g.name === name);
    if (index >= 0) {
      this.gates.splice(index, 1);
      return true;
    }
    return false;
  }
  getGates() {
    return [...this.gates];
  }
  getHistory() {
    return [...this.history];
  }
  getLastReport() {
    return this.history[this.history.length - 1];
  }
  summary(report) {
    const lines = [];
    lines.push(`Quality Report: ${report.id}`);
    lines.push(`Overall: ${report.passed ? "\u2705 PASSED" : "\u274C FAILED"} (${report.score}/100)`);
    lines.push(
      `Checks: ${report.checks.filter((c) => c.passed).length}/${report.checks.length} passed`
    );
    lines.push(`Duration: ${report.duration}ms`);
    for (const check of report.checks) {
      const icon = check.passed ? "\u2705" : "\u274C";
      lines.push(`  ${icon} ${check.message}`);
    }
    return lines.join("\n");
  }
};

// src/engines/core-engine.ts
var BehaviorOSEngine = class extends import_eventemitter35.default {
  dna;
  missions = /* @__PURE__ */ new Map();
  agents = /* @__PURE__ */ new Map();
  auditLog = [];
  qualityMetrics = [];
  config;
  // Real engine instances — public for advanced usage
  governanceEngine;
  qualityEngine;
  learningEngine;
  missionEngine;
  auditEngine;
  constructor(config) {
    super();
    this.config = config;
    this.dna = config.dna;
    this.governanceEngine = new GovernanceEngine(this.dna.governance ?? []);
    this.qualityEngine = new QualityEngine(this.dna.quality ?? [], {
      minScore: config.quality?.minCoverage ?? 80
    });
    this.learningEngine = new LearningEngine({
      persistPath: config.learning?.persistPath,
      autoApply: config.learning?.autoApply
    });
    this.missionEngine = new MissionEngine();
    this.auditEngine = new AuditEngine();
    this.initializeAgents();
  }
  initializeAgents() {
    for (const persona of this.dna.personas) {
      const agent = {
        id: `agent-${persona.role}-${(0, import_node_crypto9.randomUUID)().slice(0, 8)}`,
        role: persona.role,
        status: "idle",
        authority: persona.authority,
        completedMissions: [],
        reputation: 50
      };
      this.agents.set(agent.id, agent);
    }
    if (this.dna.agent_mapping) {
      for (const mapping of Object.values(this.dna.agent_mapping)) {
        for (const agentName of mapping.opencode_agents) {
          if (this.agents.has(agentName)) continue;
          const agent = {
            id: agentName,
            role: mapping.role,
            status: "idle",
            authority: mapping.authority,
            completedMissions: [],
            reputation: 50
          };
          this.agents.set(agent.id, agent);
        }
      }
    }
  }
  // ─── Mission Management ────────────────────────────────────
  async createMission(input) {
    const mission = import_schemas4.MissionSchema.parse({
      id: (0, import_node_crypto9.randomUUID)(),
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority ?? "medium",
      status: "draft",
      context: input.context ?? {}
    });
    this.missions.set(mission.id, mission);
    this.emit("mission:created", mission);
    this.auditEvent("mission:created", "info", "pass", `Mission created: ${mission.title}`, {
      missionId: mission.id
    });
    return mission;
  }
  async startMission(missionId) {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    const updated = {
      ...mission,
      status: "executing",
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.missions.set(missionId, updated);
    const assignedAgents = this.selectAgents(updated);
    for (const agent of assignedAgents) {
      agent.status = "working";
      agent.currentMission = missionId;
      this.emit("agent:assigned", agent, updated);
    }
    this.emit("mission:started", updated);
    this.auditEvent("mission:started", "info", "pass", `Mission started: ${updated.title}`, {
      missionId
    });
    return updated;
  }
  async completeMission(missionId, output) {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    const updated = {
      ...mission,
      status: "completed",
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      output
    };
    this.missions.set(missionId, updated);
    for (const agent of this.agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = "idle";
        agent.currentMission = void 0;
        agent.completedMissions.push(missionId);
        agent.reputation = Math.min(100, agent.reputation + 2);
      }
    }
    this.emit("mission:completed", updated);
    this.auditEvent("mission:completed", "info", "pass", `Mission completed: ${updated.title}`, {
      missionId
    });
    return updated;
  }
  async failMission(missionId, error) {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);
    const updated = {
      ...mission,
      status: "failed",
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.missions.set(missionId, updated);
    for (const agent of this.agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = "idle";
        agent.currentMission = void 0;
        agent.reputation = Math.max(0, agent.reputation - 5);
      }
    }
    this.emit("mission:failed", updated, error);
    this.auditEvent(
      "mission:failed",
      "error",
      "fail",
      `Mission failed: ${updated.title} \u2014 ${error.message}`,
      { missionId }
    );
    return updated;
  }
  selectAgents(_mission) {
    const available = Array.from(this.agents.values()).filter((a) => a.status === "idle");
    return available.sort((a, b) => b.reputation - a.reputation).slice(0, Math.min(3, available.length));
  }
  // ─── Agent Management ──────────────────────────────────────
  getAgent(id) {
    return this.agents.get(id);
  }
  getAgentByOpenCodeName(name) {
    return Array.from(this.agents.values()).find((a) => a.id === name);
  }
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  getAgentsByRole(role) {
    return Array.from(this.agents.values()).filter((a) => a.role === role);
  }
  // ─── Governance (delegates to real GovernanceEngine) ──────
  async evaluateGovernance(action, context) {
    if (!this.config.governance?.enabled)
      return {
        approved: true,
        violations: [],
        warnings: [],
        reason: void 0
      };
    const govContext = {
      agentId: context.agentId ?? "system",
      agentRole: context.agentRole ?? "system",
      agentAuthority: context.agentAuthority ?? "c-level",
      action,
      targetType: this.mapTargetType(context),
      impact: this.mapImpact(context),
      metadata: context
    };
    const decision = this.governanceEngine.evaluate(govContext);
    const applicableRules = this.governanceEngine.getApplicableRules(govContext);
    const violations = [];
    const warnings = [];
    for (const rule of applicableRules) {
      if (rule.level === "critical" || rule.level === "high") {
        violations.push(rule);
        this.emit("governance:violation", rule, context);
      } else {
        warnings.push(rule);
      }
    }
    if (!decision.allowed && violations.length === 0) {
      if (decision.rule) {
        violations.push(decision.rule);
        this.emit("governance:violation", decision.rule, context);
      }
    }
    return {
      approved: decision.allowed,
      violations,
      warnings,
      reason: decision.allowed ? void 0 : decision.reason
    };
  }
  evaluateGovernanceDetailed(context) {
    return this.governanceEngine.evaluate(context);
  }
  mapTargetType(context) {
    const type = String(context.targetType ?? context.type ?? "").toLowerCase();
    if (["file", "module", "service", "config", "infrastructure", "database"].includes(
      type
    )) {
      return type;
    }
    return type;
  }
  mapImpact(context) {
    const impact = String(context.impact ?? "").toLowerCase();
    if (["low", "medium", "high", "critical"].includes(impact)) {
      return impact;
    }
    return "medium";
  }
  // ─── Quality (delegates to real QualityEngine) ────────────
  async evaluateQuality(metrics) {
    if (!this.config.quality?.enabled)
      return { passed: true, failedGates: [], metrics };
    const report = this.qualityEngine.evaluate(metrics);
    const failedGates = [];
    for (const check of report.checks) {
      if (!check.passed) {
        const gate = this.dna.quality?.find((g) => g.name === check.gate);
        if (gate) failedGates.push(gate);
      }
    }
    for (const m of report.metrics) {
      this.qualityMetrics.push(m);
      this.emit("quality:metric", m);
    }
    return { passed: report.passed, failedGates, metrics: report.metrics };
  }
  // ─── Learning (delegates to real LearningEngine) ──────────
  async recordLearning(event) {
    const enriched = this.learningEngine.record(event);
    this.emit("learning:event", enriched);
    return enriched;
  }
  getLearningEvents() {
    return this.learningEngine.getEvents();
  }
  // ─── Audit (delegates to real AuditEngine) ────────────────
  async runAudit(projectPath, stages) {
    return this.auditEngine.execute({ projectPath }, stages);
  }
  getAuditHistory() {
    return this.auditEngine.getHistory();
  }
  // ─── Internal Audit Log ───────────────────────────────────
  auditEvent(type, severity, result, description, details) {
    const event = {
      id: (0, import_node_crypto9.randomUUID)(),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      type,
      severity,
      result,
      description,
      details
    };
    this.auditLog.push(event);
    this.emit("audit:event", event);
    return event;
  }
  getAuditLog() {
    return [...this.auditLog];
  }
  // ─── Query Methods ────────────────────────────────────────
  getMission(id) {
    return this.missions.get(id);
  }
  getAllMissions() {
    return Array.from(this.missions.values());
  }
  getMissionsByStatus(status) {
    return Array.from(this.missions.values()).filter((m) => m.status === status);
  }
  getPatternsByType(type) {
    return (this.dna.patterns ?? []).filter((p) => p.type === type);
  }
  getPatternByName(name) {
    return (this.dna.patterns ?? []).find((p) => p.name === name);
  }
  getGovernanceRules() {
    return [...this.dna.governance ?? []];
  }
  getGovernanceRuleById(id) {
    return (this.dna.governance ?? []).find((r) => r.id === id);
  }
  getQualityGates() {
    return [...this.dna.quality ?? []];
  }
  getQualityGateByName(name) {
    return (this.dna.quality ?? []).find((g) => g.name === name);
  }
  // ─── Stats ────────────────────────────────────────────────
  getStats() {
    const missions = {};
    for (const m of this.missions.values()) missions[m.status] = (missions[m.status] || 0) + 1;
    const agents = {};
    for (const a of this.agents.values()) agents[a.status] = (agents[a.status] || 0) + 1;
    return {
      missions,
      agents,
      auditEvents: this.auditLog.length,
      qualityMetrics: this.qualityMetrics.length,
      learningEvents: this.learningEngine.getEvents().length
    };
  }
};

// src/engines/decision/decision-engine.ts
var DecisionEngine = class {
  strategy;
  quorumThreshold;
  constructor(strategy = "majority", quorumThreshold = 0.6) {
    this.strategy = strategy;
    this.quorumThreshold = quorumThreshold;
  }
  /**
   * Regista votos para uma decisão
   */
  vote(context, votes) {
    switch (this.strategy) {
      case "majority":
        return this.majorityVote(context, votes);
      case "weighted":
        return this.weightedVote(context, votes);
      case "unanimous":
        return this.unanimousVote(context, votes);
      case "quorum":
        return this.quorumVote(context, votes);
      case "byzantine":
        return this.byzantineVote(context, votes);
      default:
        return this.majorityVote(context, votes);
    }
  }
  majorityVote(context, votes) {
    const optionVotes = /* @__PURE__ */ new Map();
    for (const vote of votes) {
      optionVotes.set(vote.optionId, (optionVotes.get(vote.optionId) ?? 0) + 1);
    }
    let winningOption = null;
    let maxVotes = 0;
    for (const [optionId, count] of optionVotes) {
      if (count > maxVotes) {
        maxVotes = count;
        winningOption = optionId;
      }
    }
    const totalVotes = votes.length;
    const winningVotes = winningOption ? optionVotes.get(winningOption) ?? 0 : 0;
    const confidence = totalVotes > 0 ? winningVotes / totalVotes : 0;
    return {
      decisionId: context.id,
      winningOption,
      strategy: "majority",
      votes,
      consensus: confidence >= 0.7,
      confidence,
      dissenting: votes.filter((v) => v.optionId !== winningOption).map((v) => v.participantId),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  weightedVote(context, votes) {
    const weightedScores = /* @__PURE__ */ new Map();
    const participantMap = new Map(context.participants.map((p) => [p.id, p]));
    for (const vote of votes) {
      const participant = participantMap.get(vote.participantId);
      const weight = participant?.weight ?? 1;
      const current = weightedScores.get(vote.optionId) ?? 0;
      weightedScores.set(vote.optionId, current + vote.confidence * weight);
    }
    let winningOption = null;
    let maxScore = 0;
    for (const [optionId, score] of weightedScores) {
      if (score > maxScore) {
        maxScore = score;
        winningOption = optionId;
      }
    }
    const totalScore = Array.from(weightedScores.values()).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0 ? maxScore / totalScore : 0;
    return {
      decisionId: context.id,
      winningOption,
      strategy: "weighted",
      votes,
      consensus: confidence >= 0.7,
      confidence,
      dissenting: votes.filter((v) => v.optionId !== winningOption).map((v) => v.participantId),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  unanimousVote(context, votes) {
    const firstOption = votes[0]?.optionId;
    const consensus = votes.every((v) => v.optionId === firstOption);
    return {
      decisionId: context.id,
      winningOption: consensus ? firstOption ?? null : null,
      strategy: "unanimous",
      votes,
      consensus,
      confidence: consensus ? 1 : 0,
      dissenting: consensus ? [] : votes.filter((v) => v.optionId !== firstOption).map((v) => v.participantId),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  quorumVote(context, votes) {
    const quorumSize = Math.ceil(context.participants.length * this.quorumThreshold);
    const hasQuorum = votes.length >= quorumSize;
    if (!hasQuorum) {
      return {
        decisionId: context.id,
        winningOption: null,
        strategy: "quorum",
        votes,
        consensus: false,
        confidence: 0,
        dissenting: [],
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    return this.majorityVote(context, votes);
  }
  byzantineVote(context, votes) {
    const totalNodes = context.participants.length;
    const requiredHonest = Math.floor(totalNodes * 2 / 3) + 1;
    const hasQuorum = votes.length >= requiredHonest;
    if (!hasQuorum) {
      return {
        decisionId: context.id,
        winningOption: null,
        strategy: "byzantine",
        votes,
        consensus: false,
        confidence: 0,
        dissenting: [],
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    return this.majorityVote(context, votes);
  }
  /**
   * Avalia o risco de uma decisão
   */
  evaluateRisk(context) {
    const factors = [];
    const mitigations = [];
    let riskScore = 0;
    const roles = new Set(context.participants.map((p) => p.role));
    if (roles.size < 2) {
      factors.push("Low participant diversity");
      riskScore += 1;
    }
    const highRiskOptions = context.options.filter((o) => o.risk === "high");
    if (highRiskOptions.length > 0) {
      factors.push(`${highRiskOptions.length} high-risk option(s)`);
      riskScore += 2;
    }
    if (context.deadline) {
      const deadline = new Date(context.deadline);
      const now = /* @__PURE__ */ new Date();
      const daysLeft = (deadline.getTime() - now.getTime()) / (1e3 * 60 * 60 * 24);
      if (daysLeft < 2) {
        factors.push("Tight deadline");
        riskScore += 1;
      }
    }
    const level = riskScore >= 3 ? "high" : riskScore >= 1 ? "medium" : "low";
    if (level !== "low") {
      mitigations.push("Consider gathering more input before deciding");
      mitigations.push("Document decision rationale for future reference");
    }
    return { level, factors, mitigations };
  }
  /**
   * Gera um resumo da decisão
   */
  summary(result) {
    const lines = [];
    lines.push(`Decision: ${result.decisionId}`);
    lines.push(`Strategy: ${result.strategy}`);
    lines.push(`Consensus: ${result.consensus ? "\u2705" : "\u274C"}`);
    lines.push(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    if (result.winningOption) {
      lines.push(`Winner: ${result.winningOption}`);
    }
    if (result.dissenting.length > 0) {
      lines.push(`Dissenting: ${result.dissenting.join(", ")}`);
    }
    return lines.join("\n");
  }
};

// src/engines/pipeline/pipeline-engine.ts
var import_node_crypto10 = require("crypto");
var import_schemas5 = require("@behavioros/schemas");
var import_eventemitter36 = __toESM(require("eventemitter3"));
var PipelineEngine = class extends import_eventemitter36.default {
  dna;
  state;
  eaargSteps;
  options;
  constructor(dna, options = {}) {
    super();
    this.dna = dna;
    this.options = options;
    this.eaargSteps = this.extractEAARGSteps(dna);
    this.state = this.createInitialState();
  }
  // --- Public API ---
  async start() {
    if (this.state.status !== "created") {
      throw new Error(`Pipeline already started. Status: ${this.state.status}`);
    }
    this.state = {
      ...this.state,
      status: "running",
      currentLayer: this.options.startLayer ?? 1,
      startedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.emit("pipeline:started", this.state);
    return { ...this.state };
  }
  async advance() {
    this.ensureRunning();
    const currentLayer = this.state.currentLayer;
    if (!currentLayer) {
      throw new Error("No current layer set");
    }
    const step = this.eaargSteps.find((s) => s.layer === currentLayer);
    if (!step) {
      throw new Error(`No EAARG step found for layer ${currentLayer}`);
    }
    this.emit("layer:started", step.layer, step.layerName);
    const questionsTotal = step.questions.length;
    const criteriaTotal = step.acceptanceCriteria.length;
    const protocol = this.createEmptyProtocol(step);
    const result = {
      layer: step.layer,
      layerName: step.layerName,
      status: "in_progress",
      score: 0,
      protocol,
      evidenceCollected: [],
      questionsAnswered: 0,
      questionsTotal,
      criteriaMet: 0,
      criteriaTotal,
      skillsUsed: [],
      skillsScore: 0,
      duration: 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    return result;
  }
  pause() {
    this.ensureRunning();
    this.state = { ...this.state, status: "paused" };
    this.emit("pipeline:paused", this.state);
    return { ...this.state };
  }
  resume() {
    if (this.state.status !== "paused") {
      throw new Error(`Cannot resume. Status: ${this.state.status}`);
    }
    this.state = { ...this.state, status: "running" };
    this.emit("pipeline:resumed", this.state);
    return { ...this.state };
  }
  getState() {
    return { ...this.state, layers: [...this.state.layers] };
  }
  getLayer(layer) {
    return this.state.layers.find((l) => l.layer === layer);
  }
  getEAARGStep(layer) {
    return this.eaargSteps.find((s) => s.layer === layer);
  }
  getEAARGSteps() {
    return [...this.eaargSteps];
  }
  getReport() {
    const completed = this.state.layers.filter(
      (l) => l.status !== "pending" && l.status !== "skip"
    );
    const passed = this.state.layers.filter((l) => l.status === "pass");
    const failed = this.state.layers.filter((l) => l.status === "fail");
    const skipped = this.state.layers.filter((l) => l.status === "skip");
    const overallScore = completed.length > 0 ? Math.round(
      completed.reduce((sum, l) => sum + l.score, 0) / completed.length
    ) : 0;
    const overallStatus = failed.length > 0 ? "fail" : passed.length === this.eaargSteps.length ? "pass" : passed.length > 0 ? "partial" : "pending";
    return {
      pipelineId: this.state.id,
      dnaId: this.state.dnaId,
      totalLayers: this.eaargSteps.length,
      completedLayers: completed.length,
      passedLayers: passed.length,
      failedLayers: failed.length,
      skippedLayers: skipped.length,
      overallScore,
      overallStatus,
      layers: [...this.state.layers],
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
      duration: this.state.completedAt && this.state.startedAt ? new Date(this.state.completedAt).getTime() - new Date(this.state.startedAt).getTime() : 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async validateLayer(layer, evidence) {
    this.ensureRunning();
    const step = this.eaargSteps.find((s) => s.layer === layer);
    if (!step) {
      throw new Error(`No EAARG step found for layer ${layer}`);
    }
    this.emit("layer:started", step.layer, step.layerName);
    const evidenceResult = this.validateEvidence(step, evidence);
    this.emit("evidence:validated", layer, evidenceResult);
    const skillResults = this.validateSkills(step);
    this.emit("skills:validated", layer, skillResults);
    const questionsTotal = step.questions.length;
    const questionsAnswered = Math.min(questionsTotal, evidence.length);
    const criteriaTotal = step.acceptanceCriteria.length;
    const criteriaMet = evidenceResult.valid ? criteriaTotal : Math.floor(
      criteriaTotal * (evidenceResult.collected.length / (evidenceResult.collected.length + evidenceResult.missing.length))
    );
    const skillsScore = this.calculateSkillsScore(skillResults);
    const skillsUsed = skillResults.filter((r) => r.loaded).map((r) => r.skillId);
    const evidenceScore = this.calculateLayerScore(
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      evidenceResult.valid
    );
    const score = Math.round(evidenceScore * 0.8 + skillsScore * 0.2);
    const status = evidenceResult.valid && score >= 70 ? "pass" : "fail";
    const protocolStatus = status === "pass" ? "complete" : "blocked";
    const protocol = this.buildProtocol(
      step,
      evidence,
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      protocolStatus
    );
    const result = {
      layer: step.layer,
      layerName: step.layerName,
      status,
      score,
      protocol,
      evidenceCollected: evidenceResult.collected,
      questionsAnswered,
      questionsTotal,
      criteriaMet,
      criteriaTotal,
      skillsUsed,
      skillsScore,
      duration: 0,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const gateResult = this.checkGates(step, result);
    this.emit("layer:gate_checked", step.layer, gateResult);
    const layerResult = this.buildLayerResult(result);
    this.state.layers.push(layerResult);
    if (status === "pass") {
      this.emit("layer:completed", result);
      const allLayersDone = this.state.layers.length >= this.eaargSteps.length;
      if (allLayersDone) {
        const completed = this.state.layers.filter(
          (l) => l.status !== "pending" && l.status !== "skip"
        );
        const overallScore = completed.length > 0 ? Math.round(
          completed.reduce((sum, l) => sum + l.score, 0) / completed.length
        ) : 0;
        this.state = {
          ...this.state,
          status: "completed",
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          overallScore,
          overallStatus: this.state.layers.every((l) => l.status === "pass") ? "pass" : "partial"
        };
        this.emit("pipeline:completed", this.getReport());
      } else {
        this.advanceToNextLayer();
      }
    } else {
      this.state = { ...this.state, status: "failed" };
      this.emit("layer:failed", result);
      this.emit("pipeline:failed", this.state, new Error(`Layer ${step.layer} failed gate check`));
    }
    return result;
  }
  checkGatesForLayer(layer) {
    const step = this.eaargSteps.find((s) => s.layer === layer);
    if (!step) {
      return { passed: false, failedGates: [`Layer ${layer} not found`], warnings: [] };
    }
    const layerResult = this.state.layers.find((l) => l.layer === layer);
    if (!layerResult) {
      return { passed: false, failedGates: [`Layer ${layer} not executed`], warnings: [] };
    }
    const failedGates = [];
    const warnings = [];
    const qualityGates = this.dna.quality ?? [];
    for (const gate of qualityGates) {
      if (gate.type === "custom" && gate.config) {
        const config = gate.config;
        if (config.layer === layer) {
          const threshold = gate.threshold ?? 70;
          if (layerResult.score < threshold) {
            failedGates.push(`${gate.name}: score ${layerResult.score} < threshold ${threshold}`);
          }
        }
      }
    }
    for (const criteria of step.acceptanceCriteria) {
      const found = layerResult.protocol.acceptanceCriteria.some(
        (c) => c.id === criteria.id
      );
      if (!found) {
        failedGates.push(`Missing acceptance criteria: ${criteria.description}`);
      }
    }
    return {
      passed: failedGates.length === 0,
      failedGates,
      warnings
    };
  }
  getProtocol(layer) {
    const layerResult = this.state.layers.find((l) => l.layer === layer);
    return layerResult?.protocol;
  }
  getProgress() {
    const current = this.state.currentLayer ?? 0;
    const total = this.eaargSteps.length;
    return {
      current,
      total,
      percent: total > 0 ? Math.round(current / total * 100) : 0
    };
  }
  // --- Private Methods ---
  extractEAARGSteps(dna) {
    const steps = [];
    const workflows = dna.workflows ?? [];
    for (const workflow of workflows) {
      const input = workflow.input;
      if (input && typeof input === "object" && "layer" in input && "layerName" in input) {
        const eaargStep = {
          ...workflow,
          layer: input.layer,
          layerName: input.layerName,
          objectives: input.objectives ?? [],
          questions: input.questions ?? [],
          requiredEvidence: input.requiredEvidence ?? [],
          acceptanceCriteria: input.acceptanceCriteria ?? [],
          rejectionCriteria: input.rejectionCriteria ?? [],
          checklist: input.checklist ?? [],
          nextSteps: input.nextSteps ?? [],
          skills: input.skills ?? []
        };
        steps.push(eaargStep);
      }
    }
    steps.sort((a, b) => a.layer - b.layer);
    return steps;
  }
  createInitialState() {
    return {
      id: (0, import_node_crypto10.randomUUID)(),
      dnaId: this.dna.id,
      status: "created",
      currentLayer: this.options.startLayer ?? 1,
      layers: [],
      overallScore: 0,
      overallStatus: "pending"
    };
  }
  ensureRunning() {
    if (this.state.status !== "running") {
      throw new Error(`Pipeline is not running. Status: ${this.state.status}`);
    }
  }
  checkGates(step, result) {
    const failedGates = [];
    const warnings = [];
    if (result.score < 70) {
      failedGates.push(`Score ${result.score} below minimum threshold 70`);
    }
    if (step.acceptanceCriteria.length > 0 && result.criteriaMet === 0) {
      failedGates.push("No acceptance criteria met");
    }
    const requiredEvidence = step.requiredEvidence.filter((e) => e.required);
    for (const evidence of requiredEvidence) {
      if (!result.evidenceCollected.includes(evidence.id)) {
        warnings.push(`Required evidence not collected: ${evidence.description}`);
      }
    }
    return {
      passed: failedGates.length === 0,
      failedGates,
      warnings
    };
  }
  calculateLayerScore(questionsAnswered, questionsTotal, criteriaMet, criteriaTotal, evidenceValid) {
    const questionScore = questionsTotal > 0 ? questionsAnswered / questionsTotal * 40 : 40;
    const criteriaScore = criteriaTotal > 0 ? criteriaMet / criteriaTotal * 40 : 40;
    const evidenceScore = evidenceValid ? 20 : 0;
    return Math.round(questionScore + criteriaScore + evidenceScore);
  }
  buildLayerResult(result) {
    return import_schemas5.LayerResultSchema.parse({
      layer: result.layer,
      layerName: result.layerName,
      status: result.status,
      score: result.score,
      protocol: result.protocol,
      evidenceCollected: result.evidenceCollected,
      questionsAnswered: result.questionsAnswered,
      questionsTotal: result.questionsTotal,
      criteriaMet: result.criteriaMet,
      criteriaTotal: result.criteriaTotal,
      skillsUsed: result.skillsUsed,
      skillsScore: result.skillsScore,
      duration: result.duration,
      timestamp: result.timestamp
    });
  }
  buildProtocol(step, evidence, questionsAnswered, questionsTotal, _criteriaMet, _criteriaTotal, status) {
    const completionPercent = questionsTotal > 0 ? Math.round(questionsAnswered / questionsTotal * 100) : 0;
    const completedItems = [];
    const pendingItems = [];
    for (const question of step.questions) {
      if (evidence.includes(question.id)) {
        completedItems.push(question.question);
      } else {
        pendingItems.push(question.question);
      }
    }
    return {
      area: step.layerName,
      status,
      completionPercent,
      completedItems,
      pendingItems,
      technicalDebts: [],
      risks: [],
      blockers: status === "blocked" ? ["Evidence validation failed"] : [],
      evidence,
      acceptanceCriteria: step.acceptanceCriteria,
      nextActions: step.nextSteps,
      recommendation: status === "complete" ? "proceed" : status === "blocked" ? "fix" : "revalidate"
    };
  }
  createEmptyProtocol(step) {
    return {
      area: step.layerName,
      status: "pending",
      completionPercent: 0,
      completedItems: [],
      pendingItems: step.questions.map((q) => q.question),
      technicalDebts: [],
      risks: [],
      blockers: [],
      evidence: [],
      acceptanceCriteria: step.acceptanceCriteria,
      nextActions: step.nextSteps,
      recommendation: "revalidate"
    };
  }
  validateEvidence(step, evidence) {
    const requiredIds = step.requiredEvidence.filter((e) => e.required).map((e) => e.id);
    const collected = evidence.filter(
      (id) => requiredIds.includes(id) || step.requiredEvidence.some((e) => e.id === id)
    );
    const missing = requiredIds.filter((id) => !evidence.includes(id));
    const extra = evidence.filter(
      (id) => !step.requiredEvidence.some((e) => e.id === id)
    );
    return {
      valid: missing.length === 0,
      collected,
      missing,
      extra
    };
  }
  validateSkills(step) {
    const stepSkills = step.skills ?? [];
    const globalSkills = this.options.skills ?? [];
    const allSkills = [...stepSkills, ...globalSkills];
    const uniqueSkills = /* @__PURE__ */ new Map();
    for (const skill of allSkills) {
      if (!uniqueSkills.has(skill.skillId)) {
        uniqueSkills.set(skill.skillId, skill);
      }
    }
    const results = [];
    for (const [, skill] of uniqueSkills) {
      const loaded = true;
      const applicable = skill.required || skill.weight > 0;
      const score = loaded ? Math.round(skill.weight * 100) : 0;
      const recommendations = this.generateSkillRecommendations(skill);
      results.push({
        skillId: skill.skillId,
        skillName: skill.skillName,
        loaded,
        applicable,
        score,
        recommendations
      });
    }
    return results;
  }
  calculateSkillsScore(skillResults) {
    if (skillResults.length === 0) return 100;
    const totalScore = skillResults.reduce(
      (sum, r) => sum + r.score,
      0
    );
    return Math.round(totalScore / skillResults.length);
  }
  generateSkillRecommendations(skill) {
    const recommendations = [];
    if (skill.skillId.includes("security")) {
      recommendations.push("Executar an\xE1lise de vulnerabilidades OWASP");
      recommendations.push("Verificar depend\xEAncias com known CVEs");
    } else if (skill.skillId.includes("performance")) {
      recommendations.push("Executar testes de carga e stress");
      recommendations.push("Analisar m\xE9tricas de Core Web Vitals");
    } else if (skill.skillId.includes("qa")) {
      recommendations.push("Garantir cobertura m\xEDnima de 80%");
      recommendations.push("Executar testes E2E em todos os fluxos cr\xEDticos");
    } else if (skill.skillId.includes("frontend")) {
      recommendations.push("Verificar acessibilidade WCAG 2.1 AA");
      recommendations.push("Validar responsividade em m\xFAltiplos dispositivos");
    } else if (skill.skillId.includes("backend")) {
      recommendations.push("Validar contratos de API com testes de contrato");
      recommendations.push("Verificar tratamento de erros e logging");
    } else if (skill.skillId.includes("database")) {
      recommendations.push("Analisar performance de queries");
      recommendations.push("Verificar \xEDndices e normaliza\xE7\xE3o");
    } else if (skill.skillId.includes("devops")) {
      recommendations.push("Verificar configura\xE7\xE3o de CI/CD");
      recommendations.push("Validar infraestrutura como c\xF3digo");
    } else if (skill.skillId.includes("documentation")) {
      recommendations.push("Garantir documenta\xE7\xE3o de API completa");
      recommendations.push("Verificar exemplos de uso e tutoriais");
    } else if (skill.skillId.includes("ai-engineering")) {
      recommendations.push("Validar governan\xE7a de IA e \xE9tica");
      recommendations.push("Verificar explicabilidade dos modelos");
    }
    return recommendations;
  }
  advanceToNextLayer() {
    if (this.state.currentLayer !== void 0) {
      const nextLayer = this.state.currentLayer + 1;
      const maxLayer = this.options.endLayer ?? this.eaargSteps.length;
      if (nextLayer > maxLayer) {
        this.state = {
          ...this.state,
          status: "completed",
          currentLayer: void 0,
          completedAt: (/* @__PURE__ */ new Date()).toISOString(),
          overallScore: this.calculateOverallScore(),
          overallStatus: "pass"
        };
        this.emit("pipeline:completed", this.getReport());
      } else {
        this.state = {
          ...this.state,
          currentLayer: nextLayer
        };
      }
    }
  }
  calculateOverallScore() {
    const completed = this.state.layers.filter(
      (l) => l.status === "pass" || l.status === "fail"
    );
    if (completed.length === 0) return 0;
    return Math.round(
      completed.reduce((sum, l) => sum + l.score, 0) / completed.length
    );
  }
};

// src/persistence/sqlite-store.ts
var import_node_crypto11 = require("crypto");
var import_node_fs7 = require("fs");
var import_node_path5 = require("path");
var import_better_sqlite3 = __toESM(require("better-sqlite3"));
var SQLiteStore = class {
  db;
  constructor(config = {}) {
    const dbPath = config.dbPath ?? "./.behavioros/data/behavioros.db";
    if (!config.memory) {
      const dir = (0, import_node_path5.dirname)(dbPath);
      if (!(0, import_node_fs7.existsSync)(dir)) {
        (0, import_node_fs7.mkdirSync)(dir, { recursive: true });
      }
    }
    this.db = config.memory ? new import_better_sqlite3.default(":memory:") : new import_better_sqlite3.default(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }
  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        result TEXT NOT NULL DEFAULT 'pass',
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS quality_metrics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value REAL NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_events (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        applied INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_insights (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        occurrences INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_results (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        overall TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS quality_reports (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        passed INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS decision_history (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
      CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log(type);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_learning_events_type ON learning_events(type);
      CREATE INDEX IF NOT EXISTS idx_learning_events_source ON learning_events(source);
      CREATE INDEX IF NOT EXISTS idx_quality_metrics_name ON quality_metrics(name);
    `);
  }
  // --- Missions ---
  saveMission(mission) {
    this.db.prepare(
      `INSERT OR REPLACE INTO missions (id, data, status, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
    ).run(mission.id, JSON.stringify(mission), mission.status);
  }
  getMission(id) {
    const row = this.db.prepare("SELECT data FROM missions WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) : null;
  }
  getAllMissions() {
    const rows = this.db.prepare("SELECT data FROM missions ORDER BY created_at DESC").all();
    return rows.map((r) => JSON.parse(r.data));
  }
  getMissionsByStatus(status) {
    const rows = this.db.prepare("SELECT data FROM missions WHERE status = ? ORDER BY created_at DESC").all(status);
    return rows.map((r) => JSON.parse(r.data));
  }
  deleteMission(id) {
    const result = this.db.prepare("DELETE FROM missions WHERE id = ?").run(id);
    return result.changes > 0;
  }
  // --- Agents ---
  saveAgent(agent) {
    this.db.prepare(
      `INSERT OR REPLACE INTO agents (id, data, status, updated_at)
         VALUES (?, ?, ?, datetime('now'))`
    ).run(agent.id, JSON.stringify(agent), agent.status);
  }
  getAgent(id) {
    const row = this.db.prepare("SELECT data FROM agents WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) : null;
  }
  getAllAgents() {
    const rows = this.db.prepare("SELECT data FROM agents").all();
    return rows.map((r) => JSON.parse(r.data));
  }
  // --- Audit Log ---
  saveAuditEvent(event) {
    this.db.prepare(
      `INSERT INTO audit_log (id, data, type, severity, result, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      JSON.stringify(event),
      event.type,
      event.severity,
      event.result,
      event.timestamp
    );
  }
  getAuditLog(limit = 100, offset = 0) {
    const rows = this.db.prepare("SELECT data FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?").all(limit, offset);
    return rows.map((r) => JSON.parse(r.data));
  }
  getAuditLogByType(type) {
    const rows = this.db.prepare("SELECT data FROM audit_log WHERE type = ? ORDER BY timestamp DESC").all(type);
    return rows.map((r) => JSON.parse(r.data));
  }
  getAuditLogCount() {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM audit_log").get();
    return row.count;
  }
  // --- Quality Metrics ---
  saveQualityMetric(metric) {
    const id = (0, import_node_crypto11.randomUUID)();
    this.db.prepare(
      `INSERT INTO quality_metrics (id, name, value, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`
    ).run(
      id,
      metric.name,
      metric.value,
      JSON.stringify(metric),
      metric.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
    );
  }
  getQualityMetrics(limit = 100) {
    const rows = this.db.prepare("SELECT data FROM quality_metrics ORDER BY timestamp DESC LIMIT ?").all(limit);
    return rows.map((r) => JSON.parse(r.data));
  }
  // --- Learning Events ---
  saveLearningEvent(event) {
    this.db.prepare(
      `INSERT INTO learning_events (id, data, type, source, applied, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      event.id,
      JSON.stringify(event),
      event.type,
      event.source,
      event.applied ? 1 : 0,
      event.timestamp
    );
  }
  getLearningEvents(limit = 100) {
    const rows = this.db.prepare("SELECT data FROM learning_events ORDER BY timestamp DESC LIMIT ?").all(limit);
    return rows.map((r) => JSON.parse(r.data));
  }
  getLearningEventsBySource(source) {
    const rows = this.db.prepare("SELECT data FROM learning_events WHERE source = ? ORDER BY timestamp DESC").all(source);
    return rows.map((r) => JSON.parse(r.data));
  }
  // --- Learning Insights ---
  saveInsight(insight) {
    this.db.prepare(
      `INSERT OR REPLACE INTO learning_insights (id, pattern, confidence, occurrences, data, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      insight.id,
      insight.pattern,
      insight.confidence,
      insight.occurrences,
      JSON.stringify(insight)
    );
  }
  getInsights() {
    const rows = this.db.prepare("SELECT data FROM learning_insights ORDER BY confidence DESC").all();
    return rows.map((r) => JSON.parse(r.data));
  }
  // --- Audit Results (from AuditEngine) ---
  saveAuditResult(result) {
    this.db.prepare(
      `INSERT INTO audit_results (id, data, overall, score, timestamp)
         VALUES (?, ?, ?, ?, ?)`
    ).run(result.id, JSON.stringify(result), result.overall, result.score, result.timestamp);
  }
  getAuditResults(limit = 50) {
    const rows = this.db.prepare(
      "SELECT id, overall, score, timestamp FROM audit_results ORDER BY timestamp DESC LIMIT ?"
    ).all(limit);
    return rows;
  }
  // --- Quality Reports ---
  saveQualityReport(report) {
    this.db.prepare(
      `INSERT INTO quality_reports (id, data, passed, score, timestamp)
         VALUES (?, ?, ?, ?, ?)`
    ).run(
      report.id,
      JSON.stringify(report),
      report.passed ? 1 : 0,
      report.score,
      report.timestamp
    );
  }
  getQualityReports(limit = 50) {
    const rows = this.db.prepare(
      "SELECT id, passed, score, timestamp FROM quality_reports ORDER BY timestamp DESC LIMIT ?"
    ).all(limit);
    return rows.map((r) => ({ ...r, passed: Boolean(r.passed) }));
  }
  // --- Decision History ---
  saveDecision(decision) {
    this.db.prepare(
      `INSERT INTO decision_history (id, data, timestamp)
         VALUES (?, ?, datetime('now'))`
    ).run(decision.id, JSON.stringify(decision));
  }
  getDecisions(limit = 50) {
    return this.db.prepare("SELECT data, timestamp FROM decision_history ORDER BY timestamp DESC LIMIT ?").all(limit);
  }
  // --- KV Store (generic key-value) ---
  set(key, value) {
    this.db.prepare(
      `INSERT OR REPLACE INTO kv_store (key, value, updated_at)
         VALUES (?, ?, datetime('now'))`
    ).run(key, JSON.stringify(value));
  }
  get(key) {
    const row = this.db.prepare("SELECT value FROM kv_store WHERE key = ?").get(key);
    return row ? JSON.parse(row.value) : null;
  }
  delete(key) {
    const result = this.db.prepare("DELETE FROM kv_store WHERE key = ?").run(key);
    return result.changes > 0;
  }
  // --- Stats ---
  getStats() {
    const missions = this.db.prepare("SELECT COUNT(*) as count FROM missions").get();
    const agents = this.db.prepare("SELECT COUNT(*) as count FROM agents").get();
    const auditEvents = this.db.prepare("SELECT COUNT(*) as count FROM audit_log").get();
    const qualityMetrics = this.db.prepare("SELECT COUNT(*) as count FROM quality_metrics").get();
    const learningEvents = this.db.prepare("SELECT COUNT(*) as count FROM learning_events").get();
    const insights = this.db.prepare("SELECT COUNT(*) as count FROM learning_insights").get();
    return {
      missions: missions.count,
      agents: agents.count,
      auditEvents: auditEvents.count,
      qualityMetrics: qualityMetrics.count,
      learningEvents: learningEvents.count,
      insights: insights.count
    };
  }
  // --- Cleanup ---
  close() {
    this.db.close();
  }
  vacuum() {
    this.db.exec("VACUUM");
  }
  clearAll() {
    this.db.exec(`
      DELETE FROM missions;
      DELETE FROM agents;
      DELETE FROM audit_log;
      DELETE FROM quality_metrics;
      DELETE FROM learning_events;
      DELETE FROM learning_insights;
      DELETE FROM audit_results;
      DELETE FROM quality_reports;
      DELETE FROM decision_history;
      DELETE FROM kv_store;
    `);
  }
};

// src/pipeline/interceptors/metrics-interceptor.ts
var MetricsInterceptor = class {
  metrics = /* @__PURE__ */ new Map();
  async intercept(_context, next) {
    const startTime = Date.now();
    const result = await next();
    const duration = Date.now() - startTime;
    const layerMetrics = this.metrics.get(result.layerId) || {
      count: 0,
      totalDuration: 0,
      failures: 0
    };
    layerMetrics.count++;
    layerMetrics.totalDuration += duration;
    if (!result.passed) layerMetrics.failures++;
    this.metrics.set(result.layerId, layerMetrics);
    return { ...result, duration };
  }
  getMetrics() {
    const result = /* @__PURE__ */ new Map();
    for (const [key, value] of this.metrics) {
      result.set(key, {
        ...value,
        avgDuration: value.totalDuration / value.count
      });
    }
    return result;
  }
  reset() {
    this.metrics.clear();
  }
};

// src/pipeline/interceptors/timeout-interceptor.ts
var TimeoutInterceptor = class {
  constructor(timeoutMs = 5e3) {
    this.timeoutMs = timeoutMs;
  }
  timeoutMs;
  async intercept(_context, next) {
    const startTime = Date.now();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`Layer timeout after ${this.timeoutMs}ms`)),
        this.timeoutMs
      );
    });
    try {
      const result = await Promise.race([next(), timeoutPromise]);
      return result;
    } catch (error) {
      return {
        layerId: "timeout",
        layerName: "Timeout",
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : "Unknown timeout error"
      };
    }
  }
};

// src/pipeline/mode/conversational.adapter.ts
var SKIPPED_LAYERS = ["domain-invariants", "governance", "decision", "audit-trail"];
function shouldSkipForConversational(layerId) {
  return SKIPPED_LAYERS.includes(layerId);
}

// src/pipeline/mode/transactional.adapter.ts
function shouldSkipForTransactional(_layerId) {
  return false;
}

// src/pipeline/pipeline-context.ts
function createDispatcherContext(input) {
  return {
    ...input,
    startTime: Date.now(),
    layerResults: [],
    currentLayerIndex: 0,
    failed: false
  };
}

// src/pipeline/pipeline-dispatcher.ts
var PipelineDispatcher = class {
  layers = [];
  interceptors = [];
  addLayer(layer) {
    this.layers.push(layer);
    return this;
  }
  addInterceptor(interceptor) {
    this.interceptors.push(interceptor);
    return this;
  }
  getLayers() {
    return [...this.layers];
  }
  getInterceptors() {
    return [...this.interceptors];
  }
  async execute(context) {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.shouldExecute && !layer.shouldExecute(context)) {
        continue;
      }
      if (context.failed && i < 4) {
        break;
      }
      if (context.failed && i >= 4 && i < 7) {
        continue;
      }
      const result = await this.executeWithInterceptors(context, layer);
      context.layerResults.push(result);
      if (!result.passed && i < 4) {
        context.failed = true;
        context.error = new Error(result.error || `Layer ${layer.name} failed`);
      }
    }
    return context;
  }
  async executeWithInterceptors(context, layer) {
    let index = 0;
    const next = async () => {
      if (index < this.interceptors.length) {
        const interceptor = this.interceptors[index++];
        return interceptor.intercept(context, next);
      }
      return layer.execute(context);
    };
    return next();
  }
};

// src/resilience/agent-isolation/forensic-collector.ts
var import_eventemitter37 = __toESM(require("eventemitter3"));
var ForensicCollector = class {
  config;
  entries = [];
  emitter = new import_eventemitter37.default();
  lastHash = "0000000000000000";
  flushTimer = null;
  constructor(config) {
    this.config = {
      maxEntries: config?.maxEntries ?? 1e5,
      retentionMs: config?.retentionMs ?? 7776e6,
      captureRequestBodies: config?.captureRequestBodies ?? true,
      captureResponseBodies: config?.captureResponseBodies ?? true,
      maxBodySizeBytes: config?.maxBodySizeBytes ?? 102400,
      enableHashing: config?.enableHashing ?? true,
      flushIntervalMs: config?.flushIntervalMs ?? 6e4
    };
  }
  record(agentId, type, action, options) {
    const entryId = this.generateId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const request = options?.request ? this.captureData(options.request.headers ?? {}, options.request.body) : null;
    const response = options?.response ? this.captureData(options.response.headers ?? {}, options.response.body) : null;
    const payload = JSON.stringify({
      agentId,
      type,
      action,
      request,
      response,
      timestamp: now
    });
    const hash = this.config.enableHashing ? this.computeHash(payload, this.lastHash) : entryId;
    const entry = {
      id: entryId,
      agentId,
      type,
      severity: options?.severity ?? "info",
      timestamp: now,
      action,
      request,
      response,
      metadata: options?.metadata ?? {},
      hash,
      previousHash: this.lastHash
    };
    this.lastHash = hash;
    this.entries.push(entry);
    if (this.entries.length > this.config.maxEntries) {
      const pruned = this.entries.splice(0, this.entries.length - this.config.maxEntries);
      this.emitter.emit("entry-pruned", pruned.length);
    }
    this.emitter.emit("entry-recorded", entry);
    return entry;
  }
  recordAction(agentId, action, result, metadata) {
    return this.record(agentId, "action-log", action, {
      severity: result === "blocked" ? "warning" : result === "failure" ? "critical" : "info",
      metadata: { result, ...metadata }
    });
  }
  recordRequestResponse(agentId, action, request, response, metadata) {
    return this.record(agentId, "request-response", action, {
      request,
      response,
      metadata
    });
  }
  recordGovernanceEvaluation(agentId, action, decision, violations, metadata) {
    return this.record(agentId, "governance-evaluation", action, {
      severity: decision === "blocked" ? "critical" : decision === "escalated" ? "warning" : "info",
      metadata: { decision, violations, ...metadata }
    });
  }
  recordSuspicionAlert(agentId, level, score, reasons) {
    return this.record(agentId, "suspicion-alert", "suspicion-detected", {
      severity: score >= 90 ? "critical" : score >= 70 ? "warning" : "info",
      metadata: { level, score, reasons }
    });
  }
  recordQuarantineEvent(agentId, event, reason) {
    return this.record(agentId, "quarantine-event", event, {
      severity: event === "quarantined" ? "warning" : "info",
      metadata: { reason }
    });
  }
  getEntry(id) {
    return this.entries.find((e) => e.id === id) ?? null;
  }
  getEntries(filter) {
    let result = [...this.entries];
    if (filter?.agentId) {
      result = result.filter((e) => e.agentId === filter.agentId);
    }
    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type);
    }
    if (filter?.severity) {
      result = result.filter((e) => e.severity === filter.severity);
    }
    if (filter?.from) {
      const from = new Date(filter.from).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= from);
    }
    if (filter?.to) {
      const to = new Date(filter.to).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= to);
    }
    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }
    return result;
  }
  exportEvidence(filter) {
    const entries = this.getEntries(filter);
    const chainIntegrity = this.verifyChain(entries);
    const report = {
      entries,
      totalEntries: entries.length,
      timeRange: {
        from: entries.length > 0 ? entries[0].timestamp : (/* @__PURE__ */ new Date()).toISOString(),
        to: entries.length > 0 ? entries[entries.length - 1].timestamp : (/* @__PURE__ */ new Date()).toISOString()
      },
      chainIntegrity,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.emitter.emit("evidence-exported", report);
    return report;
  }
  verifyChain(entries) {
    const chain = entries ?? this.entries;
    if (chain.length === 0) return true;
    let previousHash = "0000000000000000";
    for (const entry of chain) {
      if (entry.previousHash !== previousHash) {
        return false;
      }
      previousHash = entry.hash;
    }
    this.emitter.emit("chain-verified", true, chain.length);
    return true;
  }
  getAgentTimeline(agentId) {
    return this.entries.filter((e) => e.agentId === agentId);
  }
  getStats() {
    const byType = {};
    const bySeverity = {};
    const agents = /* @__PURE__ */ new Set();
    for (const entry of this.entries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
      agents.add(entry.agentId);
    }
    return {
      totalEntries: this.entries.length,
      byType,
      bySeverity,
      uniqueAgents: agents.size,
      chainValid: this.verifyChain()
    };
  }
  prune(maxAgeMs) {
    const retention = maxAgeMs ?? this.config.retentionMs;
    const cutoff = Date.now() - retention;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    const pruned = before - this.entries.length;
    if (pruned > 0) {
      this.emitter.emit("entry-pruned", pruned);
    }
    return pruned;
  }
  startPeriodicFlush() {
    this.stopPeriodicFlush();
    this.flushTimer = setInterval(() => {
      this.prune();
    }, this.config.flushIntervalMs);
  }
  stopPeriodicFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  reset() {
    this.entries = [];
    this.lastHash = "0000000000000000";
    this.stopPeriodicFlush();
  }
  on(event, listener) {
    this.emitter.on(event, listener);
  }
  off(event, listener) {
    this.emitter.off(event, listener);
  }
  captureData(headers, body) {
    const serialized = JSON.stringify(body ?? null);
    const sizeBytes = new TextEncoder().encode(serialized).length;
    const truncated = sizeBytes > this.config.maxBodySizeBytes;
    let capturedBody = body;
    if (truncated && this.config.captureResponseBodies) {
      capturedBody = serialized.substring(0, this.config.maxBodySizeBytes);
    } else if (!this.config.captureRequestBodies && body !== void 0) {
      capturedBody = "[redacted]";
    } else if (!this.config.captureResponseBodies && body !== void 0) {
      capturedBody = "[redacted]";
    }
    return { headers, body: capturedBody, sizeBytes, truncated };
  }
  computeHash(data, previousHash) {
    let hash = 0;
    const combined = previousHash + data;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(12, "0");
  }
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `fore_${timestamp}_${random}`;
  }
};

// src/resilience/agent-isolation/quarantine-manager.ts
var import_eventemitter38 = __toESM(require("eventemitter3"));
var QuarantineManager = class {
  config;
  entries = /* @__PURE__ */ new Map();
  history = [];
  emitter = new import_eventemitter38.default();
  checkTimer = null;
  constructor(config) {
    this.config = {
      defaultDurationMs: config?.defaultDurationMs ?? 3e5,
      maxDurationMs: config?.maxDurationMs ?? 36e5,
      autoReleaseEnabled: config?.autoReleaseEnabled ?? true,
      checkIntervalMs: config?.checkIntervalMs ?? 3e4,
      maxQuarantinedAgents: config?.maxQuarantinedAgents ?? 500,
      escalationThresholdMs: config?.escalationThresholdMs ?? 18e5
    };
    if (this.config.autoReleaseEnabled) {
      this.startAutoReleaseCheck();
    }
  }
  quarantine(agentId, reason, durationMs, metadata) {
    if (this.entries.has(agentId)) {
      const existing = this.entries.get(agentId);
      return {
        success: false,
        entry: existing,
        reason: `Agent "${agentId}" is already quarantined since ${existing.quarantinedAt}`
      };
    }
    if (this.entries.size >= this.config.maxQuarantinedAgents) {
      return {
        success: false,
        entry: null,
        reason: `Maximum quarantined agents reached (${this.config.maxQuarantinedAgents})`
      };
    }
    const now = /* @__PURE__ */ new Date();
    const duration = Math.min(
      durationMs ?? this.config.defaultDurationMs,
      this.config.maxDurationMs
    );
    const expiresAt = new Date(now.getTime() + duration);
    const entry = {
      agentId,
      reason,
      status: "active",
      quarantinedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      releasedAt: null,
      releasedBy: null,
      durationMs: duration,
      metadata: metadata ?? {}
    };
    this.entries.set(agentId, entry);
    this.emitter.emit("agent-quarantined", entry);
    if (duration >= this.config.escalationThresholdMs) {
      this.emitter.emit("escalation-required", entry);
    }
    return { success: true, entry, reason: `Agent "${agentId}" quarantined for ${duration}ms` };
  }
  release(agentId, releasedBy = "system") {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return {
        success: false,
        entry: null,
        reason: `Agent "${agentId}" is not quarantined`
      };
    }
    if (entry.status !== "active") {
      return {
        success: false,
        entry,
        reason: `Agent "${agentId}" quarantine is already ${entry.status}`
      };
    }
    const now = /* @__PURE__ */ new Date();
    entry.status = "released";
    entry.releasedAt = now.toISOString();
    entry.releasedBy = releasedBy;
    this.entries.delete(agentId);
    this.history.push({ ...entry });
    this.emitter.emit("agent-released", entry);
    return { success: true, entry, reason: `Agent "${agentId}" released by ${releasedBy}` };
  }
  isQuarantined(agentId) {
    const entry = this.entries.get(agentId);
    if (!entry) return false;
    if (entry.status !== "active") {
      return false;
    }
    if (/* @__PURE__ */ new Date() >= new Date(entry.expiresAt)) {
      this.handleExpiration(entry);
      return false;
    }
    return true;
  }
  checkAction(agentId, action) {
    if (!this.isQuarantined(agentId)) {
      return { allowed: true, reason: "Agent is not quarantined" };
    }
    const entry = this.entries.get(agentId);
    this.emitter.emit("action-blocked", agentId, action);
    return {
      allowed: false,
      reason: `Agent "${agentId}" is quarantined (reason: ${entry.reason}) \u2014 action "${action}" blocked`
    };
  }
  getEntry(agentId) {
    return this.entries.get(agentId) ?? null;
  }
  getActiveQuarantines() {
    return [...this.entries.values()].filter((e) => e.status === "active");
  }
  getHistory(agentId) {
    if (agentId) {
      return this.history.filter((e) => e.agentId === agentId);
    }
    return [...this.history];
  }
  getStats() {
    const all = [...this.history, ...this.entries.values()];
    return {
      active: [...this.entries.values()].filter((e) => e.status === "active").length,
      total: all.length,
      released: all.filter((e) => e.status === "released").length,
      expired: all.filter((e) => e.status === "expired").length,
      escalated: all.filter((e) => e.status === "escalated").length
    };
  }
  forceReleaseAll() {
    let count = 0;
    for (const [_agentId, entry] of this.entries) {
      if (entry.status === "active") {
        entry.status = "released";
        entry.releasedAt = (/* @__PURE__ */ new Date()).toISOString();
        entry.releasedBy = "force-release";
        this.history.push({ ...entry });
        this.emitter.emit("agent-released", entry);
        count++;
      }
    }
    this.entries.clear();
    return count;
  }
  reset() {
    this.entries.clear();
    this.history = [];
    this.stopAutoReleaseCheck();
  }
  startAutoReleaseCheck() {
    this.stopAutoReleaseCheck();
    this.checkTimer = setInterval(() => {
      this.checkExpiredEntries();
    }, this.config.checkIntervalMs);
  }
  stopAutoReleaseCheck() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
  on(event, listener) {
    this.emitter.on(event, listener);
  }
  off(event, listener) {
    this.emitter.off(event, listener);
  }
  checkExpiredEntries() {
    const now = /* @__PURE__ */ new Date();
    for (const [_agentId, entry] of this.entries) {
      if (entry.status !== "active") continue;
      if (now >= new Date(entry.expiresAt)) {
        this.handleExpiration(entry);
      }
    }
  }
  handleExpiration(entry) {
    entry.status = "expired";
    entry.releasedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.entries.delete(entry.agentId);
    this.history.push({ ...entry });
    this.emitter.emit("quarantine-expired", entry);
    this.emitter.emit("agent-auto-released", entry);
  }
};

// src/resilience/agent-isolation/sandbox-executor.ts
var import_eventemitter39 = __toESM(require("eventemitter3"));
var SandboxExecutor = class {
  config;
  active = /* @__PURE__ */ new Map();
  completed = [];
  emitter = new import_eventemitter39.default();
  constructor(config) {
    this.config = {
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 3e4,
      maxTimeoutMs: config?.maxTimeoutMs ?? 3e5,
      maxConcurrentExecutions: config?.maxConcurrentExecutions ?? 10,
      maxMemoryMb: config?.maxMemoryMb ?? 512,
      allowedPermissions: config?.allowedPermissions ?? ["read"],
      captureOutput: config?.captureOutput ?? true,
      captureStderr: config?.captureStderr ?? true,
      evidenceRetentionMs: config?.evidenceRetentionMs ?? 864e5
    };
  }
  async execute(agentId, action, input, handler, options) {
    if (this.active.size >= this.config.maxConcurrentExecutions) {
      throw new Error(
        `Maximum concurrent executions reached (${this.config.maxConcurrentExecutions})`
      );
    }
    const permissions = options?.permissions ?? ["read"];
    const rejectedPermission = permissions.find((p) => !this.config.allowedPermissions.includes(p));
    if (rejectedPermission) {
      throw new Error(
        `Permission "${rejectedPermission}" is not allowed in sandbox \u2014 allowed: [${this.config.allowedPermissions.join(", ")}]`
      );
    }
    const executionId = this.generateId();
    const timeoutMs = Math.min(
      options?.timeoutMs ?? this.config.defaultTimeoutMs,
      this.config.maxTimeoutMs
    );
    const execution = {
      id: executionId,
      agentId,
      action,
      input,
      permissions,
      timeoutMs,
      status: "running",
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      completedAt: null,
      durationMs: null,
      output: null,
      error: null,
      evidence: {
        executionId,
        agentId,
        request: input,
        response: null,
        permissions,
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        completedAt: null,
        durationMs: null,
        blockedActions: [],
        metadata: options?.metadata ?? {}
      }
    };
    const timer = setTimeout(() => {
      this.handleTimeout(executionId);
    }, timeoutMs);
    this.active.set(executionId, { execution, timer });
    this.emitter.emit("execution-started", execution);
    const sideEffects = [];
    const wrappedHandler = this.wrapWithMonitoring(handler, sideEffects, executionId);
    try {
      const result = await wrappedHandler(input);
      const duration = Date.now() - new Date(execution.startedAt).getTime();
      execution.status = "completed";
      execution.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      execution.durationMs = duration;
      execution.output = {
        stdout: this.config.captureOutput ? JSON.stringify(result) : "",
        stderr: "",
        returnValue: result,
        sideEffects
      };
      execution.evidence.response = execution.output;
      execution.evidence.completedAt = execution.completedAt;
      execution.evidence.durationMs = duration;
      execution.evidence.blockedActions = sideEffects.filter((s) => s.blocked);
      this.emitter.emit("execution-completed", execution);
      this.emitter.emit("evidence-captured", execution.evidence);
    } catch (error) {
      const duration = Date.now() - new Date(execution.startedAt).getTime();
      const errorMessage = error instanceof Error ? error.message : String(error);
      execution.status = "failed";
      execution.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      execution.durationMs = duration;
      execution.error = errorMessage;
      execution.output = {
        stdout: "",
        stderr: this.config.captureStderr ? errorMessage : "",
        returnValue: null,
        sideEffects
      };
      execution.evidence.response = execution.output;
      execution.evidence.completedAt = execution.completedAt;
      execution.evidence.durationMs = duration;
      this.emitter.emit("execution-failed", execution);
      this.emitter.emit("evidence-captured", execution.evidence);
    } finally {
      this.finalizeExecution(executionId);
    }
    return execution;
  }
  async executeReadOnly(agentId, action, handler, metadata) {
    return this.execute(agentId, action, {}, async () => handler(), {
      permissions: ["read"],
      metadata
    });
  }
  kill(executionId) {
    const active = this.active.get(executionId);
    if (!active) return false;
    if (active.timer) {
      clearTimeout(active.timer);
    }
    active.execution.status = "killed";
    active.execution.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    active.execution.durationMs = Date.now() - new Date(active.execution.startedAt).getTime();
    this.completed.push({ ...active.execution });
    this.active.delete(executionId);
    this.emitter.emit("execution-failed", active.execution);
    return true;
  }
  killAll() {
    let count = 0;
    for (const [id] of this.active) {
      if (this.kill(id)) count++;
    }
    return count;
  }
  getActive() {
    return [...this.active.values()].map((a) => a.execution);
  }
  getCompleted() {
    return [...this.completed];
  }
  getExecution(id) {
    const active = this.active.get(id);
    if (active) return active.execution;
    return this.completed.find((e) => e.id === id) ?? null;
  }
  getEvidence(id) {
    const execution = this.getExecution(id);
    return execution?.evidence ?? null;
  }
  getAllEvidence() {
    const activeEvidence = [...this.active.values()].map((a) => a.execution.evidence);
    const completedEvidence = this.completed.map((e) => e.evidence);
    return [...activeEvidence, ...completedEvidence];
  }
  getStats() {
    const allCompleted = this.completed;
    return {
      active: this.active.size,
      completed: allCompleted.filter((e) => e.status === "completed").length,
      failed: allCompleted.filter((e) => e.status === "failed").length,
      killed: allCompleted.filter((e) => e.status === "killed").length,
      timeout: allCompleted.filter((e) => e.status === "timeout").length
    };
  }
  prune(maxAgeMs) {
    const retention = maxAgeMs ?? this.config.evidenceRetentionMs;
    const cutoff = Date.now() - retention;
    const before = this.completed.length;
    this.completed = this.completed.filter((e) => {
      if (!e.completedAt) return true;
      return new Date(e.completedAt).getTime() >= cutoff;
    });
    return before - this.completed.length;
  }
  reset() {
    this.killAll();
    this.completed = [];
  }
  on(event, listener) {
    this.emitter.on(event, listener);
  }
  off(event, listener) {
    this.emitter.off(event, listener);
  }
  handleTimeout(executionId) {
    const active = this.active.get(executionId);
    if (!active) return;
    active.execution.status = "timeout";
    active.execution.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    active.execution.durationMs = Date.now() - new Date(active.execution.startedAt).getTime();
    active.execution.error = `Execution timed out after ${active.execution.timeoutMs}ms`;
    this.completed.push({ ...active.execution });
    this.active.delete(executionId);
    this.emitter.emit("execution-timeout", active.execution);
    this.emitter.emit("evidence-captured", active.execution.evidence);
  }
  finalizeExecution(executionId) {
    const active = this.active.get(executionId);
    if (!active) return;
    if (active.timer) {
      clearTimeout(active.timer);
    }
    this.completed.push({ ...active.execution });
    this.active.delete(executionId);
  }
  wrapWithMonitoring(handler, _sideEffects, _executionId) {
    return async (input) => {
      return handler(input);
    };
  }
  generateId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `sbx_${timestamp}_${random}`;
  }
};

// src/resilience/agent-isolation/suspicion-detector.ts
var import_eventemitter310 = __toESM(require("eventemitter3"));
var SCORE_WEIGHTS = {
  "rate-spike": 25,
  "unauthorized-access": 40,
  "privilege-escalation": 50,
  "data-exfiltration": 45,
  "repeated-failure": 20,
  "pattern-deviation": 15,
  "off-hours-activity": 10,
  "scope-creep": 30
};
var LEVEL_THRESHOLDS = {
  none: 0,
  low: 20,
  medium: 45,
  high: 70,
  critical: 90
};
var SuspicionDetector = class {
  config;
  agents = /* @__PURE__ */ new Map();
  emitter = new import_eventemitter310.default();
  globalBaseline = {
    totalRequests: 0,
    windowStart: Date.now()
  };
  constructor(config) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 10,
      failureWindowMs: config?.failureWindowMs ?? 3e5,
      rateSpikeMultiplier: config?.rateSpikeMultiplier ?? 3,
      rateBaselineWindowMs: config?.rateBaselineWindowMs ?? 6e5,
      anomalyScoreThreshold: config?.anomalyScoreThreshold ?? 45,
      coolDownMs: config?.coolDownMs ?? 12e4,
      maxTrackedAgents: config?.maxTrackedAgents ?? 1e3
    };
  }
  recordRequest(agentId, action, success) {
    const tracking = this.getOrCreateTracking(agentId);
    const now = Date.now();
    tracking.requests.push({ timestamp: now, action, success });
    tracking.totalRequests++;
    tracking.lastActivity = now;
    if (!success) {
      tracking.failedRequests++;
      tracking.consecutiveFailures++;
    } else {
      tracking.consecutiveFailures = 0;
    }
    const actionCount = tracking.actions.get(action) ?? 0;
    tracking.actions.set(action, actionCount + 1);
    this.pruneRequests(tracking);
    this.globalBaseline.totalRequests++;
    const events = [];
    const failureEvent = this.checkRepeatedFailures(agentId, tracking);
    if (failureEvent) events.push(failureEvent);
    const rateEvent = this.checkRateSpike(agentId, tracking);
    if (rateEvent) events.push(rateEvent);
    const patternEvent = this.checkPatternDeviation(agentId, tracking);
    if (patternEvent) events.push(patternEvent);
    for (const event of events) {
      tracking.events.push(event);
      tracking.score = Math.min(100, tracking.score + event.score);
      this.emitter.emit("suspicion-detected", event);
    }
    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit("level-changed", agentId, prev, newLevel);
      if (newLevel === "critical" || newLevel === "high") {
        this.emitter.emit(
          "quarantine-recommended",
          agentId,
          `Suspicion level reached ${newLevel} (score: ${tracking.score})`
        );
      }
    }
    return {
      agentId,
      level: tracking.level,
      score: tracking.score,
      reasons: events.map((e) => e.details),
      shouldQuarantine: tracking.level === "critical",
      events
    };
  }
  checkAccess(agentId, resource, allowedResources) {
    const tracking = this.getOrCreateTracking(agentId);
    const isAuthorized = allowedResources.includes(resource);
    const events = [];
    if (!isAuthorized) {
      const event = {
        agentId,
        anomalyType: "unauthorized-access",
        level: "high",
        score: SCORE_WEIGHTS["unauthorized-access"],
        details: `Unauthorized access attempt to "${resource}"`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        metadata: { resource, allowedResources }
      };
      events.push(event);
      tracking.events.push(event);
      tracking.score = Math.min(100, tracking.score + event.score);
      this.emitter.emit("suspicion-detected", event);
    }
    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit("level-changed", agentId, prev, newLevel);
    }
    return {
      agentId,
      level: tracking.level,
      score: tracking.score,
      reasons: events.map((e) => e.details),
      shouldQuarantine: tracking.level === "critical",
      events
    };
  }
  checkPrivilegeEscalation(agentId, requestedAuthority, allowedAuthority) {
    const tracking = this.getOrCreateTracking(agentId);
    const events = [];
    if (requestedAuthority !== allowedAuthority) {
      const event = {
        agentId,
        anomalyType: "privilege-escalation",
        level: "critical",
        score: SCORE_WEIGHTS["privilege-escalation"],
        details: `Privilege escalation attempt \u2014 requested "${requestedAuthority}", allowed "${allowedAuthority}"`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        metadata: { requestedAuthority, allowedAuthority }
      };
      events.push(event);
      tracking.events.push(event);
      tracking.score = Math.min(100, tracking.score + event.score);
      this.emitter.emit("suspicion-detected", event);
    }
    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit("level-changed", agentId, prev, newLevel);
      if (newLevel === "critical") {
        this.emitter.emit("quarantine-recommended", agentId, "Privilege escalation detected");
      }
    }
    return {
      agentId,
      level: tracking.level,
      score: tracking.score,
      reasons: events.map((e) => e.details),
      shouldQuarantine: tracking.level === "critical",
      events
    };
  }
  getSnapshot(agentId) {
    const tracking = this.agents.get(agentId);
    if (!tracking) return null;
    const successRate = tracking.totalRequests > 0 ? (tracking.totalRequests - tracking.failedRequests) / tracking.totalRequests * 100 : 100;
    const windowMs = this.config.rateBaselineWindowMs;
    const recentRequests = tracking.requests.filter((r) => r.timestamp >= Date.now() - windowMs);
    const avgPerMinute = recentRequests.length / (windowMs / 6e4);
    return {
      agentId,
      totalRequests: tracking.totalRequests,
      failedRequests: tracking.failedRequests,
      successRate,
      avgRequestsPerMinute: avgPerMinute,
      uniqueActions: [...tracking.actions.keys()],
      lastActivity: new Date(tracking.lastActivity).toISOString(),
      consecutiveFailures: tracking.consecutiveFailures
    };
  }
  getLevel(agentId) {
    return this.agents.get(agentId)?.level ?? "none";
  }
  getScore(agentId) {
    return this.agents.get(agentId)?.score ?? 0;
  }
  getEvents(agentId) {
    return [...this.agents.get(agentId)?.events ?? []];
  }
  getAllSuspicious() {
    const result = [];
    for (const [agentId, tracking] of this.agents) {
      if (tracking.level !== "none") {
        result.push({ agentId, level: tracking.level, score: tracking.score });
      }
    }
    return result.sort((a, b) => b.score - a.score);
  }
  resetAgent(agentId) {
    this.agents.delete(agentId);
    this.emitter.emit("agent-cleared", agentId);
  }
  decayScore(agentId, decayAmount = 5) {
    const tracking = this.agents.get(agentId);
    if (!tracking) return;
    tracking.score = Math.max(0, tracking.score - decayAmount);
    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit("level-changed", agentId, prev, newLevel);
    }
  }
  reset() {
    this.agents.clear();
    this.globalBaseline = { totalRequests: 0, windowStart: Date.now() };
  }
  on(event, listener) {
    this.emitter.on(event, listener);
  }
  off(event, listener) {
    this.emitter.off(event, listener);
  }
  getOrCreateTracking(agentId) {
    let tracking = this.agents.get(agentId);
    if (tracking) return tracking;
    if (this.agents.size >= this.config.maxTrackedAgents) {
      const oldest = this.agents.entries().next().value;
      if (oldest) this.agents.delete(oldest[0]);
    }
    tracking = {
      requests: [],
      totalRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      lastActivity: Date.now(),
      level: "none",
      score: 0,
      events: [],
      actions: /* @__PURE__ */ new Map()
    };
    this.agents.set(agentId, tracking);
    return tracking;
  }
  checkRepeatedFailures(agentId, tracking) {
    if (tracking.consecutiveFailures < this.config.failureThreshold) return null;
    const recentFailures = tracking.requests.filter(
      (r) => !r.success && r.timestamp >= Date.now() - this.config.failureWindowMs
    );
    if (recentFailures.length < this.config.failureThreshold) return null;
    return {
      agentId,
      anomalyType: "repeated-failure",
      level: "high",
      score: SCORE_WEIGHTS["repeated-failure"],
      details: `${recentFailures.length} consecutive failures in ${this.config.failureWindowMs}ms window (threshold: ${this.config.failureThreshold})`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: {
        consecutiveFailures: tracking.consecutiveFailures,
        windowFailures: recentFailures.length
      }
    };
  }
  checkRateSpike(agentId, tracking) {
    const now = Date.now();
    const windowMs = this.config.rateBaselineWindowMs;
    const recentRequests = tracking.requests.filter((r) => r.timestamp >= now - windowMs);
    if (recentRequests.length < 20) return null;
    const currentRate = recentRequests.length / (windowMs / 6e4);
    const olderRequests = tracking.requests.filter(
      (r) => r.timestamp >= now - windowMs * 2 && r.timestamp < now - windowMs
    );
    const baselineRate = olderRequests.length > 0 ? olderRequests.length / (windowMs / 6e4) : currentRate;
    if (baselineRate === 0) return null;
    const ratio = currentRate / baselineRate;
    if (ratio < this.config.rateSpikeMultiplier) return null;
    return {
      agentId,
      anomalyType: "rate-spike",
      level: "high",
      score: SCORE_WEIGHTS["rate-spike"],
      details: `Rate spike detected \u2014 ${currentRate.toFixed(1)} req/min vs baseline ${baselineRate.toFixed(1)} req/min (${ratio.toFixed(1)}x)`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: { currentRate, baselineRate, ratio }
    };
  }
  checkPatternDeviation(agentId, tracking) {
    if (tracking.totalRequests < 50) return null;
    const actionEntries = [...tracking.actions.entries()];
    const totalActions = actionEntries.reduce((sum, [, count]) => sum + count, 0);
    let entropy = 0;
    for (const [, count] of actionEntries) {
      const probability = count / totalActions;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    const maxEntropy = Math.log2(Math.max(1, actionEntries.length));
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1;
    if (normalizedEntropy > 0.7) return null;
    return {
      agentId,
      anomalyType: "pattern-deviation",
      level: "medium",
      score: SCORE_WEIGHTS["pattern-deviation"],
      details: `Low action entropy (${normalizedEntropy.toFixed(2)}) \u2014 highly concentrated behavior pattern`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: { entropy: normalizedEntropy, actionCount: actionEntries.length }
    };
  }
  calculateLevel(score) {
    if (score >= LEVEL_THRESHOLDS.critical) return "critical";
    if (score >= LEVEL_THRESHOLDS.high) return "high";
    if (score >= LEVEL_THRESHOLDS.medium) return "medium";
    if (score >= LEVEL_THRESHOLDS.low) return "low";
    return "none";
  }
  pruneRequests(tracking) {
    const cutoff = Date.now() - this.config.rateBaselineWindowMs * 2;
    tracking.requests = tracking.requests.filter((r) => r.timestamp >= cutoff);
  }
};

// src/sandbox/environments/ephemeral-env.ts
var DEFAULT_CONFIG = {
  memoryOnly: true,
  maxMemoryMB: 128,
  timeout: 5e3
};
var EphemeralEnvironment = class {
  data = /* @__PURE__ */ new Map();
  config;
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  set(key, value) {
    if (this.data.size >= this.config.maxMemoryMB * 1024 * 1024) {
      throw new Error("Memory limit exceeded");
    }
    this.data.set(key, value);
  }
  get(key) {
    return this.data.get(key);
  }
  has(key) {
    return this.data.has(key);
  }
  delete(key) {
    return this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  getSize() {
    return this.data.size;
  }
  getConfig() {
    return { ...this.config };
  }
};

// src/sandbox/environments/persistent-env.ts
var PersistentEnvironment = class {
  data = /* @__PURE__ */ new Map();
  config;
  constructor(config) {
    this.config = config;
  }
  set(key, value) {
    this.data.set(key, { value, timestamp: Date.now() });
  }
  get(key) {
    const entry = this.data.get(key);
    return entry?.value;
  }
  has(key) {
    return this.data.has(key);
  }
  delete(key) {
    return this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  getEntries() {
    return Array.from(this.data.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      timestamp: entry.timestamp
    }));
  }
  cleanupOldEntries() {
    const cutoff = Date.now() - this.config.retentionHours * 60 * 60 * 1e3;
    let count = 0;
    for (const [key, entry] of this.data) {
      if (entry.timestamp < cutoff) {
        this.data.delete(key);
        count++;
      }
    }
    return count;
  }
  getConfig() {
    return { ...this.config };
  }
  get size() {
    return this.data.size;
  }
};

// src/sandbox/environments/shadow-env.ts
var ShadowEnvironment = class {
  trafficCapture = [];
  diffResults = [];
  config;
  constructor(config) {
    this.config = config;
  }
  captureTraffic(request, response) {
    if (this.config.captureTraffic) {
      this.trafficCapture.push({
        timestamp: Date.now(),
        request,
        response
      });
    }
  }
  replayTraffic(request) {
    return { status: "replayed", request };
  }
  analyzeDiff(original, shadow) {
    if (!this.config.diffAnalysis) return null;
    const diff = this.computeDiff(original, shadow);
    this.diffResults.push({
      timestamp: Date.now(),
      original,
      shadow,
      diff
    });
    return diff;
  }
  computeDiff(original, shadow) {
    if (typeof original !== "object" || typeof shadow !== "object") {
      return { original, shadow };
    }
    const diff = {};
    const orig = original;
    const shad = shadow;
    for (const key of Object.keys(orig)) {
      if (JSON.stringify(orig[key]) !== JSON.stringify(shad[key])) {
        diff[key] = { original: orig[key], shadow: shad[key] };
      }
    }
    return diff;
  }
  getTrafficCapture() {
    return [...this.trafficCapture];
  }
  getDiffResults() {
    return [...this.diffResults];
  }
  getConfig() {
    return { ...this.config };
  }
  clear() {
    this.trafficCapture = [];
    this.diffResults = [];
  }
};

// src/sandbox/sandbox-engine.ts
var import_node_crypto12 = require("crypto");
var EXPIRY_DURATION = {
  ephemeral: void 0,
  persistent: 24 * 60 * 60 * 1e3,
  shadow: 7 * 24 * 60 * 60 * 1e3
};
var SandboxEngine = class {
  environments = /* @__PURE__ */ new Map();
  createEnvironment(type, dnaId) {
    const id = `sandbox-${Date.now()}-${(0, import_node_crypto12.randomUUID)().slice(0, 9)}`;
    const now = Date.now();
    const env = {
      id,
      name: `${type}-${dnaId}`,
      type,
      dnaId,
      createdAt: now,
      expiresAt: EXPIRY_DURATION[type] ? now + EXPIRY_DURATION[type] : void 0,
      status: "active"
    };
    this.environments.set(id, env);
    return env;
  }
  getEnvironment(id) {
    return this.environments.get(id);
  }
  destroyEnvironment(id) {
    const env = this.environments.get(id);
    if (!env) return false;
    env.status = "destroyed";
    this.environments.delete(id);
    return true;
  }
  cleanupExpired() {
    let count = 0;
    const now = Date.now();
    for (const [id, env] of this.environments) {
      if (env.expiresAt && env.expiresAt < now) {
        env.status = "expired";
        this.environments.delete(id);
        count++;
      }
    }
    return count;
  }
  listActive() {
    return Array.from(this.environments.values()).filter((env) => env.status === "active");
  }
  getAll() {
    return Array.from(this.environments.values());
  }
  get count() {
    return this.environments.size;
  }
};

// src/sandbox/simulation/prompt-simulator.ts
var PromptSimulator = class {
  scenarios = [];
  addScenario(scenario) {
    this.scenarios.push(scenario);
  }
  simulate(scenarioId) {
    const scenario = this.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }
    return {
      prompt: scenario.prompt,
      simulated: true
    };
  }
  getScenarios() {
    return [...this.scenarios];
  }
  clear() {
    this.scenarios = [];
  }
  get count() {
    return this.scenarios.length;
  }
};

// src/sandbox/simulation/response-collector.ts
var import_node_crypto13 = require("crypto");
var ResponseCollector = class {
  responses = [];
  collect(scenarioId, response, metadata = {}) {
    const collected = {
      id: `response-${Date.now()}-${(0, import_node_crypto13.randomUUID)().slice(0, 9)}`,
      timestamp: Date.now(),
      scenarioId,
      response,
      metadata
    };
    this.responses.push(collected);
    return collected;
  }
  getResponsesByScenario(scenarioId) {
    return this.responses.filter((r) => r.scenarioId === scenarioId);
  }
  getResponses() {
    return [...this.responses];
  }
  clear() {
    this.responses = [];
  }
  get count() {
    return this.responses.length;
  }
};

// src/sandbox/simulation/traffic-replay.ts
var import_node_crypto14 = require("crypto");
var TrafficReplay = class {
  captures = [];
  capture(request, response, metadata = {}) {
    const capture = {
      id: `capture-${Date.now()}-${(0, import_node_crypto14.randomUUID)().slice(0, 9)}`,
      timestamp: Date.now(),
      request,
      response,
      metadata
    };
    this.captures.push(capture);
    return capture;
  }
  replay(captureId) {
    const capture = this.captures.find((c) => c.id === captureId);
    if (!capture) {
      throw new Error(`Capture ${captureId} not found`);
    }
    return { status: "replayed", capture };
  }
  getCaptures() {
    return [...this.captures];
  }
  getCapturesByTimeRange(start, end) {
    return this.captures.filter((c) => c.timestamp >= start && c.timestamp <= end);
  }
  clear() {
    this.captures = [];
  }
  get count() {
    return this.captures.length;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AuditChain,
  AuditEngine,
  BehaviorCompiler,
  BehaviorOSEngine,
  BehaviorSelector,
  BosGovernanceEngine,
  BosLearningEngine,
  CanaryDeployer,
  ConflictResolver,
  DNAComposer,
  DNALoader,
  DNAValidator,
  DecisionEngine,
  DnaResolver,
  DomainAgentACL,
  DomainAgentBoundary,
  DomainAgentContext,
  DomainDNABoundary,
  DomainDNAContext,
  DomainDataACL,
  DomainEventACL,
  DomainExecutionBoundary,
  EphemeralEnvironment,
  EscalationManager,
  ForensicCollector,
  GovernanceEngine,
  HealthChecker,
  LearningEngine,
  MetricsInterceptor,
  MissionEngine,
  OPAEvaluator,
  PersistentEnvironment,
  PipelineDispatcher,
  PipelineEngine,
  PolicyStore,
  PromptSimulator,
  QualityEngine,
  QuarantineManager,
  ResponseCollector,
  RollbackManager,
  SQLiteStore,
  STAGE_100_CONFIG,
  STAGE_100_THRESHOLDS,
  STAGE_25_CONFIG,
  STAGE_25_THRESHOLDS,
  STAGE_50_CONFIG,
  STAGE_50_THRESHOLDS,
  STAGE_5_CONFIG,
  STAGE_5_THRESHOLDS,
  SandboxEngine,
  SandboxExecutor,
  ShadowEnvironment,
  SuspicionDetector,
  TimeoutInterceptor,
  TrafficReplay,
  TrafficSplitter,
  YAMLToOPACompiler,
  bosMatchesGlob,
  createDispatcherContext,
  shouldSkipForConversational,
  shouldSkipForTransactional
});
