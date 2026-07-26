/**
 * ComplianceCheckResult — Configuration and options interface.
 */
export interface ComplianceCheckResult {
  name: string;
  passed: boolean;
  score: number;
  evidence: string;
  recommendation?: string;
}

/**
 * ComplianceReport — Configuration and options interface.
 */
export interface ComplianceReport {
  provider: string;
  target: string;
  overallScore: number;
  checks: ComplianceCheckResult[];
  passed: boolean;
  generatedAt: string;
}

/**
 * ComplianceProvider — Configuration and options interface.
 */
export interface ComplianceProvider {
  readonly name: string;
  check(target: string): Promise<ComplianceReport>;
  getRequirements(): string[];
}
