import { beforeEach, describe, expect, it } from 'vitest';
import { CapabilityCatalog } from '../engines/integration/capability-catalog';
import { type ApiContract, ContractRegistry } from '../engines/integration/contract-registry';
import { SchemaRegistry } from '../engines/integration/schema-registry';

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    registry = new SchemaRegistry();
  });

  describe('register', () => {
    it('should register a new schema and return an id', () => {
      const id = registry.register('user', {
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name'],
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });
  });

  describe('get', () => {
    it('should return the latest version when no version specified', () => {
      registry.register('user', { type: 'object', properties: {} });
      registry.createVersion('user', { type: 'object', properties: { name: { type: 'string' } } });
      const entry = registry.get('user');
      expect(entry).toBeDefined();
      expect(entry!.version).toBe('1.0.1');
    });

    it('should return a specific version', () => {
      registry.register('user', { type: 'object', properties: {} });
      const entry = registry.get('user', '1.0.0');
      expect(entry).toBeDefined();
      expect(entry!.version).toBe('1.0.0');
    });

    it('should return undefined for non-existent schema', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should return valid for data matching schema', () => {
      registry.register('user', {
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name'],
      });
      const result = registry.validate('user', { name: 'Alice', age: 30 });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      registry.register('user', {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      });
      const result = registry.validate('user', { age: 30 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required property 'name'");
    });

    it('should return error for non-existent schema', () => {
      const result = registry.validate('nonexistent', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Schema 'nonexistent' not found");
    });

    it('should return error for type mismatch', () => {
      registry.register('user', {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: [],
      });
      const result = registry.validate('user', { name: 42 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Property 'name' must be a string");
    });
  });

  describe('createVersion', () => {
    it('should create a new version with incremented patch', () => {
      registry.register('user', { type: 'object', properties: {} });
      const id = registry.createVersion('user', {
        type: 'object',
        properties: { name: { type: 'string' } },
      });
      expect(id).toBeDefined();
      const entry = registry.get('user', '1.0.1');
      expect(entry).toBeDefined();
    });

    it('should throw when creating version for non-existent schema', () => {
      expect(() => registry.createVersion('nonexistent', {})).toThrow(
        "Schema 'nonexistent' not found",
      );
    });
  });

  describe('list', () => {
    it('should return all registered schemas', () => {
      registry.register('user', {});
      registry.register('product', {});
      expect(registry.list()).toHaveLength(2);
    });

    it('should return empty array when no schemas', () => {
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('should remove a schema and its versions', () => {
      registry.register('user', {});
      registry.remove('user');
      expect(registry.get('user')).toBeUndefined();
    });

    it('should throw when removing a non-existent schema', () => {
      expect(() => registry.remove('nonexistent')).toThrow("Schema 'nonexistent' not found");
    });
  });
});

describe('ContractRegistry', () => {
  let registry: ContractRegistry;

  beforeEach(() => {
    registry = new ContractRegistry();
  });

  const sampleContract = (overrides: Partial<ApiContract> = {}): ApiContract => ({
    id: '',
    name: 'user-api',
    version: '1.0.0',
    type: 'rest',
    endpoints: [
      { path: '/users', method: 'GET', requestSchema: 'EmptyRequest', responseSchema: 'UserList' },
    ],
    breaking: false,
    ...overrides,
  });

  describe('register', () => {
    it('should register a new contract', () => {
      registry.register(sampleContract());
      const contract = registry.get('user-api');
      expect(contract).toBeDefined();
      expect(contract!.name).toBe('user-api');
    });

    it('should throw when registering a duplicate version', () => {
      registry.register(sampleContract());
      expect(() => registry.register(sampleContract())).toThrow(
        "Contract 'user-api' version '1.0.0' is already registered",
      );
    });
  });

  describe('get', () => {
    it('should return the latest version when no version specified', () => {
      registry.register(sampleContract({ version: '1.0.0' }));
      registry.register(sampleContract({ version: '2.0.0' }));
      const contract = registry.get('user-api');
      expect(contract).toBeDefined();
      expect(contract!.version).toBe('2.0.0');
    });

    it('should return undefined for non-existent contract', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('checkCompatibility', () => {
    it('should return compatible when neither version is breaking', () => {
      registry.register(sampleContract({ version: '1.0.0' }));
      registry.register(sampleContract({ version: '2.0.0' }));
      const result = registry.checkCompatibility('user-api', '1.0.0', '2.0.0');
      expect(result.compatible).toBe(true);
      expect(result.breakingChanges).toHaveLength(0);
    });

    it('should return breaking when a version is marked breaking', () => {
      registry.register(sampleContract({ version: '1.0.0' }));
      registry.register(sampleContract({ version: '2.0.0', breaking: true }));
      const result = registry.checkCompatibility('user-api', '1.0.0', '2.0.0');
      expect(result.compatible).toBe(false);
      expect(result.breakingChanges).toContain('Version 2.0.0 is marked as breaking');
    });

    it('should return breaking when a version is not found', () => {
      registry.register(sampleContract({ version: '1.0.0' }));
      const result = registry.checkCompatibility('user-api', '1.0.0', '3.0.0');
      expect(result.compatible).toBe(false);
    });
  });

  describe('list', () => {
    it('should return all registered contracts', () => {
      registry.register(sampleContract({ name: 'user-api' }));
      registry.register(sampleContract({ name: 'product-api' }));
      expect(registry.list()).toHaveLength(2);
    });

    it('should return empty array when no contracts', () => {
      expect(registry.list()).toHaveLength(0);
    });
  });
});

describe('CapabilityCatalog', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
  });

  describe('add', () => {
    it('should add a new entry and return an id', () => {
      const id = catalog.add({
        capabilityId: 'text-gen',
        name: 'Text Generation',
        description: 'Generates text from prompts',
        tags: ['llm', 'generation'],
        provider: 'openai',
        version: '1.0.0',
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });
  });

  describe('search', () => {
    it('should find entries matching the query in name', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'Text Generation',
        description: 'Generates text',
        tags: ['llm'],
        provider: 'openai',
        version: '1.0.0',
      });
      catalog.add({
        capabilityId: 'img-gen',
        name: 'Image Generation',
        description: 'Generates images',
        tags: ['vision'],
        provider: 'openai',
        version: '1.0.0',
      });
      const results = catalog.search('text');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Text Generation');
    });

    it('should find entries matching query in description', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: 'Generates text from prompts',
        tags: ['llm'],
        provider: 'openai',
        version: '1.0.0',
      });
      const results = catalog.search('prompts');
      expect(results).toHaveLength(1);
    });

    it('should find entries matching query in tags', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: 'Some description',
        tags: ['llm', 'generation'],
        provider: 'openai',
        version: '1.0.0',
      });
      const results = catalog.search('generation');
      expect(results).toHaveLength(1);
    });

    it('should return empty array when no match', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: 'Some description',
        tags: ['llm'],
        provider: 'openai',
        version: '1.0.0',
      });
      expect(catalog.search('nonexistent')).toHaveLength(0);
    });
  });

  describe('filter', () => {
    it('should filter by tags', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: '',
        tags: ['llm', 'generation'],
        provider: 'openai',
        version: '1.0.0',
      });
      catalog.add({
        capabilityId: 'img-gen',
        name: 'ImageGen',
        description: '',
        tags: ['vision'],
        provider: 'openai',
        version: '1.0.0',
      });
      const results = catalog.filter(['llm']);
      expect(results).toHaveLength(1);
    });

    it('should filter by provider', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: '',
        tags: [],
        provider: 'openai',
        version: '1.0.0',
      });
      catalog.add({
        capabilityId: 'claude-gen',
        name: 'ClaudeGen',
        description: '',
        tags: [],
        provider: 'anthropic',
        version: '1.0.0',
      });
      const results = catalog.filter(undefined, 'anthropic');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ClaudeGen');
    });

    it('should filter by tags and provider combined', () => {
      catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: '',
        tags: ['llm'],
        provider: 'openai',
        version: '1.0.0',
      });
      catalog.add({
        capabilityId: 'text-gen-2',
        name: 'TextGen2',
        description: '',
        tags: ['llm'],
        provider: 'anthropic',
        version: '1.0.0',
      });
      const results = catalog.filter(['llm'], 'openai');
      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('openai');
    });

    it('should return all entries when no filters provided', () => {
      catalog.add({
        capabilityId: 'a',
        name: 'A',
        description: '',
        tags: [],
        provider: 'p1',
        version: '1.0.0',
      });
      catalog.add({
        capabilityId: 'b',
        name: 'B',
        description: '',
        tags: [],
        provider: 'p2',
        version: '1.0.0',
      });
      expect(catalog.filter()).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('should return an entry by id', () => {
      const id = catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: 'Generates text',
        tags: ['llm'],
        provider: 'openai',
        version: '1.0.0',
      });
      const entry = catalog.get(id);
      expect(entry).toBeDefined();
      expect(entry!.name).toBe('TextGen');
    });

    it('should return undefined for non-existent id', () => {
      expect(catalog.get('nonexistent')).toBeUndefined();
    });
  });

  describe('compare', () => {
    it('should return details for given ids', () => {
      const id1 = catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: '',
        tags: ['llm'],
        provider: 'openai',
        version: '1.0.0',
      });
      const id2 = catalog.add({
        capabilityId: 'img-gen',
        name: 'ImageGen',
        description: '',
        tags: ['vision'],
        provider: 'openai',
        version: '1.0.0',
      });
      const results = catalog.compare([id1, id2]);
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('name', 'TextGen');
      expect(results[1]).toHaveProperty('name', 'ImageGen');
    });

    it('should skip non-existent ids silently', () => {
      const id = catalog.add({
        capabilityId: 'text-gen',
        name: 'TextGen',
        description: '',
        tags: [],
        provider: 'openai',
        version: '1.0.0',
      });
      const results = catalog.compare([id, 'nonexistent']);
      expect(results).toHaveLength(1);
    });
  });
});
