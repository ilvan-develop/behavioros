# BehaviorOS Kernel Specification

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase 0  
> **Last Updated:** July 2026  
> **Authority:** BehaviorOS Kernel Absoluto  
> **Architecture Level:** Level 1 — Kernel (Foundation)

---

## Overview

This document is the **canonical constitution** for BehaviorOS. All implementations MUST conform to this spec. It defines the absolute rules, invariants, lifecycle models, and governance that govern all agent behavior.

### Architecture Position

The Kernel is **Level 1** of the 4-level architecture. It is the foundation upon which all other levels are built:

```
Level 1: Kernel          ← YOU ARE HERE — Event Sourcing, CQRS, Contracts, Lifecycle, Event Mesh
Level 2: Cognitive Platforms — Intelligence, Cognitive, Knowledge, AI, Governance, Security, Metadata
Level 3: Enterprise Services — Runtime, Execution, Integration, Infrastructure
Level 4: Ecosystem       — SDKs, CLI, MCP Server, Web Dashboard, Community Packages
```

The Kernel provides the **Event Sourcing engine** (append-only event store, replay, projections), **CQRS infrastructure** (command/query buses with segregated read/write models), **Contract definitions** (all capability, engine, and storage interfaces), **Event Mesh** (5 specialized buses), and **Lifecycle management** (engine, kernel, component, and capability lifecycles).

### ADR References

This specification is informed by the following Architecture Decision Records:
- **ADR-001**: Event Sourcing as Source of Truth — [docs/adr/001-event-sourcing.md](./adr/001-event-sourcing.md)
- **ADR-002**: CQRS — Command Query Responsibility Segregation — [docs/adr/002-cqrs.md](./adr/002-cqrs.md)
- **ADR-003**: Event Mesh Architecture — [docs/adr/003-event-mesh.md](./adr/003-event-mesh.md)

---

## 1. Kernel Absoluto — 10 Rules

These rules are **non-negotiable**. Violation blocks task execution.

| # | Rule | Statement | Enforcement |
|---|------|-----------|-------------|
| 1 | **Zero Assumption** | Never assume context; always verify | CRITICAL |
| 2 | **Full Context Discovery** | Discover ALL context before execution | CRITICAL |
| 3 | **Coverage Validation** | Coverage must be ≥ 90% | CRITICAL |
| 4 | **Truth Before Execution** | Resolve truth sources before delegating | CRITICAL |
| 5 | **Domain Isolation** | Respect domain boundaries | HIGH |
| 6 | **State Synchronization** | Keep state synchronized across sessions | HIGH |
| 7 | **Self Audit** | Audit every action | CRITICAL |
| 8 | **No Hallucination** | Never fabricate information | CRITICAL |
| 9 | **Context Recovery** | Auto-recover from context loss | HIGH |
| 10 | **Definition of Truth** | Define what constitutes truth | MEDIUM |

### Enforcement

- **MCP Server**: `DelegationEnforcementLayer` blocks tools if protocol violated
- **OpenCode Plugin**: `tool.execute.before` hook intercepts non-delegation tools
- **Runtime**: Agent instructions (AGENTS.md, CLAUDE.md) mandate compliance

---

## 2. Invariants (I0–I23)

Invariants are hard constraints. Violation = system-level failure.

### Foundational Invariants

| ID | Invariant | Description |
|----|-----------|-------------|
| I0 | **Skills before execution** | Agent must have required skills before executing a task |
| I1 | **Truth before execution** | Truth confidence ≥ threshold before acting |
| I2 | **Evidence before truth** | No truth claim without supporting evidence |
| I3 | **State consistency** | State transitions are atomic and consistent |
| I4 | **Domain isolation** | Domains cannot cross-contaminate |
| I5 | **Audit every action** | Every action produces an audit event |
| I6 | **No silent failures** | All failures are logged and reported |
| I7 | **Recoverable state** | System can recover from any single failure |
| I8 | **Idempotent operations** | Retrying an operation produces the same result |
| I9 | **Bounded resource use** | All resource consumption is bounded |
| I10 | **Authority verification** | Authority must be cryptographically verified |
| I11 | **DNA validation** | DNA packages must validate before use |
| I12 | **Protocol compliance** | 7-step protocol must be followed |
| I13 | **Governance evaluation** | Governance rules evaluated before actions |
| I14 | **Quality gates pass** | All quality gates must pass before completion |
| I15 | **Checkpoint creation** | Checkpoints created before phase transitions |
| I16 | **Coverage ≥ 90%** | Context coverage must meet threshold |
| I17 | **No hallucination** | Fabricated information blocks execution |
| I18 | **State synchronization** | State persisted across sessions |
| I19 | **Conflict resolution** | Agent conflicts resolved before proceeding |
| I20 | **Escalation compliance** | Critical actions escalated to human |
| I21 | **Domain boundary respect** | Cross-domain actions require ACL approval |
| I22 | **Immutable events** | Audit events are append-only |
| I23 | **Version compatibility** | Breaking changes require major version bump |

