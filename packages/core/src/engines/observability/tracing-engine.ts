import { randomUUID } from 'node:crypto';

/**
 * Span — Configuration and options interface.
 */
export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  attributes: Record<string, unknown>;
  status: 'ok' | 'error';
}

/**
 * TracingEngine — tracing engine.
 *
 * Methods: startSpan, endSpan, getTrace, getSpan, setSamplingRate, export.
 */
export class TracingEngine {
  private spans = new Map<string, Span>();
  private samplingRate = 1;

  startSpan(name: string, attributes: Record<string, unknown> = {}): Span {
    if (Math.random() > this.samplingRate) {
      return {
        id: randomUUID(),
        traceId: randomUUID(),
        name,
        startTime: new Date().toISOString(),
        attributes,
        status: 'ok',
      };
    }

    const span: Span = {
      id: randomUUID(),
      traceId: randomUUID(),
      name,
      startTime: new Date().toISOString(),
      attributes,
      status: 'ok',
    };
    this.spans.set(span.id, span);
    return span;
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.endTime = new Date().toISOString();
    span.duration = new Date(span.endTime).getTime() - new Date(span.startTime).getTime();
    span.status = status;
  }

  getTrace(traceId: string): Span[] {
    const result: Span[] = [];
    for (const span of this.spans.values()) {
      if (span.traceId === traceId) {
        result.push({ ...span });
      }
    }
    return result;
  }

  getSpan(id: string): Span | undefined {
    const span = this.spans.get(id);
    return span ? { ...span } : undefined;
  }

  setSamplingRate(rate: number): void {
    this.samplingRate = Math.max(0, Math.min(1, rate));
  }

  export(): Span[] {
    return Array.from(this.spans.values()).map((s) => ({ ...s }));
  }
}
