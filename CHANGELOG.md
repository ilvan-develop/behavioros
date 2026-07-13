# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-13

### Added

- **@behavioros/schemas**: Zod v4.4.3 schemas for all BehaviorOS types (DNAPackage, Mission, AgentState, AuditEvent, QualityMetric, LearningEvent, GovernanceRule, QualityGate, BehaviorPattern)
- **@behavioros/core**: 7 engines
  - Behavioral Engine — DNA loading, validation, and composition
  - Governance Engine — Rule evaluation, escalation, and blocking
  - Decision Engine — Voting-based decision making
  - Audit Engine — Multi-stage audit pipeline with history
  - Quality Engine — Quality gates, coverage, lint, typecheck, security
  - Learning Engine — Event recording, pattern detection, and auto-apply
  - Mission Engine — Mission lifecycle (create, start, complete, fail)
- **@behavioros/sdk**: TypeScript SDK with `BehaviorOS` class providing high-level API for mission management, governance evaluation, quality assessment, audit pipelines, learning recording, and system status
- **@behavioros/cli**: CLI with `init`, `compile`, `validate`, `status`, and `version` commands. Built with Commander.js, interactive prompts, and cosmiconfig
- **@behavioros/dnas**: 4 DNA patterns
  - Enterprise Governance — Mandatory production governance (compliance, audit trails, access control, change management)
  - Military Operations — Chain of command, mission-focused execution, after-action reviews
  - Surgical Team — Zero-defect protocols, sterile field rules, timeout verification, SBAR handoffs
  - Lean Factory — Kaizen events, 5S methodology, value stream mapping, standard work
- **@behavioros/mcp-server**: MCP server with 8 tools (create-mission, get-status, update-progress, list-agents, list-missions, evaluate-governance, record-learning, run-audit) and 5 resources (missions, agents, audit-log, quality-metrics, learning-events)
- **Website**: Landing page with dark theme
- 90 tests across all packages
- pnpm monorepo with Turborepo build orchestration
- Biome for linting and formatting
- Changesets for version management
- Husky + commitlint for conventional commits
