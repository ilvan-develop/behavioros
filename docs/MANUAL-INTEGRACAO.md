# Manual Técnico — Integração BehaviorOS

> Guia genérico para agentes de IA integrarem BehaviorOS em qualquer projeto.
> Brocolis e FinPay são apenas exemplos de utilização.

---

## O que é BehaviorOS

BehaviorOS é um framework de governança comportamental para equipas de agentes IA. Fornece:

- **PipelineEngine** — Pipeline de 18 camadas de validação (EAARG)
- **Governance Engine** — Regras de bloqueio/escalação/log
- **Quality Engine** — Gates de qualidade (coverage, lint, typecheck, security)
- **Audit Engine** — Pipeline multi-estágio
- **Decision Engine** — Decisões por votação
- **Learning Engine** — Registo de eventos e deteção de padrões
- **Mission Engine** — Gestão de ciclo de vida de missões
- **MCP Server** — 28 tools + 5 resources para agentes IA
- **SDK** — API TypeScript de alto nível
- **CLI** — Ferramenta de linha de comandos

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    BehaviorOS Orchestrator                │
│  PipelineEngine → Governance → Quality → Audit → Mission │
│  MCP Server (28 tools + 5 resources) → Learning Engine   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │             O Teu Projeto                           │ │
│  │  (qualquer stack: NestJS, Next.js, React, etc.)    │ │
│  │                                                     │ │
│  │  1. Criar behavioros.yaml (DNA)                    │ │
│  │  2. Criar .behaviorosrc (config)                   │ │
│  │  3. Criar AGENTS.md (regras)                       │ │
│  │  4. Configurar MCP server                          │ │
│  │  5. Usar SDK no código                             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Pacotes Disponíveis

| Pacote | Descrição | Uso |
|--------|-----------|-----|
| `@behavioros/schemas` | Schemas Zod para todos os tipos | Importar tipos |
| `@behavioros/core` | 7 engines + PipelineEngine | Lógica de governança |
| `@behavioros/sdk` | SDK TypeScript | Integrar no teu projeto |
| `@behavioros/cli` | CLI (init, compile, validate, status) | Terminal |
| `@behavioros/mcp-server` | MCP server para agentes IA | OpenCode/Cursor/Claude |
| `@behavioros/observability-dashboard` | Métricas + Dashboards + Alertas | Monitorização |
| `@behavioros/finpay-integration` | Exemplo: integração FinPay + Brocolis | Referência |
| `@behavioros/e2e-tests` | 54 testes Playwright | Testes E2E |

---

## Fase 1: Configurar BehaviorOS no Teu Projeto

### Prompt para Agente IA

```
Cria a configuração BehaviorOS para o projeto [NOME_DO_PROJETO] em:
[DIRETORIO_DO_PROJETO]

Cria estes ficheiros:

1. .behaviorosrc (JSON):
{
  "dna": { "path": "./behavioros.yaml" },
  "governance": { "enabled": true, "level": "strict", "requireApproval": true },
  "quality": { "enabled": true, "minCoverage": 80, "enforceTypecheck": true, "enforceLint": true },
  "learning": { "enabled": true, "autoApply": false },
  "audit": { "enabled": true }
}

2. behavioros.yaml (YAML):
- id: [id-do-projeto]
- name: [Nome do DNA]
- version: '1.0.0'
- description: BehaviorOS config for [descrição]

Personas (adapta ao teu projeto):
- architect → arquiteto de software
- engineer → engenheiro sénior
- qa → responsável de QA
- security → engenheiro de segurança
- devops → engenheiro DevOps

Governance rules (adapta ao teu domínio):
- payment-changes → critical/block (se tiver pagamentos)
- security-review → critical/escalate
- api-changes → high/escalate
- database-changes → high/block
- compliance-changes → critical/block (se tiver compliance)

Quality gates:
- test_coverage: 80%
- lint: 100%
- typecheck: 100%
- security: 100%
- performance: 90%

Patterns (adapta ao teu domínio):
- payment-pipeline → pipeline de validação
- api-versioning → versionamento de API

Workflows (adapta ao teu domínio):
- payment-validation → workflow de validação
- security-audit → auditoria de segurança
- compliance-check → verificação de compliance

3. AGENTS.md:
- Visão geral do projeto
- Arquitetura (stack utilizada)
- Comandos de dev (pnpm dev, pnpm test, pnpm build)
- Convenções (formatter, TypeScript, testes)
- Módulos/APIs principais
- Domínio específico do projeto
```

