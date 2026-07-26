# ADR-004: Capability as Universal Concept

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** Architecture Board  

---

## Context

BehaviorOS has multiple types of executable components:
- Skills (agent capabilities)
- Engines (system components)
- Plugins (extension modules)
- Agents (AI agents)
- Models (AI models)
- Tools (utility functions)
- Connectors (integration points)
- Workflows (process definitions)
- Policies (governance rules)
- Adapters (technology bridges)

Managing these as separate concepts creates fragmentation and makes composition difficult.

## Decision

We unify all executable components under the concept of **Capability**.

### Definition:

A Capability is any executable component that can be:
- Registered in the Metadata Platform
- Discovered via the Capability Graph
- Composed with other Capabilities
- Versioned and evolved
- Monitored and measured

### Capability Types:

| Type | Description | Examples |
|------|-------------|----------|
| **Skill** | Agent capability | OCR, Translation, Planning |
| **Engine** | System component | Knowledge Graph, Model Router |
| **Plugin** | Extension module | Custom adapter, custom tool |
| **Agent** | AI agent | Reviewer, Tester, Deployer |
| **Model** | AI model | GPT-5, Claude, Gemini |
| **Tool** | Utility function | File reader, API caller |
| **Connector** | Integration point | Slack, GitHub, Jira |
| **Workflow** | Process definition | Deploy pipeline, Review process |
| **Policy** | Governance rule | Security policy, Cost policy |
| **Adapter** | Technology bridge | Kafka adapter, Redis adapter |

### Capability Metadata:

Every capability registers:
- Identity (id, name, version, type)
- State (proposal → prototype → review → registry → marketplace → production)
- Capabilities (what it can do)
- Dependencies (what it needs)
- Quality (reliability, latency, cost)
- Access (permissions, tenants)
- Documentation (description, readme, changelog)

## Consequences

### Positive

- Unified concept for all executable components
- Simplified discovery and composition
- Consistent lifecycle management
- Better marketplace experience
- Simplified capability graph

### Negative

- May oversimplify diverse component types
- Requires careful type differentiation
- Migration from existing concepts needed

### Risks

- Concept confusion (mitigated by clear documentation)
- Migration complexity (mitigated by backward compatibility)

## Alternatives Considered

### Alternative 1: Separate Concepts

**Description:** Keep skills, engines, plugins, etc. as separate concepts.

**Why Rejected:**
- Fragmented ecosystem
- Difficult composition
- Inconsistent lifecycle
- Complex discovery

### Alternative 2: Unified "Component"

**Description:** Use generic "component" instead of "capability".

**Why Rejected:**
- Too generic
- Doesn't convey executable nature
- Less semantic meaning

## References

- [CAPABILITY_LIFECYCLE.md](../CAPABILITY_LIFECYCLE.md) — Capability lifecycle
- [CAPABILITY_SPEC.md](../CAPABILITY_SPEC.md) — Capability specification
- [METADATA_SPEC.md](../METADATA_SPEC.md) — Metadata Platform

---

*ADR-004: Capability as Universal Concept — Accepted 2026-07-21*
