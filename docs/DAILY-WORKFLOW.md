# BehaviorOS — Guia de Utilização Diária

> Guia prático para equipas de agentes IA usarem BehaviorOS no dia a dia.
> Exemplo real: FinPay (plataforma de pagamentos com 28 agentes especializados).

---

## Visão Geral

BehaviorOS é um framework de governança comportamental para equipas de agentes IA. Fornece:

- **DNA Packages** — Configurações comportamentais em YAML (personas, regras, quality gates)
- **MCP Server** — 36 tools para agentes IA interagirem com o sistema
- **Governance Engine** — Avaliação de acções antes de executar (block/escalate/warn/log)
- **Quality Engine** — Gates de qualidade (coverage, lint, typecheck, security)
- **Audit Engine** — Pipeline multi-estágio
- **Learning Engine** — Deteção de padrões e auto-aplicação
- **Mission Engine** — Gestão de ciclo de vida de missões

---

## Arquitectura de Agentes

```
┌─────────────────────────────────────────────────────────────┐
│                      Orchestrator                            │
│  (coordena, delega, nunca edita directamente)                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Backend  │ │ Frontend │ │Database  │ │Security  │       │
│  │ Engineer │ │ Engineer │ │ Engineer │ │ Engineer │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ QA Lead  │ │ DevOps   │ │Architect │ │Knowledge │       │
│  │          │ │ Engineer │ │          │ │  Agent   │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                   BehaviorOS MCP Server                      │
│  36 tools + 5 resources (stdio transport)                   │
├─────────────────────────────────────────────────────────────┤
│                   DNA Package (YAML)                         │
│  Personas + Governance Rules + Quality Gates + Workflows     │
└─────────────────────────────────────────────────────────────┘
```

---

## Fluxo de Trabalho Diário

### 1. Abrir o Projecto

```bash
cd ~/Desktop/GitHub\ Apps/finpay-app
opencode
```

O OpenCode carrega automaticamente:
- `opencode.json` → MCP server BehaviorOS (36 tools)
- `.opencode/agents/` → 28 agentes especializados
- `AGENTS.md` → regras de comportamento

---

### 2. Antes de Qualquer Tarefa — DNA Selection

**O orchestrator SEMPRE faz isto primeiro:**

```
bos_select_dna(taskType, domain, riskLevel, complexity)
```

| Parâmetro | Opções | Exemplo |
|---|---|---|
| `taskType` | feature, bugfix, refactor, security, review, deploy | `feature` |
| `domain` | payments, auth, frontend, backend, database, infra | `payments` |
| `riskLevel` | low, medium, high, critical | `high` |
| `complexity` | simple, medium, complex | `complex` |

**Exemplo:**
```
User: "Adicionar validação 3DS no fluxo de pagamento"

Orchestrator:
  bos_select_dna(taskType: "feature", domain: "payments", riskLevel: "critical", complexity: "complex")

Retorna:
  Padrão: manufacturing (confidence: 78%)
  Princípios: deterministic-pipelines, zero-defect, strict-sequencing
  Proibido: skip-validation, async-without-await
```

---

### 3. Criar Missão

```
create-mission(
  title: "Implementar validação 3DS",
  type: "feature",
  priority: "critical",
  description: "Adicionar autenticação 3DS2 no fluxo de pagamento"
)
```

**Ciclo de vida da missão:**
```
created → in_progress → completed | failed
```

| Estado | Descrição | Transições |
|---|---|---|
| `created` | Missão definida, não iniciada | → `in_progress` |
| `in_progress` | A ser trabalhada | → `completed`, `failed` |
| `completed` | Terminada com sucesso | Estado final |
| `failed` | Não pôde ser completada | Estado final |

---

### 4. Delegar ao Agente Correcto

| Tarefa | Agente | Role | Autoridade |
|---|---|---|---|
| Novo endpoint API | `finpay-backend` | engineer | senior |
| Componente React | `finpay-frontend` | engineer | senior |
| Migration Prisma | `finpay-database` | engineer | senior |
| Review de segurança | `finpay-security` | security | architect |
| Bug fix | `finpay-backend` | engineer | senior |
| Deploy | `finpay-devops` | devops | senior |
| Review de código | `finpay-code-review` | qa | senior |
| Arquitetura | `finpay-architect` | architect | architect |
| Testes E2E | `finpay-testing` | qa | senior |
| Performance | `finpay-performance` | engineer | senior |
| Documentação | `finpay-documentation` | knowledge | senior |

