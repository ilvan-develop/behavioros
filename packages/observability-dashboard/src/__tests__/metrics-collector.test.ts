import { beforeEach, describe, expect, it } from 'vitest';
import { MetricsCollector } from '../metrics-collector';

// ============================================================
// Metrics Collector Tests
// ============================================================

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('collectBehaviorOSMetrics', () => {
    it('should return BehaviorOS metrics with all required fields', async () => {
      const metrics = await collector.collectBehaviorOSMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.pipeline).toBeDefined();
      expect(metrics.layers).toBeDefined();
      expect(metrics.governance).toBeDefined();
      expect(metrics.quality).toBeDefined();
      expect(metrics.learning).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should return pipeline metrics', async () => {
      const metrics = await collector.collectBehaviorOSMetrics();

      expect(typeof metrics.pipeline.active).toBe('number');
      expect(typeof metrics.pipeline.completed).toBe('number');
      expect(typeof metrics.pipeline.failed).toBe('number');
    });

    it('should return layer metrics', async () => {
      const metrics = await collector.collectBehaviorOSMetrics();

      expect(typeof metrics.layers.passed).toBe('number');
      expect(typeof metrics.layers.failed).toBe('number');
      expect(typeof metrics.layers.pending).toBe('number');
    });

    it('should return governance metrics', async () => {
      const metrics = await collector.collectBehaviorOSMetrics();

      expect(typeof metrics.governance.blocked).toBe('number');
      expect(typeof metrics.governance.escalated).toBe('number');
      expect(typeof metrics.governance.approved).toBe('number');
    });

    it('should return quality metrics', async () => {
      const metrics = await collector.collectBehaviorOSMetrics();

      expect(typeof metrics.quality.coverage).toBe('number');
      expect(typeof metrics.quality.lintPass).toBe('boolean');
      expect(typeof metrics.quality.typecheckPass).toBe('boolean');
    });

    it('should return learning metrics', async () => {
      const metrics = await collector.collectBehaviorOSMetrics();

      expect(typeof metrics.learning.events).toBe('number');
      expect(typeof metrics.learning.patterns).toBe('number');
      expect(typeof metrics.learning.autoFixes).toBe('number');
    });
  });

  describe('collectAll', () => {
    it('should return unified metrics from BehaviorOS', async () => {
      const unified = await collector.collectAll();

      expect(unified).toBeDefined();
      expect(unified.behavioros).toBeDefined();
      expect(unified.timestamp).toBeDefined();
    });

    it('should have valid ISO timestamp', async () => {
      const unified = await collector.collectAll();
      const parsed = new Date(unified.timestamp);

      expect(parsed.getTime()).not.toBeNaN();
    });

    it('should populate behavioros metrics', async () => {
      const unified = await collector.collectAll();

      expect(unified.behavioros.pipeline).toBeDefined();
      expect(unified.behavioros.layers).toBeDefined();
      expect(unified.behavioros.governance).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should work with empty config', () => {
      const defaultCollector = new MetricsCollector();
      expect(defaultCollector).toBeDefined();
    });
  });
});
