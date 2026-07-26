# ADR-001: Event Sourcing as Source of Truth

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS is a cognitive operating system that needs to support replay, audit, debugging, and simulation. Traditional CRUD-based state management does not provide these capabilities.

The system must:
- Record all state changes
- Enable replay of any execution
- Support audit trails
- Allow time-travel debugging
- Enable simulation of changes

## Decision

We adopt **Event Sourcing** as the foundational pattern for all state management.

### Core Principles:

1. **Immutable Events** — Events are append-only, never modified or deleted
2. **Event Store** — All events are persisted in an append-only log
3. **State Reconstruction** — Current state is derived by replaying events
4. **Full Audit Trail** — Every state change is recorded
5. **Replay Capability** — Any state can be reconstructed from events

### Event Types:

```
MissionCreated
MissionStarted
MissionCompleted
MissionFailed
EngineRegistered
CapabilityAdded
PolicyChanged
PluginInstalled
MemoryUpdated
ModelSelected
PromptExecuted
KnowledgeUpdated
SecurityEvent
GovernanceEvent
```

## Consequences

### Positive

- Complete audit trail for all state changes
- Ability to replay any execution
- Time-travel debugging
- Simulation of changes before execution
- Foundation for Digital Twin
- Enables Knowledge Evolution

### Negative

- Increased storage requirements
- Complexity in state reconstruction
- Event schema evolution challenges
- Learning curve for developers

### Risks

- Event schema breaking changes (mitigated by immutability)
- Storage growth (mitigated by snapshotting)
- Performance overhead (mitigated by projections)

## Alternatives Considered

### Alternative 1: CRUD-based State Management

**Description:** Traditional create, read, update, delete operations.

**Why Rejected:**
- No audit trail
- No replay capability
- No time-travel debugging
- Cannot support simulation

### Alternative 2: State Snapshots Only

**Description:** Store only current state, no history.

**Why Rejected:**
- No history
- No audit trail
- No replay capability
- Cannot track changes over time

## References

- [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) — Principle #2: Event First, Principle #6: Immutable Events
- [KERNEL_SPEC.md](../KERNEL_SPEC.md) — Kernel architecture
- [PLATFORM_SPEC.md](../PLATFORM_SPEC.md) — Platform architecture

---

*ADR-001: Event Sourcing as Source of Truth — Accepted 2026-07-21*
