import { randomUUID } from 'node:crypto';

/**
 * ReasoningType — Union type: deductive, inductive, abductive;.
 */
export type ReasoningType = 'deductive' | 'inductive' | 'abductive';

/**
 * ReasoningStep — Configuration and options interface.
 */
export interface ReasoningStep {
  type: ReasoningType;
  premise: string;
  conclusion: string;
  confidence: number;
  supportingEvidence: string[];
}

/**
 * ReasoningChain — Configuration and options interface.
 */
export interface ReasoningChain {
  id: string;
  steps: ReasoningStep[];
  finalConclusion: string;
  overallConfidence: number;
  createdAt: string;
}

/**
 * ReasoningEngine — reasoning engine.
 *
 * Methods: deductive, inductive, abductive, chain, getChain.
 */
export class ReasoningEngine {
  private chains: Map<string, ReasoningChain> = new Map();

  deductive(premises: string[], rules: string[]): ReasoningStep {
    const valid = premises.length > 0 && rules.length > 0;
    const conclusion = valid
      ? `From [${premises.join(', ')}] applying [${rules.join(', ')}]`
      : 'No valid deduction possible';
    const confidence = valid ? Math.min(premises.length / (premises.length + 1), 1) * 0.95 : 0;
    return {
      type: 'deductive',
      premise: premises.join('; '),
      conclusion,
      confidence,
      supportingEvidence: rules,
    };
  }

  inductive(observations: string[], generalization: string): ReasoningStep {
    const confidence =
      observations.length > 0 ? Math.min(0.5 + observations.length * 0.08, 0.95) : 0;
    return {
      type: 'inductive',
      premise: observations.join('; '),
      conclusion: generalization,
      confidence,
      supportingEvidence: observations,
    };
  }

  abductive(observation: string, hypotheses: string[]): ReasoningStep {
    if (hypotheses.length === 0) {
      return {
        type: 'abductive',
        premise: observation,
        conclusion: 'No hypotheses provided',
        confidence: 0,
        supportingEvidence: [],
      };
    }
    const bestHypothesis = hypotheses[0];
    const confidence = Math.min(1 / hypotheses.length, 0.9);
    return {
      type: 'abductive',
      premise: observation,
      conclusion: `Best explanation: ${bestHypothesis}`,
      confidence,
      supportingEvidence: hypotheses,
    };
  }

  chain(steps: { type: ReasoningType; input: string[]; context: string[] }[]): ReasoningChain {
    const reasoningSteps: ReasoningStep[] = [];
    for (const step of steps) {
      let reasoningStep: ReasoningStep;
      switch (step.type) {
        case 'deductive': {
          const rules = step.context.length > 0 ? step.context : ['default rule'];
          reasoningStep = this.deductive(step.input, rules);
          break;
        }
        case 'inductive': {
          const generalization =
            step.context[0] ?? `Generalized from ${step.input.length} observations`;
          reasoningStep = this.inductive(step.input, generalization);
          break;
        }
        case 'abductive': {
          const observation = step.input.join(', ');
          reasoningStep = this.abductive(observation, step.context);
          break;
        }
        default:
          reasoningStep = {
            type: step.type,
            premise: step.input.join('; '),
            conclusion: 'Unknown reasoning type',
            confidence: 0,
            supportingEvidence: step.context,
          };
      }
      reasoningSteps.push(reasoningStep);
    }

    const overallConfidence =
      reasoningSteps.length > 0
        ? reasoningSteps.reduce((sum, s) => sum + s.confidence, 0) / reasoningSteps.length
        : 0;

    const finalConclusion = reasoningSteps.map((s) => s.conclusion).join(' → ');

    const chain: ReasoningChain = {
      id: randomUUID(),
      steps: reasoningSteps,
      finalConclusion,
      overallConfidence,
      createdAt: new Date().toISOString(),
    };

    this.chains.set(chain.id, chain);
    return chain;
  }

  getChain(id: string): ReasoningChain | undefined {
    return this.chains.get(id);
  }
}
