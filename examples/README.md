# BehaviorOS — Simulações e Exemplos

Este diretório contém simulações que demonstram **todas as capacidades** do BehaviorOS.

## Pré-requisitos

```bash
pnpm build                          # Compilar todos os pacotes
```

## Como Rodar

```bash
# Showcase completo (12 cenários) — demonstra TUDO
node examples/full-showcase.mjs

# DNA customizado para Fintech Payments
node examples/custom-dna.mjs
```

## Showcase Completo (`full-showcase.mjs`)

12 cenários que demonstram o sistema completo:

| # | Cenário | Capacidade |
|---|---------|------------|
| 1 | Catálogo de 6 DNAs | DNA loading, validação, personas |
| 2 | Orquestração Autônoma | Engineer → QA → Security → DevOps |
| 3 | Deploy BLOQUEADO | Governance bloqueia sem review |
| 4 | Infraestrutura ESCALADA | Escalation para humano |
| 5 | Quality Gates — 3 falhas | Coverage 35%, lint fail |
| 6 | Quality Gates — Tudo OK | Coverage 95%, todos passam |
| 7 | Surgical Team | Timeout, sterile field, SBAR handoff |
| 8 | Lean Factory | Kaizen, 5-Why, standard work |
| 9 | Military Operations | Chain of command, AAR |
| 10 | EAARG Pipeline | 3/18 layers de arquitetura |
| 11 | Learning Engine | 5 eventos, padrões, insights |
| 12 | Dashboard Final | Stats, audit trail, learning report |

## DNA Customizado (`custom-dna.mjs`)

Cria e testa um DNA **Fintech Payments** com:

- **Personas**: Payment Engineer, Fraud Analyst, Compliance Officer
- **Regras**: 3DS obrigatório, PCI-DSS compliance, limite de fraude, limite de valor
- **Quality Gates**: Fraud rate < 0.1%, Success rate > 99.9%, Latency < 200ms
- **6 Cenários**: Transação normal, sem 3DS (bloqueada), alto valor (escalada), PCI-DSS (bloqueada), quality gates

## O Que Foi Demonstrado

| Capacidade | Onde |
|------------|------|
| 6 DNA patterns de domínios diferentes | C1 |
| Loading e validação de DNA YAML | C1 |
| Criação de engine com governance + quality + learning + audit | C2 |
| Criação/início/conclusão de missões | C2 |
| Avaliação de governança (approve/block/escalate) | C3, C4 |
| Quality gates com thresholds customizados | C5, C6 |
| Handoff SBAR entre agentes | C7 |
| Zero-defect protocol (timeout, sterile field) | C7 |
| Kaizen event com root cause analysis | C8 |
| Chain of command + After-Action Review | C9 |
| EAARG pipeline layers | C10 |
| Learning events (pattern, correction, insight, feedback) | C11 |
| Audit trail completo | C12 |
| DNA customizado do zero | custom-dna |

## Como Criar Seu Próprio DNA

```yaml
id: meu-dna
name: Meu DNA Customizado
version: '1.0.0'

personas:
  - role: engineer
    authority: senior
    name: Meu Agente
    skills: [minha-skill]
    boundaries:
      - id: minha-regra
        name: Minha Regra
        type: forbidden
        value: true
        scope: global

governance:
  - id: gov-minha-regra
    name: Minha Governance Rule
    level: high
    action: block
    conditions:
      - type:meu-tipo

quality:
  - id: qg-minha-metrica
    name: Minha Métrica
    type: test_coverage
    threshold: 80
```

Depois carregue com:

```javascript
import { DNALoader } from '@behavioros/core';
const loader = new DNALoader({ validate: true });
const dna = loader.loadFromString(yamlString);
```
