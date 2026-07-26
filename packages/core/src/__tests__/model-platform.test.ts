import { beforeEach, describe, expect, it } from 'vitest';
import type { ModelInfo } from '../engines/ai-platform/model-registry';
import { ModelRegistry } from '../engines/ai-platform/model-registry';
import { ModelRouter } from '../engines/ai-platform/model-router';

function makeModels(): ModelInfo[] {
  return [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      capabilities: ['chat', 'completion', 'vision'],
      contextWindow: 128_000,
      costPer1KInput: 0.01,
      costPer1KOutput: 0.03,
      latencyP50: 800,
      latencyP99: 3000,
      maxTokensPerMin: 200_000,
      maxRequestsPerMin: 500,
      status: 'active',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      capabilities: ['chat', 'completion'],
      contextWindow: 128_000,
      costPer1KInput: 0.0015,
      costPer1KOutput: 0.006,
      latencyP50: 400,
      latencyP99: 1500,
      maxTokensPerMin: 500_000,
      maxRequestsPerMin: 1000,
      status: 'active',
    },
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      capabilities: ['chat', 'completion', 'vision'],
      contextWindow: 200_000,
      costPer1KInput: 0.015,
      costPer1KOutput: 0.075,
      latencyP50: 1200,
      latencyP99: 5000,
      maxTokensPerMin: 100_000,
      maxRequestsPerMin: 200,
      status: 'active',
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      capabilities: ['chat', 'completion'],
      contextWindow: 200_000,
      costPer1KInput: 0.0025,
      costPer1KOutput: 0.0125,
      latencyP50: 300,
      latencyP99: 1200,
      maxTokensPerMin: 300_000,
      maxRequestsPerMin: 800,
      status: 'active',
    },
    {
      id: 'embed-3-small',
      name: 'Embedding v3 Small',
      provider: 'openai',
      capabilities: ['embedding'],
      contextWindow: 8191,
      costPer1KInput: 0.00002,
      costPer1KOutput: 0,
      latencyP50: 100,
      latencyP99: 500,
      maxTokensPerMin: 1_000_000,
      maxRequestsPerMin: 3000,
      status: 'active',
    },
    {
      id: 'whisper-1',
      name: 'Whisper',
      provider: 'openai',
      capabilities: ['audio'],
      contextWindow: 0,
      costPer1KInput: 0.006,
      costPer1KOutput: 0,
      latencyP50: 2000,
      latencyP99: 8000,
      maxTokensPerMin: 0,
      maxRequestsPerMin: 100,
      status: 'active',
    },
    {
      id: 'dall-e-3',
      name: 'DALL-E 3',
      provider: 'openai',
      capabilities: ['image'],
      contextWindow: 0,
      costPer1KInput: 0.04,
      costPer1KOutput: 0,
      latencyP50: 5000,
      latencyP99: 15000,
      maxTokensPerMin: 0,
      maxRequestsPerMin: 50,
      status: 'active',
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      capabilities: ['chat', 'completion'],
      contextWindow: 16384,
      costPer1KInput: 0.0005,
      costPer1KOutput: 0.0015,
      latencyP50: 200,
      latencyP99: 800,
      maxTokensPerMin: 600_000,
      maxRequestsPerMin: 2000,
      status: 'deprecated',
    },
  ];
}

describe('ModelRegistry', () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    registry = new ModelRegistry();
  });

  it('should register a model and retrieve it by id', () => {
    const model = makeModels()[0];
    registry.register(model);
    expect(registry.get('gpt-4o')).toEqual(model);
  });

  it('should throw when registering a duplicate id', () => {
    registry.register(makeModels()[0]);
    expect(() => registry.register(makeModels()[0])).toThrow('already registered');
  });

  it('should return undefined for unknown id', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should find models by capability', () => {
    for (const m of makeModels()) registry.register(m);
    const chatModels = registry.findByCapability('chat');
    expect(chatModels).toHaveLength(5);
    expect(chatModels.map((m) => m.id)).toContain('gpt-4o');
    expect(chatModels.map((m) => m.id)).toContain('claude-3-haiku');
  });

  it('should find models by provider (case-insensitive)', () => {
    for (const m of makeModels()) registry.register(m);
    const anthropic = registry.findByProvider('Anthropic');
    expect(anthropic).toHaveLength(2);
    expect(anthropic.map((m) => m.id)).toContain('claude-3-opus');
  });

  it('should return empty array for unknown provider', () => {
    for (const m of makeModels()) registry.register(m);
    expect(registry.findByProvider('google')).toEqual([]);
  });

  it('should list all registered models', () => {
    const models = makeModels();
    for (const m of models) registry.register(m);
    expect(registry.list()).toHaveLength(models.length);
  });

  it('should remove a model by id', () => {
    registry.register(makeModels()[0]);
    registry.remove('gpt-4o');
    expect(registry.get('gpt-4o')).toBeUndefined();
  });

  it('should throw when removing a non-existent model', () => {
    expect(() => registry.remove('nonexistent')).toThrow('not found');
  });

  it('should return an empty list when no models are registered', () => {
    expect(registry.list()).toEqual([]);
  });

  it('should find vision-capable models only', () => {
    for (const m of makeModels()) registry.register(m);
    const visionModels = registry.findByCapability('vision');
    expect(visionModels).toHaveLength(2);
    expect(visionModels.map((m) => m.id)).toEqual(['gpt-4o', 'claude-3-opus']);
  });
});

