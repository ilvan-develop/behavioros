import type { VotingStrategy } from '@behavioros/schemas'

// ============================================================
// Decision Engine — Voting, Consensus, Leader Election, Risk
// ============================================================

export interface DecisionContext {
  id: string
  title: string
  description?: string
  type: 'architecture' | 'design' | 'implementation' | 'process' | 'emergency'
  participants: DecisionParticipant[]
  options: DecisionOption[]
  deadline?: string
}

export interface DecisionParticipant {
  id: string
  role: string
  authority: number
  weight: number
}

export interface DecisionOption {
  id: string
  title: string
  description?: string
  pros: string[]
  cons: string[]
  risk: 'low' | 'medium' | 'high'
  estimatedEffort?: string
}

export interface DecisionVote {
  participantId: string
  optionId: string
  confidence: number
  rationale?: string
}

export interface DecisionResult {
  decisionId: string
  winningOption: string | null
  strategy: VotingStrategy
  votes: DecisionVote[]
  consensus: boolean
  confidence: number
  dissenting: string[]
  timestamp: string
}

export class DecisionEngine {
  private strategy: VotingStrategy
  private quorumThreshold: number

  constructor(strategy: VotingStrategy = 'majority', quorumThreshold: number = 0.6) {
    this.strategy = strategy
    this.quorumThreshold = quorumThreshold
  }

  /**
   * Regista votos para uma decisão
   */
  vote(context: DecisionContext, votes: DecisionVote[]): DecisionResult {
    switch (this.strategy) {
      case 'majority':
        return this.majorityVote(context, votes)
      case 'weighted':
        return this.weightedVote(context, votes)
      case 'unanimous':
        return this.unanimousVote(context, votes)
      case 'quorum':
        return this.quorumVote(context, votes)
      case 'byzantine':
        return this.byzantineVote(context, votes)
      default:
        return this.majorityVote(context, votes)
    }
  }

  private majorityVote(context: DecisionContext, votes: DecisionVote[]): DecisionResult {
    const optionVotes = new Map<string, number>()
    for (const vote of votes) {
      optionVotes.set(vote.optionId, (optionVotes.get(vote.optionId) ?? 0) + 1)
    }

    let winningOption: string | null = null
    let maxVotes = 0
    for (const [optionId, count] of optionVotes) {
      if (count > maxVotes) {
        maxVotes = count
        winningOption = optionId
      }
    }

    const totalVotes = votes.length
    const winningVotes = winningOption ? optionVotes.get(winningOption) ?? 0 : 0
    const confidence = totalVotes > 0 ? winningVotes / totalVotes : 0

    return {
      decisionId: context.id,
      winningOption,
      strategy: 'majority',
      votes,
      consensus: confidence >= 0.7,
      confidence,
      dissenting: votes.filter((v) => v.optionId !== winningOption).map((v) => v.participantId),
      timestamp: new Date().toISOString(),
    }
  }

  private weightedVote(context: DecisionContext, votes: DecisionVote[]): DecisionResult {
    const weightedScores = new Map<string, number>()
    const participantMap = new Map(context.participants.map((p) => [p.id, p]))

    for (const vote of votes) {
      const participant = participantMap.get(vote.participantId)
      const weight = participant?.weight ?? 1
      const current = weightedScores.get(vote.optionId) ?? 0
      weightedScores.set(vote.optionId, current + vote.confidence * weight)
    }

    let winningOption: string | null = null
    let maxScore = 0
    for (const [optionId, score] of weightedScores) {
      if (score > maxScore) {
        maxScore = score
        winningOption = optionId
      }
    }

    const totalScore = Array.from(weightedScores.values()).reduce((a, b) => a + b, 0)
    const confidence = totalScore > 0 ? maxScore / totalScore : 0

    return {
      decisionId: context.id,
      winningOption,
      strategy: 'weighted',
      votes,
      consensus: confidence >= 0.7,
      confidence,
      dissenting: votes.filter((v) => v.optionId !== winningOption).map((v) => v.participantId),
      timestamp: new Date().toISOString(),
    }
  }

  private unanimousVote(context: DecisionContext, votes: DecisionVote[]): DecisionResult {
    const firstOption = votes[0]?.optionId
    const consensus = votes.every((v) => v.optionId === firstOption)

    return {
      decisionId: context.id,
      winningOption: consensus ? firstOption ?? null : null,
      strategy: 'unanimous',
      votes,
      consensus,
      confidence: consensus ? 1 : 0,
      dissenting: consensus ? [] : votes.filter((v) => v.optionId !== firstOption).map((v) => v.participantId),
      timestamp: new Date().toISOString(),
    }
  }

  private quorumVote(context: DecisionContext, votes: DecisionVote[]): DecisionResult {
    const quorumSize = Math.ceil(context.participants.length * this.quorumThreshold)
    const hasQuorum = votes.length >= quorumSize

    if (!hasQuorum) {
      return {
        decisionId: context.id,
        winningOption: null,
        strategy: 'quorum',
        votes,
        consensus: false,
        confidence: 0,
        dissenting: [],
        timestamp: new Date().toISOString(),
      }
    }

    return this.majorityVote(context, votes)
  }

  private byzantineVote(context: DecisionContext, votes: DecisionVote[]): DecisionResult {
    // Byzantine fault tolerance: need 2/3 + 1 honest nodes
    const totalNodes = context.participants.length
    const requiredHonest = Math.floor((totalNodes * 2) / 3) + 1
    const hasQuorum = votes.length >= requiredHonest

    if (!hasQuorum) {
      return {
        decisionId: context.id,
        winningOption: null,
        strategy: 'byzantine',
        votes,
        consensus: false,
        confidence: 0,
        dissenting: [],
        timestamp: new Date().toISOString(),
      }
    }

    return this.majorityVote(context, votes)
  }

  /**
   * Avalia o risco de uma decisão
   */
  evaluateRisk(context: DecisionContext): {
    level: 'low' | 'medium' | 'high'
    factors: string[]
    mitigations: string[]
  } {
    const factors: string[] = []
    const mitigations: string[] = []
    let riskScore = 0

    // Check participant diversity
    const roles = new Set(context.participants.map((p) => p.role))
    if (roles.size < 2) {
      factors.push('Low participant diversity')
      riskScore += 1
    }

    // Check option risk levels
    const highRiskOptions = context.options.filter((o) => o.risk === 'high')
    if (highRiskOptions.length > 0) {
      factors.push(`${highRiskOptions.length} high-risk option(s)`)
      riskScore += 2
    }

    // Check deadline pressure
    if (context.deadline) {
      const deadline = new Date(context.deadline)
      const now = new Date()
      const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      if (daysLeft < 2) {
        factors.push('Tight deadline')
        riskScore += 1
      }
    }

    const level = riskScore >= 3 ? 'high' : riskScore >= 1 ? 'medium' : 'low'

    if (level !== 'low') {
      mitigations.push('Consider gathering more input before deciding')
      mitigations.push('Document decision rationale for future reference')
    }

    return { level, factors, mitigations }
  }

  /**
   * Gera um resumo da decisão
   */
  summary(result: DecisionResult): string {
    const lines: string[] = []
    lines.push(`Decision: ${result.decisionId}`)
    lines.push(`Strategy: ${result.strategy}`)
    lines.push(`Consensus: ${result.consensus ? '✅' : '❌'}`)
    lines.push(`Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    if (result.winningOption) {
      lines.push(`Winner: ${result.winningOption}`)
    }
    if (result.dissenting.length > 0) {
      lines.push(`Dissenting: ${result.dissenting.join(', ')}`)
    }
    return lines.join('\n')
  }
}
