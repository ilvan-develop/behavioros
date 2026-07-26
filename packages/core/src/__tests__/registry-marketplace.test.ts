import { beforeEach, describe, expect, it } from 'vitest';
import { Marketplace } from '../engines/ecosystem/marketplace';
import { Registry } from '../engines/ecosystem/registry';

describe('Registry', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  describe('publish', () => {
    it('should publish a new package', () => {
      registry.publish({
        id: 'test-pkg',
        name: 'Test Package',
        type: 'plugin',
        version: '1.0.0',
        tags: ['test', 'alpha'],
      });

      const pkg = registry.get('test-pkg');
      expect(pkg).toBeDefined();
      expect(pkg!.name).toBe('Test Package');
      expect(pkg!.type).toBe('plugin');
      expect(pkg!.latestVersion).toBe('1.0.0');
      expect(pkg!.versions).toHaveLength(1);
      expect(pkg!.tags).toEqual(['test', 'alpha']);
      expect(pkg!.createdAt).toBeDefined();
      expect(pkg!.updatedAt).toBeDefined();
    });

    it('should add a version to an existing package', () => {
      registry.publish({
        id: 'test-pkg',
        name: 'Test Package',
        type: 'engine',
        version: '1.0.0',
        tags: [],
      });

      registry.publish({
        id: 'test-pkg',
        name: 'Test Package',
        type: 'engine',
        version: '2.0.0',
        tags: [],
      });

      const pkg = registry.get('test-pkg');
      expect(pkg!.versions).toHaveLength(2);
      expect(pkg!.latestVersion).toBe('2.0.0');
    });
  });

  describe('get', () => {
    it('should return undefined for an unknown package', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should return the package info', () => {
      registry.publish({
        id: 'my-pkg',
        name: 'My Package',
        type: 'skill',
        version: '0.1.0',
        tags: ['beta'],
      });

      const pkg = registry.get('my-pkg');
      expect(pkg).toBeDefined();
      expect(pkg!.id).toBe('my-pkg');
      expect(pkg!.type).toBe('skill');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.publish({
        id: 'auth-plugin',
        name: 'Authentication Plugin',
        type: 'plugin',
        version: '1.0.0',
        tags: ['auth', 'security'],
      });

      registry.publish({
        id: 'payment-engine',
        name: 'Payment Engine',
        type: 'engine',
        version: '2.0.0',
        tags: ['payments', 'billing'],
      });

      registry.publish({
        id: 'ui-template',
        name: 'UI Template Pack',
        type: 'template',
        version: '0.5.0',
        tags: ['ui', 'react'],
      });
    });

    it('should find packages by name', () => {
      const results = registry.search('payment');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('payment-engine');
    });

    it('should find packages by tag', () => {
      const results = registry.search('auth');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('auth-plugin');
    });

    it('should filter by type', () => {
      const results = registry.search('plugin', { type: 'plugin' });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('auth-plugin');
    });

    it('should return empty when type filter excludes all', () => {
      const results = registry.search('', { type: 'pattern' });
      expect(results).toHaveLength(0);
    });

    it('should filter by tags option', () => {
      const results = registry.search('', { tags: ['billing'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('payment-engine');
    });
  });

  describe('resolveVersion', () => {
    beforeEach(() => {
      registry.publish({
        id: 'semver-pkg',
        name: 'Semver Package',
        type: 'plugin',
        version: '1.0.0',
        tags: [],
      });

      registry.publish({
        id: 'semver-pkg',
        name: 'Semver Package',
        type: 'plugin',
        version: '1.2.0',
        tags: [],
      });

      registry.publish({
        id: 'semver-pkg',
        name: 'Semver Package',
        type: 'plugin',
        version: '2.0.0',
        tags: [],
      });
    });

    it('should resolve latest', () => {
      expect(registry.resolveVersion('semver-pkg', 'latest')).toBe('2.0.0');
    });

    it('should resolve exact version', () => {
      expect(registry.resolveVersion('semver-pkg', '1.2.0')).toBe('1.2.0');
    });

    it('should resolve caret range to highest matching', () => {
      expect(registry.resolveVersion('semver-pkg', '^1.0.0')).toBe('1.2.0');
    });

    it('should resolve tilde range', () => {
      registry.publish({
        id: 'semver-pkg',
        name: 'Semver Package',
        type: 'plugin',
        version: '1.2.1',
        tags: [],
      });
      expect(registry.resolveVersion('semver-pkg', '~1.2.0')).toBe('1.2.1');
    });

    it('should throw for unknown package', () => {
      expect(() => registry.resolveVersion('unknown', 'latest')).toThrow(
        'Package unknown not found',
      );
    });

    it('should throw for unsatisfiable range', () => {
      expect(() => registry.resolveVersion('semver-pkg', '^3.0.0')).toThrow(
        'No version of semver-pkg satisfies ^3.0.0',
      );
    });
  });

  describe('getDependencies', () => {
    it('should return dependencies for a version', () => {
      registry.publish({
        id: 'with-deps',
        name: 'With Dependencies',
        type: 'pattern',
        version: '1.0.0',
        tags: [],
      });
      registry.publish({
        id: 'with-deps',
        name: 'With Dependencies',
        type: 'pattern',
        version: '2.0.0',
        tags: [],
      });

      const pkg = registry.get('with-deps')!;
      pkg.versions[0].dependencies = [{ packageId: 'auth-plugin', version: '^1.0.0' }];

      const deps = registry.getDependencies('with-deps', '2.0.0');
      expect(deps).toEqual([{ packageId: 'auth-plugin', version: '^1.0.0' }]);
    });

    it('should throw for unknown version', () => {
      registry.publish({
        id: 'pkg',
        name: 'Pkg',
        type: 'plugin',
        version: '1.0.0',
        tags: [],
      });
      expect(() => registry.getDependencies('pkg', '9.9.9')).toThrow(
        'Version 9.9.9 of pkg not found',
      );
    });
  });

  describe('list', () => {
    beforeEach(() => {
      registry.publish({
        id: 'a1',
        name: 'Alpha',
        type: 'plugin',
        version: '1.0.0',
        tags: [],
      });
      registry.publish({
        id: 'a2',
        name: 'Beta',
        type: 'engine',
        version: '1.0.0',
        tags: [],
      });
      registry.publish({
        id: 'a3',
        name: 'Gamma',
        type: 'skill',
        version: '1.0.0',
        tags: [],
      });
    });

    it('should return all packages', () => {
      expect(registry.list()).toHaveLength(3);
    });

    it('should filter by type', () => {
      const engines = registry.list('engine');
      expect(engines).toHaveLength(1);
      expect(engines[0].id).toBe('a2');
    });
  });

  describe('deprecate', () => {
    it('should deprecate a package', () => {
      registry.publish({
        id: 'old-pkg',
        name: 'Old Package',
        type: 'plugin',
        version: '1.0.0',
        tags: [],
      });

      registry.deprecate('old-pkg', 'Use new-pkg instead');
      expect(registry.isDeprecated('old-pkg')).toEqual({
        deprecated: true,
        reason: 'Use new-pkg instead',
      });
    });

    it('should throw for unknown package', () => {
      expect(() => registry.deprecate('unknown', 'reason')).toThrow('Package unknown not found');
    });
  });

  describe('latest', () => {
    it('should return the latest version', () => {
      registry.publish({
        id: 'ver-pkg',
        name: 'Versioned Package',
        type: 'pattern',
        version: '0.0.1',
        tags: [],
      });
      registry.publish({
        id: 'ver-pkg',
        name: 'Versioned Package',
        type: 'pattern',
        version: '1.0.0',
        tags: [],
      });
      expect(registry.latest('ver-pkg')).toBe('1.0.0');
    });

    it('should return undefined for unknown package', () => {
      expect(registry.latest('unknown')).toBeUndefined();
    });
  });
});

describe('Marketplace', () => {
  let registry: Registry;
  let marketplace: Marketplace;

  beforeEach(() => {
    registry = new Registry();
    marketplace = new Marketplace(registry);
  });

  describe('listFeatured', () => {
    it('should return only featured listings', () => {
      marketplace.addListing('pkg-a', 'utils', { featured: true });
      marketplace.addListing('pkg-b', 'utils', { featured: false });
      marketplace.addListing('pkg-c', 'ui', { featured: true });

      const featured = marketplace.listFeatured();
      expect(featured).toHaveLength(2);
      expect(featured.map((l) => l.packageId).sort()).toEqual(['pkg-a', 'pkg-c']);
    });

    it('should return empty when no featured listings exist', () => {
      marketplace.addListing('pkg-a', 'utils');
      expect(marketplace.listFeatured()).toHaveLength(0);
    });
  });

  describe('listByCategory', () => {
    it('should filter listings by category', () => {
      marketplace.addListing('pkg-a', 'auth');
      marketplace.addListing('pkg-b', 'payments');
      marketplace.addListing('pkg-c', 'auth');

      const authListings = marketplace.listByCategory('auth');
      expect(authListings).toHaveLength(2);
      expect(authListings.map((l) => l.packageId).sort()).toEqual(['pkg-a', 'pkg-c']);
    });

    it('should return empty for unknown category', () => {
      expect(marketplace.listByCategory('nonexistent')).toHaveLength(0);
    });
  });

  describe('install / uninstall / getInstalled', () => {
    beforeEach(() => {
      registry.publish({
        id: 'cool-plugin',
        name: 'Cool Plugin',
        type: 'plugin',
        version: '1.0.0',
        tags: ['cool'],
      });
      registry.publish({
        id: 'nice-engine',
        name: 'Nice Engine',
        type: 'engine',
        version: '2.0.0',
        tags: ['nice'],
      });
    });

    it('should install a package for a user', () => {
      const result = marketplace.install('cool-plugin', 'user-1');
      expect(result).toBe(true);
      expect(marketplace.getInstalled('user-1')).toEqual(['cool-plugin']);
    });

    it('should return false when installing the same package twice', () => {
      marketplace.install('cool-plugin', 'user-1');
      const result = marketplace.install('cool-plugin', 'user-1');
      expect(result).toBe(false);
    });

    it('should throw when installing unknown package', () => {
      expect(() => marketplace.install('unknown', 'user-1')).toThrow(
        'Package unknown not found in registry',
      );
    });

    it('should uninstall a package for a user', () => {
      marketplace.install('cool-plugin', 'user-1');
      const result = marketplace.uninstall('cool-plugin', 'user-1');
      expect(result).toBe(true);
      expect(marketplace.getInstalled('user-1')).toHaveLength(0);
    });

    it('should return false when uninstalling a package not installed', () => {
      const result = marketplace.uninstall('cool-plugin', 'user-1');
      expect(result).toBe(false);
    });

    it('should isolate installations between users', () => {
      marketplace.install('cool-plugin', 'user-1');
      marketplace.install('nice-engine', 'user-2');
      marketplace.install('cool-plugin', 'user-2');

      expect(marketplace.getInstalled('user-1')).toEqual(['cool-plugin']);
      expect(marketplace.getInstalled('user-2').sort()).toEqual(['cool-plugin', 'nice-engine']);
    });

    it('should track install count on listing', () => {
      const listing = marketplace.addListing('cool-plugin', 'utils');
      expect(listing.installCount).toBe(0);

      marketplace.install('cool-plugin', 'user-1');
      expect(listing.installCount).toBe(1);

      marketplace.install('cool-plugin', 'user-2');
      expect(listing.installCount).toBe(2);

      marketplace.uninstall('cool-plugin', 'user-1');
      expect(listing.installCount).toBe(1);
    });
  });

  describe('rate / getReviews', () => {
    beforeEach(() => {
      registry.publish({
        id: 'rateable-pkg',
        name: 'Rateable Package',
        type: 'skill',
        version: '1.0.0',
        tags: ['test'],
      });
    });

    it('should add a review and update rating', () => {
      const review = marketplace.rate('rateable-pkg', 'user-1', 4, 'Good', 'Works well');
      expect(review.rating).toBe(4);
      expect(review.title).toBe('Good');
      expect(review.content).toBe('Works well');
      expect(review.packageId).toBe('rateable-pkg');

      const listing = marketplace.listByCategory('uncategorized')[0];
      expect(listing.rating).toBe(4);
      expect(listing.reviewCount).toBe(1);
    });

    it('should calculate average rating across reviews', () => {
      marketplace.rate('rateable-pkg', 'user-1', 4);
      marketplace.rate('rateable-pkg', 'user-2', 5);
      marketplace.rate('rateable-pkg', 'user-3', 3);

      const listing = marketplace.listByCategory('uncategorized')[0];
      expect(listing.rating).toBe(4);
      expect(listing.reviewCount).toBe(3);
    });

    it('should throw for invalid rating out of range', () => {
      expect(() => marketplace.rate('rateable-pkg', 'user-1', 6)).toThrow(
        'Rating must be between 0 and 5',
      );
    });

    it('should throw for unknown package', () => {
      expect(() => marketplace.rate('unknown', 'user-1', 3)).toThrow(
        'Package unknown not found in registry',
      );
    });

    it('should return reviews for a specific package', () => {
      marketplace.rate('rateable-pkg', 'user-1', 5, 'Excellent');

      registry.publish({
        id: 'other-pkg',
        name: 'Other',
        type: 'plugin',
        version: '1.0.0',
        tags: [],
      });
      marketplace.rate('other-pkg', 'user-1', 2);

      const reviews = marketplace.getReviews('rateable-pkg');
      expect(reviews).toHaveLength(1);
      expect(reviews[0].title).toBe('Excellent');
    });
  });

  describe('search', () => {
    beforeEach(() => {
      registry.publish({
        id: 'auth-suite',
        name: 'Auth Suite',
        type: 'plugin',
        version: '1.0.0',
        tags: ['auth', 'security'],
      });
      registry.publish({
        id: 'pay-suite',
        name: 'Payment Suite',
        type: 'engine',
        version: '2.0.0',
        tags: ['payments', 'billing'],
      });

      marketplace.addListing('auth-suite', 'security');
      marketplace.addListing('pay-suite', 'finance');
    });

    it('should find listings by package name', () => {
      const results = marketplace.search('auth');
      expect(results).toHaveLength(1);
      expect(results[0].packageId).toBe('auth-suite');
    });

    it('should filter by category', () => {
      const results = marketplace.search('suite', 'finance');
      expect(results).toHaveLength(1);
      expect(results[0].packageId).toBe('pay-suite');
    });

    it('should return empty when no matches', () => {
      expect(marketplace.search('zzzzz')).toHaveLength(0);
    });
  });

  describe('getAllCategories', () => {
    it('should return sorted unique categories', () => {
      marketplace.addListing('a', 'ui');
      marketplace.addListing('b', 'auth');
      marketplace.addListing('c', 'ui');
      marketplace.addListing('d', 'security');

      expect(marketplace.getAllCategories()).toEqual(['auth', 'security', 'ui']);
    });

    it('should return empty when no listings', () => {
      expect(marketplace.getAllCategories()).toEqual([]);
    });
  });

  describe('addListing', () => {
    it('should create a new listing with defaults', () => {
      const listing = marketplace.addListing('new-pkg', 'utils');
      expect(listing.packageId).toBe('new-pkg');
      expect(listing.category).toBe('utils');
      expect(listing.featured).toBe(false);
      expect(listing.verified).toBe(false);
      expect(listing.rating).toBe(0);
      expect(listing.installCount).toBe(0);
      expect(listing.reviewCount).toBe(0);
    });

    it('should update an existing listing', () => {
      marketplace.addListing('pkg', 'old-cat');
      const updated = marketplace.addListing('pkg', 'new-cat', {
        featured: true,
        verified: true,
      });
      expect(updated.category).toBe('new-cat');
      expect(updated.featured).toBe(true);
      expect(updated.verified).toBe(true);
    });
  });
});
