# BehaviorOS — Guia Enterprise para Fintechs

> Guia de implementação do BehaviorOS em instituições financeiras reguladas.
> Cobre conformidade PCI-DSS, SOX, GDPR/LGPD, BACEN, e boas práticas
> para sistemas de pagamento, banking, e investimentos.

---

## Índice

1. [Porquê BehaviorOS em Fintechs](#porquê-behavioros-em-fintechs)
2. [Mapeamento Regulatório](#mapeamento-regulatório)
3. [Governança Financeira](#governança-financeira)
4. [Quality Gates Financeiros](#quality-gates-financeiros)
5. [Audit Trails para Compliance](#audit-trails-para-compliance)
6. [DNA Patterns para Fintech](#dna-patterns-para-fintech)
7. [Enforcement Levels em Produção](#enforcement-levels-em-produção)
8. [CI/CD Compliance PCI/SOX](#cicd-compliance-pcisox)
9. [Exemplo Prático: Gateway de Pagamentos](#exemplo-prático-gateway-de-pagamentos)
10. [Checklist de Conformidade](#checklist-de-conformidade)

---

## Porquê BehaviorOS em Fintechs

Instituições financeiras enfrentam desafios únicos que o BehaviorOS resolve:

| Desafio | Problema | Como BehaviorOS Resolve |
|---------|----------|------------------------|
| **Regulamentação multi-orgão** | PCI-DSS, SOX, BACEN, LGPD sobrepõem-se | Governance Engine avalia múltiplas rulesets simultaneamente |
| **Zero-defect em transações** | Erro de centavo vira passivo milionário | Quality Gates com `threshold: 100` em métricas críticas |
| **Audit trail obrigatório** | Reguladores exigem rastreabilidade total | Mission Engine + Audit Engine registam cada decisão |
| **Separação de poderes** | Quem desenvolve não pode aprovar | Personas com boundaries rígidas (ex: dev não faz deploy prod) |
| **Resposta a incidentes** | Fraude/vazamento requer contenção em minutos | Incident Response pattern com escalation automático |
| **Deploy em produção** | Janelas de deploy restritas, rollback obrigatório | Release Process workflow com canary + auto-rollback |

---

## Mapeamento Regulatório

### PCI-DSS (Pagamentos com Cartão)

| Requisito PCI-DSS | Como BehaviorOS Cobre |
|-------------------|----------------------|
| **4.1** — Criptografar dados do titular em trânsito | Governance rule: `encryption-required` (action: block) |
| **6.6** — Revisão de segurança de código | Quality gate: `security-scan` (pass: true) |
| **8.3** — Autenticação multifator | Persona boundary: `mfa-required` (scope: global) |
| **10.2** — Logs de acesso a dados do titular | Audit Engine: toda transação auditada automaticamente |
| **10.5** — Proteção de logs contra alteração | Audit trail imutável via Learning Engine + MCP |
| **11.3** — Testes de penetração regulares | CI pipeline: `security` stage com dependency scan |

### SOX (Sarbanes-Oxley — Controles Financeiros)

| Requisito SOX | Como BehaviorOS Cobre |
|---------------|----------------------|
| **§302** — Certificação de relatórios financeiros | Mission lifecycle: `completed` exige audit pass |
| **§404** — Avaliação de controles internos | Governance rules com `action: block` em violações |
| **§409** — Divulgação em tempo real | Incident Response pattern com escalação imediata |
| **§802** — Retenção de registos | Learning Engine: `correction` events retidos permanentemente |

### BACEN (Banco Central — Brasil)

| Resolução | Como BehaviorOS Cobre |
|-----------|----------------------|
| **BCB 4.753** — Política de segurança cibernética | Security personas + governance rules para incidentes |
| **BCB 4.658** — Controles internos | Quality gates + audit trails obrigatórios |
| **BCB 4.557** — Prevenção à lavagem de dinheiro | Workflows com KYC verification obrigatório |

### LGPD / GDPR (Proteção de Dados)

| Requisito | Como BehaviorOS Cobre |
|-----------|----------------------|
| **Consentimento** — Coleta exige autorização | Mission type: `data-processing` requer aprovação |
| **Portabilidade** — Exportar dados do usuário | Pattern `data-portability` com workflow dedicado |
| **Eliminação** — Direito ao esquecimento | Quality gate: `data-retention` com threshold temporal |
| **DPO** — Encarregado de proteção de dados | Persona: `data-protection-officer` com boundaries de veto |

---

## Governança Financeira

### Regras de Governança para Fintechs

```yaml
# Regras mandatórias para qualquer projeto fintech
governance:
  - id: fin-pci-encryption
    name: Dados Sensíveis Criptografados
    description: >-
      Dados de pagamento, PII, e credenciais DEVEM estar criptografados
      em repouso e em trânsito.
    level: critical
    action: block
    conditions:
      - type:payment-data
      - type:pii
      - type:credentials

  - id: fin-dual-approval
    name: Aprovação Dupla Obrigatória
    description: >-
      Toda alteração em produção requer aprovação de 2 personas
      distintas (ex: engineer + qa, ou engineer + security).
    level: critical
    action: block
    conditions:
      - type:deploy
      - type:payment-flow
      - type:ledger

  - id: fin-audit-trail
    name: Audit Trail Obrigatório
    description: >-
      Toda operação financeira deve gerar registo de auditoria
      imutável com timestamp, agente, e decisão.
    level: high
    action: escalate
    conditions:
      - type:transaction
      - type:refund
      - type:chargeback
      - type:settlement

  - id: fin-change-freeze
    name: Janela de Change Freeze
    description: >-
      Bloqueia alterações em produção durante janelas críticas
      (ex: fechamento fiscal, Black Friday, promoções).
    level: critical
    action: block
    conditions:
      - type:change-freeze-period
      - type:prod-deploy

  - id: fin-segregation-duties
    name: Segregação de Funções
    description: >-
      Nenhuma persona pode executar, aprovar, e auditar a mesma
      alteração. Deve haver ao menos 3 pessoas distintas.
    level: critical
    action: block
    conditions:
      - type:code-change
      - type:deploy
      - type:config-change

  - id: fin-incident-sla
    name: SLA de Incidentes Financeiros
    description: >-
      Incidentes de segurança/pagamento devem ser escalados em
      ≤ 15 minutos e resolvidos em ≤ 4 horas.
    level: high
    action: escalate
    conditions:
      - type:security-incident
      - type:payment-failure
      - type:data-breach
```

### Personas Especializadas para Fintech

| Persona | Autoridade | Boundaries Chave | Skills |
|---------|-----------|------------------|--------|
| **Payment Engineer** | Senior | Max 5 arquivos/PR, requer revisão security | payment-gateway, pci-compliance, fraud-detection |
| **Financial QA** | Senior | Coverage ≥ 90%, testes de transação obrigatórios | transaction-testing, reconciliation, performance-benchmark |
| **Security Architect (Fintech)** | Architect | Veto em qualquer alteração de pagamento | threat-modeling, pci-dss, encryption, penetration-test |
| **Compliance Officer** | Architect | Aprova toda alteração regulatória | regulatory-compliance, audit-trail, kyc-aml |
| **DevOps (Prod Financeira)** | Senior | Sem acesso direto a prod, deploy só com change request | canary-deploy, rollback, disaster-recovery |
| **Data Protection Officer** | Architect | Veto em operações com dados pessoais | lgpd, gdpr, data-classification, consent-management |

---

## Quality Gates Financeiros

| Gate | Threshold | O que Bloqueia | Regulação |
|------|-----------|----------------|-----------|
| **Transaction Coverage** | 100% | Alterações em fluxo de pagamento sem testes | PCI-DSS 6.4 |
| **Reconciliation Accuracy** | 100% | Discrepâncias entre ledgers | SOX §404 |
| **Security Scan** | 0 critical | Qualquer vulnerabilidade crítica em libs de pagamento | PCI-DSS 6.6 |
| **Encryption Check** | Pass | Dados sensíveis sem criptografia | PCI-DSS 4.1 |
| **Lint** | 0 errors | Código fora do padrão | Boa prática |
| **Typecheck** | 0 errors | Erros de tipo em TypeScript | Boa prática |
| **Performance (P99)** | ≤ 500ms | Gateway de pagamento lento | SLA operacional |
| **Data Retention** | Conforme política | Dados armazenados além do prazo legal | LGPD art. 15 |
| **Audit Trail Completeness** | 100% | Transações sem registo de auditoria | SOX §802 |
| **Dependency Audit** | 0 critical | Libs com CVE conhecida | PCI-DSS 6.2 |

### Exemplo: Quality Gates em DNA

```yaml
quality:
  - id: qg-fin-transaction-coverage
    name: Transaction Coverage
    description: 100% de cobertura em fluxos de pagamento
    type: test_coverage
    threshold: 100
    scope: payment-flow
    action: block

  - id: qg-fin-reconciliation
    name: Reconciliation Accuracy
    description: Ledger deve reconciliar perfeitamente
    type: custom
    metric: reconciliation_accuracy
    threshold: 100
    operator: '=='
    action: block

  - id: qg-fin-audit-trail
    name: Audit Trail Completeness
    description: Toda transação deve ter audit trail completo
    type: custom
    metric: audit_trail_coverage
    threshold: 100
    operator: '>='
    action: block

  - id: qg-fin-encryption
    name: Encryption Verification
    description: Dados sensíveis devem estar criptografados
    type: security
    pass: true
    scope: payment-data
    action: block

  - id: qg-fin-p99-latency
    name: P99 Latency
    description: Latência do gateway de pagamento
    type: performance
    metric: p99_latency_ms
    threshold: 500
    operator: '<='
    action: warn
```

---

## Audit Trails para Compliance

### O que Toda Transação Financeira Deve Registar

```typescript
interface FintechAuditRecord {
  transactionId: string
  timestamp: string           // ISO 8601, relógio sincronizado NTP
  agentId: string             // Quem executou
  personaId: string           // Com qual persona
  action: string              // O que foi feito
  resource: string            // Em qual recurso
  before: unknown             // Estado anterior (opcional)
  after: unknown              // Estado posterior (opcional)
  decision: string            // approved | rejected | escalated
  governanceRules: string[]   // Quais regras foram avaliadas
  missionId: string           // Missão associada
  ipAddress?: string          // Origem da requisição
  correlationId?: string      // Rastreamento distribuído
  signature?: string          // Assinatura para integridade
}
```

### Implementação com BehaviorOS

Cada etapa do protocolo gera automaticamente registos de auditoria:

| Protocol Step | O que é Auditado | Onde Fica |
|---------------|-----------------|-----------|
| **Step 1** — DNA Select | Qual pattern foi escolhido e porquê | Mission metadata |
| **Step 3** — Truth Resolve | Quais libs/docs foram consultadas | Learning Engine |
| **Step 4** — Mission Create | Missão criada com tipo, prioridade, descrição | Mission Engine |
| **Step 5** — Delegate | O que foi delegado para quem | Mission + Task log |
| **Step 6** — Audit Run | Resultados de lint, typecheck, security, coverage | Audit Engine |
| **Step 7** — Learn Record | Insights e correções registadas | Learning Engine |

### Compliance Report Automático

```
┌────────────────────────────────────────────────────────────┐
│ 📋 COMPLIANCE REPORT — Gateway de Pagamentos              │
├────────────────────────────────────────────────────────────┤
│ Missão: a1b2c3d4 — Implementar 3DS Validation             │
│ Data: 2026-07-20T10:30:00Z                                │
│                                                            │
│ ✅ PCI-DSS 6.4 — Transaction coverage: 100%               │
│ ✅ PCI-DSS 6.6 — Security scan: 0 critical                │
│ ✅ PCI-DSS 4.1 — Encryption: passed                       │
│ ✅ SOX §404 — Dual approval: engineer + security           │
│ ✅ SOX §802 — Audit trail: 15/15 transações registadas     │
│ ✅ LGPD art. 15 — Data retention: conforme                 │
│ ✅ BACEN 4.753 — Security policy: enforced                 │
│                                                            │
│ 🔴 BACEN 4.557 — KYC verification: NOT COMPLIANT          │
│   → Ação: Adicionar KYC step no workflow onboarding       │
│                                                            │
│ Overall: 7/8 gates passed ⚠️ 1 non-compliance detected    │
└────────────────────────────────────────────────────────────┘
```

---

## DNA Patterns para Fintech

### Pattern: Payment Processing

```yaml
- id: pat-payment-processing
  name: Payment Processing
  type: collaboration
  description: >-
    Fluxo seguro de processamento de pagamentos com validação
    dupla, criptografia, e audit trail obrigatório.
  triggers:
    - agent:payment-engineer
    - agent:security-architect
  actions:
    - validate-payload
    - encrypt-sensitive-data
    - process-payment
    - record-audit-trail
    - reconcile-ledger
    - notify-stakeholders
  conditions:
    - type:payment
    - type:transaction
    - type:checkout
  quality_gates:
    - qg-fin-transaction-coverage
    - qg-fin-audit-trail
    - qg-fin-encryption
```

### Pattern: Fraud Detection Response

```yaml
- id: pat-fraud-response
  name: Fraud Detection & Response
  type: escalation
  description: >-
    Resposta automática a deteção de fraude com contenção
    imediata, notificação regulatória, e análise forense.
  triggers:
    - agent:security-architect
    - agent:compliance-officer
  actions:
    - detect-fraud
    - block-transaction
    - notify-fraud-team
    - freeze-account-if-needed
    - initiate-forensic-analysis
    - notify-regulator-if-required
    - record-incident
  conditions:
    - type:fraud
    - type:suspicious-transaction
    - type:account-takeover
  escalation:
    sla_minutes: 15
    notify: compliance-officer
```

### Pattern: Regulatory Reporting

```yaml
- id: pat-regulatory-reporting
  name: Regulatory Reporting
  type: compliance
  description: >-
    Geração e submissão automática de relatórios regulatórios
    (BACEN, CVM, Receita Federal) com validação de integridade.
  triggers:
    - agent:compliance-officer
    - agent:financial-qa
  actions:
    - collect-data
    - validate-integrity
    - generate-report
    - review-by-compliance
    - sign-digitally
    - submit-to-regulator
    - archive-proof
  conditions:
    - type:regulatory-report
    - type:compliance-filing
  quality_gates:
    - qg-fin-reconciliation
    - qg-fin-audit-trail
```

### Pattern: Disaster Recovery (Financial)

```yaml
- id: pat-disaster-recovery-fin
  name: Disaster Recovery — Financial Systems
  type: recovery
  description: >-
    Recuperação de desastres para sistemas financeiros com
    RPO ≤ 1 minuto e RTO ≤ 15 minutos.
  triggers:
    - agent:devops-finance
    - agent:security-architect
  actions:
    - declare-disaster
    - activate-dr-plan
    - failover-to-secondary
    - verify-data-integrity
    - reconcile-transactions
    - notify-stakeholders
    - document-incident
  conditions:
    - type:disaster
    - type:outage
    - type:data-loss
  sla:
    rpo_minutes: 1
    rto_minutes: 15
```

---

## Enforcement Levels em Produção

| Nível | Onde Usar | Bloqueia | Permite | Risco |
|-------|-----------|----------|---------|-------|
| **`audit`** | Dev / Sandbox | Nada (só loga) | Tudo | ✅ Baixo |
| **`standard`** | Staging / Homolog | Violações critical | Alerta em high | ⚠️ Médio |
| **`strict`** | Produção | critical + high | Só com aprovação dupla | 🔴 Crítico |

### Configuração por Ambiente

```json
// opencode.json — produção
{
  "mcp": {
    "behavioros": {
      "environment": {
        "BEHAVIOROS_ENFORCEMENT_LEVEL": "strict",
        "BEHAVIOROS_DNA_PATH": "./dnas/enterprise-governance.yaml",
        "BEHAVIOROS_PRODUCTION": "true",
        "BEHAVIOROS_AUDIT_RETENTION_DAYS": "2555"  // 7 anos (SOX)
      }
    }
  }
}
```

### O que o modo `strict` Bloqueia em Produção

- ❌ Deploy direto sem passar pelo pipeline de audit
- ❌ Alteração em fluxo de pagamento sem aprovação security
- ❌ Commit sem audit trail completo
- ❌ Acesso direto a produção por non-devops
- ❌ Dependency com CVE crítica
- ❌ Transação sem reconciliação
- ✅ Hotfix só com bypass explícito + post-mortem obrigatório

---

## CI/CD Compliance PCI/SOX

### Pipeline de Deploy para Fintechs

```
Commit → Lint → Typecheck → Test (coverage 100% em payment)
  → Security Scan → Dependency Audit → Build
  → Deploy Staging → Integration Tests → Reconciliation Test
  → Dual Approval (engineer + compliance)
  → Canary 10% → Monitor 15min → Auto-rollback se p99 > 500ms
  → Full Rollout → Audit Trail Complete → Record Learning
```

### GitHub Action: Fintech Compliance Pipeline

```yaml
name: Fintech Compliance Pipeline
on:
  pull_request:
    branches: [main, release/*]
  push:
    branches: [main]

jobs:
  compliance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup
        run: pnpm install

      - name: Lint + Typecheck
        run: |
          pnpm lint
          pnpm typecheck

      - name: Test with Coverage
        run: pnpm test -- --coverage
        env:
          MIN_COVERAGE: 100
          COVERAGE_SCOPE: payment-flow

      - name: Security Scan
        run: |
          pnpm audit --audit-level=critical
          npx snyk test --severity=critical

      - name: BehaviorOS Audit
        run: npx @behavioros/cli enforce check

      - name: Compliance Report
        run: npx @behavioros/cli validate --pci-dss --sox --bacen

      - name: Block if Non-Compliant
        if: failure()
        run: |
          echo "❌ Compliance check failed — PR blocked"
          exit 1
```

---

## Exemplo Prático: Gateway de Pagamentos

### Cenário

Implementar suporte a **PIX** em um gateway de pagamentos brasileiro.

### Fluxo com BehaviorOS

```
User Request: "Adicionar PIX como método de pagamento"

    ↓

Step 1: bos_select_dna({
  taskType: "feature",
  domain: "payments",
  riskLevel: "critical",
  complexity: "complex"
})
→ Pattern: "surgical-team" (blend com enterprise-governance)
→ Confidence: 92%
→ Principles: zero-defect, sterile-field, timeout-verification

    ↓

Step 2: Mostrar DNA Block ao humano

    ↓

Step 3: bos_resolve_truth({
  taskType: "feature",
  domain: "payments",
  agentId: "payment-engineer",
  libraries: ["pix-brasil/api-pix", "prisma/prisma"]
})
→ Docs: API PIX BACEN + Prisma migrations

    ↓

Step 4: create-mission({
  title: "Adicionar PIX como método de pagamento",
  type: "feature",
  priority: "critical",
  description: "Integrar PIX no gateway com validação BACEN"
})
→ Mission: a1b2c3d4

    ↓

Step 5: Delegar para payment-engineer
  - Injetar DNA: surgical-team + enterprise-governance
  - Injetar docs: API PIX, Prisma
  - Quality gates obrigatórios:
    * Transaction coverage: 100%
    * Reconciliation: 100%
    * Security scan: 0 critical

    ↓

Step 6: bos_run_audit({
  trigger: "pr",
  context: { branch: "feature/pix", files: 8, author: "payment-engineer" }
})
→ Lint: PASS (0 errors)
→ Typecheck: PASS (0 errors)
→ Security: PASS (0 critical)
→ Coverage: PASS (100%)
→ Performance: PASS (p99 230ms)

    ↓

Step 7: record-learning({
  type: "insight",
  source: "payment-engineer",
  data: {
    content: "PIX requer validação de chave dinâmica antes do pagamento",
    impact: "high",
    relatedPattern: "payment-processing"
  }
})

    ↓

update-progress({ missionId: "a1b2c3d4", status: "completed" })
```

### Quality Gates que o PIX Deve Passar

| Gate | Threshold | Porquê |
|------|-----------|--------|
| Cobertura de transação PIX | 100% | Cada operação PIX é um evento financeiro |
| Reconciliação BACEN | 100% | Ledger deve bater com extrato BACEN |
| Criptografia de chave PIX | Pass | Chave PIX é dado sensível |
| Latência (p99) | ≤ 300ms | PIX é instantâneo por lei |
| Audit trail | 100% | BACEN exige rastreabilidade |
| Validação de payload | Pass | Formato de chave PIX validado contra schema BACEN |

---

## Checklist de Conformidade

### Antes de Ir para Produção

- [ ] **DNA de governança enterprise carregado** (`enterprise-governance.yaml` ou custom fintech)
- [ ] **Personas financeiras definidas**: payment-engineer, financial-qa, compliance-officer
- [ ] **Governance rules ativas**: dual-approval, segregation-duties, audit-trail
- [ ] **Quality gates configurados**: coverage 100% em payment flow, security scan, encryption
- [ ] **Enforcement level**: `strict` em produção
- [ ] **CI/CD pipeline**: compliance stage com PCI-DSS + SOX checks
- [ ] **Pre-commit hook**: `npx @behavioros/cli enforce check`
- [ ] **Audit trail**: Learning Engine configurado com retenção ≥ 5 anos
- [ ] **Disaster recovery**: DR pattern configurado com RPO ≤ 1min
- [ ] **Incident response**: SLA de 15 minutos configurado
- [ ] **Logs imutáveis**: Audit records não podem ser alterados retroativamente
- [ ] **Revisão de dependências**: Todas as libs auditadas contra CVE
- [ ] **Testes de transação**: 100% de cobertura em fluxos críticos
- [ ] **Documentação regulatória**: Compliance report gerado e arquivado

### Checklist de Incidente

```
□ 1. Detetar incidente (automático ou reportado)
□ 2. Executar pat-fraud-response ou pat-incident-response
□ 3. Notificar compliance-officer (SLA: 15 min)
□ 4. Bloquear transação/seguir se for o caso
□ 5. Iniciar análise forense
□ 6. Avaliar notificação regulatória obrigatória
   □ BACEN: 24h para incidentes críticos
   □ LGPD: 72h para vazamento de dados
   □ PCI-DSS: notificar acquiring bank
□ 7. Documentar tudo no Learning Engine
□ 8. Conduzir post-mortem em ≤ 5 dias úteis
□ 9. Aplicar correções preventivas
□ 10. Atualizar DNA com novo pattern se aplicável
```

---

## DNA Fintech Personalizado (Template)

Use este template como ponto de partida para criar o DNA da sua fintech:

```yaml
id: fintech-governance-{{NOME_DA_FINTECH}}
name: '{{NOME_DA_FINTECH}} — Governance DNA'
version: '1.0.0'
description: >
  DNA de governança personalizado para {{NOME_DA_FINTECH}}.
  Cobre: pagamentos, compliance, prevenção à fraude.
author: BehaviorOS Team
license: MIT
tags:
  - fintech
  - payments
  - compliance
  - {{NOME_DA_FINTECH}}

personas:
  - role: engineer
    authority: senior
    name: Payment Engineer
    boundaries:
      - id: pci-scope
        name: PCI-DSS Scope
        type: forbidden
        value: true
        scope: global
    # ... mais personas

governance:
  - id: dual-approval
    # ... regras

quality:
  - id: transaction-coverage
    threshold: 100
    # ... gates
```

---

## Referências

| Documento | Link |
|-----------|------|
| BehaviorOS Protocol | `docs/PROTOCOL.md` |
| DNA Catalog | `docs/DNAs.md` |
| Manual de Integração | `docs/MANUAL-INTEGRACAO.md` |
| Guia de Uso Diário | `docs/DAILY-WORKFLOW.md` |
| CLI Reference | `docs/CLI.md` |
| SDK Reference | `docs/SDK.md` |
| Architecture | `docs/ARCHITECTURE.md` |

---

*BehaviorOS v0.1.0 — Julho 2026*
*Guia Fintech v1.0.0*
