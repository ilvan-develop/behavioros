import { type AdaptiveConfig, AdaptiveRateLimiter } from './algorithms/adaptive';
import { SlidingWindow, type SlidingWindowConfig } from './algorithms/sliding-window';
import { TokenBucket, type TokenBucketConfig } from './algorithms/token-bucket';
import { type BlockConfig, BlockEscalation, type BlockResult } from './escalation/block';
import {
  type ThrottleConfig,
  type ThrottleDecision,
  ThrottleEscalation,
} from './escalation/throttle';
import { type WarningConfig, WarningEscalation, type WarningEvent } from './escalation/warning';
import { type ActionRateLimit, type ActionType, PerActionPolicy } from './policies/per-action';
import { type AgentRateLimit, type AuthorityLevel, PerAgentPolicy } from './policies/per-agent';
import { type DNAMode, type DNARateLimit, PerDNAPolicy } from './policies/per-dna';

export type AlgorithmType = 'token-bucket' | 'sliding-window' | 'adaptive';

export interface RateLimitRequest {
  agentId: string;
  authority: AuthorityLevel;
  dnaId: string;
  dnaMode: DNAMode;
  action: string;
  actionType?: ActionType;
}

export interface RateLimitResult {
  allowed: boolean;
  reason: string;
  algorithm: AlgorithmType;
  utilization: number;
  tokensRemaining?: number;
  waitMs?: number;
  retryAfterMs?: number;
  throttleDelayMs?: number;
  blockExpiresAt?: string;
  warning?: WarningEvent;
}

export interface RateLimiterConfig {
  algorithm: AlgorithmType;
  tokenBucket?: Partial<TokenBucketConfig>;
  slidingWindow?: Partial<SlidingWindowConfig>;
  adaptive?: Partial<AdaptiveConfig>;
  perAgent?: Partial<PerAgentPolicyConfig>;
  perDNA?: Partial<PerDNAPolicyConfig>;
  perAction?: Partial<PerActionPolicyConfig>;
  warning?: Partial<WarningConfig>;
  throttle?: Partial<ThrottleConfig>;
  block?: Partial<BlockConfig>;
  dynamicScaling: boolean;
  globalMaxRequests: number;
  globalWindowMs: number;
}

interface PerAgentPolicyConfig {
  defaultLimits: Record<AuthorityLevel, AgentRateLimit>;
  customLimits: Map<string, AgentRateLimit>;
  fallbackPolicy: 'block' | 'throttle' | 'allow';
}

interface PerDNAPolicyConfig {
  modeLimits: Record<DNAMode, DNARateLimit>;
  dnaOverrides: Map<string, DNARateLimit>;
}

interface PerActionPolicyConfig {
  actionLimits: Record<ActionType, ActionRateLimit>;
  actionAliases: Map<string, ActionType>;
}

interface AgentBucket {
  bucket: TokenBucket | SlidingWindow | AdaptiveRateLimiter;
  lastAccess: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private agentBuckets: Map<string, AgentBucket> = new Map();
  private dnaBuckets: Map<string, AgentBucket> = new Map();
  private actionBuckets: Map<string, AgentBucket> = new Map();
  private globalBucket: TokenBucket;
  private perAgentPolicy: PerAgentPolicy;
  private perDNAPolicy: PerDNAPolicy;
  private perActionPolicy: PerActionPolicy;
  private warningEscalation: WarningEscalation;
  private throttleEscalation: ThrottleEscalation;
  private blockEscalation: BlockEscalation;
  private stats = {
    totalRequests: 0,
    totalAllowed: 0,
    totalBlocked: 0,
    totalThrottled: 0,
    totalWarnings: 0,
  };

  constructor(config?: Partial<RateLimiterConfig>) {
    this.config = {
      algorithm: config?.algorithm ?? 'token-bucket',
      tokenBucket: config?.tokenBucket,
      slidingWindow: config?.slidingWindow,
      adaptive: config?.adaptive,
      perAgent: config?.perAgent,
      perDNA: config?.perDNA,
      perAction: config?.perAction,
      warning: config?.warning,
      throttle: config?.throttle,
      block: config?.block,
      dynamicScaling: config?.dynamicScaling ?? true,
      globalMaxRequests: config?.globalMaxRequests ?? 1000,
      globalWindowMs: config?.globalWindowMs ?? 60_000,
    };

    this.globalBucket = new TokenBucket({
      capacity: this.config.globalMaxRequests,
      refillRate: Math.ceil(this.config.globalMaxRequests / (this.config.globalWindowMs / 1000)),
      refillIntervalMs: 1000,
    });

    this.perAgentPolicy = new PerAgentPolicy(this.config.perAgent);
    this.perDNAPolicy = new PerDNAPolicy(this.config.perDNA);
    this.perActionPolicy = new PerActionPolicy(this.config.perAction);
    this.warningEscalation = new WarningEscalation(this.config.warning);
    this.throttleEscalation = new ThrottleEscalation(this.config.throttle);
    this.blockEscalation = new BlockEscalation(this.config.block);
  }

