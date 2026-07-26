# ADR-010: Build vs Integrate

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Every platform faces the build-vs-buy tension. Building everything in-house provides maximum control but drains engineering capacity. Integrating existing solutions accelerates delivery but introduces vendor dependency and integration complexity.

## Decision

We adopt a **tiered strategy**:

1. **Kernel (native)** — Build in-house: Event Store, Governance Engine, DNA Compiler, Pipeline Dispatcher, Mission Engine, Memory Engine. These are core differentiators.
2. **Cognitive Platforms (native)** — Build in-house: Knowledge Fabric, Digital Twin, Orchestrator, Learning Engine. These define the platform's cognitive capabilities.
3. **Enterprise Services (adapters)** — Integrate via adapters: Kafka, Kubernetes, Kong, Vault, MLflow, Prometheus, Grafana, ArgoCD, FluxCD. Adapter pattern provides abstraction without lock-in.

## Consequences

### Positive

- Engineering focus on differentiating capabilities
- Reduced development cost by leveraging mature solutions
- Vendor independence through adapter abstraction layer
- Faster time-to-market for enterprise integrations

### Negative

- Adapter maintenance burden for each integrated service
- Breaking changes in upstream projects require adapter updates
- Integration testing complexity increases with each adapter

### Risks

- Adapter drift as upstream APIs evolve (mitigated by contract testing)
- Over-reliance on specific vendors (mitigated by adapter abstraction)
- Build vs integrate decisions may need revisiting as ecosystem matures

---

*ADR-010: Build vs Integrate — Accepted 2026-07-21*
