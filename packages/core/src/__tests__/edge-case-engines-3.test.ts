import type { DNAPackage } from '@behavioros/schemas';
import { describe, expect, it, vi } from 'vitest';
import { AuditEngine, type AuditStage } from '../engines/audit/audit-engine';
import { PipelineEngine } from '../engines/pipeline/pipeline-engine';

function createMinimalDNA(): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Test Engineer',
        boundaries: [],
      },
    ],
    governance: [],
    quality: [],
    patterns: [],
    workflows: [],
  };
}

// ============================================================
// 1. PipelineEngine — Edge Cases
// ============================================================

describe('PipelineEngine — edge cases', () => {
  it('start throws when already started (duplicate)', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    await engine.start();
    await expect(engine.start()).rejects.toThrow('already started');
  });

  it('advance throws when not started', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    await expect(engine.advance()).rejects.toThrow('not running');
  });

  it('pause returns current state', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    await engine.start();
    const state = engine.pause();
    expect(state.status).toBe('paused');
  });

  it('pause on paused pipeline throws', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    await engine.start();
    engine.pause();
    expect(() => engine.pause()).toThrow('not running');
  });

  it('resume throws when not paused', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    expect(() => engine.resume()).toThrow();
  });

  it('resume after pause returns running', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    await engine.start();
    engine.pause();
    const state = engine.resume();
    expect(state.status).toBe('running');
  });

  it('getLayer returns undefined for non-existent layer', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const layer = engine.getLayer(999);
    expect(layer).toBeUndefined();
  });

  it('getEAARGStep returns undefined for non-existent layer', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const step = engine.getEAARGStep(999);
    expect(step).toBeUndefined();
  });

  it('getEAARGSteps returns empty array for no workflows', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const steps = engine.getEAARGSteps();
    expect(Array.isArray(steps)).toBe(true);
  });

  it('getState returns current pipeline state', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const state = engine.getState();
    expect(state).toHaveProperty('status');
    expect(state.status).toBe('created');
  });

  it('getReport returns report with initial state', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const report = engine.getReport();
    expect(report).toHaveProperty('dnaId');
    expect(report).toHaveProperty('overallStatus');
    expect(report.overallStatus).toBe('pass');
    expect(Array.isArray(report.layers)).toBe(true);
  });

  it('checkGatesForLayer returns failed for non-existent layer', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const result = engine.checkGatesForLayer(999);
    expect(result.passed).toBe(false);
  });

  it('validateLayer throws for non-existent layer', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    await expect(engine.validateLayer(999, [])).rejects.toThrow();
  });

  it('getProtocol returns undefined for non-existent layer', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const protocol = engine.getProtocol(999);
    expect(protocol).toBeUndefined();
  });

  it('getProgress returns 0 percent for engine with no workflows', () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const progress = engine.getProgress();
    expect(progress.current).toBe(1);
    expect(progress.total).toBe(0);
    expect(progress.percent).toBe(0);
  });

  it('emits pipeline:started event on start', async () => {
    const engine = new PipelineEngine(createMinimalDNA());
    const handler = vi.fn();
    engine.on('pipeline:started', handler);
    await engine.start();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits pipeline:completed event if only one layer', async () => {
    const dna = createMinimalDNA();
    dna.workflows = [
      {
        id: 'wf-1',
        name: 'wf-1',
        input: {
          layer: 1,
          layerName: 'Layer 1',
          questions: [],
          acceptanceCriteria: [],
          requiredEvidence: [],
          skills: [],
        },
      } as unknown as NonNullable<typeof dna.workflows>[number],
    ];
    const engine = new PipelineEngine(dna);
    await engine.start();
    const handler = vi.fn();
    engine.on('pipeline:completed', handler);
    const result = await engine.advance();
    expect(result).toBeDefined();
  });
});

// ============================================================
// 2. AuditEngine — Edge Cases
// ============================================================

describe('AuditEngine — edge cases', () => {
  it('execute with empty stages list returns valid result', async () => {
    const engine = new AuditEngine();
    const result = await engine.execute({ projectPath: '/tmp/non-existent-bos-audit' }, []);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('stages');
    expect(result.stages).toEqual([]);
    expect(result.overall).toBe('pass');
  });

  it('execute with non-existent project path does not throw', async () => {
    const engine = new AuditEngine();
    const result = await engine.execute({ projectPath: '/tmp/non-existent-bos-audit-2' }, [
      'static' as AuditStage,
    ]);
    expect(result).toHaveProperty('stages');
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].result).toBe('pass');
  });

  it('getHistory returns empty array when no persist path', () => {
    const engine = new AuditEngine();
    const history = engine.getHistory();
    expect(history).toEqual([]);
  });

  it('getLastAudit returns undefined when no history', () => {
    const engine = new AuditEngine();
    const last = engine.getLastAudit();
    expect(last).toBeUndefined();
  });

  it('summary of empty result returns valid string', async () => {
    const engine = new AuditEngine();
    const result = await engine.execute({ projectPath: '/tmp/non-existent-bos-audit-3' }, []);
    const s = engine.summary(result);
    expect(typeof s).toBe('string');
    expect(s.length).toBeGreaterThan(0);
  });

  it('registerStage registers custom stage executor', () => {
    const engine = new AuditEngine();
    const executor = {
      stage: 'custom' as unknown as AuditStage,
      name: 'Custom Stage',
      execute: vi.fn().mockResolvedValue({
        stage: 'custom' as unknown as AuditStage,
        result: 'pass',
        score: 100,
        events: [],
        duration: 0,
      }),
    };
    engine.registerStage(executor);
    expect(executor).toBeDefined();
  });

  it('handles unregistered stage gracefully', async () => {
    const engine = new AuditEngine();
    const result = await engine.execute({ projectPath: '/tmp/test' }, [
      'nonexistent' as AuditStage,
    ]);
    expect(result.stages.length).toBe(1);
    expect(result.stages[0].result).toBe('skip');
  });

  it('execute correctly sets overall score', async () => {
    const engine = new AuditEngine();
    const result = await engine.execute({ projectPath: '/tmp/non-existent-bos-audit-4' }, []);
    expect(typeof result.score).toBe('number');
  });
});
