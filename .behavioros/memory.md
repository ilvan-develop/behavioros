# BehaviorOS Memory

## Context
- Project: BehaviorOS - Behavioral governance framework for autonomous AI agent teams
- Architecture: 9-layer architecture with 7 specialized engines
- Current Version: v0.1.0 (July 2026)
- Implementation Date: July 2026

## Decisions
- 2026-07-21: Implemented Kernel Absoluto with 10 rules
- 2026-07-21: Added Context Coverage Engine (target: 90%)
- 2026-07-21: Added Memory Engine for persistent state
- 2026-07-21: Added Recovery Engine with auto-rebuild
- 2026-07-21: Added Self-Healing Engine for quality gates

## Architecture
- 9 Layers: Mission, Learning, Quality, Audit, Decision, Governance, Behavioral, Schema, DNA
- 7 Engines: Behavioral, Governance, Decision, Audit, Quality, Learning, Mission
- New Engines: Coverage, Memory, Recovery, Self-Healing
- MCP Server: 37+ tools exposed to AI agents
- Platform Adapters: OpenCode, Cursor, Claude, Windsurf, Copilot

## Domains
- Core: packages/core - 7 engines, pipeline, schemas
- MCP: packages/mcp-server - 37+ tools
- SDK: packages/sdk - High-level API
- CLI: packages/cli - Command-line interface
- DNAs: packages/dnas - Pre-built patterns
- E2E: packages/e2e-tests - Protocol compliance tests

## Quality
- Coverage Target: 90% (Kernel Absoluto rule)
- Test Framework: Vitest
- Linter: Biome
- Type Checker: TypeScript strict mode

## Governance
- DNA selection before every task (mandatory)
- Truth resolution before delegation (mandatory)
- Audit after completion (mandatory)
- Learning recording at end (mandatory)
