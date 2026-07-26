/**
 * HealthCheck — Configuration and options interface.
 */
export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastChecked: string;
  error?: string;
}

/**
 * HealthStatus — Configuration and options interface.
 */
export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  uptime: number;
  lastUpdated: string;
}

type HealthCheckFn = () => Promise<boolean>;

/**
 * HealthEngine — health engine.
 *
 * Methods: register, unregister, runAll, getStatus, setInterval, stopInterval, clearInterval, getRegisteredChecks.
 */
export class HealthEngine {
  private checks: Map<string, HealthCheckFn> = new Map();
  private lastStatus: HealthStatus | undefined;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();

  register(name: string, check: HealthCheckFn): void {
    this.checks.set(name, check);
  }

  unregister(name: string): void {
    this.checks.delete(name);
  }

  async runAll(): Promise<HealthStatus> {
    const results: HealthCheck[] = [];

    for (const [name, checkFn] of this.checks) {
      const start = performance.now();
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
      let error: string | undefined;

      try {
        const ok = await checkFn();
        status = ok ? 'healthy' : 'unhealthy';
      } catch (err) {
        status = 'unhealthy';
        error = err instanceof Error ? err.message : String(err);
      }

      results.push({
        name,
        status,
        latency: Math.round((performance.now() - start) * 100) / 100,
        lastChecked: new Date().toISOString(),
        error,
      });
    }

    const unhealthyCount = results.filter((r) => r.status === 'unhealthy').length;
    const degradedCount = results.filter((r) => r.status === 'degraded').length;

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (unhealthyCount > 0) overall = 'unhealthy';
    else if (degradedCount > 0) overall = 'degraded';

    this.lastStatus = {
      overall,
      checks: results,
      uptime: Date.now() - this.startTime,
      lastUpdated: new Date().toISOString(),
    };

    return this.lastStatus;
  }

  getStatus(): HealthStatus | undefined {
    return this.lastStatus;
  }

  setInterval(ms: number): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.runAll(), ms);
    this.intervalId.unref();
  }

  stopInterval(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getRegisteredChecks(): string[] {
    return [...this.checks.keys()];
  }
}
