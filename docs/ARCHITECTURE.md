# BehaviorOS Architecture

> **Status:** Current — reflects actual codebase as of July 2026
> **See also:** `docs/ARCHITECTURE_PRINCIPLES.md` for future 4-level architecture vision

## Overview

BehaviorOS is a behavioral governance framework for autonomous AI agent teams. It provides a modular architecture with 15+ engines and internal modules, DNA patterns (YAML), and an MCP server.

The system is built around a central facade (`BehaviorOSEngine`) that composes specialized engines into a unified runtime. A pipeline dispatcher orchestrates a 9-layer validation chain using the Chain of Responsibility pattern.

## Module Structure

```
@behavioros/core/src/
├── engines/                    # Core behavioral engines
│   ├── core-engine.ts          # BehaviorOSEngine (facade)
│   ├── skill-engine.ts         # Skill resolution & component registry
│   ├── coverage-engine.ts      # Context coverage calculation
│   ├── memory-engine.ts        # Persistent memory across sessions
│   ├── protocol-engine.ts      # 7-step delegation protocol tracking
│   ├── agent-manager.ts        # Agent lifecycle management
│   ├── mission-manager.ts      # Mission lifecycle management
│   ├── ecosystem-registry.ts   # External ecosystem component registry
│   ├── behavioral/             # DNA loading, validation, composition
│   ├── audit/                  # Multi-stage audit pipeline
│   ├── decision/               # Voting-based decisions
│   ├── governance/             # Rule evaluation engine
│   ├── learning/               # Pattern detection & auto-apply
│   ├── mission/                # Mission lifecycle engine
│   ├── quality/                # Quality gates + self-healing
│   ├── recovery/               # Context recovery engine
│   ├── orchestrator/           # Autonomous orchestration system
│   ├── pipeline/               # Pipeline engine (separate from dispatcher)
│   └── adapters/               # Ecosystem adapters (AITMPL, Open Design, UI-UX)
├── pipeline/                   # 9-layer pipeline dispatcher
│   ├── pipeline-dispatcher.ts  # Chain of Responsibility orchestrator
│   ├── pipeline-context.ts     # Pipeline execution context
│   ├── layers/                 # Layer implementations
│   ├── interceptors/           # Cross-cutting concerns (timeout, metrics, audit)
│   ├── mode/                   # Conversational vs transactional adapters
│   └── telemetry/              # Pipeline metrics collection
├── compiler/                   # DNA compilation system
│   ├── behavior-compiler.ts    # DNA → agents, MCP, workflows, docs
│   ├── yaml-to-opa.ts          # DNA → OPA Rego policies
│   ├── opa-evaluator.ts        # OPA policy evaluation
│   └── policy-store.ts         # Compiled policy storage
├── compliance/                 # Regulatory compliance frameworks
│   ├── soc2.ts                 # SOC 2 Trust Service Criteria (693 lines)
│   ├── pci-dss.ts              # PCI DSS requirements
│   ├── eu-ai-act.ts            # EU AI Act compliance
│   └── compliance-exporter.ts  # Audit-ready compliance reports
├── security/                   # Security infrastructure
│   ├── authority-verifier.ts   # Ed25519 cryptographic authority tokens
│   └── dna-sanitizer.ts        # DNA injection/intent detection
├── persistence/                # Storage layer
│   ├── sqlite-store.ts         # General-purpose SQLite storage
│   └── sqlite-audit-store.ts   # Tamper-proof audit trail with chain verification
├── resilience/                 # Defense mechanisms
│   ├── agent-isolation.ts      # SuspicionDetector, QuarantineManager,
│                               # SandboxExecutor, ForensicCollector
│   ├── rate-limiter.ts         # Token bucket, sliding window, adaptive
│   └── circuit-breaker.ts      # Cascading failure prevention
├── sandbox/                    # Isolated execution environments
│   ├── sandbox-engine.ts       # Ephemeral, persistent, shadow modes
│   ├── environments/           # EphemeralEnv, PersistentEnv, ShadowEnv
│   └── simulation/             # PromptSimulator, ResponseCollector, TrafficReplay
├── deploy/                     # Deployment infrastructure
│   ├── canary-deployer.ts      # Gradual rollout (5% → 25% → 50% → 100%)
│   ├── health-checker.ts       # Health probes and thresholds
│   ├── rollback-manager.ts     # Automatic rollback triggers
│   └── traffic-splitter.ts     # Traffic routing and sticky sessions
├── domain/                     # DDD boundaries & ACLs
├── shadow/                     # Shadow pipeline
├── shared/                     # Logger, utilities
├── schemas/                    # Internal schema helpers
├── types/                      # Shared TypeScript types
├── workflows/                  # (empty — planned for future)
└── metrics/                    # (empty — planned for future)
```

