# BehaviorOS Architecture

## 9-Layer Architecture

BehaviorOS is built on a 9-layer architecture where each layer has a dedicated engine. Layers are evaluated bottom-up: DNA defines patterns, schemas validate types, and upper layers consume validated data.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mission Layer                                │
│  Mission lifecycle: create → start → execute → complete         │
├─────────────────────────────────────────────────────────────────┤
│                     Learning Layer                               │
│  Record events → detect patterns → auto-apply fixes             │
├─────────────────────────────────────────────────────────────────┤
│                     Quality Layer                                │
│  Quality gates: coverage, lint, typecheck, security             │
├─────────────────────────────────────────────────────────────────┤
│                     Audit Layer                                  │
│  Multi-stage pipeline: lint → typecheck → security →            │
│  coverage → performance                                          │
├─────────────────────────────────────────────────────────────────┤
│                     Decision Layer                               │
│  Voting-based decisions with approval thresholds                │
├─────────────────────────────────────────────────────────────────┤
│                    Governance Layer                               │
│  Rule evaluation: block, escalate, warn, log                    │
├─────────────────────────────────────────────────────────────────┤
│                   Domain-Invariants Layer                        │
│  ACL boundaries, cross-DNA guards, permission matrix            │
├─────────────────────────────────────────────────────────────────┤
│                   Behavioral Layer                               │
│  DNA loading, validation, composition                           │
├─────────────────────────────────────────────────────────────────┤
│                     Schema Layer                                 │
│  Zod v4.4.3 schemas for all types                               │
├─────────────────────────────────────────────────────────────────┤
│                    DNA Layer (YAML)                              │
│  Personas, governance rules, quality gates, patterns,           │
│  workflows                                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Pipeline Dispatcher

The `PipelineDispatcher` orchestrates the 9-layer pipeline using the Chain of Responsibility pattern. Each layer is a handler in the chain, and interceptors wrap the pipeline for cross-cutting concerns.

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

interface DispatcherLayerResult {
  layerId: string
  layerName: string
  passed: boolean
  score: number
  duration: number
  details: Record<string, unknown>
  error?: string
}

interface PipelineDispatcherContext {
  readonly id: string
  readonly dnaId: string
  readonly dnaMode: 'conversational' | 'transactional' | 'hybrid'
  readonly agentId: string
  readonly agentAuthority: string
  readonly action: string
  readonly payload: Record<string, unknown>
  readonly metadata: Map<string, unknown>
  readonly startTime: number
  layerResults: DispatcherLayerResult[]
  currentLayerIndex: number
  failed: boolean
  error?: Error
}
```

Layers execute sequentially. If a layer throws, the pipeline halts and the error propagates up. Layers 1-4 (structural layers) use fail-fast: if one fails, subsequent structural layers are skipped. Layers 7-9 never block the pipeline.

### Interceptors

Interceptors wrap the entire pipeline for cross-cutting concerns:

| Interceptor | Purpose | Behavior |
|-------------|---------|----------|
| **Timeout** | Prevent stuck pipelines | Aborts after configurable timeout (default: 30s) |
| **Metrics** | Collect pipeline telemetry | Records duration, layer timings, error rates |
| **Audit-Log** | External audit trail | Writes pipeline execution to persistent storage |

Interceptors are composable:

```typescript
const pipeline = composeInterceptors([
  new TimeoutInterceptor(30_000),
  new MetricsInterceptor(metricsClient),
  new AuditLogInterceptor(auditStore),
], dnaPipeline)
```

### Mode Adapters

The pipeline supports two execution modes via functions that determine whether a layer should be skipped:

| Mode | Use Case | Behavior |
|------|----------|----------|
| **Conversational** | Interactive agent sessions | Faster feedback, partial evaluation, lazy layer execution |
| **Transactional** | Autonomous batch operations | Full pipeline execution, strict validation, all layers evaluated |

```typescript
import { shouldSkipForConversational, shouldSkipForTransactional } from '@behavioros/core'

