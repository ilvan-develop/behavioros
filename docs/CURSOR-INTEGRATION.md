# Cursor Integration — Status: Partial (shell + MCP gated, file edits not)

Researched and live-verified against Cursor's published hook schema on 2026-08-05. Honest
status, not aspirational — if you're deciding whether to rely on BehaviorOS's deterministic
enforcement inside Cursor today, read this first.

## The short version

`.cursor/hooks.json` is the correct, real location for Cursor hooks (unlike Claude Code's
initial misconfiguration found earlier in this project's own history — Cursor doesn't have
that particular trap). But Cursor's hook event model has a structural gap that no amount of
correct configuration closes:

**No Cursor hook can block a native file edit before it happens.** Cursor's own hook
reference lists exactly two events that can deny an action pre-emptively —
`beforeShellExecution` and `beforeMCPExecution` — plus `beforeReadFile`/`beforeTabFileRead`
for blocking reads. `afterFileEdit` exists, but it fires *after* the edit has already landed
and is documented as informational only: it cannot return a `permission: deny`, show the
user a message, or stop the agent. There is no `beforeFileEdit` event at all.

This mirrors the gap found in Codex CLI (see [CODEX-INTEGRATION.md](CODEX-INTEGRATION.md)) —
different platform, same shape of limitation: shell commands are interceptable, native
file-editing is not.

## What does still work in Cursor

1. **MCP tool calls** (`bos_select_dna`, `create-mission`, `bos_run_audit`, etc.) are already
   gated in-process by `EnforcementMiddleware` inside the MCP server itself, independent of
   any Cursor hook. This is real today regardless of hook configuration.
2. **Shell commands**, via `beforeShellExecution` — this repo's `.cursor/hooks.json` wires it
   to `scripts/validate-protocol.js`, the same script Claude Code uses for its `PreToolUse`
   hook. Cursor's `beforeShellExecution` payload has no `tool_name` field (it only ever fires
   for a shell command), so the script treats a bare `{ command }` payload as an implicit
   `Bash` call and applies the same protocol-order and tamper checks. Verified via
   `scripts/test-enforcement-e2e.mjs`, which spawns the real script with a
   Cursor-shaped payload and asserts on its exit code.
3. **`beforeMCPExecution`** is also wired to the same script, mostly for defense in depth —
   in Cursor it only ever sees MCP-routed tool calls (which are already covered by point 1),
   so this hook is largely redundant there, unlike in Claude Code where the equivalent
   `PreToolUse` event is the *only* interception point for native Edit/Write/Bash tools.

## What's NOT covered

An agent using Cursor's native Edit/Write/Apply tools directly — the normal way Cursor's
agent makes changes — bypasses all of the above. `afterFileEdit` (wired to
`scripts/validate-dna.js` in this repo) runs after the fact and can surface a correct exit
code for any tooling that inspects it, but per Cursor's own documentation it cannot stop the
agent or show a message. There is currently no way to intercept a native file edit in Cursor
before it happens.

If your team's workflow goes entirely through BehaviorOS's own MCP tools (an orchestrator
that calls `create-mission` before delegating, rather than editing directly), the in-process
gate is real protection. If an agent decides to skip the MCP tools and edit natively, Cursor
gives BehaviorOS no hook to stop it — the same shape of gap Codex has for its Apply-Patch tool.

## Recheck this later

Cursor's hooks system is actively evolving (it shipped Tab-specific hooks and
`postToolUseFailure` recently). Re-run the research behind this doc before assuming the
"no before-edit hook" limitation is still accurate — that's exactly the kind of gap a
platform closes in a later release.

Sources: [Cursor Hooks reference](https://cursor.com/docs/hooks.md), [Deep Dive into the new
Cursor Hooks — Butler's Log](https://blog.gitbutler.com/cursor-hooks-deep-dive), [Cursor:
shell command logging and gating — gist](https://gist.github.com/alejo4373/ea9bc4dc47c0d13ab64a926b5e44019f).
