# BehaviorOS RFC Process

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. RFC process for the architecture.  
> **Last Updated:** July 2026

---

## Overview

RFC (Request for Comments) is the formal process for proposing changes to BehaviorOS. This process ensures that all significant changes are discussed, reviewed, and documented before implementation.

Inspired by: Kubernetes Enhancement Proposals (KEPs), Rust RFCs, Cloud Native RFCs.

---

## When to Use RFC

### Required for:

- New features
- Architectural changes
- Breaking changes
- New packages
- New platforms
- New enterprise services
- Protocol changes
- Security changes

### Not Required for:

- Bug fixes
- Documentation updates
- Test improvements
- Performance optimizations (non-breaking)
- Refactoring (non-breaking)

---

## RFC Lifecycle

```
Draft → Review → Accepted → Implemented → Completed
```

### States

| State | Description | Duration |
|-------|-------------|----------|
| **Draft** | Initial proposal | Until ready for review |
| **Review** | Community review | Min 2 weeks |
| **Accepted** | Approved by architecture board | Until implementation |
| **Implemented** | Code merged | Until release |
| **Completed** | Released | Permanent |

---

## RFC Template

```markdown
# RFC-NNNN: Title

**Status:** Draft  
**Author:** Name  
**Created:** YYYY-MM-DD  
**Updated:** YYYY-MM-DD  

---

## Summary

One paragraph explanation.

## Motivation

Why are we doing this? What problem does it solve?

## Detailed Design

How does it work? Be specific.

## Alternatives

What other approaches were considered?

## Compatibility

Is this a breaking change? Migration guide?

## Security

Any security implications?

## Performance

Any performance implications?

## Testing

How will this be tested?

## Rollout

How will this be rolled out?

## References

Links to related RFCs, ADRs, issues.
```

---

## RFC Process

### 1. Create RFC

```bash
# Create RFC from template
pnpm rfc:create "Title of RFC"

# Creates: docs/RFC/0001-title-of-rfc.md
```

### 2. Write RFC

- Fill out all sections
- Be specific and detailed
- Include examples
- Consider edge cases

### 3. Submit for Review

```bash
# Submit RFC
pnpm rfc:submit 0001
```

### 4. Community Review

- Min 2 weeks review period
- Address feedback
- Update RFC as needed
- Get 2 approvals from maintainers

### 5. Architecture Board Review

- Architecture board reviews
- Decision: Accept, Reject, or Defer
- If accepted, create ADR

### 6. Implementation

- Implement RFC
- Write tests
- Update documentation
- Update CHANGELOG

### 7. Completion

- Release with RFC
- Mark RFC as completed
- Archive RFC

---

## RFC Numbering

RFCs are numbered sequentially:

```
RFC-0001: First RFC
RFC-0002: Second RFC
RFC-0003: Third RFC
```

Numbers are never reused, even if RFCs are rejected.

---

## RFC Directory Structure

```
docs/RFC/
├── 0001-event-sourcing.md
├── 0002-cqrs-adoption.md
├── 0003-capability-unification.md
├── ...
└── TEMPLATE.md
```

---

## Review Guidelines

### For Reviewers

- Focus on architecture, not style
- Consider edge cases
- Consider security implications
- Consider performance implications
- Consider backward compatibility
- Provide constructive feedback

### For Authors

- Respond to all feedback
- Update RFC based on feedback
- Explain design decisions
- Be open to alternatives

---

## Decision Making

### Accept

- RFC is approved
- ADR is created
- Implementation can begin

### Reject

- RFC is not approved
- Reasons documented
- Can be resubmitted with changes

### Defer

- RFC needs more discussion
- Revisit in future
- Additional research needed

---

## References

- [ARCHITECTURE_DECISION_PROCESS.md](./ARCHITECTURE_DECISION_PROCESS.md) — ADR process
- [CONTRIBUTING.md](./CONTRIBUTING.md) — How to contribute
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — Architecture principles

---

*BehaviorOS RFC Process v1.0.0 — July 2026*
