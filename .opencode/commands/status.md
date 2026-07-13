---
description: Show BehaviorOS system status across all engines
agent: build
---

Display the current BehaviorOS system status.

## Instructions

1. Check package versions across the monorepo
2. Verify all packages build successfully
3. Check test status
4. Report MCP server availability
5. Show DNA package inventory

## Status Report

Provide a comprehensive status including:

### Package Health
- `@behavioros/schemas` — Build status, test results
- `@behavioros/core` — Engine status, test results
- `@behavioros/sdk` — Build status, test results
- `@behavioros/cli` — Build status, test results
- `@behavioros/dnas` — DNA inventory, validation status
- `@behavioros/mcp-server` — Server status, tool count
- `@behavioros/web` — Build status

### Engine Status
- Behavioral Engine — DNA loaded, validation status
- Governance Engine — Rules active, evaluation count
- Decision Engine — Voting config, threshold status
- Audit Engine — Pipeline stages, last run results
- Quality Engine — Gates active, pass/fail status
- Learning Engine — Events recorded, patterns detected
- Mission Engine — Active missions, completion rate

### Quick Health Check
Run these commands to verify health:
```bash
pnpm lint:check
pnpm typecheck
pnpm test
pnpm build
```
