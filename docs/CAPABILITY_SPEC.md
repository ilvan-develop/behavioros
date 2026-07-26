# Capability Specification

> **Version:** 0.2.0  
> **Status:** FUTURE ARCHITECTURE — not yet implemented  
> **Canonical Reference:** `docs/KERNEL_SPEC.md §4–§5, §12`  
> **Related Docs:** `docs/CAPABILITY_LIFECYCLE.md`, `docs/EVENT_MESH_SPEC.md`, `docs/PLATFORM_SPEC.md`  
> **Decision Record:** `docs/ADR/004-capability-unification.md` — Capability as universal concept approved  
> **Existing Foundation:** `packages/core/src/engines/skill-engine.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [Capability Types](#capability-types)
3. [Capability Lifecycle](#capability-lifecycle)
4. [Capability Metadata](#capability-metadata)
5. [Capability Graph](#capability-graph)
6. [Capability Registry & Catalog](#capability-registry--catalog)
7. [State Machine Engine](#state-machine-engine)
8. [Discovery Mechanisms](#discovery-mechanisms)
9. [Verification & Security](#verification--security)
10. [Dependency Resolution](#dependency-resolution)
11. [Storage & Persistence](#storage--persistence)
12. [Integration with SkillEngine](#integration-with-skillengine)
13. [Appendix: Legacy Lifecycle Mapping](#appendix-legacy-lifecycle-mapping)

---

## Overview

Per **ADR-004**, all executable components in BehaviorOS are unified under the concept of **Capability**:

> A Capability is any executable component that can be registered, discovered, composed, versioned, and monitored.

This replaces the previous three-lifecycle model (Engine/Component, Skill, Capability) with a single universal abstraction. Everything — agents, tools, models, workflows, plugins, skills, connectors — is a Capability.

### Why Unify?

| Before (3 Lifecycles) | After (1 Capability) |
|----------------------|---------------------|
| Fragmented discovery | Unified Capability Registry |
| Inconsistent lifecycle | Single lifecycle with type-specific gates |
| Difficult composition | Capability Graph enables cross-type composition |
| Multiple registries | Single Capability Registry + Capability Catalog |
| Concept fragmentation | Everything is a Capability |

### Architecture Context

```
┌──────────────────────────────────────────────────────────┐
│                  4-Level Architecture                      │
│                                                           │
│   Kernel     → Capability Engine, State Machine           │
│   Cognitive  → Capability Graph, Metadata Platform        │
│   Enterprise → Capability Registry, Capability Catalog    │
│   Ecosystem  → Capability Marketplace, Third-party Caps   │
└──────────────────────────────────────────────────────────┘
```

---

## Capability Types

Per ADR-004, the following Capability types exist:

| Type | Description | Examples |
|------|-------------|----------|
| **Agent** | AI agent | Reviewer, Tester, Deployer, Orchestrator |
| **Tool** | Utility function | File reader, API caller, Search tool |
| **Model** | AI model | GPT-5, Claude, Gemini, Llama |
| **Workflow** | Process definition | Deploy pipeline, Review process, Onboarding |
| **Plugin** | Extension module | Custom adapter, Custom tool, Exporter |
| **Skill** | Agent capability | OCR, Translation, Planning, Code analysis |
| **Connector** | Integration point | Slack, GitHub, Jira, Postgres, Redis |
| **Engine** | System component | GovernanceEngine, QualityEngine, AuditEngine |
| **Policy** | Governance rule | Security policy, Cost policy, Access policy |
| **Adapter** | Technology bridge | Kafka adapter, Redis adapter, S3 adapter |

### Type Hierarchy

```
Capability
  ├── Atomic Capability (single unit)
  │     ├── Tool
  │     ├── Model
  │     ├── Policy
  │     └── Adapter
  └── Composite Capability (composed of other capabilities)
        ├── Agent (uses Tools + Models + Skills)
        ├── Workflow (chains Tools + Agents)
        ├── Plugin (extends Engine with Tools)
        ├── Skill (may bundle Tools + Models)
        ├── Connector (wraps Adapter + Tools)
        └── Engine (hosts Plugins + Policies)
```

---

## Capability Lifecycle

Every capability progresses through 6 stages:

```
Proposal → Prototype → Review → Registry → Marketplace → Production
```

### State Machine

```typescript
type CapabilityState =
  | 'proposal'
  | 'prototype'
  | 'review'
  | 'registry'
  | 'marketplace'
  | 'production';
