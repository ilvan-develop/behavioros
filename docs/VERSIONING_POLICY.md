# BehaviorOS Versioning Policy

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. Governance spec for versioning.  
> **Last Updated:** July 2026

---

## Overview

BehaviorOS follows **Semantic Versioning (SemVer 2.0.0)** for all packages, APIs, and protocols. This policy ensures predictable evolution and safe upgrades.

---

## Version Format

```
MAJOR.MINOR.PATCH

Examples:
1.0.0   → Initial stable release
1.1.0   → New feature (backward compatible)
1.1.1   → Bug fix (backward compatible)
2.0.0   → Breaking change
```

---

## Versioning Rules

### MAJOR Version (X.0.0)

Increment MAJOR when:

- Breaking change to public API
- Breaking change to event schema
- Breaking change to contract interface
- Removal of deprecated feature
- Change in protocol behavior

**Examples:**
- Removing a field from an event
- Changing a function signature
- Modifying a contract interface
- Changing security behavior

### MINOR Version (0.X.0)

Increment MINOR when:

- New feature added (backward compatible)
- New event type added
- New contract interface added
- New capability added
- Performance improvement (no API change)

**Examples:**
- Adding a new engine
- Adding a new event type
- Adding a new API endpoint
- Adding a new capability

### PATCH Version (0.0.X)

Increment PATCH when:

- Bug fix (no API change)
- Documentation update
- Test improvement
- Internal refactoring (no API change)
- Security patch (no API change)

**Examples:**
- Fixing a bug in an engine
- Updating documentation
- Adding tests
- Fixing a security vulnerability

---

## What is Versioned

### Packages

| Package | Version | Notes |
|---------|---------|-------|
| `@behavioros/kernel` | SemVer | Core package |
| `@behavioros/runtime` | SemVer | Runtime package |
| `@behavioros/execution` | SemVer | Execution package |
| `@behavioros/intelligence` | SemVer | Intelligence package |
| `@behavioros/cognitive` | SemVer | Cognitive package |
| `@behavioros/knowledge` | SemVer | Knowledge package |
| `@behavioros/ai` | SemVer | AI package |
| `@behavioros/governance` | SemVer | Governance package |
| `@behavioros/security` | SemVer | Security package |
| `@behavioros/metadata` | SemVer | Metadata package |
| `@behavioros/integration` | SemVer | Integration package |
| `@behavioros/infrastructure` | SemVer | Infrastructure package |
| `@behavioros/schemas` | SemVer | Schemas package |
| `@behavioros/sdk` | SemVer | SDK package |
| `@behavioros/cli` | SemVer | CLI package |
| `@behavioros/mcp-server` | SemVer | MCP Server package |

### APIs

| API | Version | Notes |
|-----|---------|-------|
| REST API | `/v1/`, `/v2/` | URL-based versioning |
| GraphQL API | Schema version | Schema-based versioning |
| MCP API | Protocol version | Protocol-based versioning |
| gRPC API | Package version | Proto-based versioning |

### Events

| Event | Version | Notes |
|-------|---------|-------|
| All events | Event version field | Immutable, append-only |

### Contracts

| Contract | Version | Notes |
|----------|---------|-------|
| TypeScript interfaces | Package version | Interface-based versioning |
| Zod schemas | Schema version | Schema-based versioning |
| JSON Schemas | Schema version | Schema-based versioning |

---

## Deprecation Policy

### Deprecation Process

1. **Mark as deprecated** — Add `@deprecated` annotation
2. **Document migration** — Provide migration guide
3. **Maintain for 1 major version** — Keep deprecated feature working
4. **Remove** — Remove in next major version

### Deprecation Timeline

```
Version N:   Feature marked as deprecated
Version N+1: Feature still works (with warning)
Version N+2: Feature removed
```

### Deprecation Examples

```typescript
/**
 * @deprecated Use `newMethod()` instead. Will be removed in v2.0.0.
 * @see Migration guide: https://docs.behavioros.dev/migrate/v1-to-v2
 */
function oldMethod(): void {
  // ... implementation
}
```

---

## Breaking Changes

### What is a Breaking Change

- Removing a field from an event
- Changing a function signature
- Modifying a contract interface
- Changing security behavior
- Changing default behavior
- Removing an API endpoint
- Changing error handling

### What is NOT a Breaking Change

- Adding a new field to an event (optional)
- Adding a new function
- Adding a new API endpoint
- Adding a new optional parameter
- Fixing a bug (correcting behavior)
- Improving performance

### Breaking Change Process

1. **RFC** — Propose breaking change via RFC
2. **ADR** — Create ADR documenting decision
3. **Deprecation** — Mark old behavior as deprecated
4. **Migration Guide** — Provide migration guide
5. **Major Version** — Release in next major version

---

## Release Channels

| Channel | Version Format | Stability | Purpose |
|---------|---------------|-----------|---------|
| **Nightly** | `1.0.0-nightly.YYYYMMDD` | Unstable | Testing |
| **Beta** | `1.0.0-beta.1` | Experimental | Preview |
| **Stable** | `1.0.0` | Stable | Production |
| **LTS** | `1.0.0-lts` | Long-term | Enterprise |

### Channel Rules

- **Nightly:** Built from `main` branch daily
- **Beta:** Built from `release/*` branches
- **Stable:** Built from `v*` tags
- **LTS:** Selected stable releases, supported for 2 years

---

## Version Bumping

### Automated Bumping

```bash
# Bump patch version
pnpm version:patch

# Bump minor version
pnpm version:minor

# Bump major version
pnpm version:major
```

### Manual Bumping

1. Update `package.json` version
2. Update `CHANGELOG.md`
3. Create git tag
4. Push to remote

---

## Compatibility Matrix

| Version A | Version B | Compatible |
|-----------|-----------|------------|
| 1.0.0 | 1.0.1 | ✅ Yes |
| 1.0.0 | 1.1.0 | ✅ Yes |
| 1.0.0 | 2.0.0 | ❌ No |
| 1.0.0 | 1.0.0-beta | ❌ No |

---

## References

- [COMPATIBILITY_POLICY.md](./COMPATIBILITY_POLICY.md) — Compatibility rules
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — Principle #15: Backward Compatibility
- [RELEASE_PROCESS.md](./RELEASE_PROCESS.md) — Release process

---

*BehaviorOS Versioning Policy v1.0.0 — July 2026*
