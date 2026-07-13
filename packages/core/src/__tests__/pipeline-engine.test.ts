import type { DNAPackage, EAARGStep, WorkflowStep } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { PipelineEngine } from '../engines/pipeline/pipeline-engine';

// ============================================================
// Pipeline Engine Tests
// ============================================================

function createTestDNA(): DNAPackage {
  return {
    id: 'test-eaarg',
    name: 'Test EAARG DNA',
    version: '1.0.0',
    description: 'Test DNA package for pipeline engine tests',
    personas: [
      {
        role: 'architect',
        authority: 'lead',
        name: 'Test Architect',
        description: 'Test architect persona',
      },
    ],
    governance: [
      {
        id: 'gov-test',
        name: 'Test Governance',
        level: 'medium',
        action: 'warn',
        conditions: ['type:test'],
      },
    ],
    quality: [
      {
        id: 'qg-test',
        name: 'Test Coverage',
        type: 'custom',
        threshold: 70,
        config: { layer: 1 },
      },
    ],
    workflows: [
      createEAARGWorkflow(1, 'Business', [
        {
          id: 'q1',
          question: 'Qual problema estamos resolvendo?',
          category: 'functional',
          required: true,
        },
        {
          id: 'q2',
          question: 'Qual é a proposta de valor?',
          category: 'functional',
          required: true,
        },
      ]),
      createEAARGWorkflow(2, 'Product', [
        { id: 'q3', question: 'O escopo está completo?', category: 'functional', required: true },
      ]),
      createEAARGWorkflow(3, 'Requirements', [
        {
          id: 'q4',
          question: 'Todos os requisitos funcionais?',
          category: 'functional',
          required: true,
        },
        {
          id: 'q5',
          question: 'Requisitos não funcionais?',
          category: 'non_functional',
          required: true,
        },
      ]),
    ],
  };
}

function createEAARGWorkflow(
  layer: number,
  layerName: string,
  questions: Array<{ id: string; question: string; category: string; required: boolean }>,
): WorkflowStep {
  return {
    id: `layer-${layer}`,
    name: layerName,
    type: 'gate',
    agent: 'architect',
    next: layer < 18 ? [`layer-${layer + 1}`] : [],
    input: {
      layer,
      layerName,
      objectives: [`Complete ${layerName} review`],
      questions,
      requiredEvidence: [
        {
          id: `ev-${layer}-1`,
          type: 'file',
          description: `Evidence for ${layerName}`,
          required: true,
        },
      ],
      acceptanceCriteria: [
        { id: `ac-${layer}-1`, description: `${layerName} criteria met`, weight: 1 },
      ],
      rejectionCriteria: [
        { id: `rc-${layer}-1`, description: `${layerName} criteria not met`, weight: 1 },
      ],
      checklist: [`${layerName} checklist item 1`],
      nextSteps: [`Proceed to layer ${layer + 1}`],
    },
  };
}

