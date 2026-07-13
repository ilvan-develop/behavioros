# BehaviorOS SDK

TypeScript SDK for integrating with AI agent orchestrators.

## Installation

```bash
pnpm add @behavioros/sdk @behavioros/core
```

## Quick Start

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({
  dnaPath: './dnas/enterprise-governance.yaml',
})

const mission = await bos.createMission({
  title: 'Implement auth module',
  type: 'feature',
  priority: 'high',
})

await bos.startMission(mission.id)
await bos.completeMission(mission.id, { output: { pr: '#142' } })
```

## Configuration

```typescript
interface BehaviorOSConfig {
  // Path to DNA YAML file
  dnaPath?: string

  // Or provide DNA package directly
  dnaPackage?: DNAPackage

  // DNALoader options
  dnaLoaderOptions?: DNALoaderOptions

  // Engine configurations
  governance?: {
    enabled: boolean
    level?: 'strict' | 'standard' | 'minimal'
    requireApproval?: boolean
    maxAgents?: number
  }

  quality?: {
    enabled: boolean
    minCoverage?: number
    enforceTypecheck?: boolean
    enforceLint?: boolean
  }

  learning?: {
    enabled: boolean
    persistPath?: string
    autoApply?: boolean
  }

  audit?: {
    enabled: boolean
  }

  // Output directory for reports
  outputDir?: string
}
```

## API Reference

### `BehaviorOS`

#### Constructor

```typescript
new BehaviorOS(config?: BehaviorOSConfig)
```

#### `init()`

Initialize the engine (auto-called if DNA is provided in constructor).

```typescript
await bos.init()
```

#### `loadDNA(path: string)`

Load a DNA package from a YAML file path.

```typescript
bos.loadDNA('./dnas/military-operations.yaml')
```

#### `createMission(input)`

Create a new mission.

```typescript
const mission = await bos.createMission({
  title: 'Deploy v2.0',
  type: 'deployment',
  priority: 'critical',
  context: { environment: 'production' },
})
```

#### `startMission(missionId: string)`

Transition a mission to `in_progress`.

```typescript
await bos.startMission(mission.id)
```

#### `completeMission(missionId: string, output?)`

Mark a mission as completed.

```typescript
await bos.completeMission(mission.id, {
  output: { deployUrl: 'https://app.example.com' },
})
```

#### `failMission(missionId: string, error: Error)`

Mark a mission as failed.

```typescript
await bos.failMission(mission.id, new Error('Deploy failed'))
```

#### `getMission(id: string)`

Get a mission by ID.

```typescript
const mission = bos.getMission('mission-123')
```

#### `getAllMissions()`

Get all missions.

```typescript
const missions = bos.getAllMissions()
```

#### `getAllAgents()`

Get all agents in the system.

```typescript
const agents = bos.getAllAgents()
```

#### `getAgentsByRole(role: string)`

Get agents filtered by role.

```typescript
const engineers = bos.getAgentsByRole('engineer')
```

#### `evaluateGovernance(action, context)`

Evaluate an action against governance rules.

```typescript
const result = await bos.evaluateGovernance('deploy-production', {
  type: 'deployment',
  agent: 'devops',
})

// result: { approved: boolean, violations: string[], warnings: string[] }
```

#### `evaluateGovernanceDetailed(context)`

Full governance evaluation with detailed reasoning.

```typescript
const decision = await bos.evaluateGovernanceDetailed({
  action: 'deploy',
  agentRole: 'devops',
  agentAuthority: 'senior',
  context: { type: 'deployment', scope: 'production' },
})

// decision: { allowed: boolean, reason: string, escalationRequired: boolean }
```

#### `evaluateQuality(metrics)`

Evaluate quality metrics against quality gates.

```typescript
const result = await bos.evaluateQuality([
  { name: 'test-coverage', value: 85, threshold: 80 },
  { name: 'lint', value: 100, threshold: 100 },
])

// result: { passed: boolean, failedGates: string[], metrics: QualityMetric[] }
```

#### `recordLearning(event)`

Record a learning event.

```typescript
await bos.recordLearning({
  type: 'insight',
  source: 'post-mortem',
  content: 'Blue-green deploys reduce rollback time by 40%',
  impact: 'high',
})
```

#### `getLearningReport()`

Generate a learning report.

```typescript
const report = bos.getLearningReport()
// { totalEvents: number, patterns: LearningPattern[], recommendations: string[] }
```

#### `runAudit(projectPath, stages?)`

Run the audit pipeline.

```typescript
const result = await bos.runAudit('./my-project', ['lint', 'typecheck', 'security'])
// result: { stages: AuditStageResult[], passed: boolean, summary: string }
```

#### `getAuditHistory()`

Get all past audit results.

```typescript
const history = bos.getAuditHistory()
```

#### `getStatus()`

Get a status summary.

```typescript
const status = bos.getStatus()
// {
//   engine: true,
//   dna: 'Enterprise Governance DNA',
//   missions: 3,
//   agents: 5,
//   auditEvents: 12,
//   qualityMetrics: 8,
//   learningEvents: 4,
// }
```

#### `getStats()`

Get detailed statistics.

```typescript
const stats = bos.getStats()
// {
//   missions: { total: 3, completed: 2, failed: 1 },
//   agents: { total: 5, active: 3 },
//   auditEvents: 12,
//   qualityMetrics: 8,
//   learningEvents: 4,
// }
```

## Events

The SDK uses `eventemitter3` for event emission. Subscribe to engine events for real-time monitoring.

## Re-exports

The SDK re-exports all core types and classes:

```typescript
export {
  BehaviorOSEngine,
  DNALoader,
  DNAValidator,
  DNAComposer,
  AuditEngine,
  QualityEngine,
  LearningEngine,
  MissionEngine,
  DecisionEngine,
  GovernanceEngine,
  // ... and all types
} from '@behavioros/core'
```
