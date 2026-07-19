import { randomUUID } from 'node:crypto';
import EventEmitter from 'eventemitter3';

// ============================================================
// Health Checker — Monitors canary deployment health
// ============================================================

/**
 * Health check status for a single probe.
 */
export type HealthCheckStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Health check category.
 */
export type HealthCheckCategory = 'success-rate' | 'latency' | 'error-rate' | 'custom';

/**
 * Threshold configuration for a health check category.
 */
export interface HealthThreshold {
  /** Health check category. */
  category: HealthCheckCategory;
  /** Warning threshold (triggers degraded). */
  warningThreshold: number;
  /** Failure threshold (triggers unhealthy). */
  failureThreshold: number;
  /** Unit description for logging (e.g. "ms", "%"). */
  unit: string;
}

/**
 * Result of a single health check probe.
 */
export interface HealthCheckProbe {
  /** Unique probe ID. */
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Category checked. */
  category: HealthCheckCategory;
  /** Measured value. */
  value: number;
  /** Current threshold applied. */
  threshold: HealthThreshold;
  /** Status derived from threshold comparison. */
  status: HealthCheckStatus;
}

/**
 * Aggregated health check result across all probes.
 */
export interface HealthCheckResult {
  /** Unique check ID. */
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** All probe results in this check. */
  probes: HealthCheckProbe[];
  /** Overall status (worst probe status). */
  overallStatus: HealthCheckStatus;
  /** Success rate percentage (0-100). */
  successRate: number;
  /** Average latency in ms. */
  avgLatencyMs: number;
  /** Error rate percentage (0-100). */
  errorRate: number;
  /** Number of requests sampled. */
  requestCount: number;
}

/**
 * Configuration for the health checker.
 */
export interface HealthCheckerConfig {
  /** Thresholds for each health category. */
  thresholds: HealthThreshold[];
  /** Health check interval in ms. Default: 30000 (30s). */
  intervalMs: number;
  /** Number of consecutive failures before triggering rollback. Default: 3. */
  failureThreshold: number;
  /** Minimum number of requests required for a valid check. Default: 10. */
  minRequestCount: number;
}

/**
 * Events emitted by the health checker.
 */
export interface HealthCheckerEvents {
  'check:complete': (result: HealthCheckResult) => void;
  'check:unhealthy': (result: HealthCheckResult) => void;
  'check:recovered': (result: HealthCheckResult) => void;
}

const DEFAULT_THRESHOLDS: HealthThreshold[] = [
  { category: 'success-rate', warningThreshold: 95, failureThreshold: 90, unit: '%' },
  { category: 'latency', warningThreshold: 500, failureThreshold: 1000, unit: 'ms' },
  { category: 'error-rate', warningThreshold: 5, failureThreshold: 10, unit: '%' },
];

const DEFAULT_HEALTH_CHECKER_CONFIG: HealthCheckerConfig = {
  thresholds: DEFAULT_THRESHOLDS,
  intervalMs: 30_000,
  failureThreshold: 3,
  minRequestCount: 10,
};

// ============================================================
// HealthChecker
// ============================================================

export class HealthChecker extends EventEmitter<HealthCheckerEvents> {
  private config: HealthCheckerConfig;
  private results: HealthCheckResult[] = [];
  private consecutiveFailures = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private healthy = true;

  constructor(config?: Partial<HealthCheckerConfig>) {
    super();
    this.config = { ...DEFAULT_HEALTH_CHECKER_CONFIG, ...config };
    if (config?.thresholds) {
      this.config.thresholds = config.thresholds;
    }
  }

  // ── Health check execution ──────────────────────────────────

  /**
   * Run a single health check against collected metrics.
   */
  check(metrics: {
    successCount: number;
    totalCount: number;
    totalLatencyMs: number;
    errorCount: number;
  }): HealthCheckResult {
    const probes: HealthCheckProbe[] = [];
    const { successCount, totalCount, totalLatencyMs, errorCount } = metrics;

    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
    const avgLatencyMs = totalCount > 0 ? totalLatencyMs / totalCount : 0;
    const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

    for (const threshold of this.config.thresholds) {
      let value: number;
      switch (threshold.category) {
        case 'success-rate':
          value = successRate;
          break;
        case 'latency':
          value = avgLatencyMs;
          break;
        case 'error-rate':
          value = errorRate;
          break;
        default:
          continue;
      }

      const status = this.evaluateThreshold(
        threshold,
        value,
        threshold.category === 'success-rate',
      );
      probes.push({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        category: threshold.category,
        value,
        threshold,
        status,
      });
    }

    const overallStatus = this.worstStatus(probes.map((p) => p.status));
    const result: HealthCheckResult = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      probes,
      overallStatus,
      successRate,
      avgLatencyMs,
      errorRate,
      requestCount: totalCount,
    };

