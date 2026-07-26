/**
 * BudgetAllocation — Configuration and options interface.
 */
export interface BudgetAllocation {
  category: string;
  allocated: number;
  used: number;
  remaining: number;
}

/**
 * ContextBudget — context budget.
 *
 * Methods: allocate, use, release, getUsage, getAllocations, isOverBudget, reset.
 */
export class ContextBudget {
  private allocations: Map<string, { allocated: number; used: number }> = new Map();

  private totalBudget: number;

  constructor(totalBudget = 128_000) {
    this.totalBudget = totalBudget;
  }

  allocate(category: string, limit: number): void {
    const totalAllocated = Array.from(this.allocations.values()).reduce(
      (s, a) => s + a.allocated,
      0,
    );
    if (totalAllocated + limit > this.totalBudget) {
      throw new Error(
        `Cannot allocate ${limit} for "${category}": exceeds total budget of ${this.totalBudget}`,
      );
    }
    this.allocations.set(category, { allocated: limit, used: 0 });
  }

  use(category: string, tokens: number): void {
    const entry = this.allocations.get(category);
    if (!entry) {
      throw new Error(`Category "${category}" has no allocation`);
    }
    entry.used += tokens;
  }

  release(category: string, tokens: number): void {
    const entry = this.allocations.get(category);
    if (!entry) {
      throw new Error(`Category "${category}" has no allocation`);
    }
    entry.used = Math.max(0, entry.used - tokens);
  }

  getUsage(category: string): { used: number; limit: number; remaining: number } {
    const entry = this.allocations.get(category);
    if (!entry) {
      throw new Error(`Category "${category}" has no allocation`);
    }
    return {
      used: entry.used,
      limit: entry.allocated,
      remaining: entry.allocated - entry.used,
    };
  }

  getAllocations(): BudgetAllocation[] {
    return Array.from(this.allocations.entries()).map(([category, entry]) => ({
      category,
      allocated: entry.allocated,
      used: entry.used,
      remaining: entry.allocated - entry.used,
    }));
  }

  isOverBudget(): boolean {
    for (const entry of this.allocations.values()) {
      if (entry.used > entry.allocated) return true;
    }
    return false;
  }

  reset(): void {
    this.allocations.clear();
  }
}
