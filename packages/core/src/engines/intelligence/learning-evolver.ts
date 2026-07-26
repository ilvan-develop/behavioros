import type { DetectedPattern } from './pattern-detector';

/**
 * LearningFix — Configuration and options interface.
 */
export interface LearningFix {
  patternId: string;
  action: string;
  autoApplied: boolean;
  appliedAt: string;
  success: boolean;
}

/**
 * LearningEvolver — Provides autoApply, getFixes, setConfidenceThreshold, switch operations.
 */
export class LearningEvolver {
  private fixes: LearningFix[] = [];
  private confidenceThreshold = 0.7;

  async autoApply(pattern: DetectedPattern): Promise<LearningFix> {
    const canApply = pattern.confidence >= this.confidenceThreshold;

    const fix: LearningFix = {
      patternId: pattern.id,
      action: this.buildAction(pattern),
      autoApplied: canApply,
      appliedAt: new Date().toISOString(),
      success: canApply,
    };

    this.fixes.push(fix);
    return fix;
  }

  getFixes(): LearningFix[] {
    return [...this.fixes];
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
  }

  private buildAction(pattern: DetectedPattern): string {
    switch (pattern.type) {
      case 'frequent-sequence':
        return `Optimize for repeated sequence: ${pattern.name}`;
      case 'anomaly':
        return `Investigate anomaly: ${pattern.description}`;
      case 'trend':
        return `Adapt to trend: ${pattern.description}`;
      default:
        return `Review pattern: ${pattern.name}`;
    }
  }
}
