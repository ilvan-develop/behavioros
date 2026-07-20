# Contributing to BehaviorOS

## Development Setup

```bash
git clone https://github.com/ilvan-develop/behavioros.git
cd behavioros
pnpm install
pnpm build
pnpm test
```

## Project Structure

| Package | Description |
|---|---|
| `packages/schemas` | Zod schemas for all types |
| `packages/core` | 7 behavioral engines |
| `packages/sdk` | High-level TypeScript SDK |
| `packages/cli` | Command-line interface |
| `packages/mcp-server` | MCP server for AI agents |
| `packages/dnas` | DNA pattern catalog |
| `packages/observability-dashboard` | Monitoring dashboards |

## Code Conventions

- **Formatter:** Biome (2 spaces, single quotes, trailing commas)
- **TypeScript:** strict mode, ES2022 target
- **Testing:** Vitest with global test setup
- **Commits:** Conventional commits (feat, fix, chore, docs)

## Pull Request Process

1. Run `pnpm lint:check` and `pnpm typecheck` before committing
2. Add tests for new features
3. Update docs if changing public API
4. Run `pnpm test` to ensure all tests pass

## DNA Patterns

To add a new DNA pattern:
1. Create a YAML file in `packages/dnas/catalog/`
2. Follow the schema in `packages/schemas/`
3. Add persona, governance rules, quality gates
4. Add tests in `packages/dnas/src/__tests__/`
