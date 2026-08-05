# Windsurf Integration — Status: Full (native file edits genuinely gated)

Researched and live-verified against Windsurf's published Cascade Hooks reference on
2026-08-05. Unlike Cursor and Codex, Windsurf is the one platform in this repo where
BehaviorOS's protocol hook can actually block a native file edit before it lands.

## The short version

Windsurf's Cascade Hooks (`.windsurf/hooks.json`, workspace-level) include `pre_write_code`
— a real pre-emptive hook that fires before Cascade modifies a file, can exit code 2 to
deny the edit, and does deny it (not just log it). That's a strictly better position than
Cursor (`afterFileEdit` is informational-only, no `beforeFileEdit` event exists) or Codex
(hooks only intercept the `Bash` tool). See [CURSOR-INTEGRATION.md](CURSOR-INTEGRATION.md)
and [CODEX-INTEGRATION.md](CODEX-INTEGRATION.md) for those gaps.

## What's wired

`.windsurf/hooks.json` in this repo registers `scripts/validate-protocol.js` against three
events:

- **`pre_write_code`** — fires before any file edit. Payload:
  `{ agent_action_name: 'pre_write_code', tool_info: { file_path, edits } }`. Treated as an
  implicit file-edit call by `classifyCall()` in `scripts/validate-protocol.js`.
- **`pre_run_command`** — fires before a terminal command. Payload:
  `{ agent_action_name: 'pre_run_command', tool_info: { command_line, cwd } }`. Treated as
  an implicit `Bash` call.
- **`pre_mcp_tool_use`** — fires before an MCP tool call. Payload:
  `{ agent_action_name: 'pre_mcp_tool_use', tool_info: { mcp_server_name, mcp_tool_name,
  mcp_tool_arguments } }`. BehaviorOS's own tools (`mcp_server_name === 'behavioros'`) are
  exempted from re-gating here — they're already self-gated in-process by
  `EnforcementMiddleware`, and re-gating them would create a chicken-and-egg deadlock
  (`bos_select_dna` blocked by a check that itself requires `bos_select_dna` to have run).

Exit code 2 blocks the action for all three events (per Windsurf's own hook contract: "for
pre-hooks, this blocks the action"). Verified via `scripts/test-enforcement-e2e.mjs`, which
spawns the real script with Windsurf-shaped payloads and asserts on its exit code.

## What's NOT covered

`pre_read_code` and `pre_user_prompt` are not wired — reads aren't part of the enforcement
surface (matches every other platform in this repo), and gating prompts themselves is out
of scope for protocol-order enforcement.

## Recheck this later

Cascade Hooks are a relatively new addition (v1.12.41+). Re-run the research behind this
doc before assuming the event names and payload shape are still accurate.

Sources: [Cascade Hooks — Windsurf docs](https://docs.windsurf.com/windsurf/cascade/hooks),
[Windsurf SWE-1.5 & Cascade Hooks: Complete Developer Guide](https://www.digitalapplied.com/blog/windsurf-swe-1-5-cascade-hooks-november-2025).
