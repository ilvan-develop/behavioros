<p align="center">
  <img src="https://raw.githubusercontent.com/ilvan-develop/behavioros/main/website/logo.svg" alt="BehaviorOS Logo" width="140" />
</p>

<h1 align="center">BehaviorOS</h1>

<p align="center">
  <strong>The Operating System for Autonomous AI Agent Teams</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/tests-5%2C200%2B-brightgreen" alt="Tests" /></a>
  <a href="#"><img src="https://img.shields.io/badge/version-1.1.2-blue" alt="Version" /></a>
  <a href="#"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D22-339933" alt="Node" /></a>
  <a href="#"><img src="https://img.shields.io/badge/typescript-strict-3178C6" alt="TypeScript" /></a>
  <a href="#"><img src="https://img.shields.io/badge/pnpm-workspace-F69220" alt="pnpm" /></a>
</p>

<p align="center">
  Created by <strong>Ilvan Joaquim</strong> from Angola 🇦🇴
</p>

---

BehaviorOS is a **behavioral governance framework** that gives AI agent teams DNA-driven rules, deterministic pipelines, and autonomous orchestration. Think of it as an operating system for AI agents — it defines *how* agents think, decide, collaborate, and learn.

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({ dnaPath: './dnas/enterprise-governance.yaml' })

const mission = await bos.createMission({
  title: 'Ship payment module v2',
  type: 'feature',
  priority: 'critical',
})

await bos.evaluateGovernance('deploy-production', { agent: 'devops', scope: 'production' })
await bos.startMission(mission.id)
```

## Why BehaviorOS?

| Without BehaviorOS | With BehaviorOS |
|---|---|
| Agents act unpredictably | DNA patterns enforce deterministic behavior |
| No audit trail | Every action logged & auditable |
| Manual governance review | Automated rule evaluation (block/escalate/warn) |
| Agents don't learn from mistakes | Learning engine detects patterns & auto-applies fixes |
| Hard to coordinate multiple agents | 7-step protocol + handoff protocol for seamless collaboration |
| No quality gates | Lint → typecheck → security → coverage gates enforced automatically |
| Reinventing infrastructure every project | 22 engines, 36 MCP tools, CLI, SDK — batteries included |

## Quick Demo

Run a full governance lifecycle in 30 seconds:

```bash
npx @behavioros/cli init                      # Scaffold project
npx @behavioros/cli compile                   # Compile DNA
npx @behavioros/cli validate                  # Validate governance rules
npx @behavioros/cli status                    # Check system health
```

```typescript
// Programmatic: evaluate governance then deploy
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({
  dnaPath: './dnas/surgical-team.yaml',
  governance: { enabled: true, level: 'strict' },
  quality: { enabled: true, minCoverage: 90 },
  learning: { enabled: true },
})

// Governance blocks risky actions automatically
const decision = await bos.evaluateGovernance('deploy-production', {
  type: 'deployment', agent: 'devops', scope: 'production',
})
// → { allowed: true, rules: [{ id: 'security-review', action: 'pass' }] }

// Quality gates run before execution
const mission = await bos.createMission({ title: 'Release v2.1', type: 'deployment', priority: 'critical' })
await bos.startMission(mission.id)

// Learning engine captures insights automatically
await bos.recordLearning({
  type: 'insight', source: 'post-mortem',
  content: 'Rollback time reduced by 40% with blue-green deployment',
  impact: 'high',
})
```

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      MISSION LAYER                            │
│   Lifecycle: create → start → execute → complete/fail         │
├──────────────────────────────────────────────────────────────┤
│                      LEARNING LAYER                           │
│   Record events → detect patterns → auto-apply fixes          │
├──────────────────────────────────────────────────────────────┤
│                      QUALITY LAYER                            │
│   Gates: coverage ≥ 80% | lint = 0 | typecheck = 0 | security │
├──────────────────────────────────────────────────────────────┤
│                      AUDIT LAYER                              │
│   Stages: lint → typecheck → security → coverage → perf       │
├──────────────────────────────────────────────────────────────┤
│                     DECISION LAYER                            │
│   Voting-based decisions | configurable quorum & thresholds   │
├──────────────────────────────────────────────────────────────┤
│                    GOVERNANCE LAYER                            │
│   Rules: block | escalate | warn | log                         │
├──────────────────────────────────────────────────────────────┤
│                   BEHAVIORAL LAYER                             │
│   Load DNA | validate | compose multi-package patterns         │
├──────────────────────────────────────────────────────────────┤
│                    SCHEMA LAYER                                │
│   Zod v4.4.3 schemas for every type                            │
├──────────────────────────────────────────────────────────────┤
│                    DNA LAYER (YAML)                            │
│   Personas | governance rules | quality gates | workflows      │
└──────────────────────────────────────────────────────────────┘
```

