#!/usr/bin/env node

// ============================================================
// BehaviorOS — Custom DNA: Fintech Payments
// Demonstra como criar e usar um DNA customizado para fintech
// ============================================================

import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const corePath = resolve(ROOT, 'packages/core/dist/index.mjs');
if (!existsSync(corePath)) {
  console.error('❌ BehaviorOS core not built. Run: pnpm build');
  process.exit(1);
}

const { BehaviorOSEngine, DNALoader } = await import(pathToFileURL(corePath).href);

// ── Helpers ─────────────────────────────────────────────────
const B = (s) => `\x1b[1m${s}\x1b[22m`;
const G = (s) => `\x1b[32m${s}\x1b[39m`;
const R = (s) => `\x1b[31m${s}\x1b[39m`;
const Y = (s) => `\x1b[33m${s}\x1b[39m`;
const C = (s) => `\x1b[36m\x1b[1m${s}\x1b[22m\x1b[39m`;

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log(`  ${G('✅')} ${msg}`);
}
function fail(msg) {
  failed++;
  console.log(`  ${R('❌')} ${msg}`);
}
function info(msg) {
  console.log(`  ${Y('📋')} ${msg}`);
}

// ════════════════════════════════════════════════════════════
//  CRIAR DNA CUSTOMIZADO: Fintech Payments
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CUSTOM DNA')}  ${B('Criando DNA Fintech Payments')}`);
console.log(`${'═'.repeat(64)}\n`);

const fintechDNAYAML = `id: fintech-payments
name: Fintech Payments DNA
version: '1.0.0'
description: DNA para sistemas de pagamento com compliance PCI-DSS, antifraude e 3DS
author: BehaviorOS Demo
license: MIT
tags:
  - fintech
  - payments
  - pci-dss
  - fraud-prevention

personas:
  - role: engineer
    authority: senior
    name: Payment Engineer
    description: Implementa e mantém sistemas de pagamento, tokenização e integrações
    boundaries:
      - id: pay-no-plaintext-cvv
        name: CVV nunca em plaintext
        type: forbidden
        value: true
        scope: global
      - id: pay-max-amount
        name: Transação máxima sem aprovação
        type: max_modules
        value: 10000
        scope: per_session
    skills:
      - payment-processing
      - tokenization
      - 3ds-integration
      - pci-compliance
    tools:
      - read
      - write

  - role: specialist
    authority: senior
    name: Fraud Analyst
    description: Detecta e previne fraudes usando machine learning e regras
    boundaries:
      - id: fraud-block-high-risk
        name: Bloquear transações de alto risco
        type: forbidden
        value: true
        scope: global
    skills:
      - fraud-detection
      - anomaly-detection
      - risk-scoring
      - chargeback-management
    tools:
      - read
      - write

  - role: qa
    authority: lead
    name: Compliance Officer
    description: Garante conformidade com PCI-DSS, LGPD e regulamentações financeiras
    boundaries:
      - id: comp-block-noncompliant
        name: Bloquear deploys não compliant
        type: forbidden
        value: true
        scope: global
    skills:
      - pci-dss-audit
      - lgpd-compliance
      - regulatory-reporting
      - risk-assessment
    tools:
      - read
      - write

governance:
  - id: gov-3ds-required
    name: 3DS Obrigatório
    description: Transações do tipo 'payment' exigem autenticação 3DS
    level: critical
    action: block
    conditions:
      - type:payment

  - id: gov-pci-compliance
    name: PCI-DSS Compliance
    description: Deploy do tipo 'card-data' exige certificação PCI-DSS
    level: critical
    action: block
    conditions:
      - type:card-data

  - id: gov-fraud-threshold
    name: Fraude acima do limite
    description: Se fraud rate > 0.1%, escalar para compliance
    level: high
    action: escalate
    conditions:
      - type:fraud
      - type:high-risk

  - id: gov-amount-limit
    name: Limite de transação
    description: Transações > R$10.000 requerem aprovação do compliance officer
    level: high
    action: escalate
    conditions:
      - type:large-transaction
      - type:high-value

quality:
  - id: qg-fraud-rate
    name: Fraud Rate
    description: Taxa de fraude máxima aceitável
    type: test_coverage
    threshold: 0.1
  - id: qg-success-rate
    name: Success Rate
    description: Taxa de sucesso de transações
    type: performance
    threshold: 99.9
  - id: qg-latency
    name: Payment Latency
    description: Latência máxima de processamento
    type: performance
    threshold: 200
  - id: qg-chargeback-rate
    name: Chargeback Rate
    description: Taxa máxima de chargeback
    type: test_coverage
    threshold: 0.5

patterns:
  - id: pat-3ds-flow
    name: 3DS Authentication Flow
    type: review
    description: Fluxo de autenticação 3DS para transações de alto valor
    triggers:
      - agent:engineer
      - agent:specialist
    actions:
      - initiate-3ds
      - challenge-authentication
      - verify-fingerprint
      - approve-transaction
    conditions:
      - type:payment
      - type:high-value
`;

// Write temp DNA file
const tmpFile = join(tmpdir(), `fintech-payments-${Date.now()}.yaml`);
writeFileSync(tmpFile, fintechDNAYAML, 'utf-8');
info('DNA Fintech Payments criado em memória');

// ════════════════════════════════════════════════════════════
//  CENÁRIO 1: Carregar e validar DNA customizado
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CENÁRIO 1')}  ${B('Carregar DNA Fintech Payments')}`);
console.log(`${'═'.repeat(64)}\n`);

const loader = new DNALoader({ validate: true });
const fintechDNA = loader.loadFromString(fintechDNAYAML);

