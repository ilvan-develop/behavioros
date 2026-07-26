import type { MetricsCollector } from './metrics';

export class MetricsContext {
  private collector: MetricsCollector | null;
  private counters = new Map<string, number>();

  constructor(collector?: MetricsCollector) {
    this.collector = collector ?? null;
  }

  startStep(stepName: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordDuration(stepName, duration);
    };
  }

  countStep(stepName: string, count = 1): void {
    const current = this.counters.get(stepName) ?? 0;
    this.counters.set(stepName, current + count);
  }

  recordDuration(step: string, durationMs: number): void {
    if (!this.collector) return;
    const timings = new Map<string, number>();
    timings.set(step, durationMs);
    this.collector.recordExecution(durationMs, true, timings);
  }

  pipeline(
    intent: string,
    goals: string[],
    plan: string,
    workflow: string,
    queueStats: Record<string, unknown>,
    knowledgeStats: Record<string, unknown>,
    totalDuration: number,
  ): void {
    this.recordDuration(`pipeline.${intent}`, totalDuration);
    this.countStep('pipeline.executions');
    this.countStep('pipeline.goals', goals.length);
    this.countStep('pipeline.queue', Object.keys(queueStats).length);
    this.countStep('pipeline.knowledge', Object.keys(knowledgeStats).length);
    this.countStep('pipeline.plan', plan ? 1 : 0);
    this.countStep('pipeline.workflow', workflow ? 1 : 0);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getAllCounters(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  reset(): void {
    this.counters.clear();
    this.collector?.reset();
  }
}
