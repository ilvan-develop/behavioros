import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceDiscovery } from '../engines/cloud/service-discovery';

describe('ServiceDiscovery', () => {
  let sd: ServiceDiscovery;

  beforeEach(() => {
    vi.useFakeTimers();
    sd = new ServiceDiscovery();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseService = {
    name: 'api-gateway',
    version: '1.0.0',
    address: '192.168.1.10',
    port: 8080,
    protocol: 'http',
    tags: ['production', 'us-east-1'],
    ttl: 30,
  };

  describe('register', () => {
    it('returns a unique id for each registration', () => {
      const id1 = sd.register(baseService);
      const id2 = sd.register({ ...baseService, name: 'auth-service' });

      expect(id1).toBeTypeOf('string');
      expect(id2).toBeTypeOf('string');
      expect(id1).not.toBe(id2);
    });

    it('creates a service with default status unknown and timestamps', () => {
      const id = sd.register(baseService);
      const service = sd.getService(id);

      expect(service).toBeDefined();
      expect(service!.status).toBe('unknown');
      expect(service!.registeredAt).toBeTypeOf('string');
      expect(service!.lastHeartbeat).toBeTypeOf('string');
      expect(service!.id).toBe(id);
    });
  });

  describe('discover', () => {
    it('returns all services when no query is provided', () => {
      sd.register(baseService);
      sd.register({ ...baseService, name: 'auth-service' });

      const results = sd.discover();
      expect(results).toHaveLength(2);
    });

    it('filters by name', () => {
      sd.register(baseService);
      sd.register({ ...baseService, name: 'auth-service' });

      const results = sd.discover({ name: 'api-gateway' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('api-gateway');
    });

    it('filters by tags (partial match)', () => {
      sd.register(baseService);
      sd.register({ ...baseService, tags: ['staging', 'eu-west-1'] });

      const results = sd.discover({ tags: ['production'] });
      expect(results).toHaveLength(1);
    });

    it('filters by status', () => {
      const id = sd.register(baseService);
      sd.setHealth(id, true);

      const results = sd.discover({ status: 'up' });
      expect(results).toHaveLength(1);
    });

    it('filters by healthy flag (status === up)', () => {
      const id1 = sd.register(baseService);
      const _id2 = sd.register({ ...baseService, name: 'down-service' });
      sd.setHealth(id1, true);

      const results = sd.discover({ healthy: true });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('api-gateway');
    });

    it('combines multiple filters', () => {
      const id = sd.register(baseService);
      sd.setHealth(id, true);

      const results = sd.discover({
        name: 'api-gateway',
        version: '1.0.0',
        tags: ['production'],
        healthy: true,
      });
      expect(results).toHaveLength(1);
    });
  });

  describe('unregister', () => {
    it('removes a service and returns true', () => {
      const id = sd.register(baseService);
      const result = sd.unregister(id);

      expect(result).toBe(true);
      expect(sd.getService(id)).toBeUndefined();
    });

    it('returns false for non-existent id', () => {
      expect(sd.unregister('non-existent')).toBe(false);
    });
  });

  describe('getService', () => {
    it('returns undefined for unknown id', () => {
      expect(sd.getService('nope')).toBeUndefined();
    });
  });

  describe('heartbeat', () => {
    it('extends ttl by updating lastHeartbeat and setting status to up', () => {
      const id = sd.register(baseService);
      const original = sd.getService(id)!.lastHeartbeat;

      vi.advanceTimersByTime(10_000);
      sd.heartbeat(id);

      const updated = sd.getService(id)!;
      expect(updated.lastHeartbeat).not.toBe(original);
      expect(updated.status).toBe('up');
    });

    it('returns false for non-existent service', () => {
      expect(sd.heartbeat('nope')).toBe(false);
    });
  });

  describe('setHealth', () => {
    it('sets status to up when healthy is true', () => {
      const id = sd.register(baseService);
      sd.setHealth(id, true);
      expect(sd.getService(id)!.status).toBe('up');
    });

    it('sets status to down when healthy is false', () => {
      const id = sd.register(baseService);
      sd.setHealth(id, false);
      expect(sd.getService(id)!.status).toBe('down');
    });
  });

  describe('cleanup', () => {
    it('removes services whose lastHeartbeat exceeds ttl', () => {
      const id = sd.register(baseService);
      expect(sd.discover()).toHaveLength(1);

      vi.advanceTimersByTime(31_000);
      const removed = sd.cleanup();

      expect(removed).toBe(1);
      expect(sd.getService(id)).toBeUndefined();
    });

    it('does not remove services within ttl', () => {
      sd.register(baseService);

      vi.advanceTimersByTime(15_000);
      const removed = sd.cleanup();

      expect(removed).toBe(0);
    });
  });

  describe('watch', () => {
    it('fires callback immediately with current matching services', () => {
      const cb = vi.fn();
      sd.register(baseService);

      sd.watch({ name: 'api-gateway' }, cb);

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb.mock.calls[0][0]).toHaveLength(1);
    });

    it('fires callback on register when query matches', () => {
      const cb = vi.fn();
      sd.watch({ name: 'auth-service' }, cb);
      cb.mockClear();

      sd.register({ ...baseService, name: 'auth-service' });

      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('does not fire after unsubscribe', () => {
      const cb = vi.fn();
      const unsubscribe = sd.watch({ name: 'api-gateway' }, cb);
      cb.mockClear();

      unsubscribe();
      sd.register(baseService);

      expect(cb).not.toHaveBeenCalled();
    });
  });
});