describe('PipelineEngine', () => {
  let dna: DNAPackage;
  let engine: PipelineEngine;

  beforeEach(() => {
    dna = createTestDNA();
    engine = new PipelineEngine(dna);
  });

  describe('constructor', () => {
    it('should create pipeline with initial state', () => {
      const state = engine.getState();
      expect(state.status).toBe('created');
      expect(state.dnaId).toBe('test-eaarg');
      expect(state.layers).toHaveLength(0);
      expect(state.overallStatus).toBe('pending');
    });

    it('should extract EAARG steps from DNA', () => {
      const steps = engine.getEAARGSteps();
      expect(steps).toHaveLength(3);
      expect(steps[0].layer).toBe(1);
      expect(steps[0].layerName).toBe('Business');
      expect(steps[1].layer).toBe(2);
      expect(steps[1].layerName).toBe('Product');
      expect(steps[2].layer).toBe(3);
      expect(steps[2].layerName).toBe('Requirements');
    });

    it('should handle DNA without EAARG steps', () => {
      const simpleDNA: DNAPackage = {
        id: 'simple',
        name: 'Simple',
        version: '1.0.0',
        personas: [{ role: 'engineer', authority: 'junior' }],
      };
      const simpleEngine = new PipelineEngine(simpleDNA);
      expect(simpleEngine.getEAARGSteps()).toHaveLength(0);
    });
  });

  describe('start', () => {
    it('should start pipeline', async () => {
      const state = await engine.start();
      expect(state.status).toBe('running');
      expect(state.currentLayer).toBe(1);
      expect(state.startedAt).toBeDefined();
    });

    it('should emit pipeline:started event', async () => {
      const events: string[] = [];
      engine.on('pipeline:started', () => events.push('started'));
      await engine.start();
      expect(events).toContain('started');
    });

    it('should throw if already started', async () => {
      await engine.start();
      await expect(engine.start()).rejects.toThrow('Pipeline already started');
    });
  });

  describe('advance', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should prepare layer for validation', async () => {
      const result = await engine.advance();
      expect(result.layer).toBe(1);
      expect(result.layerName).toBe('Business');
      expect(result.status).toBe('in_progress');
      expect(result.score).toBe(0);
      expect(result.protocol).toBeDefined();
    });

    it('should emit layer:started event', async () => {
      const events: Array<{ layer: number; name: string }> = [];
      engine.on('layer:started', (layer, name) => events.push({ layer, name }));
      await engine.advance();
      expect(events).toHaveLength(1);
      expect(events[0].layer).toBe(1);
      expect(events[0].name).toBe('Business');
    });

    it('should not change current layer after advance', async () => {
      await engine.advance();
      const state = engine.getState();
      expect(state.currentLayer).toBe(1);
    });

    it('should throw if not running', async () => {
      await engine.pause();
      await expect(engine.advance()).rejects.toThrow('Pipeline is not running');
    });
  });

  describe('validateLayer', () => {
    beforeEach(async () => {
      await engine.start();
    });

    it('should validate layer with evidence', async () => {
      const result = await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      expect(result.layer).toBe(1);
      expect(result.evidenceCollected).toContain('ev-1-1');
      expect(result.status).toBe('pass');
      expect(result.score).toBeGreaterThan(0);
      expect(result.skillsScore).toBeDefined();
      expect(result.skillsUsed).toBeDefined();
    });

    it('should validate layer without evidence', async () => {
      const result = await engine.validateLayer(1, []);
      expect(result.layer).toBe(1);
      expect(result.evidenceCollected).toHaveLength(0);
      expect(result.status).toBe('fail');
      // Score includes 20% from skills (100 * 0.2 = 20)
      expect(result.score).toBe(20);
      expect(result.skillsScore).toBe(100);
      expect(result.skillsUsed).toHaveLength(0);
    });

    it('should advance to next layer after validation', async () => {
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      const state = engine.getState();
      expect(state.currentLayer).toBe(2);
      expect(state.layers).toHaveLength(1);
      expect(state.layers[0].layer).toBe(1);
    });

    it('should emit layer:completed on pass', async () => {
      const events: number[] = [];
      engine.on('layer:completed', (result) => events.push(result.layer));
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      expect(events).toContain(1);
    });

    it('should emit layer:failed on fail', async () => {
      const events: number[] = [];
      engine.on('layer:failed', (result) => events.push(result.layer));
      await engine.validateLayer(1, []);
      expect(events).toContain(1);
    });

    it('should emit layer:gate_checked event', async () => {
      const events: number[] = [];
      engine.on('layer:gate_checked', (layer) => events.push(layer));
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      expect(events).toContain(1);
    });

    it('should throw for invalid layer', async () => {
      await expect(engine.validateLayer(99, [])).rejects.toThrow('No EAARG step found');
    });

    it('should fail pipeline on layer failure', async () => {
      await engine.validateLayer(1, []);
      const state = engine.getState();
      expect(state.status).toBe('failed');
    });

    it('should complete pipeline after all layers pass', async () => {
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      await engine.validateLayer(2, ['q3', 'ev-2-1']);
      await engine.validateLayer(3, ['q4', 'q5', 'ev-3-1']);
      const state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.layers).toHaveLength(3);
      expect(state.overallStatus).toBe('pass');
    });
  });

  describe('pause and resume', () => {
    it('should pause running pipeline', async () => {
      await engine.start();
      const state = engine.pause();
      expect(state.status).toBe('paused');
    });

    it('should resume paused pipeline', async () => {
      await engine.start();
      engine.pause();
      const state = engine.resume();
      expect(state.status).toBe('running');
    });

    it('should throw if pausing non-running pipeline', async () => {
      expect(() => engine.pause()).toThrow('Pipeline is not running');
    });

    it('should throw if resuming non-paused pipeline', async () => {
      await engine.start();
      expect(() => engine.resume()).toThrow('Cannot resume');
    });
  });

  describe('getLayer', () => {
    it('should return layer result after validation', async () => {
      await engine.start();
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      const layer = engine.getLayer(1);
      expect(layer).toBeDefined();
      expect(layer?.layer).toBe(1);
      expect(layer?.layerName).toBe('Business');
    });

    it('should return undefined for non-existent layer', () => {
      expect(engine.getLayer(99)).toBeUndefined();
    });
  });

  describe('getEAARGStep', () => {
    it('should return EAARG step for valid layer', () => {
      const step = engine.getEAARGStep(1);
      expect(step).toBeDefined();
      expect(step?.layer).toBe(1);
      expect(step?.questions).toHaveLength(2);
    });

    it('should return undefined for invalid layer', () => {
      expect(engine.getEAARGStep(99)).toBeUndefined();
    });
  });

  describe('checkGatesForLayer', () => {
    it('should check gates for validated layer', async () => {
      await engine.start();
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      const result = engine.checkGatesForLayer(1);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('failedGates');
      expect(result).toHaveProperty('warnings');
    });

    it('should return failed for non-validated layer', () => {
      const result = engine.checkGatesForLayer(1);
      expect(result.passed).toBe(false);
      expect(result.failedGates).toContain('Layer 1 not executed');
    });
  });

  describe('getProtocol', () => {
    it('should return protocol for validated layer', async () => {
      await engine.start();
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      const protocol = engine.getProtocol(1);
      expect(protocol).toBeDefined();
      expect(protocol?.area).toBe('Business');
    });

    it('should return undefined for non-validated layer', () => {
      expect(engine.getProtocol(1)).toBeUndefined();
    });
  });

  describe('getProgress', () => {
    it('should return progress info', () => {
      const progress = engine.getProgress();
      expect(progress.current).toBe(1);
      expect(progress.total).toBe(3);
      expect(progress.percent).toBe(33);
    });

    it('should update progress after validation', async () => {
      await engine.start();
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      const progress = engine.getProgress();
      expect(progress.current).toBe(2);
      expect(progress.percent).toBe(67);
    });
  });

  describe('getReport', () => {
    it('should generate report from empty pipeline', () => {
      const report = engine.getReport();
      expect(report.totalLayers).toBe(3);
      expect(report.completedLayers).toBe(0);
      expect(report.overallStatus).toBe('pending');
    });

    it('should generate report after validating layers', async () => {
      await engine.start();
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);
      await engine.validateLayer(2, ['q3', 'ev-2-1']);
      const report = engine.getReport();
      expect(report.completedLayers).toBe(2);
      expect(report.passedLayers).toBe(2);
    });
  });

  describe('events', () => {
    it('should emit all pipeline lifecycle events', async () => {
      const events: string[] = [];
      engine.on('pipeline:started', () => events.push('pipeline:started'));
      engine.on('layer:started', () => events.push('layer:started'));
      engine.on('layer:completed', () => events.push('layer:completed'));
      engine.on('layer:gate_checked', () => events.push('layer:gate_checked'));

      await engine.start();
      await engine.validateLayer(1, ['q1', 'q2', 'ev-1-1']);

      expect(events).toContain('pipeline:started');
      expect(events).toContain('layer:started');
      expect(events).toContain('layer:completed');
      expect(events).toContain('layer:gate_checked');
    });
  });
});
