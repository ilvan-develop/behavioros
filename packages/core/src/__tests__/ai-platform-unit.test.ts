import { describe, expect, it } from 'vitest';
import { ContextBuilder } from '../engines/ai-platform/context-builder';
import type { ModelInfo } from '../engines/ai-platform/model-registry';
import { ModelRegistry } from '../engines/ai-platform/model-registry';
import { ModelRouter } from '../engines/ai-platform/model-router';
import { PromptCompiler } from '../engines/ai-platform/prompt-compiler';
import type { PromptTemplate } from '../engines/ai-platform/prompt-registry';
import { PromptRegistry } from '../engines/ai-platform/prompt-registry';

function makeModel(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: 'test-model',
    name: 'Test Model',
    provider: 'test-provider',
    capabilities: ['chat'],
    contextWindow: 8192,
    costPer1KInput: 0.01,
    costPer1KOutput: 0.03,
    latencyP50: 500,
    latencyP99: 2000,
    maxTokensPerMin: 100_000,
    maxRequestsPerMin: 500,
    status: 'active',
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 'test-prompt',
    name: 'Test Prompt',
    version: '1.0.0',
    template: 'Hello {{name}}, your balance is {{balance}}',
    variables: ['name', 'balance'],
    description: 'A test prompt template',
    tags: ['test', 'greeting'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ModelRegistry', () => {
  it('should return a copy of the registered model (immutable)', () => {
    const registry = new ModelRegistry();
    const model = makeModel({ id: 'gpt-4' });
    registry.register(model);
    model.id = 'hacked';
    const retrieved = registry.get('gpt-4')!;
    expect(retrieved.id).toBe('gpt-4');
    expect(retrieved.id).not.toBe('hacked');
  });

  it('should return models for find by provider with mixed case', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'm1', provider: 'OpenAI' }));
    registry.register(makeModel({ id: 'm2', provider: 'openai' }));
    registry.register(makeModel({ id: 'm3', provider: 'other' }));
    expect(registry.findByProvider('OPENAI')).toHaveLength(2);
    expect(registry.findByProvider('OTHER')).toHaveLength(1);
  });

  it('should register models with all capability types', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'chat-model', capabilities: ['chat'] }));
    registry.register(makeModel({ id: 'embed-model', capabilities: ['embedding'] }));
    registry.register(
      makeModel({
        id: 'full-model',
        capabilities: ['chat', 'completion', 'embedding', 'image', 'audio', 'vision'],
      }),
    );
    expect(registry.findByCapability('embedding')).toHaveLength(2);
    expect(registry.findByCapability('vision')).toHaveLength(1);
    expect(registry.findByCapability('audio')).toHaveLength(1);
  });

  it('should return empty array when no models match capability', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'chat-only', capabilities: ['chat'] }));
    expect(registry.findByCapability('image')).toEqual([]);
  });

  it('should not mutate returned list when removing models externally', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'a' }));
    registry.register(makeModel({ id: 'b' }));
    const list = registry.list();
    expect(list).toHaveLength(2);
  });

  it('should handle multiple duplicate id registrations as error', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'dup' }));
    expect(() => registry.register(makeModel({ id: 'dup' }))).toThrow('already registered');
  });
});

