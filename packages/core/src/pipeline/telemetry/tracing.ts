// ============================================================
// Telemetry — Lightweight Tracer (OTel-compatible surface)
// ============================================================
// This is a lightweight stub that mirrors the @opentelemetry/api
// surface. When real OTel packages are installed, swap the
// internals to delegate to NodeTracerProvider / ConsoleSpanExporter.

export interface SpanAttributes {
  [key: string]: string | number | boolean;
}

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(code: SpanStatusCode, message?: string): void;
  end(): void;
}

export enum SpanStatusCode {
  OK = 'OK',
  ERROR = 'ERROR',
  UNSET = 'UNSET',
}

class NoopSpan implements Span {
  private ended = false;

  setAttribute(_key: string, _value: string | number | boolean): void {
    // no-op
  }

  setStatus(_code: SpanStatusCode, _message?: string): void {
    // no-op
  }

  end(): void {
    this.ended = true;
  }
}

class ConsoleSpan extends NoopSpan {
  private attrs: Record<string, string | number | boolean> = {};
  private status: SpanStatusCode = SpanStatusCode.UNSET;
  private statusMessage?: string;
  private readonly startTime: number;

  constructor(private readonly name: string) {
    super();
    this.startTime = performance.now();
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attrs[key] = value;
  }

  setStatus(code: SpanStatusCode, message?: string): void {
    this.status = code;
    this.statusMessage = message;
  }

  end(): void {
    const duration = (performance.now() - this.startTime).toFixed(2);
    console.debug(
      `[trace] ${this.name} | ${this.status} | ${duration}ms`,
      Object.keys(this.attrs).length > 0 ? this.attrs : '',
    );
    super.end();
  }
}

class Tracer {
  startSpan(name: string): Span {
    if (process.env.BEHAVIOROS_TELEMETRY === 'console') {
      return new ConsoleSpan(name);
    }
    return new NoopSpan();
  }
}

let _tracer: Tracer | undefined;

export function getTracer(): Tracer {
  if (!_tracer) {
    _tracer = new Tracer();
  }
  return _tracer;
}

export function resetTracer(): void {
  _tracer = undefined;
}
