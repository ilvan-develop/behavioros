export interface SlidingWindowConfig {
  windowMs: number;
  maxRequests: number;
  minSpacingMs?: number;
}

export interface SlidingWindowState {
  requests: number[];
  totalAccepted: number;
  totalRejected: number;
}

export interface WindowConsumeResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  windowResetMs: number;
  retryAfterMs: number;
}

export class SlidingWindow {
  private config: SlidingWindowConfig;
  private state: SlidingWindowState;

  constructor(config: SlidingWindowConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      minSpacingMs: config.minSpacingMs ?? 0,
    };
    this.state = {
      requests: [],
      totalAccepted: 0,
      totalRejected: 0,
    };
  }

  consume(): WindowConsumeResult {
    const now = Date.now();
    this.pruneExpired(now);

    const currentCount = this.state.requests.length;
    const windowResetMs =
      this.state.requests.length > 0
        ? this.state.requests[0] + this.config.windowMs - now
        : this.config.windowMs;

    if (currentCount >= this.config.maxRequests) {
      this.state.totalRejected++;
      const retryAfterMs = this.state.requests[0] + this.config.windowMs - now;
      return {
        allowed: false,
        currentCount,
        limit: this.config.maxRequests,
        windowResetMs: Math.max(0, windowResetMs),
        retryAfterMs: Math.max(0, retryAfterMs),
      };
    }

    if (
      this.config.minSpacingMs &&
      this.config.minSpacingMs > 0 &&
      this.state.requests.length > 0
    ) {
      const lastRequest = this.state.requests[this.state.requests.length - 1];
      if (lastRequest !== undefined) {
        const elapsed = now - lastRequest;
        if (elapsed < this.config.minSpacingMs) {
          this.state.totalRejected++;
          return {
            allowed: false,
            currentCount,
            limit: this.config.maxRequests,
            windowResetMs: Math.max(0, windowResetMs),
            retryAfterMs: this.config.minSpacingMs - elapsed,
          };
        }
      }
    }

    this.state.requests.push(now);
    this.state.totalAccepted++;
    return {
      allowed: true,
      currentCount: currentCount + 1,
      limit: this.config.maxRequests,
      windowResetMs: Math.max(0, windowResetMs),
      retryAfterMs: 0,
    };
  }

  private pruneExpired(now: number): void {
    const cutoff = now - this.config.windowMs;
    while (this.state.requests.length > 0 && this.state.requests[0] <= cutoff) {
      this.state.requests.shift();
    }
  }

  getState(): SlidingWindowState {
    this.pruneExpired(Date.now());
    return {
      requests: [...this.state.requests],
      totalAccepted: this.state.totalAccepted,
      totalRejected: this.state.totalRejected,
    };
  }

  getUtilization(): number {
    this.pruneExpired(Date.now());
    return this.config.maxRequests > 0 ? this.state.requests.length / this.config.maxRequests : 0;
  }

  reset(): void {
    this.state.requests = [];
    this.state.totalAccepted = 0;
    this.state.totalRejected = 0;
  }

  updateLimit(newLimit: number): void {
    this.config.maxRequests = newLimit;
  }
}
