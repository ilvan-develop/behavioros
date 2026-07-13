# Manual Técnico — Integração BehaviorOS + Brocolis + FinPay

> Guia completo para agentes de IA implementarem a integração entre os três projetos.

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    BehaviorOS Orchestrator                    │
│  PipelineEngine (18 layers) → Governance → Quality → Audit   │
│  MCP Server (19 tools + 5 resources) → Learning Engine       │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                   │
│  ┌───────────────────────▼────────────────────┐             │
│  │              Brocolis Platform               │             │
│  │  NestJS API (28 módulos) + Next.js 16 Web    │             │
│  │  Expo 52 Mobile + 72 DB Models (Prisma 7)    │             │
│  │  Marketplace de farmácias para Angola         │             │
│  │  Pagamentos via Stripe + Prescrições          │             │
│  └───────────────────┬────────────────────────┘             │
│                      │                                       │
│                      │ Payment Intents                        │
│                      │                                        │
│  ┌───────────────────▼────────────────────┐                 │
│  │              FinPay Platform              │                 │
│  │  NestJS API + Next.js 16 Web              │                 │
│  │  Pipeline: OCR → Compliance → Fraud       │                 │
│  │  Trust Scoring + Reconciliation           │                 │
│  │  Multi-tenant SaaS + Billing              │                 │
│  └─────────────────────────────────────────┘                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Pacotes Criados

| Pacote | Caminho | Descrição |
|--------|---------|-----------|
| `@behavioros/schemas` | `packages/schemas` | Tipos Zod para EAARG, Skills, Pipeline |
| `@behavioros/core` | `packages/core` | PipelineEngine + 7 engines |
| `@behavioros/finpay-integration` | `packages/finpay-integration` | SDK FinPay + Brocolis Adapter + AI Health |
| `@behavioros/observability-dashboard` | `packages/observability-dashboard` | Métricas unificadas + Dashboards + Alertas |
| `@behavioros/mcp-server` | `packages/mcp-server` | 19 tools CI/CD + 9 tools Integration |
| `@behavioros/e2e-tests` | `packages/e2e-tests` | 54+ testes Playwright (API/Web/Mobile) |

---

## Fase 1: Configurar BehaviorOS no FinPay

### Prompt para Agente IA

```
Cria a configuração BehaviorOS para o projeto FinPay em:
C:\Users\Ilvan\Desktop\GitHub Apps\finpay-app

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
- id: finpay
- Personas: architect, senior_engineer, qa_lead, security_engineer, devops
- Governance rules: payment-changes (critical/block), security-review (critical/escalate),
  api-changes (high/escalate), database-changes (high/block), compliance-changes (critical/block)
- Quality gates: test_coverage (80%), lint (100%), typecheck (100%), security (100%), performance (90%)
- Patterns: payment-pipeline, api-versioning
- Workflows: payment-validation, payment-reconciliation, security-audit, compliance-check

3. AGENTS.md:
- Visão geral do projeto FinPay
- Arquitetura (NestJS + Next.js + Prisma + BullMQ + Supabase)
- Comandos de dev (pnpm dev, pnpm test, pnpm build)
- Convenções (Biome, TypeScript strict, Zod v4)
- Módulos API (payments, billing, tenants, webhooks, audit, ocr)
- Pipeline de validação de pagamentos
- Trust scoring engine
- Fraud detection engine
```

---

## Fase 2: Integrar FinPay SDK no Brocolis

### Prompt para Agente IA

```
Integra o @behavioros/finpay-integration no projeto Brocolis.

1. Adiciona dependência no package.json raiz do Brocolis:
   "@behavioros/finpay-integration": "workspace:*"

2. Cria packages/finpay-bridge no Brocolis:
   - src/finpay-bridge.ts:
     - Classe FinPayBridge que estende BrocolisAdapter
     - Métodos:
       - processOrderPayment(orderId, paymentMethod) → mapeia Brocolis order para FinPay intent
       - verifyPrescriptionPayment(prescriptionId) → valida prescrição via FinPay
       - handleDeliveryPayment(deliveryId) → processa pagamento de entrega
       - generateInvoice(orderId) → gera fatura via FinPay
       - reconcileSettlements(period) → reconciliação com farmácias
     - Integra com Brocolis Stripe para fallback
     - Webhook handler para status updates do FinPay

3. Cria packages/finpay-bridge/src/__tests__/finpay-bridge.test.ts:
   - Testes para cada método
   - Mock do FinPayClient
   - Testes de erro e retry

4. Atualiza o módulo de pagamento do Brocolis (apps/api/src/payments):
   - Adiciona FinPay como provider de pagamento alternativo
   - Configura via environment variables:
     FINPAY_API_KEY
     FINPAY_BASE_URL
     FINPAY_WEBHOOK_SECRET
     FINPAY_ENABLED=true/false

5. Cria migration para adicionar provider de pagamento:
   - enum PaymentProvider { STRIPE, FINPAY }
   - Adiciona campo provider na tabela Payment
```

