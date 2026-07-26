# BehaviorOS Platform Specification

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase 0  
> **Last Updated:** July 2026  
> **Source of Truth:** `packages/core/src/pipeline/`  
> **Architecture Level:** Levels 2–4 — Cognitive Platforms, Enterprise Services, Ecosystem

---

## Overview

The Platform Specification defines the pipeline dispatcher, layer contracts, and execution infrastructure for BehaviorOS. It spans **Levels 2–4** of the 4-level architecture:

```
Level 1: Kernel              ← Foundation (Event Sourcing, CQRS, Contracts, Lifecycle, Event Mesh)
Level 2: Cognitive Platforms ← Intelligence, Cognitive, Knowledge, AI, Governance, Security, Metadata
Level 3: Enterprise Services ← Runtime, Execution, Integration, Infrastructure
Level 4: Ecosystem           ← SDKs, CLI, MCP Server, Web Dashboard, Community Packages
```

The Pipeline Dispatcher is the central execution engine of BehaviorOS. It orchestrates a 9-layer validation chain using the Chain of Responsibility pattern. Each layer is a handler in the chain, and interceptors wrap the pipeline for cross-cutting concerns.

This document aligns with the [Package Architecture](./PACKAGE_ARCHITECTURE.md) (12-package structure) and [Dependency Matrix](./DEPENDENCY_MATRIX.md) (DAG dependency rules). All platform packages depend on Kernel but not on each other, enforcing domain isolation.

---

## Core Types

### PipelineDispatcherLayer

Every layer must implement this interface:

```typescript
interface PipelineDispatcherLayer {
  id: string
  name: string
  execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult>
  shouldExecute?(context: PipelineDispatcherContext): boolean
}
```

### PipelineDispatcherContext

The context object flowing through all layers:

```typescript
interface PipelineDispatcherContext {
  readonly id: string                    // Unique execution ID
  readonly dnaId: string                 // DNA package ID
  readonly dnaMode: 'conversational' | 'transactional' | 'hybrid'
  readonly agentId: string               // Executing agent ID
  readonly agentAuthority: string        // Agent authority level
  readonly action: string                // Action being executed
  readonly payload: Record<string, unknown>  // Action payload
  readonly metadata: Map<string, unknown>    // Shared metadata
  readonly startTime: number             // Execution start timestamp
  readonly verifiedAuthority?: string    // Cryptographically verified authority
  layerResults: DispatcherLayerResult[]  // Accumulated results
  currentLayerIndex: number              // Current position in chain
  failed: boolean                        // Failure flag (halts structural layers)
  error?: Error                          // Error if failed
}
```

### DispatcherLayerResult

Each layer returns this result:

```typescript
interface DispatcherLayerResult {
  layerId: string        // Layer identifier
  layerName: string      // Human-readable name
  passed: boolean        // Whether the layer passed
  score: number          // Quality score (0-100)
  duration: number       // Execution time in ms
  details: Record<string, unknown>  // Layer-specific details
  error?: string         // Error message if failed
}
```

### PipelineDispatcherInterceptor

Interceptors wrap the entire pipeline:

```typescript
interface PipelineDispatcherInterceptor {
  intercept(
    context: PipelineDispatcherContext,
    next: () => Promise<DispatcherLayerResult>,
  ): Promise<DispatcherLayerResult>
}
```

---

## Layer Execution Order

```
Request
  │
  ▼
Layer 1: DNA Loader           (structural — fail-fast)
Layer 2: Schema Validator     (structural — fail-fast)
Layer 3: Behavioral           (structural — fail-fast)
Layer 4: Domain Invariants    (structural — fail-fast)
Layer 5: Governance           (evaluative — continues on failure)
Layer 6: Decision             (evaluative — continues on failure)
Layer 7: Quality              (non-blocking — never halts)
Layer 8: Audit Trail          (non-blocking — never halts)
Layer 9: Learning             (non-blocking — never halts)
  │
  ▼
Response + Audit Trail
```

### Failure Behavior

