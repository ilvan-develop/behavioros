import { randomUUID } from 'node:crypto';
import type { KnowledgeEdge, KnowledgeGraph, KnowledgeNode } from './knowledge-graph';

/**
 * Snapshot — Configuration and options interface.
 */
export interface Snapshot {
  id: string;
  label: string;
  nodes: Map<string, unknown>[];
  edges: [string, string, Record<string, unknown>][];
  createdAt: string;
}

/**
 * Branch — Configuration and options interface.
 */
export interface Branch {
  id: string;
  name: string;
  snapshotId: string;
  status: 'active' | 'merged' | 'abandoned';
  createdAt: string;
}

/**
 * Change — Configuration and options interface.
 */
export interface Change {
  type: 'add-node' | 'remove-node' | 'add-edge' | 'remove-edge' | 'modify-node';
  targetId: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}

function serializeNode(node: KnowledgeNode): Map<string, unknown> {
  const map = new Map<string, unknown>();
  map.set('id', node.id);
  map.set('type', node.type);
  map.set('label', node.label);
  map.set('properties', node.properties);
  map.set('createdAt', node.createdAt);
  map.set('updatedAt', node.updatedAt);
  return map;
}

function deserializeNode(map: Map<string, unknown>): KnowledgeNode {
  return {
    id: map.get('id') as string,
    type: map.get('type') as KnowledgeNode['type'],
    label: map.get('label') as string,
    properties: (map.get('properties') ?? {}) as Record<string, unknown>,
    createdAt: map.get('createdAt') as string,
    updatedAt: map.get('updatedAt') as string,
  };
}

/**
 * KnowledgeVersioning — knowledge versioning.
 *
 * Methods: snapshot, restore, listSnapshots, branch, listBranches, mergeBranch, diff, getChangesSince.
 */
export class KnowledgeVersioning {
  private snapshots: Map<string, Snapshot> = new Map();
  private branches: Map<string, Branch> = new Map();

  constructor(private graph: KnowledgeGraph) {}

  snapshot(label: string): string {
    const allNodes = this.graph.query({});
    const nodes = allNodes.map(serializeNode);

    const edges = this.captureEdges();

    const snapshot: Snapshot = {
      id: randomUUID(),
      label,
      nodes,
      edges,
      createdAt: new Date().toISOString(),
    };

    this.snapshots.set(snapshot.id, snapshot);
    return snapshot.id;
  }