describe('ModelRouter', () => {
  it('should throw when routing with empty registry', () => {
    const registry = new ModelRegistry();
    const router = new ModelRouter(registry);
    expect(() => router.route({ taskType: 'chat', requiredCapabilities: ['chat'] })).toThrow(
      'No model found',
    );
  });

  it('should route to beta models when cheapest available', () => {
    const registry = new ModelRegistry();
    registry.register(
      makeModel({ id: 'stable', status: 'active', costPer1KInput: 0.01, costPer1KOutput: 0.02 }),
    );
    registry.register(
      makeModel({
        id: 'beta-model',
        status: 'beta',
        costPer1KInput: 0.001,
        costPer1KOutput: 0.002,
      }),
    );
    const router = new ModelRouter(registry);
    const result = router.route({ taskType: 'chat', requiredCapabilities: ['chat'] });
    expect(result.modelId).toBe('beta-model');
    expect(result.model.status).toBe('beta');
  });

  it('should return empty fallback chain when no alternatives exist', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'only-one' }));
    const router = new ModelRouter(registry);
    const fallbacks = router.getFallback('only-one');
    expect(fallbacks).toEqual([]);
  });

  it('should prefer lower cost when same provider priority', () => {
    const registry = new ModelRegistry();
    registry.register(
      makeModel({ id: 'expensive', provider: 'same', costPer1KInput: 0.1, costPer1KOutput: 0.2 }),
    );
    registry.register(
      makeModel({ id: 'cheap', provider: 'same', costPer1KInput: 0.001, costPer1KOutput: 0.002 }),
    );
    const router = new ModelRouter(registry);
    router.setModelPriority('same', 5);
    const result = router.route({ taskType: 'chat', requiredCapabilities: ['chat'] });
    expect(result.modelId).toBe('cheap');
    expect(result.estimatedCost).toBe(0.0015);
  });

  it('should find fallbacks matching capability even when source model is deprecated', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'dep', status: 'deprecated' }));
    registry.register(makeModel({ id: 'alt', status: 'active' }));
    const router = new ModelRouter(registry);
    const fallbacks = router.getFallback('dep');
    expect(fallbacks).toEqual(['alt']);
  });

  it('should include all models with matching capability in fallback chain', () => {
    const registry = new ModelRegistry();
    registry.register(makeModel({ id: 'primary', capabilities: ['chat', 'vision'] }));
    registry.register(makeModel({ id: 'backup-1', capabilities: ['chat'] }));
    registry.register(makeModel({ id: 'backup-2', capabilities: ['chat', 'completion'] }));
    registry.register(makeModel({ id: 'no-match', capabilities: ['embedding'] }));
    const router = new ModelRouter(registry);
    const fallbacks = router.getFallback('primary');
    expect(fallbacks).toContain('backup-1');
    expect(fallbacks).toContain('backup-2');
    expect(fallbacks).not.toContain('no-match');
  });
});

describe('PromptRegistry', () => {
  it('should list templates filtered by tag returning empty for unmatched tag', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ id: 'a', tags: ['x'] }));
    expect(registry.list('nonexistent')).toEqual([]);
  });

  it('should return undefined for unknown version', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate());
    expect(registry.get('test-prompt', '99.99.99')).toBeUndefined();
  });

  it('should createVersion from non-standard version format', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ version: 'abc' }));
    const newVersion = registry.createVersion('test-prompt', 'new template', ['x']);
    expect(newVersion).toBe('1.0.1');
  });

  it('should preserve old versions after creating new version', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ version: '1.0.0' }));
    registry.createVersion('test-prompt', 'v2 content', ['a']);
    registry.createVersion('test-prompt', 'v3 content', ['a', 'b']);
    expect(registry.get('test-prompt', '1.0.0')?.template).toBe(
      'Hello {{name}}, your balance is {{balance}}',
    );
    expect(registry.get('test-prompt', '1.0.1')?.template).toBe('v2 content');
    expect(registry.get('test-prompt', '1.0.2')?.template).toBe('v3 content');
    expect(registry.get('test-prompt')?.version).toBe('1.0.2');
  });

  it('should handle remove of non-existent template gracefully', () => {
    const registry = new PromptRegistry();
    expect(registry.remove('nope')).toBeUndefined();
  });

  it('should handle templates with empty tags list', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ id: 'no-tags', tags: [] }));
    expect(registry.list()).toHaveLength(1);
    expect(registry.list('anything')).toEqual([]);
  });
});