## Core Engines

### 1. BehaviorOSEngine (Facade)

The central orchestrator that composes all engines into a unified runtime. It delegates to specialized managers and sub-engines.

```typescript
const engine = new BehaviorOSEngine({
  dna: dnaPackage,
  governance: { level: 'strict' },
  quality: { minCoverage: 80 },
  learning: { autoApply: true },
})
```

Composes: GovernanceEngine, QualityEngine, LearningEngine, MissionEngine, AuditEngine, SkillEngine, EcosystemRegistry, AutonomousOrchestrator, SkillRouter, HandoffProtocol, LifecyclePipeline, AutonomousDecomposer.

### 2. Behavioral Engine (`behavioral/`)
- **DNALoader** — Loads DNA packages from YAML files
- **DNAValidator** — Validates DNA structure against Zod schemas
- **DNAComposer** — Composes multiple DNA packages into a single configuration
- **DnaResolver** — Resolves DNA references and inheritance
- **BehaviorSelector** — Selects optimal DNA pattern for a task
- **ConflictResolver** — Resolves conflicting agent outputs
- **EscalationManager** — Manages escalation triggers and workflows
- **BosGovernanceEngine** — Behavioral governance evaluation
- **BosLearningEngine** — Behavioral learning and pattern detection
- **AuditChain** — Delegation audit chain

### 3. Governance Engine (`governance/`)
- Evaluates actions against governance rules defined in DNA
- Actions: `block` (prevent), `escalate` (require approval), `warn` (log warning), `log` (record only)
- Levels: `critical`, `high`, `medium`, `low`
- Authority hierarchy: `c-level > director > lead > architect > senior > junior`

### 4. Decision Engine (`decision/`)
- Voting-based decision system for multi-agent consensus
- Agents submit votes with weight and rationale
- Threshold-based approval with configurable quorum
- Returns: approved/rejected with breakdown of votes

### 5. Audit Engine (`audit/`)
- Multi-stage audit pipeline (lint → typecheck → security → coverage → performance)
- Each stage produces a report with pass/fail and details
- History tracking for trend analysis
- Configurable stages and thresholds

### 6. Quality Engine (`quality/`)
- Enforces quality gates before actions can proceed
- Gate types: `test_coverage`, `lint`, `typecheck`, `security`, `performance`
- Configurable thresholds per gate
- **SelfHealingEngine** — Auto-remediates quality gate failures

### 7. Learning Engine (`learning/`)
- Records learning events from agent actions
- Detects patterns across events (repeated failures, successful strategies)
- Auto-apply mode for known fixes
- Generates learning reports with recommendations

### 8. Mission Engine (`mission/`)
- Manages mission lifecycle: `create → start → execute → complete/fail`
- Tracks mission metadata, progress, and outcomes
- Supports priority levels and type classification
- Provides mission history and statistics

### 9. Skill Engine (`skill-engine.ts`)
- Agent skill resolution with two-stage routing: DNA match (primary) → capability match (semantic fallback)
- Component registry management (skills, MCPs, design systems, DNAs)
- Delegation validation — verifies agent has required skills
- Ecosystem sync from local filesystem and DNA packages
- Ecosystem diagnostics (doctor report)

### 10. Coverage Engine (`coverage-engine.ts`)
- Calculates context coverage before task execution
- Checks expected files, configurations, and structural invariants
- Multi-dimensional coverage: files, configs, structures, patterns
- Configurable threshold (default: 90%)

