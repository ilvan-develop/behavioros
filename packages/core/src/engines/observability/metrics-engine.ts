/**
 * MetricType — Union type: counter, gauge, histogram, timer;.
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/**
 * Metric — Configuration and options interface.
 */
export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

/**
 * MetricsEngine — Provides increment, gauge, observe, timer, ... operations.
 */
export class MetricsEngine {
  private metrics = new Map<string, Metric[]>();

  increment(name: string, value = 1, labels: Record<string, string> = {}): void {
    const entry: Metric = {
      name,
      type: 'counter',
      value,
      labels,
      timestamp: new Date().toISOString(),
    };
    this.push(name, entry);
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const entry: Metric = {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: new Date().toISOString(),
    };
    this.push(name, entry);
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const entry: Metric = {
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: new Date().toISOString(),
    };
    this.push(name, entry);
  }

  async timer(
    name: string,
    fn: () => Promise<unknown>,
    labels: Record<string, string> = {},
  ): Promise<number> {
    const start = performance.now();
    try {
      await fn();
    } catch {
      // swallow error — metric is recorded regardless
    } finally {
      const elapsed = performance.now() - start;
      const entry: Metric = {
        name,
        type: 'timer',
        value: elapsed,
        labels,
        timestamp: new Date().toISOString(),
      };
      this.push(name, entry);
    }
    return performance.now() - start;
  }

  getMetric(name: string): Metric[] {
    return this.metrics.get(name) ?? [];
  }

  getAll(): Record<string, Metric[]> {
    const result: Record<string, Metric[]> = {};
    for (const [key, values] of this.metrics) {
      result[key] = [...values];
    }
    return result;
  }

  reset(name?: string): void {
    if (name) {
      this.metrics.delete(name);
    } else {
      this.metrics.clear();
    }
  }

  private push(name: string, entry: Metric): void {
    const existing = this.metrics.get(name);
    if (existing) {
      existing.push(entry);
    } else {
      this.metrics.set(name, [entry]);
    }
  }
}
