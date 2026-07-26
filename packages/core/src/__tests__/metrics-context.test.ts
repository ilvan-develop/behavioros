import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricsCollector } from '../pipeline/telemetry/metrics';
import { MetricsContext } from '../pipeline/telemetry/metrics-context';

describe('MetricsContext', () => {
  let collector: MetricsCollector;
  let ctx: MetricsContext;

  beforeEach(() => {
    vi.useFakeTimers();
    collector = new MetricsCollector();
    ctx = new MetricsContext(collector);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startStep', () => {
    it('should record duration when finish is called', () => {
      const finish = ctx.startStep('compute');
      vi.advanceTimersByTime(50);
      finish();

      const metrics = collector.getMetrics();
      expect(metrics.executions).toBe(1);
      expect(metrics.successes).toBe(1);
    });

    it('should measure elapsed time approximately', () => {
      const finish = ctx.startStep('db-query');
      const elapsed = 30;
      vi.advanceTimersByTime(elapsed);
      finish();

      const metrics = collector.getMetrics();
      const layerEntry = metrics.layerMetrics.get('db-query');
      expect(layerEntry).toBeDefined();
      expect(layerEntry!.count).toBe(1);
      expect(layerEntry!.avgLatency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('countStep', () => {
    it('should increment a counter', () => {
      ctx.countStep('api-calls');
      ctx.countStep('api-calls');
      ctx.countStep('api-calls');

      expect(ctx.getCounter('api-calls')).toBe(3);
    });

    it('should support custom increment values', () => {
      ctx.countStep('batch-import', 10);
      expect(ctx.getCounter('batch-import')).toBe(10);
    });

    it('should accumulate multiple step counters independently', () => {
      ctx.countStep('a', 2);
      ctx.countStep('b', 5);
      ctx.countStep('a', 3);

      expect(ctx.getCounter('a')).toBe(5);
      expect(ctx.getCounter('b')).toBe(5);
    });
  });

  describe('pipeline', () => {
    it('should record all pipeline stages', () => {
      const queueStats = { pending: 3, running: 1 };
      const knowledgeStats = { chunks: 150, embeddings: 1200 };

      ctx.pipeline(
        'chat',
        ['understand', 'respond'],
        'step1',
        'default',
        queueStats,
        knowledgeStats,
        250,
      );

      const metrics = collector.getMetrics();
      expect(metrics.executions).toBe(1);

      expect(ctx.getCounter('pipeline.executions')).toBe(1);
      expect(ctx.getCounter('pipeline.goals')).toBe(2);
      expect(ctx.getCounter('pipeline.queue')).toBe(2);
      expect(ctx.getCounter('pipeline.knowledge')).toBe(2);
    });
  });

  describe('without MetricsCollector', () => {
    it('should work gracefully as a no-op', () => {
      const solo = new MetricsContext();

      expect(() => {
        const finish = solo.startStep('step-1');
        finish();
        solo.countStep('test', 5);
        solo.recordDuration('x', 100);
        solo.pipeline('test', [], '', '', {}, {}, 0);
      }).not.toThrow();

      expect(solo.getCounter('test')).toBe(5);
    });
  });

  describe('multiple steps', () => {
    it('should accumulate correctly', () => {
      const f1 = ctx.startStep('load');
      vi.advanceTimersByTime(10);
      f1();

      ctx.countStep('items', 5);

      const f2 = ctx.startStep('transform');
      vi.advanceTimersByTime(20);
      f2();

      ctx.countStep('items', 3);

      const f3 = ctx.startStep('save');
      vi.advanceTimersByTime(30);
      f3();

      const metrics = collector.getMetrics();
      expect(metrics.executions).toBe(3);
      expect(metrics.successes).toBe(3);

      expect(ctx.getCounter('items')).toBe(8);

      const allCounters = ctx.getAllCounters();
      expect(allCounters.items).toBe(8);
    });
  });
});