---

## 3. Truth Confidence System

### Dimension-Specific Minimums

| Dimension | Minimum | Description |
|-----------|---------|-------------|
| architecture | ≥ 90% | Architectural decisions are well-founded |
| domain | ≥ 90% | Domain knowledge is accurate |
| dependencies | ≥ 85% | Dependency information is current |
| documentation | ≥ 85% | Documentation reflects reality |
| tests | ≥ 80% | Test coverage is adequate |
| governance | = 100% | Governance rules are fully enforced |
| historical | ≥ 85% | Historical data is reliable |

### Global Minimum

- **Truth Confidence ≥ 95%** required before any action
- Below threshold → block execution, escalate to human

### Evidence Graph

```
Understanding → Evidence → Truth Confidence
    ↑              ↑            ↑
    │              │            └── Confidence score
    │              └── Supporting data
    └── Context discovery
```

---

## 4. Engine Lifecycle

All engines follow a defined lifecycle:

```
created → registered → initialized → healthy → degraded → recovering → disposed
```

| State | Description |
|-------|-------------|
| **created** | Engine instance created, not yet registered |
| **registered** | Engine registered with the system |
| **initialized** | Engine initialized with configuration |
| **healthy** | Engine operating normally |
| **degraded** | Engine operating with reduced capability |
| **recovering** | Engine recovering from failure |
| **disposed** | Engine shut down and cleaned up |

---

## 5. Skill Lifecycle

Skills follow a defined lifecycle:

```
discovered → downloaded → verified → installed → registered → resolved → loaded → active → deprecated → removed
```

| State | Description |
|-------|-------------|
| **discovered** | Skill found in ecosystem |
| **downloaded** | Skill package downloaded |
| **verified** | Skill passes verification checks |
| **installed** | Skill installed locally |
| **registered** | Skill registered with the system |
| **resolved** | Skill dependencies resolved |
| **loaded** | Skill loaded into memory |
| **active** | Skill available for use |
| **deprecated** | Skill marked for removal |
| **removed** | Skill removed from system |

---

## 6. Storage Abstraction

The system supports multiple storage backends:

| Backend | Use Case | Characteristics |
|---------|----------|-----------------|
| **filesystem** | Local development | Simple, fast, single-node |
| **SQLite** | Production single-node | ACID, embedded, zero-config |
| **Postgres** | Production multi-node | Scalable, concurrent, full-featured |
| **Redis** | Caching, pub/sub | Fast, ephemeral, distributed |
| **S3** | Object storage | Durable, scalable, cheap |
| **memory** | Testing, ephemeral | Fastest, non-persistent |

### Snapshot Strategy

- Every 100 events
- Every mission completion
- Every execution completion

---

## 7. 7-Step Delegation Protocol

Every task MUST pass through all 7 steps. Sequence is immutable.

```
1. Select DNA → 2. Display Block → 3. Resolve Truth → 4. Create Mission → 5. Delegate → 6. Run Audit → 7. Record Learning
```

| # | Step | Tool | Enforcement |
|---|------|------|-------------|
| 1 | Select DNA | `bos_select_dna` | CRITICAL — MCP blocks all tools if skipped |
| 2 | Display DNA Block | Visual template | HIGH — Human visibility required |
| 3 | Resolve Truth | `bos_resolve_truth` | CRITICAL — Delegation blocked if skipped |
| 4 | Create Mission | `create-mission` | HIGH — No work without mission ID |
| 5 | Delegate | Task tool | CRITICAL — Direct execution blocked |
| 6 | Run Audit | `bos_run_audit` | CRITICAL — Mission cannot complete |
| 7 | Record Learning | `record-learning` | MEDIUM — Warning logged if skipped |

---

## 8. 10-Level Hierarchical Planning

```
Intent → Goal → Objective → Strategy → Program → Project → Mission → Workflow → Task → Action
```

| Level | Description | Example |
|-------|-------------|---------|
| Intent | High-level desire | "Improve system reliability" |
| Goal | Measurable target | "Reduce downtime to 99.9%" |
| Objective | Specific outcome | "Implement circuit breaker pattern" |
| Strategy | Approach to achieve | "Layered defense with fallbacks" |
| Program | Collection of projects | "Reliability improvement program" |
| Project | Scoped work unit | "Circuit breaker implementation" |
| Mission | Executable unit of work | "Implement circuit breaker for payment service" |
| Workflow | Step-by-step process | "Design → Implement → Test → Deploy" |
| Task | Atomic work item | "Write circuit breaker unit tests" |
| Action | Single operation | "Create test file with 10 test cases" |

---

## 9. AI Resource Manager

