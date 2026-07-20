# BehaviorOS — Claude Integration

## Setup

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "node",
      "args": ["/absolute/path/to/behavioros/packages/mcp-server/dist/index.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
      }
    }
  }
}
```

## Available Tools

Once connected, you have access to 30+ BehaviorOS tools:

### Mission Management
- `create-mission` — Create a new mission
- `update-progress` — Update mission status
- `list-missions` — List all missions
- `list-agents` — List all agents
- `get-status` — System health check

### Governance
- `evaluate-governance` — Check rules before acting
- `bos_select_dna` — Select optimal DNA pattern
- `bos_resolve_conflict` — Resolve agent conflicts
- `bos_check_escalation` — Check if human approval needed

### Audit
- `run-audit` — Run quality pipeline
- `bos_run_audit` — Continuous audit chain
- `bos_lsp_diagnostics` — TypeScript/ESLint diagnostics
- `bos_lsp_validate` — Quality gate validation

### Learning
- `record-learning` — Capture insights
- `bos_get_insights` — System health insights
- `bos_resolve_truth` — DNA + docs for delegation
- `bos_list_patterns` — Available DNA patterns

## BehaviorOS Protocol

This project follows the BehaviorOS Delegation Protocol defined in `docs/PROTOCOL.md`.

### 7 Mandatory Steps

| # | Step | Tool | When |
|---|------|------|------|
| 1 | Select DNA | `bos_select_dna` | Before ANY task |
| 2 | Display DNA Block | Visual template | After step 1 |
| 3 | Resolve Truth | `bos_resolve_truth` | Before delegating |
| 4 | Create Mission | `create-mission` | Before starting work |
| 5 | Delegate | Task tool | To execute work |
| 6 | Run Audit | `bos_run_audit` | After completion |
| 7 | Record Learning | `record-learning` | At the end |

### Critical Rules

- Call `bos_select_dna` before every single task — no exceptions
- Show the DNA block to the human every time
- Never edit files directly — always delegate
- Always run `bos_run_audit` before marking a mission complete
- Record learning events at the end of every mission

## Usage

Ask Claude to:
- "Create a mission to implement the auth module"
- "Evaluate governance for a production deployment"
- "Run audit on my project"
- "Select the best DNA pattern for a security review"
