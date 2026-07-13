---
name: behavioros-governance
description: Patterns and best practices for governance rules in BehaviorOS behavioral control systems
license: MIT
compatibility: opencode
metadata:
  audience: ai-engineers, architects
  workflow: behavioros
---

## What I do

I provide guidance on designing, implementing, and reviewing governance rules for BehaviorOS. Governance rules control how autonomous AI agents make decisions and follow constraints.

## When to use me

Use this skill when:
- Designing new governance rules
- Reviewing existing governance configurations
- Understanding governance rule actions and severity
- Setting up approval thresholds
- Configuring escalation paths

## Governance Rule Actions

### block
The most severe action. Prevents the agent from executing the action entirely.
- Use for: Dangerous operations, unauthorized access, policy violations
- Example: Blocking `git push` to main branch

### escalate
Hands the decision to a higher authority (human or more senior agent).
- Use for: High-impact decisions, ambiguous situations, financial operations
- Example: Escalating a data deletion request

### warn
Allows the action but logs a warning for review.
- Use for: Deprecation notices, style violations, suboptimal patterns
- Example: Warning on unused imports

### log
Silently records the event for audit trail.
- Use for: Informational tracking, learning events, non-critical actions
- Example: Logging every file edit

## Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| `critical` | System-breaking, security risk | Immediate |
| `high` | Significant impact, needs attention | Within session |
| `medium` | Moderate impact, should be addressed | Within day |
| `low` | Minor impact, nice to fix | When convenient |

## Design Patterns

### 1. Progressive Escalation
```
warn → escalate → block (increasing severity)
```

### 2. Scope-Based Rules
Apply different rules to different personas:
```yaml
governanceRules:
  - id: "code-review"
    scope: ["reviewer"]
    action: "warn"
  - id: "code-merge"
    scope: ["lead"]
    action: "escalate"
```

### 3. Conditional Triggers
```yaml
condition: "action.type == 'delete' && action.target == 'production'"
```

## Best Practices

1. **Start permissive, tighten over time** — Begin with `log`/`warn`, escalate as needed
2. **One rule per concern** — Don't combine unrelated checks
3. **Clear conditions** — Ambiguous rules cause inconsistent behavior
4. **Audit everything** — Even `log` actions should be queryable
5. **Test governance** — Verify rules trigger correctly before deploying

## Reference Files

- `dnas/enterprise-governance.yaml` — Enterprise-grade governance rules
- `dnas/military-operations.yaml` — Strict chain-of-command governance
- `packages/core/src/engines/governance/` — Engine implementation
