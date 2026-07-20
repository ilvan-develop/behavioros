# @behavioros/dnas

> Pre-built DNA (Deoxyribonucleic Algorithm) YAML pattern catalog for BehaviorOS behavioral governance

## Installation

```bash
pnpm add @behavioros/dnas
```

## Quick Start

```bash
npx @behavioros/cli validate ./dnas/enterprise-governance.yaml
npx @behavioros/cli diff --from ./dnas/lean-factory.yaml --to ./dnas/military-operations.yaml
```

## Available DNAs

| DNA | Description |
|-----|-------------|
| `enterprise-governance` | Enterprise-grade governance for regulated industries |
| `enterprise-agent-review` | 18-layer Enterprise Agent Architecture Review Guide (EAARG) |
| `military-operations` | Military-grade chain of command and mission execution |
| `surgical-team` | Zero-defect operations with sterile field protocols |
| `lean-factory` | Continuous improvement with kaizen events and 5S methodology |
| `full-featured` | All patterns enabled for maximum governance coverage |
| `minified` | Minimal governance for simple projects |
| `zero-config` | Zero-configuration DNA with sensible defaults |
| `governance-heavy` | Maximum governance rules for highly regulated environments |
| `patterns-only` | Behavioral patterns without governance or quality gates |
| `workflows-only` | Workflow definitions without personas or governance rules |

Full catalog reference: [docs/DNAs.md](../docs/DNAs.md)

## License

MIT © Ilvan Joaquim
