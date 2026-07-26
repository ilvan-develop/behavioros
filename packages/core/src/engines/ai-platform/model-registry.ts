/**
 * ModelCapability — Union type: chat, completion, embedding, image, audio, vision;.
 */
export type ModelCapability = 'chat' | 'completion' | 'embedding' | 'image' | 'audio' | 'vision';

/**
 * ModelInfo — Configuration and options interface.
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  costPer1KInput: number;
  costPer1KOutput: number;
  latencyP50: number;
  latencyP99: number;
  maxTokensPerMin: number;
  maxRequestsPerMin: number;
  status: 'active' | 'deprecated' | 'beta';
}

/**
 * ModelRegistry — model registry.
 *
 * Methods: register, get, findByCapability, findByProvider, list, remove.
 */
export class ModelRegistry {
  private models = new Map<string, ModelInfo>();

  register(model: ModelInfo): void {
    if (this.models.has(model.id)) {
      throw new Error(`Model with id '${model.id}' is already registered`);
    }
    this.models.set(model.id, { ...model });
  }

  get(id: string): ModelInfo | undefined {
    return this.models.get(id);
  }

  findByCapability(capability: ModelCapability): ModelInfo[] {
    return Array.from(this.models.values()).filter((m) => m.capabilities.includes(capability));
  }

  findByProvider(provider: string): ModelInfo[] {
    return Array.from(this.models.values()).filter(
      (m) => m.provider.toLowerCase() === provider.toLowerCase(),
    );
  }

  list(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  remove(id: string): void {
    if (!this.models.has(id)) {
      throw new Error(`Model with id '${id}' not found`);
    }
    this.models.delete(id);
  }
}
