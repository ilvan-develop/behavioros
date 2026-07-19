import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDispatcherContext,
  type DispatcherLayerResult,
  type PipelineDispatcherContext,
} from '../pipeline/pipeline-context';
import {
  PipelineDispatcher,
  type PipelineDispatcherInterceptor,
  type PipelineDispatcherLayer,
} from '../pipeline/pipeline-dispatcher';

// ============================================================
// Helpers
// ============================================================

function makeContext(
  overrides: Partial<PipelineDispatcherContext> = {},
): PipelineDispatcherContext {
  return createDispatcherContext({
    id: 'test-pipeline',
    dnaId: 'test-dna',
    dnaMode: 'transactional',
    agentId: 'agent-1',
    agentAuthority: 'senior',
    action: 'test-action',
    payload: {},
    metadata: new Map(),
    ...overrides,
  });
}

function makeLayer(
  id: string,
  name: string,
  opts: {
    passed?: boolean;
    error?: string;
    shouldExecute?: (ctx: PipelineDispatcherContext) => boolean;
  } = {},
): PipelineDispatcherLayer {
  const { passed = true, error, shouldExecute } = opts;
  return {
    id,
    name,
    execute: vi.fn().mockResolvedValue({
      layerId: id,
      layerName: name,
      passed,
      score: passed ? 100 : 0,
      duration: 10,
      details: {},
      ...(error ? { error } : {}),
    } satisfies DispatcherLayerResult),
    ...(shouldExecute ? { shouldExecute } : {}),
  };
}

// ============================================================
// PipelineDispatcher Tests
// ============================================================

