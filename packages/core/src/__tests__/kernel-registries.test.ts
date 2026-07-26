import { beforeEach, describe, expect, it } from 'vitest';
import { type CapabilityInfo, CapabilityRegistry } from '../kernel/capability-registry';
import { type EngineInfo, EngineRegistry } from '../kernel/engine-registry';

describe('EngineRegistry', () => {
  let registry: EngineRegistry;

  beforeEach(() => {
    registry = new EngineRegistry();
  });

  const sampleEngine = (overrides: Partial<Omit<EngineInfo, 'status'>> = {}) => ({
    id: 'test-engine',
    name: 'Test Engine',
    type: 'execution',
    version: '1.0.0',
    metadata: {},
    ...overrides,
  });

  describe('register', () => {
    it('should register a new engine with registered status', () => {
      registry.register(sampleEngine());
      const engine = registry.get('test-engine')!;
      expect(engine).toBeDefined();
      expect(engine.status).toBe('registered');
      expect(engine.name).toBe('Test Engine');
    });

    it('should throw when registering a duplicate id', () => {
      registry.register(sampleEngine());
      expect(() => registry.register(sampleEngine())).toThrow(
        "Engine with id 'test-engine' is already registered",
      );
    });
  });

  describe('get', () => {
    it('should return the engine for a valid id', () => {
      registry.register(sampleEngine());
      const engine = registry.get('test-engine')!;
      expect(engine).toBeDefined();
      expect(engine.id).toBe('test-engine');
    });

    it('should throw when getting a non-existent id', () => {
      expect(() => registry.get('non-existent')).toThrow("Engine with id 'non-existent' not found");
    });
  });

  describe('list', () => {
    it('should return all engines when no type filter is given', () => {
      registry.register(sampleEngine({ id: 'e1', type: 'execution' }));
      registry.register(sampleEngine({ id: 'e2', type: 'governance' }));
      expect(registry.list()).toHaveLength(2);
    });

    it('should filter engines by type', () => {
      registry.register(sampleEngine({ id: 'e1', type: 'execution' }));
      registry.register(sampleEngine({ id: 'e2', type: 'governance' }));
      registry.register(sampleEngine({ id: 'e3', type: 'execution' }));
      const executionEngines = registry.list('execution');
      expect(executionEngines).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('should update the status of a registered engine', () => {
      registry.register(sampleEngine());
      registry.updateStatus('test-engine', 'started');
      expect(registry.get('test-engine')!.status).toBe('started');
    });

    it('should throw when updating status for a non-existent engine', () => {
      expect(() => registry.updateStatus('non-existent', 'started')).toThrow(
        "Engine with id 'non-existent' not found",
      );
    });
  });

  describe('findByType', () => {
    it('should return engines matching the given type', () => {
      registry.register(sampleEngine({ id: 'e1', type: 'execution' }));
      registry.register(sampleEngine({ id: 'e2', type: 'intelligence' }));
      const result = registry.findByType('execution');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e1');
    });
  });

  describe('findByTag', () => {
    it('should return engines whose metadata.tags includes the given tag', () => {
      registry.register(sampleEngine({ id: 'e1', metadata: { tags: ['core', 'critical'] } }));
      registry.register(sampleEngine({ id: 'e2', metadata: { tags: ['core'] } }));
      registry.register(sampleEngine({ id: 'e3', metadata: {} }));
      const result = registry.findByTag('critical');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e1');
    });

    it('should return empty array when no engines have the tag', () => {
      registry.register(sampleEngine({ id: 'e1', metadata: { tags: ['core'] } }));
      expect(registry.findByTag('missing')).toHaveLength(0);
    });
  });

  describe('getAll', () => {
    it('should return all registered engines', () => {
      registry.register(sampleEngine({ id: 'e1' }));
      registry.register(sampleEngine({ id: 'e2' }));
      expect(registry.getAll()).toHaveLength(2);
    });

    it('should return empty array when no engines are registered', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('should remove a registered engine', () => {
      registry.register(sampleEngine());
      registry.remove('test-engine');
      expect(() => registry.get('test-engine')).toThrow();
    });

    it('should throw when removing a non-existent engine', () => {
      expect(() => registry.remove('non-existent')).toThrow(
        "Engine with id 'non-existent' not found",
      );
    });
  });
});

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  const sampleCapability = (overrides: Partial<CapabilityInfo> = {}): CapabilityInfo => ({
    id: 'cap-1',
    name: 'Text Generation',
    version: '2.0.0',
    provider: 'openai',
    type: 'model',
    description: 'Generates text from prompts',
    permissions: ['read', 'write'],
    dependencies: [],
    cost: { perCall: 0.01, unit: 'USD' },
    latency: { p50: 500, p99: 2000, unit: 'ms' },
    reliability: 0.95,
    status: 'active',
    tags: ['llm', 'generation'],
    ...overrides,
  });

  describe('register', () => {
    it('should register a new capability', () => {
      registry.register(sampleCapability());
      const cap = registry.get('cap-1')!;
      expect(cap).toBeDefined();
      expect(cap.name).toBe('Text Generation');
    });

    it('should throw when registering a duplicate id', () => {
      registry.register(sampleCapability());
      expect(() => registry.register(sampleCapability())).toThrow(
        "Capability with id 'cap-1' is already registered",
      );
    });
  });

  describe('get', () => {
    it('should return a capability by id', () => {
      registry.register(sampleCapability());
      const cap = registry.get('cap-1')!;
      expect(cap.provider).toBe('openai');
    });

    it('should throw when getting a non-existent capability', () => {
      expect(() => registry.get('no-such-cap')).toThrow(
        "Capability with id 'no-such-cap' not found",
      );
    });
  });

  describe('findByType', () => {
    it('should filter capabilities by type', () => {
      registry.register(sampleCapability({ id: 'c1', type: 'model' }));
      registry.register(sampleCapability({ id: 'c2', type: 'tool' }));
      registry.register(sampleCapability({ id: 'c3', type: 'model' }));
      expect(registry.findByType('model')).toHaveLength(2);
      expect(registry.findByType('tool')).toHaveLength(1);
    });
  });

  describe('findByProvider', () => {
    it('should filter capabilities by provider', () => {
      registry.register(sampleCapability({ id: 'c1', provider: 'openai' }));
      registry.register(sampleCapability({ id: 'c2', provider: 'anthropic' }));
      const result = registry.findByProvider('anthropic');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c2');
    });
  });

  describe('findByTag', () => {
    it('should filter capabilities by tag', () => {
      registry.register(sampleCapability({ id: 'c1', tags: ['llm', 'text'] }));
      registry.register(sampleCapability({ id: 'c2', tags: ['vision'] }));
      expect(registry.findByTag('llm')).toHaveLength(1);
      expect(registry.findByTag('text')).toHaveLength(1);
    });
  });

  describe('findAlternatives', () => {
    it('should return capabilities of same type from different providers', () => {
      registry.register(sampleCapability({ id: 'c1', provider: 'openai', type: 'model' }));
      registry.register(sampleCapability({ id: 'c2', provider: 'anthropic', type: 'model' }));
      registry.register(sampleCapability({ id: 'c3', provider: 'openai', type: 'tool' }));
      const alternatives = registry.findAlternatives('c1');
      expect(alternatives).toHaveLength(1);
      expect(alternatives[0].id).toBe('c2');
    });
  });

  describe('getDependencies', () => {
    it('should return capabilities that are dependencies', () => {
      registry.register(sampleCapability({ id: 'auth' }));
      registry.register(sampleCapability({ id: 'main', dependencies: ['auth'] }));
      const deps = registry.getDependencies('main');
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe('auth');
    });

    it('should skip missing dependencies gracefully', () => {
      registry.register(sampleCapability({ id: 'main', dependencies: ['missing-dep'] }));
      const deps = registry.getDependencies('main');
      expect(deps).toHaveLength(0);
    });
  });

  describe('getDependents', () => {
    it('should return capabilities that depend on the given id', () => {
      registry.register(sampleCapability({ id: 'base' }));
      registry.register(sampleCapability({ id: 'a', dependencies: ['base'] }));
      registry.register(sampleCapability({ id: 'b', dependencies: ['base'] }));
      const dependents = registry.getDependents('base');
      expect(dependents).toHaveLength(2);
      expect(dependents.map((d) => d.id).sort()).toEqual(['a', 'b']);
    });
  });

  describe('getAll', () => {
    it('should return all registered capabilities', () => {
      registry.register(sampleCapability({ id: 'c1' }));
      registry.register(sampleCapability({ id: 'c2' }));
      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe('remove', () => {
    it('should remove a registered capability', () => {
      registry.register(sampleCapability());
      registry.remove('cap-1');
      expect(() => registry.get('cap-1')).toThrow();
    });

    it('should throw when removing a non-existent capability', () => {
      expect(() => registry.remove('no-such-cap')).toThrow(
        "Capability with id 'no-such-cap' not found",
      );
    });
  });

  describe('checkCircularDependency', () => {
    it('should detect a direct circular dependency', () => {
      registry.register(sampleCapability({ id: 'a', dependencies: ['b'] }));
      registry.register(sampleCapability({ id: 'b', dependencies: ['a'] }));
      expect(registry.checkCircularDependency('a', 'b')).toBe(true);
    });

    it('should detect an indirect circular dependency', () => {
      registry.register(sampleCapability({ id: 'a', dependencies: ['b'] }));
      registry.register(sampleCapability({ id: 'b', dependencies: ['c'] }));
      registry.register(sampleCapability({ id: 'c', dependencies: ['a'] }));
      expect(registry.checkCircularDependency('a', 'c')).toBe(true);
    });

    it('should return false when no circular dependency exists', () => {
      registry.register(sampleCapability({ id: 'a', dependencies: ['b'] }));
      registry.register(sampleCapability({ id: 'b' }));
      expect(registry.checkCircularDependency('a', 'b')).toBe(false);
    });

    it('should return false for self-referencing capabilities', () => {
      registry.register(sampleCapability({ id: 'a', dependencies: ['a'] }));
      expect(registry.checkCircularDependency('a', 'a')).toBe(true);
    });
  });
});
