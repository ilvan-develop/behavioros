import type { CircuitRequest, CircuitResult, CircuitState } from '../circuit-breaker';

export interface HalfOpenStateConfig {
  allowedTestPercentage: number;
  cooldownMs: number;
}

interface StateTransition {
  to: CircuitState;
  reason: string;
}

export class HalfOpenState {
  private maxAttempts: number;
  private successThreshold: number;
  private config: HalfOpenStateConfig;
  private attempts = 0;
  private successes = 0;
  private failures = 0;

  constructor(
    maxAttempts: number,
    successThreshold: number,
    config?: Partial<HalfOpenStateConfig>,
  ) {
    this.maxAttempts = maxAttempts;
    this.successThreshold = successThreshold;
    this.config = {
      allowedTestPercentage: config?.allowedTestPercentage ?? 25,
      cooldownMs: config?.cooldownMs ?? 5_000,
    };
  }

  check(request: CircuitRequest): CircuitResult {
    if (this.attempts >= this.maxAttempts) {
      return {
        allowed: false,
        reason: `Half-open — max test attempts reached (${this.attempts}/${this.maxAttempts})`,
        state: 'half-open',
        requestId: request.id,
      };
    }

    this.attempts++;

    return {
      allowed: true,
      reason: `Half-open — test request ${this.attempts}/${this.maxAttempts}`,
      state: 'half-open',
      requestId: request.id,
    };
  }

  onSuccess(_requestId: string): StateTransition | null {
    this.successes++;

    if (this.successes >= this.successThreshold) {
      return {
        to: 'closed',
        reason: `Recovery successful — ${this.successes}/${this.successThreshold} consecutive successes`,
      };
    }

    return null;
  }

  onFailure(_requestId: string, _error: Error): StateTransition | null {
    this.failures++;

    return {
      to: 'open',
      reason: `Half-open test failed — failure recorded (${this.failures} failures in half-open)`,
    };
  }

  isAvailable(): boolean {
    return this.attempts < this.maxAttempts;
  }

  getAttempts(): number {
    return this.attempts;
  }

  getSuccesses(): number {
    return this.successes;
  }

  getFailures(): number {
    return this.failures;
  }

  getTestPercentage(): number {
    return this.config.allowedTestPercentage;
  }
}
