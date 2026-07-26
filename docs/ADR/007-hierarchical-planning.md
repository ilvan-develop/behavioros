# ADR-007: Hierarchical Intelligence Planning

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS needs to handle complex, multi-level planning for AI agents. Simple flat planning is insufficient for:
- Large-scale projects
- Multi-team coordination
- Strategic alignment
- Incremental execution
- Dynamic replanning

The system must support planning from high-level strategy down to individual actions.

## Decision

We implement a **10-level Hierarchical Planning** system:

### Planning Levels:

```
Intent → Goal → Objective → Strategy → Program → Project → Mission → Workflow → Task → Action
```

### Level 1: Intent

**Description:** High-level user intent.

**Example:** "Build a user management API"

**Output:** Intent classification, confidence score

### Level 2: Goal

**Description:** Decomposed goal from intent.

**Example:** "User management API with CRUD operations"

**Output:** Goal hierarchy, dependencies

### Level 3: Objective

**Description:** Specific, measurable objectives.

**Example:** "Implement user CRUD endpoints"

**Output:** Objectives with success criteria

### Level 4: Strategy

**Description:** Approach to achieve objectives.

**Example:** "REST API with PostgreSQL, JWT auth"

**Output:** Strategy document, technology choices

### Level 5: Program

**Description:** Collection of related projects.

**Example:** "User Management Program"

**Output:** Program plan, resource allocation

### Level 6: Project

**Description:** Scoped deliverable.

**Example:** "User API Project"

**Output:** Project plan, timeline, budget

### Level 7: Mission

**Description:** Executable unit of work.

**Example:** "Implement user CRUD endpoints"

**Output:** Mission plan, task decomposition

### Level 8: Workflow

**Description:** Sequence of tasks.

**Example:** "Design → Implement → Test → Deploy"

**Output:** Workflow definition, state machine

### Level 9: Task

**Description:** Atomic unit of work.

**Example:** "Create user table migration"

**Output:** Task definition, assignee, deadline

### Level 10: Action

**Description:** Concrete action to execute.

**Example:** "Run SQL migration"

**Output:** Action definition, parameters, rollback

### Planning Engine:

The Planning Engine orchestrates all 10 levels:
- Decomposes intent into goals
- Goals into objectives
- Objectives into strategies
- Strategies into programs
- Programs into projects
- Projects into missions
- Missions into workflows
- Workflows into tasks
- Tasks into actions

### Replanning:

The system supports dynamic replanning at any level:
- Mission failed → replan mission
- Task blocked → replan task
- Strategy ineffective → replan strategy
- Goal changed → replan all levels

## Consequences

### Positive

- Supports complex, multi-level planning
- Enables strategic alignment
- Supports incremental execution
- Dynamic replanning at any level
- Better resource allocation
- Clear accountability at each level

### Negative

- Increased complexity
- More planning overhead
- Requires sophisticated algorithms
- Debugging complexity

### Risks

- Planning overhead (mitigated by caching)
- Over-engineering (mitigated by simplicity)
- Replanning storms (mitigated by backoff)

## Alternatives Considered

### Alternative 1: Flat Planning

**Description:** Simple task list without hierarchy.

**Why Rejected:**
- Cannot handle complex projects
- No strategic alignment
- No incremental execution
- No replanning capability

### Alternative 2: 3-Level Planning

**Description:** Strategy → Mission → Task.

**Why Rejected:**
- Too coarse for large projects
- Missing intermediate levels
- Limited flexibility

## References

- [INTELLIGENCE_SPEC.md](../INTELLIGENCE_SPEC.md) — Intelligence Platform specification
- [RUNTIME_SPEC.md](../RUNTIME_SPEC.md) — Runtime Platform specification
- [ARCHITECTURE_PRINCIPLES.md](../ARCHITECTURE_PRINCIPLES.md) — Principle #9: AI Native

---

*ADR-007: Hierarchical Intelligence Planning — Accepted 2026-07-21*
