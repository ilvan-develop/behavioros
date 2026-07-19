// ============================================================
// Boundary — DDD Bounded Context Interface
// ============================================================

export type BoundaryType = 'dna' | 'agent' | 'execution';

export interface BoundaryResult {
  passed: boolean;
  reason?: string;
}

export interface Boundary {
  readonly id: string;
  readonly name: string;
  readonly type: BoundaryType;
  validate(context: Record<string, unknown>): BoundaryResult;
}
