# VS Code Copilot Integration — Status: Unverified (likely partial)

Researched (not live-verified — no VS Code Copilot instance was available to test against,
unlike Claude Code, which this repo's live-verification suite actually exercises) on
2026-08-05. Read this before trusting deterministic enforcement here in production.

## The short version

VS Code Copilot's agent-mode hooks are new (Preview, per Microsoft's own docs) and, per
multiple secondary sources, share `.claude/settings.json` as a valid workspace-level
config location alongside `.github/hooks/*.json`, using the same `PreToolUse` event name,
`tool_name`/`tool_input` payload fields, and exit-code-2-blocks contract as Claude Code.
If that's accurate, **this repo's existing `.claude/settings.json` (already wired for
Claude Code) may already provide real protection for VS Code Copilot, for free.**

That claim comes from AI-summarized secondary sources cross-referencing Microsoft's and
GitHub's docs, not a first-party page enumerating VS Code's exact native tool names for
its Copilot agent mode. The one piece this repo genuinely doesn't know: whether Copilot's
agent-mode tool names for "edit a file" / "run a terminal command" are literally `Edit` /
`Bash` (Claude Code's names, which `scripts/validate-protocol.js` already recognizes) or
something else (`editFiles`, `createFile`, `runInTerminal` appeared in some sources).

## What this repo does about the uncertainty

`scripts/validate-protocol.js`'s `EDIT_TOOL_NAMES` / `BASH_TOOL_NAMES` sets include the
Claude Code names (verified) plus a curated set of plausible Copilot aliases
(`editFiles`, `createFile`, `edit_file`, `create_file`, `apply_patch`, `runInTerminal`,
`runCommands`, `runTerminalCommand`, `run_terminal_command`) marked inline as unverified.
If Copilot's real tool names match one of these, the hook blocks correctly. If they don't,
the hook silently never fires for Copilot's native edits — same failure mode this repo
found and fixed for Claude Code, Cursor, and Windsurf earlier, just not yet confirmed
closed here.

## What's confirmed independent of the above

MCP tool calls (`bos_select_dna`, `create-mission`, etc.) are gated in-process by
`EnforcementMiddleware` regardless of hook configuration or tool-name guessing — that
protection is real today if your workflow goes through BehaviorOS's own MCP tools.

## Recheck this later — this one specifically needs a live test

Unlike Cursor and Windsurf (verified against detailed first-party docs) and Codex
(verified as fundamentally limited), this integration has not been checked against a real
VS Code Copilot session actually invoking `Edit`/`editFiles`/etc. and inspecting what
`tool_name` a `PreToolUse`/`preToolUse` hook actually receives. Do that before relying on
this in production — it's the one gap in this repo's per-platform verification.

Sources: [VS Code Agent hooks (Preview)](https://code.visualstudio.com/docs/agent-customization/hooks),
[GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference).
