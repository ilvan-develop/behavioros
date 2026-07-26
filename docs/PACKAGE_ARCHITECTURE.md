# BehaviorOS Package Architecture

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. Describes the 12-package structure.  
> **Last Updated:** July 2026

---

## Overview

BehaviorOS is organized as an **Enterprise Modular Monolith** with clear package boundaries, designed for future distribution. Each package represents a distinct bounded context with its own contracts, events, and implementations.

---

## Package Structure

```
packages/
├── @behavioros/kernel/          # Event Sourcing, CQRS, Contracts, Lifecycle, Event Mesh
├── @behavioros/runtime/         # Mission Compiler, Workflow, Scheduler, Queue, Workers
├── @behavioros/execution/       # Executor, Sandbox, Container, Checkpoint, Rollback
├── @behavioros/intelligence/    # Intent, Goal, Planning, Strategy, Reasoning
├── @behavioros/cognitive/       # Observation, Understanding, Evidence, Truth
├── @behavioros/knowledge/       # Graph, Memory Fabric, Ontology, Vector Index
├── @behavioros/ai/              # Model Registry, Router, Prompt, Inference
├── @behavioros/governance/      # Policy, Rule, Risk, Compliance, AI Governance
├── @behavioros/security/        # Identity, RBAC, ABAC, Vault, Zero Trust
├── @behavioros/metadata/        # "DNS" — Registry for everything
├── @behavioros/integration/     # Adapters, Connectors, Webhooks
├── @behavioros/infrastructure/  # Storage, Observability, Plugins, Digital Twin
├── @behavioros/schemas/         # Zod schemas (existing)
├── @behavioros/core/            # Facade (existing, will evolve)
├── @behavioros/sdk/             # Multi-language SDKs
├── @behavioros/cli/             # CLI (existing, will evolve)
├── @behavioros/mcp-server/      # MCP Server (existing)
└── @behavioros/web/             # Dashboard (existing)
```

---

## Package Descriptions

### Kernel (`@behavioros/kernel`)

The foundation of the system. Contains Event Sourcing, CQRS, Contracts, Lifecycle management, and Event Mesh.

**Responsibilities:**
- Event Store (append-only event persistence)
- Event Bus, Command Bus, Query Bus, Notification Bus, Stream Bus
- Contract definitions (all interfaces)
- Engine Lifecycle (Created → Registered → Initialized → Healthy → Degraded → Recovering → Stopping → Disposed)
- Kernel Lifecycle (Boot → Load Config → Load Plugins → Register Engines → Replay Events → Ready → Running → Paused → Recovering → Stopping → Disposed)

**Dependencies:** Nothing (foundation)

**Contains:**
```
kernel/
├── contracts/              # All interface definitions
│   ├── events.ts           # Event types
│   ├── commands.ts         # Command types
│   ├── queries.ts          # Query types
│   ├── capabilities.ts     # Capability interfaces
│   ├── engines.ts          # Engine interfaces
│   ├── storage.ts          # Storage interfaces
│   ├── metadata.ts         # Metadata interfaces
│   └── index.ts
├── events/                 # Event infrastructure
│   ├── event-store.ts      # Event persistence
│   ├── event-bus.ts        # Event distribution
│   ├── command-bus.ts      # Command dispatch
│   ├── query-bus.ts        # Query handling
│   ├── notification-bus.ts # Notification delivery
│   ├── stream-bus.ts       # Stream processing
│   └── projection-engine.ts # Event → Read Model
├── lifecycle/              # Lifecycle management
│   ├── engine-lifecycle.ts # Engine state machine
│   └── kernel-lifecycle.ts # Kernel boot sequence
└── storage/                # Storage abstraction
    ├── storage-provider.ts # Interface
    ├── filesystem-provider.ts
    ├── sqlite-provider.ts
    ├── postgres-provider.ts
    ├── redis-provider.ts
    ├── s3-provider.ts
    └── memory-provider.ts
```

---

### Runtime (`@behavioros/runtime`)

Orchestration layer. Compiles missions into workflows and schedules execution.

**Responsibilities:**
- Mission Compiler (DSL → executable plan)
- Workflow Engine (State Machine, Transitions, Conditions, Saga)
- Scheduler (Priority-based scheduling)
- Queue Manager (Persistent queue with backpressure)
- Worker Pool (Worker lifecycle management)
- Retry Manager (Exponential backoff)
- Resource Manager (CPU, RAM, GPU, Token, Time, Cost budgets)
- Parallel Executor (Parallel branch execution)

