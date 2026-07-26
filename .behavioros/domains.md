# BehaviorOS Domains

## Core Domain
- Package: packages/core
- Responsibility: 7 engines, pipeline, schemas
- Key Files: engines/*.ts, pipeline/*.ts, schemas/*.ts

## MCP Domain
- Package: packages/mcp-server
- Responsibility: 37+ tools exposed to AI agents
- Key Files: tools/*.ts, server.ts, index.ts

## SDK Domain
- Package: packages/sdk
- Responsibility: High-level API for BehaviorOS
- Key Files: src/*.ts

## CLI Domain
- Package: packages/cli
- Responsibility: Command-line interface
- Key Files: src/*.ts

## DNAs Domain
- Package: packages/dnas
- Responsibility: Pre-built DNA patterns
- Key Files: *.yaml

## E2E Domain
- Package: packages/e2e-tests
- Responsibility: Protocol compliance tests
- Key Files: src/**/*.spec.ts

## Kernel Absoluto Domain
- Responsibility: Context coverage, memory, recovery, self-healing
- Key Files: coverage-engine.ts, memory-engine.ts, recovery/context-recovery-engine.ts, quality/self-healing-engine.ts