**Fluxo de delegação:**
```
Orchestrator
    ↓
  bos_select_dna (obter padrão + princípios)
    ↓
  bos_resolve_truth (obter docs actualizadas)
    ↓
  create-mission (rastrear trabalho)
    ↓
  Task tool → Subagente especializado
    ↓
  DNA principles injected no prompt
    ↓
  Subagente executa
    ↓
  bos_lsp_diagnostics (feedback real-time)
    ↓
  bos_lsp_validate (quality gate)
    ↓
  bos_run_audit (audit trail)
    ↓
  update-progress (completar missão)
    ↓
  record-learning (capturar padrões)
```

---

### 5. Regras de Governança

| Regra | Nível | Accão | Trigger |
|---|---|---|---|
| `payment-logic-changes` | critical | **BLOCK** | payment, validation, fraud_detection |
| `security-sensitive-changes` | critical | **ESCALATE** | security, auth, encryption |
| `compliance-changes` | critical | **ESCALATE** | compliance, lgpd, pci_dss |
| `database-migrations` | high | **ESCALATE** | database, migration, schema |
| `api-contract-changes` | high | **WARN** | api, contract, breaking_change |
| `orchestrator-no-edit` | critical | **BLOCK** | orchestrator tenta editar |

**Exemplo de bloqueio:**
```
Agent tenta: deploy-production
Governance evaluation:
  → payment-logic-changes matched (type: deployment + payment)
  → action: BLOCK
  → "Deploy requires security + architect review"
  → Agente NÃO pode fazer deploy sem aprovação
```

**Exemplo de escalação:**
```
Agent tenta: security-sensitive-changes
Governance evaluation:
  → security-sensitive-changes matched
  → action: ESCALATE
  → shouldEscalate: true
  → "Requires human approval"
```

---

### 6. Quality Gates

**Antes de cada commit, o agente DEVE verificar:**

```
bos_lsp_diagnostics(projectPath: "apps/api")
  → Feedback real-time: erros TypeScript, ESLint

bos_lsp_validate(projectPath: "apps/api", failOnError: true, maxErrors: 0)
  → Quality gate: 0 erros obrigatório
```

**Checklist automático:**

| Gate | Threshold | Validação |
|---|---|---|
| Test Coverage | ≥ 80% | `bos_lsp_validate` |
| Lint | 0 errors | `pnpm lint` |
| TypeCheck | 0 errors | `pnpm typecheck` |
| Security | 0 critical | `bos_run_audit` |
| Performance | ≥ 90 | `bos_run_audit` |

---

### 7. Após Completar — Audit + Learning

```
bos_run_audit(trigger: "commit")
  → Lint: ✅
  → Typecheck: ✅
  → Security: ✅
  → Coverage: ✅

update-progress(missionId, status: "completed")

record-learning(
  type: "insight",
  source: "post-mortem",
  content: "3DS validation requer review de segurança obrigatório",
  impact: "high"
)
```

---

### 8. Conflitos Entre Agentes

```
bos_resolve_conflict(
  type: "security_vs_feature",
  agentA: "finpay-security",
  agentB: "finpay-backend",
  context: "Security quer rate limiting, backend quer performance"
)

Retorna:
  resolution: "Implementar rate limiting com cache para manter performance"
  rationale: "Segurança não pode ser comprometida, mas cache resolve ambos"
```

**Tipos de conflito suportados:**

| Tipo | Descrição |
|---|---|
| `backend_vs_frontend` | Disputas sobre API contracts |
| `security_vs_feature` | Segurança vs velocidade de implementação |
| `qa_vs_developer` | Qualidade vs prazo |
| `devops_vs_backend` | Deploy vs estabilidade |
| `custom` | Conflito personalizado |

---

### 9. Escalação Humana

```
bos_check_escalation(trigger: "deploy to production")

Retorna:
  shouldEscalate: true
  trigger: "production deployment"
  reasoning: "Critical risk level requires human approval"
```

