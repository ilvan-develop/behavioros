# @behavioros/schemas

> Zod schemas for all BehaviorOS types — missions, agents, governance rules, quality gates, DNA packages

## Installation

```bash
pnpm add @behavioros/schemas
```

## Quick Start

```typescript
import { MissionSchema, AgentSchema, GovernanceSchema } from '@behavioros/schemas'

const mission = MissionSchema.parse({ title: 'Deploy v2.0', type: 'deployment', priority: 'critical' })
const agent = AgentSchema.parse({ id: 'agent-1', role: 'engineer', authority: 'senior' })
const rule = GovernanceSchema.parse({ id: 'require-review', name: 'Code Review Required', level: 'high', action: 'block' })
```

## API

| Export | Description |
|--------|-------------|
| `MissionSchema` | Zod schema for mission lifecycle (create, start, complete, fail) |
| `AgentSchema` | Zod schema for agent definitions (role, authority, boundaries) |
| `GovernanceRuleSchema` | Zod schema for governance rule evaluation |
| `QualityGateSchema` | Zod schema for quality thresholds (coverage, lint, typecheck, security) |
| `DNAPackageSchema` | Zod schema for complete DNA YAML package validation |
| `WorkflowSchema` | Zod schema for workflow step definitions |

## License

MIT © Ilvan Joaquim
