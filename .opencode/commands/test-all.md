---
description: Run all BehaviorOS tests with coverage report
agent: build
---

Run the complete test suite for all BehaviorOS packages with coverage.

## Instructions

1. Run all tests with coverage: `pnpm test`
2. If tests fail, analyze the failures
3. Provide a summary of results

## Output Format

### Test Results
- Total tests run
- Pass / Fail / Skip counts
- Execution time

### Coverage Report
- Overall coverage percentage
- Per-package breakdown:
  - `@behavioros/schemas` — coverage %
  - `@behavioros/core` — coverage %
  - `@behavioros/sdk` — coverage %
  - `@behavioros/cli` — coverage %
  - `@behavioros/dnas` — coverage %
  - `@behavioros/mcp-server` — coverage %

### Failures (if any)
For each failing test:
- Test file and name
- Error message
- Suggested fix

### Recommendations
- Packages needing more tests
- Critical paths lacking coverage
- Quick wins to improve coverage
