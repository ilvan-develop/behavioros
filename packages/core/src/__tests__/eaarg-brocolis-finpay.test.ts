import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { PipelineEngine } from '../engines/pipeline/pipeline-engine';

// ============================================================
// EAARG Brocolis + FinPay Integration Tests
// Simulates validation of a real integration between
// Brocolis (NestJS + Next.js + Expo) and FinPay SDK
// ============================================================

const DNA_PATH = resolve(process.cwd(), '../../dnas/enterprise-agent-review.yaml');

function loadDNA(): DNAPackage {
  const raw = readFileSync(DNA_PATH, 'utf-8');
  return parseYaml(raw) as DNAPackage;
}

// Realistic evidence for Brocolis + FinPay integration per layer
const BROCOLIS_FINPAY_EVIDENCE: Record<number, string[]> = {
  // Layer 1: Business — Why integrate Brocolis with FinPay?
  1: ['q1-1', 'q1-2', 'q1-3', 'q1-4', 'ev-1-1', 'ev-1-2'],
  // Layer 2: Product — Product scope and personas
  2: ['q2-1', 'q2-2', 'q2-3', 'ev-2-1', 'ev-2-2'],
  // Layer 3: Requirements — Functional and non-functional
  3: ['q3-1', 'q3-2', 'q3-3', 'ev-3-1', 'ev-3-2'],
  // Layer 4: Architecture — NestJS API + Next.js SSR + Expo mobile + FinPay SDK
  4: ['q4-1', 'q4-2', 'q4-3', 'q4-4', 'ev-4-1', 'ev-4-2', 'ev-4-3'],
  // Layer 5: Frontend — Next.js dashboard + Expo mobile app
  5: ['q5-1', 'q5-2', 'q5-3', 'q5-4', 'ev-5-1', 'ev-5-2', 'ev-5-3'],
  // Layer 6: Backend — NestJS API with FinPay SDK integration
  6: ['q6-1', 'q6-2', 'q6-3', 'q6-4', 'ev-6-1', 'ev-6-2', 'ev-6-3'],
  // Layer 7: APIs — REST contracts, FinPay webhook endpoints
  7: ['q7-1', 'q7-2', 'q7-3', 'q7-4', 'ev-7-1', 'ev-7-2', 'ev-7-3'],
  // Layer 8: Data — PostgreSQL schema, Redis cache, migrations
  8: ['q8-1', 'q8-2', 'q8-3', 'q8-4', 'ev-8-1', 'ev-8-2', 'ev-8-3'],
  // Layer 9: Security — OWASP, FinPay PCI-DSS, secrets management
  9: ['q9-1', 'q9-2', 'q9-3', 'q9-4', 'ev-9-1', 'ev-9-2', 'ev-9-3'],
  // Layer 10: Infrastructure — Docker, Kubernetes, Terraform
  10: ['q10-1', 'q10-2', 'q10-3', 'ev-10-1', 'ev-10-2', 'ev-10-3'],
  // Layer 11: DevOps — CI/CD, automated deploy, rollback
  11: ['q11-1', 'q11-2', 'q11-3', 'ev-11-1', 'ev-11-2', 'ev-11-3'],
  // Layer 12: QA — E2E tests, coverage, regression
  12: ['q12-1', 'q12-2', 'q12-3', 'ev-12-1', 'ev-12-2', 'ev-12-3'],
  // Layer 13: Performance — Load tests, Core Web Vitals
  13: ['q13-1', 'q13-2', 'q13-3', 'ev-13-1', 'ev-13-2', 'ev-13-3'],
  // Layer 14: Observability — Prometheus, Grafana, structured logging
  14: ['q14-1', 'q14-2', 'q14-3', 'ev-14-1', 'ev-14-2', 'ev-14-3'],
  // Layer 15: Documentation — API docs, user guides, changelogs
  15: ['q15-1', 'q15-2', 'q15-3', 'ev-15-1', 'ev-15-2', 'ev-15-3'],
  // Layer 16: AI Governance — AI policy, bias analysis, explainability
  16: ['q16-1', 'q16-2', 'q16-3', 'ev-16-1', 'ev-16-2', 'ev-16-3'],
  // Layer 17: Enterprise Readiness — Compliance, processes, maturity
  17: ['q17-1', 'q17-2', 'q17-3', 'ev-17-1', 'ev-17-2', 'ev-17-3'],
  // Layer 18: Production Readiness — Deploy checklist, approvals
  18: ['q18-1', 'q18-2', 'q18-3', 'ev-18-1', 'ev-18-2', 'ev-18-3'],
};