```

### Valid Transitions

```
Proposal → Prototype → Review → Registry → Marketplace → Production
   │          │          │
   └──────────┴──────────┘ (rejected → archived)
```

| From | To | Gate | Required Artifacts |
|------|----|------|--------------------|
| `proposal` | `prototype` | Team lead approval | RFC document |
| `proposal` | _(archived)_ | Team lead rejects | Rejection reason |
| `prototype` | `review` | Prototype complete | Working prototype + tests |
| `prototype` | _(archived)_ | Review fails | Gap analysis |
| `review` | `registry` | Architecture board approves | ADR + spec + tests ≥ 80% |
| `review` | _(archived)_ | Board rejects | Rejection rationale |
| `registry` | `marketplace` | Documentation + examples complete | User docs + API ref |
| `marketplace` | `production` | Quality gates pass + load test | All gates green + perf ≥ threshold |

### Lifecycle by Type

Different capability types have different default entry points:

| Type | Default Entry | Typical Path |
|------|--------------|--------------|
| Agent | `registry` (pre-built) | registry → marketplace → production |
| Tool | `proposal` | proposal → prototype → review → registry |
| Model | `marketplace` (model hub) | marketplace → production |
| Workflow | `prototype` | prototype → review → registry |
| Plugin | `proposal` | proposal → prototype → review → registry |
| Skill | `proposal` | proposal → prototype → review → registry |
| Connector | `prototype` | prototype → review → registry |
| Engine | `registry` (system) | registry → production |
| Policy | `review` | review → registry → marketplace |
| Adapter | `prototype` | prototype → review → registry |

---

## Capability Metadata

Every capability registers structured metadata:

```typescript
interface CapabilityMetadata {
  /** Identity */
  id: string;
  name: string;
  version: string;               // SemVer
  type: CapabilityType;
  description: string;

  /** Provider */
  provider: {
    id: string;                   // Organization or individual
    name: string;
    trustLevel: 'verified' | 'community' | 'experimental';
  };

  /** Quality */
  cost: {
    creditsPerCall: number;
    creditsPerSecond?: number;    // For streaming capabilities
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
  };
  reliability: {
    uptime: number;               // Percentage
    lastIncident?: string;
    sla?: string;
  };

  /** Access Control */
  permissions: {
    requiredRoles: string[];
    restrictedToTenants?: string[];
    requiresApproval: boolean;
  };

  /** Dependencies */
  dependencies: CapabilityDependency[];

  /** Lifecycle */
  state: CapabilityState;
  maturity: 'alpha' | 'beta' | 'stable' | 'deprecated';

  /** Documentation */
  docs: {
    readme?: string;
    changelog?: string;
    apiRef?: string;
    examples?: string[];
  };

  /** Audit trail */
  audit: {
    createdAt: string;
    updatedAt: string;
    transitions: Array<{
      from: CapabilityState;
      to: CapabilityState;
      timestamp: string;
      triggeredBy: string;
      reason: string;
    }>;
  };
}

interface CapabilityDependency {
  capabilityId: string;
  version: string;               // SemVer range
  optional?: boolean;
  requiredFeatures?: string[];
}
```

### Metadata Storage

Capability metadata is stored in the **Metadata Platform** (docs/PLATFORM_SPEC.md) and indexed by the **Capability Graph** for fast discovery and relationship traversal.

---

## Capability Graph

The Capability Graph is the **brain of the system** — a directed graph that maps all capabilities and their relationships.

### Graph Structure

```
┌─────────────────────────────────────────────────────────┐
│                   Capability Graph                        │
│                                                           │
│   Agent: Reviewer ──uses──▶ Tool: FileReader              │
│       │                    │                              │
│       │                    ▼                              │
│       │              Model: GPT-5                         │
│       │                                                  │
│       └──triggers──▶ Workflow: ReviewPipeline             │
│                           │                              │
│                           ▼                              │
│                     Connector: GitHubAPI                  │
│                                                           │
│   Skill: OCR ──depends_on──▶ Model: VisionModel           │
│       │                      │                            │
│       ▼                      ▼                            │
│   Policy: CostPolicy ──约束──▶ All billable caps          │
└─────────────────────────────────────────────────────────┘
```

### Edge Types

| Edge | Description | Example |
|------|-------------|---------|
| `uses` | Capability uses another | Agent uses Tool |
| `depends_on` | Capability depends on another | Skill depends on Model |
| `triggers` | Capability triggers another | Agent triggers Workflow |
| `composes` | Capability is part of another | Tool composes Agent |
| `constrains` | Policy constrains Capability | Policy constrains Cost |
| `replaces` | New version replaces old | v2 replaces v1 |
| `conflicts_with` | Incompatible capabilities | Two exclusive Models |

### Graph API

```typescript
interface CapabilityGraph {
  /** Register a capability node */
  registerNode(capability: CapabilityMetadata): Promise<void>;