---

## Fase 3: Configurar MCP Server para CI/CD

### Prompt para Agente IA

```
Configura o BehaviorOS MCP server para CI/CD nos projetos Brocolis e FinPay.

1. No Brocolis, cria .opencode/config.json:
{
  "mcp": {
    "behavioros": {
      "command": "node",
      "args": ["../behavioros/packages/mcp-server/dist/index.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./behavioros.yaml",
        "BEHAVIOROS_PROJECT": "brocolis"
      }
    }
  }
}

2. No FinPay, cria .opencode/config.json:
{
  "mcp": {
    "behavioros": {
      "command": "node",
      "args": ["../behavioros/packages/mcp-server/dist/index.js"],
      "env": {
        "BEHAVIOROS_DNA_PATH": "./behavioros.yaml",
        "BEHAVIOROS_PROJECT": "finpay"
      }
    }
  }
}

3. Cria GitHub Actions workflow para BehaviorOS:
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

4. Cria .github/workflows/behavioros-merge-gate.yml:
   - Bloqueia merge se pipeline EAARG falhar
   - Verifica quality gates
   - Verifica governance rules
```

---

## Fase 4: AI Health Assistant

### Prompt para Agente IA

```
Implementa o AI Health Assistant no mobile do Brocolis usando FinPay trust scoring.

1. No Brocolis mobile (apps/mobile), cria src/features/ai-assistant/
   - screens/AIAssistantScreen.tsx:
     - Interface de chat com assistente de IA
     - Input de texto +voice
     - Cards de recomendações
   - screens/MedicationInfoScreen.tsx:
     - Informação detalhada de medicamento
     - Interações medicamentosas
     - Efeitos colaterais
   - screens/PrescriptionVerifyScreen.tsx:
     - Upload de prescrição
     - Verificação via OCR
     - Score de confiança

2. Cria src/features/ai-assistant/api/health-api.ts:
   - analyzeMedicationInteraction(medications)
   - getHealthRecommendations(patientProfile)
   - verifyPrescriptionAuthenticity(prescription)
   - assessPaymentRisk(payment)

3. Cria src/features/ai-assistant/hooks/useAIAssistant.ts:
   - useChat() — gerencia conversa com assistente
   - useMedicationInfo() — busca info de medicamento
   - usePrescriptionVerify() — verifica prescrição

4. Integra com FinPay:
   - usePaymentRisk() — assessment de risco de pagamento
   - Usa trust score para decidir se pagamento é seguro
   - Mostra alertas de fraude ao utilizador

5. Cria testes:
   - src/features/ai-assistant/__tests__/ai-assistant.test.tsx
   - Testes de renderização
   - Testes de API
   - Testes de hooks
```

---

## Fase 5: Dashboard Unificado de Observabilidade

### Prompt para Agente IA

```
Configura o dashboard unificado de observabilidade.

1. Cria packages/grafana-dashboards/ no BehaviorOS:
   - dashboards/brocolis.json:
     - Métricas de pedidos (total, pendentes, completos, receita)
     - Métricas de prescrições (upload, verificação, rejeição)
     - Métricas de delivery (ativo, completado, falhou)
     - Métricas de utilizadores (ativo, novo, churned)
     - Latência API, taxa de erro, throughput

   - dashboards/finpay.json:
     - Métricas de pagamentos (total, aprovado, rejeitado, review)
     - Trust score (média, distribuição)
     - Fraude (detectado, falso positivo, verdadeiro positivo)
     - Compliance (aprovado, violações)
     - OCR (precisão, tempo de processamento)

   - dashboards/unified.json:
     - Métricas cross-platform
     - Correlação entre pagamentos e pedidos
     - Tendências de negócio
     - Health score geral

2. Cria packages/grafana-dashboards/prometheus-rules.yml:
   - Alertas Brocolis:
     - HighErrorRate: taxa_erro > 5%
     - LowInventory: estoque < 10
     - DeliveryDelay: tempo_entrega > 60min
   - Alertas FinPay:
     - HighFraudRate: fraude_detectada > 2%
     - OCRFailure: taxa_falha_ocr > 10%
     - ComplianceViolation: violacoes > 0
   - Alertas BehaviorOS:
     - PipelineFailure: pipeline_falhou > 0
     - QualityGateFail: quality_gate_falhou > 0
     - GovernanceBlock: governance_bloqueou > 0

3. Cria docker-compose.observability.yml:
   - Prometheus (port 9090)
   - Grafana (port 3002)
   - Loki (port 3100)
   - Alertmanager (port 9093)
   - Configura data sources automaticamente
```

