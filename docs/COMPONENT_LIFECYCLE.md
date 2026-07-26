# BehaviorOS Component Lifecycle

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. Describes the 6-state component lifecycle.  
> **Last Updated:** July 2026

---

## Overview

Every component in BehaviorOS follows a defined lifecycle. This lifecycle ensures consistent evolution, quality, and deprecation.

---

## Lifecycle States

```
Draft → Experimental → Beta → Stable → Deprecated → Archived
```

### State Definitions

| State | Description | API Stability | Support Level | Production Ready |
|-------|-------------|---------------|---------------|------------------|
| **Draft** | Internal discussion, no implementation | None | None | ❌ No |
| **Experimental** | Available, API may change | None | Best effort | ❌ No |
| **Beta** | Feature complete, API stabilizing | Partial | Standard | ⚠️ Limited |
| **Stable** | Production-ready, full API stability | Full | Full | ✅ Yes |
| **Deprecated** | Scheduled for removal | Frozen | Maintenance | ⚠️ Migration required |
| **Archived** | Removed, documentation preserved | None | None | ❌ No |

---

## State Transitions

### Draft → Experimental

**Requirements:**
- [ ] RFC approved
- [ ] ADR created
- [ ] Initial implementation
- [ ] Basic tests

**Process:**
1. Create RFC with proposal
2. Get architecture review
3. Create ADR
4. Implement initial version
5. Add basic tests
6. Mark as experimental

### Experimental → Beta

**Requirements:**
- [ ] All planned features implemented
- [ ] API documentation complete
- [ ] Unit tests ≥ 80% coverage
- [ ] Integration tests for key flows
- [ ] No known critical bugs

**Process:**
1. Complete all planned features
2. Write API documentation
3. Achieve test coverage target
4. Fix all critical bugs
5. Get code review approval
6. Mark as beta

### Beta → Stable

**Requirements:**
- [ ] All planned features implemented
- [ ] API documentation complete
- [ ] Unit tests ≥ 90% coverage
- [ ] Integration tests for all flows
- [ ] Performance benchmarks meet SLA
- [ ] Security review passed
- [ ] No known critical or high bugs
- [ ] ADR for all architectural decisions
- [ ] Migration guide (if applicable)

**Process:**
1. Complete all planned features
2. Write comprehensive documentation
3. Achieve test coverage target
4. Run performance benchmarks
5. Complete security review
6. Fix all critical and high bugs
7. Create ADRs
8. Write migration guide
9. Get architecture board approval
10. Mark as stable

### Stable → Deprecated

**Requirements:**
- [ ] Deprecation reason documented
- [ ] Migration guide provided
- [ ] Alternative recommended
- [ ] Timeline for removal set

**Process:**
1. Document deprecation reason
2. Write migration guide
3. Recommend alternative
4. Set removal timeline
5. Add deprecation warnings
6. Mark as deprecated

### Deprecated → Archived

**Requirements:**
- [ ] Removal timeline reached
- [ ] No active users (verified)
- [ ] Documentation preserved
- [ ] Changelog updated

**Process:**
1. Verify no active users
2. Preserve documentation
3. Remove implementation
4. Update changelog
5. Mark as archived

---

## State Behaviors

### Draft

- Internal only, not published
- API may change without notice
- No support guarantees
- No documentation required

### Experimental

- Published but not recommended for use
- API may change without notice
- Best-effort support
- Basic documentation required

### Beta

- Published and available for testing
- API may change with notice
- Standard support
- Full documentation required

### Stable

- Published and recommended for production
- API stable (semver)
- Full support
- Full documentation required

### Deprecated

- Published but not recommended
- API frozen (no changes)
- Maintenance only
- Migration guide required

### Archived

- Removed from packages
- Documentation preserved
- No support
- Changelog entry required

---

## Quality Gates per State

### Draft

- [ ] RFC approved
- [ ] ADR created

### Experimental

- [ ] Initial implementation
- [ ] Basic tests
- [ ] Basic documentation

### Beta

- [ ] All features implemented
- [ ] API documentation
- [ ] Unit tests ≥ 80%
- [ ] Integration tests
- [ ] No critical bugs

### Stable

- [ ] All features implemented
- [ ] Full documentation
- [ ] Unit tests ≥ 90%
- [ ] Integration tests (all flows)
- [ ] Performance benchmarks
- [ ] Security review
- [ ] No critical/high bugs
- [ ] ADRs
- [ ] Migration guide

### Deprecated

- [ ] Deprecation reason
- [ ] Migration guide
- [ ] Alternative recommended
- [ ] Removal timeline

### Archived

- [ ] No active users
- [ ] Documentation preserved
- [ ] Changelog updated

---

## Metadata Registration

Every component must register its state in the Metadata Platform:

```typescript
interface ComponentMetadata {
  name: string;
  version: string;
  state: 'draft' | 'experimental' | 'beta' | 'stable' | 'deprecated' | 'archived';
  since: string; // ISO date
  deprecatedAt?: string; // ISO date
  archivedAt?: string; // ISO date
  removalTimeline?: string; // ISO date
  migrationGuide?: string; // URL
}
```

---

## Monitoring

### Lifecycle Metrics

- Components per state (target: mostly stable)
- Time in each state (target: decreasing)
- Deprecated components (target: 0)
- Archived components (target: increasing)

### Reviews

- Monthly lifecycle review
- Quarterly deprecation cleanup
- Annual lifecycle audit

---

## References

- [CAPABILITY_LIFECYCLE.md](./CAPABILITY_LIFECYCLE.md) — Capability lifecycle
- [QUALITY_GATES.md](./QUALITY_GATES.md) — Quality requirements
- [RFC_PROCESS.md](./RFC_PROCESS.md) — RFC process

---

*BehaviorOS Component Lifecycle v1.0.0 — July 2026*
