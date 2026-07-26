import { beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeGraph } from '../engines/knowledge/knowledge-graph';
import { KnowledgeVersioning } from '../engines/knowledge/knowledge-versioning';

describe('KnowledgeVersioning', () => {
  let kg: KnowledgeGraph;
  let kv: KnowledgeVersioning;

  beforeEach(() => {
    kg = new KnowledgeGraph();
    kv = new KnowledgeVersioning(kg);
  });

  describe('snapshot / listSnapshots', () => {
    it('should create a snapshot and return its id', () => {
      kg.addNode({
        id: 'n1',
        type: 'concept',
        label: 'Auth',
        properties: {},
      });
      const id = kv.snapshot('v1');
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should list all snapshots', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kv.snapshot('v1');
      kv.snapshot('v2');

      const snapshots = kv.listSnapshots();
      expect(snapshots).toHaveLength(2);
      expect(snapshots[0].label).toBe('v1');
      expect(snapshots[1].label).toBe('v2');
    });

    it('should capture nodes and edges in a snapshot', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'depends_on',
        weight: 1,
        properties: {},
      });

      const id = kv.snapshot('v1');
      const snapshots = kv.listSnapshots();
      const snap = snapshots.find((s) => s.id === id)!;

      expect(snap.nodes).toHaveLength(2);
      expect(snap.edges).toHaveLength(1);
      expect(snap.label).toBe('v1');
      expect(snap.createdAt).toBeDefined();
    });
  });

  describe('restore', () => {
    it('should restore graph to a previous snapshot state', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');

      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      expect(kg.query({})).toHaveLength(2);

      kv.restore(sid);
      expect(kg.query({})).toHaveLength(1);
      expect(kg.getNode('n1')).not.toBeNull();
      expect(kg.getNode('n2')).toBeNull();
    });

    it('should restore edges correctly', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'depends_on',
        weight: 1,
        properties: {},
      });

      const sid = kv.snapshot('v1');

      kg.addNode({ id: 'n3', type: 'fact', label: 'C', properties: {} });
      kg.addEdge({
        sourceId: 'n2',
        targetId: 'n3',
        relation: 'references',
        weight: 1,
        properties: {},
      });

      kv.restore(sid);
      expect(kg.query({})).toHaveLength(2);
      expect(kg.getNeighbors('n1')).toHaveLength(1);
      expect(kg.getPredecessors('n2')).toHaveLength(1);
    });

    it('should throw for non-existent snapshot', () => {
      expect(() => kv.restore('non-existent')).toThrow('Snapshot');
    });
  });

  describe('branch / listBranches', () => {
    it('should create a branch from a snapshot', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');

      const bid = kv.branch('feature-x', sid);
      expect(bid).toBeDefined();
      expect(typeof bid).toBe('string');
    });

    it('should list all branches', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');

      kv.branch('feature-x', sid);
      kv.branch('feature-y', sid);

      const branches = kv.listBranches();
      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe('feature-x');
      expect(branches[1].name).toBe('feature-y');
    });

    it('should throw for branch from non-existent snapshot', () => {
      expect(() => kv.branch('bad', 'no-snap')).toThrow('Snapshot');
    });
  });

  describe('mergeBranch', () => {
    it('should return changes made since branch creation', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');
      const bid = kv.branch('feature-a', sid);

      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });

      const changes = kv.mergeBranch(bid);
      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('add-node');
      expect(changes[0].targetId).toBe('n2');
    });

    it('should mark branch as merged', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');
      const bid = kv.branch('feature-a', sid);

      kv.mergeBranch(bid);

      const branch = kv.listBranches().find((b) => b.id === bid)!;
      expect(branch.status).toBe('merged');
    });
  });

  describe('diff', () => {
    it('should detect added nodes between snapshots', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sidA = kv.snapshot('v1');

      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      const sidB = kv.snapshot('v2');

      const changes = kv.diff(sidA, sidB);
      expect(changes.some((c) => c.type === 'add-node' && c.targetId === 'n2')).toBe(true);
    });

    it('should detect removed nodes between snapshots', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      const sidA = kv.snapshot('v1');

      kg.removeNode('n2');
      const sidB = kv.snapshot('v2');

      const changes = kv.diff(sidA, sidB);
      expect(changes.some((c) => c.type === 'remove-node' && c.targetId === 'n2')).toBe(true);
    });

    it('should detect added and removed edges between snapshots', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      const sidA = kv.snapshot('v1');

      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'depends_on',
        weight: 1,
        properties: {},
      });
      const sidB = kv.snapshot('v2');

      const changes = kv.diff(sidA, sidB);
      expect(changes.some((c) => c.type === 'add-edge')).toBe(true);
    });
  });

  describe('getChangesSince', () => {
    it('should return changes made after a snapshot', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');

      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      kg.addNode({ id: 'n3', type: 'fact', label: 'C', properties: {} });

      const changes = kv.getChangesSince(sid);
      expect(changes).toHaveLength(2);
      expect(changes.every((c) => c.type === 'add-node')).toBe(true);
    });

    it('should return empty if no changes after snapshot', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const sid = kv.snapshot('v1');

      const changes = kv.getChangesSince(sid);
      expect(changes).toHaveLength(0);
    });

    it('should throw for non-existent snapshot', () => {
      expect(() => kv.getChangesSince('bad-id')).toThrow('Snapshot');
    });
  });

  describe('multiple snapshots', () => {
    it('should track independent snapshots', () => {
      const ids: string[] = [];

      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      ids.push(kv.snapshot('v1'));

      kg.addNode({ id: 'n2', type: 'entity', label: 'B', properties: {} });
      ids.push(kv.snapshot('v2'));

      kg.addNode({ id: 'n3', type: 'fact', label: 'C', properties: {} });
      ids.push(kv.snapshot('v3'));

      kv.restore(ids[0]);
      expect(kg.query({})).toHaveLength(1);

      kv.restore(ids[1]);
      expect(kg.query({})).toHaveLength(2);

      kv.restore(ids[2]);
      expect(kg.query({})).toHaveLength(3);
    });
  });
});
