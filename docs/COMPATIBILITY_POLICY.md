# BehaviorOS Compatibility Policy

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. Governance spec for compatibility.  
> **Last Updated:** July 2026

---

## Overview

This policy defines the compatibility guarantees for BehaviorOS. These rules ensure safe upgrades and predictable evolution.

---

## Core Rules

### NEVER Break

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **Contracts** | Never remove fields, change types, or alter interfaces | CI validation |
| **Events** | Never remove or modify historical events | Event Store immutability |
| **Public APIs** | Never alter APIs without deprecation cycle | API versioning |
| **Security** | Never weaken security guarantees | Security review |
| **Data** | Never corrupt existing data | Data validation |

### ALWAYS Do

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **Deprecate First** | Mark as deprecated before removal (1 major version minimum) | Code review |
| **Migration Guide** | Provide migration guide for breaking changes | Documentation |
| **Backward Compatibility** | Maintain backward compatibility | Tests |
| **Document Changes** | Document all changes in CHANGELOG | Release process |

---

## Contract Compatibility

### What is a Contract

A contract is any public interface, including:

- TypeScript interfaces
- Zod schemas
- JSON Schemas
- Event schemas
- API endpoints
- CLI commands

### Contract Rules

```typescript
// ✅ ALLOWED: Adding optional field
interface Mission {
  id: string;
  title: string;
  description?: string; // New optional field
}

// ❌ FORBIDDEN: Removing field
interface Mission {
  id: string;
  // title removed — BREAKING
}

// ❌ FORBIDDEN: Changing type
interface Mission {
  id: number; // Changed from string — BREAKING
  title: string;
}
```

### Contract Evolution

```
Version 1.0.0:
interface Mission {
  id: string;
  title: string;
}

Version 1.1.0 (add optional field):
interface Mission {
  id: string;
  title: string;
  description?: string; // Added
}

Version 2.0.0 (remove field, after deprecation):
interface Mission {
  id: string;
  // title removed (was deprecated in 1.1.0)
}
```

---

## Event Compatibility

### Event Rules

Events are **immutable**. Once created, they cannot be modified.

```typescript
// ✅ ALLOWED: New event type
type BehaviorOSEvent =
  | MissionCreated
  | MissionStarted
  | CapabilityRegistered; // New event type

// ❌ FORBIDDEN: Modify existing event
type MissionCreated = {
  missionId: string;
  title: string;
  // title changed to name — BREAKING
};
```

### Event Evolution

```
Version 1.0.0:
type MissionCreated = {
  missionId: string;
  title: string;
};

Version 1.1.0 (add field):
type MissionCreated = {
  missionId: string;
  title: string;
  metadata?: Record<string, unknown>; // Added
};

Version 2.0.0 (new event, old event deprecated):
type MissionCreatedV2 = {
  missionId: string;
  name: string; // Renamed
  metadata?: Record<string, unknown>;
};

// MissionCreated still works, MissionCreatedV2 is preferred
```

---

## API Compatibility

### REST API

```
Version 1.0.0:
GET /v1/missions

Version 1.1.0:
GET /v1/missions?include=metadata  // New optional parameter

Version 2.0.0:
GET /v2/missions  // New endpoint
GET /v1/missions  // Still works (deprecated)
```

### GraphQL API

```graphql
# Version 1.0.0
type Mission {
  id: ID!
  title: String!
}

# Version 1.1.0
type Mission {
  id: ID!
  title: String!
  description: String  # Added (nullable)
}

# Version 2.0.0
type Mission {
  id: ID!
  name: String!        # Renamed
  description: String
}

# Old field still works
type Mission {
  id: ID!
  title: String! @deprecated(reason: "Use name instead")
  name: String!
}
```

---

## CLI Compatibility

### CLI Rules

```
# Version 1.0.0
behavior mission create --title "My Mission"

# Version 1.1.0
behavior mission create --title "My Mission" --description "Optional"

# Version 2.0.0
behavior mission create --name "My Mission"  # New flag
behavior mission create --title "My Mission" # Still works (deprecated)
```

---

## Migration Guide Requirements

### For Breaking Changes

Every breaking change must include:

1. **What changed** — Description of the change
2. **Why it changed** — Rationale
3. **How to migrate** — Step-by-step migration guide
4. **Timeline** — When old behavior will be removed
5. **Examples** — Before/after code examples

### Migration Guide Template

```markdown
# Migration Guide: v1.x to v2.x

## Breaking Changes

### 1. Mission.title → Mission.name

**What changed:** The `title` field was renamed to `name`.

**Why:** Consistency with other entities.

**How to migrate:**
// Before
const title = mission.title;

// After
const name = mission.name;

**Timeline:** `title` will be removed in v3.0.0.
```

---

## Compatibility Testing

### Automated Tests

```bash
# Run compatibility tests
pnpm test:compatibility

# Check for breaking changes
pnpm breaking:check

# Generate migration guide
pnpm migration:generate
```

### Test Coverage

- Contract compatibility tests
- Event compatibility tests
- API compatibility tests
- CLI compatibility tests

---

## Exceptions

### Emergency Fixes

Emergency security fixes may break compatibility if:

1. The vulnerability is critical (CVSS ≥ 9.0)
2. No backward-compatible fix exists
3. The fix is approved by Security Board
4. A post-hoc ADR is created

### Experimental Features

Experimental features may break compatibility if:

1. They are marked as "experimental"
2. They are not used in production
3. They are documented as unstable

---

## Monitoring

### Compatibility Metrics

- Breaking changes per release (target: 0)
- Deprecation count (target: decreasing)
- Migration guide completeness (target: 100%)
- Compatibility test pass rate (target: 100%)

### Reviews

- Monthly compatibility review
- Quarterly deprecation cleanup
- Annual compatibility audit

---

## References

- [VERSIONING_POLICY.md](./VERSIONING_POLICY.md) — Versioning rules
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — Principle #15: Backward Compatibility
- [COMPONENT_LIFECYCLE.md](./COMPONENT_LIFECYCLE.md) — Component lifecycle

---

*BehaviorOS Compatibility Policy v1.0.0 — July 2026*
