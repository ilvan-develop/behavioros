# BehaviorOS Observability Specification

> **Version:** 1.0.0
> **Status:** Architecture Stabilization — Phase 1
> **Last Updated:** July 2026
> **Source of Truth:** `packages/core/src/observability/`
> **Architecture Level:** Level 2 — Cognitive Platforms

---

## Overview

The Observability layer provides 11 engines for comprehensive system telemetry: metrics, tracing, logging, profiling, health checking, alerting, telemetry export, AI-specific metrics, cost tracking, audit streaming, and FinOps. It is the unified observability foundation for all BehaviorOS components.

### Architecture Position

```
Level 1: Kernel              ← Event Sourcing, CQRS, Contracts
Level 2: Cognitive Platforms  ← YOU ARE HERE — Observability, Intelligence, Governance
Level 3: Enterprise Services  ← Runtime, Execution, Integration
Level 4: Ecosystem            ← SDKs, CLI, MCP Server, Dashboard
```

---

## Core Interfaces

### MetricPoint

```typescript
interface MetricPoint {
  name: string
  value: number
  labels: Record<string, string>
  timestamp: number
  type: 'counter' | 'gauge' | 'histogram' | 'timer'
}
```

### Span

```typescript
interface Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  name: string
  kind: SpanKind
  startTime: number
  endTime?: number
  attributes: Record<string, unknown>
  events: SpanEvent[]
  status: SpanStatus
  resource: Resource
}
```

---

## 1. MetricsEngine

```typescript
interface MetricsEngine {
  counter(name: string, labels?: Record<string, string>): Counter
  gauge(name: string, labels?: Record<string, string>): Gauge
  histogram(name: string, labels?: Record<string, string>): Histogram
  timer(name: string, labels?: Record<string, string>): Timer
  snapshot(): Promise<MetricSnapshot>
  flush(): Promise<void>
}
```

| Type | Behavior | Example |
|------|----------|---------|
| **Counter** | Monotonic increment | `missions.created` |
| **Gauge** | Up/down snapshots | `active.agents` |
| **Histogram** | Value distribution | `latency.duration.ms` |
| **Timer** | Duration measurement | `audit.execution.time` |

**Aggregation:** Rolling window (1m, 5m, 15m) with configurable percentiles (p50, p95, p99).

---

## 2. TracingEngine

```typescript
interface TracingEngine {
  startSpan(name: string, options?: SpanOptions): Span
  injectContext(span: Span): TraceContext
  extractContext(context: TraceContext): Span | null
  withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>
  setSampler(sampler: Sampler): void
}

interface Sampler {
  shouldSample(traceId: string, parentSpan?: Span): SamplingDecision
}
```

**Sampling strategies:** `always-on` (dev), `probabilistic` (default 10%), `rate-limited` (100 spans/sec), `head-based` (decision at root).

**Propagation:** W3C Trace Context (`traceparent` / `tracestate`) via `injectContext`/`extractContext`.

---

## 3. LoggingEngine

```typescript
interface LoggingEngine {
  debug(msg: string, ctx?: LogContext): void
  info(msg: string, ctx?: LogContext): void
  warn(msg: string, ctx?: LogContext): void
  error(msg: string, ctx?: LogContext): void
  fatal(msg: string, ctx?: LogContext): void
  query(filter: LogFilter): Promise<LogEntry[]>
  export(format: 'json' | 'ndjson' | 'parquet', sink: ExportSink): Promise<void>
}

interface LogEntry {
  timestamp: number
  level: LogLevel
  message: string
  module: string
  traceId?: string
  spanId?: string
  attributes: Record<string, unknown>
}
```

**Structured format:** Always JSON with `timestamp`, `level`, `message`, `module`, `traceId`. Queryable by time range, level, module, and attribute filters. Export sinks: filesystem, S3, Elasticsearch, Loki.

---

## 4. ProfilingEngine

