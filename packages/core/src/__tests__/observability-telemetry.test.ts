import { beforeEach, describe, expect, it } from 'vitest';
import { AIMetrics } from '../engines/observability/ai-metrics';
import { CostMetrics } from '../engines/observability/cost-metrics';
import { TelemetryEngine } from '../engines/observability/telemetry-engine';

describe('TelemetryEngine', () => {
  let engine: TelemetryEngine;

  beforeEach(() => {
    engine = new TelemetryEngine();
  });

  describe('collect()', () => {
    it('should return an empty batch when nothing recorded', () => {
      const batch = engine.collect();
      expect(batch.metrics).toHaveLength(0);
      expect(batch.traces).toHaveLength(0);
      expect(batch.logs).toHaveLength(0);
    });

    it('should return recorded metrics in the batch', () => {
      engine.recordMetric('cpu_usage', 85.5, { host: 'server-1' });
      const batch = engine.collect();
      expect(batch.metrics).toHaveLength(1);
      expect(batch.metrics[0].name).toBe('cpu_usage');
      expect(batch.metrics[0].value).toBe(85.5);
      expect(batch.metrics[0].labels.host).toBe('server-1');
    });

    it('should return recorded traces in the batch', () => {
      engine.recordTrace('trace-1', [{ id: 'span-1' }]);
      const batch = engine.collect();
      expect(batch.traces).toHaveLength(1);
      expect(batch.traces[0].traceId).toBe('trace-1');
      expect(batch.traces[0].spans).toHaveLength(1);
    });

    it('should return recorded logs in the batch', () => {
      engine.recordLog('info', 'server started');
      const batch = engine.collect();
      expect(batch.logs).toHaveLength(1);
      expect(batch.logs[0].level).toBe('info');
      expect(batch.logs[0].message).toBe('server started');
    });
  });

  describe('export()', () => {
    it('should export as JSON by default', () => {
      engine.recordMetric('memory', 2048);
      const output = engine.export();
      const parsed = JSON.parse(output);
      expect(parsed.metrics).toHaveLength(1);
      expect(parsed.metrics[0].name).toBe('memory');
    });

    it('should export as OTLP format', () => {
      engine.recordMetric('cpu', 50);
      engine.recordTrace('trace-x', []);
      engine.recordLog('warn', 'high memory');
      const output = engine.export('otlp');
      const parsed = JSON.parse(output);
      expect(parsed.resourceMetrics).toHaveLength(1);
      expect(parsed.resourceSpans).toHaveLength(1);
      expect(parsed.resourceLogs).toHaveLength(1);
    });
  });

  describe('clear()', () => {
    it('should remove all recorded data', () => {
      engine.recordMetric('cpu', 10);
      engine.recordTrace('t1', []);
      engine.recordLog('info', 'test');
      engine.clear();
      expect(engine.getSize()).toBe(0);
    });
  });

  describe('getSize()', () => {
    it('should return the total number of items', () => {
      engine.recordMetric('cpu', 1);
      engine.recordMetric('mem', 2);
      engine.recordTrace('t1', []);
      engine.recordLog('info', 'log1');
      expect(engine.getSize()).toBe(4);
    });
  });
});

describe('AIMetrics', () => {
  let metrics: AIMetrics;

  beforeEach(() => {
    metrics = new AIMetrics();
  });

  describe('recordRequest() and getModelMetrics()', () => {
    it('should record and retrieve metrics for a model', () => {
      metrics.recordRequest('gpt-4', 100, 50, 200, 0.05, true);
      const m = metrics.getModelMetrics('gpt-4');
      expect(m).toBeDefined();
      expect(m!.modelId).toBe('gpt-4');
      expect(m!.totalTokens).toBe(150);
      expect(m!.requestCount).toBe(1);
      expect(m!.errorCount).toBe(0);
    });

    it('should return undefined for unknown model', () => {
      expect(metrics.getModelMetrics('unknown')).toBeUndefined();
    });

    it('should calculate aggregated metrics across requests', () => {
      metrics.recordRequest('gpt-4', 100, 50, 200, 0.05, true);
      metrics.recordRequest('gpt-4', 200, 100, 400, 0.1, true);
      const m = metrics.getModelMetrics('gpt-4');
      expect(m!.totalTokens).toBe(450);
      expect(m!.inputTokens).toBe(300);
      expect(m!.outputTokens).toBe(150);
      expect(m!.totalCost).toBeCloseTo(0.15);
      expect(m!.requestCount).toBe(2);
      expect(m!.avgLatency).toBe(300);
    });
  });

  describe('getAllMetrics()', () => {
    it('should return metrics for all models', () => {
      metrics.recordRequest('gpt-4', 10, 5, 100, 0.01, true);
      metrics.recordRequest('claude-3', 20, 10, 200, 0.02, true);
      const all = metrics.getAllMetrics();
      expect(all).toHaveLength(2);
      expect(all.map((m) => m.modelId).sort()).toEqual(['claude-3', 'gpt-4']);
    });
  });

  describe('getErrorRate()', () => {
    it('should return error rate for a model', () => {
      metrics.recordRequest('gpt-4', 10, 5, 100, 0.01, true);
      metrics.recordRequest('gpt-4', 10, 5, 100, 0.01, false);
      metrics.recordRequest('gpt-4', 10, 5, 100, 0.01, false);
      expect(metrics.getErrorRate('gpt-4')).toBeCloseTo(2 / 3);
    });

    it('should return 0 for unknown model', () => {
      expect(metrics.getErrorRate('unknown')).toBe(0);
    });
  });

  describe('getAverageLatency()', () => {
    it('should return average latency for a model', () => {
      metrics.recordRequest('gpt-4', 10, 5, 100, 0.01, true);
      metrics.recordRequest('gpt-4', 10, 5, 300, 0.01, true);
      expect(metrics.getAverageLatency('gpt-4')).toBe(200);
    });

    it('should return 0 for unknown model', () => {
      expect(metrics.getAverageLatency('unknown')).toBe(0);
    });
  });
});

