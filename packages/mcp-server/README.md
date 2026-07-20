# @behavioros/mcp-server

> MCP (Model Context Protocol) server for BehaviorOS — 27 tools + 5 resources for AI agent integration

## Installation

```bash
pnpm add @behavioros/mcp-server
```

## Quick Start

Configure in `opencode.json`:

```json
{
  "mcp": {
    "behavioros": {
      "command": "node",
      "args": ["path/to/@behavioros/mcp-server/dist/server.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml"
      }
    }
  }
}
```

## API

### Tools

| Tool | Description |
|------|-------------|
| `create-mission` | Create a new mission in BehaviorOS |
| `list-missions` | List missions with optional status filtering |
| `evaluate-governance` | Evaluate an action against governance rules |
| `run-audit` | Run the audit pipeline on a project |
| `record-learning` | Record a learning event |
| `get-status` | Get current system status |
| `list-agents` | List all registered agents |
| `start-pipeline` | Start an EAARG pipeline |
| `get-pipeline-status` | Get current pipeline status |

### Configuration

- **opencode**: Add to `opencode.json` (stdio transport)
- **cursor**: Configure in `.cursor/mcp.json`
- **vscode**: Add to `settings.json` under `mcp` key

## License

MIT © Ilvan Joaquim
