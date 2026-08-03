# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-03

### Security

- **Signed protocol state** (`@behavioros/core`) — `.agent_state.json` is now HMAC-SHA256 signed via a secret key the MCP server creates outside the repo (`~/.behavioros/state.key`, or `BEHAVIOROS_STATE_SECRET`). Hand-editing the protocol booleans without recomputing the signature is now detected as tampering and blocked, instead of being silently trusted. New module: `packages/core/src/state/agent-state-store.ts`.
- **Deterministic `PreToolUse` enforcement** (`scripts/validate-protocol.js`) — rewritten to verify the signed state and to enforce the `PROTOCOL.md` rule "orchestrator may not edit files": if the active persona role is `orchestrator`, direct `Edit`/`Write`/`NotebookEdit`/`MultiEdit` calls are blocked with the exact documented error message.
- **Boundary enforcement wired end-to-end** (`@behavioros/core`, `@behavioros/mcp-server`) — fixed a dead-code bug where `BehaviorOSEngine.evaluateGovernance()` never forwarded `boundaries`/`targetFiles`/`fileCount`/`lineCount` into the governance context, so DNA persona boundaries (`max_files`, `forbidden`, `require_approval`, etc.) were never actually evaluated. Also fixed a related false-negative where boundary rejections (which don't carry a `GovernanceRule`) weren't being treated as blocking.
- **Atomic, locked state writes** — `.agent_state.json` writes now go through a temp-file-then-rename with a stale-lock-aware exclusive lock, replacing two independently duplicated `writeFileSync` implementations.

### Added

- **3 new DNA presets**: `nextjs-nestjs-fullstack`, `python-go-microservices`, `complex-monorepo` (`dnas/`), registered in `@behavioros/dnas`'s manifest.
- **`docs/GETTING-STARTED.md`** — 5-minute integration guide (Claude Code / Cursor / standalone CLI), including how to turn on deterministic enforcement.
- **`docs/EAARG-18-LAYERS.md`** — consolidated catalog of the 18-layer Enterprise Agent Architecture Review framework.
- Optional `role` field on `bos_select_dna`, feeding the new orchestrator-file-edit enforcement rule.

### Fixed

- Memory growth: `auditLog`/`qualityMetrics` (`BehaviorOSEngine`) and `events`/`insights` (`LearningEngine`) are now capped with oldest-first pruning instead of growing unbounded for the life of the process.
- `ProtocolStateTracker.getDefaultStateFilePath()` now anchors to the nearest `.git` directory instead of silently defaulting to `cwd()`.
- `packages/core/vitest.config.ts` requested the `istanbul` coverage provider, which was never installed — `vitest run --coverage` failed outright. Switched to `v8` (already present) and added real coverage thresholds to both `core` and `mcp-server`.
- Replaced the placebo `scripts/test-enforcement-e2e.sh` (only `echo` statements, no assertions) with a real test that shells out to the enforcement hook and asserts exit codes across 7 scenarios, including the exact tamper-bypass this release closes.

## [1.0.0] - 2026-07-20

### Added

- **Ecosystem Platform** — 3 adapter integrations (AITMPL: 2800+ skills, Open Design: 151 design systems, UI-UX Pro Max)
- **SkillEngine** — `resolve()`, `validateDelegation()`, `listAvailable()`, `search()`, `install()`, `syncFromDNA()`, `syncFromLocal()`, `status()`, `doctor()`
- **AutonomousOrchestrator** — Autonomous task decomposition → skill routing → handoff protocol → doc generation → lifecycle pipeline → audit
- **Handoff Protocol** — 6-state lifecycle (pending → accepted → in_progress → completed/rejected/cancelled)
- **Protocol Enforcement** — 3 levels (strict/standard/audit), `DelegationEnforcementLayer` blocks action tools if protocol steps skipped
- **CLI Commands** — `ecosystem` (status, install, sync, doctor, report, stack), `protocol` (check, enforce, status), `agent` (list, skills, validate), `autonomous` (run, status, handoffs)
- **MCP Handoff Tools** — `bos-agent-handoff`, `bos-skills-validate`, `bos-skills-list`, `bos-ecosystem-status`, `bos-ecosystem-doctor`, `bos-ecosystem-install`
- **Web Dashboard** — ecosystem, skills, MCPs, report, protocol pages with 7 API routes
- **Documentation** — ECOSYSTEM.md (382 lines), STACK.md (167 lines), INTEGRATIONS.md (227 lines), AGENT-PROTOCOL.md (301 lines), CLI.md expanded 237→604 lines
- **1088+ tests** across all packages (all phases)
- **FinPay Integration Tests** — 6 scenarios: protocol enforcement, skill validation, autonomous decomposition, handoff, ecosystem status, doc generation
- **Version alignment** — All 7 packages aligned to 1.0.0

## [0.1.0] - 2026-07-20

### Added

- **@behavioros/schemas**: Zod v4.4.3 schemas for all BehaviorOS types (DNAPackage, Mission, AgentState, AuditEvent, QualityMetric, LearningEvent, GovernanceRule, QualityGate, BehaviorPattern)
- **@behavioros/core**: 7 engines + PipelineDispatcher + internal modules
  - Behavioral Engine — DNA loading, validation, and composition
  - Governance Engine — Rule evaluation, escalation, and blocking
  - Decision Engine — Voting-based decision making
  - Audit Engine — Multi-stage audit pipeline with history
  - Quality Engine — Quality gates, coverage, lint, typecheck, security
  - Learning Engine — Event recording, pattern detection, and auto-apply
  - Mission Engine — Mission lifecycle (create, start, complete, fail)
  - PipelineDispatcher — 9-layer pipeline with Chain of Responsibility, interceptors, and mode adapters
  - Sandbox — Isolated execution environments (ephemeral, persistent, shadow)
  - Shadow Pipeline — Traffic capture, replay engine, and diff analysis
  - Canary Deploy — Gradual rollout with health monitoring and auto-rollback
  - Resilience — Rate limiter, circuit breaker, and agent isolation
  - Domain — DDD boundaries, ACLs, permission matrix, cross-DNA guard
- **@behavioros/sdk**: TypeScript SDK with `BehaviorOS` class providing high-level API for mission management, governance evaluation, quality assessment, audit pipelines, learning recording, system status, PipelineEngine integration, DecisionEngine, and SandboxEngine
- **@behavioros/cli**: CLI with 9 commands (`init`, `compile`, `validate`, `status`, `version`, `diff`, `simulate`, `deploy`, `drift-check`). Built with Commander.js, interactive prompts, and cosmiconfig
- **@behavioros/dnas**: 16 DNA patterns including EAARG 18-layer enterprise review guide
  - Enterprise Governance — Mandatory production governance (compliance, audit trails, access control, change management)
  - Military Operations — Chain of command, mission-focused execution, after-action reviews
  - Surgical Team — Zero-defect protocols, sterile field rules, timeout verification, SBAR handoffs
  - Lean Factory — Kaizen events, 5S methodology, value stream mapping, standard work
  - Enterprise Agent Architecture Review Guide (EAARG) — 18-layer comprehensive review framework
- **@behavioros/mcp-server**: MCP server with 36 tools and 5 resources (missions, agents, audit-log, quality-metrics, learning-events). Stdio transport for local AI agent integration
- **@behavioros/observability-dashboard**: Grafana dashboards, Prometheus rules, and alerting configuration for real-time monitoring
- **Website**: Landing page with dark theme
- 395+ tests across all packages
- EU AI Act compliance ready
- pnpm monorepo with Turborepo build orchestration
- Biome for linting and formatting
- Changesets for version management
- Husky + commitlint for conventional commits
- Shadow pipeline with traffic capture, replay engine, and diff analysis
- Canary deployment with gradual rollout (5% → 25% → 50% → 100%) and auto-rollback
- Sandbox engine with ephemeral, persistent, and shadow modes
- Rate limiter with token bucket, sliding window, and adaptive algorithms
- Circuit breaker with closed/open/half-open states and configurable cooldown
- Agent isolation via SuspicionDetector, QuarantineManager, SandboxExecutor, and ForensicCollector
