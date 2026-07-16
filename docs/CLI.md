# BehaviorOS CLI

Command-line interface for BehaviorOS.

## Installation

```bash
pnpm add -g @behavioros/cli
```

Or use directly via npx:

```bash
npx @behavioros/cli <command>
```

## Commands

### `init`

Scaffold a new `.behavioros` configuration directory.

```bash
npx @behavioros/cli init
```

Creates:
- `.behavioros/config.yaml` — Default configuration
- `.behavioros/dnas/` — DNA packages directory

### `compile`

Compile DNA packages and validate their structure.

```bash
npx @behavioros/cli compile [path]
```

Arguments:
- `[path]` — Path to DNA file (optional, auto-discovers `behavioros.yaml`)

Options:
- `-o, --output <dir>` — Output directory for compiled DNA (default: `./generated`)
- `-n, --dry-run` — Show what would be generated without writing files
- `-v, --verbose` — Show detailed output

### `validate`

Validate DNA configurations against schemas.

```bash
npx @behavioros/cli validate [path]
```

Arguments:
- `[path]` — Path to DNA file (optional, auto-discovers `behavioros.yaml`)

### `status`

Show the current project status (agents, rules, gates).

```bash
npx @behavioros/cli status
```

Displays:
- DNA package info (name, version, description, author)
- Agents table (role, authority, name, skills)
- Governance rules table (id, name, level, action)
- Quality gates table (id, name, type, threshold)
- Patterns table (id, name, type, triggers)
- Workflows table (id, name, type, agent)
- Validation status (valid/invalid, errors, warnings)
- Summary counts

### `version`

Display the BehaviorOS version. This is a `--version` flag, not a subcommand.

```bash
npx @behavioros/cli --version
```

### `diff`

Compare two DNA files and show differences in governance, quality gates, and patterns.

```bash
npx @behavioros/cli diff --from <dna1> --to <dna2>
```

Options:
- `--from <dna1>` — Path to the source DNA file (required)
- `--to <dna2>` — Path to the target DNA file (required)

### `simulate`

Simulate a prompt against a DNA configuration and show layer pass/fail results.

```bash
npx @behavioros/cli simulate --dna <dna-file> --prompt <prompt-file>
```

Options:
- `--dna <dna-file>` — Path to the DNA configuration file (required)
- `--prompt <prompt-file>` — Path to the prompt file to simulate (required)
- `--model <model-name>` — Model name to simulate with (default: `default`)

### `deploy`

Deploy a DNA configuration with canary rollout, health monitoring, and auto-rollback.

```bash
npx @behavioros/cli deploy --dna <dna-file>
```

Options:
- `--dna <dna-file>` — Path to the DNA configuration file to deploy (required)
- `--env <environment>` — Target environment (default: `staging`)
- `--canary <percentage>` — Initial canary traffic percentage (default: `5`)
- `--stable <version>` — Current stable version (default: `1.0.0`)
- `--version <version>` — Version to deploy as canary (default: `1.1.0`)
- `--dry-run` — Show deployment plan without executing

### `drift-check`

Check for behavioral drift between a current DNA and a baseline, with recommendations.

```bash
npx @behavioros/cli drift-check --dna <dna-file> --baseline <baseline-file>
```

Options:
- `--dna <dna-file>` — Path to the current DNA configuration (required)
- `--baseline <baseline-file>` — Path to the baseline DNA file (required)

## Configuration

The CLI uses [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) for configuration discovery. It searches for:

1. `.behaviorosrc` (JSON or YAML)
2. `.behaviorosrc.json`
3. `.behaviorosrc.yaml`
4. `.behaviorosrc.yml`
5. `.behaviorosrc.js`
6. `behavioros.config.js`
7. `behavioros` key in `package.json`

### Configuration File Format

```yaml
# .behavioros/config.yaml
dna:
  path: ./dnas/enterprise-governance.yaml
  options:
    basePath: .

governance:
  enabled: true
  level: standard
  requireApproval: true

quality:
  enabled: true
  minCoverage: 80
  enforceTypecheck: true
  enforceLint: true

learning:
  enabled: true
  autoApply: false

audit:
  enabled: true

output:
  dir: .behavioros/reports
```

## Environment Variables

The CLI reads environment variables from `.env` files:

```bash
BEHAVIOROS_DNA_PATH=./dnas/custom.yaml    # Override DNA path
BEHAVIOROS_LOG_LEVEL=debug                # Set log level
```

## Examples

```bash
# Initialize a new project
npx @behavioros/cli init

# Validate a specific DNA
npx @behavioros/cli validate ./dnas/military-operations.yaml

# Compile all DNAs
npx @behavioros/cli compile --dna ./dnas/

# Check system status
npx @behavioros/cli status
```