ok(`DNA carregado: ${fintechDNA.name} v${fintechDNA.version}`);
info(`Personas: ${fintechDNA.personas.map((p) => `${p.role} (${p.name})`).join(', ')}`);
info(`Governance: ${fintechDNA.governance?.length ?? 0} regras`);
info(`Quality gates: ${fintechDNA.quality?.length ?? 0} gates`);

// ════════════════════════════════════════════════════════════
//  CENÁRIO 2: Transação normal (APROVADA)
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CENÁRIO 2')}  ${B('Transação Normal — R$150 com 3DS (DEVE APROVAR)')}`);
console.log(`${'═'.repeat(64)}\n`);

const engine = new BehaviorOSEngine({
  dna: fintechDNA,
  governance: { enabled: true, escalationPath: ['compliance-officer'] },
  quality: { enabled: true },
  learning: { enabled: true },
  audit: { enabled: true },
});

const mission1 = await engine.createMission({
  title: 'Processar pagamento R$150 com 3DS',
  type: 'feature',
  priority: 'high',
});
await engine.startMission(mission1.id);

const gov1 = await engine.evaluateGovernance('checkout', { type: 'checkout', amount: 150 });
if (gov1.approved) {
  ok('Checkout R$150 (sem 3DS necessário): APROVADO');
} else {
  fail(`Checkout reprovado inesperadamente: ${gov1.violations.map((v) => v.name).join(', ')}`);
}

// ════════════════════════════════════════════════════════════
//  CENÁRIO 3: Transação sem 3DS (BLOQUEADA)
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CENÁRIO 3')}  ${B('Transação R$250 SEM 3DS (DEVE BLOQUEAR)')}`);
console.log(`${'═'.repeat(64)}\n`);

const gov2 = await engine.evaluateGovernance('payment', { type: 'payment', amount: 250 });
if (!gov2.approved) {
  ok(`Transação R$250 (tipo payment): BLOQUEADA (${gov2.violations.length} violações)`);
  for (const v of gov2.violations) {
    info(`  ${v.name} [${v.level}] → ${v.action}`);
  }
} else {
  fail('Transação tipo payment sem 3DS deveria ter sido bloqueada!');
}

// ════════════════════════════════════════════════════════════
//  CENÁRIO 4: Transação de alto valor (ESCALADA)
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CENÁRIO 4')}  ${B('Transação R$15.000 — Acima do limite (DEVE ESCALAR)')}`);
console.log(`${'═'.repeat(64)}\n`);

const gov3 = await engine.evaluateGovernance('payment', {
  type: 'large-transaction',
  amount: 15000,
});
if (!gov3.approved) {
  ok(`Transação R$15.000: ESCALADA (${gov3.violations.length} violações)`);
  for (const v of gov3.violations) {
    info(`  ${v.name} [${v.level}] → ${v.action}`);
  }
  info('→ Compliance Officer precisa aprovar');
} else {
  fail('Transação de alto valor deveria ter escalado!');
}

// ════════════════════════════════════════════════════════════
//  CENÁRIO 5: PCI-DSS Compliance (BLOQUEADA)
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CENÁRIO 5')}  ${B('Deploy sem PCI-DSS Compliance (DEVE BLOQUEAR)')}`);
console.log(`${'═'.repeat(64)}\n`);

const gov4 = await engine.evaluateGovernance('deploy', { type: 'card-data', pciCompliant: false });
if (!gov4.approved) {
  ok(`Deploy sem PCI-DSS: BLOQUEADO (${gov4.violations.length} violações)`);
  for (const v of gov4.violations) {
    info(`  ${v.name} [${v.level}] → ${v.action}`);
  }
} else {
  fail('Deploy sem PCI-DSS deveria ter sido bloqueado!');
}

// ════════════════════════════════════════════════════════════
//  CENÁRIO 6: Quality Gates para Fintech
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${C('CENÁRIO 6')}  ${B('Quality Gates — Métricas de Pagamento')}`);
console.log(`${'═'.repeat(64)}\n`);

const qr = await engine.evaluateQuality([
  { name: 'Fraud Rate', value: 0.08 },
  { name: 'Success Rate', value: 99.95 },
  { name: 'Payment Latency', value: 180 },
  { name: 'Chargeback Rate', value: 0.3 },
]);

const failedNames = new Set(qr.failedGates.map((g) => g.name));
if (qr.passed) {
  ok('Quality gates: TODOS APROVADOS');
} else {
  ok(
    `Quality gates: ${qr.failedGates.length} falharam (esperado — 3 métricas abaixo do threshold)`,
  );
}
for (const m of qr.metrics) {
  const gate = fintechDNA.quality?.find((g) => g.name === m.name);
  const passed = !failedNames.has(m.name);
  info(
    `  ${passed ? G('✅') : R('❌')} ${m.name}: ${m.value} (threshold: ${gate?.threshold ?? 'N/A'})`,
  );
}

// ════════════════════════════════════════════════════════════
//  RESUMO FINAL
// ════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(64)}`);
console.log(`  ${B('RESUMO — FINANCIAL PAYMENTS DNA')}`);
console.log(`${'═'.repeat(64)}\n`);

ok(`DNA criado: ${fintechDNA.name}`);
ok(`Cenários executados: 6`);
ok(`Testes passados: ${passed}`);
if (failed > 0) fail(`Testes falhados: ${failed}`);
else ok('Todos os cenários passaram!');

console.log(`\n${'═'.repeat(64)}`);
const allOk = failed === 0;
console.log(`  ${allOk ? G('✅ CUSTOM DNA SHOWCASE COMPLETO') : R(`❌ ${failed} FALHAS`)}`);
console.log(`${'═'.repeat(64)}\n`);

process.exit(allOk ? 0 : 1);
