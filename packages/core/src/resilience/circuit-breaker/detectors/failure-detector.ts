export interface FailureDetectorConfig {
  windowMs: number;
  failureRateThreshold: number;
  minRequests: number;
  successRateThreshold: number;
  degradationThreshold: number;
}

export interface FailureStats {
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
  failureRate: number;
  successRate: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  isDegrading: boolean;
  trend: 'improving' | 'stable' | 'degrading';
}

interface RequestTiming {
  timestamp: number;
  success: boolean;
  durationMs: number;
}

export class FailureDetector {
  private config: FailureDetectorConfig;
  private timings: RequestTiming[] = [];
  private consecutiveFailures = 0;

  constructor(config?: Partial<FailureDetectorConfig>) {
    this.config = {
      windowMs: config?.windowMs ?? 60_000,
      failureRateThreshold: config?.failureRateThreshold ?? 50,
      minRequests: config?.minRequests ?? 10,
      successRateThreshold: config?.successRateThreshold ?? 80,
      degradationThreshold: config?.degradationThreshold ?? 20,
    };
  }

  recordRequest(success: boolean, durationMs: number): void {
    this.timings.push({
      timestamp: Date.now(),
      success,
      durationMs,
    });

    if (success) {
      this.consecutiveFailures = 0;
    } else {
      this.consecutiveFailures++;
    }

    this.pruneOldEntries();
  }

  shouldTrip(): boolean {
    const stats = this.getStats();

    if (stats.totalRequests < this.config.minRequests) {
      return false;
    }

    if (stats.failureRate > this.config.failureRateThreshold) {
      return true;
    }

    if (this.consecutiveFailures >= 5) {
      return true;
    }

    if (stats.isDegrading && stats.failureRate > this.config.successRateThreshold) {
      return true;
    }

    return false;
  }

  getStats(): FailureStats {
    this.pruneOldEntries();

    const total = this.timings.length;
    const successes = this.timings.filter((t) => t.success).length;
    const failures = total - successes;

    const failureRate = total > 0 ? (failures / total) * 100 : 0;
    const successRate = total > 0 ? (successes / total) * 100 : 0;

    const durations = this.timings.map((t) => t.durationMs).sort((a, b) => a - b);
    const averageResponseTime =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const p95ResponseTime = this.getPercentile(durations, 0.95);
    const p99ResponseTime = this.getPercentile(durations, 0.99);

    const isDegrading = this.detectDegradation();
    const trend = this.detectTrend();

    return {
      totalRequests: total,
      totalSuccesses: successes,
      totalFailures: failures,
      failureRate,
      successRate,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      isDegrading,
      trend,
    };
  }

  private detectDegradation(): boolean {
    if (this.timings.length < this.config.minRequests) return false;

    const now = Date.now();
    const recentWindow = this.config.windowMs / 2;
    const oldWindow = this.config.windowMs;

    const recent = this.timings.filter((t) => t.timestamp >= now - recentWindow);
    const old = this.timings.filter(
      (t) => t.timestamp >= now - oldWindow && t.timestamp < now - recentWindow,
    );

    if (recent.length < 5 || old.length < 5) return false;

    const recentFailureRate = recent.filter((t) => !t.success).length / recent.length;
    const oldFailureRate = old.filter((t) => !t.success).length / old.length;

    const degradationIncrease = (recentFailureRate - oldFailureRate) * 100;

    return degradationIncrease >= this.config.degradationThreshold;
  }

  private detectTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.timings.length < 20) return 'stable';

    const now = Date.now();
    const quarter = this.config.windowMs / 4;

    const recent = this.timings.filter((t) => t.timestamp >= now - quarter);
    const older = this.timings.filter(
      (t) => t.timestamp >= now - quarter * 2 && t.timestamp < now - quarter,
    );

    if (recent.length < 5 || older.length < 5) return 'stable';

    const recentFailureRate = recent.filter((t) => !t.success).length / recent.length;
    const olderFailureRate = older.filter((t) => !t.success).length / older.length;

    const diff = recentFailureRate - olderFailureRate;

    if (diff < -0.1) return 'improving';
    if (diff > 0.1) return 'degrading';
    return 'stable';
  }

  private getPercentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  private pruneOldEntries(): void {
    const cutoff = Date.now() - this.config.windowMs;
    this.timings = this.timings.filter((t) => t.timestamp >= cutoff);
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  reset(): void {
    this.timings = [];
    this.consecutiveFailures = 0;
  }
}
