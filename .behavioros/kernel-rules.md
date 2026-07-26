# BehaviorOS Kernel Rules — Absolute Kernel v1.0

## Overview
The Kernel Absoluto defines the absolute rules that govern all agent behavior in BehaviorOS. These rules are non-negotiable and must be followed before any task execution.

## The 10 Rules

### Rule 1: Zero Assumption
**Statement**: Never assume context; always verify.
**Enforcement**: CRITICAL
**Implementation**: CoverageEngine validates all context before execution
**Violation**: Task blocked until assumptions are verified

### Rule 2: Full Context Discovery
**Statement**: Discover ALL context before execution.
**Enforcement**: CRITICAL
**Implementation**: CoverageEngine checks 10 dimensions
**Violation**: Task blocked if coverage < 90%

### Rule 3: Coverage Validation
**Statement**: Coverage must be ≥ 90%.
**Enforcement**: CRITICAL
**Implementation**: CoverageGateLayer in pipeline
**Violation**: Task blocked until coverage threshold met

### Rule 4: Truth Before Execution
**Statement**: Resolve truth sources before delegating.
**Enforcement**: CRITICAL
**Implementation**: bos_resolve_truth MCP tool
**Violation**: Delegation blocked

### Rule 5: Domain Isolation
**Statement**: Respect domain boundaries.
**Enforcement**: HIGH
**Implementation**: Domain boundaries in core engine
**Violation**: Task blocked if crossing domains

### Rule 6: State Synchronization
**Statement**: Keep state synchronized across sessions.
**Enforcement**: HIGH
**Implementation**: MemoryEngine persists state
**Violation**: Warning logged

### Rule 7: Self Audit
**Statement**: Audit every action.
**Enforcement**: CRITICAL
**Implementation**: bos_run_audit MCP tool
**Violation**: Mission cannot be completed

### Rule 8: No Hallucination
**Statement**: Never fabricate information.
**Enforcement**: CRITICAL
**Implementation**: Truth resolution + coverage validation
**Violation**: Task blocked, correction recorded

### Rule 9: Context Recovery
**Statement**: Auto-recover from context loss.
**Enforcement**: HIGH
**Implementation**: ContextRecoveryEngine
**Violation**: Auto-recovery triggered

### Rule 10: Definition of Truth
**Statement**: Define what constitutes truth.
**Enforcement**: MEDIUM
**Implementation**: Truth sources defined in DNA patterns
**Violation**: Warning logged

## Enforcement Architecture
- MCP Server: DelegationEnforcementLayer blocks tools if protocol violated
- OpenCode Plugin: tool.execute.before hook intercepts non-delegation tools
- Runtime: Agent instructions (AGENTS.md, CLAUDE.md) mandate compliance

## Quality Gates
- Coverage Gate: Blocks execution if coverage < 90%
- Lint Gate: Blocks execution if lint errors > 0
- Typecheck Gate: Blocks execution if type errors > 0
- Security Gate: Blocks execution if critical vulnerabilities > 0
- Test Gate: Blocks execution if tests failing

## Recovery Mechanisms
- Checkpoints: Created before each phase
- Context Loss Detection: Coverage comparison
- Auto-Rebuild: From memory files + state
- Self-Healing: Auto-fix common issues
