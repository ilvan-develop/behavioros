# ADR-015: Multi-Language SDK Generation

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

The current TypeScript-only SDK limits adoption across the organization and ecosystem. Engineering teams use Python for data science, Go for microservices, Rust for performance-critical components, and mobile teams use Swift and Kotlin.

## Decision

We adopt **multi-language SDK generation** from unified contract definitions:

1. **Contract Definition** — Single source of truth using Protobuf + OpenAPI + custom DSL
2. **Generator Architecture** — Template-based code generators for each target language
3. **Target Languages** — TypeScript, Python, Go, Rust, Java, C#, Swift, Kotlin
4. **CI/CD Integration** — Auto-generated SDKs published to language-specific registries (npm, PyPI, Go proxy, crates.io, Maven Central, NuGet, CocoaPods, Gradle)
5. **Versioning** — All SDK versions tied to the core platform release version

## Consequences

### Positive

- Broader adoption across polyglot organizations
- Consistent API experience across languages
- Single source of truth for contracts
- Automated publishing reduces manual effort

### Negative

- Significant generator development investment
- Template maintenance for 8 languages
- Language-specific idiom challenges in generated code
- CI/CD pipeline complexity increases substantially

### Risks

- Generated code may not feel idiomatic (mitigated by language-specific templates and reviews)
- Generator becomes a critical path dependency (mitigated by generator testing)

---

*ADR-015: Multi-Language SDK Generation — Accepted 2026-07-21*
