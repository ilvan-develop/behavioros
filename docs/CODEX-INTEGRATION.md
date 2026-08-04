# Codex CLI Integration — Status: Not Recommended Yet

Researched 2026-08-04. Honest status, not aspirational — if you're deciding whether to rely on BehaviorOS's deterministic enforcement inside Codex CLI today, read this first.

## The short version

**Don't configure a `PreToolUse` hook for Codex expecting the same guarantees Claude Code gets.** As of Codex CLI v0.114+ (March 2026), the hook system has three limitations that together mean file-edit enforcement is not currently possible:

1. **Experimental and disabled by default.** You have to explicitly opt in.
2. **Not available on Windows at all.** If you're on Windows, there is no hook mechanism to configure, full stop — this isn't a configuration problem, it's a platform gap in Codex itself.
3. **`PreToolUse` only fires for the `Bash` tool.** Read, Write, Edit, Apply Patch, web fetch, and MCP tool calls do not trigger it. Even on a supported platform with hooks enabled, there is no interception point for Codex's native file-editing mechanism — only for shell commands.

This mirrors what BehaviorOS's own live verification found for Claude Code (a hook in the wrong file, wrong exit code) — except here the gap isn't a misconfiguration, it's the current state of Codex's hook API. There's nothing to "configure correctly" yet for file-edit gating.

## What does still work with Codex

Codex is an MCP client. Anything routed through BehaviorOS's own MCP tools (`bos_select_dna`, `create-mission`, `bos_run_audit`, etc.) is already gated by `EnforcementMiddleware` in-process, in the MCP server itself — completely independent of Codex's hook system. If your team's workflow goes through those tools (e.g. an orchestrator agent calling `create-mission` before delegating), that protection is real today.

What's NOT covered: an agent using Codex's native file-edit/Apply-Patch tool directly, bypassing the MCP layer entirely. There is currently no way to intercept that in Codex.

## If you still want to configure it

For the subset that does work — gating `Bash` commands, on a non-Windows machine, with the experimental flag on — the shape is:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/validate-protocol.js",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

`scripts/validate-protocol.js` already only acts on `WRITE_CAPABLE_TOOLS` (which includes `Bash`) and exits non-zero to block — but confirm Codex's own block-signal exit code before relying on it; Claude Code specifically requires exit code 2, and Codex's hook docs describe a `{"decision": "block", "reason": "…"}` JSON response instead of (or possibly in addition to) an exit code. This repo has not verified that contract empirically the way it verified Claude Code's — do that before trusting it in production.

## Recheck this later

Codex's hook system is under a year old and actively changing. Re-run the research behind this doc (search for "Codex CLI hooks PreToolUse" with a recent date) before assuming any of the above is still accurate — especially the Windows and Bash-only limitations, which are the kind of thing that gets fixed in a minor release.

Sources: [Codex CLI Hooks — DeepWiki](https://deepwiki.com/openai/codex/3.11-hooks-system), [Codex CLI Hooks Reference — agenticcontrolplane.com](https://agenticcontrolplane.com/blog/codex-cli-hooks-reference), [Codex CLI Hooks: Complete Guide](https://codex.danielvaughan.com/2026/04/15/codex-cli-hooks-complete-guide-events-policy-patterns/).
