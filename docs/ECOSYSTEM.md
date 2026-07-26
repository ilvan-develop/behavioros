# BehaviorOS Ecosystem

> **Version:** 1.0.0  
> **Status:** Canonical  
> **Last Updated:** July 2026

---

## What is the BehaviorOS Ecosystem?

The BehaviorOS Ecosystem is a unified component management system that connects AI agents to skills, MCP servers, design systems, and DNA patterns — all governed by the same behavioral framework. Instead of manually installing and wiring components, the ecosystem provides a single interface for discovery, installation, synchronization, and diagnostics.

The ecosystem sits at the top of the BehaviorOS stack:

```
┌─────────────────────────────────────────────────────────────────┐
│                    BEHAVIOROS ECOSYSTEM                           │
│                                                                   │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐     │
│  │   Skills   │  │   MCPs   │  │ Design Sys │  │   DNAs   │     │
│  └────────────┘  └──────────┘  └────────────┘  └──────────┘     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                EcosystemRegistry                              │ │
│  │  Unified initialization, reporting, install, diagnostics     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────────────┐ │
│  │ SkillEngine │  │ Autonomous     │  │ Source Adapters        │ │
│  │             │  │ Orchestrator   │  │ AITMPL | Open Design  │ │
│  │             │  │                │  │ UI-UX Pro Max         │ │
│  └────────────┘  └────────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER / AI AGENT                               │
│                                                                       │
│  behavioros ecosystem {status|install|uninstall|sync|doctor|report}  │
│  behavioros agent {list|skills|validate}                              │
│  behavioros autonomous {run|status|handoffs}                          │
│  behavioros protocol {check|enforce|status}                           │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      EcosystemRegistry                                │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  initialize()  │  install()  │  uninstall()  │  sync()        │  │
│  │  doctor()      │  generateReport()  │  getStatus()            │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Aggregates: SkillEngine + AITMPLAdapter + OpenDesignAdapter          │
│              + UIUXProMaxAdapter + DNALoader                          │
└───────────┬──────────────────┬──────────────────┬────────────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
┌──────────────────┐ ┌────────────────┐ ┌────────────────────────┐
│   SkillEngine    │ │   AITMPL       │ │   Open Design          │
│                  │ │   Adapter      │ │   Adapter              │
│ Two-stage routing│ │                 │ │                        │
│ 1. DNA match     │ │ 2800+ skills   │ │ 151 design systems     │
│ 2. Capability    │ │ 65+ MCPs       │ │ 100+ skills            │
│    (semantic)    │ │ Prompt tmpls   │ │ 277 plugins            │
└──────────────────┘ └────────────────┘ └────────────────────────┘
                                     ┌────────────────────────┐
                                     │   UI-UX Pro Max        │
                                     │   Adapter              │
                                     │                        │
                                     │ 50+ styles, 161 palettes│
                                     │ 57 font pairings        │
                                     │ 99 UX guidelines        │
                                     └────────────────────────┘
```

---

## Component Types

The ecosystem manages four component types:

| Component | Description | Sources | Managed By |
|-----------|-------------|---------|------------|
| **Skills** | Reusable agent instructions and workflows | AITMPL, Local filesystem | SkillEngine |
| **MCPs** | Model Context Protocol servers for tool access | AITMPL, Open Design | EcosystemRegistry |
| **Design Systems** | Complete UI design systems with tokens | Open Design | OpenDesignAdapter |
| **DNAs** | Behavioral governance YAML patterns | Local `dnas/` directory | DNALoader |

### Skills

Skills are modular instruction sets that teach agents how to perform specific tasks. Each skill has:

- **ID** — Unique identifier (e.g., `context7-mcp`, `enterprise-backend`)
- **Version** — Semantic version
- **Description** — What the skill does
- **Dependencies** — Other skills or MCPs required
- **Commands** — Bash scripts or instructions embedded in the skill file

Skills are loaded at startup from:
1. `~/.agents/skills/` — Global user skills directory
2. `.opencode/skills/` — Project-level skills directory
3. AITMPL marketplace — Community-contributed skills

### MCPs

MCP (Model Context Protocol) servers provide tools and resources to AI agents. The ecosystem tracks:

- **Connected MCPs** — Active servers with healthy transport
- **Available MCPs** — Servers that can be installed
- **Configuration** — JSON config blocks for `mcpServers` in agent configs

### Design Systems

Design systems from the Open Design ecosystem provide:

- **Design tokens** — Colors, spacing, typography
- **Component libraries** — Ready-to-use UI components
- **Theme configurations** — Tailwind, CSS variables, style-dictionary

