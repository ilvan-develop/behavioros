# @behavioros/core

> Core engines for BehaviorOS — Behavioral, Governance, Decision, Audit, Quality, Learning, Mission, PipelineDispatcher

## Installation

```bash
pnpm add @behavioros/core
```

## Quick Start

```typescript
import { BehaviorOSEngine, DNALoader, DNAValidator } from '@behavioros/core'

const loader = new DNALoader()
const dnaPackage = await loader.load('./dnas/enterprise-governance.yaml')
const engine = new BehaviorOSEngine({ dna: dnaPackage, governance: { level: 'strict' } })
const result = await engine.evaluateGovernance('deploy-production', { type: 'deployment', agent: 'devops' })
```

## API

| Export | Description |
|--------|-------------|
| `BehaviorOSEngine` | Unified engine composing all 7 engines into a single runtime |
| `DNALoader` | Loads DNA packages from YAML files with path resolution |
| `DNAValidator` | Validates DNA structure against Zod schemas |
| `DNAComposer` | Composes multiple DNA packages into a single configuration |
| `AuditEngine` | Multi-stage audit pipeline (lint, typecheck, security, coverage, performance) |
| `QualityEngine` | Enforces quality gates with configurable thresholds |
| `GovernanceEngine` | Evaluates actions against governance rules (block, escalate, warn, log) |
| `DecisionEngine` | Voting-based consensus with weighted votes and quorum |
| `LearningEngine` | Records events, detects patterns, auto-applies fixes |
| `MissionEngine` | Manages mission lifecycle (create, start, execute, complete, fail) |
| `PipelineDispatcher` | Chain-of-responsibility pipeline orchestrating all 9 layers |

## License

MIT © Ilvan Joaquim
