// ============================================================
// Pipeline Tracer — Pipeline-specific tracing wrappers
// ============================================================

import { getTracer, SpanStatusCode } from './tracing';

export async function tracePipeline<T>(pipelineId: string, fn: () => Promise<T>): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan('pipeline.execute');
  span.setAttribute('pipeline.id', pipelineId);

  try {
    const result = await fn();
    span.setStatus(SpanStatusCode.OK);
    return result;
  } catch (err) {
    span.setStatus(SpanStatusCode.ERROR, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    span.end();
  }
}

export async function traceLayer<T>(
  layerName: string,
  pipelineId: string,
  layerIndex: number,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(`pipeline.layer.${layerName}`);
  span.setAttribute('pipeline.id', pipelineId);
  span.setAttribute('layer.name', layerName);
  span.setAttribute('layer.index', layerIndex);

  try {
    const result = await fn();
    span.setStatus(SpanStatusCode.OK);
    return result;
  } catch (err) {
    span.setStatus(SpanStatusCode.ERROR, err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    span.end();
  }
}
