import { beforeEach, describe, expect, it } from 'vitest';
import { KnowledgeGraph } from '../engines/knowledge/knowledge-graph';

describe('KnowledgeGraph', () => {
  let kg: KnowledgeGraph;

  beforeEach(() => {
    kg = new KnowledgeGraph();
  });

  describe('addNode / getNode', () => {
    it('should add a node and return its id', () => {
      const id = kg.addNode({
        id: 'n1',
        type: 'concept',
        label: 'Authentication',
        properties: { domain: 'security' },
      });
      expect(id).toBe('n1');
    });

    it('should generate an id if not provided', () => {
      const id = kg.addNode({
        type: 'concept',
        label: 'Test',
        properties: {},
      });
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
    });

    it('should get a node by id', () => {
      kg.addNode({
        id: 'n1',
        type: 'entity',
        label: 'User',
        properties: { role: 'admin' },
      });
      const node = kg.getNode('n1');
      expect(node).not.toBeNull();
      expect(node?.label).toBe('User');
      expect(node?.type).toBe('entity');
    });

    it('should return null for non-existent node', () => {
      expect(kg.getNode('nonexistent')).toBeNull();
    });
  });

  describe('addEdge / getNeighbors', () => {
    it('should add an edge between nodes', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'n2', type: 'concept', label: 'B', properties: {} });
      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'depends_on',
        weight: 1,
        properties: {},
      });

      const neighbors = kg.getNeighbors('n1');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].node.label).toBe('B');
      expect(neighbors[0].edge.relation).toBe('depends_on');
    });

    it('should filter neighbors by relation', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'n2', type: 'concept', label: 'B', properties: {} });
      kg.addNode({ id: 'n3', type: 'concept', label: 'C', properties: {} });
      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'depends_on',
        weight: 1,
        properties: {},
      });
      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n3',
        relation: 'references',
        weight: 1,
        properties: {},
      });

      const depends = kg.getNeighbors('n1', 'depends_on');
      expect(depends).toHaveLength(1);
      expect(depends[0].node.label).toBe('B');
    });
  });

  describe('query', () => {
    it('should query by nodeType', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'C1', properties: {} });
      kg.addNode({ id: 'n2', type: 'fact', label: 'F1', properties: {} });
      kg.addNode({ id: 'n3', type: 'concept', label: 'C2', properties: {} });

      const results = kg.query({ nodeType: 'concept' });
      expect(results).toHaveLength(2);
    });

    it('should query by labels', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'Auth', properties: {} });
      kg.addNode({ id: 'n2', type: 'concept', label: 'Auth', properties: {} });
      kg.addNode({ id: 'n3', type: 'fact', label: 'Other', properties: {} });

      const results = kg.query({ labels: ['Auth'] });
      expect(results).toHaveLength(2);
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) {
        kg.addNode({
          id: `n${i}`,
          type: 'concept',
          label: `Node${i}`,
          properties: {},
        });
      }

      const results = kg.query({ limit: 3 });
      expect(results).toHaveLength(3);
    });
  });

  describe('shortestPath', () => {
    it('should find shortest path between two nodes', () => {
      kg.addNode({ id: 'a', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'b', type: 'concept', label: 'B', properties: {} });
      kg.addNode({ id: 'c', type: 'concept', label: 'C', properties: {} });
      kg.addNode({ id: 'd', type: 'concept', label: 'D', properties: {} });

      kg.addEdge({
        sourceId: 'a',
        targetId: 'b',
        relation: 'relates_to',
        weight: 1,
        properties: {},
      });
      kg.addEdge({
        sourceId: 'b',
        targetId: 'c',
        relation: 'relates_to',
        weight: 1,
        properties: {},
      });
      kg.addEdge({
        sourceId: 'a',
        targetId: 'c',
        relation: 'relates_to',
        weight: 1,
        properties: {},
      });
      kg.addEdge({
        sourceId: 'c',
        targetId: 'd',
        relation: 'relates_to',
        weight: 1,
        properties: {},
      });

      const path = kg.shortestPath('a', 'd');
      expect(path).not.toBeNull();
      expect(path).toHaveLength(3);
      expect(path![0].id).toBe('a');
      expect(path![1].id).toBe('c');
      expect(path![2].id).toBe('d');
    });

    it('should return null if no path exists', () => {
      kg.addNode({ id: 'a', type: 'concept', label: 'A', properties: {} });
      kg.addNode({ id: 'b', type: 'concept', label: 'B', properties: {} });

      const path = kg.shortestPath('a', 'b');
      expect(path).toBeNull();
    });

    it('should return single node for same source and target', () => {
      kg.addNode({ id: 'a', type: 'concept', label: 'A', properties: {} });
      const path = kg.shortestPath('a', 'a');
      expect(path).toHaveLength(1);
      expect(path![0].id).toBe('a');
    });

    it('should return null for non-existent nodes', () => {
      expect(kg.shortestPath('x', 'y')).toBeNull();
    });
  });

  describe('clear / stats', () => {
    it('should return empty stats for empty graph', () => {
      const stats = kg.getStats();
      expect(stats.nodes).toBe(0);
      expect(stats.edges).toBe(0);
      expect(stats.nodeTypes).toEqual({});
    });

    it('should track node types in stats', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'C', properties: {} });
      kg.addNode({ id: 'n2', type: 'fact', label: 'F', properties: {} });
      kg.addNode({ id: 'n3', type: 'concept', label: 'C2', properties: {} });

      const stats = kg.getStats();
      expect(stats.nodes).toBe(3);
      expect(stats.nodeTypes).toEqual({ concept: 2, fact: 1 });
    });

    it('should clear all data', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'C', properties: {} });
      kg.addEdge({
        sourceId: 'n1',
        targetId: 'n1',
        relation: 'relates_to',
        weight: 1,
        properties: {},
      });
      kg.clear();
      expect(kg.getStats().nodes).toBe(0);
      expect(kg.getStats().edges).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty query', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const results = kg.query({});
      expect(results).toHaveLength(1);
    });

    it('should handle node with no edges', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      expect(kg.getNeighbors('n1')).toEqual([]);
    });

    it('should handle query with no matches', () => {
      kg.addNode({ id: 'n1', type: 'concept', label: 'A', properties: {} });
      const results = kg.query({ nodeType: 'entity' });
      expect(results).toHaveLength(0);
    });
  });
});
