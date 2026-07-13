---
name: behavioros-dna
description: Guide for authoring DNA (Deoxyribonucleic Algorithm) YAML patterns for BehaviorOS behavioral governance
license: MIT
compatibility: opencode
metadata:
  audience: developers, ai-engineers
  workflow: behavioros
---

## What I do

I provide comprehensive guidance for creating and modifying DNA YAML patterns in BehaviorOS. DNA patterns define the behavioral governance for autonomous AI agent teams.

## When to use me

Use this skill when:
- Creating new DNA YAML files
- Modifying existing DNA patterns
- Understanding DNA schema structure
- Validating DNA files
- Composing multiple DNA packages

## DNA YAML Structure

Every DNA file follows this structure:

```yaml
version: "1.0"
description: "Description of this DNA package"
name: "package-name"

personas:
  - id: "persona-id"
    name: "Human Readable Name"
    description: "What this persona does"
    permissions:
      - "permission1"
      - "permission2"
    constraints:
      - "constraint1"

governanceRules:
  - id: "rule-id"
    name: "Rule Name"
    description: "What this rule controls"
    condition: "expression that triggers this rule"
    action: "block | escalate | warn | log"
    severity: "critical | high | medium | low"
    scope:
      - "persona-id"

qualityGates:
  - id: "gate-id"
    name: "Gate Name"
    description: "What quality this gate checks"
    metric: "metric_name"
    threshold: 80
    operator: "gte | lte | eq | gt | lt"

patterns:
  - id: "pattern-id"
    name: "Pattern Name"
    description: "Reusable behavioral pattern"
    steps:
      - action: "step description"
        persona: "persona-id"

workflows:
  - id: "workflow-id"
    name: "Workflow Name"
    description: "Step-by-step process"
    steps:
      - name: "Step 1"
        action: "what to do"
        persona: "who does it"
        depends_on: []
```

## Key Rules

1. **IDs must be kebab-case** — `my-rule` not `myRule` or `MyRule`
2. **All sections are required** — Even if empty (use `[]`)
3. **Governance actions must be valid** — Only: `block`, `escalate`, `warn`, `log`
4. **Severity must be valid** — Only: `critical`, `high`, `medium`, `low`
5. **Operators must be valid** — Only: `gte`, `lte`, `eq`, `gt`, `lt`
6. **Use tabs sparingly** — YAML best practice is 2-space indentation

## Reference Files

Read these DNA files for style and pattern examples:
- `dnas/enterprise-governance.yaml` — Full enterprise governance setup
- `dnas/military-operations.yaml` — Chain of command patterns
- `dnas/surgical-team.yaml` — Zero-defect patterns
- `dnas/lean-factory.yaml` — Continuous improvement patterns

## Validation

Always validate DNA files after creation:
```bash
npx behavioros validate
# Or check YAML syntax manually
```
