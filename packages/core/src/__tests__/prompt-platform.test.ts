import { describe, expect, it } from 'vitest';
import type { ContextSource } from '../engines/ai-platform/context-builder';
import { ContextBuilder } from '../engines/ai-platform/context-builder';
import { PromptCompiler } from '../engines/ai-platform/prompt-compiler';
import type { PromptTemplate } from '../engines/ai-platform/prompt-registry';
import { PromptRegistry } from '../engines/ai-platform/prompt-registry';

const makeTemplate = (overrides: Partial<PromptTemplate> = {}): PromptTemplate => ({
  id: 'test-prompt',
  name: 'Test Prompt',
  version: '1.0.0',
  template: 'Hello {{name}}, your balance is {{balance}}',
  variables: ['name', 'balance'],
  description: 'A test prompt template',
  tags: ['test', 'greeting'],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('PromptRegistry', () => {
  it('should register a template', () => {
    const registry = new PromptRegistry();
    const tpl = makeTemplate();
    registry.register(tpl);
    expect(registry.get('test-prompt')).toEqual(tpl);
  });

  it('should get a template by id', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ id: 'greeting' }));
    expect(registry.get('greeting')?.id).toBe('greeting');
  });

  it('should return undefined for unknown id', () => {
    const registry = new PromptRegistry();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should get a specific version', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ version: '1.0.0' }));
    const v2 = registry.createVersion('test-prompt', 'Hello {{name}}', ['name']);
    expect(registry.get('test-prompt', '1.0.0')?.version).toBe('1.0.0');
    expect(registry.get('test-prompt', v2)?.version).toBe(v2);
  });

  it('should list all templates', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ id: 'a', tags: ['greeting'] }));
    registry.register(makeTemplate({ id: 'b', tags: ['question'] }));
    expect(registry.list()).toHaveLength(2);
  });

  it('should list templates filtered by tag', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ id: 'a', tags: ['greeting'] }));
    registry.register(makeTemplate({ id: 'b', tags: ['question'] }));
    registry.register(makeTemplate({ id: 'c', tags: ['greeting'] }));
    const result = registry.list('greeting');
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.tags.includes('greeting'))).toBe(true);
  });

  it('should remove a template', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate());
    registry.remove('test-prompt');
    expect(registry.get('test-prompt')).toBeUndefined();
  });

  it('should create a new version', () => {
    const registry = new PromptRegistry();
    registry.register(makeTemplate({ version: '2.0.0' }));
    const newVersion = registry.createVersion('test-prompt', 'Hi {{name}}', ['name']);
    expect(newVersion).toBe('2.0.1');
    expect(registry.get('test-prompt')?.version).toBe('2.0.1');
    expect(registry.get('test-prompt')?.template).toBe('Hi {{name}}');
  });

  it('should throw when creating version for unknown id', () => {
    const registry = new PromptRegistry();
    expect(() => registry.createVersion('unknown', 'x', [])).toThrow('not found');
  });
});

describe('PromptCompiler', () => {
  it('should compile a template with variables', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate();
    const result = compiler.compile(tpl, { name: 'Alice', balance: '100' });
    expect(result).toBe('Hello Alice, your balance is 100');
  });

  it('should throw when variables are missing', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ variables: ['name', 'balance', 'email'] });
    expect(() => compiler.compile(tpl, { name: 'Alice' })).toThrow('CompileError');
  });

  it('should compile with validateVariables disabled', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ template: 'Hello {{name}}' });
    const result = compiler.compile(tpl, {}, { validateVariables: false });
    expect(result).toBe('Hello {{name}}');
  });

  it('should strip excess whitespace', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({
      template: 'Hello    {{name}}   how   are   you',
      variables: ['name'],
    });
    const result = compiler.compile(tpl, { name: 'Bob' }, { stripExcessWhitespace: true });
    expect(result).toBe('Hello Bob how are you');
  });

  it('should truncate output with maxOutputLength', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({
      template: 'Hello {{name}}',
      variables: ['name'],
    });
    const result = compiler.compile(tpl, { name: 'World' }, { maxOutputLength: 7 });
    expect(result).toBe('Hello W');
  });

  it('should extract variables from text', () => {
    const compiler = new PromptCompiler();
    const result = compiler.extractVariables('{{a}} and {{b}} and {{a}}');
    expect(result).toEqual(['a', 'b']);
  });

  it('should validate missing and extra variables', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ variables: ['a', 'b'] });
    const result = compiler.validate(tpl, { a: '1', c: '3' });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['b']);
    expect(result.extra).toEqual(['c']);
  });

  it('should return valid for correct variables', () => {
    const compiler = new PromptCompiler();
    const tpl = makeTemplate({ variables: ['a', 'b'] });
    const result = compiler.validate(tpl, { a: '1', b: '2' });
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.extra).toHaveLength(0);
  });
});

describe('ContextBuilder', () => {
  const makeSource = (overrides: Partial<ContextSource> = {}): ContextSource => ({
    type: 'document',
    content: 'some content here',
    priority: 10,
    ...overrides,
  });

  it('should add a source and build context', () => {
    const builder = new ContextBuilder();
    builder.add(makeSource({ type: 'system', content: 'system prompt' }));
    const result = builder.build();
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].source).toBe('system');
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('should order segments by priority descending', () => {
    const builder = new ContextBuilder();
    builder.add(makeSource({ type: 'document', content: 'low', priority: 1 }));
    builder.add(makeSource({ type: 'system', content: 'high', priority: 100 }));
    builder.add(makeSource({ type: 'memory', content: 'mid', priority: 50 }));
    const result = builder.build();
    expect(result.segments[0].source).toBe('system');
    expect(result.segments[1].source).toBe('memory');
    expect(result.segments[2].source).toBe('document');
  });

  it('should respect maxTokens per segment', () => {
    const builder = new ContextBuilder(1000);
    const longContent = 'word '.repeat(200);
    builder.add(makeSource({ content: longContent, maxTokens: 5 }));
    const result = builder.build();
    expect(result.segments[0].tokens).toBeLessThanOrEqual(5);
  });

  it('should truncate when total exceeds limit', () => {
    const builder = new ContextBuilder(5);
    builder.add(
      makeSource({ content: 'a b c d e f g h i j k l m n o p q r s t u v w x y z', priority: 10 }),
    );
    builder.add(makeSource({ content: '1234567890', priority: 1 }));
    const result = builder.build();
    expect(result.truncated).toBe(true);
    expect(result.totalTokens).toBeLessThanOrEqual(5);
  });

  it('should clear all sources', () => {
    const builder = new ContextBuilder();
    builder.add(makeSource());
    builder.clear();
    const result = builder.build();
    expect(result.segments).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
  });

  it('should handle empty builder', () => {
    const builder = new ContextBuilder();
    const result = builder.build();
    expect(result.segments).toHaveLength(0);
    expect(result.totalTokens).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('should handle all source types', () => {
    const builder = new ContextBuilder();
    const types: ContextSource['type'][] = ['system', 'history', 'document', 'tool', 'memory'];
    for (const type of types) {
      builder.add(makeSource({ type }));
    }
    const result = builder.build();
    expect(result.segments).toHaveLength(5);
    const sources = result.segments.map((s) => s.source);
    expect(sources).toContain('system');
    expect(sources).toContain('history');
    expect(sources).toContain('document');
    expect(sources).toContain('tool');
    expect(sources).toContain('memory');
  });
});
