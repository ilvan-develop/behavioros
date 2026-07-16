export interface ThrottleConfig {
  thresholdPercent: number;
  delayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  recoveryThresholdPercent: number;
}

export interface ThrottleDecision {
  throttled: boolean;
  delayMs: number;
  reason: string;
  utilizationPercent: number;
}

export class ThrottleEscalation {
  private config: ThrottleConfig;
  private activeThrottles: Map<string, { delayMs: number; since: number }> = new Map();

  constructor(config?: Partial<ThrottleConfig>) {
    this.config = {
      thresholdPercent: config?.thresholdPercent ?? 90,
      delayMs: config?.delayMs ?? 100,
      maxDelayMs: config?.maxDelayMs ?? 5000,
      backoffMultiplier: config?.backoffMultiplier ?? 1.5,
      recoveryThresholdPercent: config?.recoveryThresholdPercent ?? 70,
    };
  }

  check(targetId: string, utilizationPercent: number): ThrottleDecision {
    if (utilizationPercent < this.config.thresholdPercent) {
      const wasThrottled = this.activeThrottles.has(targetId);
      if (utilizationPercent <= this.config.recoveryThresholdPercent) {
        this.activeThrottles.delete(targetId);
      }
      return {
        throttled: false,
        delayMs: 0,
        reason: wasThrottled
          ? `Throttle released for "${targetId}" — utilization ${utilizationPercent.toFixed(1)}% below recovery threshold`
          : `Utilization ${utilizationPercent.toFixed(1)}% within normal range`,
        utilizationPercent,
      };
    }

    const existing = this.activeThrottles.get(targetId);
    const newDelay = existing
      ? Math.min(existing.delayMs * this.config.backoffMultiplier, this.config.maxDelayMs)
      : this.config.delayMs;

    this.activeThrottles.set(targetId, {
      delayMs: newDelay,
      since: Date.now(),
    });

    return {
      throttled: true,
      delayMs: Math.round(newDelay),
      reason: `Throttling "${targetId}" — utilization ${utilizationPercent.toFixed(1)}% exceeds ${this.config.thresholdPercent}% threshold (delay: ${Math.round(newDelay)}ms)`,
      utilizationPercent,
    };
  }

  isThrottled(targetId: string): boolean {
    return this.activeThrottles.has(targetId);
  }

  getThrottleDelay(targetId: string): number {
    return this.activeThrottles.get(targetId)?.delayMs ?? 0;
  }

  forceRelease(targetId: string): boolean {
    return this.activeThrottles.delete(targetId);
  }

  forceReleaseAll(): void {
    this.activeThrottles.clear();
  }

  getActiveThrottles(): Map<string, { delayMs: number; since: number }> {
    return new Map(this.activeThrottles);
  }
}
