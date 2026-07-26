/**
 * PluginManifest — Configuration and options interface.
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: { pluginId: string; version: string }[];
  minEngineVersion?: string;
  permissions?: string[];
  hooks?: string[];
}

/**
 * PluginStatus — Type alias for pluginstatus.
 */
export type PluginStatus =
  | 'registered'
  | 'loading'
  | 'loaded'
  | 'enabled'
  | 'disabled'
  | 'error'
  | 'unloaded';

/**
 * PluginInstance — Configuration and options interface.
 */
export interface PluginInstance {
  manifest: PluginManifest;
  status: PluginStatus;
  loadedAt?: string;
  enabledAt?: string;
  error?: string;
  exports?: Record<string, unknown>;
}

/**
 * PluginLifecycle — plugin lifecycle.
 *
 * Methods: register, load, unload, enable, disable, getStatus, and 5 more.
 */
export class PluginLifecycle {
  private plugins = new Map<string, PluginInstance>();

  register(manifest: PluginManifest): void {
    const errors = this.validate(manifest);
    if (errors.length > 0) {
      this.plugins.set(manifest.id, {
        manifest,
        status: 'error',
        error: errors.join('; '),
      });
      return;
    }
    this.plugins.set(manifest.id, {
      manifest,
      status: 'registered',
    });
  }

  async load(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    const errors = this.validate(plugin.manifest);
    if (errors.length > 0) {
      this.plugins.set(pluginId, { ...plugin, status: 'error', error: errors.join('; ') });
      return false;
    }

    this.plugins.set(pluginId, {
      ...plugin,
      status: 'loading',
      loadedAt: new Date().toISOString(),
    });

    this.plugins.set(pluginId, {
      ...this.plugins.get(pluginId)!,
      status: 'loaded',
    });

    return true;
  }

  unload(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    this.plugins.set(pluginId, {
      ...plugin,
      status: 'unloaded',
      loadedAt: undefined,
      enabledAt: undefined,
      exports: undefined,
    });
  }

  enable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin?.status !== 'loaded') return;
    this.plugins.set(pluginId, {
      ...plugin,
      status: 'enabled',
      enabledAt: new Date().toISOString(),
    });
  }

  disable(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin?.status !== 'enabled') return;
    this.plugins.set(pluginId, { ...plugin, status: 'disabled', enabledAt: undefined });
  }

  getStatus(pluginId: string): PluginStatus | undefined {
    return this.plugins.get(pluginId)?.status;
  }

  getAll(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  resolveDependencies(pluginId: string): string[] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const order: string[] = [];

    const visit = (id: string): void => {
      if (stack.has(id)) {
        throw new Error(`Circular dependency detected for plugin: ${id}`);
      }
      if (visited.has(id)) return;
      visited.add(id);
      stack.add(id);

      const plugin = this.plugins.get(id);
      if (plugin?.manifest.dependencies) {
        for (const dep of plugin.manifest.dependencies) {
          visit(dep.pluginId);
        }
      }

      stack.delete(id);
      order.push(id);
    };

    visit(pluginId);
    return order;
  }

  validate(manifest: PluginManifest): string[] {
    const errors: string[] = [];
    if (!manifest.id || manifest.id.trim() === '') {
      errors.push('Missing required field: id');
    }
    if (!manifest.name || manifest.name.trim() === '') {
      errors.push('Missing required field: name');
    }
    if (!manifest.version || manifest.version.trim() === '') {
      errors.push('Missing required field: version');
    } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Invalid version format: must be semver (e.g. 1.0.0)');
    }
    if (manifest.dependencies) {
      for (const dep of manifest.dependencies) {
        if (!dep.pluginId) {
          errors.push('Dependency missing required field: pluginId');
        }
        if (!dep.version) {
          errors.push(
            `Dependency "${dep.pluginId || '(missing id)'}" missing required field: version`,
          );
        }
      }
    }
    if (manifest.minEngineVersion && !/^\d+\.\d+\.\d+/.test(manifest.minEngineVersion)) {
      errors.push('Invalid minEngineVersion format: must be semver (e.g. 1.0.0)');
    }
    return errors;
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }
}