```typescript
interface ProfilingEngine {
  captureCpuSnapshot(): Promise<CpuProfile>
  captureMemorySnapshot(): Promise<HeapProfile>
  startEventLoopLag(): Promise<void>
  stopEventLoopLag(): void
  getEventLoopLag(): Promise<EventLoopLag>
  startContinuous(durationMs: number): Promise<ProfileSession>
}

interface EventLoopLag {
  currentMs: number
  maxMs: number
  p95Ms: number
  samples: number
}
```

**Triggers:** Manual via MCP tool, automated on latency > threshold, continuous sessions for performance regression detection. Profiles stored in `~/.behavioros/profiles/` as CPU flamegraph and heap dump.

---

## 5. HealthEngine

```typescript
interface HealthEngine {
  registerCheck(name: string, check: HealthCheck, intervalMs: number): void
  unregisterCheck(name: string): void
  getStatus(component?: string): Promise<HealthStatus>
  getAggregatedStatus(): Promise<AggregatedHealth>
  onStatusChange(callback: (status: AggregatedHealth) => void): void
}

interface HealthCheck {
  check(): Promise<CheckResult>
  timeout?: number
}

interface AggregatedHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: ComponentHealth[]
  lastUpdated: number
}
```

**Check types:** `liveness` (is it running?), `readiness` (can it serve?), `dependency` (are deps up?), `deep` (full functional test). Checks run on configurable intervals with jitter to avoid thundering herd.

---

## 6. AlertEngine

```typescript
interface AlertEngine {
  createRule(rule: AlertRule): Promise<string>
  updateRule(id: string, rule: Partial<AlertRule>): Promise<void>
  deleteRule(id: string): Promise<void>
  getActiveAlerts(): Promise<Alert[]>
  acknowledge(id: string): Promise<void>
  resolve(id: string): Promise<void>
}

interface AlertRule {
  name: string
  metric: string
  condition: 'gt' | 'lt' | 'eq' | 'change_percent'
  threshold: number
  duration: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  channels: string[]
  cooldown: string
}
```

**Channels:** `console`, `webhook`, `slack`, `email`, `pagerduty`, `opsgenie`. Deduplication by rule + labels within cooldown window. Auto-resolve when metric returns to normal.

---

## 7. TelemetryEngine

```typescript
interface TelemetryEngine {
  collect(metric: MetricPoint): void
  exportOtlp(endpoint: string, headers?: Record<string, string>): Promise<void>
  setResource(resource: Resource): void
  shutdown(): Promise<void>
}

interface OtlpExporterConfig {
  endpoint: string
  protocol: 'grpc' | 'http/protobuf' | 'http/json'
  headers?: Record<string, string>
  compression?: 'gzip' | 'none'
  batchSize?: number
  exportIntervalMs?: number
}
```

Unified collector aggregating all Metrics, Traces, and Logs into a single OTLP export pipeline. Batches by size (default 512) and interval (default 1s). Supports gzip compression.

---

## 8. AIMetrics

```typescript
interface AIMetrics {
  trackTokenUsage(model: string, tokens: TokenUsage): void
  trackLatency(model: string, durationMs: number): void
  trackError(model: string, errorType: string): void
  getModelStats(model: string): Promise<ModelStats>
  getTopModels(limit?: number): Promise<ModelRanking[]>
}

interface ModelStats {
  totalTokens: number
  totalCalls: number
  avgLatencyMs: number
  p95LatencyMs: number
  errorRate: number
  costTotal: number
}
```

Tracks input/output tokens separately. Latency broken down by TTFT (time to first token) and total duration. Error types: `timeout`, `rate_limit`, `invalid_request`, `server_error`.

---

## 9. CostMetrics

