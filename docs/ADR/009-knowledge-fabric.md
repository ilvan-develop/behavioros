# ADR-009: Knowledge Fabric

**Status:** Accepted  
**Date:** 2026-07-21  
**Deciders:** BehaviorOS Architecture Team  

---

## Context

Knowledge Graphs alone are insufficient for AI reasoning in a cognitive operating system. They lack vector similarity search, temporal memory, evidence tracking, truth validation, and semantic abstraction layers needed for sophisticated agent cognition.

## Decision

We adopt **Knowledge Fabric** as the unified knowledge layer — a composition of seven interconnected subsystems:

1. **Knowledge Graph** — Entity-relationship store for structured domain knowledge
2. **Vector DB** — Embedding storage for semantic similarity search
3. **Ontology Layer** — Formal schema definitions, taxonomies, and inference rules
4. **Memory Layer** — Episodic and procedural memory with time-aware recall
5. **Evidence Store** — Source attribution, provenance, and confidence scoring
6. **Truth Engine** — Consensus-based truth validation and conflict resolution
7. **Semantic Layer** — Natural language query interface and concept mapping

## Consequences

### Positive

- Rich multi-modal knowledge representation
- Better AI reasoning through combined structured + semantic retrieval
- Evidence-backed decisions with provenance tracking
- Temporal awareness through memory integration

### Negative

- Increased storage and operational complexity
- Synchronization overhead across seven subsystems
- Query routing logic required to dispatch across layers

### Risks

- Data inconsistency between layers (mitigated by Truth Engine validation)
- Performance degradation under high query load (mitigated by caching and routing)

---

*ADR-009: Knowledge Fabric — Accepted 2026-07-21*
