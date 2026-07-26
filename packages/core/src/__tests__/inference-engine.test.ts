import { beforeEach, describe, expect, it } from 'vitest';
import {
  AllBackendsFailedError,
  InferenceEngine,
  MockBackend,
} from '../engines/ai-platform/inference-engine';

describe('InferenceEngine', () => {
  let engine: InferenceEngine;

  beforeEach(() => {
    engine = new InferenceEngine();
  });

  // ─── registerBackend() ─────────────────────────────────────

  describe('registerBackend()', () => {
    it('should register a backend and make its models available', () => {
      const backend = new MockBackend('openai', ['gpt-4', 'gpt-3.5-turbo']);
      engine.registerBackend(backend);

      const models = engine.getAvailableModels();
      expect(models).toContain('gpt-4');
      expect(models).toContain('gpt-3.5-turbo');
    });
  });

  // ─── infer() with mock backend ─────────────────────────────

  describe('infer()', () => {
    it('should return a response from the mock backend', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.model).toBe('gpt-4');
      expect(response.content).toContain('echo: Hello');
      expect(response.finishReason).toBe('stop');
    });

    it('should throw when no backend handles the requested model', async () => {
      await expect(
        engine.infer({
          model: 'nonexistent-model',
          messages: [{ role: 'user', content: 'test' }],
        }),
      ).rejects.toThrow(AllBackendsFailedError);
    });

    it('should fallback through the fallback chain on failure', async () => {
      const primary = new MockBackend('primary', ['gpt-4'], {
        failForModels: ['gpt-4'],
      });
      const fallback = new MockBackend('fallback', ['gpt-3.5-turbo'], {
        predefinedResponses: new Map([['gpt-3.5-turbo', 'fallback response']]),
      });

      engine.registerBackend(primary);
      engine.registerBackend(fallback);
      engine.setFallbackOrder(['gpt-3.5-turbo']);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(response.content).toBe('fallback response');
    });

    it('should throw AllBackendsFailedError when all backends fail', async () => {
      const primary = new MockBackend('primary', ['gpt-4'], {
        failForModels: ['gpt-4'],
      });
      const fallback = new MockBackend('fallback', ['gpt-3.5-turbo'], {
        failForModels: ['gpt-3.5-turbo'],
      });

      engine.registerBackend(primary);
      engine.registerBackend(fallback);
      engine.setFallbackOrder(['gpt-3.5-turbo']);

      await expect(
        engine.infer({
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'test' }],
        }),
      ).rejects.toThrow(AllBackendsFailedError);
    });

    it('should use the default model when no model is specified', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);
      engine.setDefaultModel('gpt-4');

      const response = await engine.infer({
        messages: [{ role: 'user', content: 'default model' }],
      } as any);

      expect(response.model).toBe('gpt-4');
    });

    it('should propagate stream flag to the backend', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'stream test' }],
        stream: true,
      });

      expect(response).toBeDefined();
      expect(response.content).toContain('stream test');
    });

    it('should pass temperature and maxTokens parameters', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'params' }],
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(response).toBeDefined();
      expect(response.model).toBe('gpt-4');
    });
  });

  // ─── getAvailableModels() ───────────────────────────────────

  describe('getAvailableModels()', () => {
    it('should list all models across registered backends', () => {
      const backendA = new MockBackend('provider-a', ['model-a1', 'model-a2']);
      const backendB = new MockBackend('provider-b', ['model-b1']);

      engine.registerBackend(backendA);
      engine.registerBackend(backendB);

      const models = engine.getAvailableModels();
      expect(models).toContain('model-a1');
      expect(models).toContain('model-a2');
      expect(models).toContain('model-b1');
    });

    it('should return empty array when no backends registered', () => {
      expect(engine.getAvailableModels()).toEqual([]);
    });
  });

  // ─── setDefaultModel() ──────────────────────────────────────

  describe('setDefaultModel()', () => {
    it('should set the default model used when model is unspecified', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);
      engine.setDefaultModel('gpt-4');

      const response = await engine.infer({
        messages: [{ role: 'user', content: 'default' }],
      } as any);

      expect(response.model).toBe('gpt-4');
    });
  });

  // ─── setFallbackOrder() ─────────────────────────────────────

  describe('setFallbackOrder()', () => {
    it('should try fallback models in order', async () => {
      const primary = new MockBackend('primary', ['model-a'], {
        failForModels: ['model-a'],
      });
      const fallback1 = new MockBackend('fallback1', ['model-b'], {
        failForModels: ['model-b'],
      });
      const fallback2 = new MockBackend('fallback2', ['model-c'], {
        predefinedResponses: new Map([['model-c', 'last resort']]),
      });

      engine.registerBackend(primary);
      engine.registerBackend(fallback1);
      engine.registerBackend(fallback2);
      engine.setFallbackOrder(['model-b', 'model-c']);

      const response = await engine.infer({
        model: 'model-a',
        messages: [{ role: 'user', content: 'chain' }],
      });

      expect(response.content).toBe('last resort');
    });
  });

  // ─── response tracking ─────────────────────────────────────

  describe('response tracking', () => {
    it('should report token usage in the response', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'count tokens' }],
      });

      expect(response.usage.inputTokens).toBeGreaterThan(0);
      expect(response.usage.outputTokens).toBeGreaterThan(0);
      expect(response.usage.totalTokens).toBe(
        response.usage.inputTokens + response.usage.outputTokens,
      );
    });

    it('should report latency in milliseconds', async () => {
      const backend = new MockBackend('openai', ['gpt-4'], { latencyMs: 10 });
      engine.registerBackend(backend);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'time me' }],
      });

      expect(response.latency).toBeGreaterThanOrEqual(10);
    });

    it('should handle system messages correctly', async () => {
      const backend = new MockBackend('openai', ['gpt-4']);
      engine.registerBackend(backend);

      const response = await engine.infer({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hi' },
        ],
      });

      expect(response.content).toContain('Hi');
    });
  });
});
