// ============================================================
// DNA Context — Aggregates DNA boundaries with ACL validation
// ============================================================

import type { ACLResult } from '../anti-corruption/acl.interface';
import { AgentACL } from '../anti-corruption/agent-acl';
import type { BoundaryResult } from '../boundaries/boundary.interface';
import type { DNABoundary } from '../boundaries/dna-boundary';

export interface DNAContextValidationResult {
  aclResult: ACLResult;
  boundaryResults: BoundaryResult[];
  passed: boolean;
}

export class DNAContext {
  private boundaries: DNABoundary[] = [];
  private readonly acl = new AgentACL();

  constructor(private readonly dnaId: string) {}

  addBoundary(boundary: DNABoundary): void {
    this.boundaries.push(boundary);
  }

  validateAction(action: string, agentId: string, payload: unknown): DNAContextValidationResult {
    const aclResult = this.acl.validateInput({ agentId, action, payload });

    const boundaryResults: BoundaryResult[] = this.boundaries.map((boundary) =>
      boundary.validate({ action, dnaId: this.dnaId }),
    );

    const allBoundariesPassed = boundaryResults.every((r) => r.passed);

    return {
      aclResult,
      boundaryResults,
      passed: aclResult.passed && allBoundariesPassed,
    };
  }

  getDnaId(): string {
    return this.dnaId;
  }

  getBoundaries(): DNABoundary[] {
    return [...this.boundaries];
  }
}