describe('ModelRouter', () => {
  let registry: ModelRegistry;
  let router: ModelRouter;

  beforeEach(() => {
    registry = new ModelRegistry();
    for (const m of makeModels()) registry.register(m);
    router = new ModelRouter(registry);
  });

  it('should route to the cheapest model meeting capability requirements', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
    });
    expect(result.modelId).toBe('gpt-4o-mini');
    expect(result.estimatedCost).toBe(0.00375);
  });

  it('should respect a maxCost constraint', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
      maxCost: 0.005,
    });
    expect(result.modelId).toBe('gpt-4o-mini');
    expect(result.estimatedCost).toBeLessThanOrEqual(0.005);
  });

  it('should respect a maxLatency constraint', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
      maxLatency: 350,
    });
    expect(result.modelId).toBe('claude-3-haiku');
    expect(result.estimatedLatency).toBeLessThanOrEqual(350);
  });

  it('should prefer the preferredProvider when specified', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
      preferredProvider: 'anthropic',
    });
    expect(result.model.provider).toBe('anthropic');
    expect(result.modelId).toBe('claude-3-haiku');
  });

  it('should include a fallback chain in the routing result', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
    });
    expect(result.fallbackChain.length).toBeGreaterThan(0);
    expect(result.fallbackChain).not.toContain(result.modelId);
  });

  it('should throw when no model matches the required capabilities', () => {
    expect(() =>
      router.route({
        taskType: 'image-gen',
        requiredCapabilities: ['image', 'vision'],
      }),
    ).toThrow('No model found');
  });

  it('should respect provider priority set via setModelPriority', () => {
    router.setModelPriority('anthropic', 10);
    router.setModelPriority('openai', 1);
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
    });
    expect(result.model.provider).toBe('anthropic');
  });

  it('should return fallback models for a given model id', () => {
    const fallbacks = router.getFallback('gpt-4o');
    expect(fallbacks.length).toBeGreaterThan(0);
    expect(fallbacks).not.toContain('gpt-4o');
  });

  it('should respect the count parameter in getFallback', () => {
    const fallbacks = router.getFallback('gpt-4o', 2);
    expect(fallbacks).toHaveLength(2);
  });

  it('should return empty fallback chain for unknown model', () => {
    expect(router.getFallback('nonexistent')).toEqual([]);
  });

  it('should order fallbacks by cost then latency', () => {
    const fallbacks = router.getFallback('claude-3-opus');
    for (let i = 1; i < fallbacks.length; i++) {
      const prev = registry.get(fallbacks[i - 1])!;
      const curr = registry.get(fallbacks[i])!;
      const prevCost = (prev.costPer1KInput + prev.costPer1KOutput) / 2;
      const currCost = (curr.costPer1KInput + curr.costPer1KOutput) / 2;
      expect(prevCost).toBeLessThanOrEqual(currCost);
    }
  });

  it('should exclude deprecated models from routing', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat'],
      maxLatency: 300,
    });
    expect(result.modelId).not.toBe('gpt-3.5-turbo');
  });

  it('should exclude deprecated models from fallback chain', () => {
    router.setModelPriority('openai', 100);
    const fallbacks = router.getFallback('claude-3-haiku');
    expect(fallbacks).not.toContain('gpt-3.5-turbo');
  });

  it('should select cheapest model when multiple match all constraints', () => {
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat', 'completion'],
    });
    const cheapest = result.model;
    expect(cheapest.id).toBe('gpt-4o-mini');
  });

  it('should select fastest among equal-cost models', () => {
    router.setModelPriority('openai', 10);
    router.setModelPriority('anthropic', 10);
    const result = router.route({
      taskType: 'chat',
      requiredCapabilities: ['chat', 'completion'],
    });
    expect(result.modelId).toBe('gpt-4o-mini');
  });
});
