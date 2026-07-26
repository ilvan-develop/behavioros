# ADR-002: CQRS as Communication Pattern

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS needs to handle both read and write operations efficiently. The system must support:
- High-throughput writes (events, commands)
- High-throughput reads (queries, projections)
- Independent scaling of reads and writes
- Different data models for reads and writes

## Decision

We adopt **Command Query Responsibility Segregation (CQRS)** as the communication pattern.

### Core Components:

1. **Command Bus** — Handles write operations (commands)
2. **Query Bus** — Handles read operations (queries)
3. **Event Bus** — Distributes events
4. **Notification Bus** — Delivers notifications
5. **Stream Bus** — Processes streams

### Pattern:

```
Command → Command Bus → Handler → Event Store → Event Bus
                                                           ↓
Query → Query Bus → Read Model ← Projection Engine ← Event Bus
```

### Rules:

- Commands are never returned with data
- Queries never modify state
- Events are the source of truth
- Read models are derived from events

## Consequences

### Positive

- Independent scaling of reads and writes
- Optimized data models for each side
- Clear separation of concerns
- Foundation for Event Mesh
- Supports multiple read models

### Negative

- Increased complexity
- Eventual consistency between read/write
- More infrastructure to manage
- Learning curve for developers

### Risks

- Eventual consistency issues (mitigated by clear documentation)
- Debugging complexity (mitigated by Event Sourcing)
- Performance overhead (mitigated by projections)

## Alternatives Considered

### Alternative 1: CRUD Architecture

**Description:** Traditional read/write through same model.

**Why Rejected:**
- Cannot scale reads and writes independently
- Limited data model flexibility
- No clear separation of concerns

### Alternative 2: CQRS without Events

**Description:** CQRS but without event-driven communication.

**Why Rejected:**
- No audit trail
- No replay capability
- Tight coupling between sides

## References

- [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) — Principle #2: Event First
- [EVENT_MESH_SPEC.md](../EVENT_MESH_SPEC.md) — Event Mesh architecture
- [KERNEL_SPEC.md](../KERNEL_SPEC.md) — Kernel architecture

---

*ADR-002: CQRS as Communication Pattern — Accepted 2026-07-21*