  check(request: RateLimitRequest): RateLimitResult {
    this.stats.totalRequests++;
    const warning = this.checkWarning(request);

    const blockResult = this.checkBlock(request);
    if (blockResult.blocked) {
      this.stats.totalBlocked++;
      return {
        allowed: false,
        reason: blockResult.reason,
        algorithm: this.config.algorithm,
        utilization: 100,
        blockExpiresAt: blockResult.expiresAt,
        warning,
      };
    }

    const agentCheck = this.checkAgentLimit(request);
    if (!agentCheck.allowed) {
      const throttleCheck = this.checkThrottle(request, agentCheck.utilization);
      if (throttleCheck.throttled) {
        this.stats.totalThrottled++;
        return {
          allowed: false,
          reason: throttleCheck.reason,
          algorithm: this.config.algorithm,
          utilization: agentCheck.utilization,
          waitMs: throttleCheck.delayMs,
          throttleDelayMs: throttleCheck.delayMs,
          warning,
        };
      }
      this.stats.totalBlocked++;
      return {
        allowed: false,
        reason: agentCheck.reason,
        algorithm: this.config.algorithm,
        utilization: agentCheck.utilization,
        retryAfterMs: agentCheck.retryAfterMs,
        warning,
      };
    }

    const dnaCheck = this.checkDNALimit(request);
    if (!dnaCheck.allowed) {
      this.stats.totalBlocked++;
      return {
        allowed: false,
        reason: dnaCheck.reason,
        algorithm: this.config.algorithm,
        utilization: dnaCheck.utilization,
        retryAfterMs: dnaCheck.retryAfterMs,
        warning,
      };
    }

    const actionCheck = this.checkActionLimit(request);
    if (!actionCheck.allowed) {
      this.stats.totalBlocked++;
      return {
        allowed: false,
        reason: actionCheck.reason,
        algorithm: this.config.algorithm,
        utilization: actionCheck.utilization,
        retryAfterMs: actionCheck.retryAfterMs,
        warning,
      };
    }

    const globalCheck = this.globalBucket.consume();
    if (!globalCheck.allowed) {
      this.stats.totalBlocked++;
      return {
        allowed: false,
        reason: `Global rate limit exceeded — ${globalCheck.tokensRemaining} tokens remaining, retry in ${globalCheck.waitMs}ms`,
        algorithm: this.config.algorithm,
        utilization: this.globalBucket.getUtilization(),
        waitMs: globalCheck.waitMs,
        retryAfterMs: globalCheck.retryAfterMs,
        warning,
      };
    }

    this.stats.totalAllowed++;
    return {
      allowed: true,
      reason: `Request allowed — utilization ${agentCheck.utilization.toFixed(1)}%`,
      algorithm: this.config.algorithm,
      utilization: agentCheck.utilization,
      tokensRemaining: globalCheck.tokensRemaining,
      warning,
    };
  }

  private checkAgentLimit(request: RateLimitRequest): {
    allowed: boolean;
    reason: string;
    utilization: number;
    retryAfterMs: number;
  } {
    const limit = this.perAgentPolicy.getLimitForAgent(request.agentId, request.authority);
    const bucketKey = `agent:${request.agentId}`;
    const bucket = this.getOrCreateBucket(bucketKey, limit.maxRequests, limit.windowMs);

    if (bucket instanceof TokenBucket) {
      const result = bucket.consume();
      return {
        allowed: result.allowed,
        reason: result.allowed
          ? ''
          : `Agent "${request.agentId}" rate limit exceeded — ${result.tokensRemaining} tokens remaining, retry in ${result.waitMs}ms`,
        utilization: bucket.getUtilization(),
        retryAfterMs: result.retryAfterMs,
      };
    }

    if (bucket instanceof SlidingWindow) {
      const result = bucket.consume();
      return {
        allowed: result.allowed,
        reason: result.allowed
          ? ''
          : `Agent "${request.agentId}" rate limit exceeded — ${result.currentCount}/${result.limit} requests, retry in ${result.retryAfterMs}ms`,
        utilization: bucket.getUtilization(),
        retryAfterMs: result.retryAfterMs,
      };
    }

    const result = bucket.consume();
    return {
      allowed: result.allowed,
      reason: result.allowed
        ? ''
        : `Agent "${request.agentId}" rate limit exceeded — current limit ${result.currentLimit}, load factor ${result.loadFactor.toFixed(2)}`,
      utilization: bucket.getUtilization(),
      retryAfterMs: result.retryAfterMs,
    };
  }

