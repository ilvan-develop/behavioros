## BehaviorOS Protocol

This project uses BehaviorOS for AI agent governance. The canonical protocol is at `docs/PROTOCOL.md`.

### 7 Mandatory Steps

| # | Step | Tool | When |
|---|------|------|------|
| 1 | Select DNA | `bos_select_dna` | Before EVERY task |
| 2 | Display DNA Block | Visual template | Immediately after step 1 |
| 3 | Resolve Truth | `bos_resolve_truth` | Before delegating to subagents |
| 4 | Create Mission | `create-mission` | Before starting work |
| 5 | Delegate | Task tool (never direct editing) | To execute work |
| 6 | Run Audit | `bos_run_audit` | After work completes |
| 7 | Record Learning | `record-learning` | At the end of every mission |

### Critical Rules

- Call `bos_select_dna` before every single task — no exceptions
- Show the DNA visual block to the human every time
- Never edit files directly as orchestrator — always delegate to specialized subagents
- Always run `bos_run_audit` before marking a mission complete
- Record learning events at the end of every mission
- Never skip any of the 7 steps
- Never bypass quality gates

### Visual Block Template

Display this after Step 1:

```
╔══════════════════════════════════════════════════════════╗
║ 🧬 BEHAVIORAL DNA SELECTED                              ║
╠══════════════════════════════════════════════════════════╣
║ Padrao:    {pattern_name}                                ║
║ Confianca: {X}%                                          ║
║ Racional:  {rationale}                                   ║
║ Dominio:   {domain}                                      ║
║ Risco:     {riskLevel}                                   ║
╠══════════════════════════════════════════════════════════╣
║ 📏 PRINCIPIOS ATIVOS:                                    ║
║ • {principle_1}                                          ║
║ • {principle_2}                                          ║
╠══════════════════════════════════════════════════════════╣
║ 🚫 REGRAS PROIBIDAS:                                     ║
║ • {forbidden_1}                                          ║
║ • {forbidden_2}                                          ║
╠══════════════════════════════════════════════════════════╣
║ 📚 CONTEXT7 DOCS: {libraries}                            ║
║ 🤖 AGENTE: {agent_id}                                    ║
║ 📋 TASK: {task_summary}                                  ║
╚══════════════════════════════════════════════════════════╝
```

### Enforcement Rules

| Condition | Severity | Consequence |
|-----------|----------|-------------|
| Step 1 skipped (no `bos_select_dna`) | CRITICAL | MCP blocks ALL action tools |
| Step 3 skipped (no `bos_resolve_truth`) | CRITICAL | Delegation blocked |
| Step 6 skipped (no audit before completion) | CRITICAL | Mission cannot be marked completed |
| Step 7 skipped (no `record-learning`) | MEDIUM | Warning logged to audit trail |
| Orchestrator edits files directly | CRITICAL | Permission denied by MCP server |
| Quality gate fails | HIGH | Blocked until fixed |
| Governance rule violated | CRITICAL | Blocked or escalated per rule |

### Quality Gates

| Stage | Tool / Command | Threshold | Fail Action |
|-------|---------------|-----------|-------------|
| Lint | `pnpm lint` | 0 errors | Block |
| Typecheck | `pnpm typecheck` | 0 errors | Block |
| Security | `bos_lsp_diagnostics` (security scan) | 0 critical | Block |
| Coverage | `pnpm test -- --coverage` | >= 80% | Warn |
| Performance | Benchmark suite | >= 90 threshold | Warn |

Stages run sequentially. A block stops all further work until the issue is resolved.

### Escalation Rules

`bos_check_escalation` MUST be called BEFORE these actions:

| Trigger | Risk Level | Human Approval |
|---------|------------|----------------|
| Security vulnerability fix | Critical | Required |
| Payment system change | Critical | Required |
| Production deployment | Critical | Required |
| Breaking API change | High | Required |
| Database migration | High | Required |
| Architectural change | High | Required |
| Standard feature work | Medium | Not required |
| Bug fix (non-critical) | Low | Not required |

### Conflict Resolution

When agents produce conflicting outputs, call `bos_resolve_conflict(type, agentA, agentB, context)`:

| Type | Resolution |
|------|------------|
| `backend_vs_frontend` | Generate shared contract; both sides adapt |
| `security_vs_feature` | Security takes precedence; find performant alternative |
| `qa_vs_developer` | Quality gates are non-negotiable; adjust timeline |
| `devops_vs_backend` | Canary rollout with auto-rollback |
| `custom` | Human-in-the-loop resolution |

### Do NOT

- Skip any of the 7 mandatory steps
- Edit files directly as orchestrator
- Mark mission complete without running audit
- Bypass quality gates
- Merge without review
- Skip DNA selection on any task
