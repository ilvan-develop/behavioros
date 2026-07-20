# @behavioros/cli

> Command-line interface for BehaviorOS — validate, compile, status, init, diff, simulate, deploy, drift-check

## Installation

```bash
pnpm add -g @behavioros/cli
```

## Quick Start

```bash
npx @behavioros/cli validate ./dnas/enterprise-governance.yaml
npx @behavioros/cli status
```

## API

| Command | Description |
|---------|-------------|
| `init` | Scaffold a new `.behavioros` configuration directory |
| `compile` | Compile DNA packages and validate their structure |
| `validate` | Validate DNA configurations against Zod schemas |
| `status` | Show project status (agents, rules, gates, patterns, workflows) |
| `diff` | Compare two DNA files and show governance and quality gate differences |
| `simulate` | Simulate a prompt against a DNA configuration and show layer results |
| `deploy` | Deploy DNA with canary rollout, health monitoring, and auto-rollback |
| `drift-check` | Check behavioral drift between current DNA and a baseline |

Full CLI reference: [docs/CLI.md](../docs/CLI.md)

## License

MIT © Ilvan Joaquim
