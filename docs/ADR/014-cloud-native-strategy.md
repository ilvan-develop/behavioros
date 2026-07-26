# ADR-014: Cloud Native Strategy

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Deployment environments vary from single-node development to multi-region production. A portable cloud-native strategy ensures BehaviorOS runs consistently across any infrastructure without vendor lock-in.

## Decision

We adopt a **Cloud Native Layer** via adapters for portability:

1. **Containerization** — Docker for consistent packaging
2. **Orchestration** — Kubernetes for container management
3. **Infrastructure as Code** — Terraform with Crossplane for cloud resources
4. **Package Management** — Helm charts for Kubernetes deployments
5. **GitOps** — ArgoCD and FluxCD adapters for declarative deployments
6. **Service Mesh** — Linkerd or Istio via adapter for traffic management

All cloud native integrations are implemented as adapters behind a `CloudProvider` interface, allowing swap between AWS, Azure, GCP, or on-premise.

## Consequences

### Positive

- Vendor-agnostic cloud deployment
- Consistent deployment experience across environments
- GitOps-enabled audit trail for infrastructure changes
- Community-standard tooling reduces learning curve

### Negative

- Complex initial setup for multi-provider support
- Adapter maintenance for each cloud provider
- Kubernetes overhead for small deployments

### Risks

- Kubernetes complexity may overwhelm small teams (mitigated by Helm abstraction)
- Adapter drift as cloud APIs evolve (mitigated by contract testing)

---

*ADR-014: Cloud Native Strategy — Accepted 2026-07-21*
