export interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
  refillIntervalMs: number;
  burstCapacity?: number;
}

export interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  totalConsumed: number;
  totalRejected: number;
}

export interface ConsumeResult {
  allowed: boolean;
  tokensRemaining: number;
  waitMs: number;
  retryAfterMs: number;
}

export class TokenBucket {
  private config: Required<TokenBucketConfig>;
  private state: TokenBucketState;

  constructor(config: TokenBucketConfig) {
    this.config = {
      capacity: config.capacity,
      refillRate: config.refillRate,
      refillIntervalMs: config.refillIntervalMs,
      burstCapacity: config.burstCapacity ?? config.capacity,
    };
    this.state = {
      tokens: this.config.capacity,
      lastRefill: Date.now(),
      totalConsumed: 0,
      totalRejected: 0,
    };
  }

  consume(tokens: number = 1): ConsumeResult {
    this.refill();

    if (tokens <= this.state.tokens) {
      this.state.tokens -= tokens;
      this.state.totalConsumed += tokens;
      return {
        allowed: true,
        tokensRemaining: this.state.tokens,
        waitMs: 0,
        retryAfterMs: 0,
      };
    }

    this.state.totalRejected++;
    const deficit = tokens - this.state.tokens;
    const waitMs = Math.ceil((deficit / this.config.refillRate) * this.config.refillIntervalMs);

    return {
      allowed: false,
      tokensRemaining: this.state.tokens,
      waitMs,
      retryAfterMs: waitMs,
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.state.lastRefill;
    const intervals = Math.floor(elapsed / this.config.refillIntervalMs);

    if (intervals > 0) {
      const tokensToAdd = intervals * this.config.refillRate;
      this.state.tokens = Math.min(this.config.burstCapacity, this.state.tokens + tokensToAdd);
      this.state.lastRefill += intervals * this.config.refillIntervalMs;
    }
  }

  getState(): TokenBucketState {
    this.refill();
    return { ...this.state };
  }

  reset(): void {
    this.state.tokens = this.config.capacity;
    this.state.lastRefill = Date.now();
    this.state.totalConsumed = 0;
    this.state.totalRejected = 0;
  }

  updateCapacity(newCapacity: number): void {
    this.config.capacity = newCapacity;
    this.config.burstCapacity = Math.max(this.config.burstCapacity, newCapacity);
    this.state.tokens = Math.min(this.state.tokens, newCapacity);
  }

  getUtilization(): number {
    this.refill();
    return this.config.capacity > 0
      ? (this.config.capacity - this.state.tokens) / this.config.capacity
      : 0;
  }
}