// Assign to layer.shouldExecute to control skipping
layer.shouldExecute = (ctx) => shouldSkipForConversational(ctx.id)
```

**Conversational mode** skips non-essential layers when the agent is in a read-only or exploratory state via `shouldSkipForConversational(layerId)`. **Transactional mode** always runs the full 9-layer pipeline via `shouldSkipForTransactional(_layerId)` which always returns `false`.

## 7 Engines

### 1. Behavioral Engine
- Loads DNA packages from YAML files
- Validates DNA structure against Zod schemas
- Composes multiple DNA packages into a single configuration
- Exports: `DNALoader`, `DNAValidator`, `DNAComposer`

### 2. Governance Engine
- Evaluates actions against governance rules defined in DNA
- Actions: `block` (prevent), `escalate` (require approval), `warn` (log warning), `log` (record only)
- Levels: `critical`, `high`, `medium`, `low`
- Conditions match against action types (e.g., `type:security`, `type:infrastructure`)

### 3. Decision Engine
- Voting-based decision system for multi-agent consensus
- Agents submit votes with weight and rationale
- Threshold-based approval with configurable quorum
- Returns: approved/rejected with breakdown of votes

### 4. Audit Engine
- Multi-stage audit pipeline (lint → typecheck → security → coverage → performance)
- Each stage produces a report with pass/fail and details
- History tracking for trend analysis
- Configurable stages and thresholds

### 5. Quality Engine
- Enforces quality gates before actions can proceed
- Gate types: `test_coverage`, `lint`, `typecheck`, `security`, `performance`
- Configurable thresholds per gate
- Returns pass/fail with failed gate details

### 6. Learning Engine
- Records learning events from agent actions
- Detects patterns across events (repeated failures, successful strategies)
- Auto-apply mode for known fixes
- Generates learning reports with recommendations

### 7. Mission Engine
- Manages mission lifecycle: `create → start → execute → complete/fail`
- Tracks mission metadata, progress, and outcomes
- Supports priority levels and type classification
- Provides mission history and statistics

## DNA System

DNA (Deoxyribonucleic Algorithm) packages define the behavioral configuration for AI agent teams. A DNA package contains:

### Personas
Define agent roles with:
- **role**: function (manager, engineer, specialist, analyst, support)
- **authority**: level (c-level, director, lead, architect, senior, junior)
- **boundaries**: constraints on what the agent can do
- **skills**: capabilities the agent possesses
- **tools**: resources the agent can access

### Governance Rules
Behavioral constraints that are evaluated before actions:
- **level**: critical / high / medium / low
- **action**: block / escalate / warn / log
- **conditions**: when this rule applies

### Quality Gates
Quality thresholds that must be met:
- **type**: test_coverage / lint / typecheck / security / performance
- **threshold**: minimum acceptable value
- **pass**: boolean for pass/fail gates

### Patterns
Reusable behavioral sequences:
- **type**: collaboration / decision / review / learning / communication / escalation / deployment / testing
- **triggers**: what initiates the pattern
- **actions**: ordered steps in the pattern
- **conditions**: when this pattern applies

### Workflows
Multi-step processes that chain patterns:
- **type**: action / gate / parallel / conditional
- **agent**: who executes
- **next**: subsequent workflow steps
- **timeout**: maximum execution time
- **retries**: retry count on failure

## Domain Isolation

BehaviorOS applies Domain-Driven Design (DDD) principles with Anti-Corruption Layers (ACL) to isolate DNA packages and prevent cross-contamination between agent teams.

### Boundaries

| Boundary | Purpose | Enforcement |
|----------|---------|-------------|
| **DNABoundary** | Isolate DNA packages from each other | Schema validation, namespace prefixes |
| **AgentBoundary** | Prevent agents from accessing unauthorized DNA | Permission matrix, role-based access |
| **ExecutionBoundary** | Contain sandbox execution environments | Process isolation, resource limits |

### Anti-Corruption Layers

ACLs sit between boundaries and translate requests to prevent leaking domain concepts:

| ACL | Source → Target | Translation |
|-----|-----------------|-------------|
| **AgentACL** | Agent actions → DNA governance | Validates agent authority before DNA evaluation |
| **DataACL** | Cross-DNA data flow → Schema | Transforms and validates data between DNA contexts |
| **EventACL** | Cross-DNA events → Learning | Filters and routes learning events by DNA scope |

```typescript
const acl = new AgentACL({
  sourceDNA: 'payments',
  targetDNA: 'shared-infra',
  rules: [
    { action: 'deploy', required: 'architect' },
    { action: 'read', required: 'senior' },
  ],
})
```

### Permission Matrix

Permissions are defined per DNA mode (conversational vs transactional):

| DNA Mode | Read | Write | Execute | Deploy | Governance |
|----------|------|-------|---------|--------|------------|
| **Conversational** | Yes | Limited | Limited | No | Warn only |
| **Transactional** | Yes | Yes | Yes | Yes | Full enforcement |

### Cross-DNA Guard

The `CrossDNAGuard` prevents unauthorized cross-DNA operations:

- **Static analysis** at DNA load time detects cross-DNA references
- **Runtime validation** blocks cross-DNA actions not in the permission matrix
- **Audit logging** records all cross-DNA attempts for compliance
- **Escalation** when agents attempt cross-DNA writes without approval

```
Agent Action → CrossDNAGuard → Permission Matrix → Allowed / Blocked
                                ↓
                           Audit Log (all attempts)