describe('PromptCompiler', () => {
  it('should substitute same variable appearing multiple times', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ template: '{{x}} + {{x}} = {{y}}', variables: ['x', 'y'] });
    const result = compiler.compile(tpl, { x: '2', y: '4' });
    expect(result).toBe('2 + 2 = 4');
  });

  it('should compile with no variables in template when variables provided', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ template: 'Static text only', variables: [] });
    const result = compiler.compile(tpl, { unused: 'value' });
    expect(result).toBe('Static text only');
    const validation = compiler.validate(tpl, { unused: 'value' });
    expect(validation.valid).toBe(true);
    expect(validation.extra).toEqual(['unused']);
  });

  it('should extract empty array when no variables found', () => {
    const compiler = new PromptCompiler();
    const result = compiler.extractVariables('plain text without curly braces');
    expect(result).toEqual([]);
  });

  it('should only extract word-char variable names (regex \\w+)', () => {
    const compiler = new PromptCompiler();
    const result = compiler.extractVariables('{{user.name}} {{_count}} {{$special}}');
    expect(result).toEqual(['_count']);
  });

  it('should compile with maxOutputLength that does not truncate', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ template: 'Short', variables: [] });
    const result = compiler.compile(tpl, {}, { maxOutputLength: 100 });
    expect(result).toBe('Short');
  });
});

describe('ContextBuilder', () => {
  it('should use custom maxTokens from constructor and truncate when exceeded', () => {
    const builder = new ContextBuilder(50);
    builder.add({ type: 'document', content: 'a'.repeat(400), priority: 10 });
    const result = builder.build();
    expect(result.totalTokens).toBe(50);
    expect(result.truncated).toBe(true);
  });

  it('should set truncated to true with exactly 0 remaining tokens', () => {
    const builder = new ContextBuilder(2);
    builder.add({ type: 'system', content: 'hello world', priority: 10 });
    expect(builder.build().truncated).toBe(true);
  });

  it('should handle zero maxTokens gracefully', () => {
    const builder = new ContextBuilder(0);
    builder.add({ type: 'system', content: 'anything', priority: 10 });
    const result = builder.build();
    expect(result.segments).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
    expect(result.truncated).toBe(true);
  });

  it('should fit exact content up to maxTokens limit', () => {
    const builder = new ContextBuilder(4);
    builder.add({ type: 'system', content: '1234567890abcde', priority: 10 });
    const result = builder.build();
    expect(result.totalTokens).toBe(4);
    expect(result.truncated).toBe(false);
  });

  it('should consume remaining tokens for partially fitting source and flag truncated', () => {
    const builder = new ContextBuilder(6);
    builder.add({ type: 'system', content: 'a'.repeat(200), priority: 10, maxTokens: 4 });
    builder.add({ type: 'document', content: 'b'.repeat(50), priority: 5 });
    const result = builder.build();
    expect(result.segments).toHaveLength(2);
    expect(result.totalTokens).toBe(6);
    expect(result.truncated).toBe(true);
  });

  it('should handle adding sources after clear', () => {
    const builder = new ContextBuilder();
    builder.add({ type: 'system', content: 'first batch', priority: 10 });
    builder.clear();
    builder.add({ type: 'document', content: 'second batch', priority: 5 });
    const result = builder.build();
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].source).toBe('document');
  });

  it('should estimate tokens correctly based on content length', () => {
    const builder = new ContextBuilder(1000);
    builder.add({ type: 'system', content: 'x'.repeat(100), priority: 10 });
    const result = builder.build();
    expect(result.segments[0].tokens).toBe(25);
    expect(result.totalTokens).toBe(25);
  });

  it('should respect per-source maxTokens when content is longer', () => {
    const builder = new ContextBuilder(1000);
    builder.add({ type: 'system', content: 'x'.repeat(200), priority: 10, maxTokens: 10 });
    const result = builder.build();
    expect(result.segments[0].tokens).toBe(10);
  });

  it('should not truncate when per-source maxTokens exceeds content', () => {
    const builder = new ContextBuilder(1000);
    builder.add({ type: 'system', content: 'short', priority: 10, maxTokens: 100 });
    const result = builder.build();
    expect(result.segments[0].tokens).toBe(2);
  });
});
