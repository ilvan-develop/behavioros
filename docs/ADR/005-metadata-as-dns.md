# ADR-005: Metadata as DNS of the System

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS has many entities that need to be discovered, validated, and evolved:
- Capabilities
- Policies
- Schemas
- Models
- Prompts
- Agents
- Workflows
- Plugins
- Tools
- Tenants
- Contracts
- Versions
- Events

Managing these分散的 registry creates fragmentation and makes discovery difficult.

## Decision

We implement **Metadata Platform** as the "DNS" of the system.

### Definition:

The Metadata Platform is a central registry for all entities in BehaviorOS. It provides:
- Discovery (find any entity by name, type, or capability)
- Validation (ensure entities conform to schemas)
- Versioning (track entity versions)
- Lineage (track entity relationships)
- Health (monitor entity health)

### What is Registered:

| Entity | Metadata |
|--------|----------|
| **Capability** | Name, version, type, capabilities, dependencies, quality, access |
| **Policy** | Name, version, rules, scope, enforcement |
| **Schema** | Name, version, fields, validation rules |
| **Model** | Name, version, provider, cost, latency, capabilities |
| **Prompt** | Name, version, template, variables, model |
| **Agent** | Name, version, capabilities, permissions, health |
| **Workflow** | Name, version, steps, triggers, conditions |
| **Plugin** | Name, version, permissions, isolation, health |
| **Tool** | Name, version, parameters, permissions |
| **Tenant** | Name, plan, quota, billing, status |
| **Contract** | Name, version, fields, validation |
| **Version** | Entity, version, state, changelog |

### Special Rule:

**Metadata is READ-ONLY for all platforms.** Platforms can:
- Register their metadata
- Query their metadata
- Update their own metadata

Platforms cannot:
- Modify other platforms' metadata
- Delete other platforms' metadata
- Bypass metadata validation

## Consequences

### Positive

- Central discovery for all entities
- Consistent validation
- Version tracking
- Lineage tracking
- Health monitoring
- Simplified ecosystem

### Negative

- Single point of failure
- Performance bottleneck
- Increased complexity
- Migration from existing registries needed

### Risks

- Availability issues (mitigated by replication)
- Performance issues (mitigated by caching)
- Consistency issues (mitigated by event sourcing)

## Alternatives Considered

### Alternative 1: Distributed Registries

**Description:** Each platform maintains its own registry.

**Why Rejected:**
- Fragmented discovery
- Inconsistent validation
- No cross-platform visibility
- Complex composition

### Alternative 2: No Central Registry

**Description:** No central metadata management.

**Why Rejected:**
- No discovery
- No validation
- No versioning
- No lineage

## References

- [METADATA_SPEC.md](../METADATA_SPEC.md) — Metadata Platform specification
- [CAPABILITY_SPEC.md](../CAPABILITY_SPEC.md) — Capability specification
- [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) — Principle #8: Plugin First

---

*ADR-005: Metadata as DNS of the System — Accepted 2026-07-21*
