/**
 * Budget — Configuration and options interface.
 */
export interface Budget {
  id: string;
  name: string;
  amount: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  spent: number;
  alerts: number[];
  notified: number[];
}

/**
 * ChargebackAllocation — Configuration and options interface.
 */
export interface ChargebackAllocation {
  team: string;
  project: string;
  amount: number;
  resources: { type: string; cost: number }[];
  period: string;
}

/**
 * CostOptimization — Configuration and options interface.
 */
export interface CostOptimization {
  resourceId: string;
  currentCost: number;
  projectedCost: number;
  savings: number;
  recommendation: string;
  effort: 'low' | 'medium' | 'high';
}

/**
 * FinOpsEngine — Provides setBudget, getBudget, trackCost, getTotalCost, ... operations.
 */
export class FinOpsEngine {
  private budgets = new Map<string, Budget>();
  private costs: {
    category: string;
    amount: number;
    timestamp: Date;
    metadata?: Record<string, unknown>;
  }[] = [];
  private chargebacks: ChargebackAllocation[] = [];

  setBudget(budget: Budget): void {
    this.budgets.set(budget.id, { ...budget, notified: [...budget.notified] });
  }

  getBudget(id: string): Budget | undefined {
    const b = this.budgets.get(id);
    return b ? { ...b, notified: [...b.notified] } : undefined;
  }

  trackCost(category: string, amount: number, metadata?: Record<string, unknown>): void {
    this.costs.push({ category, amount, timestamp: new Date(), metadata });
  }

  getTotalCost(period?: string): number {
    if (!period) {
      return this.costs.reduce((sum, c) => sum + c.amount, 0);
    }
    const now = new Date();
    return this.costs
      .filter((c) => this.isInPeriod(c.timestamp, period, now))
      .reduce((sum, c) => sum + c.amount, 0);
  }

  getCostByCategory(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const c of this.costs) {
      result[c.category] = (result[c.category] || 0) + c.amount;
    }
    return result;
  }

  checkBudgetAlerts(id: string): string[] {
    const budget = this.budgets.get(id);
    if (!budget) return [];

    const messages: string[] = [];
    const usagePct = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;

    for (const threshold of budget.alerts) {
      if (usagePct >= threshold && !budget.notified.includes(threshold)) {
        budget.notified.push(threshold);
        messages.push(
          `Budget "${budget.name}" has crossed ${threshold}% threshold (actual: ${usagePct.toFixed(1)}%)`,
        );
      }
    }

    return messages;
  }

  allocateCost(
    team: string,
    project: string,
    amount: number,
    resources?: { type: string; cost: number }[],
  ): void {
    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    this.chargebacks.push({
      team,
      project,
      amount,
      resources: resources ?? [],
      period,
    });
  }

  getChargeback(team?: string): ChargebackAllocation[] {
    if (!team) return [...this.chargebacks];
    return this.chargebacks.filter((c) => c.team === team);
  }

  optimize(): CostOptimization[] {
    return [
      {
        resourceId: 'compute-instance-01',
        currentCost: 1200,
        projectedCost: 720,
        savings: 480,
        recommendation: 'Resize from m5.xlarge to m5.large (underutilized by 60%)',
        effort: 'low',
      },
      {
        resourceId: 'storage-bucket-02',
        currentCost: 800,
        projectedCost: 320,
        savings: 480,
        recommendation: 'Transition infrequently accessed data to S3 Glacier',
        effort: 'medium',
      },
      {
        resourceId: 'rds-instance-03',
        currentCost: 2400,
        projectedCost: 1200,
        savings: 1200,
        recommendation: 'Switch to reserved instances for steady-state workloads',
        effort: 'high',
      },
    ];
  }

  forecast(months: number): { month: string; projected: number }[] {
    const now = new Date();
    const total = this.getTotalCost();
    const avgMonthly = total > 0 ? (total / Math.max(1, this.costs.length)) * 30 : 1000;

    const result: { month: string; projected: number }[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const growth = 1 + i * 0.02;
      result.push({ month: label, projected: Math.round(avgMonthly * growth) });
    }
    return result;
  }

  private isInPeriod(date: Date, period: string, now: Date): boolean {
    const year = date.getFullYear();
    const month = date.getMonth();
    switch (period) {
      case 'monthly':
        return year === now.getFullYear() && month === now.getMonth();
      case 'quarterly': {
        const q = Math.floor(month / 3);
        const nowQ = Math.floor(now.getMonth() / 3);
        return year === now.getFullYear() && q === nowQ;
      }
      case 'yearly':
        return year === now.getFullYear();
      default:
        return true;
    }
  }
}
