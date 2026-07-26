/**
 * CostEntry — Configuration and options interface.
 */
export interface CostEntry {
  modelId: string;
  provider: string;
  taskType: string;
  cost: number;
  tokens: number;
  timestamp: string;
}

/**
 * CostMetrics — cost metrics.
 *
 * Methods: record, getTotalCost, getCostByModel, getCostByProvider, getCostByTask, getDailyCost, forecast.
 */
export class CostMetrics {
  private entries: CostEntry[] = [];

  record(entry: Omit<CostEntry, 'timestamp'>): void {
    this.entries.push({ ...entry, timestamp: new Date().toISOString() });
  }

  getTotalCost(modelId?: string, provider?: string): number {
    return this.filterEntries(modelId, provider).reduce((s, e) => s + e.cost, 0);
  }

  getCostByModel(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.modelId] = (result[entry.modelId] ?? 0) + entry.cost;
    }
    return result;
  }

  getCostByProvider(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.provider] = (result[entry.provider] ?? 0) + entry.cost;
    }
    return result;
  }

  getCostByTask(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const entry of this.entries) {
      result[entry.taskType] = (result[entry.taskType] ?? 0) + entry.cost;
    }
    return result;
  }

  getDailyCost(days: number = 7): { date: string; cost: number }[] {
    const now = Date.now();
    const dayMap = new Map<string, number>();

    for (let i = 0; i < days; i++) {
      const d = new Date(now - i * 86_400_000);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }

    for (const entry of this.entries) {
      const dateKey = entry.timestamp.slice(0, 10);
      if (dayMap.has(dateKey)) {
        dayMap.set(dateKey, dayMap.get(dateKey)! + entry.cost);
      }
    }

    return Array.from(dayMap.entries())
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  forecast(days: number): number {
    const daily = this.getDailyCost();
    if (daily.length === 0) return 0;

    const totalCost = daily.reduce((s, d) => s + d.cost, 0);
    const avgDailyCost = totalCost / daily.length;
    return avgDailyCost * days;
  }

  private filterEntries(modelId?: string, provider?: string): CostEntry[] {
    return this.entries.filter(
      (e) =>
        (modelId === undefined || e.modelId === modelId) &&
        (provider === undefined || e.provider === provider),
    );
  }
}
