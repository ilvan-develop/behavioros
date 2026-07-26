import { beforeEach, describe, expect, it } from 'vitest';
import { PluginLifecycle, type PluginManifest } from '../engines/ecosystem/plugin-lifecycle';

function validManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'tester',
    ...overrides,
  };
}

describe('PluginLifecycle', () => {
  let lifecycle: PluginLifecycle;

  beforeEach(() => {
    lifecycle = new PluginLifecycle();
  });

  // ─── register ──────────────────────────────────────────────

  it('should register a valid plugin with status "registered"', () => {
    const manifest = validManifest();
    lifecycle.register(manifest);
    expect(lifecycle.getStatus('test-plugin')).toBe('registered');
  });

  it('should register multiple plugins independently', () => {
    lifecycle.register(validManifest({ id: 'a', name: 'A' }));
    lifecycle.register(validManifest({ id: 'b', name: 'B' }));
    expect(lifecycle.getStatus('a')).toBe('registered');
    expect(lifecycle.getStatus('b')).toBe('registered');
  });

  it('should set status to "error" when registering an invalid plugin', () => {
    lifecycle.register(validManifest({ id: '' }));
    expect(lifecycle.getStatus('')).toBe('error');
  });

  // ─── load ──────────────────────────────────────────────────

  it('should load a registered plugin and set status to "loaded"', async () => {
    lifecycle.register(validManifest());
    const result = await lifecycle.load('test-plugin');
    expect(result).toBe(true);
    expect(lifecycle.getStatus('test-plugin')).toBe('loaded');
  });

  it('should return false when loading a non-existent plugin', async () => {
    const result = await lifecycle.load('nonexistent');
    expect(result).toBe(false);
  });

  it('should set status to "error" when loading an invalid plugin', async () => {
    lifecycle.register(validManifest({ id: '', version: '' }));
    const result = await lifecycle.load('');
    expect(result).toBe(false);
    expect(lifecycle.getStatus('')).toBe('error');
    const plugin = lifecycle.getAll().find((p) => p.manifest.id === '');
    expect(plugin?.error).toBeDefined();
  });

  // ─── unload ────────────────────────────────────────────────

  it('should unload a loaded plugin', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.unload('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('unloaded');
  });

  it('should clear loadedAt and enabledAt on unload', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.enable('test-plugin');
    lifecycle.unload('test-plugin');
    const plugin = lifecycle.getAll().find((p) => p.manifest.id === 'test-plugin')!;
    expect(plugin.loadedAt).toBeUndefined();
    expect(plugin.enabledAt).toBeUndefined();
  });

  it('should not throw when unloading a non-existent plugin', () => {
    expect(() => lifecycle.unload('nonexistent')).not.toThrow();
  });

  // ─── enable / disable ──────────────────────────────────────

  it('should enable a loaded plugin', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.enable('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('enabled');
  });

  it('should set enabledAt when enabling', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.enable('test-plugin');
    const plugin = lifecycle.getAll().find((p) => p.manifest.id === 'test-plugin')!;
    expect(plugin.enabledAt).toBeDefined();
    expect(plugin.enabledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should not enable a plugin that is not loaded', () => {
    lifecycle.register(validManifest());
    lifecycle.enable('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('registered');
  });

  it('should disable an enabled plugin', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.enable('test-plugin');
    lifecycle.disable('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('disabled');
  });

  it('should clear enabledAt on disable', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.enable('test-plugin');
    lifecycle.disable('test-plugin');
    const plugin = lifecycle.getAll().find((p) => p.manifest.id === 'test-plugin')!;
    expect(plugin.enabledAt).toBeUndefined();
  });

  it('should not disable a plugin that is not enabled', async () => {
    lifecycle.register(validManifest());
    await lifecycle.load('test-plugin');
    lifecycle.disable('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('loaded');
  });

  // ─── getStatus / getAll ────────────────────────────────────

  it('should return undefined for non-existent plugin', () => {
    expect(lifecycle.getStatus('ghost')).toBeUndefined();
  });

  it('should return all registered plugins from getAll', () => {
    lifecycle.register(validManifest({ id: 'a' }));
    lifecycle.register(validManifest({ id: 'b' }));
    lifecycle.register(validManifest({ id: 'c' }));
    expect(lifecycle.getAll()).toHaveLength(3);
  });

  it('should return plugin instances with correct shape', () => {
    lifecycle.register(validManifest({ id: 'x' }));
    const instance = lifecycle.getAll()[0];
    expect(instance.manifest).toBeDefined();
    expect(instance.status).toBeDefined();
    expect(instance.manifest.id).toBe('x');
  });

  // ─── unregister ────────────────────────────────────────────

  it('should remove a plugin from the registry', () => {
    lifecycle.register(validManifest());
    lifecycle.unregister('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBeUndefined();
    expect(lifecycle.getAll()).toHaveLength(0);
  });

  it('should not throw when unregistering a non-existent plugin', () => {
    expect(() => lifecycle.unregister('ghost')).not.toThrow();
  });

  // ─── dependency resolution ─────────────────────────────────

  it('should resolve a flat dependency chain in correct order', () => {
    lifecycle.register(validManifest({ id: 'lib', name: 'Lib' }));
    lifecycle.register(
      validManifest({
        id: 'core',
        name: 'Core',
        dependencies: [{ pluginId: 'lib', version: '1.0.0' }],
      }),
    );
    lifecycle.register(
      validManifest({
        id: 'app',
        name: 'App',
        dependencies: [{ pluginId: 'core', version: '1.0.0' }],
      }),
    );
    const order = lifecycle.resolveDependencies('app');
    expect(order).toEqual(['lib', 'core', 'app']);
  });

  it('should resolve a diamond dependency correctly', () => {
    lifecycle.register(validManifest({ id: 'base', name: 'Base' }));
    lifecycle.register(
      validManifest({
        id: 'left',
        name: 'Left',
        dependencies: [{ pluginId: 'base', version: '1.0.0' }],
      }),
    );
    lifecycle.register(
      validManifest({
        id: 'right',
        name: 'Right',
        dependencies: [{ pluginId: 'base', version: '1.0.0' }],
      }),
    );
    lifecycle.register(
      validManifest({
        id: 'top',
        name: 'Top',
        dependencies: [
          { pluginId: 'left', version: '1.0.0' },
          { pluginId: 'right', version: '1.0.0' },
        ],
      }),
    );
    const order = lifecycle.resolveDependencies('top');
    expect(order[0]).toBe('base');
    expect(order).toContain('left');
    expect(order).toContain('right');
    expect(order[order.length - 1]).toBe('top');
  });

  it('should resolve a single plugin with no deps as itself', () => {
    lifecycle.register(validManifest({ id: 'standalone' }));
    expect(lifecycle.resolveDependencies('standalone')).toEqual(['standalone']);
  });

  it('should throw on circular dependencies', () => {
    lifecycle.register(
      validManifest({ id: 'a', dependencies: [{ pluginId: 'b', version: '1.0.0' }] }),
    );
    lifecycle.register(
      validManifest({ id: 'b', dependencies: [{ pluginId: 'a', version: '1.0.0' }] }),
    );
    expect(() => lifecycle.resolveDependencies('a')).toThrow('Circular dependency');
  });

  it('should detect deeper circular dependencies', () => {
    lifecycle.register(
      validManifest({ id: 'a', dependencies: [{ pluginId: 'b', version: '1.0.0' }] }),
    );
    lifecycle.register(
      validManifest({ id: 'b', dependencies: [{ pluginId: 'c', version: '1.0.0' }] }),
    );
    lifecycle.register(
      validManifest({ id: 'c', dependencies: [{ pluginId: 'a', version: '1.0.0' }] }),
    );
    expect(() => lifecycle.resolveDependencies('a')).toThrow('Circular dependency');
  });

  // ─── validation ────────────────────────────────────────────

  it('should return error for missing id', () => {
    const errors = lifecycle.validate(validManifest({ id: '' }));
    expect(errors).toContain('Missing required field: id');
  });

  it('should return error for missing name', () => {
    const errors = lifecycle.validate(validManifest({ name: '' }));
    expect(errors).toContain('Missing required field: name');
  });

  it('should return error for missing version', () => {
    const errors = lifecycle.validate(validManifest({ version: '' }));
    expect(errors).toContain('Missing required field: version');
  });

  it('should return error for invalid version format', () => {
    const errors = lifecycle.validate(validManifest({ version: 'abc' }));
    expect(errors).toContain('Invalid version format: must be semver (e.g. 1.0.0)');
  });

  it('should return error for missing dependency pluginId', () => {
    const errors = lifecycle.validate(
      validManifest({ dependencies: [{ pluginId: '', version: '1.0.0' }] }),
    );
    expect(errors).toContain('Dependency missing required field: pluginId');
  });

  it('should return error for missing dependency version', () => {
    const errors = lifecycle.validate(
      validManifest({ dependencies: [{ pluginId: 'dep-x', version: '' }] }),
    );
    expect(errors).toContain('Dependency "dep-x" missing required field: version');
  });

  it('should return error for invalid minEngineVersion', () => {
    const errors = lifecycle.validate(validManifest({ minEngineVersion: 'beta' }));
    expect(errors).toContain('Invalid minEngineVersion format: must be semver (e.g. 1.0.0)');
  });

  it('should return no errors for a valid manifest', () => {
    const errors = lifecycle.validate(validManifest());
    expect(errors).toHaveLength(0);
  });

  it('should return multiple errors for completely empty manifest', () => {
    const errors = lifecycle.validate({} as unknown as PluginManifest);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  // ─── full lifecycle ────────────────────────────────────────

  it('should complete a full register → load → enable → disable → unload cycle', async () => {
    lifecycle.register(validManifest());
    expect(lifecycle.getStatus('test-plugin')).toBe('registered');
    await lifecycle.load('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('loaded');
    lifecycle.enable('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('enabled');
    lifecycle.disable('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('disabled');
    lifecycle.unload('test-plugin');
    expect(lifecycle.getStatus('test-plugin')).toBe('unloaded');
  });
});
