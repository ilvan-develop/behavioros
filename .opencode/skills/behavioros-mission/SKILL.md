---
name: behavioros-mission
description: Guide for managing mission lifecycle in BehaviorOS autonomous AI agent teams
license: MIT
compatibility: opencode
metadata:
  audience: ai-engineers, project-managers
  workflow: behavioros
---

## What I do

I provide guidance for creating, managing, and tracking missions in BehaviorOS. Missions are the primary unit of work that autonomous AI agent teams execute.

## When to use me

Use this skill when:
- Creating new missions
- Starting or resuming missions
- Updating mission progress
- Completing or failing missions
- Assigning agents to missions
- Tracking mission status

## Mission Lifecycle

```
created → in_progress → completed | failed
```

### States

| State | Description | Allowed Transitions |
|-------|-------------|---------------------|
| `created` | Mission defined, not started | → `in_progress` |
| `in_progress` | Actively being worked on | → `completed`, `failed` |
| `completed` | Finished successfully | Terminal state |
| `failed` | Could not be completed | Terminal state |

## Mission Properties

```typescript
interface Mission {
  id: string           // Auto-generated UUID
  title: string        // Human-readable name
  type: MissionType    // 'feature' | 'bugfix' | 'audit' | 'governance' | 'learning'
  priority: Priority   // 'critical' | 'high' | 'medium' | 'low'
  status: MissionStatus
  agents: string[]     // Assigned agent IDs
  dna: string          // DNA package path
  progress: number     // 0-100 percentage
  createdAt: Date
  updatedAt: Date
}
```

## Creating Missions

### Via SDK
```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({
  dnaPath: './dnas/enterprise-governance.yaml'
})

const mission = await bos.createMission({
  title: 'Implement payment module',
  type: 'feature',
  priority: 'high',
})
```

### Via MCP Server
The MCP server exposes `create_mission` tool with the same parameters.

## Mission Patterns

### Single-Agent Mission
One agent completes the entire mission independently.
```
Agent A → Task 1 → Task 2 → Task 3 → Complete
```

### Multi-Agent Parallel
Agents work on different tasks simultaneously.
```
Agent A → Task 1 ↘
Agent B → Task 2 → Merge → Complete
Agent C → Task 3 ↗
```

### Sequential Handoff
Agents work in dependency order.
```
Agent A → Task 1 → Agent B → Task 2 → Agent C → Task 3 → Complete
```

### Voting Consensus
Multiple agents vote on decisions.
```
Agent A votes YES ↘
Agent B votes YES → Consensus → Proceed
Agent C votes NO  ↗
```

## Mission Types

| Type | Description | Typical Duration |
|------|-------------|------------------|
| `feature` | New functionality | Hours to days |
| `bugfix` | Fix existing issues | Minutes to hours |
| `audit` | Quality/security review | Minutes |
| `governance` | Rule evaluation/update | Minutes to hours |
| `learning` | Pattern detection/improvement | Ongoing |

## Best Practices

1. **Clear titles** — Describe what will be accomplished
2. **Appropriate type** — Choose the most specific type
3. **Honest priority** — Don't mark everything as critical
4. **Regular updates** — Update progress at milestones
5. **Document outcomes** — Record what was learned

## Reference Files

- `packages/core/src/engines/mission/` — Mission engine implementation
- `packages/sdk/src/` — BehaviorOS SDK API
- `dnas/` — DNA patterns for mission governance
