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

## Usage

Ask Claude to:
- "Create a mission to implement the auth module"
- "Evaluate governance for a production deployment"
- "Run audit on my project"
- "Select the best DNA pattern for a security review"
