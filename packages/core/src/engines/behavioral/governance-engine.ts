/**
 * BOS Governance Engine
 *
 * Validates agent authority, enforces domain boundaries,
 * manages escalation triggers, and resolves conflicts.
 *
 * Config-driven via YAML (authority matrix, domain boundaries,
 * escalation rules) or direct GovernanceConfig object.
 */

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

// ============================================================
// Interfaces — matching the BOS original contract
// ============================================================

export interface AgentAuthority {
  role: 'junior' | 'senior' | 'architect' | 'tech_lead' | 'cto';
  domain: string;
  permissions: {
    maxFilesPerChange: number | 'unlimited';
    maxPackages: number | 'unlimited';
    canDeploy: boolean;
    canApprove: boolean;
    canVeto: boolean;
    canModifySchema: boolean;
    canChangeContracts: boolean;
  };
  domainBoundary: {
    canModify: string[];
    cannotModify: string[];
    canRead: string;
  };
  authority?: string[];
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: string;
  override?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationRule {
  trigger: string;
  action: string;
  timeout: string;
  retry: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConflictResolution {
  protocol: Array<{ step: string }>;
  timeout: string;
  escalation: string;
}

export interface GovernanceConfig {
  authorityMatrix: Record<string, AgentAuthority>;
  domainBoundaries: Record<
    string,
    {
      canModify: string[];
      cannotModify: string[];
      canRead: string;
      authority?: string[];
    }
  >;
  escalationMatrix: EscalationRule[];
  conflictResolution: Record<string, ConflictResolution>;
  compliance: {
    requiredFrameworks: Array<{
      name: string;
      scope: string;
      auditFrequency: string;
    }>;
    auditTrail: string[];
  };
}

// ============================================================
// BosGovernanceEngine — YAML/config-driven governance
// ============================================================

export class BosGovernanceEngine {
  private readonly config: GovernanceConfig;

  /**
   * @param configOrPath  Either a file-system path to a YAML config
   *                      or a pre-parsed GovernanceConfig object.
   */
  constructor(configOrPath: string | GovernanceConfig) {
    if (typeof configOrPath === 'string') {
      const content = readFileSync(configOrPath, 'utf-8');
      this.config = parseYaml(content) as GovernanceConfig;
    } else {
      this.config = configOrPath;
    }
  }

  // ── Core validation ─────────────────────────────────────────

  /**
   * Validate whether an agent is authorised to perform the given action
   * on the specified target.
   */
  validate(context: {
    agent: string;
    action: string;
    target: string;
    agentRole?: string;
    agentDomain?: string;
  }): ValidationResult {
    const authority = this.config.authorityMatrix[context.agentRole || context.agent];

    if (!authority) {
      return {
        allowed: false,
        reason: `Unknown agent role: ${context.agentRole || context.agent}`,
        severity: 'high',
      };
    }

    // ── Domain boundary check ────────────────────────────────
    const domainConfig = this.config.domainBoundaries[context.agentDomain || authority.domain];

    if (domainConfig) {
      const isForbidden = domainConfig.cannotModify.some((pattern) =>
        matchesGlob(context.target, pattern),
      );

      if (isForbidden) {
        return {
          allowed: false,
          reason: `${context.agent} (${authority.domain}) cannot modify ${context.target}`,
          severity: 'high',
        };
      }
    }

    // ── Permission-specific checks ───────────────────────────
    switch (context.action) {
      case 'deploy':
        if (!authority.permissions.canDeploy) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot deploy`,
            requiresApproval: 'tech_lead',
            severity: 'critical',
          };
        }
        break;

      case 'approve':
        if (!authority.permissions.canApprove) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot approve`,
            severity: 'medium',
          };
        }
        break;

      case 'veto':
        if (!authority.permissions.canVeto) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot veto`,
            severity: 'high',
          };
        }
        break;

      case 'modify_schema':
        if (!authority.permissions.canModifySchema) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot modify schema`,
            requiresApproval: 'architect',
            severity: 'high',
          };
        }
        break;

      case 'change_contract':
        if (!authority.permissions.canChangeContracts) {
          return {
            allowed: false,
            reason: `${context.agent} (role: ${authority.role}) cannot change contracts`,
            requiresApproval: 'architect',
            severity: 'high',
          };
        }
        break;
    }

    return { allowed: true };
  }

  // ── Escalation ──────────────────────────────────────────────

  /**
   * Return the escalation rule that matches the given trigger string.
   */
  getEscalation(trigger: string): EscalationRule | null {
    return (
      this.config.escalationMatrix.find(
        (r) => trigger.includes(r.trigger) || r.trigger.includes(trigger),
      ) ?? null
    );
  }

  /**
   * Return all escalation rules.
   */
  getEscalationRules(): EscalationRule[] {
    return this.config.escalationMatrix;
  }

  // ── Conflict resolution ─────────────────────────────────────

  /**
   * Return the conflict-resolution protocol for a given type.
   */
  getConflictResolution(type: string): ConflictResolution | null {
    return this.config.conflictResolution[type] ?? null;
  }

  // ── Context / compliance ────────────────────────────────────

  /**
   * Return full governance context for a given agent domain.
   */
  getContext(agentDomain: string): {
    domain: string;
    boundaries: GovernanceConfig['domainBoundaries'][string] | undefined;
    compliance: GovernanceConfig['compliance'];
  } {
    return {
      domain: agentDomain,
      boundaries: this.config.domainBoundaries[agentDomain],
      compliance: this.config.compliance,
    };
  }

  /**
   * Return the raw governance config (read-only).
   */
  getConfig(): GovernanceConfig {
    return this.config;
  }
}

// ============================================================
// Glob matching utility (public for reuse)
// ============================================================

/**
 * Simple glob-to-regex matcher.
 * `**` matches everything, `*` matches within a single path segment.
 */
export function matchesGlob(target: string, pattern: string): boolean {
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\*\*/g, '.__GLOB__')
        .replace(/\*/g, '[^/]*')
        .replace(/\.__GLOB__/g, '.*') +
      '$',
  );
  return regex.test(target);
}
