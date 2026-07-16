// ============================================================
// Anti-Corruption Layer — Interface for input/output sanitization
// ============================================================

export interface ACLResult {
  passed: boolean;
  reason?: string;
}

export interface AntiCorruptionLayer {
  readonly id: string;
  readonly name: string;
  validateInput(input: Record<string, unknown>): ACLResult;
  transformInput(input: Record<string, unknown>): Record<string, unknown>;
  validateOutput(output: Record<string, unknown>): ACLResult;
  transformOutput(output: Record<string, unknown>): Record<string, unknown>;
}
