import { randomUUID } from 'node:crypto';

/**
 * EvaluationCriterion — Configuration and options interface.
 */
export interface EvaluationCriterion {
  id: string;
  name: string;
  weight: number;
  threshold: number;
  description: string;
}

/**
 * EvaluationResult — Configuration and options interface.
 */
export interface EvaluationResult {
  id: string;
  targetId: string;
  targetType: string;
  scores: Record<string, number>;
  weightedScore: number;
  passed: boolean;
  details: Record<string, string>;
  evaluatedAt: string;
}

/**
 * EvaluationEngineOptions — Configuration and options interface.
 */
export interface EvaluationEngineOptions {
  overallThreshold?: number;
}

/**
 * EvaluationEngine — Provides constructor, registerCriterion, removeCriterion, getCriteria, ... operations.
 */
export class EvaluationEngine {
  private criteria: Map<string, EvaluationCriterion> = new Map();
  private history: EvaluationResult[] = [];
  private overallThreshold: number;

  constructor(options?: EvaluationEngineOptions) {
    this.overallThreshold = options?.overallThreshold ?? 0.7;
  }

  registerCriterion(criterion: EvaluationCriterion): void {
    this.criteria.set(criterion.id, criterion);
  }

  removeCriterion(id: string): void {
    this.criteria.delete(id);
  }

  getCriteria(): EvaluationCriterion[] {
    return [...this.criteria.values()];
  }

  setOverallThreshold(threshold: number): void {
    this.overallThreshold = threshold;
  }

  evaluate(
    targetId: string,
    targetType: string,
    scores: Record<string, number>,
    details?: Record<string, string>,
  ): EvaluationResult {
    const criteriaList = this.getCriteria();

    if (criteriaList.length === 0) {
      throw new Error('No criteria registered. Register at least one criterion before evaluating.');
    }

    let totalWeight = 0;
    let weightedSum = 0;
    const resultDetails: Record<string, string> = {};

    for (const criterion of criteriaList) {
      const score = scores[criterion.id];
      if (score === undefined) {
        throw new Error(`Missing score for criterion "${criterion.id}" (${criterion.name})`);
      }
      weightedSum += score * criterion.weight;
      totalWeight += criterion.weight;
      resultDetails[criterion.id] = details?.[criterion.id] ?? '';
    }

    const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = weightedScore >= this.overallThreshold;

    const result: EvaluationResult = {
      id: randomUUID(),
      targetId,
      targetType,
      scores: { ...scores },
      weightedScore,
      passed,
      details: resultDetails,
      evaluatedAt: new Date().toISOString(),
    };

    this.history.push(result);
    return result;
  }

  getHistory(targetId?: string): EvaluationResult[] {
    if (targetId) {
      return this.history.filter((r) => r.targetId === targetId);
    }
    return [...this.history];
  }
}
