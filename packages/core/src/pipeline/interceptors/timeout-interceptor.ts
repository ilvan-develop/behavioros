import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineDispatcherInterceptor } from '../pipeline-dispatcher';

// ============================================================
// Timeout Interceptor — Enforces per-layer execution deadlines
// ============================================================

export class TimeoutInterceptor implements PipelineDispatcherInterceptor {
  constructor(private timeoutMs: number = 5000) {}

  async intercept(
    _context: PipelineDispatcherContext,
    next: () => Promise<DispatcherLayerResult>,
  ): Promise<DispatcherLayerResult> {
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Layer timeout after ${this.timeoutMs}ms`)),
        this.timeoutMs,
      );
    });

    try {
      const result = await Promise.race([next(), timeoutPromise]);
      return result;
    } catch (error) {
      return {
        layerId: 'timeout',
        layerName: 'Timeout',
        passed: false,
        score: 0,
        duration: Date.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown timeout error',
      };
    }
  }
}
