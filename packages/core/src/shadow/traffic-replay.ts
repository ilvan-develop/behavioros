import { randomUUID } from 'node:crypto';
import type { CapturedTraffic } from './traffic-capture';

// ============================================================
// Traffic Replay — Replay captured traffic against shadow DNA
// ============================================================

/**
 * Result of replaying a single captured traffic entry.
 */
export interface ReplayResult {
  /** Unique replay ID. */
  id: string;
  /** Reference to the original captured traffic ID. */
  captureId: string;
  /** ISO-8601 timestamp of replay. */
  timestamp: string;
  /** Shadow response produced by the new DNA. */
  shadowResponse: Record<string, unknown>;
  /** Shadow HTTP status code. */
  shadowStatusCode: number;
  /** Error message if shadow execution failed. */
  error?: string;
  /** Latency of the shadow execution in milliseconds. */
  shadowLatencyMs: number;
  /** Whether the replay succeeded without error. */
  success: boolean;
}

/**
 * Aggregate statistics for a batch replay run.
 */
export interface ReplayStats {
  /** Total entries replayed. */
  total: number;
  /** Successfully replayed. */
  succeeded: number;
  /** Failed replays. */
  failed: number;
  /** Average shadow latency in ms. */
  avgLatencyMs: number;
  /** P50 latency in ms. */
  p50LatencyMs: number;
  /** P95 latency in ms. */
  p95LatencyMs: number;
  /** P99 latency in ms. */
  p99LatencyMs: number;
  /** Total batch duration in ms. */
  totalDurationMs: number;
}

export interface ReplayConfig {
  /** Maximum concurrent replays. Default: 5. */
  concurrency: number;
  /** Timeout per replay in ms. Default: 30000. */
  timeoutMs: number;
  /** Delay between replays in ms (rate limiting). Default: 0. */
  delayMs: number;
  /** Maximum retries on failure. Default: 0. */
  retries: number;
}

type ReplayHandler = (
  request: Record<string, unknown>,
  path: string,
  method: string,
) => Promise<{ response: Record<string, unknown>; statusCode: number }>;

// --- Defaults ---

const DEFAULT_REPLAY_CONFIG: ReplayConfig = {
  concurrency: 5,
  timeoutMs: 30_000,
  delayMs: 0,
  retries: 0,
};

// ============================================================
// TrafficReplay
// ============================================================

export class TrafficReplay {
  private results: ReplayResult[] = [];
  private config: ReplayConfig;

  constructor(config?: Partial<ReplayConfig>) {
    this.config = { ...DEFAULT_REPLAY_CONFIG, ...config };
  }

  // ── Core replay ──────────────────────────────────────────────

  /**
   * Replay a single captured traffic entry against the shadow handler.
   */
  async replayOne(capture: CapturedTraffic, handler: ReplayHandler): Promise<ReplayResult> {
    const startTime = Date.now();
    const result: ReplayResult = {
      id: randomUUID(),
      captureId: capture.id,
      timestamp: new Date().toISOString(),
      shadowResponse: {},
      shadowStatusCode: 0,
      shadowLatencyMs: 0,
      success: false,
    };

    let attempts = 0;
    const maxAttempts = 1 + this.config.retries;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const response = await this.withTimeout(
          handler(capture.request, capture.path, capture.method),
          this.config.timeoutMs,
        );

        result.shadowResponse = response.response;
        result.shadowStatusCode = response.statusCode;
        result.shadowLatencyMs = Date.now() - startTime;
        result.success = true;
        break;
      } catch (err) {
        if (attempts >= maxAttempts) {
          result.error = err instanceof Error ? err.message : String(err);
          result.shadowLatencyMs = Date.now() - startTime;
        } else {
          await this.delay(this.config.delayMs * attempts);
        }
      }
    }

    this.results.push(result);
    return result;
  }

  /**
   * Replay multiple captured traffic entries with concurrency control.
   */
  async replayBatch(
    captures: CapturedTraffic[],
    handler: ReplayHandler,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<{ results: ReplayResult[]; stats: ReplayStats }> {
    this.results = [];
    const startTime = Date.now();
    let completed = 0;

    for (let i = 0; i < captures.length; i += this.config.concurrency) {
      const batch = captures.slice(i, i + this.config.concurrency);
      const promises = batch.map((capture) =>
        this.replayOne(capture, handler).then((result) => {
          completed++;
          onProgress?.(completed, captures.length);
          return result;
        }),
      );
      await Promise.all(promises);

      if (this.config.delayMs > 0 && i + this.config.concurrency < captures.length) {
        await this.delay(this.config.delayMs);
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const stats = this.computeStats(this.results, totalDurationMs);

    return { results: [...this.results], stats };
  }

  // ── Query ────────────────────────────────────────────────────

  /** Get all replay results (copy). */
  getResults(): ReplayResult[] {
    return [...this.results];
  }

  /** Get only failed replay results. */
  getFailures(): ReplayResult[] {
    return this.results.filter((r) => !r.success);
  }

  /** Get results with status code mismatch vs original. */
  getStatusMismatches(captures: CapturedTraffic[]): ReplayResult[] {
    return this.results.filter((r) => {
      const original = captures.find((c) => c.id === r.captureId);
      return original !== undefined && original.statusCode !== r.shadowStatusCode;
    });
  }

  /** Get the active config (read-only). */
  getConfig(): Readonly<ReplayConfig> {
    return this.config;
  }

  /** Clear all results. */
  clear(): void {
    this.results = [];
  }

  // ── Stats ────────────────────────────────────────────────────

  private computeStats(results: ReplayResult[], totalDurationMs: number): ReplayStats {
    const succeeded = results.filter((r) => r.success).length;
    const latencies = results.map((r) => r.shadowLatencyMs).sort((a, b) => a - b);
    const avgLatencyMs =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      avgLatencyMs: Math.round(avgLatencyMs * 100) / 100,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
      totalDurationMs,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Replay timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================
// Helpers
// ============================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
