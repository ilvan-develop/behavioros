import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

/**
 * ProfileSnapshot — Configuration and options interface.
 */
export interface ProfileSnapshot {
  id: string;
  timestamp: string;
  cpuUsage: number;
  memoryUsage: { heapUsed: number; heapTotal: number; external: number };
  activeHandles: number;
  activeRequests: number;
  eventLoopLag: number;
}

/**
 * ProfilingEngine — profiling engine.
 *
 * Methods: snapshot, start, stop, clearInterval, getHistory, getAverage, clear.
 */
export class ProfilingEngine {
  private history: ProfileSnapshot[] = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastCpuUsage = process.cpuUsage();

  snapshot(): ProfileSnapshot {
    const mem = process.memoryUsage();
    const cpuDiff = process.cpuUsage(this.lastCpuUsage);
    this.lastCpuUsage = process.cpuUsage();

    const totalCpu = cpuDiff.user + cpuDiff.system;
    const cpuUsage = Math.min(100, Math.max(0, Math.round((totalCpu / 1_000_000) * 100)));

    const snapshot: ProfileSnapshot = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      cpuUsage,
      memoryUsage: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external ?? 0,
      },
      activeHandles:
        (process as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.().length ?? 0,
      activeRequests:
        (process as { _getActiveRequests?: () => unknown[] })._getActiveRequests?.().length ?? 0,
      eventLoopLag: this.measureEventLoopLag(),
    };

    this.history.push(snapshot);
    return snapshot;
  }

  start(intervalMs = 5000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.snapshot(), intervalMs);
    this.intervalId.unref();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getHistory(count?: number): ProfileSnapshot[] {
    if (count === undefined) return [...this.history];
    return this.history.slice(-count);
  }

  getAverage(): { cpuAvg: number; memoryAvg: number; lagAvg: number } {
    if (this.history.length === 0) {
      return { cpuAvg: 0, memoryAvg: 0, lagAvg: 0 };
    }

    const sum = this.history.reduce(
      (acc, s) => ({
        cpu: acc.cpu + s.cpuUsage,
        mem: acc.mem + s.memoryUsage.heapUsed,
        lag: acc.lag + s.eventLoopLag,
      }),
      { cpu: 0, mem: 0, lag: 0 },
    );

    const len = this.history.length;
    return {
      cpuAvg: Math.round((sum.cpu / len) * 100) / 100,
      memoryAvg: Math.round((sum.mem / len) * 100) / 100,
      lagAvg: Math.round((sum.lag / len) * 100) / 100,
    };
  }

  clear(): void {
    this.history = [];
  }

  private measureEventLoopLag(): number {
    const start = performance.now();
    const end = performance.now();
    return Math.round((end - start) * 100) / 100;
  }
}
