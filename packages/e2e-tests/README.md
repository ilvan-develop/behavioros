# BehaviorOS E2E Test Suite

End-to-end tests for the BehaviorOS MCP protocol flow, using an in-memory MCP server.

## Quick Start

```bash
# From project root
cd packages/e2e-tests

# Run Vitest protocol flow test
npx vitest run src/protocol/protocol.flow.spec.ts

# Run E2E runner (standalone)
node src/run-protocol-flow.mjs

# Run all Playwright tests
pnpm test
```

## Architecture

```
src/
├── helpers/
│   ├── createTestMcp.mjs      # In-memory MCP server + client factory
│   └── createTestMcp.ts       # TypeScript version (same API)
├── protocol/
│   └── protocol.flow.spec.ts  # Vitest spec: full 7-step protocol
├── run-protocol-flow.mjs      # Standalone runner (no test framework)
├── behavioros/                # Playwright browser tests
└── finpay/                    # FinPay-specific integration tests
```

## Protocol Flow Tested

The E2E suite exercises all 7 mandatory BehaviorOS protocol steps:

1. **`bos_select_dna`** — Selects behavioral DNA pattern (e.g., `manufacturing`)
2. **`bos_resolve_truth`** — Resolves truth sources + library docs
3. **`create-mission`** — Creates traceable mission entity
4. **`bos_run_audit`** — Runs lint + typecheck audit pipeline
5. **`record-learning`** — Records learning event

## Running from Project Root

```bash
# Vitest (recommended for CI)
pnpm --filter @behavioros/e2e-tests test:unit

# Standalone runner
node packages/e2e-tests/src/run-protocol-flow.mjs
```

## Dependencies

- `@behavioros/core` (workspace)
- `@behavioros/schemas` (workspace)
- `@behavioros/sdk` (workspace)
- `@modelcontextprotocol/sdk` ^1.12.0
- `vitest` ^4.0.0

## Key Details

- **MCP SDK v1.12+**: Uses `{ name, arguments }` format for `callTool()`
- **In-memory transport**: No external MCP server needed
- **Trigger enum**: `bos_run_audit` accepts `commit | pr | merge | deploy_staging | deploy_production`
- **Learning types**: `observation | pattern | insight | feedback | correction`