  /** Remove a capability node */
  removeNode(capabilityId: string): Promise<void>;

  /** Add an edge between two capabilities */
  addEdge(from: string, to: string, type: EdgeType): Promise<void>;

  /** Find path between two capabilities */
  findPath(from: string, to: string): Promise<CapabilityPath>;

  /** Get all capabilities of a type */
  getByType(type: CapabilityType): Promise<CapabilityMetadata[]>;

  /** Get all capabilities that use a given capability */
  getDependents(capabilityId: string): Promise<CapabilityMetadata[]>;

  /** Get all dependencies of a capability */
  getDependencies(capabilityId: string): Promise<CapabilityMetadata[]>;

  /** Detect circular dependencies */
  detectCycles(): Promise<CycleReport>;

  /** Query the graph using a traversal pattern */
  traverse(start: string, pattern: TraversalPattern): Promise<CapabilityMetadata[]>;

  /** Health check */
  health(): GraphHealth;
}
```

### Graph Traversal Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| `breadth-first` | All reachable nodes | Impact analysis |
| `depth-first` | Deep dependency chain | Dependency resolution |
| `shortest-path` | Minimum edges between nodes | Capability chaining |
| `all-paths` | Every path between nodes | Redundancy detection |
| `subgraph` | All nodes within N hops | Capability neighborhood |

### Graph as System Brain

The Capability Graph powers:

1. **Discovery** — Find capabilities by type, provider, quality, or relationship
2. **Composition** — Automatically compose workflows by chaining capabilities
3. **Impact Analysis** — When a capability changes, find all dependents
4. **Optimization** — Choose the best capability for a given cost/latency/reliability profile
5. **Governance** — Enforce policies across the capability dependency chain
6. **Marketplace** — Surface related capabilities, suggest upgrades

---

## Capability Registry & Catalog

### Capability Registry

The **Registry** is the authoritative source of truth for all registered capabilities:

```typescript
interface CapabilityRegistry {
  /** Register a new capability */
  register(metadata: CapabilityMetadata): Promise<RegistrationResult>;

  /** Update capability metadata */
  update(capabilityId: string, metadata: Partial<CapabilityMetadata>): Promise<void>;

  /** Get capability by ID */
  get(capabilityId: string): Promise<CapabilityMetadata | undefined>;

  /** List capabilities with filters */
  list(filters?: RegistryFilters): Promise<CapabilityMetadata[]>;

  /** Transition capability state */
  transition(capabilityId: string, to: CapabilityState, context: TransitionContext): Promise<TransitionResult>;

  /** Archive a capability */
  archive(capabilityId: string, reason: string): Promise<void>;

  /** Search capabilities */
  search(query: string): Promise<CapabilityMetadata[]>;

  /** Health check */
  health(): RegistryHealth;
}

interface RegistryFilters {
  type?: CapabilityType;
  state?: CapabilityState;
  provider?: string;
  maturity?: 'alpha' | 'beta' | 'stable' | 'deprecated';
  tags?: string[];
  minReliability?: number;
  maxCost?: number;
}
```

### Capability Catalog

The **Catalog** is the user-facing browse-and-discover interface built on top of the Registry:

| Feature | Description |
|---------|-------------|
| **Browse** | Explore capabilities by type, category, or provider |
| **Search** | Full-text search across names, descriptions, and tags |
| **Filter** | Filter by type, state, maturity, cost, reliability |
| **Compare** | Side-by-side comparison of similar capabilities |
| **Dependencies** | Visual dependency tree for any capability |
| **Versions** | Version history and changelog |
| **Marketplace** | Production-ready capabilities available for use |

### Registry → Catalog Flow

```
Capability Developer
    ↓
Registry.register(metadata)       ← Capability enters at any lifecycle state
    ↓
Registry.transition(id, 'marketplace')   ← Quality gates verified
    ↓
Catalog.publish(id)               ← Capability visible to all users
    ↓
User discovers → selects → composes into workflow
    ↓
