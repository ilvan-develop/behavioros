# ADR-020: Capability Marketplace

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Capabilities — the platform's extensibility units — need a distribution channel for discovery, installation, and lifecycle management. Without a Marketplace, capabilities remain siloed, unversioned, and difficult to share across teams and organizations.

## Decision

We build a **Capability Marketplace** as the distribution platform:

1. **Publishing** — Capability authors package and publish with metadata, versioning, and signatures
2. **Discovery** — Search, browse, and filter capabilities by category, tags, ratings, and compatibility
3. **Installation** — One-command installation with automatic dependency resolution
4. **Versioning** — Semantic versioning with migration support and rollback
5. **Ratings & Reviews** — Community feedback for quality signals
6. **Dependency Resolution** — Automatic resolution of capability dependencies with conflict detection
7. **Security Scanning** — Automated vulnerability scanning before publication

## Consequences

### Positive

- Ecosystem growth through community contributions
- Reduced duplication — share capabilities across teams
- Versioned distribution with safe upgrades
- Quality signals through ratings and security scanning

### Negative

- Marketplace moderation and curation overhead
- Dependency resolution complexity with transitive dependencies
- Security risk from malicious capabilities (mitigated by scanning and signing)

### Risks

- Low adoption if marketplace lacks critical mass (mitigated by seeding with first-party capabilities)
- Governance challenges with third-party contributions (mitigated by review and rating system)

---

*ADR-020: Capability Marketplace — Accepted 2026-07-21*