**Quando escalar:**

- Deploy para produção
- Mudanças em payment logic
- Alterações de segurança
- Breaking API changes
- Qualquer coisa com `riskLevel: critical`
- Migration de base de dados

---

### 10. Pipeline EAARG (Enterprise Agent Review Gate)

Para mudanças significativas, usar o pipeline de 9 camadas:

```
start-pipeline(project: "finpay")

Camadas:
  1. DNA         — Validar configuração comportamental
  2. Schema      — Type safety (Zod schemas)
  3. Behavioral  — Compliance de boundaries
  4. Governance  — Avaliação de regras
  5. Decision    — Aprovação por votação
  6. Quality     — Thresholds de qualidade
  7. Audit       — Validação multi-estágio
  8. Mission     — Rastreamento de ciclo de vida
  9. Learning    — Deteção de padrões
```

**Usar quando:**
- Deploy para produção
- Features complexas
- Mudanças de arquitetura
- Refactors estruturais

---

## Comandos Úteis no Terminal

```bash
# Validar DNA
node ../behavioros/packages/cli/dist/bin.mjs validate behavioros.yaml

# Ver status do DNA
node ../behavioros/packages/cli/dist/bin.mjs status

# Comparar DNAs
node ../behavioros/packages/cli/dist/bin.mjs diff --from dna1.yaml --to dna2.yaml

# Simular prompt contra DNA
node ../behavioros/packages/cli/dist/bin.mjs simulate --dna behavioros.yaml --prompt prompt.txt

# Deploy com canary rollout
node ../behavioros/packages/cli/dist/bin.mjs deploy --dna behavioros.yaml --env staging

# Verificar drift comportamental
node ../behavioros/packages/cli/dist/bin.mjs drift-check --dna current.yaml --baseline baseline.yaml

# Testar MCP server manualmente
BEHAVIOROS_DNA_PATH=./behavioros.yaml BEHAVIOROS_PROJECT=finpay \
  node ../behavioros/packages/mcp-server/dist/server.js
```

---

## Tool Reference

### Tools Obrigatórias (antes de cada tarefa)

| Tool | Quando | O que faz |
|---|---|---|
| `bos_select_dna` | ANTES de cada tarefa | Escolhe padrão comportamental optimo |
| `bos_resolve_truth` | ANTES de delegar | Obtém DNA + docs actualizadas (Context7) |
| `create-mission` | ANTES de começar | Cria missão para rastrear |

### Tools de Execução (durante)

| Tool | Quando | O que faz |
|---|---|---|
| `Task tool` | Para delegar | Envia trabalho a subagente |
| `bos_lsp_diagnostics` | APÓS cada edit | Feedback real-time de código |
| `bos_lsp_validate` | ANTES de commit | Quality gate — 0 erros |

### Tools de Completar (após)

| Tool | Quando | O que faz |
|---|---|---|
| `bos_run_audit` | APÓS completar | Audit trail multi-estágio |
| `update-progress` | Em milestones | Actualiza estado da missão |
| `record-learning` | APÓS completar | Captura insights e padrões |

### Tools de Governança

| Tool | Quando | O que faz |
|---|---|---|
| `evaluate-governance` | Antes de acções | Avalia regras de governança |
| `bos_resolve_conflict` | Conflitos | Resolve disputas entre agentes |
| `bos_check_escalation` | Accões críticas | Verifica se precisa de aprovação |
| `bos_get_insights` | Monitorização | Estado dos padrões comportamentais |
| `bos_list_patterns` | Descoberta | Lista padrões disponíveis |

### Tools de Pipeline

| Tool | Quando | O que faz |
|---|---|---|
| `start-pipeline` | Mudanças significativas | Inicia pipeline EAARG de 9 camadas |
| `validate-layer` | Validação manual | Valida camada específica |
| `approve-layer` | Review manual | Aprova camada após review |
| `get-pipeline-status` | Monitorização | Estado actual do pipeline |
| `get-pipeline-report` | Relatório | Relatório completo do pipeline |

---

## Exemplos Práticos

### Exemplo 1: Bug Report

