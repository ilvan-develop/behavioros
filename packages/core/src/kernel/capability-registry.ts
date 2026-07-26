export interface CapabilityInfo {
  id: string;
  name: string;
  version: string;
  provider: string;
  type: 'tool' | 'model' | 'workflow' | 'plugin' | 'skill' | 'connector' | 'agent';
  description: string;
  permissions: string[];
  dependencies: string[];
  cost: { perCall: number; unit: string };
  latency: { p50: number; p99: number; unit: string };
  reliability: number;
  status: 'active' | 'deprecated' | 'experimental';
  tags: string[];
}

export class CapabilityRegistry {
  private capabilities = new Map<string, CapabilityInfo>();

  register(info: CapabilityInfo): void {
    if (this.capabilities.has(info.id)) {
      throw new Error(`Capability with id '${info.id}' is already registered`);
    }
    this.capabilities.set(info.id, info);
  }

  get(id: string): CapabilityInfo | undefined {
    const cap = this.capabilities.get(id);
    if (!cap) {
      throw new Error(`Capability with id '${id}' not found`);
    }
    return cap;
  }

  findByType(type: string): CapabilityInfo[] {
    return this.getAll().filter((c) => c.type === type);
  }

  findByProvider(provider: string): CapabilityInfo[] {
    return this.getAll().filter((c) => c.provider === provider);
  }

  findByTag(tag: string): CapabilityInfo[] {
    return this.getAll().filter((c) => c.tags.includes(tag));
  }

  findAlternatives(id: string): CapabilityInfo[] {
    const cap = this.get(id);
    if (!cap) return [];
    return this.getAll().filter((c) => c.type === cap.type && c.provider !== cap.provider);
  }

  getDependencies(id: string): CapabilityInfo[] {
    const cap = this.get(id);
    if (!cap) return [];
    return cap.dependencies
      .map((depId) => {
        try {
          return this.get(depId);
        } catch {
          return undefined;
        }
      })
      .filter((d): d is CapabilityInfo => d !== undefined);
  }

  getDependents(id: string): CapabilityInfo[] {
    return this.getAll().filter((c) => c.dependencies.includes(id));
  }

  getAll(): CapabilityInfo[] {
    return Array.from(this.capabilities.values());
  }

  remove(id: string): void {
    if (!this.capabilities.has(id)) {
      throw new Error(`Capability with id '${id}' not found`);
    }
    this.capabilities.delete(id);
  }

  checkCircularDependency(id: string, dependencyId: string): boolean {
    const visited = new Set<string>();
    const queue = [dependencyId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === id) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const cap = this.capabilities.get(current);
      if (cap) {
        queue.push(...cap.dependencies);
      }
    }
    return false;
  }
}
