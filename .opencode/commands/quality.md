---
description: Check BehaviorOS quality metrics and gate status
agent: build
subtask: true
---

Analyze BehaviorOS quality metrics and quality gate status.

## Instructions

1. Run test suite with coverage: `pnpm test`
2. Run lint check: `pnpm lint:check`
3. Run type check: `pnpm typecheck`
4. Check build status: `pnpm build`
5. Analyze quality gates from DNA files
6. Compare actual metrics against gate thresholds

## Quality Metrics to Report

### Test Coverage
- Overall coverage percentage
- Per-package breakdown (schemas, core, sdk, cli, dnas, mcp-server)
- Lines, branches, functions coverage
- Files below 80% threshold

### Lint Status
- Total errors
- Total warnings
- Most common issues
- Files with most violations

### Type Safety
- Total TypeScript errors
- Per-package error count
- Common error patterns

### Build Health
- Build time per package
- Build failures (if any)
- Bundle size trends

### Quality Gate Evaluation
For each quality gate defined in DNA files:
- Gate name and metric
- Required threshold
- Actual value
- Status: PASS / FAIL

## Output Format

1. **Overall Score** — A-G grade based on combined metrics
2. **Gate Status** — Table of gates with pass/fail
3. **Details** — Per-metric breakdown
4. **Action Items** — Prioritized list to improve quality