```
User: "O pagamento está a falhar com erro 500 no endpoint /api/payments"

1. bos_select_dna(taskType: "bugfix", domain: "payments", riskLevel: "critical")
   → Padrão: surgical-team (confidence: 85%)

2. create-mission(title: "Fix pagamento erro 500", type: "bugfix", priority: "critical")

3. bos_check_escalation(trigger: "payment system fix")
   → shouldEscalate: false (bug fix, não é mudança estrutural)

4. Delegar para finpay-backend:
   - Task: "Investigar e corrigir erro 500 em /api/payments"
   - DNA principles: zero-defect, root-cause-first
   - Forbidden: skip-validation

5. finpay-backend executa:
   - bos_lsp_diagnostics (após edits)
   - bos_lsp_validate (quality gate)
   - bos_run_audit(trigger: "commit")

6. update-progress(missionId, status: "completed")

7. record-learning(
     type: "correction",
     source: "bug-fix",
     content: "Timeout no Prisma query causou o 500",
     impact: "high"
   )
```

### Exemplo 2: Feature Nova

```
User: "Adicionar suporte para MB WAY como método de pagamento"

1. bos_select_dna(taskType: "feature", domain: "payments", riskLevel: "critical")
   → Padrão: manufacturing (confidence: 71%)

2. create-mission(title: "MB WAY payment method", type: "feature", priority: "high")

3. bos_resolve_truth(taskType: "feature", domain: "payments", libraries: ["nestjs", "prisma"])
   → DNA pattern + Context7 docs actualizadas

4. Delegar para finpay-architect:
   - Task: "Projectar arquitetura para MB WAY"
   - Output: ADR + C4 diagram

5. Delegar para finpay-backend:
   - Task: "Implementar MB WAY provider"
   - DNA: deterministic-pipelines, audit-trail
   - Forbidden: skip-contract

6. Delegar para finpay-testing:
   - Task: "Testes E2E para MB WAY"
   - DNA: zero-defect

7. bos_run_audit(trigger: "pr")
   → Todos os gates passam

8. Delegar para finpay-devops:
   - Task: "Deploy para staging"
   - bos_check_escalation → human approval required
```

### Exemplo 3: Security Fix

```
User: "Detectámos uma vulnerabilidade no endpoint de autenticação"

1. bos_select_dna(taskType: "security", domain: "auth", riskLevel: "critical")
   → Padrão: immune-system (confidence: 92%)

2. create-mission(title: "Fix vulnerabilidade auth", type: "bugfix", priority: "critical")

3. bos_check_escalation(trigger: "security vulnerability found")
   → shouldEscalate: true
   → "Security vulnerabilities require human approval"

4. [ESPERAR APROVAÇÃO HUMANA]

5. Delegar para finpay-security:
   - Task: "Corrigir vulnerabilidade de autenticação"
   - DNA: immune-system, zero-trust, defense-in-depth
   - Forbidden: skip-audit

6. finpay-security executa:
   - bos_lsp_diagnostics (security scan)
   - bos_lsp_validate (quality gate)
   - bos_run_audit(trigger: "commit")

7. update-progress(missionId, status: "completed")

8. record-learning(
     type: "insight",
     source: "security-audit",
     content: "Vulnerabilidade detectada: missing rate limit no /api/auth",
     impact: "critical"
   )
```

### Exemplo 4: Deploy para Produção

```
User: "Deploy da versão 2.1.0 para produção"

1. bos_select_dna(taskType: "deploy", domain: "infra", riskLevel: "critical")
   → Padrão: manufacturing (confidence: 75%)

2. create-mission(title: "Deploy v2.1.0 production", type: "deployment", priority: "critical")

3. start-pipeline(project: "finpay")
   → Pipeline EAARG de 9 camadas

4. [Cada camada é validada automaticamente]

5. bos_check_escalation(trigger: "production deployment")
   → shouldEscalate: true
   → "Production deployments require human approval"

6. [ESPERAR APROVAÇÃO HUMANA]

7. Delegar para finpay-devops:
   - Task: "Deploy v2.1.0 para produção"
   - DNA: deterministic-pipelines, zero-downtime
   - Forbidden: skip-rollback-plan

8. finpay-devops executa:
   - Canary rollout (5% → 25% → 50% → 100%)
   - Health checks em cada estágio
   - Auto-rollback se erro > 1%

9. update-progress(missionId, status: "completed")

10. record-learning(
      type: "observation",
      source: "deployment",
      content: "Deploy v2.1.0 completo sem incidentes",
      impact: "medium"
    )
```