---

## Fase 6: E2E Tests Completos

### Prompt para Agente IA

```
Completa os testes E2E para todas as apps.

1. Testes API (packages/e2e-tests/src/api/):
   - payment-flow.spec.ts:
     - Criar payment intent via FinPay
     - Upload de evidência (OCR)
     - Validar pagamento através do pipeline
     - Obter trust score
     - Processar refund
     - Reconciliar pagamentos
     - Webhook delivery
     - Idempotência em requests duplicados
     - Rate limiting
     - Error handling

   - brocolis-order.spec.ts:
     - Criar pedido multi-farmácia
     - Adicionar itens ao carrinho
     - Checkout com pagamento FinPay
     - Upload de prescrição
     - Verificar prescrição
     - Rastrear delivery
     - Cancelar pedido
     - Processar devolução
     - Guest checkout
     - Pharmacy dashboard

   - integration.spec.ts:
     - Fluxo completo: pedido → pagamento → validação → entrega
     - Prescrição verificada → pagamento → fulfillment
     - Pedido multi-farmácia com pagamentos separados
     - Detecção de fraude aciona review manual
     - Violação de compliance bloqueia pagamento
     - Trust score afeta status do pedido
     - Reconciliação confere pedidos vs pagamentos

2. Testes Web (packages/e2e-tests/src/web/):
   - checkout.spec.ts (Page Object Model):
     - Browse catálogo → adicionar ao carrinho → checkout
     - Aplicar cupom
     - Selecionar método de pagamento
     - Completar pagamento
     - Ver confirmação
     - Rastrear status
     - Falha de pagamento

   - pharmacy-dashboard.spec.ts (POM):
     - Login como pharmacy admin
     - Ver pedidos recebidos
     - Atualizar status do pedido
     - Gerir inventário
     - Ver relatórios financeiros
     - Gerir staff

   - admin-dashboard.spec.ts (POM):
     - Login como super admin
     - Ver analytics da plataforma
     - Aprovar nova farmácia
     - Gerir comissões
     - Ver audit log
     - Gerir feature flags

3. Testes Mobile (packages/e2e-tests/src/mobile/):
   - order-flow.spec.ts (Playwright mobile emulation):
     - Browse catálogo mobile
     - Adicionar ao carrinho
     - Checkout mobile
     - Ver histórico de pedidos
     - Rastrear delivery

   - ai-assistant.spec.ts:
     - Abrir assistente IA
     - Perguntar sobre medicamento
     - Obter recomendações
     - Verificar prescrição

4. Testes BehaviorOS (packages/e2e-tests/src/behavioros/):
   - pipeline.spec.ts:
     - Iniciar pipeline EAARG
     - Validar cada layer
     - Pausar e retomar
     - Gerar relatório
     - Registar learning events
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
npx @behavioros/cli validate --dna enterprise-agent-review.yaml
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

### Brocolis
```env
# FinPay Integration
FINPAY_API_KEY=your_api_key
FINPAY_BASE_URL=http://localhost:3001
FINPAY_WEBHOOK_SECRET=your_webhook_secret
FINPAY_ENABLED=true

# BehaviorOS
BEHAVIOROS_DNA_PATH=./behavioros.yaml
BEHAVIOROS_PROJECT=brocolis
```

### FinPay
```env
# BehaviorOS
BEHAVIOROS_DNA_PATH=./behavioros.yaml
BEHAVIOROS_PROJECT=finpay

# Brocolis Integration
BROCOLIS_API_URL=http://localhost:3001
BROCOLIS_WEBHOOK_SECRET=your_webhook_secret
```

---

## Ordem de Implementação

1. **Criar BehaviorOS no FinPay** (Fase 1) — 15 min
2. **Integrar FinPay SDK no Brocolis** (Fase 2) — 2 horas
3. **Configurar MCP Server CI/CD** (Fase 3) — 1 hora
4. **AI Health Assistant** (Fase 4) — 4 horas
5. **Dashboard Observabilidade** (Fase 5) — 2 horas
6. **E2E Tests Completos** (Fase 6) — 4 horas

**Total estimado: ~13 horas de trabalho de agente IA**
