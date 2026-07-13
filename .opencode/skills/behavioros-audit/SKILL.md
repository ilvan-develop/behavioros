---
name: behavioros-audit
description: Guide for running and analyzing the BehaviorOS multi-stage audit pipeline
license: MIT
compatibility: opencode
metadata:
  audience: developers, qa-engineers
  workflow: behavioros
---

## What I do

I provide guidance for running, analyzing, and optimizing the BehaviorOS audit pipeline. The audit pipeline runs 5 stages sequentially to verify code quality, type safety, security, coverage, and performance.

## When to use me

Use this skill when:
- Running the audit pipeline
- Analyzing audit results
- Fixing audit failures
- Setting up audit stages
- Understanding audit metrics

## Audit Pipeline Stages

### Stage 1: Lint
**Command:** `pnpm lint:check`
**Tool:** Biome v2.5.3
**Checks:** Code style, unused variables, unused imports, formatting

**Common Issues:**
- Unused variables/imports → Remove or prefix with `_`
- Formatting issues → Run `pnpm format`
- Import ordering → Run `pnpm lint` (auto-fix)

### Stage 2: TypeCheck
**Command:** `pnpm typecheck`
**Tool:** TypeScript (strict mode)
**Checks:** Type safety, missing types, type compatibility

**Common Issues:**
- Implicit `any` → Add explicit type annotations
- Missing properties → Implement required interface members
- Type mismatches → Fix type assignments

### Stage 3: Security
**Checks:** Vulnerability scanning, secrets detection
**Tools:** npm audit, custom checks

**Common Issues:**
- Known vulnerabilities → Update dependencies
- Hardcoded secrets → Use environment variables
- Insecure patterns → Follow security best practices

### Stage 4: Coverage
**Command:** `pnpm test`
**Tool:** Vitest with V8 coverage
**Checks:** Test coverage metrics

**Thresholds:**
- Lines: ≥ 80%
- Branches: ≥ 75%
- Functions: ≥ 80%
- Statements: ≥ 80%

### Stage 5: Performance
**Checks:** Build time, bundle size, runtime metrics

**Metrics:**
- Build time per package
- Total bundle size
- Test execution time

## Running Audits

```bash
# Full pipeline
pnpm lint:check && pnpm typecheck && pnpm build && pnpm test

# Individual stages
pnpm lint:check      # Lint only
pnpm typecheck       # Type check only
pnpm build           # Build only
pnpm test            # Tests only

# Auto-fix issues
pnpm lint            # Lint with auto-fix
pnpm format          # Format code
```

## Analyzing Results

For each stage, report:
1. **Status** — Pass/Fail
2. **Errors** — Critical issues that must be fixed
3. **Warnings** — Issues that should be addressed
4. **Details** — Specific file:line references
5. **Fix Suggestions** — How to resolve each issue

## Reference Files

- `packages/core/src/engines/audit/` — Audit engine implementation
- `packages/core/src/engines/audit/stages/` — Stage implementations
- `biome.json` — Linter configuration
- `turbo.json` — Build pipeline