### DNAs

DNA (Deoxyribonucleic Algorithm) packages define behavioral configurations for AI agent teams. The ecosystem discovers:

- **Loaded DNAs** — From `dnas/` directory or configured paths
- **Active DNAs** — Currently applied governance patterns
- **Inactive DNAs** — Available but not in use

---

## How the SkillEngine Works

The `SkillEngine` is the core component resolution engine with a **two-stage routing** system:

### Stage 1: DNA Match (Primary)

When a task requires an agent with specific skills, the engine first tries to find an exact match from the DNA configuration:

```
Task: "Implement payment module"
  → Requires skills: ["payment-processing", "typescript", "api-design"]
  → DNA defines: Agent "payments-specialist" with these skills
  → Match found → Route to payments-specialist (confidence: 95%)
```

### Stage 2: Capability Match (Semantic Fallback)

If no DNA agent has the exact skills, the engine falls back to semantic capability matching:

```
Task: "Create database schema"
  → Requires skills: ["database-design", "prisma", "migrations"]
  → No DNA agent matches exactly
  → Capability match: Agent "backend-engineer" has ["typescript", "prisma", "postgres"]
  → Route to backend-engineer with adjust confidence (confidence: 72%)
```

### Engine Status

```typescript
interface SkillEngineStatus {
  agents: Array<{
    id: string;
    status: 'active' | 'idle' | 'error';
    skillsCount: number;
    skills: string[];
  }>;
  skills: ComponentRegistry[];      // Available skills
  mcps: ComponentRegistry[];        // Connected MCPs
  designSystems: ComponentRegistry[]; // Installed design systems
  dnas: Array<{
    id: string;
    version: string;
    active: boolean;
  }>;
}
```

### Delegation Validation

Before delegating a task to an agent, the engine validates:

1. **Skill presence** — Does the agent have all required skills?
2. **Proficiency** — Does the agent meet minimum proficiency levels?
3. **Authorization** — Is the agent authorized for this action type?

```typescript
const result = await engine.validateDelegation('cli', agentId, ['typescript', 'react'])
// { allowed: true, missingSkills: [], insufficientProficiency: [] }
```

---

## How the AutonomousOrchestrator Works

The `AutonomousOrchestrator` is the engine that makes BehaviorOS fully autonomous. When a human says "implement payment module", this engine orchestrates the entire workflow without manual intervention.

### Orchestration Flow

```
Human Request ("Implement payment module")
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. Task Decomposition                    │
│    → AutonomousDecomposer breaks request │
│    into subtasks:                        │
│      - Create Prisma schema             │
│      - Implement API endpoints          │
│      - Add validation logic             │
│      - Write tests                      │
│      - Document API                     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 2. Skill Routing                         │
│    → SkillRouter maps each subtask      │
│    to best-fit agent:                   │
│      - schema → database-agent          │
│      - API → backend-agent              │
│      - validation → backend-agent       │
│      - tests → qa-agent                 │
│      - docs → documentation-agent       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 3. Handoff Protocol                      │
│    → Sequential handoffs between agents │
│    with full context:                    │
│      database-agent → backend-agent     │
│      backend-agent → qa-agent           │
│      qa-agent → documentation-agent     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 4. Lifecycle Pipeline                    │
│    → Runs through all 9 layers:         │
│    DNA → Schema → Behavioral → Domain → │
│    Governance → Decision → Quality →    │
│    Audit → Learning                     │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 5. Auto-Documentation                    │
│    → AutoDocumentationTrigger generates │
│    changelog, README updates, API docs  │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 6. Completion + Reporting                │
│    → Final report with:                 │
│    - All subtasks completed             │
│    - Agents involved & routing decisions│
│    - Quality gate results               │
│    - Audit trail                        │
│    → Only escalates to humans if needed │
└─────────────────────────────────────────┘
```

### Subcomponents

| Component | Responsibility |
|-----------|---------------|
| **AutonomousDecomposer** | Breaks high-level requests into granular subtasks |
| **SkillRouter** | Maps subtasks to agents based on skill matching |
| **HandoffProtocol** | Manages context-passing between agents |
| **LifecyclePipeline** | Runs the full 9-layer governance pipeline |
| **AutoDocumentationTrigger** | Auto-generates documentation from completed work |

### Escalation Rules

The orchestrator only escalates to humans when:

- A subtask requires critical security review
- Agent handoff is rejected and no fallback is available
- Ambiguous requirements cannot be resolved automatically
- Governance violation requires human authorization
- Quality gates fail beyond configurable thresholds

---

## How the Handoff Protocol Works

