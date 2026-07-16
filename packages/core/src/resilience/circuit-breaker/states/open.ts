import type { CircuitRequest, CircuitResult, CircuitState } from '../circuit-breaker';

export interface OpenStateConfig {
  allowHalfOpenAfterMs: number;
  maxOpenDurationMs: number;
}

interface StateTransition {
  to: CircuitState;
  reason: string;
}

export class OpenState {
  private halfOpenMaxAttempts: number;
  private config: OpenStateConfig;
  private openedAt: number;
  private attempts = 0;

  constructor(
    _recoveryTimeoutMs: number,
    halfOpenMaxAttempts: number,
    config?: Partial<OpenStateConfig>,
  ) {
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
    this.config = {
      allowHalfOpenAfterMs: config?.allowHalfOpenAfterMs ?? _recoveryTimeoutMs,
      maxOpenDurationMs: config?.maxOpenDurationMs ?? 300_000,
    };
    this.openedAt = Date.now();
  }

  check(request: CircuitRequest): CircuitResult {
    const elapsed = Date.now() - this.openedAt;

    if (elapsed >= this.config.allowHalfOpenAfterMs) {
      return {
        allowed: false,
        reason: `Circuit open — transitioning to half-open (elapsed: ${elapsed}ms, recovery: ${this.config.allowHalfOpenAfterMs}ms)`,
        state: 'half-open',
        requestId: request.id,
        retryAfterMs: 0,
      };
    }

    if (elapsed >= this.config.maxOpenDurationMs) {
      return {
        allowed: false,
        reason: `Circuit open — max duration reached (elapsed: ${elapsed}ms)`,
        state: 'half-open',
        requestId: request.id,
        retryAfterMs: 0,
      };
    }

    const retryAfterMs = Math.max(0, this.config.allowHalfOpenAfterMs - elapsed);

    return {
      allowed: false,
      reason: `Circuit open — all requests rejected (retry in ${retryAfterMs}ms)`,
      state: 'open',
      requestId: request.id,
      retryAfterMs,
    };
  }

  onSuccess(_requestId: string): StateTransition | null {
    return null;
  }

  onFailure(_requestId: string, _error: Error): StateTransition | null {
    this.attempts++;

    if (this.attempts >= this.halfOpenMaxAttempts) {
      return {
        to: 'open',
        reason: `Half-open test failed — ${this.attempts}/${this.halfOpenMaxAttempts} attempts exhausted`,
      };
    }

    return null;
  }

  isAvailable(): boolean {
    const elapsed = Date.now() - this.openedAt;
    return elapsed >= this.config.allowHalfOpenAfterMs;
  }

  getRemainingMs(): number {
    const elapsed = Date.now() - this.openedAt;
    return Math.max(0, this.config.allowHalfOpenAfterMs - elapsed);
  }

  getOpenedAt(): number {
    return this.openedAt;
  }

  getAttempts(): number {
    return this.attempts;
  }
}
