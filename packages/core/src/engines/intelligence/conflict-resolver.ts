import crypto from 'node:crypto';

/**
 * ConflictStrategy — Union type: merge, override, human-review;.
 */
export type ConflictStrategy = 'merge' | 'override' | 'human-review';

/**
 * ConflictResolution — Configuration and options interface.
 */
export interface ConflictResolution {
  id: string;
  agentA: string;
  agentB: string;
  context: string;
  strategy: ConflictStrategy;
  resolution: string;
  resolvedAt: string;
}

/**
 * ConflictResolver — conflict resolver.
 *
 * Methods: resolve, getHistory.
 */
export class ConflictResolver {
  private history: ConflictResolution[] = [];

  resolve(
    agentA: string,
    agentB: string,
    context: string,
    strategy: ConflictStrategy,
    payloadA: unknown,
    payloadB: unknown,
  ): ConflictResolution {
    let resolution: string;

    switch (strategy) {
      case 'merge': {
        resolution = `Merged payloads from ${agentA} and ${agentB}: ${JSON.stringify(payloadA)} | ${JSON.stringify(payloadB)}`;
        break;
      }
      case 'override': {
        resolution = `Using ${agentA}'s payload: ${JSON.stringify(payloadA)}`;
        break;
      }
      case 'human-review': {
        resolution = `Pending human review — conflict between ${agentA} and ${agentB} in context: ${context}`;
        break;
      }
    }

    const entry: ConflictResolution = {
      id: crypto.randomUUID(),
      agentA,
      agentB,
      context,
      strategy,
      resolution,
      resolvedAt: new Date().toISOString(),
    };

    this.history.push(entry);
    return entry;
  }

  getHistory(agentId?: string): ConflictResolution[] {
    if (!agentId) return [...this.history];
    return this.history.filter((h) => h.agentA === agentId || h.agentB === agentId);
  }
}
