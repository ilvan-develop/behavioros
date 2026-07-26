import { beforeEach, describe, expect, it } from 'vitest';
import { CapabilityMarketplace } from '../engines/intelligence/capability-marketplace';
import { SemanticRegistry } from '../engines/intelligence/semantic-registry';

describe('CapabilityMarketplace', () => {
  let marketplace: CapabilityMarketplace;

  beforeEach(() => {
    marketplace = new CapabilityMarketplace();
  });

  describe('publish', () => {
    it('should publish an entry and return an id', () => {
      const id = marketplace.publish('cap-auth', 'auth-inc', 'Authentication service', [
        'auth',
        'security',
      ]);
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.startsWith('entry-')).toBe(true);
    });
  });

  describe('getEntry', () => {
    it('should return the entry by id', () => {
      const id = marketplace.publish('cap-pay', 'pay-inc', 'Payment processing');
      const entry = marketplace.getEntry(id);
      expect(entry).toBeDefined();
      expect(entry!.capabilityId).toBe('cap-pay');
      expect(entry!.publisher).toBe('pay-inc');
    });

    it('should return undefined for unknown id', () => {
      expect(marketplace.getEntry('nonexistent')).toBeUndefined();
    });
  });

  describe('search', () => {
    it('should find entries matching description', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Authentication service', ['auth']);
      marketplace.publish('cap-pay', 'pay-inc', 'Payment processing', ['payments']);
      const results = marketplace.search('payment');
      expect(results).toHaveLength(1);
      expect(results[0].capabilityId).toBe('cap-pay');
    });

    it('should find entries matching tags', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Auth service', ['security', 'auth']);
      const results = marketplace.search('security');
      expect(results).toHaveLength(1);
      expect(results[0].capabilityId).toBe('cap-auth');
    });
  });

  describe('install', () => {
    it('should install an entry and increment downloads', () => {
      const entryId = marketplace.publish('cap-auth', 'auth-inc', 'Auth service');
      const installation = marketplace.install(entryId);
      expect(installation.status).toBe('installed');
      expect(installation.entryId).toBe(entryId);
      const entry = marketplace.getEntry(entryId)!;
      expect(entry.downloads).toBe(1);
    });

    it('should throw for unknown entry', () => {
      expect(() => marketplace.install('nonexistent')).toThrow("Entry 'nonexistent' not found");
    });
  });

  describe('uninstall', () => {
    it('should remove an installation', () => {
      const entryId = marketplace.publish('cap-auth', 'auth-inc', 'Auth');
      const installation = marketplace.install(entryId);
      expect(marketplace.getInstallations()).toHaveLength(1);
      marketplace.uninstall(installation.id);
      expect(marketplace.getInstallations()).toHaveLength(0);
    });

    it('should throw for unknown installation', () => {
      expect(() => marketplace.uninstall('unknown')).toThrow("Installation 'unknown' not found");
    });
  });

  describe('getInstallations', () => {
    it('should return all installations', () => {
      const e1 = marketplace.publish('cap-1', 'p1', 'One');
      const e2 = marketplace.publish('cap-2', 'p2', 'Two');
      marketplace.install(e1);
      marketplace.install(e2);
      expect(marketplace.getInstallations()).toHaveLength(2);
    });
  });

  describe('rate', () => {
    it('should update the average rating', () => {
      const id = marketplace.publish('cap-auth', 'auth-inc', 'Auth');
      marketplace.rate(id, 4);
      marketplace.rate(id, 5);
      const entry = marketplace.getEntry(id)!;
      expect(entry.rating).toBe(4.5);
    });

    it('should throw for invalid rating', () => {
      const id = marketplace.publish('cap-auth', 'auth-inc', 'Auth');
      expect(() => marketplace.rate(id, 6)).toThrow('Rating must be between 0 and 5');
    });
  });

  describe('resolveDependencies', () => {
    it('should return the capability id as a dependency', () => {
      const id = marketplace.publish('cap-auth', 'auth-inc', 'Auth');
      const deps = marketplace.resolveDependencies(id);
      expect(deps).toEqual(['cap-auth']);
    });

    it('should throw for unknown entry', () => {
      expect(() => marketplace.resolveDependencies('unknown')).toThrow("Entry 'unknown' not found");
    });
  });
});

describe('SemanticRegistry', () => {
  let marketplace: CapabilityMarketplace;
  let registry: SemanticRegistry;

  beforeEach(() => {
    marketplace = new CapabilityMarketplace();
    registry = new SemanticRegistry(marketplace);
  });

  describe('searchBySimilarity', () => {
    it('should return exact matches with high similarity', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Authentication service', ['auth']);
      const results = registry.searchBySimilarity('authentication service');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0.3);
    });

    it('should return partial matches', () => {
      marketplace.publish('cap-pay', 'pay-inc', 'Payment processing gateway', ['payments']);
      const results = registry.searchBySimilarity('payment');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].entry.capabilityId).toBe('cap-pay');
    });

    it('should filter by minSimilarity', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Authentication service', ['auth']);
      const results = registry.searchBySimilarity('payment processing', 0.5);
      expect(results).toHaveLength(0);
    });

    it('should return empty for no match', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Auth service');
      const results = registry.searchBySimilarity('zzzzzzzz');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchByTags', () => {
    it('should return entries matching tags', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Auth', ['security', 'auth']);
      marketplace.publish('cap-pay', 'pay-inc', 'Pay', ['payments']);
      const results = registry.searchByTags(['auth']);
      expect(results).toHaveLength(1);
      expect(results[0].capabilityId).toBe('cap-auth');
    });
  });

  describe('searchByProvider', () => {
    it('should return entries matching publisher', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Auth');
      marketplace.publish('cap-pay', 'pay-inc', 'Pay');
      const results = registry.searchByProvider('auth-inc');
      expect(results).toHaveLength(1);
      expect(results[0].capabilityId).toBe('cap-auth');
    });
  });

  describe('compare', () => {
    it('should group entries by type', () => {
      marketplace.publish('cap-auth', 'auth-inc', 'Auth', ['auth']);
      marketplace.publish('cap-pay', 'pay-inc', 'Pay', ['payments']);
      const results = registry.compare(['cap-auth', 'cap-pay']);
      expect(Object.keys(results).length).toBeGreaterThan(0);
    });
  });
});
