# Agent Protocol Compliance

> **Version:** 1.0.0  
> **Status:** Canonical — All agents MUST comply  
> **Last Updated:** July 2026  
> **Enforcement:** 🔴 STRICT

---

## Purpose

The BehaviorOS Protocol (BOS Protocol) defines the **mandatory delegation and enforcement workflow** that ALL AI agents MUST follow when operating under BehaviorOS governance. This document explains:

- The 7 mandatory steps every agent must follow
- What happens when an agent skips a step
- The three enforcement levels
- How to verify protocol compliance

---

## The 7 Mandatory Steps

Every task, regardless of size or risk level, MUST pass through all 7 steps in sequence:

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  1. DNA  │──▶│ 2. Show │──▶│ 3. Truth│──▶│ 4. Mission│──▶│ 5. Delegate│──▶│ 6. Audit │──▶│ 7. Learn │
│  Select  │   │  Block  │   │ Resolve │   │  Create  │   │          │   │  Run    │   │  Record  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

| # | Step | Tool/Method | When | Enforcement |
|---|------|-------------|------|-------------|
| **1** | **Select DNA** | `bos_select_dna` | Before ANY task | 🔴 CRITICAL |
| **2** | **Display DNA Block** | Visual template | Immediately after step 1 | 🟡 HIGH |
| **3** | **Resolve Truth** | `bos_resolve_truth` | Before delegating | 🔴 CRITICAL |
| **4** | **Create Mission** | `create-mission` | Before starting work | 🟡 HIGH |
| **5** | **Delegate** | Task tool | To execute work | 🔴 CRITICAL |
| **6** | **Run Audit** | `bos_run_audit` | After completion | 🔴 CRITICAL |
| **7** | **Record Learning** | `record-learning` | At the end | 🟠 MEDIUM |

### Step 1: Select DNA

**Tool:** `bos_select_dna(taskType, domain, riskLevel?, complexity?, agentId?)`

Selects the optimal behavioral DNA pattern for the task context.

**What happens if skipped:**
- MCP server blocks ALL action tools
- Error: `Delegation enforcement failed: bos_select_dna must be called before any action tool.`

**Example:**
```json
{
  "taskType": "feature",
  "domain": "payments",
  "riskLevel": "critical",
  "complexity": "complex"
}
```

### Step 2: Display DNA Block

**Method:** Visual output (not an MCP tool)

Displays the selected DNA pattern to the human for transparency.

**What happens if skipped:**
- Human cannot verify which DNA governs the task
- Reduces accountability and traceability

**Template:**
```
╔══════════════════════════════════════════════════════════╗
║ 🧬 BEHAVIORAL DNA SELECTED                              ║
╠══════════════════════════════════════════════════════════╣
║ Padrão:    {pattern_name}                                ║
║ Confiança: {X}%                                          ║
║ Racional:  {rationale}                                   ║
║ Domínio:   {domain}                                      ║
║ Risco:     {riskLevel}                                   ║
╠══════════════════════════════════════════════════════════╣
║ 📏 PRINCÍPIOS ATIVOS:                                    ║
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

### Step 3: Resolve Truth

**Tool:** `bos_resolve_truth(taskType, domain, riskLevel?, complexity?, agentId?, libraries?)`

Resolves DNA + Context7 documentation before delegating to ensure subagents act on current information.

**What happens if skipped:**
- Delegation is blocked
- Error: `Delegation enforcement failed: bos_resolve_truth must be called before delegation.`

### Step 4: Create Mission

**Tool:** `create-mission(title, type, priority?, description?)`

Creates a traceable mission entity for work tracking.

**What happens if skipped:**
- Work cannot be tracked
- Audit trail is incomplete
- Mission cannot be marked complete

### Step 5: Delegate

**Tool:** Task tool (OpenCode Task, Cursor Agent, etc.)

Delegates actual work to a specialized subagent. **The orchestrator MUST NOT edit files directly.**

**What happens if skipped:**
- Orchestrator edits files directly → 🔴 **FORBIDDEN**
- Error: `Permission denied: orchestrator may not edit files.`

**Delegation prompt template:**
```markdown
## DNA Pattern
- Pattern: {pattern_name} (confidence: {confidence}%)
- Principles: {principles}
- Forbidden: {forbidden}