Usage metrics feed back into Capability Graph
```

---

## State Machine Engine

### Generic Interface

```typescript
interface StateMachine<TState extends string> {
  readonly current: TState;
  readonly validTransitions: TState[];

  transition(to: TState, context?: TransitionContext): Promise<TransitionResult>;
  canTransition(to: TState): boolean;
  getHistory(): TransitionRecord[];
  reset(): Promise<void>;
}

interface TransitionContext {
  reason: string;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
}

interface TransitionResult {
  success: boolean;
  from: string;
  to: string;
  timestamp: string;
  error?: string;
}

interface TransitionRecord {
  from: string;
  to: string;
  timestamp: string;
  triggeredBy: string;
  reason: string;
  duration: number;
}
```

### State Machine Registry

```typescript
interface StateMachineRegistry {
  register(id: string, machine: StateMachine<string>): void;
  get(id: string): StateMachine<string> | undefined;
  unregister(id: string): void;
  list(): Array<{ id: string; state: string; type: CapabilityType }>;
}
```

### Validation Rules

Every transition MUST pass:

1. **Structural validity** — `to` is in `validTransitions[current]`
2. **Authorization** — caller has permission to trigger the transition
3. **Precondition check** — all preconditions for `to` are met
4. **Dependency check** — dependent capabilities are in compatible states
5. **Health check** — system resources are sufficient

---

## Discovery Mechanisms

### Source Types

| Source | Protocol | Discovery Method | Currently Supported |
|--------|----------|------------------|-------------------|
| **AITMPL** | HTTP/REST | `GET /catalog` | ✅ (via EcosystemRegistry) |
| **OpenDesign** | HTTP/REST | `GET /design-systems` | ✅ |
| **Local filesystem** | File system | `readdir(skillsDir)` | ✅ (via `syncFromLocal`) |
| **NPM registry** | HTTP/REST | `GET /-/v1/search` | ⬜ Planned |
| **GitHub** | GraphQL | `search:repos(topic:behavioros-capability)` | ⬜ Planned |
| **Custom URL** | HTTP/REST | Direct URL | ⬜ Planned |

### Discovery Flow

```
1. Source queried for available capabilities
2. Results parsed into CapabilityMetadata format
3. Deduplicated against existing Registry
4. New capabilities → state: proposal (or type-specific default)
5. Notification sent via Event Bus
```

---

## Verification & Security

### Verification Steps

Before a capability can advance past `prototype`, it must pass verification:

```typescript
interface VerificationCheck {
  name: string;
  type: 'checksum' | 'signature' | 'schema' | 'scan' | 'dependency' | 'quality';
  required: boolean;
  pass: boolean;
  message?: string;
}
```

**Standard verification suite:**

| Check | Type | Required | Description |
|-------|------|----------|-------------|
| SHA-256 checksum | `checksum` | ✅ | Package hash matches manifest |
| Signature verification | `signature` | ✅ | Signed by trusted provider |
| Schema validation | `schema` | ✅ | Metadata matches CapabilityMetadata schema |
| Malware scan | `scan` | ✅ | No known signatures |
| Dependency audit | `dependency` | ✅ | All deps are verified and available |
| Quality gate | `quality` | ✅ | Tests ≥ 80%, lint pass, typecheck pass |
| License check | `scan` | ⚠️ | Compatible license required |

### Security Levels

| Level | Requirements | Use Case |
|-------|-------------|----------|
| **sandbox** | No verification | Development only |
| **standard** | Checksum + schema | Internal capabilities |
| **high** | Checksum + schema + signature | Enterprise capabilities |
| **critical** | All checks + manual review | Security-sensitive capabilities |

---

## Dependency Resolution

### Dependency Declaration

```typescript
interface CapabilityDependency {
  capabilityId: string;
  version: string;      // SemVer range, e.g. "^1.2.0", ">=2.0.0 <3.0.0"
  optional?: boolean;
  requiredFeatures?: string[];
}
```

### Resolution Algorithm

```
1. Collect all declared dependencies (DFS from root capability)
2. Build dependency graph with versions
3. Detect conflicts (same ID, incompatible versions)
4. Resolve using semantic versioning:
   a. Prefer highest compatible version
   b. Match exact versions if specified
   c. Fall back to latest compatible
