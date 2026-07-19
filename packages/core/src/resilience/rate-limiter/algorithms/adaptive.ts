export interface AdaptiveConfig {
  baseLimit: number;
  minLimit: number;
  maxLimit: number;
  windowMs: number;
  emaAlpha: number;
  loadScaleFactor: number;
  cooldownMs: number;
}

export interface AdaptiveState {
  currentLimit: number;
  emaValue: number;
  lastAdjustment: number;
  consecutiveHigh: number;
  consecutiveLow: number;
  totalRequests: number;
  totalRejected: number;
  recentRequests: number[];
}

export interface AdaptiveConsumeResult {
  allowed: boolean;
  currentLimit: number;
  loadFactor: number;
  retryAfterMs: number;
}

export class AdaptiveRateLimiter {
  private config: AdaptiveConfig;
  private state: AdaptiveState;

  constructor(config: Partial<AdaptiveConfig> & Pick<AdaptiveConfig, 'baseLimit'>) {
    this.config = {
      baseLimit: config.baseLimit,
      minLimit: config.minLimit ?? Math.max(1, Math.floor(config.baseLimit * 0.1)),
      maxLimit: config.maxLimit ?? Math.floor(config.baseLimit * 3),
      windowMs: config.windowMs ?? 60_000,
      emaAlpha: config.emaAlpha ?? 0.3,
      loadScaleFactor: config.loadScaleFactor ?? 1.5,
      cooldownMs: config.cooldownMs ?? 10_000,
    };
    this.state = {
      currentLimit: this.config.baseLimit,
      emaValue: 0,
      lastAdjustment: Date.now(),
      consecutiveHigh: 0,
      consecutiveLow: 0,
      totalRequests: 0,
      totalRejected: 0,
      recentRequests: [],
    };
  }

  consume(): AdaptiveConsumeResult {
    const now = Date.now();
    this.pruneExpired(now);
    this.adjustLimit(now);

    const currentCount = this.state.recentRequests.length;
    const loadFactor = this.getLoadFactor();

    if (currentCount >= this.state.currentLimit) {
      this.state.totalRejected++;
      const retryAfterMs =
        this.state.recentRequests.length > 0
          ? Math.ceil(this.config.windowMs / this.state.currentLimit)
          : 0;
      return {
        allowed: false,
        currentLimit: this.state.currentLimit,
        loadFactor,
        retryAfterMs,
      };
    }

    this.state.recentRequests.push(now);
    this.state.totalRequests++;
    this.updateEMA(loadFactor);

    return {
      allowed: true,
      currentLimit: this.state.currentLimit,
      loadFactor,
      retryAfterMs: 0,
    };
  }

  private adjustLimit(now: number): void {
    if (now - this.state.lastAdjustment < this.config.cooldownMs) return;

    const load = this.getLoadFactor();

    if (load > 0.8) {
      this.state.consecutiveHigh++;
      this.state.consecutiveLow = 0;
    } else if (load < 0.3) {
      this.state.consecutiveLow++;
      this.state.consecutiveHigh = 0;
    } else {
      this.state.consecutiveHigh = 0;
      this.state.consecutiveLow = 0;
    }

    if (this.state.consecutiveHigh >= 3) {
      const reduction = Math.ceil(this.state.currentLimit * 0.2);
      this.state.currentLimit = Math.max(this.config.minLimit, this.state.currentLimit - reduction);
      this.state.lastAdjustment = now;
      this.state.consecutiveHigh = 0;
    } else if (this.state.consecutiveLow >= 3) {
      const increase = Math.ceil(this.state.currentLimit * 0.15);
      this.state.currentLimit = Math.min(this.config.maxLimit, this.state.currentLimit + increase);
      this.state.lastAdjustment = now;
      this.state.consecutiveLow = 0;
    }
  }

  private getLoadFactor(): number {
    const windowRequests = this.state.recentRequests.length;
    return this.state.currentLimit > 0 ? windowRequests / this.state.currentLimit : 0;
  }

  private updateEMA(loadFactor: number): void {
    this.state.emaValue =
      this.config.emaAlpha * loadFactor + (1 - this.config.emaAlpha) * this.state.emaValue;
  }

  private pruneExpired(now: number): void {
    const cutoff = now - this.config.windowMs;
    while (this.state.recentRequests.length > 0 && this.state.recentRequests[0] <= cutoff) {
      this.state.recentRequests.shift();
    }
  }

  getState(): AdaptiveState {
    this.pruneExpired(Date.now());
    return {
      ...this.state,
      recentRequests: [...this.state.recentRequests],
    };
  }

  getUtilization(): number {
    this.pruneExpired(Date.now());
    return this.state.currentLimit > 0
      ? this.state.recentRequests.length / this.state.currentLimit
      : 0;
  }

  forceAdjust(newLimit: number): void {
    this.state.currentLimit = Math.max(
      this.config.minLimit,
      Math.min(this.config.maxLimit, newLimit),
    );
    this.state.lastAdjustment = Date.now();
  }

  reset(): void {
    this.state = {
      currentLimit: this.config.baseLimit,
      emaValue: 0,
      lastAdjustment: Date.now(),
      consecutiveHigh: 0,
      consecutiveLow: 0,
      totalRequests: 0,
      totalRejected: 0,
      recentRequests: [],
    };
  }
}
