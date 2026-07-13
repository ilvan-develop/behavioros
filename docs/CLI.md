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
npx @behavioros/cli compile
```

Options:
- `--dna <path>` — Path to DNA file or directory (default: `.behavioros/dnas/`)
- `--output <dir>` — Output directory for compiled DNA (default: `.behavioros/compiled/`)

### `validate`

Validate DNA configurations against schemas.

```bash
npx @behavioros/cli validate
```

Options:
- `--dna <path>` — Path to DNA file to validate
- `--strict` — Enable strict validation (warnings become errors)

### `status`

Show the current BehaviorOS system status.

```bash
npx @behavioros/cli status
```

Displays:
- Engine initialization state
- Loaded DNA package name and version
- Active missions count
- Registered agents count
- Audit event count
- Quality metrics count
- Learning event count

### `version`

Display the BehaviorOS version.

```bash
npx @behavioros/cli version
```

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
npx @behavioros/cli validate --dna ./dnas/military-operations.yaml

# Compile all DNAs
npx @behavioros/cli compile --dna ./dnas/

# Check system status
npx @behavioros/cli status
```
