import { randomUUID } from 'node:crypto';

/**
 * Hypothesis — Configuration and options interface.
 */
export interface Hypothesis {
  id: string;
  observationId: string;
  description: string;
  confidence: number;
  patterns: string[];
}

/**
 * InferenceStep — Configuration and options interface.
 */
export interface InferenceStep {
  from: string;
  to: string;
  rule: string;
  confidence: number;
}

/**
 * InferenceChain — Configuration and options interface.
 */
export interface InferenceChain {
  id: string;
  hypothesisId: string;
  steps: InferenceStep[];
  conclusion: string;
  overallConfidence: number;
}

/**
 * UnderstandingEngine — understanding engine.
 *
 * Methods: hypothesize, infer, getHypothesis, getInference, listHypotheses, getQualifyingHypotheses, listInferences, setConfidenceThreshold.
 */
export class UnderstandingEngine {
  private hypotheses: Map<string, Hypothesis> = new Map();
  private inferences: Map<string, InferenceChain> = new Map();

  hypothesize(observationId: string, patterns: string[]): Hypothesis {
    const hypothesis: Hypothesis = {
      id: randomUUID(),
      observationId,
      description: `Hypothesis based on observation ${observationId} with patterns [${patterns.join(', ')}]`,
      confidence: patterns.length > 0 ? Math.min(0.3 + patterns.length * 0.15, 0.95) : 0.1,
      patterns,
    };
    this.hypotheses.set(hypothesis.id, hypothesis);
    return hypothesis;
  }

  infer(
    hypothesisId: string,
    rules: { if: string; thenResult: string; confidence: number }[],
  ): InferenceChain {
    const hypothesis = this.hypotheses.get(hypothesisId);
    if (!hypothesis) {
      throw new Error(`Hypothesis ${hypothesisId} not found`);
    }

    const steps: InferenceStep[] = rules.map((rule) => ({
      from: rule.if,
      to: rule.thenResult,
      rule: `${rule.if} → ${rule.thenResult}`,
      confidence: rule.confidence,
    }));

    const overallConfidence =
      steps.length > 0 ? steps.reduce((sum, s) => sum * s.confidence, 1) : 0;

    const conclusion = steps.map((s) => s.to).join(' → ');

    const chain: InferenceChain = {
      id: randomUUID(),
      hypothesisId,
      steps,
      conclusion,
      overallConfidence,
    };

    this.inferences.set(chain.id, chain);
    return chain;
  }

  getHypothesis(id: string): Hypothesis | undefined {
    return this.hypotheses.get(id);
  }

  getInference(id: string): InferenceChain | undefined {
    return this.inferences.get(id);
  }

  listHypotheses(observationId?: string): Hypothesis[] {
    const all = Array.from(this.hypotheses.values());
    if (observationId) {
      return all.filter((h) => h.observationId === observationId);
    }
    return all;
  }

  getQualifyingHypotheses(minConfidence?: number): Hypothesis[] {
    const threshold = minConfidence ?? this.confidenceThreshold;
    return Array.from(this.hypotheses.values()).filter((h) => h.confidence >= threshold);
  }

  listInferences(hypothesisId?: string): InferenceChain[] {
    const all = Array.from(this.inferences.values());
    if (hypothesisId) {
      return all.filter((i) => i.hypothesisId === hypothesisId);
    }
    return all;
  }

  private confidenceThreshold = 0.5;

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }
}
