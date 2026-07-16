// ============================================================
// Execution Boundary — Enforces execution timeout constraints
// ============================================================

import type { Boundary, BoundaryResult } from './boundary.interface';

export class ExecutionBoundary implements Boundary {
  readonly id: string;
  readonly name: string;
  readonly type = 'execution' as const;

  constructor(
    private readonly executionId: string,
    private readonly timeout: number = 5000,
  ) {
    this.id = `execution-${executionId}`;
    this.name = `Execution Boundary: ${executionId}`;
  }

  validate(context: { executionId: string; startTime: number }): BoundaryResult {
    if (context.executionId !== this.executionId) {
      return {
        passed: false,
        reason: `Execution mismatch: expected ${this.executionId}, got ${context.executionId}`,
      };
    }

    const elapsed = Date.now() - context.startTime;
    if (elapsed > this.timeout) {
      return {
        passed: false,
        reason: `Execution timeout: ${elapsed}ms exceeded limit of ${this.timeout}ms`,
      };
    }

    return { passed: true };
  }

  getExecutionId(): string {
    return this.executionId;
  }

  getTimeout(): number {
    return this.timeout;
  }
}
