/**
 * RiskAssessment — Configuration and options interface.
 */
export interface RiskAssessment {
  id: string;
  target: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: { name: string; score: number; weight: number }[];
  recommendations: string[];
  assessedAt: string;
}

const LEVEL_THRESHOLDS = [
  { max: 0.25, level: 'low' as const },
  { max: 0.5, level: 'medium' as const },
  { max: 0.75, level: 'high' as const },
  { max: 1, level: 'critical' as const },
];

function calculateLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  for (const t of LEVEL_THRESHOLDS) {
    if (score <= t.max) return t.level;
  }
  return 'critical';
}

/**
 * RiskEngine — risk engine.
 *
 * Methods: assess, getHistory, setTolerance.
 */
export class RiskEngine {
  private history: RiskAssessment[] = [];

  assess(
    target: string,
    factors: { name: string; score: number; weight: number }[],
  ): RiskAssessment {
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore =
      totalWeight > 0 ? factors.reduce((sum, f) => sum + f.score * (f.weight / totalWeight), 0) : 0;
    const clampedScore = Math.max(0, Math.min(1, weightedScore));
    const toleranceShift = { low: -1, medium: 0, high: 1, critical: 2 };
    const adjustedScore = clampedScore + toleranceShift[this.tolerance] * 0.05;
    const clamped = Math.max(0, Math.min(1, adjustedScore));
    const level = calculateLevel(clamped);

    const assessment: RiskAssessment = {
      id: crypto.randomUUID(),
      target,
      score: clampedScore,
      level,
      factors,
      recommendations: this.generateRecommendations(level, factors),
      assessedAt: new Date().toISOString(),
    };

    this.history.push(assessment);
    return assessment;
  }

  getHistory(target?: string): RiskAssessment[] {
    if (!target) return [...this.history];
    return this.history.filter((a) => a.target === target);
  }

  private tolerance: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  setTolerance(level: 'low' | 'medium' | 'high' | 'critical'): void {
    this.tolerance = level;
  }

  private generateRecommendations(
    level: string,
    factors: { name: string; score: number; weight: number }[],
  ): string[] {
    const recommendations: string[] = [];

    if (level === 'critical' || level === 'high') {
      recommendations.push('Manual review required before proceeding');
    }

    for (const factor of factors) {
      if (factor.score > 0.7) {
        recommendations.push(`High risk factor "${factor.name}": investigate and mitigate`);
      }
    }

    return recommendations;
  }
}
