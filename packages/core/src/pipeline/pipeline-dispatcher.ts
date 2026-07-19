import type { DispatcherLayerResult, PipelineDispatcherContext } from './pipeline-context';
import { traceLayer } from './telemetry';

// ============================================================
// Pipeline Dispatcher — Layer Execution with Interceptors
// ============================================================

export interface PipelineDispatcherLayer {
  id: string;
  name: string;
  execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult>;
  shouldExecute?(context: PipelineDispatcherContext): boolean;
}

export interface PipelineDispatcherInterceptor {
  intercept(
    context: PipelineDispatcherContext,
    next: () => Promise<DispatcherLayerResult>,
  ): Promise<DispatcherLayerResult>;
}

export class PipelineDispatcher {
  private layers: PipelineDispatcherLayer[] = [];
  private interceptors: PipelineDispatcherInterceptor[] = [];

  addLayer(layer: PipelineDispatcherLayer): this {
    this.layers.push(layer);
    return this;
  }

  addInterceptor(interceptor: PipelineDispatcherInterceptor): this {
    this.interceptors.push(interceptor);
    return this;
  }

  getLayers(): PipelineDispatcherLayer[] {
    return [...this.layers];
  }

  getInterceptors(): PipelineDispatcherInterceptor[] {
    return [...this.interceptors];
  }

  async execute(context: PipelineDispatcherContext): Promise<PipelineDispatcherContext> {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];

      if (layer.shouldExecute && !layer.shouldExecute(context)) {
        continue;
      }

      // Fail-fast for layers 1-4 (structural layers)
      if (context.failed && i < 4) {
        break;
      }

      // Skip remaining layers on failure (except layers 7-9 which never block)
      if (context.failed && i >= 4 && i < 7) {
        continue;
      }

      const result = await traceLayer(layer.name, context.id, i, () =>
        this.executeWithInterceptors(context, layer),
      );
      context.layerResults.push(result);

      // Mark failure for structural layers (1-4)
      if (!result.passed && i < 4) {
        context.failed = true;
        context.error = new Error(result.error || `Layer ${layer.name} failed`);
      }
    }

    return context;
  }

  private async executeWithInterceptors(
    context: PipelineDispatcherContext,
    layer: PipelineDispatcherLayer,
  ): Promise<DispatcherLayerResult> {
    let index = 0;

    const next = async (): Promise<DispatcherLayerResult> => {
      if (index < this.interceptors.length) {
        const interceptor = this.interceptors[index++];
        return interceptor.intercept(context, next);
      }
      return layer.execute(context);
    };

    return next();
  }
}
