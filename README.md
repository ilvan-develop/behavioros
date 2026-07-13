<p align="center">
  <img src="https://raw.githubusercontent.com/behavioros/behavioros/main/website/logo.svg" alt="BehaviorOS Logo" width="120" />
</p>

<h1 align="center">BehaviorOS</h1>

<p align="center">
  <strong>The Operating System for Autonomous AI Teams</strong>
</p>

<p align="center">
  <a href="https://github.com/behavioros/behavioros/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/behavioros/behavioros/releases"><img src="https://img.shields.io/badge/version-0.1.0-green.svg" alt="Version" /></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-90%20passing-brightgreen.svg" alt="Tests" /></a>
</p>

---

BehaviorOS is a behavioral governance framework for AI agent teams. It provides a 9-layer architecture with 7 specialized engines, 4 pre-built DNA patterns, and an MCP server — giving you full control over how autonomous agents make decisions, follow governance rules, and learn from outcomes.

## Quick Start

```bash
# Install core packages
pnpm add @behavioros/core @behavioros/sdk

# Or install everything
pnpm add @behavioros/core @behavioros/sdk @behavioros/schemas @behavioros/dnas
```

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({
  dnaPath: './dnas/enterprise-governance.yaml',
})

const mission = await bos.createMission({
  title: 'Implement payment module',
  type: 'feature',
  priority: 'high',
})

await bos.startMission(mission.id)
```

## CLI Quick Start

```bash
npx @behavioros/cli init          # Scaffold a new .behavioros config
npx @behavioros/cli compile       # Compile DNA packages
npx @behavioros/cli validate      # Validate DNA configurations
npx @behavioros/cli status        # Show system status
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mission Layer                         │
├─────────────────────────────────────────────────────────┤
│                    Learning Layer                        │
├─────────────────────────────────────────────────────────┤
│                    Quality Layer                         │
├─────────────────────────────────────────────────────────┤
│                    Audit Layer                           │
├─────────────────────────────────────────────────────────┤
│                    Decision Layer                        │
├─────────────────────────────────────────────────────────┤
│                   Governance Layer                       │
├─────────────────────────────────────────────────────────┤
│                  Behavioral Layer                        │
├─────────────────────────────────────────────────────────┤
│                    Schema Layer                          │
├─────────────────────────────────────────────────────────┤
│                   DNA Layer (YAML)                       │
└─────────────────────────────────────────────────────────┘
```

Each layer is managed by a dedicated engine. The DNA layer defines behavioral patterns in YAML. The schema layer validates all types with Zod. Governance rules are evaluated before any action is taken.

## Packages

| Package | Description | Version |
|---|---|---|
| `@behavioros/schemas` | Zod v4.4.3 schemas for all BehaviorOS types | 0.1.0 |
| `@behavioros/core` | 7 behavioral engines (Behavioral, Governance, Decision, Audit, Quality, Learning, Mission) | 0.1.0 |
| `@behavioros/sdk` | TypeScript SDK with `BehaviorOS` class for high-level integration | 0.1.0 |
| `@behavioros/cli` | CLI with init, compile, validate, status, and version commands | 0.1.0 |
| `@behavioros/dnas` | 4 pre-built DNA patterns (Enterprise, Military, Surgical, Lean) | 0.1.0 |
| `@behavioros/mcp-server` | MCP server with 8 tools and 5 resources | 0.1.0 |
| `behavioros-website` | Landing page | — |

## DNA Catalog

BehaviorOS ships with 4 DNA patterns — composable behavioral blueprints for AI agent teams.

| DNA | Description | Use Case |
|---|---|---|
| **Enterprise Governance** | MANDATORY for production. Compliance, audit trails, access control, change management. | Regulated industries, production systems |
| **Military Operations** | Strict chain of command, mission-focused execution, after-action reviews. | High-stakes coordination, crisis response |
| **Surgical Team** | Zero-defect protocols, sterile field rules, timeout verification, SBAR handoffs. | Patient safety, critical systems, zero-tolerance |
| **Lean Factory** | Kaizen events, 5S methodology, value stream mapping, standard work. | Continuous improvement, manufacturing ops |

## SDK Example

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({
  dnaPath: './dnas/enterprise-governance.yaml',
  governance: { enabled: true, level: 'standard' },
  quality: { enabled: true, minCoverage: 80 },
  learning: { enabled: true },
  audit: { enabled: true },
})

// Create and execute a mission
const mission = await bos.createMission({
  title: 'Deploy v2.1',
  type: 'deployment',
  priority: 'critical',
})

await bos.startMission(mission.id)

// Evaluate governance before an action
const decision = await bos.evaluateGovernance('deploy-production', {
  type: 'deployment',
  agent: 'devops',
  scope: 'production',
})

// Record learning
await bos.recordLearning({
  type: 'insight',
  source: 'post-mortem',
  content: 'Rollback time reduced by 40% with blue-green deployment',
  impact: 'high',
})

// Get system status
const status = bos.getStatus()
console.log(status)
// { engine: true, dna: 'Enterprise Governance DNA', missions: 1, agents: 5, ... }
```

## MCP Server

The MCP server exposes BehaviorOS to AI agents via the Model Context Protocol.

### Setup

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "npx",
      "args": ["@behavioros/mcp-server"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|---|---|
| `create-mission` | Create a new mission |
| `get-status` | Get system status |
| `update-progress` | Update mission progress |
| `list-agents` | List all agents |
| `list-missions` | List missions with filtering |
| `evaluate-governance` | Evaluate action against governance rules |
| `record-learning` | Record a learning event |
| `run-audit` | Run audit pipeline on a project |

### Available Resources

| Resource | URI |
|---|---|
| Missions | `behavioros://missions` |
| Agents | `behavioros://agents` |
| Audit Log | `behavioros://audit-log` |
| Quality Metrics | `behavioros://quality-metrics` |
| Learning Events | `behavioros://learning-events` |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding standards, and how to contribute new DNA patterns.

## License

[MIT](./LICENSE) — © 2026 BehaviorOS Team
