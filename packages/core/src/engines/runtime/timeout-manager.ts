/**
 * TimeoutError — timeout error.
 *
 * Methods: fn, setTimeout, isCircuitOpen, recordSuccess, recordFailure, getCircuitState.
 */
export class TimeoutError extends Error {
  constructor(message?: string) {
    super(message ?? 'Operation timed out');
    this.name = 'TimeoutError';
  }
}

/**
 * TimeoutOptions — Configuration and options interface.
 */
export interface TimeoutOptions {
  defaultTimeout: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetTimeout: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * TimeoutManager — timeout manager.
 *
 * Methods: fn, setTimeout, isCircuitOpen, recordSuccess, recordFailure, getCircuitState.
 */
export class TimeoutManager {
  private options: Required<TimeoutOptions>;
  private consecutiveFailures = 0;
  private circuitState: CircuitState = 'closed';
  private lastOpenTime = 0;

  constructor(options?: Partial<TimeoutOptions>) {
    this.options = {
      defaultTimeout: 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 60000,
      ...options,
    };
  }

  async execute<T>(fn: () => Promise<T>, timeout?: number): Promise<T> {
    const ms = timeout ?? this.options.defaultTimeout;

    if (this.circuitState === 'open') {
      const elapsed = Date.now() - this.lastOpenTime;
      if (elapsed >= this.options.circuitBreakerResetTimeout) {
        this.circuitState = 'half-open';
      } else {
        throw new TimeoutError('Circuit breaker is open');
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new TimeoutError(`Operation timed out after ${ms}ms`)), ms),
        ),
      ]);
      this.recordSuccess();
      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.recordFailure();
      }
      throw error;
    }
  }

  isCircuitOpen(): boolean {
    return this.circuitState === 'open';
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = 'closed';
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.options.circuitBreakerThreshold) {
      this.circuitState = 'open';
      this.lastOpenTime = Date.now();
    }
  }

  getCircuitState(): CircuitState {
    if (this.circuitState === 'open') {
      const elapsed = Date.now() - this.lastOpenTime;
      if (elapsed >= this.options.circuitBreakerResetTimeout) {
        return 'half-open';
      }
    }
    return this.circuitState;
  }
}
