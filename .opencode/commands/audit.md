---
description: Run the full BehaviorOS audit pipeline (lint → typecheck → security → coverage → performance)
agent: build
subtask: true
---

Run the complete BehaviorOS audit pipeline. Execute each stage sequentially and report results.

## Pipeline Stages

1. **Lint** — Run `pnpm lint:check` to verify code quality
2. **TypeCheck** — Run `pnpm typecheck` to verify type safety
3. **Build** — Run `pnpm build` to verify all packages compile
4. **Test** — Run `pnpm test` to verify test coverage

## Instructions

Execute each stage in order. If any stage fails, report the failure and continue with remaining stages. At the end, provide:

1. **Stage Results** — Pass/fail for each stage
2. **Issues Summary** — Total errors and warnings found
3. **Top Issues** — The 3 most critical problems to fix
4. **Recommendations** — Prioritized list of fixes

Focus on actionable findings. Do not just report numbers — explain what needs to change and why.
