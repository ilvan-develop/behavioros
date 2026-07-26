# ADR-011: 4-Level Architecture

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

As the platform grows, clear boundaries between native capabilities, integrated services, and external products become critical for dependency management, versioning, and team ownership.

## Decision

We adopt a **4-level architecture** with strict dependency direction:

```
Level 1: Kernel (native)
  ↓ depends on
Level 2: Cognitive Platforms (native)
  ↓ depends on
Level 3: Enterprise Services (adapters)
  ↓ depends on
Level 4: Ecosystem (external products)
```

1. **Kernel** — Core runtime: Event Store, Governance Engine, DNA Compiler, Pipeline Dispatcher, Schema Engine. No external dependencies.
2. **Cognitive Platforms** — Intelligence layer: Knowledge Fabric, Digital Twin, Orchestrator, Learning Engine, Mission Engine. Depends only on Kernel.
3. **Enterprise Services** — Integration layer: Adapters for Kafka, K8s, Kong, Vault, MLflow, etc. Depends on Kernel + Cognitive Platforms.
4. **Ecosystem** — External products and plugins built on top of Enterprise Services.

## Consequences

### Positive

- Strict dependency boundaries prevent circular dependencies
- Clear team ownership for each level
- Independent versioning and release cycles per level
- Flexible evolution — each level can change independently

### Negative

- Cross-level feature requests require coordination
- Lower levels cannot use higher-level abstractions
- Initial overhead in defining level boundaries

### Risks

- Level boundary violations (mitigated by architectural linting)
- Performance overhead from cross-level calls (mitigated by in-process optimization)

---

*ADR-011: 4-Level Architecture — Accepted 2026-07-21*
