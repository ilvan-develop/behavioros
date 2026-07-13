---
description: Validate all DNA YAML packages against BehaviorOS schemas
agent: build
subtask: true
---

Validate all DNA YAML packages in the `dnas/` directory against BehaviorOS schemas.

## Instructions

1. List all `.yaml` and `.yml` files in the `dnas/` directory
2. For each DNA file, check:
   - Valid YAML syntax (no tabs, proper indentation)
   - Required sections present: `personas`, `governanceRules`, `qualityGates`, `patterns`, `workflows`
   - IDs are kebab-case format
   - Governance rules have valid actions (block, escalate, warn, log)
   - Quality gates have numeric thresholds
   - No duplicate IDs within a file
3. Run the BehaviorOS CLI validation if available: `npx behavioros validate`
4. Report results per file

## Output Format

For each DNA file:
- **File name**
- **Status**: Valid / Invalid / Warnings
- **Issues**: Specific problems found with line references
- **Summary**: Total files validated, pass/fail count
