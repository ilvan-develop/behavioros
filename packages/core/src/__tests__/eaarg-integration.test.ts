import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DNAPackage, EAARGStep } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { PipelineEngine } from '../engines/pipeline/pipeline-engine';

// ============================================================
// EAARG Integration Tests — Full 18-Layer Pipeline
// ============================================================

const DNA_PATH = resolve(process.cwd(), '../../dnas/enterprise-agent-review.yaml');

function loadDNAYaml(): DNAPackage {
  const raw = readFileSync(DNA_PATH, 'utf-8');
  const parsed = parseYaml(raw);
  return parsed as DNAPackage;
}

function getFullEvidenceForStep(step: EAARGStep): string[] {
  const evidence: string[] = [];
  for (const q of step.questions) {
    evidence.push(q.id);
  }
  for (const ev of step.requiredEvidence) {
    evidence.push(ev.id);
  }
  return evidence;
}

function buildAllEvidenceMap(dna: DNAPackage): Map<number, string[]> {
  const map = new Map<number, string[]>();
  const engine = new PipelineEngine(dna);
  const steps = engine.getEAARGSteps();
  for (const step of steps) {
    map.set(step.layer, getFullEvidenceForStep(step));
  }
  return map;
}

const BROCOLIS_FINPAY_EVIDENCE: Record<number, string[]> = {
  1: ['q1-1', 'q1-2', 'q1-3', 'q1-4', 'ev-1-1', 'ev-1-2'],
  2: ['q2-1', 'q2-2', 'q2-3', 'ev-2-1', 'ev-2-2'],
  3: ['q3-1', 'q3-2', 'q3-3', 'ev-3-1', 'ev-3-2'],
  4: ['q4-1', 'q4-2', 'q4-3', 'q4-4', 'ev-4-1', 'ev-4-2', 'ev-4-3'],
  5: ['q5-1', 'q5-2', 'q5-3', 'q5-4', 'ev-5-1', 'ev-5-2', 'ev-5-3'],
  6: ['q6-1', 'q6-2', 'q6-3', 'q6-4', 'ev-6-1', 'ev-6-2', 'ev-6-3'],
  7: ['q7-1', 'q7-2', 'q7-3', 'q7-4', 'ev-7-1', 'ev-7-2', 'ev-7-3'],
  8: ['q8-1', 'q8-2', 'q8-3', 'q8-4', 'ev-8-1', 'ev-8-2', 'ev-8-3'],
  9: ['q9-1', 'q9-2', 'q9-3', 'q9-4', 'ev-9-1', 'ev-9-2', 'ev-9-3'],
  10: ['q10-1', 'q10-2', 'q10-3', 'ev-10-1', 'ev-10-2', 'ev-10-3'],
  11: ['q11-1', 'q11-2', 'q11-3', 'ev-11-1', 'ev-11-2', 'ev-11-3'],
  12: ['q12-1', 'q12-2', 'q12-3', 'ev-12-1', 'ev-12-2', 'ev-12-3'],
  13: ['q13-1', 'q13-2', 'q13-3', 'ev-13-1', 'ev-13-2', 'ev-13-3'],
  14: ['q14-1', 'q14-2', 'q14-3', 'ev-14-1', 'ev-14-2', 'ev-14-3'],
  15: ['q15-1', 'q15-2', 'q15-3', 'ev-15-1', 'ev-15-2', 'ev-15-3'],
  16: ['q16-1', 'q16-2', 'q16-3', 'ev-16-1', 'ev-16-2', 'ev-16-3'],
  17: ['q17-1', 'q17-2', 'q17-3', 'ev-17-1', 'ev-17-2', 'ev-17-3'],
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

describe('EAARG Integration — Full 18-Layer Pipeline', () => {
  let dna: DNAPackage;
  let engine: PipelineEngine;
  let allEvidence: Map<number, string[]>;

  beforeEach(() => {
    dna = loadDNAYaml();
    engine = new PipelineEngine(dna);
    allEvidence = buildAllEvidenceMap(dna);
  });

  describe('DNA loading from YAML', () => {
    it('should load the enterprise-agent-review DNA successfully', () => {
      expect(dna).toBeDefined();
      expect(dna.id).toBe('enterprise-agent-review');
      expect(dna.name).toContain('EAARG');
      expect(dna.version).toBe('1.0.0');
    });

    it('should have 5 personas', () => {
      expect(dna.personas).toHaveLength(5);
      const roles = dna.personas.map((p) => p.role);
      expect(roles).toContain('architect');
      expect(roles).toContain('engineer');
      expect(roles).toContain('qa');
      expect(roles).toContain('security');
      expect(roles).toContain('devops');
    });

    it('should have 3 governance rules', () => {
      expect(dna.governance).toHaveLength(3);
    });

    it('should have 5 quality gates', () => {
      expect(dna.quality).toHaveLength(5);
    });

    it('should extract 18 EAARG steps from workflows', () => {
      const steps = engine.getEAARGSteps();
      expect(steps).toHaveLength(18);
    });
  });

  describe('EAARG Step Structure', () => {
    it('should have all 18 layers with correct names', () => {
      const steps = engine.getEAARGSteps();
      for (let i = 0; i < 18; i++) {
        expect(steps[i].layer).toBe(i + 1);
        expect(steps[i].layerName).toBe(LAYER_NAMES[i]);
      }
    });

    it('should have questions for every layer', () => {
      const steps = engine.getEAARGSteps();
      for (const step of steps) {
        expect(step.questions.length).toBeGreaterThan(0);
      }
    });

    it('should have required evidence for every layer', () => {
      const steps = engine.getEAARGSteps();
      for (const step of steps) {
        expect(step.requiredEvidence.length).toBeGreaterThan(0);
        const requiredOnes = step.requiredEvidence.filter((e) => e.required);
        expect(requiredOnes.length).toBeGreaterThan(0);
      }
    });

    it('should have acceptance criteria for every layer', () => {
      const steps = engine.getEAARGSteps();
      for (const step of steps) {
        expect(step.acceptanceCriteria.length).toBeGreaterThan(0);
      }
    });

    it('should have skills references for every layer', () => {
      const steps = engine.getEAARGSteps();
      for (const step of steps) {
        expect(step.skills.length).toBeGreaterThan(0);
      }
    });

    it('should chain layers via next pointers correctly', () => {
      const steps = engine.getEAARGSteps();
      for (let i = 0; i < 17; i++) {
        expect(steps[i].next!.length).toBeGreaterThan(0);
      }
      expect(steps[17].next).toEqual([]);
    });
  });

  describe('Full Pipeline Run — All 18 Layers Pass', () => {
    it('should run all 18 layers and complete with overallStatus pass', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, allEvidence.get(layer)!);
        expect(result.layer).toBe(layer);
        expect(result.layerName).toBe(LAYER_NAMES[layer - 1]);
        expect(result.status).toBe('pass');
        expect(result.score).toBeGreaterThanOrEqual(70);
        expect(result.evidenceCollected.length).toBeGreaterThan(0);
        expect(result.questionsAnswered).toBe(result.questionsTotal);
        expect(result.criteriaMet).toBe(result.criteriaTotal);
      }

      const state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.layers).toHaveLength(18);
      expect(state.overallStatus).toBe('pass');
    });

    it('should produce a passing report after all layers', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      const report = engine.getReport();
      expect(report.totalLayers).toBe(18);
      expect(report.completedLayers).toBe(18);
      expect(report.passedLayers).toBe(18);
      expect(report.failedLayers).toBe(0);
      expect(report.skippedLayers).toBe(0);
      expect(report.overallStatus).toBe('pass');
      expect(report.overallScore).toBeGreaterThanOrEqual(70);
      expect(report.startedAt).toBeDefined();
      expect(report.completedAt).toBeDefined();
    });
  });

  describe('Skills Validation Per Layer', () => {
    it('should use skills for every layer during validation', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, allEvidence.get(layer)!);
        expect(result.skillsUsed).toBeDefined();
        expect(result.skillsUsed.length).toBeGreaterThan(0);
        expect(result.skillsScore).toBeDefined();
        expect(result.skillsScore).toBeGreaterThan(0);
      }
    });

    it('should emit skills:validated event for each layer', async () => {
      const validatedLayers: number[] = [];
      engine.on('skills:validated', (layer) => validatedLayers.push(layer));

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      expect(validatedLayers).toHaveLength(18);
      for (let i = 1; i <= 18; i++) {
        expect(validatedLayers).toContain(i);
      }
    });
  });

  describe('ConversationProtocol Per Layer', () => {
    it('should produce complete protocol for each layer', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, allEvidence.get(layer)!);
        const protocol = result.protocol;

        expect(protocol).toBeDefined();
        expect(protocol.area).toBe(LAYER_NAMES[layer - 1]);
        expect(protocol.status).toBe('complete');
        expect(protocol.completionPercent).toBe(100);
        expect(protocol.completedItems.length).toBeGreaterThan(0);
        expect(protocol.pendingItems).toHaveLength(0);
        expect(protocol.blockers).toHaveLength(0);
        expect(protocol.recommendation).toBe('proceed');
        expect(protocol.acceptanceCriteria.length).toBeGreaterThan(0);
        expect(protocol.evidence.length).toBeGreaterThan(0);
      }
    });

    it('should be retrievable via getProtocol after validation', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
        const protocol = engine.getProtocol(layer);
        expect(protocol).toBeDefined();
        expect(protocol?.area).toBe(LAYER_NAMES[layer - 1]);
        expect(protocol?.status).toBe('complete');
      }
    });
  });

  describe('Gate Check Results Per Layer', () => {
    it('should pass gate checks for every layer', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
        const gateResult = engine.checkGatesForLayer(layer);
        expect(gateResult.passed).toBe(true);
        expect(gateResult.failedGates).toHaveLength(0);
      }
    });

    it('should emit layer:gate_checked event for each layer', async () => {
      const gateCheckedLayers: number[] = [];
      engine.on('layer:gate_checked', (layer) => gateCheckedLayers.push(layer));

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      expect(gateCheckedLayers).toHaveLength(18);
    });
  });

  describe('Pause and Resume During Pipeline', () => {
    it('should pause after layer 6 and resume to complete all 18 layers', async () => {
      await engine.start();

      for (let layer = 1; layer <= 6; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      let state = engine.getState();
      expect(state.status).toBe('running');
      expect(state.currentLayer).toBe(7);
      expect(state.layers).toHaveLength(6);

      engine.pause();
      state = engine.getState();
      expect(state.status).toBe('paused');

      engine.resume();
      state = engine.getState();
      expect(state.status).toBe('running');

      for (let layer = 7; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.layers).toHaveLength(18);
      expect(state.overallStatus).toBe('pass');
    });

    it('should pause after layer 12 and resume to complete remaining layers', async () => {
      await engine.start();

      for (let layer = 1; layer <= 12; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      const stateBeforePause = engine.getState();
      expect(stateBeforePause.currentLayer).toBe(13);
      expect(stateBeforePause.layers).toHaveLength(12);

      engine.pause();
      expect(engine.getState().status).toBe('paused');

      engine.resume();
      expect(engine.getState().status).toBe('running');

      for (let layer = 13; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      const finalState = engine.getState();
      expect(finalState.status).toBe('completed');
      expect(finalState.layers).toHaveLength(18);
      expect(finalState.overallStatus).toBe('pass');
    });

    it('should emit pause and resume events', async () => {
      const events: string[] = [];
      engine.on('pipeline:paused', () => events.push('paused'));
      engine.on('pipeline:resumed', () => events.push('resumed'));

      await engine.start();
      for (let layer = 1; layer <= 3; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      engine.pause();
      engine.resume();

      expect(events).toContain('paused');
      expect(events).toContain('resumed');
    });
  });

  describe('Progress Tracking', () => {
    it('should track progress correctly through all 18 layers', async () => {
      await engine.start();

      const progress = engine.getProgress();
      expect(progress.current).toBe(1);
      expect(progress.total).toBe(18);
      expect(progress.percent).toBe(Math.round((1 / 18) * 100));

      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      const finalProgress = engine.getProgress();
      expect(finalProgress.total).toBe(18);
    });
  });

  describe('Evidence Validation', () => {
    it('should emit evidence:validated event for each layer', async () => {
      const evidenceLayers: number[] = [];
      engine.on('evidence:validated', (layer) => evidenceLayers.push(layer));

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      expect(evidenceLayers).toHaveLength(18);
    });

    it('should collect all evidence IDs per layer', async () => {
      await engine.start();

      for (let layer = 1; layer <= 18; layer++) {
        const result = await engine.validateLayer(layer, allEvidence.get(layer)!);
        expect(result.evidenceCollected.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Layer Events Emission', () => {
    it('should emit layer:started and layer:completed for all 18 layers', async () => {
      const startedLayers: number[] = [];
      const completedLayers: number[] = [];

      engine.on('layer:started', (layer) => startedLayers.push(layer));
      engine.on('layer:completed', (result) => completedLayers.push(result.layer));

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      expect(completedLayers).toHaveLength(18);
      for (let i = 1; i <= 18; i++) {
        expect(completedLayers).toContain(i);
      }
    });

    it('should emit pipeline:started and pipeline:completed', async () => {
      const events: string[] = [];
      engine.on('pipeline:started', () => events.push('started'));
      engine.on('pipeline:completed', () => events.push('completed'));

      await engine.start();
      for (let layer = 1; layer <= 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }

      expect(events).toContain('started');
      expect(events).toContain('completed');
    });
  });

  describe('Individual Layer Validation Details', () => {
    it('layer 1 Business — should pass with correct score', async () => {
      await engine.start();
      const result = await engine.validateLayer(1, allEvidence.get(1)!);
      expect(result.status).toBe('pass');
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.protocol.area).toBe('Business');
    });

    it('layer 4 Architecture — should pass with C4 diagram evidence', async () => {
      await engine.start();
      const result = await engine.validateLayer(4, allEvidence.get(4)!);
      expect(result.status).toBe('pass');
      expect(result.protocol.area).toBe('Architecture');
      expect(result.evidenceCollected).toContain('ev-4-3');
    });

    it('layer 9 Security — should pass with OWASP evidence', async () => {
      await engine.start();
      const result = await engine.validateLayer(9, allEvidence.get(9)!);
      expect(result.status).toBe('pass');
      expect(result.protocol.area).toBe('Security');
      expect(result.evidenceCollected).toContain('ev-9-1');
    });

    it('layer 18 Production Readiness — should pass as final layer', async () => {
      await engine.start();
      for (let layer = 1; layer < 18; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }
      const result = await engine.validateLayer(18, allEvidence.get(18)!);
      expect(result.status).toBe('pass');
      expect(result.protocol.area).toBe('Production Readiness');
      expect(result.protocol.recommendation).toBe('proceed');

      const state = engine.getState();
      expect(state.status).toBe('completed');
    });
  });

  describe('Failure Handling', () => {
    it('should fail pipeline if a layer does not receive required evidence', async () => {
      await engine.start();
      const result = await engine.validateLayer(1, []);
      expect(result.status).toBe('fail');
      expect(result.score).toBeLessThan(70);

      const state = engine.getState();
      expect(state.status).toBe('failed');
    });

    it('should fail layer 10 if infrastructure evidence is missing', async () => {
      await engine.start();
      for (let layer = 1; layer < 10; layer++) {
        await engine.validateLayer(layer, allEvidence.get(layer)!);
      }
      const result = await engine.validateLayer(10, ['q10-1']);
      expect(result.status).toBe('fail');

      const state = engine.getState();
      expect(state.status).toBe('failed');
    });
  });
});