| Layer Range | Behavior | Description |
|-------------|----------|-------------|
| 1–4 (Structural) | **Fail-fast** | If one fails, subsequent structural layers are skipped |
| 5–6 (Evaluative) | **Continue** | Failures are recorded but don't halt the pipeline |
| 7–9 (Non-blocking) | **Never halt** | Always execute, even if earlier layers failed |

---

## Layer Contracts

### Layer 1: DNA Loader (`dna-loader.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `dna` |
| **name** | `DNA Loader` |
| **order** | 1 |
| **Type** | Structural (fail-fast) |

**Purpose:** Validates DNA package exists, is well-formed, and loads metadata.

**Input:** `context.dnaId`  
**Output:** DNA package metadata in `details`  
**Failure:** Pipeline halts — no downstream layers execute

**Validation:**
- DNA package exists and is loaded
- Required fields: `id`, `name`, `version`
- DNA is well-formed (structural integrity)

### Layer 2: Schema Validator (`schema-validator.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `schema` |
| **name** | `Schema Validator` |
| **order** | 2 |
| **Type** | Structural (fail-fast) |

**Purpose:** Validates all types against Zod schemas.

**Input:** `context.payload`  
**Output:** Validation result in `details`  
**Failure:** Pipeline halts — type safety compromised

### Layer 3: Behavioral (`behavioral.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `behavioral` |
| **name** | `Behavioral` |
| **order** | 3 |
| **Type** | Structural (fail-fast) |

**Purpose:** DNA composition and validation. Ensures behavioral patterns are correct.

**Input:** DNA package from Layer 1  
**Output:** Composed behavioral configuration  
**Failure:** Pipeline halts — behavioral configuration invalid

### Layer 4: Domain Invariants (`domain-invariants.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `domain` |
| **name** | `Domain Invariants` |
| **order** | 4 |
| **Type** | Structural (fail-fast) |

**Purpose:** Enforces ACL boundaries, cross-DNA guards, and permission matrix.

**Input:** `context.agentId`, `context.action`  
**Output:** Boundary check result  
**Failure:** Pipeline halts — domain isolation violated

### Layer 5: Governance (`governance.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `governance` |
| **name** | `Governance` |
| **order** | 5 |
| **Type** | Evaluative (continues on failure) |

**Purpose:** Evaluates governance rules: block, escalate, warn, log.

**Input:** `context.action`, `context.agentAuthority`  
**Output:** Governance decision in `details`  
**Failure:** Recorded but doesn't halt pipeline

**Governance Levels:** `critical`, `high`, `medium`, `low`  
**Actions:** `block`, `escalate`, `warn`, `log`

**Bypass Detection:** Tracks bypass attempts per agent. Logs security warning if >3 attempts.

### Layer 6: Decision (`decision.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `decision` |
| **name** | `Decision` |
| **order** | 6 |
| **Type** | Evaluative (continues on failure) |

**Purpose:** Voting-based decisions with approval thresholds.

**Input:** Decision context from previous layers  
**Output:** Approved/rejected with vote breakdown  
**Failure:** Recorded but doesn't halt pipeline

### Layer 7: Quality (`quality.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `quality` |
| **name** | `Quality` |
| **order** | 7 |
| **Type** | Non-blocking (never halts) |

**Purpose:** Enforces quality gates before actions can proceed.

**Gate Types:** `test_coverage`, `lint`, `typecheck`, `security`, `performance`  
**Output:** Pass/fail with failed gate details  
**Failure:** Recorded — never blocks pipeline

### Layer 8: Audit Trail (`audit-trail.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `audit` |
| **name** | `Audit Trail` |
| **order** | 8 |
| **Type** | Non-blocking (never halts) |

**Purpose:** Records all pipeline execution events for compliance.

**Input:** All previous layer results  
**Output:** Audit event recorded  
**Failure:** Logged — never blocks pipeline

### Layer 9: Learning (`learning.layer.ts`)

| Field | Value |
|-------|-------|
| **id** | `learning` |
| **name** | `Learning` |
| **order** | 9 |
| **Type** | Non-blocking (never halts) |

