/**
 * ModelMetrics — Configuration and options interface.
 */
export interface ModelMetrics {
  modelId: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  requestCount: number;
  errorCount: number;
  avgLatency: number;
  p95Latency: number;
}

interface RequestRecord {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  cost: number;
  success: boolean;
  timestamp: number;
}

/**
 * AIMetrics — a i metrics.
 *
 * Methods: recordRequest, getModelMetrics, getAllMetrics, getErrorRate, getAverageLatency.
 */
export class AIMetrics {
  private requests: RequestRecord[] = [];

  recordRequest(
    modelId: string,
    inputTokens: number,
    outputTokens: number,
    latency: number,
    cost: number,
    success: boolean,
  ): void {
    this.requests.push({
      modelId,
      inputTokens,
      outputTokens,
      latency,
      cost,
      success,
      timestamp: Date.now(),
    });
  }

  getModelMetrics(modelId: string): ModelMetrics | undefined {
    const records = this.requests.filter((r) => r.modelId === modelId);
    if (records.length === 0) return undefined;

    const totalTokens = records.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
    const inputTokens = records.reduce((s, r) => s + r.inputTokens, 0);
    const outputTokens = records.reduce((s, r) => s + r.outputTokens, 0);
    const totalCost = records.reduce((s, r) => s + r.cost, 0);
    const requestCount = records.length;
    const errorCount = records.filter((r) => !r.success).length;
    const avgLatency = records.reduce((s, r) => s + r.latency, 0) / records.length;

    const sortedLatencies = records.map((r) => r.latency).sort((a, b) => a - b);
    const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
    const p95Latency = sortedLatencies[Math.max(0, p95Index)];

    return {
      modelId,
      totalTokens,
      inputTokens,
      outputTokens,
      totalCost,
      requestCount,
      errorCount,
      avgLatency,
      p95Latency,
    };
  }

  getAllMetrics(): ModelMetrics[] {
    const modelIds = [...new Set(this.requests.map((r) => r.modelId))];
    return modelIds
      .map((id) => this.getModelMetrics(id))
      .filter((m): m is ModelMetrics => m !== undefined);
  }

  getErrorRate(modelId: string): number {
    const records = this.requests.filter((r) => r.modelId === modelId);
    if (records.length === 0) return 0;
    return records.filter((r) => !r.success).length / records.length;
  }

  getAverageLatency(modelId: string): number {
    const records = this.requests.filter((r) => r.modelId === modelId);
    if (records.length === 0) return 0;
    return records.reduce((s, r) => s + r.latency, 0) / records.length;
  }
}
