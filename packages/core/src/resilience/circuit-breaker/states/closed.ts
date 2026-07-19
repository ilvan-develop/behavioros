import type { CircuitRequest, CircuitResult, CircuitState } from '../circuit-breaker';

export interface ClosedStateConfig {
  slowCallDurationMs: number;
  slowCallThresholdPercent: number;
}

interface StateTransition {
  to: CircuitState;
  reason: string;
}

export class ClosedState {
  private consecutiveFailures = 0;
  private slowCalls = 0;
  private totalCalls = 0;
  private failureThreshold: number;
  private slowCallDurationMs: number;
  private slowCallThresholdPercent: number;

  constructor(failureThreshold: number, config?: Partial<ClosedStateConfig>) {
    this.failureThreshold = failureThreshold;
    this.slowCallDurationMs = config?.slowCallDurationMs ?? 5_000;
    this.slowCallThresholdPercent = config?.slowCallThresholdPercent ?? 80;
  }

  check(_request: CircuitRequest): CircuitResult {
    return {
      allowed: true,
      reason: 'Circuit closed — all requests allowed',
      state: 'closed',
      requestId: _request.id,
    };
  }

  onSuccess(_requestId: string): StateTransition | null {
    this.consecutiveFailures = 0;
    this.totalCalls++;
    return null;
  }

  onFailure(_requestId: string, _error: Error): StateTransition | null {
    this.consecutiveFailures++;
    this.totalCalls++;

    if (this.consecutiveFailures >= this.failureThreshold) {
      return {
        to: 'open',
        reason: `Failure threshold reached — ${this.consecutiveFailures}/${this.failureThreshold} consecutive failures`,
      };
    }

    return null;
  }

  isAvailable(): boolean {
    return true;
  }

  getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  getTotalCalls(): number {
    return this.totalCalls;
  }

  getSlowCallRate(): number {
    if (this.totalCalls === 0) return 0;
    return (this.slowCalls / this.totalCalls) * 100;
  }

  recordSlowCall(): void {
    this.slowCalls++;
    this.totalCalls++;
  }

  reset(): void {
    this.consecutiveFailures = 0;
    this.slowCalls = 0;
    this.totalCalls = 0;
  }
}
