# BehaviorOS Architecture Decision Process

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. ADR process for the architecture.  
> **Last Updated:** July 2026

---

## Overview

Architecture Decision Records (ADRs) document important architectural decisions. They capture the context, decision, and consequences of each decision, creating a historical record of the architecture.

Inspired by: Michael Nygard's ADR process, Kubernetes ADRs.

---

## When to Use ADR

### Required for:

- Architectural decisions
- Technology choices
- Pattern selections
- Breaking changes
- Security decisions
- Performance decisions
- Integration decisions

### Not Required for:

- Implementation details
- Bug fixes
- Documentation updates
- Test improvements

---

## ADR Lifecycle

```
Proposed → Accepted → Deprecated → Superseded
```

### States

| State | Description |
|-------|-------------|
| **Proposed** | Under review |
| **Accepted** | Approved and active |
| **Deprecated** | No longer recommended |
| **Superseded** | Replaced by another ADR |

---

## ADR Template

```markdown
# ADR-NNNN: Title

**Status:** Proposed  
**Date:** YYYY-MM-DD  
**Deciders:** List of people involved  

---

## Context

What is the issue that motivates this decision?

## Decision

What is the change being proposed?

## Consequences

### Positive

- Benefit 1
- Benefit 2

### Negative

- Drawback 1
- Drawback 2

### Risks

- Risk 1
- Risk 2

## Alternatives Considered

### Alternative 1

Description and why it was rejected.

### Alternative 2

Description and why it was rejected.

## References

Links to related RFCs, issues, documentation.
```

---

## ADR Process

### 1. Create ADR

```bash
# Create ADR from template
pnpm adr:create "Title of ADR"

# Creates: docs/ADR/0001-title-of-adr.md
```

### 2. Write ADR

- Fill out all sections
- Be specific about context
- Document the decision clearly
- List all consequences
- Consider alternatives

### 3. Submit for Review

```bash
# Submit ADR
pnpm adr:submit 0001
```

### 4. Review

- Architecture board reviews
- Address feedback
- Update ADR as needed

### 5. Decision

- Accept: ADR becomes active
- Reject: ADR is rejected (number not reused)
- Defer: ADR needs more discussion

### 6. Implementation

- Implement decision
- Update documentation
- Link ADR in code

### 7. Maintenance

- Review ADRs quarterly
- Deprecate outdated ADRs
- Supersede with new ADRs

---

## ADR Numbering

ADRs are numbered sequentially:

```
ADR-0001: First decision
ADR-0002: Second decision
ADR-0003: Third decision
```

Numbers are never reused, even if ADRs are rejected.

---

## ADR Directory Structure

```
docs/ADR/
├── 0001-event-sourcing.md
├── 0002-cqrs-adoption.md
├── 0003-event-mesh.md
├── 0004-capability-unification.md
├── 0005-metadata-as-dns.md
├── 0006-execution-isolation.md
├── 0007-hierarchical-planning.md
├── 0008-ai-resource-manager.md
├── ...
└── TEMPLATE.md
```

---

## Decision Quality

### Good Decisions Have:

- Clear context
- Specific decision
- All consequences documented
- Alternatives considered
- Risks identified
- Measurable outcomes

### Bad Decisions Have:

- Vague context
- Unclear decision
- Missing consequences
- No alternatives considered
- Risks ignored
- No measurable outcomes

---

## Decision Making

### Accept

- Decision is approved
- ADR becomes active
- Implementation can begin

### Reject

- Decision is not approved
- Reasons documented
- Number not reused

### Defer

- Decision needs more discussion
- Revisit in future
- Additional research needed

---

## Superseding ADRs

When a new decision replaces an old one:

1. Create new ADR
2. Reference old ADR
3. Mark old ADR as "Superseded by ADR-NNNN"
4. Old ADR is preserved for history

---

## References

- [RFC_PROCESS.md](./RFC_PROCESS.md) — RFC process
- [CONTRIBUTING.md](./CONTRIBUTING.md) — How to contribute
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — Architecture principles

---

*BehaviorOS Architecture Decision Process v1.0.0 — July 2026*
