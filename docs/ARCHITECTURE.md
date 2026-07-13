# BehaviorOS Architecture

## 9-Layer Architecture

BehaviorOS is built on a 9-layer architecture where each layer has a dedicated engine. Layers are evaluated bottom-up: DNA defines patterns, schemas validate types, and upper layers consume validated data.

```
┌─────────────────────────────────────────────────────────┐
│                    Mission Layer                         │
│  Mission lifecycle: create → start → execute → complete  │
├─────────────────────────────────────────────────────────┤
│                    Learning Layer                        │
│  Record events → detect patterns → auto-apply fixes     │
├─────────────────────────────────────────────────────────┤
│                    Quality Layer                         │
│  Quality gates: coverage, lint, typecheck, security     │
├─────────────────────────────────────────────────────────┤
│                    Audit Layer                           │
│  Multi-stage pipeline: lint → typecheck → security →    │
│  coverage → performance                                  │
├─────────────────────────────────────────────────────────┤
│                    Decision Layer                        │
│  Voting-based decisions with approval thresholds        │
├─────────────────────────────────────────────────────────┤
│                   Governance Layer                       │
│  Rule evaluation: block, escalate, warn, log            │
├─────────────────────────────────────────────────────────┤
│                  Behavioral Layer                        │
│  DNA loading, validation, composition                   │
├─────────────────────────────────────────────────────────┤
│                    Schema Layer                          │
│  Zod v4.4.3 schemas for all types                       │
├─────────────────────────────────────────────────────────┤
│                   DNA Layer (YAML)                       │
│  Personas, governance rules, quality gates, patterns,   │
│  workflows                                              │
└─────────────────────────────────────────────────────────┘
```

## 7 Engines

### 1. Behavioral Engine
- Loads DNA packages from YAML files
- Validates DNA structure against Zod schemas
- Composes multiple DNA packages into a single configuration
- Exports: `DNALoader`, `DNAValidator`, `DNAComposer`

### 2. Governance Engine
- Evaluates actions against governance rules defined in DNA
- Actions: `block` (prevent), `escalate` (require approval), `warn` (log warning), `log` (record only)
- Levels: `critical`, `high`, `medium`, `low`
- Conditions match against action types (e.g., `type:security`, `type:infrastructure`)

### 3. Decision Engine
- Voting-based decision system for multi-agent consensus
- Agents submit votes with weight and rationale
- Threshold-based approval with configurable quorum
- Returns: approved/rejected with breakdown of votes

### 4. Audit Engine
- Multi-stage audit pipeline (lint → typecheck → security → coverage → performance)
- Each stage produces a report with pass/fail and details
- History tracking for trend analysis
- Configurable stages and thresholds

### 5. Quality Engine
- Enforces quality gates before actions can proceed
- Gate types: `test_coverage`, `lint`, `typecheck`, `security`, `performance`
- Configurable thresholds per gate
- Returns pass/fail with failed gate details

### 6. Learning Engine
- Records learning events from agent actions
- Detects patterns across events (repeated failures, successful strategies)
- Auto-apply mode for known fixes
- Generates learning reports with recommendations

### 7. Mission Engine
- Manages mission lifecycle: `create → start → execute → complete/fail`
- Tracks mission metadata, progress, and outcomes
- Supports priority levels and type classification
- Provides mission history and statistics

## DNA System

DNA (Deoxyribonucleic Algorithm) packages define the behavioral configuration for AI agent teams. A DNA package contains:

### Personas
Define agent roles with:
- **role**: function (manager, engineer, specialist, analyst, support)
- **authority**: level (c-level, director, lead, architect, senior, junior)
- **boundaries**: constraints on what the agent can do
- **skills**: capabilities the agent possesses
- **tools**: resources the agent can access

### Governance Rules
Behavioral constraints that are evaluated before actions:
- **level**: critical / high / medium / low
- **action**: block / escalate / warn / log
- **conditions**: when this rule applies

### Quality Gates
Quality thresholds that must be met:
- **type**: test_coverage / lint / typecheck / security / performance
- **threshold**: minimum acceptable value
- **pass**: boolean for pass/fail gates

### Patterns
Reusable behavioral sequences:
- **type**: collaboration / decision / review / learning / communication / escalation / deployment / testing
- **triggers**: what initiates the pattern
- **actions**: ordered steps in the pattern
- **conditions**: when this pattern applies

### Workflows
Multi-step processes that chain patterns:
- **type**: action / gate / parallel / conditional
- **agent**: who executes
- **next**: subsequent workflow steps
- **timeout**: maximum execution time
- **retries**: retry count on failure

## Governance Model

The governance model follows a strict evaluation pipeline:

1. **Action Submitted** — An agent attempts an action
2. **Rule Matching** — Governance rules are checked against action conditions
3. **Evaluation** — Each matching rule produces an outcome
4. **Escalation** — Escalated actions require approval from higher authority
5. **Blocking** — Blocked actions are prevented entirely
6. **Logging** — All evaluations are recorded in the audit log

Authority hierarchy: `c-level > director > lead > architect > senior > junior`

## Quality Pipeline

```
Action → Quality Gates → Audit Stages → Decision → Execution
              │                │              │
              ▼                ▼              ▼
         Coverage          Lint           Vote
         Typecheck         Security       Approve
         Performance       Coverage       Reject
```

## Learning System

The learning system operates in three phases:

1. **Record** — Events are captured with context, outcome, and impact
2. **Detect** — Patterns are identified across recorded events
3. **Apply** — Known fixes are automatically applied (optional)

## MCP Integration

The MCP server bridges BehaviorOS with AI agents via the Model Context Protocol:

- **Tools**: 8 tools for direct agent interaction
- **Resources**: 5 resources for data access
- **Transport**: stdio (standard for local MCP servers)
- **Engine**: Shares the same `BehaviorOSEngine` as the SDK
