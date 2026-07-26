// ============================================================
// InferenceEngine — LLM inference with fallback chain
// ============================================================

/**
 * InferenceRequest — Configuration and options interface.
 */
export interface InferenceRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * InferenceResponse — Configuration and options interface.
 */
export interface InferenceResponse {
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  latency: number;
}

/**
 * InferenceBackend — Configuration and options interface.
 */
export interface InferenceBackend {
  readonly name: string;
  readonly models: string[];
  complete(request: InferenceRequest): Promise<InferenceResponse>;
}

/**
 * BackendNotFoundError — Error thrown when no backend is found for a requested model.
 * @extends Error
 */
export class BackendNotFoundError extends Error {
  constructor(model: string) {
    super(`No backend found for model: ${model}`);
    this.name = 'BackendNotFoundError';
  }
}

/**
 * AllBackendsFailedError — Error thrown when all backends fail for all attempted models.
 * @extends Error
 */
export class AllBackendsFailedError extends Error {
  constructor(models: string[]) {
    super(`All backends failed for models: ${models.join(', ')}`);
    this.name = 'AllBackendsFailedError';
  }
}

/**
 * MockBackendOptions — Configuration and options interface.
 */
export interface MockBackendOptions {
  predefinedResponses?: Map<string, string>;
  failForModels?: string[];
  latencyMs?: number;
}

/**
 * MockBackend — A mock inference backend for testing purposes.
 * @implements {InferenceBackend}
 */
export class MockBackend implements InferenceBackend {
  readonly name: string;
  readonly models: string[];
  private predefinedResponses: Map<string, string>;
  private failForModels: Set<string>;
  private latencyMs: number;

  constructor(name: string, models: string[], options: MockBackendOptions = {}) {
    this.name = name;
    this.models = models;
    this.predefinedResponses = options.predefinedResponses ?? new Map();
    this.failForModels = new Set(options.failForModels ?? []);
    this.latencyMs = options.latencyMs ?? 5;
  }

  async complete(request: InferenceRequest): Promise<InferenceResponse> {
    if (this.failForModels.has(request.model)) {
      throw new Error(`MockBackend ${this.name} failed for model ${request.model}`);
    }

    const start = Date.now();
    await new Promise((r) => setTimeout(r, this.latencyMs));

    const lastMessage = request.messages[request.messages.length - 1];
    const content =
      this.predefinedResponses.get(request.model) ??
      `[MockBackend:${this.name}] echo: ${lastMessage?.content ?? ''}`;

    const inputTokens = request.messages.reduce((sum, m) => sum + m.content.length, 0);
    const outputTokens = content.length;

    return {
      model: request.model,
      content,
      finishReason: 'stop',
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      latency: Date.now() - start,
    };
  }
}

/**
 * InferenceEngine — LLM inference engine with fallback chain and backend management.
 */
export class InferenceEngine {
  private backends: Map<string, InferenceBackend> = new Map();
  private modelBackendMap: Map<string, string> = new Map();
  private defaultModel: string | undefined;
  private fallbackOrder: string[] = [];
  private readonly registry: Map<string, InferenceBackend>;

  constructor(registry?: Map<string, InferenceBackend>) {
    this.registry = registry ?? new Map();
  }

  registerBackend(backend: InferenceBackend): void {
    this.backends.set(backend.name, backend);
    this.registry.set(backend.name, backend);

    for (const model of backend.models) {
      if (!this.modelBackendMap.has(model)) {
        this.modelBackendMap.set(model, backend.name);
      }
    }
  }

  async infer(request: InferenceRequest): Promise<InferenceResponse> {
    const modelsToTry = this.resolveModelChain(request.model);

    for (const model of modelsToTry) {
      const backendName = this.modelBackendMap.get(model);
      if (!backendName) continue;

      const backend = this.backends.get(backendName);
      if (!backend) continue;

      try {
        const response = await backend.complete({ ...request, model });
        return response;
      } catch {}
    }

    throw new AllBackendsFailedError(modelsToTry);
  }

  getAvailableModels(): string[] {
    return Array.from(this.modelBackendMap.keys());
  }

  setDefaultModel(modelId: string): void {
    this.defaultModel = modelId;
  }

  setFallbackOrder(modelIds: string[]): void {
    this.fallbackOrder = modelIds;
  }

  getBackend(name: string): InferenceBackend | undefined {
    return this.backends.get(name);
  }

  getRegistry(): Map<string, InferenceBackend> {
    return this.registry;
  }

  private resolveModelChain(originalModel: string): string[] {
    const resolved: string[] = [];

    // Primary model
    const model = originalModel || this.defaultModel;
    if (model && !resolved.includes(model)) {
      resolved.push(model);
    }

    // Fallback chain
    for (const fallback of this.fallbackOrder) {
      if (!resolved.includes(fallback)) {
        resolved.push(fallback);
      }
    }

    // Default model fallback
    if (this.defaultModel && !resolved.includes(this.defaultModel)) {
      resolved.push(this.defaultModel);
    }

    return resolved;
  }
}
