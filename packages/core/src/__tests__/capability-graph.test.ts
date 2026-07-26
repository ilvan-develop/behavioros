import { beforeEach, describe, expect, it } from 'vitest';
import { CapabilityGraph } from '../kernel/capability-graph';
import type { CapabilityInfo } from '../kernel/capability-registry';

function makeCap(overrides: Partial<CapabilityInfo> & { id: string }): CapabilityInfo {
  return {
    name: overrides.id,
    version: '1.0.0',
    provider: 'default',
    type: 'tool',
    description: '',
    permissions: [],
    dependencies: [],
    cost: { perCall: 1, unit: 'credits' },
    latency: { p50: 10, p99: 100, unit: 'ms' },
    reliability: 0.99,
    status: 'active',
    tags: [],
    ...overrides,
  };
}

describe('CapabilityGraph', () => {
  let cg: CapabilityGraph;

  beforeEach(() => {
    cg = new CapabilityGraph();
  });

  describe('registerCapability', () => {
    it('should register a capability and return a node id', () => {
      const id = cg.registerCapability(makeCap({ id: 'cap-1' }));
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should create dependency edges for registered dependencies', () => {
      const _depId = cg.registerCapability(makeCap({ id: 'dep-1' }));
      const _capId = cg.registerCapability(makeCap({ id: 'cap-1', dependencies: ['dep-1'] }));

      const chain = cg.getDependencyChain('cap-1');
      expect(chain).toHaveLength(2);
      expect(chain[0].capabilityId).toBe('cap-1');
      expect(chain[1].capabilityId).toBe('dep-1');
    });

    it('should skip dependency edges for unregistered dependencies', () => {
      const _id = cg.registerCapability(makeCap({ id: 'cap-1', dependencies: ['nonexistent'] }));

      const chain = cg.getDependencyChain('cap-1');
      expect(chain).toHaveLength(1);
    });
  });

  describe('findCapabilityByType', () => {
    it('should return all capabilities of a given type', () => {
      cg.registerCapability(makeCap({ id: 't1', type: 'tool' }));
      cg.registerCapability(makeCap({ id: 't2', type: 'tool' }));
      cg.registerCapability(makeCap({ id: 'm1', type: 'model' }));

      const tools = cg.findCapabilityByType('tool');
      expect(tools).toHaveLength(2);
      expect(tools.map((c) => c.capabilityId).sort()).toEqual(['t1', 't2']);
    });

    it('should return empty array when no match', () => {
      cg.registerCapability(makeCap({ id: 't1', type: 'tool' }));
      expect(cg.findCapabilityByType('model')).toHaveLength(0);
    });
  });

  describe('findCapabilityByProvider', () => {
    it('should return all capabilities from a given provider', () => {
      cg.registerCapability(makeCap({ id: 'a1', provider: 'aws' }));
      cg.registerCapability(makeCap({ id: 'a2', provider: 'aws' }));
      cg.registerCapability(makeCap({ id: 'g1', provider: 'gcp' }));

      const awsCaps = cg.findCapabilityByProvider('aws');
      expect(awsCaps).toHaveLength(2);
    });
  });

  describe('findCapabilityByName', () => {
    it('should find capabilities by exact name match', () => {
      cg.registerCapability(makeCap({ id: 'text-analyzer', name: 'Text Analyzer' }));
      const found = cg.findCapabilityByName('Text Analyzer');
      expect(found).toHaveLength(1);
      expect(found[0].capabilityId).toBe('text-analyzer');
    });

    it('should find capabilities by partial name match (case insensitive)', () => {
      cg.registerCapability(makeCap({ id: 'cap-1', name: 'Image Processor' }));
      cg.registerCapability(makeCap({ id: 'cap-2', name: 'Video Processor' }));
      const found = cg.findCapabilityByName('processor');
      expect(found).toHaveLength(2);
    });
  });

  describe('getDependencyChain', () => {
    it('should return ordered dependency tree via BFS', () => {
      cg.registerCapability(makeCap({ id: 'leaf' }));
      cg.registerCapability(makeCap({ id: 'middle', dependencies: ['leaf'] }));
      cg.registerCapability(makeCap({ id: 'root', dependencies: ['middle'] }));

      const chain = cg.getDependencyChain('root');
      expect(chain.map((c) => c.capabilityId)).toEqual(['root', 'middle', 'leaf']);
    });

    it('should return empty array for unknown capability', () => {
      expect(cg.getDependencyChain('unknown')).toEqual([]);
    });
  });

  describe('suggestAlternatives', () => {
    it('should return same-type different-provider active capabilities', () => {
      cg.registerCapability(
        makeCap({ id: 'a1', type: 'model', provider: 'aws', status: 'active' }),
      );
      cg.registerCapability(
        makeCap({ id: 'g1', type: 'model', provider: 'gcp', status: 'active' }),
      );
      cg.registerCapability(
        makeCap({ id: 'a2', type: 'model', provider: 'aws', status: 'active' }),
      );

      const alts = cg.suggestAlternatives('a1');
      expect(alts).toHaveLength(1);
      expect(alts[0].provider).toBe('gcp');
    });

    it('should exclude inactive capabilities', () => {
      cg.registerCapability(
        makeCap({ id: 'a1', type: 'model', provider: 'aws', status: 'active' }),
      );
      cg.registerCapability(
        makeCap({ id: 'g1', type: 'model', provider: 'gcp', status: 'deprecated' }),
      );

      const alts = cg.suggestAlternatives('a1');
      expect(alts).toHaveLength(0);
    });

    it('should return empty for unknown capability', () => {
      expect(cg.suggestAlternatives('unknown')).toEqual([]);
    });
  });

  describe('getGraphStats', () => {
    it('should return correct totals', () => {
      cg.registerCapability(makeCap({ id: 't1', type: 'tool', provider: 'aws', dependencies: [] }));
      cg.registerCapability(
        makeCap({ id: 't2', type: 'tool', provider: 'aws', dependencies: ['t1'] }),
      );
      cg.registerCapability(
        makeCap({ id: 'm1', type: 'model', provider: 'gcp', dependencies: [] }),
      );

      const stats = cg.getGraphStats();
      expect(stats.totalCapabilities).toBe(3);
      expect(stats.byType).toEqual({ tool: 2, model: 1 });
      expect(stats.byProvider).toEqual({ aws: 2, gcp: 1 });
      expect(stats.avgDependencies).toBeCloseTo(1 / 3, 5);
    });

    it('should return zeros for empty graph', () => {
      const stats = cg.getGraphStats();
      expect(stats.totalCapabilities).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.byProvider).toEqual({});
      expect(stats.avgDependencies).toBe(0);
    });
  });

  describe('removeCapability', () => {
    it('should remove a capability and its edges', () => {
      const id = cg.registerCapability(makeCap({ id: 'cap-1', dependencies: [] }));
      expect(cg.findCapabilityByName('cap-1')).toHaveLength(1);

      cg.removeCapability(id);
      expect(cg.findCapabilityByName('cap-1')).toHaveLength(0);
    });

    it('should not break graph when removing a dependency', () => {
      cg.registerCapability(makeCap({ id: 'dep-1' }));
      const capId = cg.registerCapability(makeCap({ id: 'cap-1', dependencies: ['dep-1'] }));

      cg.removeCapability(capId);
      expect(cg.findCapabilityByName('cap-1')).toHaveLength(0);
      expect(cg.findCapabilityByName('dep-1')).toHaveLength(1);
    });
  });

  describe('findShortestPath', () => {
    it('should find shortest dependency path between two capabilities', () => {
      cg.registerCapability(makeCap({ id: 'a' }));
      cg.registerCapability(makeCap({ id: 'b', dependencies: ['a'] }));
      cg.registerCapability(makeCap({ id: 'c', dependencies: ['b'] }));

      const path = cg.findShortestPath('a', 'c');
      expect(path.map((n) => n.capabilityId)).toEqual(['a', 'b', 'c']);
    });

    it('should return empty array if no path exists', () => {
      cg.registerCapability(makeCap({ id: 'a' }));
      cg.registerCapability(makeCap({ id: 'b' }));

      expect(cg.findShortestPath('a', 'b')).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should handle circular dependencies without infinite loop', () => {
      cg.registerCapability(makeCap({ id: 'a', dependencies: [] }));
      cg.registerCapability(makeCap({ id: 'b', dependencies: ['a'] }));
      cg.registerCapability(makeCap({ id: 'c', dependencies: ['b'] }));

      const chain = cg.getDependencyChain('c');
      expect(chain.map((n) => n.capabilityId)).toEqual(['c', 'b', 'a']);
    });

    it('should return empty for find methods on empty graph', () => {
      expect(cg.findCapabilityByType('tool')).toEqual([]);
      expect(cg.findCapabilityByProvider('aws')).toEqual([]);
      expect(cg.findCapabilityByName('anything')).toEqual([]);
      expect(cg.getDependencyChain('nothing')).toEqual([]);
      expect(cg.findShortestPath('a', 'b')).toEqual([]);
    });
  });
});
