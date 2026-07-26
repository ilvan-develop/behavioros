export interface EngineInfo {
  id: string;
  name: string;
  type: string;
  version: string;
  status: 'registered' | 'initialized' | 'started' | 'stopped' | 'error';
  metadata: Record<string, unknown>;
}

export class EngineRegistry {
  private engines = new Map<string, EngineInfo>();

  register(info: Omit<EngineInfo, 'status'>): void {
    if (this.engines.has(info.id)) {
      throw new Error(`Engine with id '${info.id}' is already registered`);
    }
    this.engines.set(info.id, { ...info, status: 'registered' });
  }

  get(id: string): EngineInfo | undefined {
    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(`Engine with id '${id}' not found`);
    }
    return engine;
  }

  list(type?: string): EngineInfo[] {
    const all = this.getAll();
    if (type) {
      return all.filter((e) => e.type === type);
    }
    return all;
  }

  updateStatus(id: string, status: EngineInfo['status']): void {
    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(`Engine with id '${id}' not found`);
    }
    this.engines.set(id, { ...engine, status });
  }

  findByType(type: string): EngineInfo[] {
    return this.getAll().filter((e) => e.type === type);
  }

  findByTag(tag: string): EngineInfo[] {
    return this.getAll().filter((e) => {
      const tags = e.metadata?.tags;
      return Array.isArray(tags) && tags.includes(tag);
    });
  }

  getAll(): EngineInfo[] {
    return Array.from(this.engines.values());
  }

  remove(id: string): void {
    if (!this.engines.has(id)) {
      throw new Error(`Engine with id '${id}' not found`);
    }
    this.engines.delete(id);
  }
}