  restore(snapshotId: string): void {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot "${snapshotId}" not found`);
    }

    this.graph.clear();

    for (const nodeMap of snapshot.nodes) {
      const node = deserializeNode(nodeMap);
      this.graph.addNode({
        id: node.id,
        type: node.type,
        label: node.label,
        properties: node.properties,
      });
    }

    for (const [sourceId, targetId, props] of snapshot.edges) {
      this.graph.addEdge({
        sourceId,
        targetId,
        relation: (props.relation ?? 'relates_to') as KnowledgeEdge['relation'],
        weight: (props.weight ?? 1) as number,
        properties: (props.properties ?? {}) as Record<string, unknown>,
      });
    }
  }

  listSnapshots(): Snapshot[] {
    return Array.from(this.snapshots.values());
  }

  branch(name: string, fromSnapshotId: string): string {
    if (!this.snapshots.has(fromSnapshotId)) {
      throw new Error(`Snapshot "${fromSnapshotId}" not found`);
    }

    const branch: Branch = {
      id: randomUUID(),
      name,
      snapshotId: fromSnapshotId,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    this.branches.set(branch.id, branch);
    return branch.id;
  }

  listBranches(): Branch[] {
    return Array.from(this.branches.values());
  }

  mergeBranch(branchId: string): Change[] {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Branch "${branchId}" not found`);
    }

    const baseSnapshot = this.snapshots.get(branch.snapshotId);
    if (!baseSnapshot) {
      throw new Error(`Snapshot "${branch.snapshotId}" not found`);
    }

    const current = this.buildInlineSnapshot();
    const changes = this.computeDiff(baseSnapshot, current);

    branch.status = 'merged';

    return changes;
  }

  diff(snapshotA: string, snapshotB: string): Change[] {
    const a = this.snapshots.get(snapshotA);
    const b = this.snapshots.get(snapshotB);

    if (!a) throw new Error(`Snapshot "${snapshotA}" not found`);
    if (!b) throw new Error(`Snapshot "${snapshotB}" not found`);

    return this.computeDiff(a, b);
  }

  getChangesSince(snapshotId: string): Change[] {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot "${snapshotId}" not found`);
    }

    const current = this.buildInlineSnapshot();
    return this.computeDiff(snapshot, current);
  }

  private captureEdges(): [string, string, Record<string, unknown>][] {
    const allNodes = this.graph.query({});
    const edges: [string, string, Record<string, unknown>][] = [];
    const seen = new Set<string>();

    for (const node of allNodes) {
      const neighbors = this.graph.getNeighbors(node.id);
      for (const { edge } of neighbors) {
        const key = `${edge.sourceId}:${edge.targetId}:${edge.relation}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([
          edge.sourceId,
          edge.targetId,
          {
            relation: edge.relation,
            weight: edge.weight,
            createdAt: edge.createdAt,
            ...edge.properties,
          },
        ]);
      }
    }

    return edges;
  }

  private buildInlineSnapshot(): Snapshot {
    const allNodes = this.graph.query({});
    return {
      id: '',
      label: '',
      nodes: allNodes.map(serializeNode),
      edges: this.captureEdges(),
      createdAt: '',
    };
  }

  private computeDiff(a: Snapshot, b: Snapshot): Change[] {
    const changes: Change[] = [];
    const now = new Date().toISOString();

    const aNodes = new Map<string, Map<string, unknown>>();
    for (const nodeMap of a.nodes) {
      aNodes.set(nodeMap.get('id') as string, nodeMap);
    }

    const bNodes = new Map<string, Map<string, unknown>>();
    for (const nodeMap of b.nodes) {
      bNodes.set(nodeMap.get('id') as string, nodeMap);
    }

    const aEdges = new Map<string, [string, string, Record<string, unknown>]>();
    for (const edge of a.edges) {
      aEdges.set(`${edge[0]}:${edge[1]}:${edge[2].relation ?? ''}`, edge);
    }

    const bEdges = new Map<string, [string, string, Record<string, unknown>]>();
    for (const edge of b.edges) {
      bEdges.set(`${edge[0]}:${edge[1]}:${edge[2].relation ?? ''}`, edge);
    }

    for (const [id, nodeMap] of bNodes) {
      if (!aNodes.has(id)) {
        changes.push({
          type: 'add-node',
          targetId: id,
          after: Object.fromEntries(nodeMap),
          timestamp: now,
        });
      }
    }

    for (const [id, nodeMap] of aNodes) {
      if (!bNodes.has(id)) {
        changes.push({
          type: 'remove-node',
          targetId: id,
          before: Object.fromEntries(nodeMap),
          timestamp: now,
        });
      }
    }

    for (const [id, aNode] of aNodes) {
      const bNode = bNodes.get(id);
      if (bNode) {
        const aUpdated = aNode.get('updatedAt') as string;
        const bUpdated = bNode.get('updatedAt') as string;
        if (aUpdated !== bUpdated) {
          changes.push({
            type: 'modify-node',
            targetId: id,
            before: Object.fromEntries(aNode),
            after: Object.fromEntries(bNode),
            timestamp: now,
          });
        }
      }
    }

    for (const [key, edge] of bEdges) {
      if (!aEdges.has(key)) {
        changes.push({
          type: 'add-edge',
          targetId: key,
          after: { sourceId: edge[0], targetId: edge[1], ...edge[2] },
          timestamp: now,
        });
      }
    }

    for (const [key, edge] of aEdges) {
      if (!bEdges.has(key)) {
        changes.push({
          type: 'remove-edge',
          targetId: key,
          before: { sourceId: edge[0], targetId: edge[1], ...edge[2] },
          timestamp: now,
        });
      }
    }

    return changes;
  }
}
