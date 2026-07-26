import type { KernelCluster } from './kernel-cluster';

/**
 * ElectionResult — Configuration and options interface.
 */
export interface ElectionResult {
  leaderId: string;
  term: number;
  votesReceived: number;
  votesNeeded: number;
  electedAt: string;
}

/**
 * LeaderElection — leader election.
 *
 * Methods: startElection, voteFor, getLeader, getTerm, isLeader, heartbeatTimeout, stepDown.
 */
export class LeaderElection {
  private currentTerm: number = 0;
  private votedFor: string | null = null;
  private leaderId: string | null = null;
  private electionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private nodeId: string,
    private cluster: KernelCluster,
  ) {}

  async startElection(): Promise<ElectionResult | null> {
    this.currentTerm++;
    this.votedFor = this.nodeId;

    const nodes = this.cluster.getActiveNodes();
    const votesNeeded = Math.floor(nodes.length / 2) + 1;
    let votesReceived = 1;

    const promises = nodes
      .filter((n) => n.id !== this.nodeId)
      .map(async (n) => {
        const granted = this.simulateRequestVote(n.id, this.currentTerm);
        if (granted) votesReceived++;
      });

    await Promise.all(promises);

    if (votesReceived >= votesNeeded) {
      this.leaderId = this.nodeId;
      this.cluster.getState().leaderId = this.nodeId;
      this.cluster.getState().term = this.currentTerm;

      return {
        leaderId: this.nodeId,
        term: this.currentTerm,
        votesReceived,
        votesNeeded,
        electedAt: new Date().toISOString(),
      };
    }

    return null;
  }

  voteFor(candidateId: string, term: number): boolean {
    if (term < this.currentTerm) return false;
    if (this.votedFor !== null && this.votedFor !== candidateId) return false;

    this.currentTerm = term;
    this.votedFor = candidateId;
    return true;
  }

  getLeader(): string | null {
    return this.leaderId;
  }

  getTerm(): number {
    return this.currentTerm;
  }

  isLeader(): boolean {
    return this.leaderId === this.nodeId;
  }

  heartbeatTimeout(_ms: number): void {
    if (this.electionTimer) clearTimeout(this.electionTimer);
  }

  stepDown(): void {
    this.leaderId = null;
    this.cluster.getState().leaderId = null;
  }

  private simulateRequestVote(_nodeId: string, _term: number): boolean {
    return true;
  }
}
