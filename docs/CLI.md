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

### `enforce`

Verify protocol compliance and diagnose issues in the current project.

```bash
npx @behavioros/cli enforce check
npx @behavioros/cli enforce doctor
```

**`check`** — Scans the project for protocol adherence (MCP server config, DNA files, agents, quality gates). Returns a compliance report with pass/fail per requirement.

```bash
$ npx @behavioros/cli enforce check
╔══════════════════════════════════════════════════╗
║ BehaviorOS Protocol Compliance Report            ║
╠══════════════════════════════════════════════════╣
║ MCP Server    ✓ Configured (stdio)               ║
║ DNA Files     ✓ 3 valid patterns loaded          ║
║ Quality Gates ✓ 5 gates configured               ║
║ Agents        ✗ No orchestrator agent found      ║
║ Rules         ✓ 12 governance rules active       ║
╠══════════════════════════════════════════════════╣
║ Status: FAIL — 1 issue(s) found                  ║
╚══════════════════════════════════════════════════╝
```

**`doctor`** — Analyzes issues found by `check` and provides actionable fix suggestions.

### `diff`

Detect behavioral deviations between two DNA YAML files.

```bash
npx @behavioros/cli diff --from baseline.yaml --to current.yaml
```

Options:
- `--from <file>` — Path to the baseline DNA file (required)
- `--to <file>` — Path to the current DNA file (required)

Use before DNA merges and configuration audits to identify drift in governance rules, quality gates, patterns, and personas.

### `--version`

Display the current CLI version. There is no `version` subcommand — this is a global flag,
and there is no built-in update-check (no registry-query equivalent to `--check`).

```bash
npx @behavioros/cli --version
```

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

### `ecosystem`

Manage the BehaviorOS ecosystem — skills, MCP servers, design systems, and DNAs.

```bash
npx @behavioros/cli ecosystem [subcommand]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `status` | Show full ecosystem status (agents, skills, MCPs, design systems, DNAs) |
| `install` | Install a component from any source |
| `uninstall` | Remove an installed component |
| `sync` | Sync registry with external sources (dna, local, aitmpl) |
| `doctor` | Run full ecosystem diagnostics and health check |
| `report` | Generate ecosystem report in various formats |
| `stack init` | Generate `stack.yaml` from current ecosystem state |
| `stack apply` | Apply a `stack.yaml` file to restore ecosystem state |

#### `ecosystem status`

```bash
npx @behavioros/cli ecosystem status
```

Displays a summary of the entire ecosystem:
- Active/total agents
- Installed skills
- Connected MCPs
- Installed design systems
- Loaded/active DNA packages

#### `ecosystem install`

```bash
npx @behavioros/cli ecosystem install --type <type> --id <id> [--source <source>] [--category <category>]
```

Options:
- `-t, --type <type>` — Component type: `skill`, `mcp`, `design-system` (required)
- `-i, --id <id>` — Component ID (required)
- `-s, --source <source>` — Source: `aitmpl`, `open-design`, `local` (default: `aitmpl`)
- `-c, --category <category>` — Category for AITMPL (e.g. `development`, `security`)

Examples:
```bash
npx @behavioros/cli ecosystem install --type skill --id enterprise-backend --source aitmpl --category development
npx @behavioros/cli ecosystem install --type mcp --id github-mcp --source aitmpl
npx @behavioros/cli ecosystem install --type design-system --id shadcn-ui --source open-design
```

#### `ecosystem uninstall`

```bash
npx @behavioros/cli ecosystem uninstall --id <id>
```

Options:
- `-i, --id <id>` — Component ID to uninstall (required)

#### `ecosystem sync`

```bash
npx @behavioros/cli ecosystem sync [--source <source>]
```

Options:
- `-s, --source <source>` — Source to sync: `dna`, `local`, `aitmpl`, `all` (default: `all`)

#### `ecosystem doctor`

```bash
npx @behavioros/cli ecosystem doctor
```

Runs full diagnostics across all ecosystem engines and reports health status for each. Displays:
- Engine status table (healthy/issues/error per engine)
- Stats summary (total components, active components, agents, DNA packages, issues)

#### `ecosystem report`

```bash
npx @behavioros/cli ecosystem report [--format <format>]
```

Options:
- `-f, --format <format>` — Output format: `md`, `json`, `html` (default: `md`)

Generates a comprehensive ecosystem report with agents, skills, MCPs, DNAs, and design systems in the requested format.

#### `ecosystem stack init`

```bash
npx @behavioros/cli ecosystem stack init
```

Generates a `stack.yaml` file from the current ecosystem state for reproducibility.

#### `ecosystem stack apply`

```bash
npx @behavioros/cli ecosystem stack apply --file <path>
```

Options:
- `-f, --file <file>` — Path to `stack.yaml` (required)

Applies a `stack.yaml` file to restore the ecosystem to a previous state.

### `agent`

Manage agents and their skills.

```bash
npx @behavioros/cli agent [subcommand]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `list` | List all agents with status and skill counts |
| `skills` | Show skills for a specific agent |
| `validate` | Validate that an agent has required skills |

