import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineDispatcherInterceptor } from '../pipeline-dispatcher';

// ============================================================
// Metrics Interceptor — Collects per-layer performance metrics
// ============================================================

export interface LayerMetrics {
  count: number;
  totalDuration: number;
  failures: number;
  avgDuration: number;
}

export class MetricsInterceptor implements PipelineDispatcherInterceptor {
  private metrics: Map<string, { count: number; totalDuration: number; failures: number }> =
    new Map();

  async intercept(
    _context: PipelineDispatcherContext,
    next: () => Promise<DispatcherLayerResult>,
  ): Promise<DispatcherLayerResult> {
    const startTime = Date.now();
    const result = await next();
    const duration = Date.now() - startTime;

    const layerMetrics = this.metrics.get(result.layerId) || {
      count: 0,
      totalDuration: 0,
      failures: 0,
    };
    layerMetrics.count++;
    layerMetrics.totalDuration += duration;
    if (!result.passed) layerMetrics.failures++;
    this.metrics.set(result.layerId, layerMetrics);

    return { ...result, duration };
  }

  getMetrics(): Map<string, LayerMetrics> {
    const result = new Map<string, LayerMetrics>();
    for (const [key, value] of this.metrics) {
      result.set(key, {
        ...value,
        avgDuration: value.totalDuration / value.count,
      });
    }
    return result;
  }

  reset(): void {
    this.metrics.clear();
  }
}
