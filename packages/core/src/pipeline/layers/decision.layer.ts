import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 6 — Decision Layer
// Voting-based decision with threshold approval.
// Uses agent authority weights from context.
// ============================================================

export interface DecisionLayerOptions {
  quorumThreshold?: number;
  votingStrategy?: 'majority' | 'weighted' | 'unanimous';
  autoApproveBelowThreshold?: boolean;
}

export interface Vote {
  agentId: string;
  option: 'approve' | 'reject' | 'abstain';
  weight: number;
  rationale?: string;
}

export class DecisionLayer implements PipelineLayer {
  readonly id = 'decision';
  readonly name = 'Decision';
  readonly order = 6;

  private quorumThreshold: number;
  private votingStrategy: string;
  private autoApprove: boolean;

  constructor(options: DecisionLayerOptions = {}) {
    this.quorumThreshold = options.quorumThreshold ?? 0.6;
    this.votingStrategy = options.votingStrategy ?? 'weighted';
    this.autoApprove = options.autoApproveBelowThreshold ?? true;
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      // Check if explicit votes are provided in metadata
      const existingVotes = context.metadata.get('votes') as Vote[] | undefined;

      let votes: Vote[];

      if (existingVotes && Array.isArray(existingVotes) && existingVotes.length > 0) {
        votes = existingVotes;
      } else {
        // Auto-generate single vote based on agent authority
        votes = [
          {
            agentId: context.agentId,
            option: 'approve',
            weight: this.getAuthorityWeight(context.agentAuthority),
            rationale: 'Auto-approved by pipeline agent',
          },
        ];
      }

      // Calculate decision
      const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
      const approveWeight = votes
        .filter((v) => v.option === 'approve')
        .reduce((sum, v) => sum + v.weight, 0);
      const rejectWeight = votes
        .filter((v) => v.option === 'reject')
        .reduce((sum, v) => sum + v.weight, 0);

      const approveRatio = totalWeight > 0 ? approveWeight / totalWeight : 0;
      const rejectRatio = totalWeight > 0 ? rejectWeight / totalWeight : 0;

      // Determine quorum
      const hasQuorum = approveRatio >= this.quorumThreshold;

      // Determine outcome
      let decision: 'approved' | 'rejected' | 'deferred';
      if (this.votingStrategy === 'unanimous') {
        decision = votes.every((v) => v.option !== 'reject') ? 'approved' : 'rejected';
      } else if (hasQuorum) {
        decision = 'approved';
      } else if (rejectRatio > 0.5) {
        decision = 'rejected';
      } else if (this.autoApprove && approveRatio > 0.5) {
        decision = 'approved';
      } else {
        decision = 'deferred';
      }

      const passed = decision !== 'rejected';
      const score = Math.round(approveRatio * 100);

      return {
        layerId: this.id,
        layerName: this.name,
        passed,
        score,
        duration: Date.now() - start,
        details: {
          decision,
          strategy: this.votingStrategy,
          quorumThreshold: this.quorumThreshold,
          votesReceived: votes.length,
          approveWeight,
          rejectWeight,
          totalWeight,
          approveRatio: Math.round(approveRatio * 100),
          hasQuorum,
          votes: votes.map((v) => ({
            agent: v.agentId,
            option: v.option,
            weight: v.weight,
          })),
        },
        error:
          decision === 'rejected'
            ? `Decision rejected: ${rejectWeight}/${totalWeight} weight against (${Math.round(rejectRatio * 100)}%)`
            : decision === 'deferred'
              ? 'Decision deferred: insufficient quorum'
              : undefined,
      };
    } catch (error) {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: false,
        score: 0,
        duration: Date.now() - start,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown decision error',
      };
    }
  }

  private getAuthorityWeight(authority: string): number {
    const weights: Record<string, number> = {
      junior: 1,
      senior: 2,
      architect: 3,
      lead: 4,
      director: 5,
      vp: 6,
      'c-level': 10,
    };
    return weights[authority] ?? 1;
  }
}