## Context7 Documentation
{context7_docs}

## Task
{actual task description}

## Quality Requirements
- Run `bos_lsp_diagnostics` after each edit
- Run `bos_lsp_validate` before completion
- All gates must pass
```

### Step 6: Run Audit

**Tool:** `bos_run_audit(trigger, context?)`

Runs the continuous audit chain: lint → typecheck → security → coverage → performance.

**What happens if skipped:**
- Mission cannot be marked completed
- Error: `Cannot update progress to completed: audit must pass first.`

**Example:**
```json
{
  "trigger": "pr",
  "context": { "branch": "feature/my-feature", "files": 12 }
}
```

### Step 7: Record Learning

**Tool:** `record-learning(type, source, data, confidence?)`

Captures insights, patterns, and observations from the completed work.

**What happens if skipped:**
- Warning logged to audit trail
- Error: `Warning: record-learning was not called for mission {id}.`
- Learning engine misses pattern — system loses opportunity to improve

---

## Enforcement

### Three Enforcement Levels

| Level | Behavior | Use Case |
|-------|----------|----------|
| **🔴 Strict** | All steps are required. Action tools are blocked until protocol is complete. | Production, regulated industries, payment systems |
| **🟡 Standard** (default) | Critical steps (1, 3, 5, 6) are required. Warnings for non-critical skips. | Normal development, standard features |
| **🟢 Audit** | All actions allowed. Violations are logged for audit trail only. | Research, experiments, non-critical tasks |

### Setting Enforcement Level

```bash
# Check current enforcement
behavioros protocol check

# Set enforcement level
behavioros protocol enforce --level strict
behavioros protocol enforce --level standard
behavioros protocol enforce --level audit
```

### Enforcement Architecture

The protocol is enforced at three levels:

| Level | Enforcer | Mechanism |
|-------|----------|-----------|
| **MCP Server** | `DelegationEnforcementLayer` | Blocks action tools if delegation steps are skipped |
| **OpenCode Plugin** | `tool.execute.before` hook | Intercepts all tools, validates protocol compliance |
| **Runtime** | Agent instructions (AGENTS.md, CLAUDE.md, etc.) | Instructions embedded in agent context |

#### MCP Server Enforcement

The MCP server tracks protocol state:

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Server Delegation Enforcement Layer                      │
│                                                               │
│ protocolState = {                                             │
│   step1_dnaSelected: boolean,                                 │
│   step3_truthResolved: boolean,                               │
│   step4_missionCreated: boolean,                              │
│   step6_auditPassed: boolean,                                 │
│   hasActiveMission: boolean                                   │
│ }                                                             │
│                                                               │
│ IF !step1_dnaSelected  → BLOCK all action tools               │
│ IF !step3_truthResolved → BLOCK delegation                    │
│ IF !hasActiveMission   → BLOCK work                           │
└─────────────────────────────────────────────────────────────┘
```

#### OpenCode Plugin Enforcement

For OpenCode environments, a `tool.execute.before` hook intercepts all tools:

```typescript
// Pseudocode for the enforcement plugin
ctx.tool.hook('execute.before', (event) => {
  if (!DELEGATION_WORKFLOW_TOOLS.has(event.toolName)) {
    const state = getDelegationState()
    if (!state.step1Completed) {
      throw new Error(
        'Protocol violation: bos_select_dna must be called before any action tool.'
      )
    }
  }
})
```

### Tools Always Allowed (Delegation Workflow)

These tools are never blocked because they are part of the protocol itself:

