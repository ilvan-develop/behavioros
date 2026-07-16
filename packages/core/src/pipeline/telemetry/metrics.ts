export interface LayerMetricEntry {
  count: number;
  avgLatency: number;
  errors: number;
}

export interface PipelineMetrics {
  executions: number;
  successes: number;
  failures: number;
  avgLatency: number;
  p99Latency: number;
  layerMetrics: Map<string, LayerMetricEntry>;
}

export class MetricsCollector {
  private metrics: PipelineMetrics = {
    executions: 0,
    successes: 0,
    failures: 0,
    avgLatency: 0,
    p99Latency: 0,
    layerMetrics: new Map(),
  };

  private latencies: number[] = [];

  recordExecution(duration: number, success: boolean, layerTimings: Map<string, number>) {
    this.metrics.executions++;
    if (success) this.metrics.successes++;
    else this.metrics.failures++;

    this.latencies.push(duration);
    this.updateLatencies();

    for (const [layerId, layerDuration] of layerTimings) {
      const existing = this.metrics.layerMetrics.get(layerId) || {
        count: 0,
        avgLatency: 0,
        errors: 0,
      };
      existing.count++;
      existing.avgLatency =
        (existing.avgLatency * (existing.count - 1) + layerDuration) / existing.count;
      if (!success) existing.errors++;
      this.metrics.layerMetrics.set(layerId, existing);
    }
  }

  getMetrics(): PipelineMetrics {
    return {
      ...this.metrics,
      layerMetrics: new Map(this.metrics.layerMetrics),
    };
  }

  reset() {
    this.metrics = {
      executions: 0,
      successes: 0,
      failures: 0,
      avgLatency: 0,
      p99Latency: 0,
      layerMetrics: new Map(),
    };
    this.latencies = [];
  }

  private updateLatencies() {
    if (this.latencies.length === 0) return;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.metrics.avgLatency = sum / this.latencies.length;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p99Index = Math.ceil(sorted.length * 0.99) - 1;
    this.metrics.p99Latency = sorted[Math.max(0, p99Index)];
  }
}