---

## Fase 2: Configurar MCP Server

### Prompt para Agente IA

```
Configura o BehaviorOS MCP server para o projeto [NOME_DO_PROJETO].

1. Cria .opencode/config.json no diretório do projeto:
{
  "mcp": {
    "behavioros": {
      "command": "node",
      "args": ["[CAMINHO_PARA]/behavioros/packages/mcp-server/dist/index.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./behavioros.yaml",
        "BEHAVIOROS_PROJECT": "[id-do-projeto]"
      }
    }
  }
}

2. Cria GitHub Actions workflow:
   .github/workflows/behavioros.yml
   - Triggers: push, pull_request
   - Steps:
     - Checkout
     - Setup Node
     - pnpm install
     - pnpm --filter @behavioros/core build
     - npx @behavioros/cli validate
     - npx @behavioros/cli eaarg start
     - Upload report como artifact

3. Cria .github/workflows/behavioros-merge-gate.yml:
   - Bloqueia merge se pipeline EAARG falhar
   - Verifica quality gates
   - Verifica governance rules
```

---

## Fase 3: Integrar SDK no Teu Código

### Prompt para Agente IA

```
Integra o @behavioros/sdk no projeto [NOME_DO_PROJETO].

1. Adiciona dependência:
   "@behavioros/sdk": "workspace:*"  (monorepo)
   ou
   "@behavioros/sdk": "latest"      (projeto standalone)

2. Cria src/behavioros.ts:
   - Inicializa BehaviorOS com o DNA do projeto
   - Exibe funções utilitárias:
     - createMission(title, type, priority)
     - startMission(id)
     - completeMission(id, output)
     - evaluateGovernance(action, context)
     - evaluateQuality(metrics)
     - recordLearning(event)
     - runAudit(projectPath, stages)

3. Cria middleware/opção de governance:
   - Antes de cada ação crítica, avalia governance
   - Bloqueia se governance retornar block
   - Escala se governance retornar escalate
   - Log se governance retornar warn/log

4. Cria hook/plugin de quality gates:
   - Antes de cada deploy, corre quality gates
   - Bloqueia se coverage < threshold
   - Bloqueia se lint falhar
   - Bloqueia se typecheck falhar
```

---

## Fase 4: Dashboard de Observabilidade

### Prompt para Agente IA

```
Configura o dashboard de observabilidade para [NOME_DO_PROJETO].

1. Cria packages/grafana-dashboards/:
   - dashboards/[projeto].json:
     - Métricas de negócio (adapta ao teu domínio)
     - Métricas técnicas (latência, throughput, erros)
     - Métricas de qualidade (coverage, testes, lint)
     - Métricas de governância (bloqueios, escalações)

   - prometheus-rules.yml:
     - Alertas técnicos (HighErrorRate, HighLatency)
     - Alertas de negócio (adapta ao teu domínio)
     - Alertas BehaviorOS (PipelineFailure, QualityGateFail)

2. Cria docker-compose.observability.yml:
   - Prometheus (port 9090)
   - Grafana (port 3002)
   - Loki (port 3100)
   - Alertmanager (port 9093)
```

---

## Fase 5: E2E Tests

### Prompt para Agente IA

```
Cria testes E2E para o projeto [NOME_DO_PROJETO] usando Playwright.

1. Testes API (packages/e2e-tests/src/api/):
   - [dominio]-flow.spec.ts:
     - Fluxo principal do teu domínio
     - Happy path + error handling
     - Idempotência
     - Rate limiting

2. Testes Web (packages/e2e-tests/src/web/):
   - [fluxo].spec.ts (Page Object Model):
     - Navegação principal
     - Formulários
     - Interações
     - Validações

3. Testes Mobile (packages/e2e-tests/src/mobile/):
   - [fluxo].spec.ts (mobile emulation):
     - UX mobile
     - Touch gestures
     - Responsive

4. Testes BehaviorOS (packages/e2e-tests/src/behavioros/):
   - pipeline.spec.ts:
     - Iniciar pipeline EAARG
     - Validar cada layer
     - Pausar e retomar
     - Gerar relatório
```

