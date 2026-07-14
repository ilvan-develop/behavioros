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

  describe('collectBrocolisMetrics', () => {
    it('should return Brocolis metrics with all required fields', async () => {
      const metrics = await collector.collectBrocolisMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.orders).toBeDefined();
      expect(metrics.prescriptions).toBeDefined();
      expect(metrics.deliveries).toBeDefined();
      expect(metrics.users).toBeDefined();
      expect(metrics.api).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should return numeric values for orders', async () => {
      const metrics = await collector.collectBrocolisMetrics();

      expect(typeof metrics.orders.total).toBe('number');
      expect(typeof metrics.orders.pending).toBe('number');
      expect(typeof metrics.orders.completed).toBe('number');
      expect(typeof metrics.orders.cancelled).toBe('number');
      expect(typeof metrics.orders.revenue).toBe('number');
    });

    it('should return numeric values for prescriptions', async () => {
      const metrics = await collector.collectBrocolisMetrics();

      expect(typeof metrics.prescriptions.uploaded).toBe('number');
      expect(typeof metrics.prescriptions.verified).toBe('number');
      expect(typeof metrics.prescriptions.rejected).toBe('number');
    });

    it('should return numeric values for deliveries', async () => {
      const metrics = await collector.collectBrocolisMetrics();

      expect(typeof metrics.deliveries.active).toBe('number');
      expect(typeof metrics.deliveries.completed).toBe('number');
      expect(typeof metrics.deliveries.failed).toBe('number');
    });

    it('should return numeric values for users', async () => {
      const metrics = await collector.collectBrocolisMetrics();

      expect(typeof metrics.users.active).toBe('number');
      expect(typeof metrics.users.new).toBe('number');
      expect(typeof metrics.users.churned).toBe('number');
    });

    it('should return numeric values for api', async () => {
      const metrics = await collector.collectBrocolisMetrics();

      expect(typeof metrics.api.latency).toBe('number');
      expect(typeof metrics.api.errorRate).toBe('number');
      expect(typeof metrics.api.throughput).toBe('number');
    });
  });

  describe('collectFinPayMetrics', () => {
    it('should return FinPay metrics with all required fields', async () => {
      const metrics = await collector.collectFinPayMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.payments).toBeDefined();
      expect(metrics.trust).toBeDefined();
      expect(metrics.fraud).toBeDefined();
      expect(metrics.compliance).toBeDefined();
      expect(metrics.ocr).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
    });

    it('should return numeric values for payments', async () => {
      const metrics = await collector.collectFinPayMetrics();

      expect(typeof metrics.payments.total).toBe('number');
      expect(typeof metrics.payments.approved).toBe('number');
      expect(typeof metrics.payments.rejected).toBe('number');
      expect(typeof metrics.payments.pendingReview).toBe('number');
    });

    it('should return trust score distribution', async () => {
      const metrics = await collector.collectFinPayMetrics();

      expect(typeof metrics.trust.avgScore).toBe('number');
      expect(metrics.trust.distribution).toBeDefined();
      expect(typeof metrics.trust.distribution.low).toBe('number');
      expect(typeof metrics.trust.distribution.medium).toBe('number');
      expect(typeof metrics.trust.distribution.high).toBe('number');
    });

    it('should return fraud metrics', async () => {
      const metrics = await collector.collectFinPayMetrics();

      expect(typeof metrics.fraud.detected).toBe('number');
      expect(typeof metrics.fraud.falsePositives).toBe('number');
      expect(typeof metrics.fraud.truePositives).toBe('number');
    });

    it('should return compliance metrics', async () => {
      const metrics = await collector.collectFinPayMetrics();

      expect(typeof metrics.compliance.passed).toBe('number');
      expect(typeof metrics.compliance.violations).toBe('number');
    });

    it('should return OCR metrics', async () => {
      const metrics = await collector.collectFinPayMetrics();

      expect(typeof metrics.ocr.accuracy).toBe('number');
      expect(typeof metrics.ocr.processingTime).toBe('number');
    });
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
    it('should return unified metrics from all platforms', async () => {
      const unified = await collector.collectAll();

      expect(unified).toBeDefined();
      expect(unified.brocolis).toBeDefined();
      expect(unified.finpay).toBeDefined();
      expect(unified.behavioros).toBeDefined();
      expect(unified.timestamp).toBeDefined();
    });

    it('should have valid ISO timestamp', async () => {
      const unified = await collector.collectAll();
      const parsed = new Date(unified.timestamp);

      expect(parsed.getTime()).not.toBeNaN();
    });

    it('should call all collection methods', async () => {
      const unified = await collector.collectAll();

      expect(unified.brocolis.orders).toBeDefined();
      expect(unified.finpay.payments).toBeDefined();
      expect(unified.behavioros.pipeline).toBeDefined();
    });
  });

  describe('constructor', () => {
    it('should accept custom config', () => {
      const custom = new MetricsCollector({
        brocolisApiUrl: 'http://localhost:3000',
        finpayApiUrl: 'http://localhost:4000',
      });

      expect(custom).toBeDefined();
    });

    it('should work with empty config', () => {
      const defaultCollector = new MetricsCollector();
      expect(defaultCollector).toBeDefined();
    });
  });
});
