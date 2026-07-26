/**
 * NodeRole — Union type: leader, follower, candidate;.
 */
export type NodeRole = 'leader' | 'follower' | 'candidate';
/**
 * NodeStatus — Union type: active, inactive, suspected;.
 */
export type NodeStatus = 'active' | 'inactive' | 'suspected';

/**
 * ClusterNode — Configuration and options interface.
 */
export interface ClusterNode {
  id: string;
  address: string;
  role: NodeRole;
  status: NodeStatus;
  lastHeartbeat: string;
  joinedAt: string;
  version: string;
  capabilities: string[];
}

/**
 * ClusterState — Configuration and options interface.
 */
export interface ClusterState {
  nodes: Map<string, ClusterNode>;
  leaderId: string | null;
  term: number;
  lastApplied: number;
  commitIndex: number;
}

/**
 * KernelCluster — kernel cluster.
 *
 * Methods: join, leave, getNodes, getNode, getLeader, heartbeat, getActiveNodes, getState, +1 more.
 */
export class KernelCluster {
  private state: ClusterState;

  constructor(nodeId: string, address: string) {
    const now = new Date().toISOString();
    this.state = {
      nodes: new Map(),
      leaderId: null,
      term: 0,
      lastApplied: 0,
      commitIndex: 0,
    };
    this.state.nodes.set(nodeId, {
      id: nodeId,
      address,
      role: 'follower',
      status: 'active',
      lastHeartbeat: now,
      joinedAt: now,
      version: '1.0.0',
      capabilities: [],
    });
  }

  join(node: Omit<ClusterNode, 'status' | 'lastHeartbeat' | 'joinedAt'>): void {
    const now = new Date().toISOString();
    this.state.nodes.set(node.id, {
      ...node,
      status: 'active',
      lastHeartbeat: now,
      joinedAt: now,
    });
  }

  leave(nodeId: string): void {
    this.state.nodes.delete(nodeId);
    if (this.state.leaderId === nodeId) {
      this.state.leaderId = null;
    }
  }

  getNodes(): ClusterNode[] {
    return Array.from(this.state.nodes.values());
  }

  getNode(id: string): ClusterNode | undefined {
    return this.state.nodes.get(id);
  }

  getLeader(): ClusterNode | undefined {
    if (!this.state.leaderId) return undefined;
    return this.state.nodes.get(this.state.leaderId);
  }

  heartbeat(nodeId: string): void {
    const node = this.state.nodes.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date().toISOString();
      node.status = 'active';
    }
  }

  getActiveNodes(): ClusterNode[] {
    return this.getNodes().filter((n) => n.status === 'active');
  }

  getState(): ClusterState {
    return this.state;
  }

  isHealthy(): boolean {
    const active = this.getActiveNodes();
    const total = this.state.nodes.size;
    return active.length > 0 && active.length >= Math.ceil(total / 2);
  }
}