Automatic resource decisions for AI agents:

| Resource | Decision | Strategy |
|----------|----------|----------|
| **GPU** | Allocation | Task complexity, model requirements |
| **CPU** | Threading | Parallel execution, rate limiting |
| **Context** | Windowing | Sliding window, summarization |
| **Tokens** | Budgeting | Cost-aware allocation |
| **Latency** | SLO | Timeout, retry, circuit breaker |
| **Cache** | Hit rate | TTL, invalidation, warming |
| **Fallback** | Strategy | Model chain, graceful degradation |

---

## 10. Quality Gates

| Gate | Metric | Threshold | Action |
|------|--------|-----------|--------|
| Documentation | Coverage | 100% public API | Block |
| Unit Tests | Coverage | ≥ 90% | Block |
| Integration Tests | Pass rate | 100% | Block |
| Metrics | Collection | 100% engines | Block |
| Observability | Tracing | 100% critical paths | Block |
| Security Review | Vulnerabilities | 0 critical | Block |
| Performance Benchmark | P99 latency | < threshold | Warn |
| ADR | Documented | All major decisions | Block |
| Spec Updated | Sync | Code matches spec | Block |
| CHANGELOG Updated | Documented | All user-facing changes | Block |

---

## 11. Component Lifecycle

All components follow a 6-state lifecycle:

```
Draft → Experimental → Beta → Stable → Deprecated → Archived
```

| State | Quality Target | Test Coverage |
|-------|----------------|---------------|
| Draft | — | 0% |
| Experimental | — | 50% |
| Beta | 80% | 80% |
| Stable | 95% | 90% |
| Deprecated | — | — |
| Archived | — | — |

---

## 12. Capability Lifecycle

All capabilities follow a 6-state lifecycle:

```
Proposal → Prototype → Review → Registry → Marketplace → Production
```

---

## 13. Versioning

- **SemVer**: MAJOR.MINOR.PATCH
- Never break contracts
- Deprecate first (1 major version minimum)
- **Major**: Breaking changes
- **Minor**: New features (backward-compatible)
- **Patch**: Bug fixes (backward-compatible)

---

## 14. Event Mesh

```
Event Bus ←→ Command Bus ←→ Query Bus ←→ Notification Bus ←→ Stream Bus
```

- **Event Bus**: Domain events (async, pub/sub)
- **Command Bus**: Commands (sync, point-to-point)
- **Query Bus**: Queries (sync, request/response)
- **Notification Bus**: Notifications (async, broadcast)
- **Stream Bus**: Streaming data (async, continuous)

---

## 15. Knowledge Fabric

| Component | Purpose |
|-----------|---------|
| **Graph DB** | Entity relationships, dependency tracking |
| **Vector DB** | Semantic search, similarity matching |
| **Ontology** | Domain model, type hierarchy |
| **Memory** | Working memory, session state |
| **Evidence** | Evidence graph, confidence scoring |
| **Truth** | Truth sources, trust levels |
| **Semantic Layer** | Natural language understanding |

---

## 16. Execution Isolation Levels

| Level | Mechanism | Use Case |
|-------|-----------|----------|
| **Sandbox** | Process isolation | Quick validation, testing |
| **Container** | Docker/OCI | Production workloads |
| **VM** | Full virtualization | Maximum isolation |
| **Remote Worker** | Network boundary | Distributed execution |
| **Cloud Worker** | Cloud provider | Scalable execution |

All levels share the same interface — the system abstracts the execution environment.

---

## Appendix: Compliance

This kernel specification is enforced by:

1. **MCP Server** — `DelegationEnforcementLayer` blocks tools if protocol violated
2. **Pipeline Dispatcher** — Layers validate invariants before execution
3. **Audit Engine** — Records all actions for post-hoc analysis
4. **Self-Healing Engine** — Auto-remediates quality gate failures
5. **Agent Instructions** — AGENTS.md, CLAUDE.md mandate compliance

All implementations MUST conform to this spec. Any divergence requires an ADR (Architecture Decision Record) approved by the Architecture Board.

---

## References

- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — 15 architectural principles (Event Sourcing, CQRS, Event Mesh, etc.)
- [PACKAGE_ARCHITECTURE.md](./PACKAGE_ARCHITECTURE.md) — 12-package structure with Kernel at foundation
- [DEPENDENCY_MATRIX.md](./DEPENDENCY_MATRIX.md) — Dependency DAG rules
- [ADR-001](./adr/001-event-sourcing.md) — Event Sourcing as Source of Truth
- [ADR-002](./adr/002-cqrs.md) — CQRS — Command Query Responsibility Segregation
- [ADR-003](./adr/003-event-mesh.md) — Event Mesh Architecture
- [PLATFORM_SPEC.md](./PLATFORM_SPEC.md) — Platform Specification (Level 2–4)
