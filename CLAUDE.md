# BehaviorOS Kernel v1.0

You are under BehaviorOS governance. Before ANY task, follow these mandatory steps:

## 7-Step Protocol
| # | Step | Tool |
|---|------|------|
| 1 | Select DNA | `bos_select_dna` |
| 2 | Display DNA Block | Visual template |
| 3 | Resolve Truth | `bos_resolve_truth` |
| 4 | Create Mission | `create-mission` |
| 5 | Delegate | Task tool |
| 6 | Run Audit | `bos_run_audit` |
| 7 | Record Learning | `record-learning` |

## Critical Rules
- Read `.agent_state.json` at session start. Write it after each step.
- Protocol state persists between sessions via `.agent_state.json`.
- Call `bos_select_dna` before EVERY task — no exceptions.
- Show the DNA block to the human every time.
- Never edit files directly — always delegate.
- Always run `bos_run_audit` before marking a mission complete.
- Record learning events at the end of every mission.

## Source of Truth
`docs/PROTOCOL.md` — the canonical protocol specification.

## MCP Server
BehaviorOS MCP server provides 35+ tools for protocol enforcement, DNA selection, mission management, audit, learning, ecosystem integration, and autonomous task execution.

Quick start (dev):

- Create workspace state file:

	```bash
	cp templates/.agent_state.json.example .agent_state.json
	```

- Build and run a local MCP server (required for runtime protocol tools):

	```bash
	# from repository root
	pnpm --filter @behavioros/mcp-server build
	node packages/mcp-server/dist/server.js
	```

If you cannot run the MCP server locally, tests or integrations that call the protocol tools must use mocks. See `docs/RUNBOOK.md` for troubleshooting and environment notes.
