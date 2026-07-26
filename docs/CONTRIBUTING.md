# Contributing to BehaviorOS

> **Version:** 1.0.0  
> **Status:** Architecture Stabilization — Phase -1. Contribution guide for the architecture.  
> **Last Updated:** July 2026

---

## Overview

Thank you for your interest in contributing to BehaviorOS! This guide explains how to contribute effectively while maintaining the quality and architecture of the platform.

---

## Code of Conduct

- Be respectful and constructive
- Focus on the issue, not the person
- Welcome newcomers and help them learn
- Accept feedback gracefully

---

## How to Contribute

### 1. Report Bugs

1. Check existing issues
2. Create a new issue
3. Use the bug report template
4. Include reproduction steps
5. Include environment details

### 2. Suggest Features

1. Check existing RFCs
2. Create a new RFC
3. Follow the RFC process
4. Get community feedback
5. Get architecture approval

### 3. Submit Code

1. Fork the repository
2. Create a feature branch
3. Follow coding standards
4. Write tests
5. Update documentation
6. Submit a pull request

---

## Development Setup

### Prerequisites

- Node.js ≥ 22.0.0
- pnpm 11.6.0
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/behavioros/behavioros.git

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

---

## Coding Standards

### TypeScript

- Strict mode enabled
- ES2022 target
- ESNext modules
- Bundler resolution
- No `any` types
- No implicit `undefined`

### Formatting

- Biome v2.5.3
- 2 spaces indentation
- 100 character line width
- Single quotes
- Trailing commas: all

### Naming Conventions

- **Files:** `kebab-case.ts`
- **Classes:** `PascalCase`
- **Interfaces:** `PascalCase`
- **Functions:** `camelCase`
- **Variables:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Events:** `PascalCase` (e.g., `MissionCreated`)
- **Enums:** `PascalCase` with `PascalCase` members

### Code Organization

```
packages/
├── src/
│   ├── contracts/          # Interfaces and types
│   ├── implementations/    # Concrete implementations
│   ├── __tests__/          # Tests
│   └── index.ts            # Barrel exports
```

---

## Pull Request Process

### 1. Create Branch

```bash
git checkout -b feature/your-feature
```

### 2. Make Changes

- Follow coding standards
- Write tests
- Update documentation
- Update CHANGELOG

### 3. Run Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
```

### 4. Commit

Use conventional commits:

```bash
git commit -m "feat: add new capability"
git commit -m "fix: resolve memory leak"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for engine"
git commit -m "refactor: improve performance"
```

### 5. Push

```bash
git push origin feature/your-feature
```

### 6. Create Pull Request

- Use the PR template
- Reference related issues
- Describe changes
- Include screenshots (if applicable)
- Request review

### 7. Address Review

- Respond to feedback
- Make requested changes
- Re-request review

### 8. Merge

- Squash and merge
- Delete feature branch

---

## Testing

### Unit Tests

```bash
pnpm test
```

### Test Coverage

```bash
pnpm test:coverage
```

Target: ≥ 90% line coverage

### Integration Tests

```bash
pnpm test:integration
```

### E2E Tests

```bash
pnpm test:e2e
```

---

## Documentation

### API Documentation

Use TypeDoc/JSDoc for all public APIs:

```typescript
/**
 * Creates a new mission.
 * 
 * @param title - The mission title
 * @param type - The mission type
 * @returns The created mission
 * 
 * @example
 * ```typescript
 * const mission = createMission('Build API', 'feature');
 * ```
 */
function createMission(title: string, type: string): Mission {
  // ...
}
```

### CHANGELOG

Update CHANGELOG.md for all changes:

```markdown
## [1.1.0] - 2026-07-21

### Added
- New capability for OCR

### Changed
- Improved performance of knowledge graph

### Fixed
- Memory leak in learning engine

### Deprecated
- Old method (use new method instead)
```

---

## Architecture

### Architecture Principles

Follow the 15 architecture principles:

1. API First
2. Event First
3. Contracts First
4. Composition over Inheritance
5. Interfaces before Implementations
6. Immutable Events
7. Dependency Inversion
8. Plugin First
9. AI Native
10. Security by Design
11. Observability by Default
12. Testability by Design
13. Multi-tenant Ready
14. Distributed Ready
15. Backward Compatibility

### Dependency Rules

Follow the dependency matrix:

- Kernel depends on nothing
- Platforms depend only on Kernel
- No circular dependencies
- Metadata is READ-ONLY for all platforms

### Quality Gates

All components must pass quality gates:

1. Documentation
2. Unit Tests
3. Integration Tests
4. Metrics
5. Observability
6. Security Review
7. Performance Benchmark
8. ADR
9. Spec Updated
10. CHANGELOG Updated

---

## RFC Process

For new features or architectural changes:

1. Create RFC in `docs/RFC/`
2. Get community feedback
3. Get architecture approval
4. Create ADR
5. Implement
6. Test
7. Document
8. Release

See [RFC_PROCESS.md](./RFC_PROCESS.md) for details.

---

## ADR Process

For architectural decisions:

1. Create ADR in `docs/ADR/`
2. Document context, decision, consequences
3. Get architecture board approval
4. Implement decision
5. Update documentation

See [ARCHITECTURE_DECISION_PROCESS.md](./ARCHITECTURE_DECISION_PROCESS.md) for details.

---

## Getting Help

- **Documentation:** [docs.behavioros.dev](https://docs.behavioros.dev)
- **Discussions:** [GitHub Discussions](https://github.com/behavioros/behavioros/discussions)
- **Issues:** [GitHub Issues](https://github.com/behavioros/behavioros/issues)
- **Discord:** [BehaviorOS Discord](https://discord.gg/behavioros)

---

## License

By contributing to BehaviorOS, you agree that your contributions will be licensed under the Apache License 2.0.

---

*Contributing to BehaviorOS v1.0.0 — July 2026*