```

## Governance Model

The governance model follows a strict evaluation pipeline:

1. **Action Submitted** — An agent attempts an action
2. **Rule Matching** — Governance rules are checked against action conditions
3. **Evaluation** — Each matching rule produces an outcome
4. **Escalation** — Escalated actions require approval from higher authority
5. **Blocking** — Blocked actions are prevented entirely
6. **Logging** — All evaluations are recorded in the audit log

Authority hierarchy: `c-level > director > lead > architect > senior > junior`

## Quality Pipeline

```
Action → Quality Gates → Audit Stages → Decision → Execution
              │                │              │
              ▼                ▼              ▼
         Coverage          Lint           Vote
         Typecheck         Security       Approve
         Performance       Coverage       Reject
```

## Learning System

The learning system operates in three phases:

1. **Record** — Events are captured with context, outcome, and impact
2. **Detect** — Patterns are identified across recorded events
3. **Apply** — Known fixes are automatically applied (optional)

## Sandbox & Shadow Mode

### SandboxEngine

The `SandboxEngine` provides isolated execution environments for testing agent behaviors without affecting production systems.

| Mode | Duration | Persistence | Use Case |
|------|----------|-------------|----------|
| **Ephemeral** | Single execution | None | Quick validation, one-shot tests |
| **Persistent** | Session-based | File system | Extended development, debugging |
| **Shadow** | Indefinite | Configurable | Long-running experiments, A/B testing |

```typescript
const sandbox = new SandboxEngine({
  mode: 'ephemeral',
  limits: {
    memory: '512MB',
    cpu: '1 core',
    timeout: '30s',
  },
})

const result = await sandbox.execute(agentAction, {
  isolate: true,
  capture: 'all',
})
```

### Shadow Pipeline

The Shadow Pipeline runs parallel to the production pipeline, capturing and comparing results without affecting live traffic.

```
Production Pipeline ──→ Live Results
        │
        ▼
Shadow Pipeline ──→ Shadow Results ──→ Diff Engine ──→ Alert if divergence > threshold
```

**Key features:**
- **Traffic capture** — Mirrors production requests to shadow environment
- **Replay engine** — Replays captured traffic with different DNA configurations
- **Diff analysis** — Compares production vs shadow results for anomalies
- **Alert system** — Notifies when shadow results diverge beyond configurable threshold

```typescript
const shadow = new ShadowPipeline({
  captureRate: 0.1, // 10% of traffic
  diffThreshold: 0.05, // 5% divergence triggers alert
  alertChannels: ['slack', 'email'],
})

await shadow.start()
```

### Canary Deploy

BehaviorOS supports gradual rollout of DNA changes using canary deployments:

```
5% traffic → 25% traffic → 50% traffic → 100% traffic
    │            │            │            │
    ▼            ▼            ▼            ▼
 Monitor     Monitor     Monitor     Full Rollout
 24 hours    48 hours    72 hours
```

| Stage | Traffic | Duration | Rollback Trigger |
|-------|---------|----------|------------------|
| **Stage 1** | 5% | 24 hours | Error rate > 1% or latency > 2x baseline |
| **Stage 2** | 25% | 48 hours | Error rate > 0.5% or governance violations |
| **Stage 3** | 50% | 72 hours | Quality gate failures or user complaints |
| **Stage 4** | 100% | Permanent | Anomaly detection alerts |

```typescript
const canary = new CanaryDeployer({
  stages,
  globalDriftThreshold: 0.3,
})

await canary.startDeployment({
  stableVersion: '1.0.0',
  canaryVersion: '1.1.0',
  projectName: 'my-project',
})
```

## Resilience

BehaviorOS implements defense mechanisms to protect against runaway agents, excessive resource consumption, and cascading failures.

### Rate Limiter

The Rate Limiter controls agent action throughput using configurable algorithms:

| Algorithm | Use Case | Behavior |
|-----------|----------|----------|
| **Token Bucket** | Burst-friendly workloads | Allows short bursts, refills at steady rate |
| **Sliding Window** | Consistent rate limiting | Smooth distribution over time window |
| **Adaptive** | Dynamic workloads | Adjusts limits based on system load |

**Escalation Tiers:**

| Utilization | Action | Effect |
|-------------|--------|--------|
| 0-80% | Normal | Full throughput |
| 80-90% | Warning | Log warning, notify agent |
| 90-100% | Throttle | Reduce throughput by 50% |
| 100% | Block | Reject new actions, queue existing |

```typescript
const rateLimiter = new RateLimiter({
  algorithm: 'adaptive',
  limits: {
    default: { requests: 100, window: '1m' },
    critical: { requests: 50, window: '1m' },
  },
  escalation: {
    warning: 0.8,
    throttle: 0.9,
    block: 1.0,
  },
})
```

### Circuit Breaker

The Circuit Breaker prevents cascading failures by temporarily disabling failing agents:

```
Closed (normal) ──→ Open (failing) ──→ Half-Open (testing)
      ↑                                      │
      └──────────── Success ─────────────────┘
