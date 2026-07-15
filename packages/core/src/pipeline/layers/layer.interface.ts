import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';

// ============================================================
// Pipeline Layer — Common Interface for All Layers
// ============================================================

export interface PipelineLayer {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult>;
  shouldExecute?(context: PipelineDispatcherContext): boolean;
}