describe('PipelineDispatcher', () => {
  let dispatcher: PipelineDispatcher;

  beforeEach(() => {
    dispatcher = new PipelineDispatcher();
  });

  describe('constructor', () => {
    it('should create a dispatcher with empty layers', () => {
      expect(dispatcher.getLayers()).toHaveLength(0);
      expect(dispatcher.getInterceptors()).toHaveLength(0);
    });
  });

  describe('addLayer', () => {
    it('should add a layer', () => {
      const layer = makeLayer('l1', 'Layer 1');
      dispatcher.addLayer(layer);
      expect(dispatcher.getLayers()).toHaveLength(1);
      expect(dispatcher.getLayers()[0].id).toBe('l1');
    });

    it('should add multiple layers in order', () => {
      dispatcher.addLayer(makeLayer('l1', 'Layer 1'));
      dispatcher.addLayer(makeLayer('l2', 'Layer 2'));
      dispatcher.addLayer(makeLayer('l3', 'Layer 3'));
      expect(dispatcher.getLayers()).toHaveLength(3);
      expect(dispatcher.getLayers().map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
    });

    it('should support chaining', () => {
      const result = dispatcher
        .addLayer(makeLayer('l1', 'Layer 1'))
        .addLayer(makeLayer('l2', 'Layer 2'));
      expect(result).toBe(dispatcher);
      expect(dispatcher.getLayers()).toHaveLength(2);
    });
  });

  describe('addInterceptor', () => {
    it('should add an interceptor', () => {
      const interceptor: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockImplementation((_ctx, next) => next()),
      };
      dispatcher.addInterceptor(interceptor);
      expect(dispatcher.getInterceptors()).toHaveLength(1);
    });

    it('should support chaining', () => {
      const interceptor: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockImplementation((_ctx, next) => next()),
      };
      const result = dispatcher.addInterceptor(interceptor);
      expect(result).toBe(dispatcher);
    });
  });

  describe('execute — layer ordering', () => {
    it('should execute layers in order', async () => {
      const order: string[] = [];
      const layers = ['l1', 'l2', 'l3'].map((id) => {
        const layer = makeLayer(id, `Layer ${id}`);
        (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          order.push(id);
          return {
            layerId: id,
            layerName: `Layer ${id}`,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        return layer;
      });
      layers.forEach((l) => {
        dispatcher.addLayer(l);
      });

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(order).toEqual(['l1', 'l2', 'l3']);
      expect(ctx.layerResults).toHaveLength(3);
    });
  });

  describe('execute — fail-fast for layers 0-3', () => {
    it('should stop on layer failure at index 0', async () => {
      const layer0 = makeLayer('l0', 'Layer 0', { passed: false });
      const layer1 = makeLayer('l1', 'Layer 1');
      const layer2 = makeLayer('l2', 'Layer 2');
      dispatcher.addLayer(layer0).addLayer(layer1).addLayer(layer2);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(ctx.failed).toBe(true);
      expect(ctx.error).toBeDefined();
      expect(ctx.layerResults).toHaveLength(1);
      expect(layer1.execute).not.toHaveBeenCalled();
    });

    it('should stop on layer failure at index 3', async () => {
      dispatcher.addLayer(makeLayer('l0', 'L0'));
      dispatcher.addLayer(makeLayer('l1', 'L1'));
      dispatcher.addLayer(makeLayer('l2', 'L2'));
      dispatcher.addLayer(makeLayer('l3', 'L3', { passed: false }));
      dispatcher.addLayer(makeLayer('l4', 'L4'));

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(ctx.failed).toBe(true);
      expect(ctx.layerResults).toHaveLength(4);
    });

    it('should set error message from layer failure', async () => {
      dispatcher.addLayer(makeLayer('l0', 'DNA', { passed: false, error: 'Invalid DNA' }));

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(ctx.failed).toBe(true);
      expect(ctx.error?.message).toBe('Invalid DNA');
    });

    it('should use default error message when none provided', async () => {
      const layer = makeLayer('l0', 'Schema');
      (layer.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        layerId: 'l0',
        layerName: 'Schema',
        passed: false,
        score: 0,
        duration: 1,
        details: {},
      });
      dispatcher.addLayer(layer);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(ctx.error?.message).toBe('Layer Schema failed');
    });
  });

  describe('execute — skip layers 4-6 on early failure', () => {
    it('should break out of the loop on early structural failure (index < 3)', async () => {
      const executed: string[] = [];

      const failLayer = makeLayer('l0', 'L0', { passed: false });
      (failLayer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executed.push('l0');
        return {
          layerId: 'l0',
          layerName: 'L0',
          passed: false,
          score: 0,
          duration: 1,
          details: {},
          error: 'L0 failed',
        };
      });
      dispatcher.addLayer(failLayer);

      // These layers should never execute due to break at i < 4
      for (let i = 1; i <= 9; i++) {
        const layer = makeLayer(`l${i}`, `L${i}`);
        dispatcher.addLayer(layer);
      }

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(executed).toEqual(['l0']);
      expect(ctx.layerResults).toHaveLength(1);
      expect(ctx.failed).toBe(true);
    });

    it('should skip layers at index 4-6 when last structural layer (index 3) fails', async () => {
      const executed: string[] = [];

      // Layers 0-2 pass
      for (let i = 0; i < 3; i++) {
        const layer = makeLayer(`l${i}`, `L${i}`);
        (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          executed.push(`l${i}`);
          return {
            layerId: `l${i}`,
            layerName: `L${i}`,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        dispatcher.addLayer(layer);
      }

      // Layer 3 fails (last structural layer, sets context.failed)
      const failLayer = makeLayer('l3', 'L3', { passed: false });
      (failLayer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executed.push('l3');
        return {
          layerId: 'l3',
          layerName: 'L3',
          passed: false,
          score: 0,
          duration: 1,
          details: {},
          error: 'L3 failed',
        };
      });
      dispatcher.addLayer(failLayer);

      // Layers 4-6 should be skipped (i >= 4 && i < 7 && context.failed)
      const l4 = makeLayer('l4', 'L4');
      const l5 = makeLayer('l5', 'L5');
      const l6 = makeLayer('l6', 'L6');
      [l4, l5, l6].forEach((l) => {
        (l.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          executed.push(l.id);
          return {
            layerId: l.id,
            layerName: l.name,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
      });
      dispatcher.addLayer(l4).addLayer(l5).addLayer(l6);

      // Layers 7-9 should still execute (never-block)
      for (let i = 7; i <= 9; i++) {
        const layer = makeLayer(`l${i}`, `L${i}`);
        (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          executed.push(`l${i}`);
          return {
            layerId: `l${i}`,
            layerName: `L${i}`,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        dispatcher.addLayer(layer);
      }

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(executed).toEqual(['l0', 'l1', 'l2', 'l3', 'l7', 'l8', 'l9']);
      expect(ctx.failed).toBe(true);
      expect(ctx.error).toBeDefined();
    });
  });

  describe('execute — never-block layers 7-9', () => {
    it('should execute layers at index 7-9 even after structural failure at index 3', async () => {
      const executed: string[] = [];

      // Layers 0-2 pass
      for (let i = 0; i < 3; i++) {
        const layer = makeLayer(`l${i}`, `L${i}`);
        (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          executed.push(`l${i}`);
          return {
            layerId: `l${i}`,
            layerName: `L${i}`,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        dispatcher.addLayer(layer);
      }

      // Layer 3 fails (last structural layer)
      const failLayer = makeLayer('l3', 'L3', { passed: false });
      (failLayer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        executed.push('l3');
        return {
          layerId: 'l3',
          layerName: 'L3',
          passed: false,
          score: 0,
          duration: 1,
          details: {},
          error: 'L3 failed',
        };
      });
      dispatcher.addLayer(failLayer);

      // Layers 4-6: skipped (index 4-6 with context.failed)
      const l4 = makeLayer('l4', 'L4');
      const l5 = makeLayer('l5', 'L5');
      const l6 = makeLayer('l6', 'L6');
      [l4, l5, l6].forEach((l) => {
        (l.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          executed.push(l.id);
          return {
            layerId: l.id,
            layerName: l.name,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
      });
      dispatcher.addLayer(l4).addLayer(l5).addLayer(l6);

      // Layers 7-9: never-block (should execute regardless of failure)
      const neverBlock1 = makeLayer('l7', 'Audit');
      const neverBlock2 = makeLayer('l8', 'Mission');
      const neverBlock3 = makeLayer('l9', 'Learning');

      [neverBlock1, neverBlock2, neverBlock3].forEach((l) => {
        (l.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          executed.push(l.id);
          return {
            layerId: l.id,
            layerName: l.name,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        dispatcher.addLayer(l);
      });

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(executed).toContain('l0');
      expect(executed).toContain('l3');
      expect(executed).toContain('l7');
      expect(executed).toContain('l8');
      expect(executed).toContain('l9');
      // l4, l5, l6 should be skipped
      expect(executed).not.toContain('l4');
      expect(executed).not.toContain('l5');
      expect(executed).not.toContain('l6');
    });
  });

  describe('execute — shouldExecute', () => {
    it('should skip layers when shouldExecute returns false', async () => {
      const layer = makeLayer('l1', 'Layer 1', {
        shouldExecute: () => false,
      });
      const fallback = makeLayer('l2', 'Layer 2');
      dispatcher.addLayer(layer).addLayer(fallback);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(layer.execute).not.toHaveBeenCalled();
      expect(fallback.execute).toHaveBeenCalled();
      expect(ctx.layerResults).toHaveLength(1);
    });

    it('should execute layers when shouldExecute returns true', async () => {
      const layer = makeLayer('l1', 'Layer 1', {
        shouldExecute: () => true,
      });
      dispatcher.addLayer(layer);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(layer.execute).toHaveBeenCalled();
    });
  });

  describe('execute — interceptors', () => {
    it('should apply a single interceptor', async () => {
      const order: string[] = [];
      const interceptor: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockImplementation(async (_ctx, next) => {
          order.push('interceptor-before');
          const result = await next();
          order.push('interceptor-after');
          return result;
        }),
      };

      const layer = makeLayer('l1', 'Layer 1');
      (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push('layer');
        return {
          layerId: 'l1',
          layerName: 'Layer 1',
          passed: true,
          score: 100,
          duration: 1,
          details: {},
        };
      });

      dispatcher.addInterceptor(interceptor).addLayer(layer);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(order).toEqual(['interceptor-before', 'layer', 'interceptor-after']);
    });

    it('should chain multiple interceptors in order', async () => {
      const order: string[] = [];

      const interceptor1: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockImplementation(async (_ctx, next) => {
          order.push('i1-before');
          const result = await next();
          order.push('i1-after');
          return result;
        }),
      };

      const interceptor2: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockImplementation(async (_ctx, next) => {
          order.push('i2-before');
          const result = await next();
          order.push('i2-after');
          return result;
        }),
      };

      const layer = makeLayer('l1', 'Layer 1');
      (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        order.push('layer');
        return {
          layerId: 'l1',
          layerName: 'Layer 1',
          passed: true,
          score: 100,
          duration: 1,
          details: {},
        };
      });

      dispatcher.addInterceptor(interceptor1).addInterceptor(interceptor2).addLayer(layer);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(order).toEqual(['i1-before', 'i2-before', 'layer', 'i2-after', 'i1-after']);
    });

    it('should allow interceptor to short-circuit execution', async () => {
      const interceptor: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockResolvedValue({
          layerId: 'blocked',
          layerName: 'Blocked',
          passed: false,
          score: 0,
          duration: 0,
          details: { blocked: true },
          error: 'Blocked by interceptor',
        }),
      };

      const layer = makeLayer('l1', 'Layer 1');
      dispatcher.addInterceptor(interceptor).addLayer(layer);

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(layer.execute).not.toHaveBeenCalled();
      expect(ctx.layerResults[0].error).toBe('Blocked by interceptor');
    });
  });

  describe('execute — mode adapters', () => {
    it('should execute all layers in transactional mode', async () => {
      const order: string[] = [];
      ['l0', 'l1', 'l2', 'l3'].forEach((id) => {
        const layer = makeLayer(id, id);
        (layer.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          order.push(id);
          return { layerId: id, layerName: id, passed: true, score: 100, duration: 1, details: {} };
        });
        dispatcher.addLayer(layer);
      });

      const ctx = makeContext({ dnaMode: 'transactional' });
      await dispatcher.execute(ctx);

      expect(order).toEqual(['l0', 'l1', 'l2', 'l3']);
      expect(ctx.layerResults).toHaveLength(4);
    });

    it('should handle conversational mode with shouldExecute gating', async () => {
      const order: string[] = [];

      const layers: PipelineDispatcherLayer[] = [
        makeLayer('l0', 'L0', { shouldExecute: () => true }),
        makeLayer('l1', 'L1', { shouldExecute: (ctx) => ctx.dnaMode !== 'conversational' }),
        makeLayer('l2', 'L2', { shouldExecute: () => true }),
      ];

      layers.forEach((l) => {
        (l.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          order.push(l.id);
          return {
            layerId: l.id,
            layerName: l.name,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        dispatcher.addLayer(l);
      });

      const ctx = makeContext({ dnaMode: 'conversational' });
      await dispatcher.execute(ctx);

      expect(order).toEqual(['l0', 'l2']);
      expect(ctx.layerResults).toHaveLength(2);
    });

    it('should handle hybrid mode with shouldExecute gating', async () => {
      const order: string[] = [];

      const layers: PipelineDispatcherLayer[] = [
        makeLayer('l0', 'L0', { shouldExecute: () => true }),
        makeLayer('l1', 'L1', { shouldExecute: (ctx) => ctx.dnaMode !== 'conversational' }),
        makeLayer('l2', 'L2', { shouldExecute: () => true }),
      ];

      layers.forEach((l) => {
        (l.execute as ReturnType<typeof vi.fn>).mockImplementation(async () => {
          order.push(l.id);
          return {
            layerId: l.id,
            layerName: l.name,
            passed: true,
            score: 100,
            duration: 1,
            details: {},
          };
        });
        dispatcher.addLayer(l);
      });

      const ctx = makeContext({ dnaMode: 'hybrid' });
      await dispatcher.execute(ctx);

      expect(order).toEqual(['l0', 'l1', 'l2']);
      expect(ctx.layerResults).toHaveLength(3);
    });
  });

  describe('execute — context state', () => {
    it('should populate layerResults on success', async () => {
      dispatcher.addLayer(makeLayer('l1', 'Layer 1'));
      dispatcher.addLayer(makeLayer('l2', 'Layer 2'));

      const ctx = makeContext();
      await dispatcher.execute(ctx);

      expect(ctx.failed).toBe(false);
      expect(ctx.error).toBeUndefined();
      expect(ctx.layerResults).toHaveLength(2);
    });

    it('should preserve context metadata', async () => {
      dispatcher.addLayer(makeLayer('l1', 'Layer 1'));

      const metadata = new Map([['key', 'value']]);
      const ctx = makeContext({ metadata });
      await dispatcher.execute(ctx);

      expect(ctx.metadata.get('key')).toBe('value');
    });
  });

  describe('getLayers / getInterceptors — defensive copy', () => {
    it('should return a copy of layers array', () => {
      dispatcher.addLayer(makeLayer('l1', 'Layer 1'));
      const layers = dispatcher.getLayers();
      layers.push(makeLayer('l2', 'Layer 2'));
      expect(dispatcher.getLayers()).toHaveLength(1);
    });

    it('should return a copy of interceptors array', () => {
      const interceptor: PipelineDispatcherInterceptor = {
        intercept: vi.fn().mockImplementation((_ctx, next) => next()),
      };
      dispatcher.addInterceptor(interceptor);
      const interceptors = dispatcher.getInterceptors();
      interceptors.push({
        intercept: vi.fn().mockImplementation((_ctx, next) => next()),
      });
      expect(dispatcher.getInterceptors()).toHaveLength(1);
    });
  });
});
