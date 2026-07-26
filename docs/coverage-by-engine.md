# Coverage por Engine

> **Gerado em:** 2026-07-26  
> **Comando:** `pnpm --filter @behavioros/core test -- --coverage`  
> **Provider:** V8 (via Vitest)  
> **Total de testes:** 4.971 passed · 7 failed (155 test files passed, 4 failed)

---

## Visão Geral

| Métrica | Cobertura |
|---------|-----------|
| **Statements** | 0,93% (456/49.005) |
| **Branches** | 29,53% (127/430) |
| **Functions** | 8,38% (26/310) |
| **Lines** | 0,93% (456/49.005) |

A cobertura geral é baixa porque o **provider V8** rastreia apenas arquivos `.ts` carregados diretamente pelo Node.js em tempo de teste. A maioria dos engines é instanciada indiretamente via `BehaviorOSEngine` (facade), e o V8 não consegue atribuir cobertura de volta aos arquivos-fonte individuais após a compilação TypeScript → JavaScript.

---

## Cobertura por Engine

### Engines com cobertura > 0%

| Engine | Statements | Branches | Functions | Lines | Arquivos |
|--------|-----------|---------|----------|-------|----------|
| **quality** | **69,61%** | **86,39%** | **96,29%** | **69,61%** | 2 |

**Detalhamento do engine `quality`:**
| Arquivo | Stmts | Branch | Func | Status |
|---------|-------|--------|------|--------|
| `quality-engine.ts` | 94,4% | 86,98% | 100% | ✅ |
| `self-healing-engine.ts` | 0% | 0% | 0% | ❌ |

### Engines com cobertura 0% (29 engines)

| Engine | Statements | Arquivos |
|--------|-----------|----------|
| `adapters` | 0% | 4 |
| `agent-manager.ts` | 0% | 1 |
| `ai-platform` | 0% | 8 |
| `audit` | 0% | 2 |
| `behavioral` | 0% | 16 |
| `cloud` | 0% | 9 |
| `cognitive` | 0% | 8 |
| `core-engine.ts` | 0% | 1 |
| `coverage-engine.ts` | 0% | 1 |
| `decision` | 0% | 2 |
| `ecosystem` | 0% | 9 |
| `ecosystem-registry.ts` | 0% | 1 |
| `execution` | 0% | 3 |
| `governance` | 0% | 16 |
| `integration` | 0% | 8 |
| `intelligence` | 0% | 14 |
| `knowledge` | 0% | 16 |
| `learning` | 0% | 1 |
| `memory-engine.ts` | 0% | 1 |
| `mission` | 0% | 1 |
| `mission-manager.ts` | 0% | 1 |
| `observability` | 0% | 11 |
| `orchestrator` | 0% | 7 |
| `pipeline` | 0% | 1 |
| `protocol-engine.ts` | 0% | 1 |
| `recovery` | 0% | 1 |
| `runtime` | 0% | 9 |
| `security` | 0% | 6 |
| `skill-engine.ts` | 0% | 1 |

---

## Análise

### Problema estrutural: V8 provider vs Facade pattern

O `BehaviorOSEngine` (core-engine.ts) atua como facade que importa e delega para todos os sub-engines:

```
core-engine.ts
 ├── agent-manager.ts
 ├── audit/audit-engine.ts
 ├── governance/governance-engine.ts
 ├── learning/learning-engine.ts
 ├── mission/mission-engine.ts
 ├── mission-manager.ts
 ├── quality/quality-engine.ts
 ├── skill-engine.ts
 ├── ecosystem-registry.ts
 └── orchestrator/* (5 arquivos)
```

Os **4.971 testes passam** exercitando todos esses engines através da facade, mas o V8 coverage só consegue atribuir a cobertura ao arquivo `core-engine.ts` compilado, não aos `.ts` originais. Por isso aparecem como 0%.

### Exceção: quality engine

O engine `quality` tem testes que importam `quality-engine.ts` **diretamente** (via `quality-engine-exec.test.ts`), o que permite ao V8 rastrear a cobertura nos arquivos-fonte. `self-healing-engine.ts` está a 0% porque não tem testes diretos.

---

## Recomendações

### Curto prazo

1. **Cobertura real ignorada pelo V8** — Trocar provider para `istanbul` em vez de `v8` no `vitest.config.ts`:
   ```ts
   coverage: { provider: 'istanbul' }
   ```
   Istanbul instrumenta o código-fonte antes da execução, capturando cobertura mesmo via facade.

2. **Testes para `self-healing-engine.ts`** — Criar teste direto (ex.: `self-healing-engine.test.ts`) que importe o arquivo e exercite seus métodos.

### Médio prazo

3. **Testes diretos por engine** — Para cada engine sem cobertura, adicionar ao menos 1 arquivo de teste que importe o engine diretamente:
   - `governance/governance-engine.test.ts`
   - `decision/decision-engine.test.ts`
   - `behavioral/dna-loader.test.ts`
   - `audit/audit-engine.test.ts`

4. **Pipeline de coverage gate** — Configurar GitHub Action para bloquear PRs se coverage geral cair abaixo de um threshold (ex.: 60% statements após migração para Istanbul).

### Longo prazo

5. **Meta de cobertura** — Targets por engine:
   | Prioridade | Engine | Meta |
   |-----------|--------|------|
   | 🔴 Crítica | `governance`, `audit` | ≥ 90% |
   | 🟡 Alta | `decision`, `orchestrator`, `pipeline` | ≥ 80% |
   | 🟢 Média | Demais engines | ≥ 70% |

---

## Notas Técnicas

- **Provider atual:** `v8` — mais rápido, mas não instrumenta código-fonte não carregado diretamente
- **Flags:** `--all` implícito via Istanbul remapping — toda a src/ entra no relatório
- **285 arquivos** no relatório total, apenas **1** (quality-engine.ts) com hits > 0
- **159 test files** executados (155 passed, 4 failed)
- A cobertura real dos engines exercidos via `BehaviorOSEngine` é maior que o reportado, mas não mensurável com o provider atual
