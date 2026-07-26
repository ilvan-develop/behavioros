# ADR-003: Event Mesh with 5 Buses

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS needs a robust communication infrastructure that supports:
- Event distribution across platforms
- Command dispatching for write operations
- Query handling for read operations
- Notification delivery for alerts
- Stream processing for real-time data

A single Event Bus is insufficient for these diverse communication needs.

## Decision

We implement an **Event Mesh** with 5 specialized buses:

### 1. Event Bus

**Purpose:** Distribute events across all platforms.

**Characteristics:**
- Pub/sub pattern
- At-least-once delivery
- Event persistence
- Event replay

**Use Cases:**
- MissionCreated, MissionStarted, MissionCompleted
- KnowledgeUpdated, MemoryStored
- PolicyChanged, RuleEnforced

### 2. Command Bus

**Purpose:** Dispatch commands for write operations.

**Characteristics:**
- Request/response pattern
- Exactly-once delivery
- Command validation
- Command authorization

**Use Cases:**
- CreateMission, UpdateMission, DeleteMission
- RegisterCapability, UpdateCapability
- EnforcePolicy, EvaluateRule

### 3. Query Bus

**Purpose:** Handle queries for read operations.

**Characteristics:**
- Request/response pattern
- Read-only operations
- Cached responses
- Optimized for read performance

**Use Cases:**
- GetMission, ListMissions, SearchMissions
- GetCapability, ListCapabilities
- GetKnowledge, QueryKnowledge

### 4. Notification Bus

**Purpose:** Deliver notifications for alerts.

**Characteristics:**
- Fire-and-forget pattern
- Async delivery
- Multiple channels (email, webhook, in-app)
- Priority-based delivery

**Use Cases:**
- Security alerts
- Governance violations
- System health alerts
- Task completions

### 5. Stream Bus

**Purpose:** Process real-time data streams.

**Characteristics:**
- Stream processing pattern
- Backpressure handling
- Windowing support
- Exactly-once processing

**Use Cases:**
- Real-time metrics
- Log aggregation
- Audit trail streaming
- Knowledge graph updates

## Consequences

### Positive

- Clear separation of communication concerns
- Independent scaling per bus
- Optimized patterns for each use case
- Foundation for distributed runtime
- Supports diverse communication needs

### Negative

- Increased infrastructure complexity
- More components to manage
- Higher operational overhead
- Learning curve for developers

### Risks

- Bus synchronization issues (mitigated by clear contracts)
- Performance overhead (mitigated by optimization)
- Operational complexity (mitigated by monitoring)

## Alternatives Considered

### Alternative 1: Single Event Bus

**Description:** One bus for all communication.

**Why Rejected:**
- Cannot optimize for different patterns
- Performance bottlenecks
- Mixed concerns
- Difficult to scale independently

### Alternative 2: Direct Communication

**Description:** Components communicate directly.

**Why Rejected:**
- Tight coupling
- No audit trail
- Difficult to scale
- No event replay

## References

- [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) — Principle #2: Event First
- [EVENT_MESH_SPEC.md](../EVENT_MESH_SPEC.md) — Event Mesh architecture
- [KERNEL_SPEC.md](../KERNEL_SPEC.md) — Kernel architecture

---

*ADR-003: Event Mesh with 5 Buses — Accepted 2026-07-21*
