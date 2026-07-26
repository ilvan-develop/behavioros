# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
