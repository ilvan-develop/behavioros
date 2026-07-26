import type { ModelCapability, ModelInfo, ModelRegistry } from './model-registry';

/**
 * RoutingRequest — Configuration and options interface.
 */
export interface RoutingRequest {
  taskType: string;
  requiredCapabilities: ModelCapability[];
  maxCost?: number;
  maxLatency?: number;
  preferredProvider?: string;
}

/**
 * RoutingResult — Configuration and options interface.
 */
export interface RoutingResult {
  modelId: string;
  model: ModelInfo;
  estimatedCost: number;
  estimatedLatency: number;
  fallbackChain: string[];
}

/**
 * ModelRouter — model router.
 *
 * Methods: route, getFallback, setModelPriority.
 */
export class ModelRouter {
  private registry: ModelRegistry;
  private providerPriorities = new Map<string, number>();

  constructor(registry: ModelRegistry) {
    this.registry = registry;
  }

  route(request: RoutingRequest): RoutingResult {
    const candidates = this.registry.list().filter((m) => {
      const hasAllCaps = request.requiredCapabilities.every((cap) => m.capabilities.includes(cap));
      if (!hasAllCaps) return false;
      if (m.status === 'deprecated') return false;
      if (request.maxCost !== undefined) {
        const avgCost = (m.costPer1KInput + m.costPer1KOutput) / 2;
        if (avgCost > request.maxCost) return false;
      }
      if (request.maxLatency !== undefined) {
        if (m.latencyP50 > request.maxLatency) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      throw new Error(
        `No model found matching capabilities: ${request.requiredCapabilities.join(', ')}`,
      );
    }

    const sorted = [...candidates].sort((a, b) => {
      if (request.preferredProvider) {
        const aPref = a.provider.toLowerCase() === request.preferredProvider.toLowerCase();
        const bPref = b.provider.toLowerCase() === request.preferredProvider.toLowerCase();
        if (aPref && !bPref) return -1;
        if (!aPref && bPref) return 1;
      }
      const aPriority = this.providerPriorities.get(a.provider) ?? 0;
      const bPriority = this.providerPriorities.get(b.provider) ?? 0;
      if (bPriority !== aPriority) return bPriority - aPriority;
      const aCost = (a.costPer1KInput + a.costPer1KOutput) / 2;
      const bCost = (b.costPer1KInput + b.costPer1KOutput) / 2;
      if (aCost !== bCost) return aCost - bCost;
      return a.latencyP50 - b.latencyP50;
    });

    const selected = sorted[0];
    const avgCost = (selected.costPer1KInput + selected.costPer1KOutput) / 2;
    const fallbackChain = sorted.slice(1).map((m) => m.id);

    return {
      modelId: selected.id,
      model: selected,
      estimatedCost: avgCost,
      estimatedLatency: selected.latencyP50,
      fallbackChain,
    };
  }

  getFallback(modelId: string, count?: number): string[] {
    const model = this.registry.get(modelId);
    if (!model) return [];

    const fallbacks = this.registry
      .list()
      .filter(
        (m) =>
          m.id !== modelId &&
          m.status !== 'deprecated' &&
          model.capabilities.some((c) => m.capabilities.includes(c)),
      )
      .sort((a, b) => {
        const aCost = (a.costPer1KInput + a.costPer1KOutput) / 2;
        const bCost = (b.costPer1KInput + b.costPer1KOutput) / 2;
        if (aCost !== bCost) return aCost - bCost;
        return a.latencyP50 - b.latencyP50;
      });

    const ids = fallbacks.map((m) => m.id);
    return count !== undefined ? ids.slice(0, count) : ids;
  }

  setModelPriority(provider: string, priority: number): void {
    this.providerPriorities.set(provider, priority);
  }
}