#### `agent list`

```bash
npx @behavioros/cli agent list
```

Displays a table of all registered agents with their status and skill counts:

```
Agents:
┌─────────────────┬──────────┬───────┐
│ ID              │ Status   │ Skills│
├─────────────────┼──────────┼───────┤
│ orchestrator    │ active   │ 5     │
│ backend-agent   │ active   │ 12    │
│ qa-agent        │ idle     │ 8     │
└─────────────────┴──────────┴───────┘
```

#### `agent skills`

```bash
npx @behavioros/cli agent skills --id <agent-id>
```

Options:
- `-i, --id <id>` — Agent ID (required)

Shows detailed skill information for a specific agent.

#### `agent validate`

```bash
npx @behavioros/cli agent validate --id <agent-id> --skills <skill-ids...>
```

Options:
- `-i, --id <id>` — Agent ID (required)
- `-s, --skills <skills...>` — Required skill IDs (required)

Validates that an agent has all required skills before delegating a task.

### `autonomous`

Run autonomous agent orchestration — BehaviorOS's autonomous task processing engine.

```bash
npx @behavioros/cli autonomous [subcommand]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `run` | Run a task through the autonomous orchestrator |
| `status` | Show autonomous orchestration status |
| `handoffs` | List active agent handoffs |

#### `autonomous run`

```bash
npx @behavioros/cli autonomous run --title <title> [--type <type>] [--priority <priority>] [--description <description>]
```

Options:
- `-t, --title <title>` — Mission title (required)
- `--type <type>` — Mission type: `feature`, `bugfix`, `refactor`, `security`, `deploy`, `research` (default: `feature`)
- `-p, --priority <priority>` — Mission priority: `critical`, `high`, `medium`, `low` (default: `medium`)
- `-d, --description <description>` — Mission description

Runs a task through the full autonomous pipeline:
1. Task decomposition into subtasks
2. Skill-based routing to agents
3. Handoff protocol execution
4. Lifecycle pipeline (governance, quality, audit)
5. Completion reporting

Displays a comprehensive report:
```
╔══════════════════════════════════════════════════╗
║  AUTONOMOUS MISSION REPORT                       ║
╚══════════════════════════════════════════════════╝

  Title:    Implement payment module
  Mission:  a1b2c3d4-e5f6-...
  Status:   completed
  Type:     feature
  Priority: critical

Subtasks:
┌──────────┬─────────────────────────┬───────────┬──────────┐
│ ID       │ Title                   │ Status    │ Agent    │
├──────────┼─────────────────────────┼───────────┼──────────┤
│ sub-1234 │ Create Prisma schema    │ completed │ backend  │
│ sub-5678 │ Implement API endpoints │ completed │ backend  │
└──────────┴─────────────────────────┴───────────┴──────────┘

Routing:
┌──────────┬──────────┬────────────┬──────────────────┐
│ Subtask  │ Agent    │ Confidence │ Strategy          │
├──────────┼──────────┼────────────┼──────────────────┤
│ sub-1234 │ backend  │ 85%        │ capability-match │
└──────────┴──────────┴────────────┴──────────────────┘

