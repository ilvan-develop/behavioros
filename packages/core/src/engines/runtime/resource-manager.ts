/**
 * ResourceBudget — Configuration and options interface.
 */
export interface ResourceBudget {
  maxConcurrent: number;
  maxMemoryMB: number;
  maxTokens: number;
}

/**
 * ResourceUsage — Configuration and options interface.
 */
export interface ResourceUsage {
  concurrent: number;
  memoryMB: number;
  tokens: number;
}

/**
 * ResourceManager — resource manager.
 *
 * Methods: acquire, release, getAvailableConcurrency, getAvailableTokens, getUsage, reset.
 */
export class ResourceManager {
  private budget: Required<ResourceBudget>;
  private concurrent = 0;
  private memoryMB = 0;
  private tokens = 0;

  constructor(budget?: Partial<ResourceBudget>) {
    this.budget = {
      maxConcurrent: 10,
      maxMemoryMB: 512,
      maxTokens: 100000,
      ...budget,
    };
  }

  acquire(slots = 1): boolean {
    if (this.concurrent + slots > this.budget.maxConcurrent) return false;
    this.concurrent += slots;
    return true;
  }

  release(slots = 1): void {
    this.concurrent = Math.max(0, this.concurrent - slots);
  }

  getAvailableConcurrency(): number {
    return this.budget.maxConcurrent - this.concurrent;
  }

  getAvailableTokens(): number {
    return this.budget.maxTokens - this.tokens;
  }

  getUsage(): ResourceUsage {
    return {
      concurrent: this.concurrent,
      memoryMB: this.memoryMB,
      tokens: this.tokens,
    };
  }

  reset(): void {
    this.concurrent = 0;
    this.memoryMB = 0;
    this.tokens = 0;
  }
}
