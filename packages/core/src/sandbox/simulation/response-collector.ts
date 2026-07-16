import { randomUUID } from 'node:crypto';

// ============================================================
// Response Collector — Collect and query simulation responses
// ============================================================

export interface CollectedResponse {
  id: string;
  timestamp: number;
  scenarioId: string;
  response: unknown;
  metadata: Record<string, unknown>;
}

export class ResponseCollector {
  private responses: CollectedResponse[] = [];

  collect(
    scenarioId: string,
    response: unknown,
    metadata: Record<string, unknown> = {},
  ): CollectedResponse {
    const collected: CollectedResponse = {
      id: `response-${Date.now()}-${randomUUID().slice(0, 9)}`,
      timestamp: Date.now(),
      scenarioId,
      response,
      metadata,
    };

    this.responses.push(collected);
    return collected;
  }

  getResponsesByScenario(scenarioId: string): CollectedResponse[] {
    return this.responses.filter((r) => r.scenarioId === scenarioId);
  }

  getResponses(): CollectedResponse[] {
    return [...this.responses];
  }

  clear(): void {
    this.responses = [];
  }

  get count(): number {
    return this.responses.length;
  }
}
