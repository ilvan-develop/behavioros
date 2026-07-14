# BehaviorOS — Project Rules

## Overview

BehaviorOS is a behavioral governance framework for autonomous AI agent teams. It provides a 9-layer architecture with 7 specialized engines, DNA patterns (YAML), and an MCP server.

## Architecture (9 Layers)

```
Mission Layer       → Mission lifecycle: create → start → execute → complete
Learning Layer      → Record events → detect patterns → auto-apply fixes
Quality Layer       → Quality gates: coverage, lint, typecheck, security
Audit Layer         → Multi-stage pipeline: lint → typecheck → security → coverage → performance
Decision Layer      → Voting-based decisions with approval thresholds
Governance Layer    → Rule evaluation: block, escalate, warn, log
Behavioral Layer    → DNA loading, validation, composition
Schema Layer        → Zod v4.4.3 schemas for all types
DNA Layer (YAML)    → Personas, governance rules, quality gates, patterns, workflows
```

## Packages

| Package | Purpose |
|---------|---------|
| `@behavioros/schemas` | Zod + JSON Schema for all types |
| `@behavioros/core` | 7 engines: Behavioral, Governance, Decision, Audit, Quality, Learning, Mission |
| `@behavioros/sdk` | High-level TypeScript SDK (`BehaviorOS` class) |
| `@behavioros/cli` | CLI: init, compile, validate, status, version |
| `@behavioros/dnas` | Pre-built DNA YAML pattern catalog |
| `@behavioros/mcp-server` | MCP server (8 tools + 5 resources, stdio transport) |
| `@behavioros/web` | Next.js 15 dashboard (apps/web) |

## Dev Commands

```bash
pnpm dev              # Run all packages in dev/watch mode
pnpm build            # Build all packages (topological order)
pnpm test             # Run all tests
pnpm test:watch       # Watch mode testing (vitest)
pnpm lint             # Lint + auto-fix (biome check --write)
pnpm lint:check       # Lint check only
pnpm typecheck        # Type-check all packages
pnpm format           # Format code (biome format --write)
pnpm clean            # Clean build artifacts
```

## Code Conventions

- **Formatter/Linter:** Biome v2.5.3 (indent: 2 spaces, line width: 100, single quotes, trailing commas: all)
- **TypeScript:** strict mode, ES2022 target, ESNext modules, bundler resolution
- **Schemas:** Zod v4.4.3 — all types must have a corresponding Zod schema in `@behavioros/schemas`
- **DNA Files:** YAML format in `dnas/` — must validate against DNA schema
- **Commits:** Conventional commits enforced via commitlint (feat, fix, chore, docs, etc.)
- **Testing:** Vitest with globals, node environment, V8 coverage
- **Build:** tsup (ESM + CJS + dts output)
- **Monorepo:** pnpm workspaces + Turborepo

## DNA Structure

DNA packages define behavioral patterns in YAML with these sections:
- `personas` — Agent role definitions
- `governanceRules` — Decision constraints (block/escalate/warn/log)
- `qualityGates` — Quality thresholds and checks
- `patterns` — Reusable behavioral patterns
- `workflows` — Step-by-step process definitions

## MCP Server Tools

The `@behavioros/mcp-server` exposes these tools to AI agents:
- `create_mission`, `list_missions`, `update_progress`
- `list_agents`, `get_status`
- `evaluate_governance`, `run_audit`
- `record_learning`

## Agent Team — BehaviorOS DNA Wiring

All agents in `.opencode/agents/` are wired to use BehaviorOS DNA selection before starting any task.

### Agent Roster

| Agent | File | Role | BehaviorOS DNA |
|-------|------|------|----------------|
| Orchestrator | `orchestrator.md` | Central coordinator, delegates to all agents | `bos_select_dna` → `bos_resolve_truth` → `create-mission` → delegate → `bos_run_audit` |
| DNA Architect | `dna-architect.md` | Creates/modifies DNA YAML patterns | `bos_select_dna(taskType: feature/refactor, domain: infra)` |
| Governance Reviewer | `governance-reviewer.md` | Reviews governance rules | `bos_select_dna(taskType: review/security, domain: infra)` |
| Audit Analyst | `audit-analyst.md` | Runs audit pipelines | `bos_select_dna(taskType: review/deploy, domain: match context)` |
| Quality Guardian | `quality-guardian.md` | Enforces quality gates | `bos_select_dna(taskType: review/bugfix, domain: match context)` |
| Mission Controller | `mission-controller.md` | Manages mission lifecycle | `bos_select_dna(taskType: feature/deploy, domain: match context)` |

### BehaviorOS Tools Available to All Agents

Every agent has access to these BehaviorOS MCP tools:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `bos_select_dna` | Select optimal DNA pattern for a task | Before starting ANY task |
| `bos_resolve_truth` | Get DNA pattern + context7 docs for delegation | Before delegating |
| `bos_run_audit` | Run audit pipeline (commit/PR/merge/deploy) | After completing work |
| `bos_resolve_conflict` | Resolve agent conflicts | When agents disagree |
| `bos_check_escalation` | Check if human approval needed | Before critical actions |
| `bos_list_patterns` | List available DNA patterns | When discovering patterns |
| `bos_get_insights` | Check pattern health and system status | When monitoring |
| `create-mission` | Create a new mission | For mission lifecycle |
| `update-progress` | Update mission status | For progress tracking |

### Delegation Flow (Orchestrator)

```
User Request
    ↓
bos_select_dna(taskType, domain, riskLevel, complexity)
    ↓  → returns: pattern_name, confidence, principles, forbidden_rules
bos_resolve_truth(taskType, domain, riskLevel, complexity, agentId)
    ↓  → returns: DNA pattern + context7 library docs
create-mission(title, type, priority, description)
    ↓  → returns: missionId
Delegate to subagent (Task tool)
    ↓  → inject: DNA pattern + principles + forbidden rules + docs
Agent executes work
    ↓
bos_run_audit(trigger: commit|pr|merge|deploy_staging|deploy_production)
    ↓  → returns: gate results
update-progress(missionId, status: completed|failed)
    ↓
record-learning(type, source, data)
```

### Conflict Resolution

When agents produce conflicting outputs:
1. `bos_resolve_conflict(type, agentA, agentB, context)` → returns resolution strategy
2. Types: `backend_vs_frontend`, `security_vs_feature`, `qa_vs_developer`, `devops_vs_backend`, `custom`

### Escalation Rules

`bos_check_escalation(trigger, context)` is called BEFORE:
- Security vulnerability fixes
- Payment system changes
- Production deployments
- Breaking API changes
- Any `critical` risk level action

## Important Patterns

- DNA validation happens before any engine uses a package
- Governance rules are evaluated BEFORE actions are taken
- Audit pipeline runs stages sequentially: lint → typecheck → security → coverage → performance
- Missions follow lifecycle: created → in_progress → completed/failed
- Learning events are recorded and patterns are auto-detected
- Every agent runs `bos_select_dna` before starting work (mandatory)
- Every agent runs `bos_run_audit` after completing work (mandatory)
- Conflicts are resolved via `bos_resolve_conflict` before proceeding

## Testing

- Run `pnpm test` from root to test all packages
- Core engine tests: `packages/core/src/__tests__/`
- MCP server tests: `packages/mcp-server/src/__tests__/`
- Individual package tests: `pnpm --filter @behavioros/core test`