```typescript
interface CostMetrics {
  trackCost(model: string, provider: string, task: string, cost: number): void
  getCostByModel(model: string, period: TimeRange): Promise<CostBreakdown>
  getCostByProvider(provider: string, period: TimeRange): Promise<CostBreakdown>
  getCostByTask(task: string, period: TimeRange): Promise<CostBreakdown>
  getDailyCost(date: string): Promise<DailyCost>
}

interface CostBreakdown {
  total: number
  byModel: Record<string, number>
  byProvider: Record<string, number>
  byTask: Record<string, number>
  dailyAvg: number
}
```

Cost per 1K tokens (input/output separately). Providers: `openai`, `anthropic`, `google`, `azure`, `aws-bedrock`, `ollama`. Tasks: `chat`, `embedding`, `completion`, `agent-tool-call`.

---

## 10. AuditStream

```typescript
interface AuditStream {
  append(entry: AuditEntry): Promise<void>
  query(filter: AuditFilter): Promise<AuditEntry[]>
  setRetention(days: number): void
  export(format: 'json' | 'csv' | 'parquet', sink: ExportSink): Promise<void>
  stream(from?: string): AsyncGenerator<AuditEntry>
}

interface AuditEntry {
  id: string
  timestamp: number
  agentId: string
  action: string
  resource: string
  result: 'success' | 'failure' | 'blocked'
  duration: number
  metadata: Record<string, unknown>
  hash: string // Merkle-chain hash linking to previous entry
}
```

Append-only immutable log with cryptographic chaining (Merkle hash tree). Queryable by agent, action, resource, time range, result. Retention: default 90 days with automated archival to cold storage.

---

## 11. FinOpsEngine

```typescript
interface FinOpsEngine {
  setBudget(budget: Budget): Promise<void>
  getBudgetStatus(): Promise<BudgetStatus>
  getChargeback(tenantId: string, period: TimeRange): Promise<ChargebackReport>
  forecast(model: string, period: TimeRange): Promise<CostForecast>
  getOptimizationSuggestions(): Promise<OptimizationSuggestion[]>
}

interface Budget {
  total: number
  period: 'daily' | 'weekly' | 'monthly'
  alerts: { threshold: number; channel: string }[]
}

interface OptimizationSuggestion {
  type: 'model_switch' | 'provider_switch' | 'cache_policy' | 'batch_tuning'
  estimatedSavings: number
  effort: 'low' | 'medium' | 'high'
  description: string
}
```

**Chargeback** allocates costs per tenant using direct metering + pro-rata for shared resources. **Forecasting** uses moving average + seasonal decomposition. **Optimization** suggests cheaper models, better providers, cache tuning, and batch size adjustments.

---

## Usage Examples

```typescript
// Record a metric
const counter = metrics.counter('missions.created', { type: 'feature' })
counter.add(1)

// Create a trace
const result = await tracing.withSpan('process-mission', async (span) => {
  span.setAttribute('missionId', 'abc-123')
  return processMission()
})

// Log structured entry
logging.info('Mission completed', { missionId: 'abc-123', duration: 4523 })

// Health check
health.registerCheck('postgres', async () => {
  const ok = await db.ping()
  return { status: ok ? 'healthy' : 'unhealthy', details: { latency: 2 } }
}, 30_000)

// Alert rule
await alerts.createRule({
  name: 'High error rate',
  metric: 'audit.error_rate',
  condition: 'gt',
  threshold: 5,
  duration: '5m',
  severity: 'critical',
  channels: ['slack', 'pagerduty'],
  cooldown: '10m',
})

// OTLP export
await telemetry.exportOtlp('https://otel.example.com/v1/traces', {
  'x-api-key': '...',
})
```

---

## References

- [PLATFORM_SPEC.md](./PLATFORM_SPEC.md) — Pipeline dispatcher layers
- [KERNEL_SPEC.md](./KERNEL_SPEC.md) — Kernel invariants and lifecycle
- [ARCHITECTURE_PRINCIPLES.md](./ARCHITECTURE_PRINCIPLES.md) — System architecture principles
- OpenTelemetry Specification — OTLP protocol reference
