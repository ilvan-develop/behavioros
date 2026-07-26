# BehaviorOS Quality

## Quality Gates
- Coverage: ≥ 90% (Kernel Absoluto rule)
- Lint: 0 errors (Biome)
- Typecheck: 0 errors (TypeScript strict)
- Security: 0 critical vulnerabilities
- Tests: All passing

## Quality Dimensions
1. Architecture → docs/ARCHITECTURE.md exists
2. DNAs → dnas/*.yaml files exist
3. State → .agent_state.json exists
4. Dependencies → package.json files correct
5. Skills → .opencode/skills/ directories exist
6. Governance → governance rules exist
7. Quality → quality gates configured
8. Platform Adapters → config files exist
9. MCP Tools → server has registered tools
10. Documentation → docs/ files exist

## Quality Metrics
- Total Tests: 869+
- Test Files: 39+
- Coverage: Calculated by CoverageEngine
- Self-Healing: Auto-fix patterns registered