### 11. Memory Engine (`memory-engine.ts`)
- Persistent memory across agent sessions
- File-based storage with TTL and categorization
- Memory search, listing, and cleanup
- Supports domain-scoped memory namespaces

### 12. Protocol Engine (`protocol-engine.ts`)
- Tracks the 7-step BehaviorOS delegation protocol
- State machine: step1_dnaSelected → step3_truthResolved → step4_missionCreated → step6_auditPassed
- Validates protocol compliance before action tools execute
- Order violation detection

### 13. Pipeline Engine (`pipeline/` — engine, not dispatcher)
- 10-layer pipeline: dna → schema → behavioral → domain-invariants → governance → decision → quality → audit → mission → learning
- Evidence validation before truth
- Gate checks per layer
- Telemetry and metrics collection

### 14. Orchestrator System (`orchestrator/`)
- **AutonomousOrchestrator** — Autonomous task decomposition and execution
- **AutonomousDecomposer** — Breaks complex intents into executable plans
- **SkillRouter** — Routes tasks to optimal agents based on skills
- **HandoffProtocol** — Agent-to-agent work handoff with context transfer
- **LifecyclePipeline** — Mission lifecycle orchestration
- **AutoDocumentationTrigger** — Auto-generates docs on completion

### 15. Ecosystem Registry (`ecosystem-registry.ts`)
- Registers external components: skills, MCPs, design systems
- Syncs from local filesystem (`.agents/skills/`, `.opencode/`, etc.)
- Component health diagnostics

## Compiler System (`compiler/`)

| Component | Purpose |
|-----------|---------|
| **BehaviorCompiler** | Compiles DNA YAML → agents, MCP tools, workflows, docs, CI/CD |
| **YAMLToOPACompiler** | Compiles DNA YAML → OPA Rego policy rules |
| **OPAEvaluator** | Evaluates OPA policies against agent actions |
| **PolicyStore** | Stores and retrieves compiled policies |

## Compliance Framework (`compliance/`)

| Framework | Standard | Controls |
|-----------|----------|----------|
| **SOC 2** | AICPA TSC 2017 | 5 trust criteria: security, availability, processing-integrity, confidentiality, privacy |
| **PCI DSS** | PCI DSS v4.0 | Payment card data protection |
| **EU AI Act** | EU Regulation 2016/679 | AI system risk classification and requirements |

Each framework provides: compliance checks, control mapping, gap analysis, audit-ready reports.

## Security Infrastructure (`security/`)

| Component | Purpose |
|-----------|---------|
| **AuthorityVerifier** | Ed25519 cryptographic authority tokens — replaces self-declared authority |
| **DNAsanitizer** | Detects injection attacks and malicious intent in DNA packages |

## Persistence Layer (`persistence/`)

| Component | Purpose |
|-----------|---------|
| **SQLiteStore** | General-purpose SQLite storage for engine state |
| **SQLiteAuditStore** | Tamper-proof audit trail with chain verification (hash chaining) |

## Resilience Mechanisms (`resilience/`)

### Rate Limiter
| Algorithm | Use Case | Behavior |
|-----------|----------|----------|
| **Token Bucket** | Burst-friendly workloads | Allows short bursts, refills at steady rate |
| **Sliding Window** | Consistent rate limiting | Smooth distribution over time window |
| **Adaptive** | Dynamic workloads | Adjusts limits based on system load |

### Circuit Breaker
| State | Behavior | Duration |
|-------|----------|----------|
| **Closed** | Normal operation, counting failures | Until threshold reached |
| **Open** | All requests rejected, fast-fail | Configurable cooldown (default: 30s) |
| **Half-Open** | Limited requests to test recovery | Until success or failure threshold |

### Agent Isolation
- **SuspicionDetector** — Detects anomalous agent behavior
- **QuarantineManager** — Manages quarantined agents with auto-release
- **SandboxExecutor** — Isolated execution for suspect agents
- **ForensicCollector** — Collects forensic evidence for investigations

## Sandbox & Simulation (`sandbox/`)