describe('CostMetrics', () => {
  let cost: CostMetrics;

  beforeEach(() => {
    cost = new CostMetrics();
  });

  describe('record() and getTotalCost()', () => {
    it('should record entries and calculate total cost', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'claude-3',
        provider: 'anthropic',
        taskType: 'chat',
        cost: 0.08,
        tokens: 200,
      });
      expect(cost.getTotalCost()).toBeCloseTo(0.13);
    });

    it('should filter total cost by modelId', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'claude-3',
        provider: 'anthropic',
        taskType: 'chat',
        cost: 0.08,
        tokens: 200,
      });
      expect(cost.getTotalCost('gpt-4')).toBeCloseTo(0.05);
    });

    it('should filter total cost by provider', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'gpt-3.5',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.02,
        tokens: 100,
      });
      cost.record({
        modelId: 'claude-3',
        provider: 'anthropic',
        taskType: 'chat',
        cost: 0.08,
        tokens: 200,
      });
      expect(cost.getTotalCost(undefined, 'openai')).toBeCloseTo(0.07);
    });
  });

  describe('getCostByModel()', () => {
    it('should return cost broken down by model', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.03,
        tokens: 100,
      });
      cost.record({
        modelId: 'claude-3',
        provider: 'anthropic',
        taskType: 'chat',
        cost: 0.08,
        tokens: 200,
      });
      const byModel = cost.getCostByModel();
      expect(byModel['gpt-4']).toBeCloseTo(0.08);
      expect(byModel['claude-3']).toBeCloseTo(0.08);
    });
  });

  describe('getCostByProvider()', () => {
    it('should return cost broken down by provider', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'claude-3',
        provider: 'anthropic',
        taskType: 'chat',
        cost: 0.08,
        tokens: 200,
      });
      cost.record({
        modelId: 'sonnet',
        provider: 'anthropic',
        taskType: 'code',
        cost: 0.12,
        tokens: 300,
      });
      const byProvider = cost.getCostByProvider();
      expect(byProvider.openai).toBeCloseTo(0.05);
      expect(byProvider.anthropic).toBeCloseTo(0.2);
    });
  });

  describe('getCostByTask()', () => {
    it('should return cost broken down by task type', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'code',
        cost: 0.1,
        tokens: 300,
      });
      const byTask = cost.getCostByTask();
      expect(byTask.chat).toBeCloseTo(0.05);
      expect(byTask.code).toBeCloseTo(0.1);
    });
  });

  describe('getDailyCost()', () => {
    it('should return daily cost breakdown', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.03,
        tokens: 100,
      });
      const daily = cost.getDailyCost(3);
      expect(daily).toHaveLength(3);
      const today = new Date().toISOString().slice(0, 10);
      expect(daily.find((d) => d.date === today)!.cost).toBeCloseTo(0.08);
    });
  });

  describe('forecast()', () => {
    it('should return 0 when no data', () => {
      expect(cost.forecast(30)).toBe(0);
    });

    it('should project cost based on daily average', () => {
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.05,
        tokens: 150,
      });
      cost.record({
        modelId: 'gpt-4',
        provider: 'openai',
        taskType: 'chat',
        cost: 0.03,
        tokens: 100,
      });
      const forecast = cost.forecast(30);
      expect(forecast).toBeGreaterThan(0);
    });
  });
});
