# Getting Started with BehaviorOS — 5 Minutes

This is the fastest path to a working BehaviorOS install in a new project. For the full command reference see [CLI.md](CLI.md); for the complete governance workflow see [PROTOCOL.md](PROTOCOL.md); for ready-made DNAs see [DNAs.md](DNAs.md).

## 0. What you're installing

BehaviorOS has two halves:

1. **A DNA file** (`behavioros.yaml` or one of the presets in [`dnas/`](../dnas/)) — declarative rules: who (`personas`) can do what, governance/quality gates, and workflows.
2. **An MCP server** (`@behavioros/mcp-server`) that your AI coding agent talks to — it's what actually selects the DNA, tracks the 7-step protocol, and evaluates governance decisions at runtime.

A DNA file alone is just configuration nobody reads. The MCP server + the protocol enforcement hook (step 4 below) is what makes it a *governance layer* rather than a wishlist.

## 1. Scaffold the project (30 seconds)

```bash
npx @behavioros/cli init --with-protocol
```

This writes, in the current directory:

- `behavioros.yaml` — your DNA (personas, governance, quality gates), built interactively from the prompts you answer (governance level, whether to include quality gates, team size).
- `AGENTS.md` / `CLAUDE.md` — protocol instructions for the agent, from `packages/cli/templates/protocol-strict/`.
- `.cursor/rules/behavioros-protocol.mdc`, `.opencode/rules/behavioros-protocol.md`, `.windsurfrules`, `.github/copilot-instructions.md` — the same protocol reference adapted per platform.

Prefer to start from a ready-made DNA instead of the interactive prompts? `@behavioros/dnas` ships them programmatically:

```typescript
import { loadDNA } from '@behavioros/dnas'
import { writeFileSync } from 'node:fs'
import { stringify } from 'yaml'

const dna = loadDNA('nextjs-nestjs-fullstack') // or 'python-go-microservices', 'complex-monorepo', ...
writeFileSync('behavioros.yaml', stringify(dna))
```

or just copy the YAML directly from this repo's [`dnas/`](../dnas/) directory. See [DNAs.md](DNAs.md) for the full catalog, including stack-specific presets for Next.js/NestJS, Python/Go microservices, and complex monorepos.

## 2. Point your AI tool at the MCP server

Install the packages:

```bash
pnpm add @behavioros/core @behavioros/sdk
pnpm add -g @behavioros/cli @behavioros/mcp-server
```

Then wire the MCP server into whichever tool you use — the exact config block for Claude Desktop, Cursor, VS Code+Copilot, Windsurf, and OpenCode is in the [README's MCP Setup section](../README.md#mcp-setup). The short version for **Claude Code / Claude Desktop**:

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "node",
      "args": ["/absolute/path/to/your-project/node_modules/@behavioros/mcp-server/dist/server.js"],
      "env": { "BEHAVIOROS_DNA_PATH": "./behavioros.yaml" }
    }
  }
}
```

For **Cursor**, create `.cursor/mcp.json`:

```json
{ "mcpServers": { "behavioros": { "command": "npx", "args": ["@behavioros/mcp-server"] } } }
```

For **standalone CLI use** (no AI tool in the loop — CI pipelines, scripts), skip the MCP server entirely and drive BehaviorOS directly:

```bash
npx @behavioros/cli validate     # check behavioros.yaml against the schema
npx @behavioros/cli compile      # compile DNA → agent configs
npx @behavioros/cli status       # health check
```

or via the SDK:

```typescript
import { BehaviorOS } from '@behavioros/sdk'