**Purpose:** Records learning events and detects patterns.

**Input:** All previous layer results  
**Output:** Learning event recorded  
**Failure:** Logged — never blocks pipeline

---

## Special Layers

### DelegationEnforcementLayer

| Field | Value |
|-------|-------|
| **id** | `delegation-enforcement` |
| **Purpose** | Enforces 7-step protocol compliance |

Blocks action tools if protocol steps are skipped. Tracks:
- `step1Completed` (DNA selected)
- `step3Completed` (Truth resolved)
- `step4Completed` (Mission created)
- `step6Completed` (Audit passed)

### CoverageGateLayer

| Field | Value |
|-------|-------|
| **id** | `coverage-gate` |
| **Purpose** | Enforces ≥90% context coverage |

Uses `CoverageEngine` to validate context coverage before execution.

---

## Interceptors

### TimeoutInterceptor

| Field | Value |
|-------|-------|
| **Purpose** | Prevent stuck pipelines |
| **Default** | 30,000ms |
| **Behavior** | Aborts pipeline execution after timeout |

### MetricsInterceptor

| Field | Value |
|-------|-------|
| **Purpose** | Collect pipeline telemetry |
| **Metrics** | Duration, layer timings, error rates, success/failure counts |

---

## Mode Adapters

### Conversational Mode

```typescript
shouldSkipForConversational(layerId: string): boolean
```

- Skips non-essential layers when agent is in read-only/exploratory state
- Faster feedback, partial evaluation, lazy layer execution
- Layers 7-9 may be skipped for speed

### Transactional Mode

```typescript
shouldSkipForTransactional(_layerId: string): boolean  // always returns false
```

- Full pipeline execution, strict validation
- All layers evaluated, no skipping
- Used for autonomous batch operations

---

## Pipeline Composition

```typescript
import { PipelineDispatcher } from '@behavioros/core'

const pipeline = new PipelineDispatcher()

// Add layers in order
pipeline.addLayer(new DNALoaderLayer({ dnaPackage }))
pipeline.addLayer(new SchemaValidatorLayer())
pipeline.addLayer(new BehavioralLayer())
pipeline.addLayer(new DomainInvariantsLayer())
pipeline.addLayer(new GovernanceLayer({ governanceEngine }))
pipeline.addLayer(new DecisionLayer())
pipeline.addLayer(new QualityLayer({ qualityEngine }))
pipeline.addLayer(new AuditTrailLayer())
pipeline.addLayer(new LearningLayer())

// Add interceptors (outermost first)
pipeline.addInterceptor(new TimeoutInterceptor(30_000))
pipeline.addInterceptor(new MetricsInterceptor(metricsClient))

// Execute
const result = await pipeline.execute(context)
```

---

## Error Handling

| Error Type | Layer Range | Behavior |
|------------|-------------|----------|
| Structural failure | 1–4 | Pipeline halts, error propagated |
| Evaluative failure | 5–6 | Recorded in layerResults, pipeline continues |
| Non-blocking failure | 7–9 | Logged, pipeline completes |
| Interceptor error | Any | Wraps the failing layer, may abort |
| Timeout | Any | Pipeline aborted, timeout error raised |

---

## Telemetry

The pipeline collects telemetry via:

- **Tracing** — Each layer execution is traced with duration and outcome
- **Metrics** — Aggregate metrics: total executions, success rate, avg duration
- **Audit** — All pipeline executions recorded for compliance

```typescript
interface PipelineMetrics {
  totalExecutions: number
  successRate: number
  avgDuration: number
  layerMetrics: Map<string, LayerMetrics>
}
```

---

## References

- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — 15 architectural principles governing platform design
- [PACKAGE_ARCHITECTURE.md](./PACKAGE_ARCHITECTURE.md) — 12-package structure with dependency rules
- [DEPENDENCY_MATRIX.md](./DEPENDENCY_MATRIX.md) — Detailed dependency DAG
- [KERNEL_SPEC.md](./KERNEL_SPEC.md) — Kernel Specification (Level 1)
