---
description: BehaviorOS Protocol — Delegation & Enforcement Specification
globs: ["**/*"]
---

# BehaviorOS Protocol

> Canonical source of truth: `docs/PROTOCOL.md`
> This file is a protocol enforcement rule for all AI agents operating under BehaviorOS governance.

## 7 Mandatory Steps

Every task, regardless of size or risk level, MUST pass through all 7 steps. The sequence is immutable.

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  1. DNA  │──▶│ 2. Show │──▶│ 3. Truth│──▶│ 4. Mission│──▶│ 5. Delegate│──▶│ 6. Audit │──▶│ 7. Learn │
│  Select  │   │  Block  │   │ Resolve │   │  Create  │   │          │   │  Run    │   │  Record  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

| # | Step | Tool | When | Enforcement Level |
|---|------|------|------|-------------------|
| 1 | **Select DNA** | `bos_select_dna` | Before ANY task | **CRITICAL** — MCP blocks all action tools if skipped |
| 2 | **Display DNA Block** | Visual template (see below) | Immediately after step 1 | **HIGH** — Human visibility required |
| 3 | **Resolve Truth** | `bos_resolve_truth` | Before delegating | **CRITICAL** — Delegation blocked if skipped |
| 4 | **Create Mission** | `create-mission` | Before starting work | **HIGH** — No work without mission ID |
| 5 | **Delegate** | Task tool | To execute work | **CRITICAL** — Direct execution blocked |
| 6 | **Run Audit** | `bos_run_audit` | After completion | **CRITICAL** — Mission cannot be completed |
| 7 | **Record Learning** | `record-learning` | At the end | **MEDIUM** — Warning logged if skipped |

## Violations

| Condition | Enforcement | Action |
|-----------|-------------|--------|
| Step 1 skipped (DNA Select) | **CRITICAL** | MCP blocks ALL action tools |
| Step 3 skipped (Resolve Truth) | **CRITICAL** | Delegation is blocked |
| Step 5 skipped (Delegate) | **CRITICAL** | Orchestrator MUST NOT edit files directly |
| Step 6 skipped (Run Audit) | **CRITICAL** | Mission cannot be marked completed |
| Step 7 skipped (Record Learning) | **MEDIUM** | Warning logged to audit trail |
| Orchestrator edits files directly | **CRITICAL** | Block via agent permissions |
| Quality gate fails | **HIGH** | Block until fixed |
| Governance rule violated | **CRITICAL** | Block or escalate per rule |

## Visual Block Template

This exact template MUST be displayed by the orchestrator immediately after Step 1 (Select DNA) completes.

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

## Enforcement

You MUST follow all 7 steps for every task — no exceptions.
