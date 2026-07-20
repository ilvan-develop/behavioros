# @behavioros/sdk

> High-level TypeScript SDK for integrating BehaviorOS governance into any AI agent orchestrator

## Installation

```bash
pnpm add @behavioros/sdk @behavioros/core
```

## Quick Start

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({ dnaPath: './dnas/enterprise-governance.yaml' })
const mission = await bos.createMission({ title: 'Implement auth module', type: 'feature', priority: 'high' })
await bos.startMission(mission.id)
await bos.completeMission(mission.id, { output: { pr: '#142' } })
```

## API

| Method | Description |
|--------|-------------|
| `createMission(input)` | Create a new mission with title, type, priority, and context |
| `evaluateGovernance(action, context)` | Evaluate an action against governance rules |
| `runAudit(projectPath, stages?)` | Run the multi-stage audit pipeline |
| `recordLearning(event)` | Record a learning event with type, source, and impact |
| `getStatus()` | Get system status summary (engine, DNA, missions, agents, audits) |
| `getAllAgents()` | Get all agents filtered by role or authority |

Full API reference: [docs/SDK.md](../docs/SDK.md)

## License

MIT © Ilvan Joaquim