const bos = new BehaviorOS({ dnaPath: './behavioros.yaml' })
const decision = await bos.evaluateGovernance('deploy-production', {
  agent: 'devops', scope: 'production',
})
```

## 3. Confirm the MCP server sees your DNA

```bash
npx @behavioros/cli status
```

You should see your DNA's name and persona count. If it falls back to `enterprise-governance-fallback`, double-check `BEHAVIOROS_DNA_PATH` points at your actual file.

## 4. Turn on deterministic enforcement

Step 1–3 get the MCP tools (`bos_select_dna`, `create-mission`, etc.) available to your agent, but by themselves they're **advisory** — nothing stops the agent from ignoring them and calling `Edit`/`Write` directly. To actually gate native file-edit tools, you need a `PreToolUse`-style hook — and the exact mechanics differ enough per tool that getting them wrong means the hook silently never fires. This section was corrected after live-verifying it against a real Claude Code session; the version below is the one that actually works, not the one that looks right on paper.

### Claude Code

Hooks live in **`.claude/settings.json`** (project-level) or `~/.claude/settings.json` (user-global) under a `"hooks"` key — **not** a standalone `.claude/hooks.json` file. A hook configured in the wrong file is silently never read; Claude Code won't warn you.

`.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|NotebookEdit|MultiEdit|Bash",
        "hooks": [{ "type": "command", "command": "node scripts/validate-protocol.js" }]
      }
    ]
  }
}
```

Copy `scripts/validate-protocol.js` from this repo alongside it. It verifies a signed `.agent_state.json` (HMAC-keyed via a secret the MCP server creates at `~/.behavioros/state.key` on first run) and blocks `Edit`/`Write`/`NotebookEdit`/`MultiEdit`/`Bash` until `bos_select_dna` has run. Note it exits with code **2** to signal a block — Claude Code's `PreToolUse` contract specifically requires exit 2; exit 1 is treated as a generic script error and does *not* stop the tool call. See [PROTOCOL.md § Enforcement Rules](PROTOCOL.md#enforcement-rules) for exactly what it checks and why the signature (not just the raw JSON flags) is the part that matters.

You also need a project-scoped `.mcp.json` pointing at the built server so Claude Code actually launches it:

```json
{
  "mcpServers": {
    "behavioros": {
      "command": "node",
      "args": ["packages/mcp-server/dist/server.js"],
      "env": { "BEHAVIOROS_DNA_PATH": "./behavioros.yaml" }
    }
  }
}
```

Claude Code loads both MCP servers and hooks at session start — editing either file requires restarting the session (or reconnecting via `/mcp` for MCP config) before it takes effect.

> **Known gap**: `init --with-protocol` does not yet generate `.claude/settings.json`, `.mcp.json`, or `scripts/validate-protocol.js` for you — copy them by hand for now. Everything else in this guide (DNA file, MCP config, protocol reference docs) *is* generated.

### Cursor

Has its own hook shape (`.cursor/hooks.json` with `beforeMCPExecution`/`afterFileEdit`) — see the live example in this repo's own `.cursor/hooks.json` if you want to replicate it; MCP tool calls are gated in-process by `EnforcementMiddleware` regardless of whether you wire the Cursor-specific hook.

### OpenCode

Ships as a real plugin in this repo: `.opencode/plugins/protocol-enforcer.ts`, registered via `opencode.json`'s `plugin` array. It implements the same signed-state scheme as the Claude Code hook (same secret, same HMAC algorithm) specifically so state written by one tool is trusted, not silently downgraded, when read by the other on the same project.

### Codex CLI

**Not currently viable for file-edit gating** — see [CODEX-INTEGRATION.md](CODEX-INTEGRATION.md) for why (hooks are experimental, unavailable on Windows, and only intercept the `Bash` tool as of Aug 2026). MCP tool calls are still gated in-process regardless.

## 5. Try it

Ask your agent to do something. It should:

1. Call `bos_select_dna` (and you should see the DNA block rendered — see [PROTOCOL.md § Visual Block Template](PROTOCOL.md#visual-block-template)).
2. Call `bos_resolve_truth`, then `create-mission`.
3. Delegate the actual work (or, without hooks wired, just proceed — that's the gap step 4 closes).
4. Run `bos_run_audit` before the mission is marked complete.
5. Call `record-learning`.

If it tries to edit a file before step 1 and you've wired the hook from step 4, it gets blocked with `BOS: bos_select_dna must be called before any action tool.`

## Where to go next

- [PROTOCOL.md](PROTOCOL.md) — the full 7-step protocol spec, error messages, and per-platform integration blocks.
- [DNAs.md](DNAs.md) — the DNA catalog, including stack-specific presets.
- [EAARG-18-LAYERS.md](EAARG-18-LAYERS.md) — the 18-layer architecture review framework, for a deeper SDLC-wide governance pass beyond the 7-step protocol.
- [CODEX-INTEGRATION.md](CODEX-INTEGRATION.md) — current (limited) status of Codex CLI support.
- [RUNBOOK.md](RUNBOOK.md) — operational troubleshooting once BehaviorOS is running.
- [CLI.md](CLI.md) — full CLI command reference.
