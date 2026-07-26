# BehaviorOS Architecture

## 9-Layer Architecture
1. Mission Layer → Mission lifecycle: create → start → execute → complete
2. Learning Layer → Record events → detect patterns → auto-apply fixes
3. Quality Layer → Quality gates: coverage, lint, typecheck, security
4. Audit Layer → Multi-stage pipeline: lint → typecheck → security → coverage → performance
5. Decision Layer → Voting-based decisions with approval thresholds
6. Governance Layer → Rule evaluation: block, escalate, warn, log
7. Behavioral Layer → DNA loading, validation, composition
8. Schema Layer → Zod v4.4.3 schemas for all types
9. DNA Layer (YAML) → Personas, governance rules, quality gates, patterns, workflows

## 7 Engines
1. BehavioralEngine → DNA loading and validation
2. GovernanceEngine → Rule evaluation and enforcement
3. DecisionEngine → Voting-based decisions
4. AuditEngine → Multi-stage audit pipeline
5. QualityEngine → Quality gate enforcement
6. LearningEngine → Event recording and pattern detection
7. MissionEngine → Mission lifecycle management

## New Engines (Kernel Absoluto)
8. CoverageEngine → Context coverage calculation (10 dimensions, 90% threshold)
9. MemoryEngine → Persistent state in .behavioros/ markdown files
10. ContextRecoveryEngine → Checkpoints, loss detection, auto-rebuild
11. SelfHealingEngine → Quality gate monitoring and auto-remediation

## Pipeline Layers
- CoverageGateLayer → Blocks execution if coverage < 90%
- GovernanceLayer → Evaluates governance rules
- QualityLayer → Enforces quality gates
- AuditLayer → Runs audit stages