```

| State | Behavior | Duration |
|-------|----------|----------|
| **Closed** | Normal operation, counting failures | Until threshold reached |
| **Open** | All requests rejected, fast-fail | Configurable cooldown (default: 30s) |
| **Half-Open** | Limited requests to test recovery | Until success or failure threshold |

```typescript
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  cooldown: '30s',
  halfOpenRequests: 3,
  monitoring: true,
})
```

### Agent Isolation

When an agent exhibits suspicious behavior, BehaviorOS can isolate it using four specialized classes:

#### SuspicionDetector

Detects anomalous agent behavior through configurable thresholds and pattern analysis.

```typescript
const detector = new SuspicionDetector({
  suspicionThreshold: 3,
  autoQuarantine: true,
})

await detector.evaluate(agent, action)
```

#### QuarantineManager

Manages quarantined agents with automatic release and manual review workflows.

```typescript
const manager = new QuarantineManager({
  maxQuarantinedAgents: 10,
  autoReleaseAfterMs: 24 * 60 * 60 * 1000,
})
```

#### SandboxExecutor

Provides isolated execution environments for suspect agents under investigation.

```typescript
const executor = new SandboxExecutor({
  maxConcurrentSandboxes: 5,
  timeoutMs: 30 * 60 * 1000,
})
```

#### ForensicCollector

Collects and stores forensic evidence for agent investigations and compliance audits.

```typescript
const collector = new ForensicCollector({
  maxEntries: 1000,
  retentionDays: 90,
})
```

## MCP Integration

The MCP server bridges BehaviorOS with AI agents via the Model Context Protocol:

- **Tools**: 36 tools for direct agent interaction
- **Resources**: 5 resources for data access
- **Transport**: stdio (standard for local MCP servers)
- **Engine**: Shares the same `BehaviorOSEngine` as the SDK

## Package Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    @behavioros/schemas                           │
│  Zod v4.4.3 schemas for all types                               │
├─────────────────────────────────────────────────────────────────┤
│                    @behavioros/core                              │
│  7 engines + PipelineDispatcher + internal modules               │
│  Behavioral, Governance, Decision, Audit, Quality, Learning,    │
│  Mission + Sandbox, Shadow, Deploy, Resilience, Domain           │
├─────────────────────────────────────────────────────────────────┤
│                    @behavioros/sdk                               │
│  High-level TypeScript SDK (BehaviorOS class)                   │
├─────────────────────────────────────────────────────────────────┤
│                    @behavioros/cli                               │
│  CLI: init, compile, validate, status, version, diff,           │
│  simulate, deploy, drift-check                                  │
├─────────────────────────────────────────────────────────────────┤
│                    @behavioros/mcp-server                        │
│  MCP server (36 tools, 5 resources, stdio transport)            │
├─────────────────────────────────────────────────────────────────┤
│                    @behavioros/dnas                              │
│  Pre-built DNA pattern catalog (16 patterns)                    │
├─────────────────────────────────────────────────────────────────┤
│                    @behavioros/web                               │
│  Next.js 15 dashboard (apps/web)                                │
└─────────────────────────────────────────────────────────────────┘
```

### Internal Modules

The following modules are internal to `@behavioros/core` (not standalone packages):

| Module | Purpose |
|--------|---------|
| Sandbox | Isolated execution environments (ephemeral, persistent, shadow) |
| Shadow | Shadow pipeline with traffic capture, replay, and diff analysis |
| Deploy | Canary deployment with gradual rollout and rollback triggers |
| Resilience | Rate limiter, circuit breaker, and agent isolation |
| Domain | DDD boundaries, ACLs, permission matrix, cross-DNA guard |

### Engine Composition

The `BehaviorOSEngine` composes all engines into a unified runtime:

```typescript
const engine = new BehaviorOSEngine({
  dna: dnaPackage,
  governance: { level: 'strict' },
  quality: { minCoverage: 80 },
  sandbox: { mode: 'ephemeral' },
  shadow: { captureRate: 0.1 },
  resilience: {
    rateLimiter: { algorithm: 'adaptive' },
    circuitBreaker: { failureThreshold: 5 },
  },
  domain: {
    boundaries: ['payments', 'shared-infra'],
    acl: { strictMode: true },
  },
})
```

### Interceptor Stack

The pipeline uses composable interceptors for cross-cutting concerns:

```
Request
  │
  ▼
┌─────────────────┐
│ Timeout (30s)   │
├─────────────────┤
│ Metrics         │
├─────────────────┤
│ Audit-Log       │
├─────────────────┤
│ Rate Limiter    │
├─────────────────┤
│ Circuit Breaker │
└────────┬────────┘
         │
         ▼
  9-Layer Pipeline
         │
         ▼
  Response + Audit Trail
```
