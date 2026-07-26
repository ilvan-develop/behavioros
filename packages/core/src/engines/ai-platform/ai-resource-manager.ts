/**
 * TokenBudget — Configuration and options interface.
 */
export interface TokenBudget {
  modelId: string;
  inputTokensUsed: number;
  outputTokensUsed: number;
  inputLimit: number;
  outputLimit: number;
  periodMs: number;
  resetAt: string;
}

/**
 * ResourceUsage — Configuration and options interface.
 */
export interface ResourceUsage {
  modelId: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  requests: number;
  concurrentRequests: number;
}

interface RateLimitConfig {
  maxRPM: number;
  maxTPM: number;
  rpmCount: number;
  tpmCount: number;
  rpmWindowStart: number;
  tpmWindowStart: number;
}

interface ModelState {
  inputTokensUsed: number;
  outputTokensUsed: number;
  inputLimit: number;
  outputLimit: number;
  periodMs: number;
  resetAt: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  requests: number;
  concurrencyLimit: number;
  concurrentSlots: number;
  rateLimit: RateLimitConfig | null;
}

/**
 * AIResourceManager — a i resource manager.
 *
 * Methods: trackTokens, checkLimit, setTokenLimit, setRateLimit, setConcurrencyLimit, acquireSlot, and 4 more.
 */
export class AIResourceManager {
  private models: Map<string, ModelState> = new Map();

  constructor() {
    this.models = new Map();
  }

  private ensureModel(modelId: string): ModelState {
    let state = this.models.get(modelId);
    if (!state) {
      state = {
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        inputLimit: Infinity,
        outputLimit: Infinity,
        periodMs: 60_000,
        resetAt: new Date(Date.now() + 60_000).toISOString(),
        tokensInput: 0,
        tokensOutput: 0,
        cost: 0,
        requests: 0,
        concurrencyLimit: 5,
        concurrentSlots: 0,
        rateLimit: null,
      };
      this.models.set(modelId, state);
    }
    return state;
  }

  trackTokens(modelId: string, input: number, output: number, cost: number): void {
    const state = this.ensureModel(modelId);
    state.tokensInput += input;
    state.tokensOutput += output;
    state.cost += cost;
    state.requests += 1;
    state.inputTokensUsed += input;
    state.outputTokensUsed += output;

    if (state.rateLimit) {
      const now = Date.now();
      if (now - state.rateLimit.rpmWindowStart >= 60_000) {
        state.rateLimit.rpmCount = 0;
        state.rateLimit.rpmWindowStart = now;
      }
      if (now - state.rateLimit.tpmWindowStart >= 60_000) {
        state.rateLimit.tpmCount = 0;
        state.rateLimit.tpmWindowStart = now;
      }
      state.rateLimit.rpmCount += 1;
      state.rateLimit.tpmCount += input + output;
    }
  }

  checkLimit(modelId: string): { allowed: boolean; reason?: string } {
    const state = this.models.get(modelId);
    if (!state) return { allowed: true };

    const now = Date.now();
    const resetTime = new Date(state.resetAt).getTime();

    if (now >= resetTime) {
      state.inputTokensUsed = 0;
      state.outputTokensUsed = 0;
      state.resetAt = new Date(now + state.periodMs).toISOString();
    }

    if (state.inputTokensUsed > state.inputLimit) {
      return {
        allowed: false,
        reason: `Input token limit exceeded: ${state.inputTokensUsed}/${state.inputLimit}`,
      };
    }
    if (state.outputTokensUsed > state.outputLimit) {
      return {
        allowed: false,
        reason: `Output token limit exceeded: ${state.outputTokensUsed}/${state.outputLimit}`,
      };
    }

    if (state.rateLimit) {
      if (state.rateLimit.rpmCount >= state.rateLimit.maxRPM) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: ${state.rateLimit.rpmCount}/${state.rateLimit.maxRPM} RPM`,
        };
      }
      if (state.rateLimit.tpmCount >= state.rateLimit.maxTPM) {
        return {
          allowed: false,
          reason: `Token rate limit exceeded: ${state.rateLimit.tpmCount}/${state.rateLimit.maxTPM} TPM`,
        };
      }
    }

    return { allowed: true };
  }

  setTokenLimit(modelId: string, inputLimit: number, outputLimit: number, periodMs = 60_000): void {
    const state = this.ensureModel(modelId);
    state.inputLimit = inputLimit;
    state.outputLimit = outputLimit;
    state.periodMs = periodMs;
    state.resetAt = new Date(Date.now() + periodMs).toISOString();
  }

  setRateLimit(modelId: string, maxRPM: number, maxTPM: number): void {
    const state = this.ensureModel(modelId);
    state.rateLimit = {
      maxRPM,
      maxTPM,
      rpmCount: 0,
      tpmCount: 0,
      rpmWindowStart: Date.now(),
      tpmWindowStart: Date.now(),
    };
  }

  setConcurrencyLimit(modelId: string, max: number): void {
    const state = this.ensureModel(modelId);
    state.concurrencyLimit = max;
  }

  acquireSlot(modelId: string): boolean {
    const state = this.ensureModel(modelId);
    if (state.concurrentSlots >= state.concurrencyLimit) return false;
    state.concurrentSlots += 1;
    return true;
  }

  releaseSlot(modelId: string): void {
    const state = this.models.get(modelId);
    if (state) {
      state.concurrentSlots = Math.max(0, state.concurrentSlots - 1);
    }
  }

  getUsage(modelId?: string): ResourceUsage[] {
    if (modelId) {
      const state = this.models.get(modelId);
      if (!state) return [];
      return [
        {
          modelId,
          tokensInput: state.tokensInput,
          tokensOutput: state.tokensOutput,
          cost: state.cost,
          requests: state.requests,
          concurrentRequests: state.concurrentSlots,
        },
      ];
    }

    const result: ResourceUsage[] = [];
    for (const [id, state] of this.models) {
      result.push({
        modelId: id,
        tokensInput: state.tokensInput,
        tokensOutput: state.tokensOutput,
        cost: state.cost,
        requests: state.requests,
        concurrentRequests: state.concurrentSlots,
      });
    }
    return result;
  }

  getTotalCost(): number {
    let total = 0;
    for (const state of this.models.values()) {
      total += state.cost;
    }
    return total;
  }

  reset(modelId?: string): void {
    if (modelId) {
      this.models.delete(modelId);
    } else {
      this.models.clear();
    }
  }
}
