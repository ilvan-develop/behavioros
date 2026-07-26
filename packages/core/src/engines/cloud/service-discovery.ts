import { randomUUID } from 'node:crypto';

/**
 * ServiceDefinition — Configuration and options interface.
 */
export interface ServiceDefinition {
  id: string;
  name: string;
  version: string;
  address: string;
  port: number;
  protocol: string;
  tags: string[];
  healthEndpoint?: string;
  metadata?: Record<string, string>;
  status: 'up' | 'down' | 'unknown';
  registeredAt: string;
  lastHeartbeat: string;
  ttl: number;
}

/**
 * ServiceQuery — Configuration and options interface.
 */
export interface ServiceQuery {
  name?: string;
  version?: string;
  tags?: string[];
  status?: 'up' | 'down' | 'unknown';
  healthy?: boolean;
}

type WatchEntry = {
  query: ServiceQuery;
  callback: (services: ServiceDefinition[]) => void;
};

/**
 * ServiceDiscovery — service discovery.
 *
 * Methods: register, unregister, discover, getService, heartbeat, setHealth, cleanup, watch, +1 more.
 */
export class ServiceDiscovery {
  private services = new Map<string, ServiceDefinition>();
  private watches = new Set<WatchEntry>();

  register(
    service: Omit<ServiceDefinition, 'id' | 'registeredAt' | 'lastHeartbeat' | 'status'>,
  ): string {
    const id = randomUUID();
    const now = new Date().toISOString();
    const entry: ServiceDefinition = {
      ...service,
      id,
      status: 'unknown',
      registeredAt: now,
      lastHeartbeat: now,
    };
    this.services.set(id, entry);
    this.notify();
    return id;
  }

  unregister(id: string): boolean {
    const removed = this.services.delete(id);
    if (removed) this.notify();
    return removed;
  }

  discover(query?: ServiceQuery): ServiceDefinition[] {
    const all = Array.from(this.services.values());
    if (!query) return all;

    return all.filter((s) => {
      if (query.name && s.name !== query.name) return false;
      if (query.version && s.version !== query.version) return false;
      if (query.status && s.status !== query.status) return false;
      if (query.healthy === true && s.status !== 'up') return false;
      if (query.tags && query.tags.length > 0) {
        if (!query.tags.some((t) => s.tags.includes(t))) return false;
      }
      return true;
    });
  }

  getService(id: string): ServiceDefinition | undefined {
    return this.services.get(id);
  }

  heartbeat(id: string): boolean {
    const service = this.services.get(id);
    if (!service) return false;
    service.lastHeartbeat = new Date().toISOString();
    service.status = 'up';
    this.notify();
    return true;
  }

  setHealth(id: string, healthy: boolean): void {
    const service = this.services.get(id);
    if (!service) return;
    service.status = healthy ? 'up' : 'down';
    service.lastHeartbeat = new Date().toISOString();
    this.notify();
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, service] of this.services) {
      const heartbeat = new Date(service.lastHeartbeat).getTime();
      if (now - heartbeat > service.ttl * 1000) {
        this.services.delete(id);
        removed++;
      }
    }
    if (removed > 0) this.notify();
    return removed;
  }

  watch(query: ServiceQuery, callback: (services: ServiceDefinition[]) => void): () => void {
    const entry: WatchEntry = { query, callback };
    this.watches.add(entry);
    callback(this.discover(query));
    return () => {
      this.watches.delete(entry);
    };
  }

  private notify(): void {
    for (const entry of this.watches) {
      entry.callback(this.discover(entry.query));
    }
  }
}