### 22 Engines Powering the Stack

| Engine | Ops/s | Engine | Ops/s |
|---|---|---|---|
| AutonomousDecomposer | 14.6M | AuditEngine | 1.8M |
| AITMPLAdapter | 15.9M | PipelineEngine | 1.6M |
| DecisionEngine | 14.1M | GovernanceEngine | 1.3M |
| QualityEngine | 14.1M | ContextRecoveryEngine | 487K |
| LearningEngine | 13.9M | LocalRuntime | 2.9M |
| LoggingEngine | 12.7M | Registry | 9.6M |
| DistributedMemory | 10.9M | AIResourceManager | 9.8M |
| DNALoader | 10.4M | CapabilityCatalog | 7.3M |
| CognitiveIndex | 10.6M | QueueManager | 7.7M |
| SecretsEngine | 10.0M | KnowledgeGraph | 8.6M |
| MissionEngine | 8.4M | EvaluationEngine | 8.7M |

## Features Deep Dive

### DNA Pattern System

Behavioral blueprints in YAML that define agent roles, governance rules, quality gates, and workflows. Each DNA encodes the *behavioral immune system* for your agent team.

```yaml
# dnas/surgical-team.yaml
personas:
  - role: architect
    name: Lead Surgeon
    authority: architect
    boundaries:
      - id: max-procedures
        type: max_modules
        value: 1
    skills: [surgical-procedure, team-leadership, clinical-decision]

governance:
  - id: sterile-field
    level: critical
    action: block
    conditions: [type:sterile-procedure, type:instrument-handling]

quality:
  - id: zero-defect
    type: test_coverage
    threshold: 100
```

### The 10 DNA Patterns

| Pattern | Description | Best For |
|---|---|---|
| **Surgical Team** | Zero-defect, sterile field, timeout verification, SBAR handoffs | Critical systems, production deploys |
| **Enterprise Governance** | Compliance, audit trails, access control, change management | Regulated industries |
| **Military Operations** | Chain of command, mission focus, after-action reviews | High-stakes coordination |
| **Lean Factory** | Kaizen events, 5S methodology, value stream mapping | Continuous improvement |
| **Manufacturing** | Deterministic pipelines, quality gates at every stage | CI/CD workflows |
| **Healthcare Operations** | HIPAA compliance, patient data protection | Healthcare apps |
| **Immune System** | Adaptive threat response, anomaly detection, self-healing | Security-critical systems |
| **Wolf Pack** | Distributed decision-making, pack coordination | Scalable autonomous teams |
| **Bee Colony** | Swarm intelligence, task specialization | High-throughput task processing |
| **Autonomous Orchestrator** | Self-managing pipelines, auto-scaling agents | Fully autonomous operations |

Plus stack-specific presets — **Next.js + NestJS Fullstack**, **Python/Go Microservices**, **Complex Monorepo** — and the **EAARG** 18-layer architecture review framework. Full catalog in [`docs/DNAs.md`](docs/DNAs.md); 18-layer breakdown in [`docs/EAARG-18-LAYERS.md`](docs/EAARG-18-LAYERS.md).

### SkillEngine — Two-Stage Routing

```
Request → DNA Match → Capability Match → Delegate → Validate
```

Skills are matched in two stages: first by DNA pattern compatibility, then by capability signature. 24 skills registered across 6 agent types.