The `HandoffProtocol` manages contextual handoffs between agents, ensuring seamless context transfer without asking the human to repeat information.

### Handoff Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Pending │────▶│ Accepted │────▶│In Progress│────▶│Completed │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                  ▲
     │              ┌──────────┐                        │
     └─────────────▶│ Rejected │────────────────────────┘
                    └──────────┘
                        │
                        ▼
                  Fallback: route to
                  alternative agent or
                  escalate to human
```

### Handoff Context

Each handoff carries full context so the receiving agent can continue without asking for context:

```typescript
interface HandoffContext {
  subtask: SubTask;              // What needs to be done
  missionId: string;             // Parent mission
  previousOutput?: unknown;      // Previous agent's output
}

interface HandoffRecord {
  handoffId: string;
  from: string;                  // Source agent ID
  to: string;                    // Target agent ID
  status: HandoffStatus;
  context: HandoffContext;
  rejectionReason?: {            // If rejected
    code: string;
    details: string;
    suggestion?: string;
  };
  output?: unknown;              // Final output
}
```

### Rejection Handling

When an agent rejects a handoff, the protocol:

1. Records the rejection with reason and suggested alternative
2. Tries an alternative agent (fallback routing)
3. If no alternative available, escalates to the orchestrator

---

## Source Integrations

The ecosystem integrates with three external sources:

| Source | Type | Adapter | Capabilities |
|--------|------|---------|--------------|
| **AITMPL** | Marketplace | `AITMPLAdapter` | 2800+ skills, 65+ MCPs, prompt templates |
| **Open Design** | Design system | `OpenDesignAdapter` | 151 design systems, 100+ skills, 277 plugins |
| **UI-UX Pro Max** | Design skill | `UIUXProMaxAdapter` | 50+ styles, 161 palettes, 57 fonts, 99 UX guidelines |

See [INTEGRATIONS.md](./INTEGRATIONS.md) for detailed documentation of each integration.

---

## Ecosystem CLI Commands

The ecosystem exposes its full functionality through the CLI:

### `behavioros ecosystem`

| Subcommand | Description |
|------------|-------------|
| `status` | Show full ecosystem status (agents, skills, MCPs, design systems, DNAs) |
| `install` | Install a component from any source (skill, MCP, design system) |
| `uninstall` | Remove an installed component |
| `sync` | Sync registry with external sources (dna, local, aitmpl) |
| `doctor` | Run full ecosystem diagnostics and health check |
| `report` | Generate ecosystem report (md, json, html) |
| `stack init` | Generate `stack.yaml` from current ecosystem state |
| `stack apply` | Apply a `stack.yaml` file to restore ecosystem state |

### `behavioros agent`

| Subcommand | Description |
|------------|-------------|
| `list` | List all agents with status and skill counts |
| `skills` | Show skills for a specific agent |
| `validate` | Validate that an agent has required skills |

### `behavioros autonomous`

| Subcommand | Description |
|------------|-------------|
| `run` | Run a task through the autonomous orchestrator |
| `status` | Show autonomous orchestration status |
| `handoffs` | List active agent handoffs |

### `behavioros protocol`

| Subcommand | Description |
|------------|-------------|
| `check` | Verify protocol is active and enforced |
| `enforce` | Set enforcement level (strict, standard, audit) |
| `status` | Show detailed protocol enforcement status |

---

## Ecosystem Report Example

```markdown
# Ecosystem Report: my-project

**Timestamp:** 2026-07-20T12:00:00.000Z

## Agents (3)
| ID | Status | Skills |
|---|---|---|
| orchestrator | active | 5 skills |
| backend-agent | active | 12 skills |
| qa-agent | idle | 8 skills |

## Skills (24)
| ID | Type | Status |
|---|---|---|
| context7-mcp | mcp | active |
| enterprise-backend | skill | active |

## DNAs (5)
- enterprise-governance v1.0.0 — active
- surgical-team v0.2.0 — active
- manufacturing v0.3.0 — inactive
```

---

## Ecosystem Health

The `ecosystem doctor` command checks:

| Check | What It Validates |
|-------|-------------------|
| **SkillEngine** | Agent registration, skill resolution, delegation validation |
| **EcosystemRegistry** | Database connectivity, source synchronization |
| **AITMPL Adapter** | CLI availability, API connectivity |
| **Open Design Adapter** | CLI availability, design system detection |
| **UI-UX Pro Max** | Skill installation, data file integrity |
| **DNALoader** | DNA file loading, schema validation |
| **MCP Server** | Transport health, tool registration |

If any engine reports issues, the doctor provides actionable fix suggestions.