---

## Exemplos de Utilização

### Exemplo 1: E-commerce

```yaml
# behavioros.yaml para e-commerce
id: my-ecommerce
name: E-commerce DNA
personas:
  - role: architect
    authority: architect
  - role: engineer
    authority: senior
  - role: qa
    authority: senior
governance:
  - id: checkout-changes
    name: Checkout Changes
    level: critical
    action: block
    conditions:
      - type:payment
      - type:checkout
quality:
  - id: test-coverage
    type: test_coverage
    threshold: 80
patterns:
  - id: checkout-pipeline
    name: Checkout Validation
    type: deployment
    triggers:
      - checkout_started
    actions:
      - validate_cart
      - process_payment
      - send_confirmation
workflows:
  - id: checkout-flow
    name: Checkout Flow
    type: action
    agent: engineer
    input:
      steps:
        - validate_cart
        - calculate_totals
        - process_payment
        - send_confirmation
```

### Exemplo 2: SaaS B2B

```yaml
# behavioros.yaml para SaaS B2B
id: my-saas
name: SaaS B2B DNA
personas:
  - role: architect
    authority: architect
  - role: engineer
    authority: senior
  - role: security
    authority: architect
governance:
  - id: tenant-isolation
    name: Tenant Isolation
    level: critical
    action: block
    conditions:
      - type:security
      - type:multi-tenant
  - id: billing-changes
    name: Billing Changes
    level: high
    action: escalate
    conditions:
      - type:billing
      - type:subscription
quality:
  - id: security-scan
    type: security
    threshold: 100
patterns:
  - id: tenant-provisioning
    name: Tenant Provisioning
    type: deployment
    triggers:
      - tenant_created
    actions:
      - create_schema
      - seed_data
      - configure_billing
      - send_welcome
```

### Exemplo 3: API REST

```yaml
# behavioros.yaml para API REST
id: my-api
name: REST API DNA
personas:
  - role: architect
    authority: architect
  - role: engineer
    authority: senior
governance:
  - id: breaking-changes
    name: Breaking Changes
    level: high
    action: escalate
    conditions:
      - type:api
      - type:breaking
quality:
  - id: test-coverage
    type: test_coverage
    threshold: 90
patterns:
  - id: api-versioning
    name: API Versioning
    type: review
    triggers:
      - api_change
    actions:
      - check_breaking
      - update_openapi
      - notify_consumers
```

---

## Comandos Úteis

```bash
# Build de todos os pacotes
pnpm build

# Testes de todos os pacotes
pnpm test

# Lint
pnpm lint

# Typecheck
pnpm typecheck

# Pipeline EAARG
npx @behavioros/cli validate --dna [dna-file].yaml
npx @behavioros/cli eaarg start

# MCP Server
node packages/mcp-server/dist/index.js

# E2E Tests
cd packages/e2e-tests && npx playwright test

# Dashboard
docker-compose -f docker-compose.observability.yml up -d
```

---

## Environment Variables

```env
# BehaviorOS
BEHAVIOROS_DNA_PATH=./behavioros.yaml
BEHAVIOROS_PROJECT=[id-do-projeto]
BEHAVIOROS_LOG_LEVEL=debug
```

---

## Ordem de Implementação

1. **Criar behavioros.yaml** — 15 min
2. **Criar .behaviorosrc** — 5 min
3. **Criar AGENTS.md** — 15 min
4. **Configurar MCP Server** — 30 min
5. **Integrar SDK** — 1 hora
6. **Configurar Observabilidade** — 1 hora
7. **Criar E2E Tests** — 2 horas

**Total estimado: ~5 horas de trabalho de agente IA**

---

## Referências

- `dnas/enterprise-agent-review.yaml` — DNA genérico com 18 camadas
- `packages/finpay-integration/` — Exemplo de integração FinPay + Brocolis
- `docs/SDK.md` — API reference completa
- `docs/CLI.md` — Guia do CLI
- `docs/ARCHITECTURE.md` — Arquitetura detalhada
- `docs/DNAs.md` — Catálogo de DNA patterns