| Mode | Duration | Persistence | Use Case |
|------|----------|-------------|----------|
| **Ephemeral** | Single execution | None | Quick validation, one-shot tests |
| **Persistent** | Session-based | File system | Extended development, debugging |
| **Shadow** | Indefinite | Configurable | Long-running experiments, A/B testing |

Simulation tools: PromptSimulator, ResponseCollector, TrafficReplay.

## Deployment (`deploy/`)

| Component | Purpose |
|-----------|---------|
| **CanaryDeployer** | Gradual rollout: 5% → 25% → 50% → 100% with rollback triggers |
| **HealthChecker** | Health probes with configurable thresholds |
| **RollbackManager** | Automatic rollback on error rate, latency, or governance violations |
| **TrafficSplitter** | Traffic routing with sticky sessions and split strategies |

## Pipeline Dispatcher

The `PipelineDispatcher` orchestrates the 9-layer pipeline using the Chain of Responsibility pattern.

```
Request → [Interceptors] → dna-loader → schema-validator → behavioral
        → domain-invariants → governance → decision → quality
        → audit-trail → learning → Response
```

### Chain of Responsibility

Each layer implements a `PipelineDispatcherLayer` interface:

```typescript
interface PipelineDispatcherLayer {
  id: string
  name: string
  execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult>
  shouldExecute?(context: PipelineDispatcherContext): boolean
}
```

Layers execute sequentially. If a layer throws, the pipeline halts. Layers 1-4 (structural) use fail-fast. Layers 7-9 never block.

### Interceptors

| Interceptor | Purpose | Behavior |
|-------------|---------|----------|
| **Timeout** | Prevent stuck pipelines | Aborts after configurable timeout (default: 30s) |
| **Metrics** | Collect pipeline telemetry | Records duration, layer timings, error rates |
| **Audit-Log** | External audit trail | Writes pipeline execution to persistent storage |

### Mode Adapters

| Mode | Use Case | Behavior |
|------|----------|----------|
| **Conversational** | Interactive agent sessions | Faster feedback, partial evaluation, lazy layer execution |
| **Transactional** | Autonomous batch operations | Full pipeline execution, strict validation, all layers evaluated |

## DNA System

DNA (Deoxyribonucleic Algorithm) packages define the behavioral configuration for AI agent teams:

- **Personas** — Agent roles with authority levels, boundaries, skills, tools
- **Governance Rules** — Behavioral constraints (block/escalate/warn/log)
- **Quality Gates** — Quality thresholds (test_coverage, lint, typecheck, security, performance)
- **Patterns** — Reusable behavioral sequences (collaboration, decision, review, learning, etc.)
- **Workflows** — Multi-step processes that chain patterns

## Domain Isolation

DDD principles with Anti-Corruption Layers (ACL) to isolate DNA packages:

| Boundary | Purpose | Enforcement |
|----------|---------|-------------|
| **DNABoundary** | Isolate DNA packages | Schema validation, namespace prefixes |
| **AgentBoundary** | Prevent unauthorized DNA access | Permission matrix, role-based access |
| **ExecutionBoundary** | Contain sandbox execution | Process isolation, resource limits |

ACLs: AgentACL, DataACL, EventACL — translate requests between domains.

## Package Architecture

```
@behavioros/schemas     — Zod v4.4.3 schemas for all types
@behavioros/core        — 15+ engines, pipeline dispatcher, compiler, compliance, security
@behavioros/sdk         — High-level TypeScript SDK (BehaviorOS class)
@behavioros/cli         — CLI: init, compile, validate, status, version, diff, simulate, deploy
@behavioros/mcp-server  — MCP server (36 tools, 5 resources, stdio transport)
@behavioros/dnas        — Pre-built DNA YAML pattern catalog (16 patterns)
@behavioros/web         — Next.js 15 dashboard (apps/web)
@behavioros/e2e-tests   — End-to-end test suite
```

## Test Coverage

- Unit tests: `packages/core/src/__tests__/` and per-module `__tests__/` directories
- E2E tests: `packages/e2e-tests/src/kernel/kernel-absoluto.spec.ts`
- All tests use Vitest with globals, node environment, V8 coverage
- Coverage threshold: ≥ 90% (Kernel Absoluto Rule 3)