Ecosystem:
  Agents:  3
  Skills:  24
  MCPs:    5
  DNAs:    3
```

#### `autonomous status`

```bash
npx @behavioros/cli autonomous status
```

Shows the current state of the autonomous orchestrator:
- Number of agents, skills, MCPs, design systems, DNA packages
- Per-agent status and skill counts

#### `autonomous handoffs`

```bash
npx @behavioros/cli autonomous handoffs
```

Lists all active agent handoffs with their current status and mission context.

### `protocol`

Check and manage BehaviorOS protocol enforcement.

```bash
npx @behavioros/cli protocol [subcommand]
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `check` | Verify protocol is active and enforced |
| `enforce` | Set enforcement level |
| `status` | Show detailed protocol enforcement status |

#### `protocol check`

```bash
npx @behavioros/cli protocol check
```

Verifies protocol compliance by checking which steps have been completed:

```
Protocol Steps:
┌───┬────────────────────┬──────────────┬──────────────────────┐
│ # │ Step               │ Status       │ Tool                 │
├───┼────────────────────┼──────────────┼──────────────────────┤
│ 1 │ DNA Selected       │ ✓ Completed │ bos_select_dna       │
│ 2 │ Truth Resolved     │ ○ Pending   │ bos_resolve_truth    │
│ 3 │ Mission Created    │ ○ Pending   │ create-mission       │
│ 4 │ Audit Done         │ ○ Pending   │ bos_run_audit        │
│ 5 │ Learning Recorded  │ ○ Pending   │ record-learning      │
└───┴────────────────────┴──────────────┴──────────────────────┘

Enforcement:
  ○ 4 step(s) missing: Truth Resolve, Mission Created, Audit Done, Learning Recorded

Next Required Step:
  → Truth Resolve
```

#### `protocol enforce`

```bash
npx @behavioros/cli protocol enforce --level <level>
```

Options:
- `-l, --level <level>` — Enforcement level: `strict`, `standard`, `audit` (required)

Sets the enforcement level for protocol compliance:

| Level | Description |
|-------|-------------|
| **strict** | All steps are required — action tools blocked until protocol complete |
| **standard** | Critical steps required — warnings for non-critical skips |
| **audit** | All actions allowed — violations are logged for audit trail |

#### `protocol status`

```bash
npx @behavioros/cli protocol status
```

Shows detailed enforcement status with timestamps and step progression:

```
╔══════════════════════════════════════════════════════╗
║     BEHAVIOROS PROTOCOL ENFORCEMENT STATUS            ║
╚══════════════════════════════════════════════════════╝

  Current Step:    DNA Selected (1/5)
  Next Required:   Truth Resolve
  Overall Status:  Incomplete

  Steps:
    ✓ DNA Selected (bos_select_dna)
    ○ Truth Resolve (bos_resolve_truth)
    ○ Mission Created (create-mission)
    ○ Audit Done (bos_run_audit)
    ○ Learning Recorded (record-learning)

  Timestamps:
    DNA Selected: 7/20/2026, 12:00:00 PM

  Progress: 1/5 steps (20%)
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
npx @behavioros/cli compile ./dnas/

# Check system status
npx @behavioros/cli status

# Ecosystem management
npx @behavioros/cli ecosystem status
npx @behavioros/cli ecosystem doctor
npx @behavioros/cli ecosystem install --type skill --id enterprise-backend --source aitmpl --category development
npx @behavioros/cli ecosystem report --format html

# Agent management
npx @behavioros/cli agent list
npx @behavioros/cli agent skills --id orchestrator
npx @behavioros/cli agent validate --id backend-agent --skills typescript api-design

# Autonomous orchestration
npx @behavioros/cli autonomous run --title "Implement payment module" --type feature --priority high
npx @behavioros/cli autonomous status
npx @behavioros/cli autonomous handoffs

# Protocol enforcement
npx @behavioros/cli protocol check
npx @behavioros/cli protocol enforce --level strict
npx @behavioros/cli protocol status
```
