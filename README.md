<p align="center">
  <img src="https://raw.githubusercontent.com/ilvan-develop/behavioros/main/website/logo.svg" alt="BehaviorOS Logo" width="120" />
</p>

<h1 align="center">BehaviorOS</h1>

<p align="center">
  <strong>The Operating System for Autonomous AI Teams</strong>
</p>

<p align="center">
  <a href="https://github.com/ilvan-develop/behavioros/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/ilvan-develop/behavioros/releases"><img src="https://img.shields.io/badge/version-0.1.0-green.svg" alt="Version" /></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-395%20passing-brightgreen.svg" alt="Tests" /></a>
</p>

<p align="center">
  Created by <strong><a href="https://github.com/ilvan-develop">Ilvan Joaquim</a></strong> from Angola 🇦🇴
</p>

---

BehaviorOS is a behavioral governance framework for AI agent teams. It provides a 9-layer architecture with 7 specialized engines, 16 pre-built DNA patterns, and an MCP server — giving you full control over how autonomous agents make decisions, follow governance rules, and learn from outcomes.

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

9-layer architecture where each layer is managed by a dedicated engine. Layers are evaluated bottom-up: DNA defines patterns, schemas validate types, and upper layers consume validated data.

```
┌─────────────────────────────────────────────────────────┐
│                    Mission Layer                         │
│  Mission lifecycle: create → start → execute → complete  │
├─────────────────────────────────────────────────────────┤
│                    Learning Layer                        │
│  Record events → detect patterns → auto-apply fixes     │
├─────────────────────────────────────────────────────────┤
│                    Quality Layer                         │
│  Quality gates: coverage, lint, typecheck, security     │
├─────────────────────────────────────────────────────────┤
│                    Audit Layer                           │
│  Multi-stage pipeline: lint → typecheck → security →    │
│  coverage → performance                                  │
├─────────────────────────────────────────────────────────┤
│                    Decision Layer                        │
│  Voting-based decisions with approval thresholds        │
├─────────────────────────────────────────────────────────┤
│                   Governance Layer                       │
│  Rule evaluation: block, escalate, warn, log            │
├─────────────────────────────────────────────────────────┤
│                  Behavioral Layer                        │
│  DNA loading, validation, composition                   │
├─────────────────────────────────────────────────────────┤
│                    Schema Layer                          │
│  Zod v4.4.3 schemas for all types                       │
├─────────────────────────────────────────────────────────┤
│                   DNA Layer (YAML)                       │
│  Personas, governance rules, quality gates, patterns,   │
│  workflows                                              │
└─────────────────────────────────────────────────────────┘
```

## Features

- **9-Layer Governance Pipeline** — DNA → Schema → Behavioral → Domain → Governance → Decision → Quality → Audit → Learning
- **7 Behavioral Engines** — Governance, Decision, Audit, Quality, Learning, Mission, Behavioral
- **DNA Pattern System** — YAML-based behavioral blueprints for AI agent teams
- **MCP Server** — 36 tools for direct integration with Claude, Cursor, VS Code, and Windsurf
- **TypeScript SDK** — Full-featured SDK with `BehaviorOS` class for programmatic access
- **CLI** — init, compile, validate, status, diff, simulate, deploy, drift-check
- **16 Pre-built DNA Patterns** — Enterprise, Military, Surgical, Lean Factory, EAARG
- **EU AI Act Compliance Ready** — Audit trails, governance rules, and documentation built-in

### 7 Engines

| Engine | Responsibility |
|---|---|
| **Behavioral** | Loads DNA from YAML, validates against Zod schemas, composes multiple packages |
| **Governance** | Evaluates actions against rules — block, escalate, warn, log |
| **Decision** | Voting-based consensus with configurable quorum and approval thresholds |
| **Audit** | Multi-stage pipeline: lint → typecheck → security → coverage → performance |
| **Quality** | Enforces gates before actions proceed — coverage, lint, typecheck, security |
| **Learning** | Records events, detects patterns, auto-applies known fixes |
| **Mission** | Manages lifecycle: create → start → execute → complete/fail |

## Packages

| Package | Description |
|---|---|
| `@behavioros/schemas` | Zod schemas for all types |
| `@behavioros/core` | 7 engines + PipelineDispatcher |
| `@behavioros/sdk` | TypeScript SDK |
| `@behavioros/cli` | CLI tools |
| `@behavioros/dnas` | DNA pattern catalog |
| `@behavioros/mcp-server` | MCP server (36 tools) |

## DNA Catalog

BehaviorOS ships with 16 DNA patterns — composable behavioral blueprints for AI agent teams.

| DNA | Description | Use Case |
|---|---|---|
| **Enterprise Governance** | MANDATORY for production. Compliance, audit trails, access control, change management. | Regulated industries, production systems |
| **Military Operations** | Strict chain of command, mission-focused execution, after-action reviews. | High-stakes coordination, crisis response |
| **Surgical Team** | Zero-defect protocols, sterile field rules, timeout verification, SBAR handoffs. | Patient safety, critical systems, zero-tolerance |
| **Lean Factory** | Kaizen events, 5S methodology, value stream mapping, standard work. | Continuous improvement, manufacturing ops |

## DNA Example

