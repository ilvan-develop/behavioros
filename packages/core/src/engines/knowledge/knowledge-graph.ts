import { randomUUID } from 'node:crypto';
import type { EventBridge } from '../../events/event-bridge';

/**
 * KnowledgeNode — Configuration and options interface.
 */
export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'fact' | 'pattern' | 'decision';
  label: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * KnowledgeEdge — Configuration and options interface.
 */
export interface KnowledgeEdge {
  sourceId: string;
  targetId: string;
  relation: 'derived_from' | 'depends_on' | 'relates_to' | 'implements' | 'replaces' | 'references';
  weight: number;
  properties: Record<string, unknown>;
  createdAt: string;
}

/**
 * KnowledgeQuery — Configuration and options interface.
 */
export interface KnowledgeQuery {
  nodeType?: string;
  labels?: string[];
  relation?: string;
  limit?: number;
}

/**
 * KnowledgeGraph — knowledge graph.
 *
 * Methods: addNode, addEdge, getNode, query, getNeighbors, shortestPath, getStats, getPredecessors, +2 more.
 */
export class KnowledgeGraph {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private adjacency: Map<string, KnowledgeEdge[]> = new Map();

  constructor(private eventBridge?: EventBridge) {}

  addNode(node: Omit<KnowledgeNode, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }): string {
    const id = node.id || randomUUID();
    const now = new Date().toISOString();
    const knowledgeNode: KnowledgeNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.nodes.set(id, knowledgeNode);
    if (!this.adjacency.has(id)) {
      this.adjacency.set(id, []);
    }
    this.eventBridge?.emit('knowledge-node-added', id, 'knowledge', {
      nodeId: id,
      label: knowledgeNode.label,
      type: knowledgeNode.type,
    });
    return id;
  }

  addEdge(edge: Omit<KnowledgeEdge, 'createdAt'>): void {
    const knowledgeEdge: KnowledgeEdge = {
      ...edge,
      createdAt: new Date().toISOString(),
    };
    const edges = this.adjacency.get(edge.sourceId);
    if (edges) {
      edges.push(knowledgeEdge);
    }
    if (!this.adjacency.has(edge.targetId)) {
      this.adjacency.set(edge.targetId, []);
    }
  }

  getNode(id: string): KnowledgeNode | null {
    return this.nodes.get(id) ?? null;
  }

  query(query: KnowledgeQuery): KnowledgeNode[] {
    let results = Array.from(this.nodes.values());

    if (query.nodeType) {
      results = results.filter((n) => n.type === query.nodeType);
    }

    if (query.labels && query.labels.length > 0) {
      results = results.filter((n) => query.labels!.includes(n.label));
    }

    if (query.relation) {
      const nodeIdsWithRelation = new Set<string>();
      for (const [sourceId, edges] of this.adjacency) {
        for (const edge of edges) {
          if (edge.relation === query.relation) {
            nodeIdsWithRelation.add(sourceId);
            nodeIdsWithRelation.add(edge.targetId);
          }
        }
      }
      results = results.filter((n) => nodeIdsWithRelation.has(n.id));
    }

    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  getNeighbors(nodeId: string, relation?: string): { node: KnowledgeNode; edge: KnowledgeEdge }[] {
    const edges = this.adjacency.get(nodeId) ?? [];
    const result: { node: KnowledgeNode; edge: KnowledgeEdge }[] = [];

    for (const edge of edges) {
      if (relation && edge.relation !== relation) continue;
      const targetNode = this.nodes.get(edge.targetId);
      if (targetNode) {
        result.push({ node: targetNode, edge });
      }
    }

    return result;
  }

  shortestPath(fromId: string, toId: string): KnowledgeNode[] | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) return [this.nodes.get(fromId)!];

    const visited = new Set<string>();
    const queue: string[][] = [[fromId]];
    visited.add(fromId);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      const edges = this.adjacency.get(current) ?? [];

      for (const edge of edges) {
        if (!visited.has(edge.targetId)) {
          visited.add(edge.targetId);
          const newPath = [...path, edge.targetId];

          if (edge.targetId === toId) {
            return newPath
              .map((id) => this.nodes.get(id))
              .filter((n): n is KnowledgeNode => n != null);
          }

          queue.push(newPath);
        }
      }
    }

    return null;
  }

  getStats(): { nodes: number; edges: number; nodeTypes: Record<string, number> } {
    let edges = 0;
    for (const edgeList of this.adjacency.values()) {
      edges += edgeList.length;
    }

    const nodeTypes: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      nodeTypes[node.type] = (nodeTypes[node.type] ?? 0) + 1;
    }

    return { nodes: this.nodes.size, edges, nodeTypes };
  }

  getPredecessors(
    nodeId: string,
    relation?: string,
  ): { node: KnowledgeNode; edge: KnowledgeEdge }[] {
    const result: { node: KnowledgeNode; edge: KnowledgeEdge }[] = [];
    for (const [sourceId, edges] of this.adjacency) {
      for (const edge of edges) {
        if (edge.targetId !== nodeId) continue;
        if (relation && edge.relation !== relation) continue;
        const sourceNode = this.nodes.get(sourceId);
        if (sourceNode) {
          result.push({ node: sourceNode, edge });
        }
      }
    }
    return result;
  }

  removeNode(id: string): boolean {
    if (!this.nodes.has(id)) return false;
    this.nodes.delete(id);
    this.adjacency.delete(id);
    for (const key of this.adjacency.keys()) {
      const edges = this.adjacency.get(key)!;
      this.adjacency.set(
        key,
        edges.filter((e) => e.targetId !== id),
      );
    }
    return true;
  }

  clear(): void {
    this.nodes.clear();
    this.adjacency.clear();
  }
}
