/**
 * TelemetryBatch — Configuration and options interface.
 */
export interface TelemetryBatch {
  metrics: { name: string; value: number; labels: Record<string, string>; timestamp: string }[];
  traces: { traceId: string; spans: unknown[] }[];
  logs: { level: string; message: string; timestamp: string }[];
}

/**
 * TelemetryEngine — Provides recordMetric, recordTrace, recordLog, collect, ... operations.
 */
export class TelemetryEngine {
  private metrics: TelemetryBatch['metrics'] = [];
  private traces: TelemetryBatch['traces'] = [];
  private logs: TelemetryBatch['logs'] = [];

  recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    this.metrics.push({ name, value, labels, timestamp: new Date().toISOString() });
  }

  recordTrace(traceId: string, spans: unknown[] = []): void {
    this.traces.push({ traceId, spans });
  }

  recordLog(level: string, message: string): void {
    this.logs.push({ level, message, timestamp: new Date().toISOString() });
  }

  collect(): TelemetryBatch {
    return {
      metrics: [...this.metrics],
      traces: [...this.traces],
      logs: [...this.logs],
    };
  }

  export(format: 'otlp' | 'json' = 'json'): string {
    const batch = this.collect();
    if (format === 'otlp') {
      return JSON.stringify(
        {
          resourceMetrics: batch.metrics.map((m) => ({
            resource: { attributes: m.labels },
            scopeMetrics: [{ metrics: [{ name: m.name, data: { asDouble: m.value } }] }],
          })),
          resourceSpans: batch.traces.map((t) => ({
            resource: {},
            scopeSpans: [{ spans: t.spans }],
          })),
          resourceLogs: batch.logs.map((l) => ({
            resource: {},
            scopeLogs: [
              { logRecords: [{ severityText: l.level, body: { stringValue: l.message } }] },
            ],
          })),
        },
        null,
        2,
      );
    }
    return JSON.stringify(batch, null, 2);
  }

  clear(): void {
    this.metrics = [];
    this.traces = [];
    this.logs = [];
  }

  getSize(): number {
    return this.metrics.length + this.traces.length + this.logs.length;
  }
}
