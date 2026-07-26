/**
 * RetryOptions — Configuration and options interface.
 */
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
  retryableErrors: string[];
}

/**
 * RetryManager — retry manager.
 *
 * Methods: computeDelay, shouldRetry.
 */
export class RetryManager {
  private options: Required<RetryOptions>;

  constructor(options?: Partial<RetryOptions>) {
    this.options = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      jitter: true,
      retryableErrors: [],
      ...options,
    };
  }

  computeDelay(attempt: number): number {
    let delay = Math.min(this.options.baseDelay * 2 ** attempt, this.options.maxDelay);
    if (this.options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    return Math.floor(delay);
  }

  shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.options.maxRetries) return false;
    if (this.options.retryableErrors.length === 0) return true;
    return this.options.retryableErrors.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  async wrap<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (!this.shouldRetry(lastError, attempt)) throw lastError;
        if (attempt < this.options.maxRetries) {
          const delay = this.computeDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError!;
  }
}
