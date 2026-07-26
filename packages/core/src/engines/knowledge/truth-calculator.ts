import type { EvidenceItem, EvidenceSource } from './evidence-manager';

/**
 * TruthScore — Configuration and options interface.
 */
export interface TruthScore {
  claimId: string;
  score: number;
  evidenceCount: number;
  sourceReliability: number;
  lastUpdated: string;
  meetsThreshold: boolean;
}

/**
 * TruthCalculator — truth calculator.
 *
 * Methods: setDecayRate, compute, getScore, getAllScores, setThreshold, decayAll.
 */
export class TruthCalculator {
  private minThreshold: number;
  private decayRate: number;
  private scores = new Map<string, TruthScore>();

  constructor(minThreshold = 0.95) {
    this.minThreshold = minThreshold;
    this.decayRate = 0.01;
  }

  setDecayRate(rate: number): void {
    this.decayRate = Math.max(0, Math.min(1, rate));
  }

  compute(claimId: string, evidence: EvidenceItem[], sources: EvidenceSource[]): TruthScore {
    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    if (evidence.length === 0) {
      const score: TruthScore = {
        claimId,
        score: 0,
        evidenceCount: 0,
        sourceReliability: 0,
        lastUpdated: new Date().toISOString(),
        meetsThreshold: false,
      };
      this.scores.set(claimId, score);
      return score;
    }

    let totalWeight = 0;
    let weightedSum = 0;
    let sourceReliabilitySum = 0;

    for (const ev of evidence) {
      const source = sourceMap.get(ev.sourceId);
      const reliability = source?.reliability ?? 0.5;
      totalWeight += reliability;
      weightedSum += ev.confidence * reliability;
      sourceReliabilitySum += reliability;
    }

    const scoreValue = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const avgSourceReliability = evidence.length > 0 ? sourceReliabilitySum / evidence.length : 0;

    const existing = this.scores.get(claimId);
    const now = new Date().toISOString();
    let finalScore = scoreValue;

    if (existing) {
      const daysSinceUpdate = this.daysBetween(existing.lastUpdated, now);
      finalScore = scoreValue * (1 - this.decayRate) ** daysSinceUpdate;
    }

    const score: TruthScore = {
      claimId,
      score: Math.max(0, Math.min(1, finalScore)),
      evidenceCount: evidence.length,
      sourceReliability: avgSourceReliability,
      lastUpdated: now,
      meetsThreshold: finalScore >= this.minThreshold,
    };

    this.scores.set(claimId, score);
    return score;
  }

  getScore(claimId: string): TruthScore | undefined {
    return this.scores.get(claimId);
  }

  getAllScores(): TruthScore[] {
    return Array.from(this.scores.values());
  }

  setThreshold(threshold: number): void {
    this.minThreshold = threshold;
  }

  decayAll(): void {
    const now = new Date().toISOString();
    for (const [claimId, score] of this.scores) {
      const days = this.daysBetween(score.lastUpdated, now);
      if (days > 0) {
        const decayed = score.score * (1 - this.decayRate) ** days;
        this.scores.set(claimId, {
          ...score,
          score: Math.max(0, Math.min(1, decayed)),
          lastUpdated: now,
          meetsThreshold: decayed >= this.minThreshold,
        });
      }
    }
  }

  private daysBetween(from: string, to: string): number {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffMs = toDate.getTime() - fromDate.getTime();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  }
}
