# ADR-012: Integration Platform

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Connecting external systems is a universal requirement that cuts across all platform levels. Without a dedicated integration platform, each adapter would reinvent connection, authentication, retry, and observability logic.

## Decision

We create an **Integration Platform** as the unified surface for external system connectivity:

1. **Adapters** — Protocol-level integrations: Kafka, RabbitMQ, NATS, Redis Streams
2. **Connectors** — API-level integrations: REST, gRPC, GraphQL, MCP, A2A (Agent-to-Agent)
3. **Webhooks** — Event-driven outbound notifications
4. **OAuth Layer** — Unified authentication and token management

All adapters and connectors implement a common `IntegrationInterface` with built-in retry, circuit breaking, observability, and health checking.

## Consequences

### Positive

- Single integration surface for all external connectivity
- Consistent authentication, retry, and observability
- Adapter isolation — one adapter failure doesn't affect others
- Pluggable architecture — add new protocols without core changes

### Negative

- Integration Platform becomes a critical dependency
- Configuration complexity for multi-adapter setups
- Performance overhead from the abstraction layer

### Risks

- Adapter vendor lock-in if interface is too specific (mitigated by generic interface design)
- Security surface area increases with each adapter (mitigated by OAuth layer and audit)

---

*ADR-012: Integration Platform — Accepted 2026-07-21*
