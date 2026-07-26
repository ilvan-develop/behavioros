import { randomUUID } from 'node:crypto';

const BLOCKED_TERMS = [
  'ignore previous instructions',
  'system prompt',
  'jailbreak',
  'bypass filter',
];
const EXPECTED_MIN_LENGTH = 20;

/**
 * EvaluationCriterion — Configuration and options interface.
 */
export interface EvaluationCriterion {
  name: string;
  weight: number;
  score: (response: string, context?: Record<string, unknown>) => number;
}

/**
 * ResponseEvaluation — Configuration and options interface.
 */
export interface ResponseEvaluation {
  id: string;
  requestId: string;
  scores: Record<string, number>;
  weightedScore: number;
  passed: boolean;
  details: Record<string, string>;
  evaluatedAt: string;
}

/**
 * ResponseEvaluator — response evaluator.
 *
 * Methods: registerCriterion, removeCriterion, evaluate, getHistory, setThreshold.
 */
export class ResponseEvaluator {
  private criteria: Map<string, EvaluationCriterion> = new Map();
  private history: ResponseEvaluation[] = [];
  private threshold: number;

  constructor(threshold?: number) {
    this.threshold = threshold ?? 0.7;
    this.registerDefaultCriteria();
  }

  private registerDefaultCriteria(): void {
    this.registerCriterion({
      name: 'relevance',
      weight: 0.3,
      score: (response: string, context?: Record<string, unknown>) => {
        if (!context?.keywords) return 0.7;
        const keywords = context.keywords as string[];
        if (keywords.length === 0) return 0.7;
        const matches = keywords.filter((kw) => response.toLowerCase().includes(kw.toLowerCase()));
        return matches.length / keywords.length;
      },
    });

    this.registerCriterion({
      name: 'completeness',
      weight: 0.25,
      score: (response: string) => {
        const length = response.length;
        if (length >= EXPECTED_MIN_LENGTH * 3) return 1;
        if (length >= EXPECTED_MIN_LENGTH * 2) return 0.8;
        if (length >= EXPECTED_MIN_LENGTH) return 0.5;
        return Math.max(0, length / EXPECTED_MIN_LENGTH);
      },
    });

    this.registerCriterion({
      name: 'safety',
      weight: 0.25,
      score: (response: string) => {
        const lower = response.toLowerCase();
        const found = BLOCKED_TERMS.filter((term) => lower.includes(term));
        return found.length === 0 ? 1 : Math.max(0, 1 - found.length * 0.4);
      },
    });

    this.registerCriterion({
      name: 'format',
      weight: 0.2,
      score: (response: string, context?: Record<string, unknown>) => {
        const format = context?.expectedFormat as string | undefined;
        if (!format || format === 'text') return 1;
        if (format === 'json') {
          try {
            JSON.parse(response);
            return 1;
          } catch {
            return 0;
          }
        }
        if (format === 'list') {
          return /^(\s*[-*]\s|^\d+[.)]\s)/m.test(response.trim()) ? 1 : 0;
        }
        return 1;
      },
    });
  }

  registerCriterion(criterion: EvaluationCriterion): void {
    this.criteria.set(criterion.name, criterion);
  }

  removeCriterion(name: string): void {
    this.criteria.delete(name);
  }

  evaluate(
    requestId: string,
    response: string,
    context?: Record<string, unknown>,
  ): ResponseEvaluation {
    const criteriaList = [...this.criteria.values()];

    if (criteriaList.length === 0) {
      throw new Error('No criteria registered.');
    }

    const scores: Record<string, number> = {};
    const details: Record<string, string> = {};
    let totalWeight = 0;
    let weightedSum = 0;

    for (const criterion of criteriaList) {
      const score = criterion.score(response, context);
      scores[criterion.name] = score;
      weightedSum += score * criterion.weight;
      totalWeight += criterion.weight;
      details[criterion.name] = formatDetail(criterion.name, score);
    }

    const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = weightedScore >= this.threshold;

    const evaluation: ResponseEvaluation = {
      id: randomUUID(),
      requestId,
      scores,
      weightedScore,
      passed,
      details,
      evaluatedAt: new Date().toISOString(),
    };

    this.history.push(evaluation);
    return evaluation;
  }

  getHistory(requestId?: string): ResponseEvaluation[] {
    if (requestId) {
      return this.history.filter((e) => e.requestId === requestId);
    }
    return [...this.history];
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }
}

function formatDetail(name: string, score: number): string {
  if (score >= 0.9) return `${name}: excellent`;
  if (score >= 0.7) return `${name}: good`;
  if (score >= 0.4) return `${name}: fair`;
  return `${name}: poor`;
}
