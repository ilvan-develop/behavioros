// ============================================================
// Agent Context — Aggregates agent boundaries with ACL validation
// ============================================================

import type { ACLResult } from '../anti-corruption/acl.interface';
import { AgentACL } from '../anti-corruption/agent-acl';
import type { AgentBoundary, AuthorityLevel } from '../boundaries/agent-boundary';
import type { BoundaryResult } from '../boundaries/boundary.interface';

export interface AgentContextValidationResult {
  aclResult: ACLResult;
  boundaryResults: BoundaryResult[];
  passed: boolean;
}

export class AgentContext {
  private boundaries: AgentBoundary[] = [];
  private readonly acl = new AgentACL();

  constructor(
    private readonly agentId: string,
    private readonly authority: AuthorityLevel,
  ) {}

  addBoundary(boundary: AgentBoundary): void {
    this.boundaries.push(boundary);
  }

  validateAction(action: string, payload: unknown): AgentContextValidationResult {
    const aclResult = this.acl.validateInput({ agentId: this.agentId, action, payload });

    const boundaryResults: BoundaryResult[] = this.boundaries.map((boundary) =>
      boundary.validate({
        agentId: this.agentId,
        authority: this.authority,
        action,
      }),
    );

    const allBoundariesPassed = boundaryResults.every((r) => r.passed);

    return {
      aclResult,
      boundaryResults,
      passed: aclResult.passed && allBoundariesPassed,
    };
  }

  getAgentId(): string {
    return this.agentId;
  }

  getAuthority(): AuthorityLevel {
    return this.authority;
  }

  getBoundaries(): AgentBoundary[] {
    return [...this.boundaries];
  }
}
