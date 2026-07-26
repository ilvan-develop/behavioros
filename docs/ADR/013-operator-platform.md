# ADR-013: Operator Platform

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Production operations — auto-healing, scaling, restart, self-upgrade, diagnostics — require dedicated tooling that differs fundamentally from developer workflows. Mixing operator concerns with developer tools creates confusion, security risks, and role pollution.

## Decision

We create a dedicated **Operator Platform** separate from the Developer Platform:

1. **Auto-Healing** — Automatic detection and recovery from failures
2. **Auto-Scaling** — Horizontal and vertical scaling based on metrics
3. **Restart Manager** — Graceful restart of services and engines
4. **Self-Upgrade** — Rolling upgrades with health checks
5. **Diagnostics Engine** — Health checks, logging, tracing, metrics
6. **Incident Manager** — Alert routing, escalation, runbook automation

The Operator Platform exposes a CLI (`bosctl`) and API with RBAC scoped to operations personnel.

## Consequences

### Positive

- Role-based separation of concerns (developer vs operator)
- Operations tooling optimized for SRE workflows
- Reduced attack surface — operator tools not exposed to developers
- Better incident response with dedicated tooling

### Negative

- Duplication of some tooling concerns with Developer Platform
- Additional platform to maintain and deploy
- Cross-platform coordination overhead for shared resources

### Risks

- Operator platform drift from platform reality (mitigated by shared health check contracts)
- Insufficient adoption if developer platform already meets basic needs

---

*ADR-013: Operator Platform — Accepted 2026-07-21*
