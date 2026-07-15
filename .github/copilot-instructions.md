# BehaviorOS — GitHub Copilot Instructions

## Project Overview

BehaviorOS is a behavioral governance framework for autonomous AI agent teams. It provides:
- 9-layer architecture with 10 specialized engines
- DNA (Deoxyribonucleic Algorithm) YAML behavioral patterns
- MCP Server with 30+ tools
- TypeScript SDK

## Architecture

- `packages/core` — Core engines (Governance, Decision, Audit, Quality, Learning, Mission, Pipeline, Behavioral)
- `packages/sdk` — High-level TypeScript SDK
- `packages/schemas` — Zod v4.4.3 schemas
- `packages/cli` — CLI tools
- `packages/dnas` — Pre-built DNA patterns
- `packages/mcp-server` — MCP server for AI agents
- `apps/web` — Next.js 15 dashboard

## Code Conventions

- **Formatter/Linter:** Biome v2.5.3
- **TypeScript:** strict mode, ES2022, ESNext modules
- **Schemas:** Zod v4.4.3 — all types must have a corresponding schema
- **DNA Files:** YAML in `dnas/` — must validate against DNA schema
- **Testing:** Vitest with globals, node environment

## Key Patterns

- Every agent action goes through governance evaluation
- Quality gates enforce coverage, lint, typecheck, security
- Audit trail records every decision
- Learning engine detects patterns and auto-applies fixes
- Missions follow lifecycle: draft → executing → completed/failed

## Available MCP Tools

When working on this project, you can use these BehaviorOS MCP tools:
- `create-mission`, `evaluate-governance`, `run-audit`, `record-learning`, `get-status`
- `bos_select_dna`, `bos_resolve_conflict`, `bos_check_escalation`
- `bos_run_audit`, `bos_lsp_diagnostics`, `bos_lsp_validate`
