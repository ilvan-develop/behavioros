---
description: Evaluate BehaviorOS governance rules and suggest improvements
agent: plan
subtask: true
---

Analyze and evaluate the BehaviorOS governance rules.

## Instructions

1. Read all DNA files in `dnas/` directory
2. Extract governance rules from each file
3. Evaluate each rule for:
   - **Clarity** — Is the condition unambiguous?
   - **Appropriateness** — Is the action proportional to the risk?
   - **Coverage** — Are critical decision points covered?
   - **Conflicts** — Do any rules contradict each other?
   - **Severity** — Is severity assigned correctly?
4. Check the governance engine implementation for supported features
5. Suggest improvements

## Output Format

### Governance Rule Inventory
List all rules found across all DNA files with:
- Rule ID, name, action, severity, scope

### Issues Found
Categorized by severity:
- **Critical** — Rules that could block legitimate actions
- **High** — Missing rules for important scenarios
- **Medium** — Rules that could be more specific
- **Low** — Style/naming improvements

### Recommendations
Specific, actionable changes with rationale

### Missing Rules
Governance gaps that should be addressed