    this.results.push(result);
    this.emit('check:complete', result);

    if (overallStatus === 'unhealthy') {
      this.consecutiveFailures++;
      if (this.healthy) {
        this.healthy = false;
        this.emit('check:recovered', result);
      }
      this.emit('check:unhealthy', result);
    } else {
      if (!this.healthy && overallStatus === 'healthy') {
        this.healthy = true;
        this.emit('check:recovered', result);
      }
      this.consecutiveFailures = 0;
    }

    return result;
  }

  // ── Config ──────────────────────────────────────────────────

  /**
   * Update configuration values (e.g. interval between stages).
   */
  updateConfig(partial: Partial<HealthCheckerConfig>): void {
    if (partial.thresholds) this.config.thresholds = partial.thresholds;
    if (partial.intervalMs !== undefined) this.config.intervalMs = partial.intervalMs;
    if (partial.failureThreshold !== undefined)
      this.config.failureThreshold = partial.failureThreshold;
    if (partial.minRequestCount !== undefined)
      this.config.minRequestCount = partial.minRequestCount;
  }

  // ── Timer management ────────────────────────────────────────

  /**
   * Start periodic health checks.
   * `sampleFn` is called each interval to collect metrics for the check.
   */
  startPeriodic(
    sampleFn: () => Promise<{
      successCount: number;
      totalCount: number;
      totalLatencyMs: number;
      errorCount: number;
    }>,
  ): void {
    if (this.timer) return;
    this.timer = setInterval(async () => {
      try {
        const metrics = await sampleFn();
        this.check(metrics);
      } catch {
        this.consecutiveFailures++;
        this.emit('check:unhealthy', {
          id: randomUUID(),
          timestamp: new Date().toISOString(),
          probes: [],
          overallStatus: 'unhealthy',
          successRate: 0,
          avgLatencyMs: 0,
          errorRate: 100,
          requestCount: 0,
        });
      }
    }, this.config.intervalMs);
  }

  /**
   * Stop periodic health checks.
   */
  stopPeriodic(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── Query ───────────────────────────────────────────────────

  /**
   * Whether the checker is currently in a failing state.
   */
  isFailing(): boolean {
    return this.consecutiveFailures >= this.config.failureThreshold;
  }

  /**
   * Number of consecutive unhealthy checks.
   */
  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Get all recorded health check results.
   */
  getResults(): HealthCheckResult[] {
    return [...this.results];
  }

  /**
   * Get the most recent health check result.
   */
  getLastResult(): HealthCheckResult | undefined {
    return this.results[this.results.length - 1];
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<HealthCheckerConfig> {
    return this.config;
  }

  // ── Reset ───────────────────────────────────────────────────

  /**
   * Reset all state (results, failure count).
   */
  reset(): void {
    this.results = [];
    this.consecutiveFailures = 0;
    this.healthy = true;
  }

  // ── Private ─────────────────────────────────────────────────

  private evaluateThreshold(
    threshold: HealthThreshold,
    value: number,
    inverseDirection: boolean,
  ): HealthCheckStatus {
    if (inverseDirection) {
      if (value < threshold.failureThreshold) return 'unhealthy';
      if (value < threshold.warningThreshold) return 'degraded';
      return 'healthy';
    }

    if (value > threshold.failureThreshold) return 'unhealthy';
    if (value > threshold.warningThreshold) return 'degraded';
    return 'healthy';
  }

  private worstStatus(statuses: HealthCheckStatus[]): HealthCheckStatus {
    if (statuses.includes('unhealthy')) return 'unhealthy';
    if (statuses.includes('degraded')) return 'degraded';
    return 'healthy';
  }
}
