# ADR-016: API Gateway Adapters

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

API gateways are a mature market with battle-tested solutions (Kong, Traefik, Envoy, NGINX, Azure APIM, AWS Gateway). Building a custom API gateway would be unnecessary engineering that diverts resources from core differentiators.

## Decision

We define a `GatewayAdapter` interface and implement adapters for existing solutions:

```typescript
interface GatewayAdapter {
  registerRoute(route: RouteConfig): Promise<void>
  deregisterRoute(routeId: string): Promise<void>
  authenticate(request: AuthRequest): Promise<AuthResult>
  rateLimit(clientId: string): Promise<RateLimitResult>
  getMetrics(): Promise<GatewayMetrics>
}
```

Supported adapters:
1. **Kong** — Enterprise-grade with plugin ecosystem
2. **Traefik** — Cloud-native with automatic HTTPS
3. **Envoy** — High-performance sidecar proxy
4. **NGINX** — Lightweight and widely adopted
5. **Azure APIM** — Azure ecosystem integration
6. **AWS Gateway** — AWS ecosystem integration

## Consequences

### Positive

- Swap gateways without code changes
- Leverage best-in-class gateway features
- Reduced engineering cost vs building custom gateway
- Deployment environment flexibility

### Negative

- Adapter maintenance for each gateway provider
- Feature parity gaps between gateway implementations
- Configuration complexity from abstraction layer

### Risks

- Gateway-specific features inaccessible through generic interface (mitigated by extension points)
- Performance overhead from adapter layer (mitigated by direct passthrough for hot paths)

---

*ADR-016: API Gateway Adapters — Accepted 2026-07-21*
