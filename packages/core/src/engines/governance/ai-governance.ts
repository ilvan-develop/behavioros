/**
 * AIGovernanceCheck — Configuration and options interface.
 */
export interface AIGovernanceCheck {
  name: string;
  score: number;
  passed: boolean;
  evidence: string[];
  recommendation: string;
}

/**
 * AIGovernanceReport — Configuration and options interface.
 */
export interface AIGovernanceReport {
  targetId: string;
  targetType: 'prompt' | 'response' | 'model' | 'agent';
  checks: AIGovernanceCheck[];
  overallScore: number;
  passed: boolean;
  generatedAt: string;
}

/**
 * AIGovernanceEvaluator — Configuration and options interface.
 */
export interface AIGovernanceEvaluator {
  readonly name: string;
  readonly description: string;
  readonly threshold: number;
  check(input: string, context?: Record<string, unknown>): AIGovernanceCheck;
}