```yaml
# dnas/enterprise-governance.yaml
governance:
  - id: security-review
    name: Security Review Required
    level: critical
    action: escalate
    conditions:
      - type: security
      - type: auth

quality:
  - id: test-coverage
    type: test_coverage
    threshold: 80
  - id: lint
    type: lint
    threshold: 100
```

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

The MCP server exposes BehaviorOS to AI agents via the Model Context Protocol — 36 tools across 8 categories.

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

### Platform Setup

#### Claude Desktop

macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "node",
      "args": ["/absolute/path/to/behavioros/packages/mcp-server/dist/index.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
      }
    }
  }
}
```

#### Cursor

Create `.cursor/mcp.json` in your project root (already included in this repo).

#### VS Code (GitHub Copilot)

Create `.vscode/mcp.json` in your project root (already included in this repo).

#### Windsurf

Add to your Windsurf MCP configuration:

```json
{
  "behavioros": {
    "command": "node",
    "args": ["packages/mcp-server/dist/index.js"],
    "env": {
      "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BEHAVIOROS_DNA_PATH` | Path to DNA YAML file | `./dnas/enterprise-governance.yaml` |
| `BEHAVIOROS_PROJECT` | Project identifier | `default` |
| `BEHAVIOROS_LOG_LEVEL` | Log level (debug, info, warn, error) | `info` |

### Troubleshooting

- **MCP server won't start:** Ensure Node.js >= 22 is installed and packages are built (`pnpm build`)
- **DNA file not found:** Set `BEHAVIOROS_DNA_PATH` to an absolute path
- **Tools not appearing:** Restart your AI agent after adding the MCP config

### Available Tools

#### Mission

| Tool | Description |
|---|---|
| `create-mission` | Create a new mission in BehaviorOS |
| `update-progress` | Update the progress/status of a mission |
| `list-missions` | List missions with optional filtering |
| `list-agents` | List all agents in the system |
| `get-status` | Get system status (missions, agents, audit events) |

#### Governance

| Tool | Description |
|---|---|
| `evaluate-governance` | Evaluate an action against governance rules |
| `bos_select_dna` | Select optimal behavioral DNA pattern for a task context |
| `bos_resolve_conflict` | Resolve a conflict between two agents or squads |
| `bos_check_escalation` | Check if a situation should be escalated to human oversight |

#### Audit

| Tool | Description |
|---|---|
| `run-audit` | Run the audit pipeline on a project |
| `bos_run_audit` | Run the continuous audit chain (commit → PR → merge → deploy) |
| `bos_lsp_diagnostics` | Run LSP diagnostics (TypeScript + ESLint) on a project |
| `bos_lsp_validate` | Quality gate — validate project passes LSP checks |

#### Learning

| Tool | Description |
|---|---|
| `record-learning` | Record a learning event |
| `bos_get_insights` | Get behavioral pattern insights and system health |
| `bos_resolve_truth` | Resolve DNA pattern + context7 docs for delegation |
| `bos_list_patterns` | List all available behavioral DNA patterns in the catalog |

#### Integration

| Tool | Description |
|---|---|
| `sync-brocolis-orders` | Sync Brocolis orders with FinPay payments |
| `validate-payment` | Validate a payment through FinPay pipeline |
| `check-fraud` | Check for fraud signals in a payment |
| `get-trust-score` | Get trust score for a payment |
| `run-compliance` | Run compliance check (payment, data, audit) |
| `reconcile-payments` | Reconcile payment ledger between Brocolis and FinPay |
| `get-observability-metrics` | Get unified metrics from Brocolis, FinPay, and BehaviorOS |

#### Deployment

| Tool | Description |
|---|---|
| `deploy-canary` | Deploy canary version with quality gates |
| `rollback-deployment` | Rollback deployment if quality gates fail |

#### CI/CD

| Tool | Description |
|---|---|
| `cicd-run-audit` | Run the audit pipeline (lint, typecheck, security, coverage) |
| `cicd-get-audit-history` | Get historical audit results from CI/CD pipelines |
| `cicd-record-learning` | Record a learning event from CI/CD pipeline |
| `cicd-get-learning-report` | Get learning recommendations from CI/CD events |

#### Pipeline

| Tool | Description |
|---|---|
| `start-pipeline` | Start an EAARG pipeline for a project |
| `get-pipeline-status` | Get current pipeline status and progress |
| `validate-layer` | Validate a specific layer with evidence |
| `approve-layer` | Approve a layer after manual review |
| `get-pipeline-report` | Get full pipeline report with gate results |
| `get-gate-results` | Get gate check results for a layer |

### Available Resources

| Resource | URI |
|---|---|
| Missions | `behavioros://missions` |
| Agents | `behavioros://agents` |
| Audit Log | `behavioros://audit-log` |
| Quality Metrics | `behavioros://quality-metrics` |
| Learning Events | `behavioros://learning-events` |

## Test Results

| Package | Tests |
|---|---|
| `@behavioros/core` | 164 passing |
| `@behavioros/sdk` | 60 passing |
| `@behavioros/finpay-integration` | 68 passing |
| `@behavioros/observability-dashboard` | 65 passing |
| `@behavioros/dnas` | 38 passing |
| **Total** | **395 passing** |

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Created by **Ilvan Joaquim** ([@ilvan-develop](https://github.com/ilvan-develop)) from Angola 🇦🇴