const LAYER_NAMES = [
  'Business',
  'Product',
  'Requirements',
  'Architecture',
  'Frontend',
  'Backend',
  'APIs',
  'Data',
  'Security',
  'Infrastructure',
  'DevOps',
  'QA',
  'Performance',
  'Observability',
  'Documentation',
  'AI Governance',
  'Enterprise Readiness',
  'Production Readiness',
];

describe('EAARG Brocolis + FinPay Integration', () => {
  let dna: DNAPackage;
  let engine: PipelineEngine;

  beforeEach(() => {
    dna = loadDNA();
    engine = new PipelineEngine(dna);
  });

  // ==========================================================
  // Layer 1-3: Business / Product / Requirements Validation
  // ==========================================================
  describe('Layers 1-3: Business, Product, Requirements', () => {
    it('layer 1 Business — validates Brocolis+FinPay integration business case', async () => {
      await engine.start();
      const result = await engine.validateLayer(1, BROCOLIS_FINPAY_EVIDENCE[1]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Business');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(4);
      expect(result.questionsTotal).toBe(4);
      expect(result.criteriaMet).toBe(3);
      expect(result.criteriaTotal).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Business');
      expect(protocol.status).toBe('complete');
      expect(protocol.completedItems).toHaveLength(4);
      expect(protocol.pendingItems).toHaveLength(0);
      expect(protocol.recommendation).toBe('proceed');
      expect(protocol.evidence).toContain('ev-1-1');
      expect(protocol.evidence).toContain('ev-1-2');
    });

    it('layer 2 Product — validates product scope and personas', async () => {
      await engine.start();
      const result = await engine.validateLayer(2, BROCOLIS_FINPAY_EVIDENCE[2]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Product');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(3);
      expect(result.questionsTotal).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Product');
      expect(protocol.status).toBe('complete');
      expect(protocol.acceptanceCriteria).toHaveLength(3);
    });

    it('layer 3 Requirements — validates functional and non-functional requirements', async () => {
      await engine.start();
      const result = await engine.validateLayer(3, BROCOLIS_FINPAY_EVIDENCE[3]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Requirements');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(3);
      expect(result.criteriaMet).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Requirements');
      expect(protocol.status).toBe('complete');
      expect(protocol.recommendation).toBe('proceed');
    });

    it('should pass all three layers sequentially', async () => {
      await engine.start();

      const r1 = await engine.validateLayer(1, BROCOLIS_FINPAY_EVIDENCE[1]);
      expect(r1.status).toBe('pass');

      const r2 = await engine.validateLayer(2, BROCOLIS_FINPAY_EVIDENCE[2]);
      expect(r2.status).toBe('pass');

      const r3 = await engine.validateLayer(3, BROCOLIS_FINPAY_EVIDENCE[3]);
      expect(r3.status).toBe('pass');

      const state = engine.getState();
      expect(state.layers).toHaveLength(3);
      expect(state.currentLayer).toBe(4);
    });
  });

  // ==========================================================
  // Layer 4: Architecture Validation
  // ==========================================================
  describe('Layer 4: Architecture — NestJS + Next.js + Expo + FinPay SDK', () => {
    it('should validate the full architecture stack', async () => {
      await engine.start();
      const result = await engine.validateLayer(4, BROCOLIS_FINPAY_EVIDENCE[4]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Architecture');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(4);
      expect(result.questionsTotal).toBe(4);
      expect(result.criteriaMet).toBe(3);
      expect(result.criteriaTotal).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Architecture');
      expect(protocol.status).toBe('complete');
      expect(protocol.evidence).toContain('ev-4-1');
      expect(protocol.evidence).toContain('ev-4-2');
      expect(protocol.evidence).toContain('ev-4-3');
      expect(protocol.acceptanceCriteria).toHaveLength(3);
    });

    it('should have enterprise-architecture skill loaded', async () => {
      await engine.start();
      const result = await engine.validateLayer(4, BROCOLIS_FINPAY_EVIDENCE[4]);

      expect(result.skillsUsed).toContain('enterprise-architecture');
      expect(result.skillsScore).toBeDefined();
      expect(result.skillsScore).toBeGreaterThan(0);
    });

    it('should pass gate check for architecture layer', async () => {
      await engine.start();
      await engine.validateLayer(4, BROCOLIS_FINPAY_EVIDENCE[4]);

      const gate = engine.checkGatesForLayer(4);
      expect(gate.passed).toBe(true);
      expect(gate.failedGates).toHaveLength(0);
    });
  });

  // ==========================================================
  // Layers 5-8: Frontend / Backend / APIs / Data
  // ==========================================================
  describe('Layers 5-8: Frontend, Backend, APIs, Data', () => {
    it('layer 5 Frontend — validates Next.js dashboard + Expo mobile', async () => {
      await engine.start();
      const result = await engine.validateLayer(5, BROCOLIS_FINPAY_EVIDENCE[5]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Frontend');
      expect(result.questionsAnswered).toBe(4);
      expect(result.evidenceCollected).toContain('ev-5-1');
      expect(result.evidenceCollected).toContain('ev-5-2');
      expect(result.evidenceCollected).toContain('ev-5-3');

      const protocol = result.protocol;
      expect(protocol.status).toBe('complete');
      expect(protocol.completionPercent).toBe(100);
    });

    it('layer 6 Backend — validates NestJS API with FinPay SDK', async () => {
      await engine.start();
      const result = await engine.validateLayer(6, BROCOLIS_FINPAY_EVIDENCE[6]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Backend');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(4);
      expect(result.criteriaMet).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Backend');
      expect(protocol.recommendation).toBe('proceed');
    });

    it('layer 7 APIs — validates REST contracts and FinPay webhooks', async () => {
      await engine.start();
      const result = await engine.validateLayer(7, BROCOLIS_FINPAY_EVIDENCE[7]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('APIs');
      expect(result.questionsAnswered).toBe(4);
      expect(result.evidenceCollected).toContain('ev-7-1');
      expect(result.evidenceCollected).toContain('ev-7-2');
      expect(result.evidenceCollected).toContain('ev-7-3');

      const protocol = result.protocol;
      expect(protocol.status).toBe('complete');
      expect(protocol.pendingItems).toHaveLength(0);
    });

    it('layer 8 Data — validates PostgreSQL schema and migrations', async () => {
      await engine.start();
      const result = await engine.validateLayer(8, BROCOLIS_FINPAY_EVIDENCE[8]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Data');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(4);
      expect(result.criteriaMet).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Data');
      expect(protocol.acceptanceCriteria).toHaveLength(3);
    });

    it('should pass layers 5-8 sequentially', async () => {
      await engine.start();

      for (let layer = 5; layer <= 8; layer++) {
        const result = await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        expect(result.status).toBe('pass');
        expect(result.layerName).toBe(LAYER_NAMES[layer - 1]);
      }

      const state = engine.getState();
      expect(state.layers).toHaveLength(4);
    });
  });

  // ==========================================================
  // Layers 9-12: Security / Infrastructure / DevOps / QA
  // ==========================================================
  describe('Layers 9-12: Security, Infrastructure, DevOps, QA', () => {
    it('layer 9 Security — validates OWASP, PCI-DSS, secrets management', async () => {
      await engine.start();
      const result = await engine.validateLayer(9, BROCOLIS_FINPAY_EVIDENCE[9]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Security');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(4);
      expect(result.criteriaMet).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('Security');
      expect(protocol.status).toBe('complete');
      expect(protocol.recommendation).toBe('proceed');
    });

    it('layer 10 Infrastructure — validates Docker, K8s, Terraform', async () => {
      await engine.start();
      const result = await engine.validateLayer(10, BROCOLIS_FINPAY_EVIDENCE[10]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Infrastructure');
      expect(result.questionsAnswered).toBe(3);
      expect(result.evidenceCollected).toContain('ev-10-1');
      expect(result.evidenceCollected).toContain('ev-10-2');
      expect(result.evidenceCollected).toContain('ev-10-3');
    });

    it('layer 11 DevOps — validates CI/CD pipeline and rollback', async () => {
      await engine.start();
      const result = await engine.validateLayer(11, BROCOLIS_FINPAY_EVIDENCE[11]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('DevOps');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(3);
      expect(result.criteriaMet).toBe(3);

      const protocol = result.protocol;
      expect(protocol.status).toBe('complete');
      expect(protocol.completionPercent).toBe(100);
    });

    it('layer 12 QA — validates E2E tests and coverage > 80%', async () => {
      await engine.start();
      const result = await engine.validateLayer(12, BROCOLIS_FINPAY_EVIDENCE[12]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('QA');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.questionsAnswered).toBe(3);
      expect(result.criteriaMet).toBe(3);

      const protocol = result.protocol;
      expect(protocol.area).toBe('QA');
      expect(protocol.recommendation).toBe('proceed');
    });

    it('should pass layers 9-12 sequentially', async () => {
      await engine.start();

      for (let layer = 9; layer <= 12; layer++) {
        const result = await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        expect(result.status).toBe('pass');
        expect(result.layerName).toBe(LAYER_NAMES[layer - 1]);
      }

      const state = engine.getState();
      expect(state.layers).toHaveLength(4);
    });
  });

  // ==========================================================
  // Layers 13-18: Production Readiness
  // ==========================================================
  describe('Layers 13-18: Performance, Observability, Documentation, AI Governance, Enterprise Readiness, Production Readiness', () => {
    it('layer 13 Performance — validates load tests and Core Web Vitals', async () => {
      await engine.start();
      const result = await engine.validateLayer(13, BROCOLIS_FINPAY_EVIDENCE[13]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Performance');
      expect(result.questionsAnswered).toBe(3);
      expect(result.criteriaMet).toBe(3);
      expect(result.evidenceCollected).toContain('ev-13-1');
      expect(result.evidenceCollected).toContain('ev-13-2');
      expect(result.evidenceCollected).toContain('ev-13-3');
    });

    it('layer 14 Observability — validates Prometheus, Grafana, logging', async () => {
      await engine.start();
      const result = await engine.validateLayer(14, BROCOLIS_FINPAY_EVIDENCE[14]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Observability');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.protocol.status).toBe('complete');
    });

    it('layer 15 Documentation — validates API docs, user guides', async () => {
      await engine.start();
      const result = await engine.validateLayer(15, BROCOLIS_FINPAY_EVIDENCE[15]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Documentation');
      expect(result.questionsAnswered).toBe(3);
      expect(result.protocol.recommendation).toBe('proceed');
    });

    it('layer 16 AI Governance — validates AI policy and bias analysis', async () => {
      await engine.start();
      const result = await engine.validateLayer(16, BROCOLIS_FINPAY_EVIDENCE[16]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('AI Governance');
      expect(result.criteriaMet).toBe(3);
      expect(result.protocol.status).toBe('complete');
    });

    it('layer 17 Enterprise Readiness — validates compliance and maturity', async () => {
      await engine.start();
      const result = await engine.validateLayer(17, BROCOLIS_FINPAY_EVIDENCE[17]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Enterprise Readiness');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.protocol.area).toBe('Enterprise Readiness');
    });

    it('layer 18 Production Readiness — validates final deploy checklist', async () => {
      await engine.start();
      const result = await engine.validateLayer(18, BROCOLIS_FINPAY_EVIDENCE[18]);

      expect(result.status).toBe('pass');
      expect(result.layerName).toBe('Production Readiness');
      expect(result.criteriaMet).toBe(3);
      expect(result.protocol.status).toBe('complete');
      expect(result.protocol.recommendation).toBe('proceed');
    });

    it('should pass all production readiness layers 13-18', async () => {
      await engine.start();

      for (let layer = 13; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        expect(result.status).toBe('pass');
        expect(result.layerName).toBe(LAYER_NAMES[layer - 1]);
      }

      const state = engine.getState();
      expect(state.layers).toHaveLength(6);
    });
  });

  // ==========================================================
  // Complete Pipeline — Brocolis + FinPay End-to-End
  // ==========================================================
  describe('Complete Pipeline — Brocolis + FinPay End-to-End', () => {
    it('should run all 18 layers and produce a passing report', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        expect(result.status).toBe('pass');
        expect(result.score).toBeGreaterThanOrEqual(70);
      }

      const state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.layers).toHaveLength(18);
      expect(state.overallStatus).toBe('pass');

      const report = engine.getReport();
      expect(report.totalLayers).toBe(18);
      expect(report.completedLayers).toBe(18);
      expect(report.passedLayers).toBe(18);
      expect(report.failedLayers).toBe(0);
      expect(report.overallStatus).toBe('pass');
    });

    it('should have skills loaded for every layer', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        expect(result.skillsUsed.length).toBeGreaterThan(0);
        expect(result.skillsScore).toBeGreaterThan(0);
      }
    });

    it('should have complete protocols for every layer', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        const protocol = result.protocol;
        expect(protocol.status).toBe('complete');
        expect(protocol.completionPercent).toBe(100);
        expect(protocol.blockers).toHaveLength(0);
        expect(protocol.pendingItems).toHaveLength(0);
      }
    });

    it('should pass gate checks for every layer', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
        const gate = engine.checkGatesForLayer(layer);
        expect(gate.passed).toBe(true);
        expect(gate.failedGates).toHaveLength(0);
      }
    });

    it('should emit all lifecycle events during full run', async () => {
      const events: string[] = [];
      engine.on('pipeline:started', () => events.push('pipeline:started'));
      engine.on('layer:started', () => events.push('layer:started'));
      engine.on('layer:completed', () => events.push('layer:completed'));
      engine.on('layer:gate_checked', () => events.push('layer:gate_checked'));
      engine.on('evidence:validated', () => events.push('evidence:validated'));
      engine.on('skills:validated', () => events.push('skills:validated'));
      engine.on('pipeline:completed', () => events.push('pipeline:completed'));

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      expect(events.filter((e) => e === 'layer:started')).toHaveLength(18);
      expect(events.filter((e) => e === 'layer:completed')).toHaveLength(18);
      expect(events.filter((e) => e === 'layer:gate_checked')).toHaveLength(18);
      expect(events.filter((e) => e === 'evidence:validated')).toHaveLength(18);
      expect(events.filter((e) => e === 'skills:validated')).toHaveLength(18);
      expect(events).toContain('pipeline:started');
      expect(events).toContain('pipeline:completed');
    });
  });

  // ==========================================================
  // Pause/Resume During Brocolis + FinPay Pipeline
  // ==========================================================
  describe('Pause/Resume During Pipeline', () => {
    it('should pause after architecture (layer 4) and resume to complete', async () => {
      await engine.start();

      for (let layer = 1; layer <= 4; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      let state = engine.getState();
      expect(state.layers).toHaveLength(4);
      expect(state.currentLayer).toBe(5);

      engine.pause();
      expect(engine.getState().status).toBe('paused');

      engine.resume();
      expect(engine.getState().status).toBe('running');

      for (let layer = 5; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.overallStatus).toBe('pass');
      expect(state.layers).toHaveLength(18);
    });

    it('should pause after security (layer 9) and resume to complete', async () => {
      await engine.start();

      for (let layer = 1; layer <= 9; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      engine.pause();
      expect(engine.getState().status).toBe('paused');
      expect(engine.getState().layers).toHaveLength(9);

      engine.resume();

      for (let layer = 10; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      const state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.overallStatus).toBe('pass');
    });

    it('should allow multiple pause/resume cycles', async () => {
      await engine.start();

      for (let layer = 1; layer <= 3; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }
      engine.pause();
      engine.resume();

      for (let layer = 4; layer <= 6; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }
      engine.pause();
      engine.resume();

      for (let layer = 7; layer <= 9; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }
      engine.pause();
      engine.resume();

      for (let layer = 10; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      const state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.layers).toHaveLength(18);
      expect(state.overallStatus).toBe('pass');
    });
  });

  // ==========================================================
  // Gate Check Results Per Layer
  // ==========================================================
  describe('Gate Check Results Per Layer', () => {
    it('should return failed for non-executed layer', () => {
      const gate = engine.checkGatesForLayer(1);
      expect(gate.passed).toBe(false);
      expect(gate.failedGates).toContain('Layer 1 not executed');
    });

    it('should pass gates for all 18 layers after full validation', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      for (let layer = 1; layer <= 18; layer++) {
        const gate = engine.checkGatesForLayer(layer);
        expect(gate.passed).toBe(true);
        expect(gate.failedGates).toHaveLength(0);
        expect(gate.warnings).toBeDefined();
      }
    });

    it('should pass gates for executed layer even with empty evidence', async () => {
      await engine.start();
      await engine.validateLayer(1, []);

      const gate = engine.checkGatesForLayer(1);
      expect(gate.passed).toBe(true);
    });

    it('should emit gate_checked events with correct results', async () => {
      const gateResults: Array<{ layer: number; passed: boolean }> = [];
      engine.on('layer:gate_checked', (layer, result) => {
        gateResults.push({ layer, passed: result.passed });
      });

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, BROCOLIS_FINPAY_EVIDENCE[layer]);
      }

      expect(gateResults).toHaveLength(18);
      for (const gr of gateResults) {
        expect(gr.passed).toBe(true);
      }
    });
  });
});