### MCP Server — 36 Tools + 9 Resources

Connect BehaviorOS to any AI agent platform via Model Context Protocol:

| Category | Tools |
|---|---|
| **Mission** | `create-mission`, `update-progress`, `list-missions`, `list-agents`, `get-status` |
| **Governance** | `evaluate-governance`, `bos_select_dna`, `bos_resolve_conflict`, `bos_check_escalation` |
| **Audit** | `run-audit`, `bos_run_audit`, `bos_lsp_diagnostics`, `bos_lsp_validate` |
| **Learning** | `record-learning`, `bos_get_insights`, `bos_resolve_truth`, `bos_list_patterns` |
| **Pipeline** | `start-pipeline`, `get-pipeline-status`, `validate-layer`, `approve-layer`, `get-pipeline-report`, `get-gate-results` |
| **CI/CD** | `cicd-run-audit`, `cicd-get-audit-history`, `cicd-record-learning`, `cicd-get-learning-report` |
| **Ecosystem** | `bos-ecosystem-status`, `bos-ecosystem-install`, `bos-ecosystem-doctor` |
| **Skills** | `bos-skills-list`, `bos-skills-validate` |
| **Agent** | `bos-agent-metrics`, `bos-agent-handoff`, `bos-autonomous-task` |

### CLI Reference

| Command | Description |
|---|---|
| `npx @behavioros/cli init` | Scaffold a new BehaviorOS project |
| `npx @behavioros/cli compile` | Compile DNA packages |
| `npx @behavioros/cli validate` | Validate DNA configurations |
| `npx @behavioros/cli status` | Show system status & health |
| `npx @behavioros/cli diff` | Detect behavioral drift between DNA versions |
| `npx @behavioros/cli simulate` | Simulate governance decisions |
| `npx @behavioros/cli deploy` | Deploy with quality gates |
| `npx @behavioros/cli ecosystem status` | Show ecosystem status |
| `npx @behavioros/cli ecosystem install` | Install skills / MCPs / design systems |
| `npx @behavioros/cli agent list` | List all agents |
| `npx @behavioros/cli autonomous run` | Run fully autonomous task |
| `npx @behavioros/cli protocol check` | Check 7-step protocol compliance |
| `npx @behavioros/cli drift-check` | Compare current vs baseline behavior |

## Ecosystem Marketplace

| Component | Count | Source |
|---|---|---|
| **Skills** | 24 (6 agents × 4) | BehaviorOS built-in |
| **MCPs** | 65+ | AITMPL marketplace |
| **Design Systems** | 151 | Open Design |
| **DNA Patterns** | 10 | BehaviorOS catalog |
| **Color Palettes** | 161 | UI-UX Pro Max |
| **Font Pairings** | 57 | UI-UX Pro Max |

## Test Status

| Package | Tests | Status |
|---|---|---|
| `@behavioros/core` | ~5,000+ (159 files) | ✅ All passing |
| `@behavioros/mcp-server` | 112 (8 files) | ✅ All passing |
| `@behavioros/web` | 120 (29 files) | ✅ All passing |
| **Total** | **~5,200+ / 196 files** | **✅ 0 failures** |
| **Typecheck** | All packages | **✅ 0 errors** |
| **Build** | ESM + CJS + DTS | **✅ <3s per package** |
| **Coverage** | Core engine | **✅ >80%** |

## Quick Start

> New to BehaviorOS? [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) is a 5-minute walkthrough covering Claude Code, Cursor, and standalone CLI usage — including how to turn on deterministic enforcement, not just the advisory MCP tools shown below.

```bash
# Install
pnpm add @behavioros/core @behavioros/sdk
pnpm add -g @behavioros/cli

# Or install everything
pnpm add @behavioros/core @behavioros/sdk @behavioros/schemas @behavioros/dnas @behavioros/cli @behavioros/mcp-server
```

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({
  dnaPath: './dnas/enterprise-governance.yaml',
  quality: { enabled: true, minCoverage: 80 },
  audit: { enabled: true },
  learning: { enabled: true },
})