- `bos_select_dna`
- `bos_resolve_truth`
- `create-mission`
- `update-progress`
- `record-learning`
- `bos_run_audit`
- `evaluate-governance`
- `bos_check_escalation`
- `bos_resolve_conflict`
- `bos_list_patterns`
- `bos_get_insights`
- `get-status`
- `list-agents`
- `list-missions`

---

## Quality Gates

Each step has associated quality gates:

| # | Step | Quality Gate | Threshold | Fail Action |
|---|------|-------------|-----------|-------------|
| 1 | Select DNA | Confidence score | ≥ 50% | Warn |
| 3 | Resolve Truth | Docs resolved | ≥ 1 library | Block |
| 5 | Delegate | `bos_lsp_validate` | 0 errors, ≤ 10 warnings | Block |
| 6 | Run Audit | Lint pass | 0 errors | Block |
| 6 | Run Audit | Typecheck pass | 0 errors | Block |
| 6 | Run Audit | Security scan | 0 critical | Block |
| 6 | Run Audit | Test coverage | ≥ 80% | Warn |
| 6 | Run Audit | Performance | ≥ 90 threshold | Warn |

---

## How to Verify Protocol is Active

### Use the CLI

```bash
# Quick check
behavioros protocol check

# Detailed status
behavioros protocol status
```

### Check Protocol Status

The `protocol status` command shows:

```
╔══════════════════════════════════════════════════════╗
║     BEHAVIOROS PROTOCOL ENFORCEMENT STATUS            ║
╚══════════════════════════════════════════════════════╝

  Current Step:    DNA Selected (1/5)
  Next Required:   Truth Resolve
  Overall Status:  Incomplete

  Steps:
    ✓ DNA Selected (bos_select_dna)
    ○ Truth Resolve (bos_resolve_truth)
    ○ Mission Created (create-mission)
    ○ Audit Done (bos_run_audit)
    ○ Learning Recorded (record-learning)

  Progress: 1/5 steps (20%)
```

### Verify in Code

```typescript
import { ProtocolStateTracker } from '@behavioros/core'

const tracker = new ProtocolStateTracker()
const status = tracker.getStatus()

if (status.valid) {
  console.log('Protocol is fully enforced')
} else {
  console.log(`Missing steps: ${status.stepsMissing.join(', ')}`)
  console.log(`Next required: ${status.nextRequiredStep}`)
}
```

---

## Escalation Rules

`bos_check_escalation` MUST be called before these actions:

| Trigger | Risk Level | Human Approval Required |
|---------|------------|------------------------|
| Security vulnerability fix | Critical | ✅ Yes |
| Payment system change | Critical | ✅ Yes |
| Production deployment | Critical | ✅ Yes |
| Breaking API change | High | ✅ Yes |
| Database migration | High | ✅ Yes |
| Architectural change | High | ✅ Yes |
| Any `critical` risk level action | Critical | ✅ Yes |
| Standard feature work | Medium | ❌ No |
| Bug fix (non-critical) | Low | ❌ No |

---

## What NOT to Do

| ❌ Don't | ✅ Do Instead |
|----------|--------------|
| Skip `bos_select_dna` | Call it before every single task |
| Edit files directly | Delegate to specialized subagents |
| Skip `bos_resolve_truth` | Fetch current docs before delegation |
| Hide the DNA block | Show it to the human every time |
| Mark mission complete without audit | Run `bos_run_audit` first |
| Skip `record-learning` | Record events — the system learns from them |
| Bypass quality gates | Fix the issues until gates pass |

---

## Platform Configurations

The protocol is embedded in these platform-specific files:

| Platform | File |
|----------|------|
| **OpenCode** | `.opencode/rules/behavioros-protocol.mdc` |
| **Cursor** | `.cursor/rules/behavioros-protocol.mdc` |
| **Claude Code** | `CLAUDE.md` |
| **Windsurf** | `.windsurfrules` |
| **GitHub Copilot** | `.github/copilot-instructions.md` |

All platform configs reference the canonical `docs/PROTOCOL.md` as their source of truth.

---

For the complete protocol specification, see [PROTOCOL.md](./PROTOCOL.md).
