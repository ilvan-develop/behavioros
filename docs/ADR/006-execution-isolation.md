# ADR-006: Execution Isolation Model

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS must execute tasks in isolated environments to ensure:
- Security (no unauthorized access)
- Stability (no resource conflicts)
- Scalability (independent resource allocation)
- Portability (same interface across environments)

Different tasks require different isolation levels:
- Simple tasks: lightweight sandbox
- Complex tasks: container isolation
- Resource-intensive tasks: VM isolation
- Distributed tasks: remote/cloud workers

## Decision

We implement an **Execution Isolation Model** with multiple levels:

### Isolation Levels:

```
Sandbox → Container → VM → Remote Worker → Cloud Worker
```

### Level 1: Sandbox

**Description:** Lightweight process isolation.

**Characteristics:**
- Filesystem isolation
- Network isolation
- Resource limits
- Fast startup

**Use Cases:**
- Simple script execution
- Tool execution
- Quick computations

### Level 2: Container

**Description:** OS-level isolation.

**Characteristics:**
- Full filesystem isolation
- Network isolation
- Resource limits
- Package isolation
- Moderate startup

**Use Cases:**
- Complex applications
- Multi-dependency tasks
- Production workloads

### Level 3: VM

**Description:** Hardware-level isolation.

**Characteristics:**
- Complete isolation
- Full resource control
- Security isolation
- Slow startup

**Use Cases:**
- Security-sensitive tasks
- Untrusted code
- Compliance requirements

### Level 4: Remote Worker

**Description:** Network-isolated execution.

**Characteristics:**
- Network isolation
- Resource allocation
- Geographic distribution
- Moderate latency

**Use Cases:**
- Distributed processing
- Geographic requirements
- Load distribution

### Level 5: Cloud Worker

**Description:** Cloud-native execution.

**Characteristics:**
- Auto-scaling
- Pay-per-use
- Global distribution
- Managed infrastructure

**Use Cases:**
- Burst workloads
- Global applications
- Cost optimization

### Unified Interface:

All levels share the same interface:

```typescript
interface ExecutionEnvironment {
  execute(task: Task): Promise<Result>;
  checkpoint(): Promise<Checkpoint>;
  rollback(checkpoint: Checkpoint): Promise<void>;
  monitor(): Promise<HealthStatus>;
}
```

## Consequences

### Positive

- Same interface across all isolation levels
- Flexible resource allocation
- Security by isolation
- Scalability by distribution
- Portability across environments

### Negative

- Increased complexity
- Performance overhead
- Resource management complexity
- Debugging complexity

### Risks

- Isolation failures (mitigated by testing)
- Performance overhead (mitigated by optimization)
- Resource waste (mitigated by auto-scaling)

## Alternatives Considered

### Alternative 1: Single Isolation Level

**Description:** Use only one isolation level for all tasks.

**Why Rejected:**
- Inefficient resource usage
- No flexibility
- Security vs performance trade-off
- No scalability options

### Alternative 2: Custom Isolation per Task

**Description:** Implement custom isolation for each task type.

**Why Rejected:**
- Inconsistent interface
- High development cost
- Difficult to maintain
- No reuse

## References

- [EXECUTION_SPEC.md](../EXECUTION_SPEC.md) — Execution Platform specification
- [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) — Principle #14: Distributed Ready
- [SECURITY_SPEC.md](../SECURITY_SPEC.md) — Security specification

---

*ADR-006: Execution Isolation Model — Accepted 2026-07-21*