const mission = await bos.createMission({
  title: 'Implement payment module',
  type: 'feature',
  priority: 'high',
})

const status = bos.getStatus()
// → { engine: true, dna: 'Enterprise Governance', missions: 1, agents: 5, ... }
```

## MCP Setup

### Claude Desktop

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "node",
      "args": ["/absolute/path/behavioros/packages/mcp-server/dist/server.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
      }
    }
  }
}
```

### Cursor

Create `.cursor/mcp.json`:

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

### VS Code + GitHub Copilot

Create `.vscode/mcp.json` with the same config as Cursor.

### Windsurf

Add to Windsurf MCP configuration:

```json
{
  "behavioros": {
    "command": "node",
    "args": ["packages/mcp-server/dist/server.js"],
    "env": {
      "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
    }
  }
}
```

### OpenCode

Add to `opencode.json`:

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "node",
      "args": ["packages/mcp-server/dist/server.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml",
        "BEHAVIOROS_PROJECT": "my-project",
        "BEHAVIOROS_LOG_LEVEL": "info"
      }
    }
  },
  "instructions": [
    "docs/PROTOCOL.md",
    "AGENTS.md"
  ]
}
```

**Legacy format** (OpenCode < 1.5):

```json
{
  "mcp": {
    "behavioros": {
      "type": "local",
      "command": ["node", "packages/mcp-server/dist/server.js"],
      "cwd": ".",
      "enabled": true,
      "timeout": 30000,
      "environment": {
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
      }
    }
  }
}
```

After setup, verify the connection:

```bash
# Test 9 resources respond
echo '{"jsonrpc":"2.0","id":1,"method":"resources/list","params":{}}' | node packages/mcp-server/dist/server.js

# Or use CLI
npx @behavioros/cli status
```

## Integration Best Practices

| Platform | Config File | Setup |
|---|---|---|
| **Claude Code** | `CLAUDE.md` | Add protocol steps + DNA selection instructions |
| **Cursor** | `.cursor/rules/` | Add `behavioros-protocol.mdc` rule |
| **VS Code Copilot** | `.github/copilot-instructions.md` | Document 7-step protocol |
| **Windsurf** | `.windsurfrules` | Enforce protocol rules |
| **OpenCode** | `opencode.json` → `mcpServers.behavioros` | 36 tools + 9 resources + 7-step protocol |

Want aggregate metrics on violations blocked and agent efficiency across your team? See [`docs/TELEMETRY.md`](docs/TELEMETRY.md) — opt-in, aggregate-only, bring-your-own-endpoint.

## Contributing

Contributions welcome! Fork the repo, pick a DNA pattern, improve an engine, or add tests.

```
pnpm install
pnpm dev          # Watch mode for all packages
pnpm test         # Run all ~5,200+ tests
pnpm lint:check   # Biome linter
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Packages

| Package | Description | Version |
|---|---|---|
| `@behavioros/schemas` | Zod v4.4.3 schemas for all types | 1.1.2 |
| `@behavioros/core` | 22 engines + SkillEngine + EcosystemRegistry | 1.1.2 |
| `@behavioros/sdk` | High-level TypeScript SDK | 1.1.2 |
| `@behavioros/cli` | CLI: init, compile, validate, status, ecosystem | 1.1.2 |
| `@behavioros/dnas` | DNA YAML pattern catalog | 1.1.2 |
| `@behavioros/mcp-server` | MCP server with 45 tools + 9 resources | 1.1.2 |
| `@behavioros/web` | Next.js 15 dashboard (apps/web) | 0.1.2 |

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Created with by <strong>Ilvan Joaquim</strong> from Angola 🇦🇴<br>
  <a href="https://github.com/ilvan-develop/behavioros">GitHub</a> ·
  <a href="https://github.com/ilvan-develop/behavioros/issues">Issues</a> ·
  <a href="./docs/PROTOCOL.md">Protocol</a> ·
  <a href="./docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="./docs/ECOSYSTEM.md">Ecosystem</a>
</p>
