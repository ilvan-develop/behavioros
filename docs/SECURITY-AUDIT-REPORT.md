# Security Audit Report
Date: 2026-07-20

## pnpm audit

```
3 vulnerabilities found
Severity: 2 low | 1 moderate
```

No high or critical vulnerabilities detected.

## pnpm outdated

```
┌───────────────────────────────────────┬─────────┬────────┐
│ Package                               │ Current │ Latest │
├───────────────────────────────────────┼─────────┼────────┤
│ @biomejs/biome (dev)                  │ 2.5.3   │ 2.5.4  │
├───────────────────────────────────────┼─────────┼────────┤
│ @changesets/cli (dev)                 │ 2.31.0  │ 2.31.1 │
├───────────────────────────────────────┼─────────┼────────┤
│ turbo (dev)                           │ 2.10.4  │ 2.10.5 │
├───────────────────────────────────────┼─────────┼────────┤
│ @commitlint/cli (dev)                 │ 19.8.1  │ 21.2.1 │
├───────────────────────────────────────┼─────────┼────────┤
│ @commitlint/config-conventional (dev) │ 19.8.1  │ 21.2.0 │
├───────────────────────────────────────┼─────────┼────────┤
│ lint-staged (dev)                     │ 15.5.2  │ 17.1.0 │
└───────────────────────────────────────┴─────────┴────────┘
```

## Recommendations

1. **No high/critical vulnerabilities** — the dependency tree is in a healthy security state.
2. **Address moderate and low advisories** — run `pnpm audit` and apply patches for the 1 moderate + 2 low vulnerabilities.
3. **Update patch-level devDependencies safely** — `@biomejs/biome`, `@changesets/cli`, and `turbo` are all one patch version behind and can be updated without breaking changes.
4. **Plan major updates for commitlint and lint-staged** — `@commitlint/cli` (19.x → 21.x), `@commitlint/config-conventional` (19.x → 21.x), and `lint-staged` (15.x → 17.x) have major version jumps that may introduce breaking changes. Schedule these separately with a review of changelogs.
5. **Run `pnpm update`** to apply safe patch/minor updates, then re-run audit to confirm no regressions.
