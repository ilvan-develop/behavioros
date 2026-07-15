# Contributing to BehaviorOS

Thank you for your interest in contributing to BehaviorOS!

## Development Setup

### Prerequisites

- Node.js >= 22.0.0
- pnpm (install via `npm install -g pnpm`)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/ilvan-develop/behavioros.git
cd behavioros

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development
pnpm dev
```

## Project Structure

```
behavioros/
├── packages/
│   ├── core/          # 10 behavioral engines
│   ├── sdk/           # TypeScript SDK
│   ├── schemas/       # Zod schemas
│   ├── cli/           # CLI tools
│   ├── dnas/          # DNA pattern catalog
│   ├── mcp-server/    # MCP server (30+ tools)
│   └── web/           # Next.js dashboard (apps/web)
├── dnas/              # DNA YAML files
└── docs/              # Documentation
```

## Code Conventions

- **Formatter:** Biome (indent: 2, line width: 100, single quotes, trailing commas: all)
- **TypeScript:** strict mode, ES2022 target
- **Schemas:** All types must have a Zod schema in `@behavioros/schemas`
- **Tests:** Vitest with globals
- **Commits:** Conventional commits (feat, fix, chore, docs, etc.)

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Run `pnpm lint` and `pnpm typecheck`
4. Run `pnpm test` to ensure all tests pass
5. Submit your PR with a clear description

## Adding DNA Patterns

1. Create a YAML file in `dnas/` following the DNA schema
2. Validate with `npx @behavioros/cli validate --dna your-file.yaml`
3. Add tests in `packages/dnas/`
4. Submit a PR

## Reporting Issues

Use the [GitHub Issues](https://github.com/ilvan-develop/behavioros/issues) page to report bugs or request features.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
