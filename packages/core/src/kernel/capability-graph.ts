import { KnowledgeGraph, type KnowledgeNode } from '../engines/knowledge/knowledge-graph';
import type { CapabilityInfo } from './capability-registry';

export interface CapabilityNode {
  id: string;
  capabilityId: string;
  name: string;
  type: string;
  provider: string;
  version: string;
  cost: number;
  latency: number;
  reliability: number;
  status: string;
}

export class CapabilityGraph {
  private graph: KnowledgeGraph;

  constructor() {
    this.graph = new KnowledgeGraph();
  }

  registerCapability(info: CapabilityInfo): string {
    const nodeId = this.graph.addNode({
      type: 'capability' as any,
      label: info.name,
      properties: {
        capabilityId: info.id,
        name: info.name,
        type: info.type,
        provider: info.provider,
        version: info.version,
        cost: info.cost.perCall,
        latency: info.latency.p50,
        reliability: info.reliability,
        status: info.status,
      },
    });

    for (const depId of info.dependencies) {
      const depNode = this.findNodeByCapabilityId(depId);
      if (depNode) {
        this.graph.addEdge({
          sourceId: depNode.id,
          targetId: nodeId,
          relation: 'depends_on',
          weight: 1,
          properties: {},
        });
      }
    }

    return nodeId;
  }

  removeCapability(id: string): void {
    this.graph.removeNode(id);
  }

  findCapabilityByType(type: string): CapabilityNode[] {
    return this.getAllCapabilities()
      .filter((n) => n.properties.type === type)
      .map((n) => this.toCapabilityNode(n));
  }

  findCapabilityByProvider(provider: string): CapabilityNode[] {
    return this.getAllCapabilities()
      .filter((n) => n.properties.provider === provider)
      .map((n) => this.toCapabilityNode(n));
  }

  findCapabilityByName(name: string): CapabilityNode[] {
    const lower = name.toLowerCase();
    return this.getAllCapabilities()
      .filter((n) => n.label.toLowerCase().includes(lower))
      .map((n) => this.toCapabilityNode(n));
  }

  getDependencyChain(capabilityId: string): CapabilityNode[] {
    const node = this.findNodeByCapabilityId(capabilityId);
    if (!node) return [];

    const visited = new Set<string>();
    const result: CapabilityNode[] = [];
    const queue: string[] = [node.id];
    visited.add(node.id);
    result.push(this.toCapabilityNode(node));

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const predecessors = this.graph.getPredecessors(currentId, 'depends_on');

      for (const { node: pred } of predecessors) {
        if (!visited.has(pred.id)) {
          visited.add(pred.id);
          result.push(this.toCapabilityNode(pred));
          queue.push(pred.id);
        }
      }
    }

    return result;
  }

  suggestAlternatives(capabilityId: string): CapabilityNode[] {
    const node = this.findNodeByCapabilityId(capabilityId);
    if (!node) return [];

    const props = node.properties;
    return this.getAllCapabilities()
      .filter(
        (n) =>
          n.properties.type === props.type &&
          n.properties.provider !== props.provider &&
          n.properties.status === 'active',
      )
      .map((n) => this.toCapabilityNode(n));
  }

  getGraphStats(): {
    totalCapabilities: number;
    byType: Record<string, number>;
    byProvider: Record<string, number>;
    avgDependencies: number;
  } {
    const caps = this.getAllCapabilities();
    const byType: Record<string, number> = {};
    const byProvider: Record<string, number> = {};
    let totalDeps = 0;

    for (const n of caps) {
      const type = String(n.properties.type ?? 'unknown');
      const provider = String(n.properties.provider ?? 'unknown');
      byType[type] = (byType[type] ?? 0) + 1;
      byProvider[provider] = (byProvider[provider] ?? 0) + 1;

      const deps = this.graph.getPredecessors(n.id, 'depends_on');
      totalDeps += deps.length;
    }

    return {
      totalCapabilities: caps.length,
      byType,
      byProvider,
      avgDependencies: caps.length > 0 ? totalDeps / caps.length : 0,
    };
  }

  findShortestPath(fromId: string, toId: string): CapabilityNode[] {
    const from = this.findNodeByCapabilityId(fromId);
    const to = this.findNodeByCapabilityId(toId);
    if (!from || !to) return [];

    const path = this.graph.shortestPath(from.id, to.id);
    if (!path) return [];

    return path
      .filter((n) => n.type === ('capability' as any))
      .map((n) => this.toCapabilityNode(n));
  }

  private getAllCapabilities(): KnowledgeNode[] {
    return this.graph.query({ nodeType: 'capability' as any });
  }

  private findNodeByCapabilityId(capabilityId: string): KnowledgeNode | null {
    return (
      this.getAllCapabilities().find((n) => n.properties.capabilityId === capabilityId) ?? null
    );
  }

  private toCapabilityNode(node: KnowledgeNode): CapabilityNode {
    const p = node.properties as Record<string, unknown>;
    return {
      id: node.id,
      capabilityId: String(p.capabilityId ?? ''),
      name: String(p.name ?? ''),
      type: String(p.type ?? ''),
      provider: String(p.provider ?? ''),
      version: String(p.version ?? ''),
      cost: Number(p.cost ?? 0),
      latency: Number(p.latency ?? 0),
      reliability: Number(p.reliability ?? 0),
      status: String(p.status ?? ''),
    };
  }
}