5. Verify no circular dependencies
6. Return resolved dependency tree
```

### Conflict Resolution

| Conflict | Resolution Strategy |
|----------|-------------------|
| Version mismatch (major) | Block — requires manual resolution |
| Version mismatch (minor/patch) | Auto-select highest compatible |
| Circular dependency | Block — report cycle path |
| Missing dependency | Block — report missing ID |
| Optional dependency missing | Warn — proceed without |
| Feature gap | Block — capability lacks required feature |

---

## Storage & Persistence

### Registry Schema

```typescript
interface CapabilityRecord {
  id: string;
  type: CapabilityType;
  name: string;
  version: string;
  state: CapabilityState;
  metadata: CapabilityMetadata;
  path?: string;
  checksum?: string;
  dependencies?: CapabilityDependency[];
  timestamps: {
    registered?: string;
    lastTransition?: string;
    lastUsed?: string;
  };
}
```

### Storage Backends

| Backend | Capability Storage |
|---------|-------------------|
| **Memory** | `Map<string, CapabilityRecord>` |
| **File system** | `~/.behavioros/capabilities/registry.json` |
| **SQLite** | `capabilities` table |
| **Postgres** | `capability_registry` table |

### Graph Persistence

The Capability Graph is persisted as adjacency lists alongside the registry:

```typescript
interface CapabilityEdge {
  from: string;         // Capability ID
  to: string;           // Capability ID
  type: EdgeType;
  metadata?: Record<string, unknown>;
}
```

---

## Integration with SkillEngine

The existing `SkillEngine` provides the runtime foundation for the Capability system:

| SkillEngine Method | Capability Equivalent | Implementation Status |
|-------------------|----------------------|----------------------|
| `listAvailable()` | Registry `list()` | ✅ |
| `search(query, filters)` | Registry `search()` | ✅ |
| `get(skillId)` | Registry `get()` | ✅ |
| `install(component)` | Capability → `production` | ✅ |
| `uninstall(componentId)` | Capability → archived | ✅ |
| `resolve(agentId, skillId)` | Graph traversal | ✅ |
| `validateDelegation(...)` | Permission check | ✅ |
| `syncFromDNA(dna)` | Registry bulk import | ✅ |
| `syncFromLocal(path)` | Registry filesystem import | ✅ |
| `status()` | Registry health | ✅ |
| `doctor()` | Registry verification | ✅ |

### Future Integration Points

| Integration | Phase | Description |
|-------------|-------|-------------|
| Capability Graph Engine | 3.5 | Graph-based discovery and composition |
| Capability Registry | 3.7 | Formal capability registration and gating |
| Capability Catalog UI | 4.0 | User-facing browse and marketplace |
| Dependency Resolver | 3.6 | Automatic dependency resolution |
| Metadata Platform | 3.5 | Centralized metadata storage for all capabilities |

---

## Appendix: Legacy Lifecycle Mapping

For backwards compatibility, the old three-lifecycle model maps to the unified Capability model:

| Legacy Concept | Capability Mapping |
|---------------|-------------------|
| **Engine/Component** (7 states) | Capability type: `engine`, uses CapabilityLifecycle states |
| **Skill** (10 states) | Capability type: `skill`, uses CapabilityLifecycle states |
| **Capability** (6 states) | Direct: the CapabilityLifecycle itself |

### State Mapping: Engine → Capability

| Engine State | Capability State | Notes |
|-------------|-----------------|-------|
| `created` | `proposal` | Engine proposed |
| `registered` | `registry` | Engine registered in system |
| `initialized` | `registry` | Configuration applied |
| `healthy` | `production` | Engine operational |
| `degraded` | `production` (degraded) | Operational with issues |
| `recovering` | `production` (recovering) | Self-healing in progress |
| `disposed` | Archived | Engine removed |

### State Mapping: Skill → Capability

| Skill State | Capability State | Notes |
|------------|-----------------|-------|
| `discovered` | `proposal` | Skill found but not installed |
| `downloaded` | `prototype` | Package fetched |
| `verified` | `review` | Checksums validated |
| `installed` | `registry` | Extracted to disk |
| `registered` | `registry` | Added to registry |
| `resolved` | `marketplace` | Dependencies resolved |
| `loaded` | `marketplace` | In memory, ready |
| `active` | `production` | Ready for agents |
| `deprecated` | `production` (deprecated) | Marked for removal |
| `removed` | Archived | Uninstalled |

---

*This document describes the FUTURE ARCHITECTURE of the Capability system per ADR-004. The SkillEngine provides the runtime foundation. Full Capability Graph and Registry implementation is planned for Phase 3.5–4.0 of the [ROADMAP](ROADMAP.md).*
