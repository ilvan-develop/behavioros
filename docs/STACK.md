# BehaviorOS Stack Files

> **Version:** 1.0.0  
> **Status:** Canonical  
> **Last Updated:** July 2026

---

## What is a Stack File?

A **stack file** (`stack.yaml`) is a declarative configuration file that captures the full state of a BehaviorOS ecosystem. It defines which agents, skills, MCPs, design systems, and DNA packages should be active in a project — making ecosystem configuration reproducible, portable, and version-controllable.

Think of it as `docker-compose.yaml` for the BehaviorOS ecosystem.

### Why Use Stack Files?

| Benefit | Description |
|---------|-------------|
| **Reproducibility** | Same stack file = same ecosystem state, every time |
| **Portability** | Share your ecosystem config across machines and teams |
| **Version Control** | Track ecosystem changes in git alongside your code |
| **CI/CD Integration** | Restore ecosystem state in CI pipelines |
| **Onboarding** | New team members get the exact same tools with one command |

---

## Format Reference

A `stack.yaml` file uses the following format:

```yaml
# BehaviorOS Stack File
# Generated: Thu Jul 20 2026 12:00:00 GMT+0100

project: my-project

# ─── DNA Packages ──────────────────────────────────────────
dnas:
  - id: enterprise-governance
    version: "1.0.0"
    active: true

  - id: surgical-team
    version: "0.2.0"
    active: true

  - id: manufacturing
    version: "0.3.0"
    active: false

# ─── Agents ────────────────────────────────────────────────
agents:
  - id: orchestrator
    status: active
    skills:
      - delegation
      - mission-management
      - audit

  - id: backend-agent
    status: active
    skills:
      - typescript
      - nodejs
      - api-design
      - database

  - id: qa-agent
    status: idle
    skills:
      - testing
      - vitest
      - playwright

# ─── Skills ────────────────────────────────────────────────
skills:
  - id: context7-mcp
    source: local
    version: "1.0.0"
    status: active

  - id: enterprise-backend
    source: aitmpl
    category: development
    version: "2.1.0"
    status: active

# ─── MCPs ──────────────────────────────────────────────────
mcps:
  - id: github-mcp
    type: mcp
    status: connected
    transport: stdio

  - id: postgres-mcp
    type: mcp
    status: connected
    transport: stdio

# ─── Design Systems ────────────────────────────────────────
design-systems:
  - id: shadcn-ui
    type: design-system
    status: installed
    tokens: 285
```

### Top-Level Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `project` | Yes | `string` | Project identifier |
| `dnas` | No | `array` | List of DNA packages |
| `agents` | No | `array` | List of agents and their skills |
| `skills` | No | `array` | List of installed skills |
| `mcps` | No | `array` | List of MCP connections |
| `design-systems` | No | `array` | List of installed design systems |

### DNA Entry Format

```yaml
dnas:
  - id: <string>         # DNA package identifier
    version: <string>    # Semantic version
    active: <boolean>    # Whether this DNA is currently active
```

### Agent Entry Format

```yaml
agents:
  - id: <string>         # Agent identifier
    status: <string>     # active | idle | error
    skills:              # List of skill IDs
      - <string>
```

### Skill Entry Format

```yaml
skills:
  - id: <string>         # Skill identifier
    source: <string>     # local | aitmpl | open-design
    category: <string>   # Only for aitmpl: category path
    version: <string>    # Semantic version
    status: <string>     # active | inactive | error
```

### MCP Entry Format

```yaml
mcps:
  - id: <string>         # MCP server identifier
    type: mcp            # Always "mcp"
    status: <string>     # connected | disconnected | error
    transport: <string>  # stdio | sse | websocket
```

### Design System Entry Format

```yaml
design-systems:
  - id: <string>         # Design system identifier
    type: design-system  # Always "design-system"
    status: <string>     # installed | not-installed
    tokens: <number>     # Number of design tokens
```

---

## CLI Commands

### `behavioros ecosystem stack init`

Generate a `stack.yaml` from the current ecosystem state:

```bash
npx @behavioros/cli ecosystem stack init
```

This command:
1. Queries the `EcosystemRegistry` for current state
2. Collects all agents, skills, MCPs, DNAs, and design systems
3. Writes a `stack.yaml` file to the current directory

**Output:**
```
✔ Generated stack.yaml
```

### `behavioros ecosystem stack apply`

Apply a `stack.yaml` file to restore ecosystem state:

```bash
npx @behavioros/cli ecosystem stack apply --file ./stack.yaml
```

This command:
1. Reads and parses the `stack.yaml` file
2. Validates the structure
3. Applies the configuration to the local ecosystem

**Options:**
- `-f, --file <file>` — Path to `stack.yaml` (required)

**Output:**
```
✔ Stack applied: my-project
```

---

## Example Stack Files

### Minimal Stack

```yaml
project: minimal-project
dnas:
  - id: enterprise-governance
    version: "1.0.0"
    active: true
```

### Full Production Stack

```yaml
project: finpay-production

dnas:
  - id: enterprise-governance
    version: "1.0.0"
    active: true
  - id: surgical-team
    version: "0.2.0"
    active: true

agents:
  - id: orchestrator
    status: active
    skills:
      - delegation
      - mission-management
  - id: payments-agent
    status: active
    skills:
      - payment-processing
      - stripe
      - fraud-detection
  - id: backend-agent
    status: active
    skills:
      - typescript
      - api-design
      - database
  - id: qa-agent
    status: active
    skills:
      - testing
      - e2e-tests
  - id: security-agent
    status: idle
    skills:
      - security-review
      - vulnerability-scanning

skills:
  - id: enterprise-backend
    source: aitmpl
    category: development
    version: "2.1.0"
    status: active
  - id: enterprise-security
    source: aitmpl
    category: security
    version: "1.5.0"
    status: active
  - id: context7-mcp
    source: local
    version: "1.0.0"
    status: active

mcps:
  - id: github-mcp
    type: mcp
    status: connected
    transport: stdio
  - id: postgres-mcp
    type: mcp
    status: connected
    transport: stdio

design-systems:
  - id: shadcn-ui
    type: design-system
    status: installed
    tokens: 285
```

### Research Lab Stack

```yaml
project: ai-research-lab

dnas:
  - id: research-default
    version: "0.1.0"
    active: true

agents:
  - id: research-agent
    status: active
    skills:
      - data-analysis
      - python
      - paper-review

skills:
  - id: context7-mcp
    source: local
    version: "1.0.0"
    status: active
```

---

## Best Practices

1. **Commit stack.yaml to version control** — Treat it like `package.json` or `docker-compose.yaml`
2. **Use `stack init` to bootstrap** — Start with `ecosystem stack init` then customize
3. **Keep versions pinned** — Always specify versions for reproducibility
4. **Separate stacks per environment** — Different `stack.yaml` for dev, staging, production
5. **Stack + DNA = Full Reproducibility** — Stack captures ecosystem components, DNA captures behavioral governance
