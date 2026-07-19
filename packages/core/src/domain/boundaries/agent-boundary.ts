// ============================================================
// Agent Boundary — Enforces agent authority constraints
// ============================================================

import type { Boundary, BoundaryResult } from './boundary.interface';

const AUTHORITY_LEVELS = ['junior', 'senior', 'architect', 'tech_lead', 'cto'] as const;

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

export class AgentBoundary implements Boundary {
  readonly id: string;
  readonly name: string;
  readonly type = 'agent' as const;

  constructor(
    private readonly agentId: string,
    private readonly requiredAuthority: AuthorityLevel,
  ) {
    this.id = `agent-${agentId}`;
    this.name = `Agent Boundary: ${agentId}`;
  }

  validate(context: { agentId: string; authority: string; action: string }): BoundaryResult {
    if (context.agentId !== this.agentId) {
      return {
        passed: false,
        reason: `Agent mismatch: expected ${this.agentId}, got ${context.agentId}`,
      };
    }

    const requiredLevel = AUTHORITY_LEVELS.indexOf(this.requiredAuthority);
    const agentLevel = AUTHORITY_LEVELS.indexOf(context.authority as AuthorityLevel);

    if (agentLevel === -1) {
      return { passed: false, reason: `Unknown authority level: ${context.authority}` };
    }

    if (agentLevel < requiredLevel) {
      return {
        passed: false,
        reason: `Insufficient authority: requires ${this.requiredAuthority}, got ${context.authority}`,
      };
    }

    return { passed: true };
  }

  getAgentId(): string {
    return this.agentId;
  }

  getRequiredAuthority(): AuthorityLevel {
    return this.requiredAuthority;
  }
}