**Dependencies:** Kernel

---

### Execution (`@behavioros/execution`)

Isolated execution layer. Runs tasks in sandboxed environments.

**Responsibilities:**
- Execution Engine (Task execution orchestrator)
- Sandbox Executor (Sandboxed execution)
- Container Runtime (Container isolation)
- Resource Isolation (Resource boundary enforcement)
- Checkpoint Manager (Execution checkpoints)
- Rollback Manager (Automatic rollback)
- Execution Monitor (Real-time monitoring)
- Execution Recovery (Failure recovery)

**Dependencies:** Kernel, Runtime

---

### Intelligence (`@behavioros/intelligence`)

Planning and decision layer. Handles intent detection, goal decomposition, and hierarchical planning.

**Responsibilities:**
- Intent Engine (Intent detection, classification, routing)
- Goal Engine (Goal decomposition, hierarchy, tracking)
- Planning Engine (4-level: Strategic → Operational → Execution → TaskGraph)
- Strategy Engine (Strategy selection, adaptation, fallback)
- Reasoning Engine (Deductive, inductive, abductive reasoning)
- Evaluation Engine (Pre/post execution evaluation)
- Learning Engine (Pattern detection, auto-apply)
- Capability Registry (Capability registration, discovery)
- Capability Graph (Central: "Who can do what?" + dependencies)
- Capability Marketplace (Capability discovery, rating, selection)
- Semantic Registry (Embedding-based semantic search)
- Decision Engine (Multi-criteria voting)
- Conflict Resolver (Agent conflict resolution)
- Escalation Manager (Human-in-the-loop escalation)

**Dependencies:** Kernel

---

### Cognitive (`@behavioros/cognitive`)

Cognitive processing layer. Handles observation, understanding, evidence, and truth.

**Responsibilities:**
- Observation Engine (Event ingestion, pattern detection)
- Understanding Engine (Context building, intent extraction)
- Evidence Graph (Evidence relationships, verification)
- Truth Vector (Multi-dimensional truth calculation)
- Cognitive Index (Cognitive health score)
- Context Budget (Token budget management)
- Mission Context (Mission state, history, dependencies)
- Semantic Reasoning (Implicit relations, contradiction detection)

**Dependencies:** Kernel, Intelligence

---

### Knowledge (`@behavioros/knowledge`)

Knowledge management layer. Handles graphs, memory, ontology, and vector search.

**Responsibilities:**
- Knowledge Graph (Entities, relations, properties)
- Knowledge Diff (Change detection, delta calculation)
- Knowledge Merge (Conflict resolution, merge strategies)
- Knowledge Version (Version control, snapshots)
- Knowledge Branch (Branching, parallel exploration)
- Knowledge Review (Review workflow, approval)
- Knowledge Publish (Publication, promotion)
- Knowledge Cache (TTL, domain invalidation)
- Memory Short-term (Ephemeral, task-scoped)
- Memory Working (Active context, attention window)
- Memory Long-term (Persistent, indexed)
- Memory Semantic (Concepts, embeddings)
- Memory Procedural (Skills, workflows)
- Memory Episodic (Events, timeline)
- Ontology Manager (Ontology definition, evolution)
- Vector Index (Embedding storage, similarity search)
- Fact Extractor (Fact extraction, validation)
- Evidence Manager (Evidence collection, verification)

**Dependencies:** Kernel

---

### AI (`@behavioros/ai`)

AI resource management layer. Handles models, prompts, routing, and inference.

**Responsibilities:**
- Model Registry (Model metadata, capabilities, costs)
- Model Router (Task → model matching, fallback)
- AI Resource Manager (GPU, CPU, context, token, cost, latency, cache, fallback decisions)
- Prompt Registry (Prompt versioning, templates)
- Prompt Compiler (Template → executable prompt)
- Context Builder (Context assembly, window management)
- Inference Engine (LLM execution, streaming)
- Response Evaluator (Quality, relevance, safety scoring)

**Dependencies:** Kernel

---

### Governance (`@behavioros/governance`)

Governance and compliance layer. Handles policies, rules, risk, and AI governance.

**Responsibilities:**
- Policy Engine (Declarative policy evaluation)
- Rule Engine (Rule execution, enforcement)
- Risk Engine (Risk assessment, scoring)
- Compliance Engine (Framework orchestration)
- Governance Gate (Final decision point)
- OPA Integration (OPA/Rego evaluation)
- SOC2 Provider (SOC2 rule provider)
- ISO27001 Provider
- GDPR Provider
- LGPD Provider
- HIPAA Provider
- PCI Provider
- Bias Detector
- Hallucination Detector
- Explainability Engine
- Safety Engine
- Human Approval
- Provenance Engine
- Confidence Calibration
- Prompt Lineage
- Model Lineage
- Dataset Lineage
- Decision Explainability
- Intervention Tracker

