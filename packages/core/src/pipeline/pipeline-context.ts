// ============================================================
// Pipeline Dispatcher — Context & Layer Result Types
// ============================================================

export interface PipelineDispatcherContext {
  readonly id: string;
  readonly dnaId: string;
  readonly dnaMode: 'conversational' | 'transactional' | 'hybrid';
  readonly agentId: string;
  readonly agentAuthority: string;
  readonly action: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Map<string, unknown>;
  readonly startTime: number;
  // TODO: Authority should be verified against signed token, not self-declared
  readonly verifiedAuthority?: string;
  layerResults: DispatcherLayerResult[];
  currentLayerIndex: number;
  failed: boolean;
  error?: Error;
}

export interface DispatcherLayerResult {
  layerId: string;
  layerName: string;
  passed: boolean;
  score: number;
  duration: number;
  details: Record<string, unknown>;
  error?: string;
}

export function createDispatcherContext(
  input: Omit<
    PipelineDispatcherContext,
    'layerResults' | 'currentLayerIndex' | 'failed' | 'startTime'
  >,
): PipelineDispatcherContext {
  return {
    ...input,
    startTime: Date.now(),
    layerResults: [],
    currentLayerIndex: 0,
    failed: false,
  };
}
