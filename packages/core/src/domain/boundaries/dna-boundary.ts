// ============================================================
// DNA Boundary — Enforces DNA scope constraints
// ============================================================

import type { Boundary, BoundaryResult } from './boundary.interface';

export class DNABoundary implements Boundary {
  readonly id: string;
  readonly name: string;
  readonly type = 'dna' as const;

  constructor(
    private readonly dnaId: string,
    private readonly allowedActions: string[],
  ) {
    this.id = `dna-${dnaId}`;
    this.name = `DNA Boundary: ${dnaId}`;
  }

  validate(context: { action: string; dnaId: string }): BoundaryResult {
    if (context.dnaId !== this.dnaId) {
      return {
        passed: false,
        reason: `DNA mismatch: expected ${this.dnaId}, got ${context.dnaId}`,
      };
    }

    if (!this.allowedActions.includes(context.action)) {
      return {
        passed: false,
        reason: `Action '${context.action}' not allowed in DNA '${this.dnaId}'`,
      };
    }

    return { passed: true };
  }

  getDnaId(): string {
    return this.dnaId;
  }

  getAllowedActions(): string[] {
    return [...this.allowedActions];
  }
}