**Dependencies:** Kernel, Knowledge

---

### Security (`@behavioros/security`)

Security layer. Handles identity, access control, secrets, and encryption.

**Responsibilities:**
- Identity Engine (Identity management, authentication)
- RBAC Engine (Role-based access control)
- ABAC Engine (Attribute-based access control)
- Secrets Engine (Secret management, rotation)
- Vault Engine (Encrypted storage, access logging)
- Encryption Engine (Encryption at rest/transit)
- Key Rotation (Automated key rotation)
- Zero Trust Engine (Zero trust verification)
- Audit Engine (Security audit trail)
- Certificate Manager (TLS/certificate management)

**Dependencies:** Kernel

---

### Metadata (`@behavioros/metadata`)

The "DNS" of the system. Central registry for everything.

**Responsibilities:**
- Schema Registry (Schema versioning, validation)
- Contract Registry (Contract discovery, compatibility)
- Capability Catalog (Capability inventory)
- Model Catalog (AI model metadata)
- Policy Catalog (Policy inventory)
- Tenant Registry (Tenant metadata)
- Plugin Catalog (Plugin metadata)
- Agent Catalog (Agent metadata)
- Ontology Registry (Ontology definitions)
- Metadata Store (Metadata persistence)

**Dependencies:** Kernel

**Special Rule:** Metadata is READ-ONLY for all platforms. Platforms register their metadata but do not modify other platforms' metadata.

---

### Integration (`@behavioros/integration`)

Integration layer. Handles adapters, connectors, and webhooks.

**Responsibilities:**
- Adapter Framework (Kafka, RabbitMQ, NATS, Redis Streams)
- Connector Framework (REST, gRPC, GraphQL, MCP, A2A, ACP)
- Webhook Manager (Webhook registration, delivery)
- OAuth Manager (OAuth flows, token management)
- Queue Adapters (Queue technology abstraction)

**Dependencies:** Kernel

---

### Infrastructure (`@behavioros/infrastructure`)

Infrastructure layer. Handles storage, observability, plugins, and digital twin.

**Responsibilities:**
- Storage Providers (Filesystem, SQLite, Postgres, Redis, S3, Memory)
- Observability (Metrics, Tracing, Logging, Profiling, Health, Alerts, Telemetry)
- Plugin System (Lifecycle, Marketplace, Permissions, Isolation, Health)
- Digital Twin (State Capture, Replay, Simulation, Forecast, Optimization, Chaos, Capacity, Injection)
- Multi-tenancy (Tenant Manager, Workspace Manager)
- Billing (Usage tracking, invoice generation)
- DSL (Kernel DSL parser, compiler)
- SDK Generator (Multi-language SDK generation)
- Domain Registry (Domain registration, boundaries)

**Dependencies:** Kernel

---

## Dependency Rules

### Allowed Dependencies

```
kernel → (nothing)
runtime → kernel
execution → kernel, runtime
intelligence → kernel
cognitive → kernel, intelligence
knowledge → kernel
ai → kernel
governance → kernel, knowledge
security → kernel
metadata → kernel
integration → kernel
infrastructure → kernel
```

### Forbidden Dependencies (Circular Prevention)

```
knowledge × runtime
cognitive × execution
ai × governance
security × metadata
```

### Metadata Special Rule

```
metadata → READ-ONLY → all platforms
```

Metadata Platform can read from all platforms but cannot write to them. Platforms register their metadata in the Metadata Platform.

---

## Package Interface Contract

Every package must:

1. Export a typed API (TypeScript interfaces)
2. Emit events via Event Bus
3. Accept commands via Command Bus
4. Respond to queries via Query Bus
5. Register capabilities in Metadata Platform
6. Expose health checks
7. Emit metrics, traces, and logs
8. Be testable in isolation

---

## References

- [DEPENDENCY_MATRIX.md](./DEPENDENCY_MATRIX.md) — Detailed dependency rules
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — Architectural principles
- [COMPONENT_LIFECYCLE.md](./COMPONENT_LIFECYCLE.md) — Component lifecycle states

---

*BehaviorOS Package Architecture v1.0.0 — July 2026*