  private checkDNALimit(request: RateLimitRequest): {
    allowed: boolean;
    reason: string;
    utilization: number;
    retryAfterMs: number;
  } {
    const limit = this.perDNAPolicy.getLimitForDNA(request.dnaId, request.dnaMode);
    const bucketKey = `dna:${request.dnaId}`;
    const bucket = this.getOrCreateBucket(bucketKey, limit.maxRequests, limit.windowMs);

    if (bucket instanceof TokenBucket) {
      const result = bucket.consume();
      return {
        allowed: result.allowed,
        reason: result.allowed
          ? ''
          : `DNA "${request.dnaId}" rate limit exceeded — retry in ${result.waitMs}ms`,
        utilization: bucket.getUtilization(),
        retryAfterMs: result.retryAfterMs,
      };
    }

    if (bucket instanceof SlidingWindow) {
      const result = bucket.consume();
      return {
        allowed: result.allowed,
        reason: result.allowed
          ? ''
          : `DNA "${request.dnaId}" rate limit exceeded — ${result.currentCount}/${result.limit} requests, retry in ${result.retryAfterMs}ms`,
        utilization: bucket.getUtilization(),
        retryAfterMs: result.retryAfterMs,
      };
    }

    const result = bucket.consume();
    return {
      allowed: result.allowed,
      reason: result.allowed
        ? ''
        : `DNA "${request.dnaId}" rate limit exceeded — current limit ${result.currentLimit}`,
      utilization: bucket.getUtilization(),
      retryAfterMs: result.retryAfterMs,
    };
  }

  private checkActionLimit(request: RateLimitRequest): {
    allowed: boolean;
    reason: string;
    utilization: number;
    retryAfterMs: number;
  } {
    const actionType = request.actionType ?? this.perActionPolicy.resolveActionType(request.action);
    const limit = this.perActionPolicy.getLimitForAction(request.action);
    const bucketKey = `action:${actionType}`;
    const bucket = this.getOrCreateBucket(bucketKey, limit.maxRequests, limit.windowMs);

    if (bucket instanceof TokenBucket) {
      const result = bucket.consume();
      return {
        allowed: result.allowed,
        reason: result.allowed
          ? ''
          : `Action type "${actionType}" rate limit exceeded — retry in ${result.waitMs}ms`,
        utilization: bucket.getUtilization(),
        retryAfterMs: result.retryAfterMs,
      };
    }

    if (bucket instanceof SlidingWindow) {
      const result = bucket.consume();
      return {
        allowed: result.allowed,
        reason: result.allowed
          ? ''
          : `Action type "${actionType}" rate limit exceeded — ${result.currentCount}/${result.limit} requests, retry in ${result.retryAfterMs}ms`,
        utilization: bucket.getUtilization(),
        retryAfterMs: result.retryAfterMs,
      };
    }

    const result = bucket.consume();
    return {
      allowed: result.allowed,
      reason: result.allowed
        ? ''
        : `Action type "${actionType}" rate limit exceeded — current limit ${result.currentLimit}`,
      utilization: bucket.getUtilization(),
      retryAfterMs: result.retryAfterMs,
    };
  }

  private checkWarning(request: RateLimitRequest): WarningEvent | undefined {
    const agentBucket = this.agentBuckets.get(`agent:${request.agentId}`);
    if (agentBucket) {
      const utilization = this.getBucketUtilization(agentBucket.bucket);
      const warning = this.warningEscalation.check(request.agentId, 'agent', utilization);
      if (warning) this.stats.totalWarnings++;
      return warning;
    }
    return undefined;
  }