---

## Regras de Ouro

### O Orchestrator NUNCA:
- Editar ficheiros directamente
- Escrever código
- Fazer commit
- Executar bash com comandos de modificação

### O Orchestrator SEMPRE:
- Usar `bos_select_dna` antes de cada tarefa
- Criar missão antes de delegar
- Delegar a subagentes especializados
- Correr audit após completar
- Escalar acções críticas para humano

### Qualquer Agente SEMPRE:
- Seguir princípios DNA durante execução
- Usar `bos_lsp_diagnostics` após edits
- Usar `bos_lsp_validate` antes de commit
- Auto-audit ao completar tarefa
- Record learning com insights

---

## Configuração

### Arquivos Essenciais

| Arquivo | Propósito |
|---|---|
| `behavioros.yaml` | DNA package — personas, regras, quality gates |
| `.behaviorosrc` | Configuração dos engines |
| `opencode.json` | Configuração MCP server + LSP |
| `AGENTS.md` | Regras de comportamento dos agentes |
| `.opencode/agents/*.md` | Definições dos 28 agentes |

### Variáveis de Ambiente

```bash
BEHAVIOROS_DNA_PATH=./behavioros.yaml    # Path para DNA
BEHAVIOROS_PROJECT=finpay                # ID do projecto
BEHAVIOROS_LOG_LEVEL=debug               # Nível de log
```

### Estrutura de Directorios

```
finpay-app/
  behavioros.yaml              # DNA package
  .behaviorosrc                # Engine config
  opencode.json                # MCP server config
  AGENTS.md                    # Agent rules
  .opencode/
    agents/                    # 28 agent definitions
    workflows/                 # Parallel-pairs workflow
    commands/                  # Custom commands
    hooks/                     # Lifecycle hooks
    plugins/                   # Plugins
    policies/                  # Permission policies
    rules/                     # Agent rules
    skills/                    # Custom skills
    tools/                     # Custom tools
  .behavioros/                 # BehaviorOS runtime
    core/                      # Core engine
    mcp-server/                # MCP server
    schemas/                   # Zod schemas
    reports/                   # Audit reports
  packages/behavioros/         # Local integration package
```

---

## Debugging

### MCP Server não inicia

```bash
# Verificar se o server.js existe
ls -la ../behavioros/packages/mcp-server/dist/server.js

# Testar manualmente
BEHAVIOROS_DNA_PATH=./behavioros.yaml BEHAVIOROS_PROJECT=finpay \
  node ../behavioros/packages/mcp-server/dist/server.js

# Verificar erros no stderr
# Procurar por: "DNA file not found" ou "Path traversal"
```

### DNA não valida

```bash
# Validar DNA
node ../behavioros/packages/cli/dist/bin.mjs validate behavioros.yaml

# Verificar erros comuns:
# - workflows.*.type: tipo inválido
# - personas: array vazio
# - governance rules: condições inválidas
```

### Quality gates falham

```bash
# Verificar coverage
pnpm test -- --coverage

# Verificar lint
pnpm lint

# Verificar typecheck
pnpm typecheck

# Corrigir erros antes de commit
```

### Governance bloqueia acção

```bash
# Verificar regras activas
# Procurar no behavioros.yaml por:
#   governance:
#     - id: <regra>
#       level: critical
#       action: block

# Opções:
# 1. Esperar aprovação (escalate)
# 2. Modificar acção para não trigger a regra
# 3. Pedir ao humano para alterar a regra
```

---

## Referências

- `docs/ARCHITECTURE.md` — Arquitetura completa do sistema
- `docs/SDK.md` — API reference do SDK
- `docs/CLI.md` — Guia do CLI
- `docs/DNAs.md` — Catálogo de DNA patterns
- `docs/MANUAL-INTEGRACAO.md` — Manual de integração técnica
- `docs/MONETIZATION.md` — Estratégia de monetização

---

*Documento elaborado em Julho 2026 — BehaviorOS v0.1.0*
