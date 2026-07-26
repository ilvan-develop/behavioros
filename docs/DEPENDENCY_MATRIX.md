# BehaviorOS Dependency Matrix

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. Describes the dependency DAG for 12 packages.  
> **Last Updated:** July 2026

---

## Overview

The Dependency Matrix defines which packages can depend on which. This matrix is a **Directed Acyclic Graph (DAG)** — no circular dependencies are allowed.

Violations of this matrix are **architecture violations** and require an ADR to justify.

---

## Dependency Matrix

### Allowed Dependencies

| Package | Can Depend On |
|---------|---------------|
| `@behavioros/kernel` | Nothing |
| `@behavioros/runtime` | kernel |
| `@behavioros/execution` | kernel, runtime |
| `@behavioros/intelligence` | kernel |
| `@behavioros/cognitive` | kernel, intelligence |
| `@behavioros/knowledge` | kernel |
| `@behavioros/ai` | kernel |
| `@behavioros/governance` | kernel, knowledge |
| `@behavioros/security` | kernel |
| `@behavioros/metadata` | kernel |
| `@behavioros/integration` | kernel |
| `@behavioros/infrastructure` | kernel |

### Forbidden Dependencies (Circular Prevention)

| Package | Cannot Depend On | Reason |
|---------|------------------|--------|
| `knowledge` | `runtime` | Circular risk: runtime → knowledge → runtime |
| `cognitive` | `execution` | Circular risk: execution → cognitive → execution |
| `ai` | `governance` | Circular risk: governance → ai → governance |
| `security` | `metadata` | Circular risk: metadata → security → metadata |

### Special Rules

| Rule | Description |
|------|-------------|
| **Metadata READ-ONLY** | Metadata Platform can read from all platforms but cannot write to them |
| **Kernel is foundation** | Kernel depends on nothing — it is the root of the DAG |
| **No cross-platform** | Platforms cannot depend on each other (except allowed exceptions above) |

---

## Visual Dependency Graph

```
                    ┌─────────────────┐
                    │     kernel      │
                    │   (nothing)     │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   runtime     │   │ intelligence  │   │   knowledge   │
│   → kernel    │   │   → kernel    │   │   → kernel    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        ▼                     ▼                     │
┌───────────────┐   ┌───────────────┐              │
│   execution   │   │   cognitive   │              │
│ → kernel,     │   │ → kernel,     │              │
│   runtime     │   │  intelligence │              │
└───────────────┘   └───────────────┘              │
                                                    │
        ┌─────────────────────┼─────────────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐   ┌───────────────┐
│  governance   │   │      ai       │
│ → kernel,     │   │   → kernel    │
│   knowledge   │   └───────────────┘
└───────────────┘
        │
        ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   security    │   │   metadata    │   │  integration  │
│   → kernel    │   │   → kernel    │   │   → kernel    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ infrastructure  │
                    │    → kernel     │
                    └─────────────────┘
```

---

## Dependency Validation

### Automated Checks

```bash
# Check for circular dependencies
pnpm deps:check

# Check for forbidden dependencies
pnpm deps:validate

# Check for unused dependencies
pnpm deps:unused
```

### Manual Review

All PRs that modify `package.json` dependencies must:

1. Reference the Dependency Matrix
2. Explain why the dependency is needed
3. Confirm no circular dependency is introduced
4. Get approval from Architecture Reviewer

---

## Adding New Dependencies

### Process

1. **Propose** — Create RFC explaining the need
2. **Review** — Architecture board reviews
3. **ADR** — If approved, create ADR
4. **Implement** — Add dependency with tests
5. **Validate** — Run dependency checks

### Requirements

- Must not create circular dependency
- Must be justified by business need
- Must be documented in ADR
- Must be added to this matrix

---

## Exceptions

### Temporary Exceptions

Temporary exceptions are allowed for:

- Migration periods (max 1 major version)
- Emergency fixes (requires post-hoc ADR)
- Experimental features (requires "experimental" label)

### Permanent Exceptions

Permanent exceptions require:

- Architecture Board approval
- ADR with full justification
- Documentation in this matrix
- Quarterly review

---

## Monitoring

### Continuous Validation

- CI pipeline checks for circular dependencies
- Monthly dependency audit
- Quarterly architecture review
- Annual dependency cleanup

### Metrics

- Total dependencies per package
- Circular dependency count (target: 0)
- Forbidden dependency count (target: 0)
- Dependency depth (target: ≤3)

---

## References

- [PACKAGE_ARCHITECTURE.md](./PACKAGE_ARCHITECTURE.md) — Package structure
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — Principle #7: Dependency Inversion
- [RFC_PROCESS.md](./RFC_PROCESS.md) — How to propose changes

---

*BehaviorOS Dependency Matrix v1.0.0 — July 2026*
