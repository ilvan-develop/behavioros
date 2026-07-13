---
description: Create or inspect a BehaviorOS mission
agent: build
---

Manage BehaviorOS missions. Use $ARGUMENTS to specify a mission title.

## If Arguments Provided

Create a new mission with the title: $ARGUMENTS

1. Generate a mission brief with:
   - **Title**: $ARGUMENTS
   - **Type**: Determine from context (feature, bugfix, audit, governance, learning)
   - **Priority**: Assess based on scope (high for critical, medium for standard)
   - **Description**: What needs to be accomplished
   - **Acceptance Criteria**: How to know when it's done

2. Suggest which DNA package to use (from `dnas/` directory)

3. List the agents that should be involved

## If No Arguments

Show current mission status:
1. List any missions in progress
2. Show completed missions from this session
3. Suggest next mission based on project needs

Use the BehaviorOS SDK pattern:
```typescript
import { BehaviorOS } from '@behavioros/sdk'
const bos = new BehaviorOS({ dnaPath: './dnas/enterprise-governance.yaml' })
```