  private checkBlock(request: RateLimitRequest): BlockResult {
    const agentBucket = this.agentBuckets.get(`agent:${request.agentId}`);
    if (agentBucket) {
      const utilization = this.getBucketUtilization(agentBucket.bucket);
      return this.blockEscalation.check(request.agentId, utilization);
    }
    return { blocked: false, reason: '' };
  }

  private checkThrottle(request: RateLimitRequest, utilization: number): ThrottleDecision {
    return this.throttleEscalation.check(request.agentId, utilization);
  }

  private getOrCreateBucket(
    key: string,
    limit: number,
    windowMs: number,
  ): TokenBucket | SlidingWindow | AdaptiveRateLimiter {
    const existing =
      this.agentBuckets.get(key) ?? this.dnaBuckets.get(key) ?? this.actionBuckets.get(key);
    if (existing) {
      existing.lastAccess = Date.now();
      return existing.bucket;
    }

    let bucket: TokenBucket | SlidingWindow | AdaptiveRateLimiter;

    switch (this.config.algorithm) {
      case 'token-bucket':
        bucket = new TokenBucket({
          capacity: limit,
          refillRate: Math.ceil(limit / (windowMs / 1000)),
          refillIntervalMs: 1000,
          burstCapacity: this.config.tokenBucket?.burstCapacity ?? Math.ceil(limit * 1.5),
        });
        break;

      case 'sliding-window':
        bucket = new SlidingWindow({
          windowMs,
          maxRequests: limit,
          minSpacingMs: this.config.slidingWindow?.minSpacingMs,
        });
        break;

      case 'adaptive':
        bucket = new AdaptiveRateLimiter({
          baseLimit: limit,
          minLimit: Math.max(1, Math.floor(limit * 0.1)),
          maxLimit: Math.floor(limit * 3),
          windowMs,
          emaAlpha: this.config.adaptive?.emaAlpha ?? 0.3,
          loadScaleFactor: this.config.adaptive?.loadScaleFactor ?? 1.5,
          cooldownMs: this.config.adaptive?.cooldownMs ?? 10_000,
        });
        break;
    }

    const entry: AgentBucket = { bucket, lastAccess: Date.now() };
    if (key.startsWith('agent:')) this.agentBuckets.set(key, entry);
    else if (key.startsWith('dna:')) this.dnaBuckets.set(key, entry);
    else this.actionBuckets.set(key, entry);

    return bucket;
  }

  private getBucketUtilization(bucket: TokenBucket | SlidingWindow | AdaptiveRateLimiter): number {
    return bucket.getUtilization();
  }

  getStats() {
    return { ...this.stats };
  }

  getWarnings(targetId?: string): WarningEvent[] {
    return this.warningEscalation.getWarnings(targetId);
  }

  getActiveBlocks() {
    return this.blockEscalation.getActiveBlocks();
  }

  isBlocked(targetId: string): boolean {
    return this.blockEscalation.isBlocked(targetId);
  }

  forceBlock(targetId: string, durationMs?: number): BlockResult {
    return this.blockEscalation.forceBlock(targetId, 'agent', durationMs);
  }

  resetAgent(agentId: string): void {
    this.agentBuckets.delete(`agent:${agentId}`);
    this.warningEscalation.reset(agentId);
    this.throttleEscalation.forceRelease(agentId);
    this.blockEscalation.reset(agentId);
  }

  resetAll(): void {
    this.agentBuckets.clear();
    this.dnaBuckets.clear();
    this.actionBuckets.clear();
    this.globalBucket.reset();
    this.warningEscalation.resetAll();
    this.throttleEscalation.forceReleaseAll();
    this.blockEscalation.resetAll();
    this.stats = {
      totalRequests: 0,
      totalAllowed: 0,
      totalBlocked: 0,
      totalThrottled: 0,
      totalWarnings: 0,
    };
  }

  prune(maxAgeMs: number = 300_000): number {
    const cutoff = Date.now() - maxAgeMs;
    let pruned = 0;

    for (const [key, entry] of this.agentBuckets) {
      if (entry.lastAccess < cutoff) {
        this.agentBuckets.delete(key);
        pruned++;
      }
    }
    for (const [key, entry] of this.dnaBuckets) {
      if (entry.lastAccess < cutoff) {
        this.dnaBuckets.delete(key);
        pruned++;
      }
    }
    for (const [key, entry] of this.actionBuckets) {
      if (entry.lastAccess < cutoff) {
        this.actionBuckets.delete(key);
        pruned++;
      }
    }

    return pruned;
  }
}
