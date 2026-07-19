import type { BoundaryRule, GovernanceRule } from '@behavioros/schemas';
import { AUTHORITY_HIERARCHY } from '../../shared/authority-hierarchy';

// ============================================================
// Governance Engine — Authority, Boundaries, Policies, Escalation
// ============================================================

export type AuthorityLevelValue =
  | 'junior'
  | 'senior'
  | 'architect'
  | 'lead'
  | 'director'
  | 'vp'
  | 'c-level';

export interface GovernanceContext {
  agentId: string;
  agentRole: string;
  agentAuthority: AuthorityLevelValue;
  action: string;
  targetType: 'file' | 'module' | 'service' | 'config' | 'infrastructure' | 'database';
  targetScope?: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
  /** Agent boundary rules from DNA persona definition */
  boundaries?: BoundaryRule[];
  /** Files targeted by the action (for glob pattern matching) */
  targetFiles?: string[];
  /** Modules targeted by the action (for module boundary checking) */
  targetModules?: number;
  /** Number of files being changed (for max_files checking) */
  fileCount?: number;
  /** Number of lines being changed (for max_lines checking) */
  lineCount?: number;
  /** Dependency being modified (for dependency boundary checking) */
  targetDependency?: string;
  /** Current time for time-based restrictions (defaults to new Date()) */
  currentTime?: Date;
}

export interface GovernanceDecision {
  allowed: boolean;
  reason: string;
  rule?: GovernanceRule;
  escalationRequired: boolean;
  requiredAuthority?: AuthorityLevelValue;
}

const DAY_NAME_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export class GovernanceEngine {
  private rules: GovernanceRule[];
  private ruleIndex = new Map<string, GovernanceRule[]>();
  private rulesWithoutScope: GovernanceRule[] = [];
  private timeRestrictedRules: GovernanceRule[] = [];
  private dependencyRules: GovernanceRule[] = [];
  private conditionIndex = new Map<string, GovernanceRule[]>();
  private escalationChain: Map<AuthorityLevelValue, AuthorityLevelValue> = new Map([
    ['junior', 'senior'],
    ['senior', 'architect'],
    ['architect', 'lead'],
    ['lead', 'director'],
    ['director', 'vp'],
    ['vp', 'c-level'],
  ]);

  constructor(rules: GovernanceRule[]) {
    this.rules = rules;
    this.buildIndex();
  }

  private buildIndex(): void {
    this.ruleIndex.clear();
    this.conditionIndex.clear();
    this.rulesWithoutScope = [];
    this.timeRestrictedRules = [];
    this.dependencyRules = [];

    for (const rule of this.rules) {
      // Scope index
      if (!rule.scope || rule.scope.length === 0) {
        this.rulesWithoutScope.push(rule);
      } else {
        for (const key of rule.scope) {
          const existing = this.ruleIndex.get(key);
          if (existing) {
            existing.push(rule);
          } else {
            this.ruleIndex.set(key, [rule]);
          }
        }
      }

      // Condition-type index for O(1) lookups on "type:" and "impact:" conditions
      if (rule.conditions) {
        for (const condition of rule.conditions) {
          if (condition.startsWith('type:') || condition.startsWith('impact:')) {
            const existing = this.conditionIndex.get(condition);
            if (existing) {
              existing.push(rule);
            } else {
              this.conditionIndex.set(condition, [rule]);
            }
          }
        }
      }

      // Pre-classify rules by condition type for O(1) lookup
      if (rule.conditions && (rule.action === 'block' || rule.action === 'escalate')) {
        for (const condition of rule.conditions) {
          if (condition.startsWith('day:') || condition.startsWith('hours:')) {
            this.timeRestrictedRules.push(rule);
            break;
          }
          if (condition.startsWith('dependency:')) {
            this.dependencyRules.push(rule);
            break;
          }
        }
      }
    }
  }

  private getCandidateRules(context: GovernanceContext): GovernanceRule[] {
    const seen = new Set<GovernanceRule>();
    const candidates: GovernanceRule[] = [];

    // Rules without scope always apply
    for (const rule of this.rulesWithoutScope) {
      candidates.push(rule);
      seen.add(rule);
    }

    // Scope-indexed lookup (O(1))
    const scopeKeys = [context.targetType, context.action];
    for (const key of scopeKeys) {
      const indexed = this.ruleIndex.get(key);
      if (indexed) {
        for (const rule of indexed) {
          if (!seen.has(rule)) {
            candidates.push(rule);
            seen.add(rule);
          }
        }
      }
    }

    // Condition-type index lookup (O(1)) for type: and impact: conditions
    const conditionKeys = [`type:${context.targetType}`, `impact:${context.impact}`];
    for (const key of conditionKeys) {
      const indexed = this.conditionIndex.get(key);
      if (indexed) {
        for (const rule of indexed) {
          if (!seen.has(rule)) {
            candidates.push(rule);
            seen.add(rule);
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Avalia se um agente pode executar uma ação
   */
  evaluate(context: GovernanceContext): GovernanceDecision {
    // 1. Check authority level
    const authorityCheck = this.checkAuthority(context);
    if (!authorityCheck.allowed) {
      return authorityCheck;
    }

    // 2. Check governance rules
    const ruleCheck = this.checkRules(context);
    if (!ruleCheck.allowed) {
      return ruleCheck;
    }

    // 3. Check boundaries
    const boundaryCheck = this.checkBoundaries(context);
    if (!boundaryCheck.allowed) {
      return boundaryCheck;
    }

    return { allowed: true, reason: 'All governance checks passed', escalationRequired: false };
  }

  private checkAuthority(context: GovernanceContext): GovernanceDecision {
    const agentLevel = AUTHORITY_HIERARCHY[context.agentAuthority];
    const requiredLevel = this.getRequiredAuthority(context);

    if (agentLevel < requiredLevel) {
      const requiredRole = Object.entries(AUTHORITY_HIERARCHY).find(
        ([, v]) => v === requiredLevel,
      )?.[0];
      return {
        allowed: false,
        reason: `Authority level ${context.agentAuthority} (level ${agentLevel}) is insufficient. Required: ${requiredRole} (level ${requiredLevel})`,
        escalationRequired: true,
        requiredAuthority: requiredRole as AuthorityLevelValue,
      };
    }

    return { allowed: true, reason: 'Authority check passed', escalationRequired: false };
  }

  private getRequiredAuthority(context: GovernanceContext): number {
    const impactMap: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return impactMap[context.impact] ?? 1;
  }

  private checkRules(context: GovernanceContext): GovernanceDecision {
    const candidates = this.getCandidateRules(context);
    for (const rule of candidates) {
      if (this.ruleApplies(rule, context)) {
        if (rule.action === 'block') {
          return {
            allowed: false,
            reason: `Blocked by governance rule: ${rule.name}`,
            rule,
            escalationRequired: rule.level === 'critical' || rule.level === 'high',
          };
        }
        if (rule.action === 'escalate') {
          return {
            allowed: false,
            reason: `Approval required by governance rule: ${rule.name}`,
            rule,
            escalationRequired: true,
          };
        }
      }
    }
    return {
      allowed: true,
      reason: 'No governance rules blocked action',
      escalationRequired: false,
    };
  }

  private ruleApplies(rule: GovernanceRule, context: GovernanceContext): boolean {
    // Check scope
    if (rule.scope && rule.scope.length > 0) {
      if (!rule.scope.includes(context.targetType) && !rule.scope.includes(context.action)) {
        return false;
      }
    }

    // Check conditions — use precomputed index for type:/impact: patterns
    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        // Fast path: indexed type/impact conditions
        if (condition.startsWith('type:') || condition.startsWith('impact:')) {
          if (
            condition === `type:${context.targetType}` ||
            condition === `impact:${context.impact}`
          ) {
            return true;
          }
          continue;
        }
        // Slow path: other conditions (day:, hours:, dependency:, freeform)
        if (condition.includes(context.impact) || condition.includes(context.targetType)) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  // ----------------------------------------------------------
  // Boundary Checking
  // ----------------------------------------------------------

  private checkBoundaries(context: GovernanceContext): GovernanceDecision {
    const boundaries = context.boundaries ?? [];

    for (const boundary of boundaries) {
      const result = this.evaluateBoundaryRule(boundary, context);
      if (!result.allowed) {
        return result;
      }
    }

    // Time-based restrictions from governance rule conditions
    const timeCheck = this.checkTimeRestrictions(context);
    if (!timeCheck.allowed) {
      return timeCheck;
    }

    // Dependency boundary from governance rule conditions
    const depCheck = this.checkDependencyBoundary(context);
    if (!depCheck.allowed) {
      return depCheck;
    }

    return { allowed: true, reason: 'All boundary checks passed', escalationRequired: false };
  }

  private evaluateBoundaryRule(
    boundary: BoundaryRule,
    context: GovernanceContext,
  ): GovernanceDecision {
    switch (boundary.type) {
      case 'forbidden':
        return this.checkForbidden(boundary, context);
      case 'max_files':
        return this.checkMaxFiles(boundary, context);
      case 'max_lines':
        return this.checkMaxLines(boundary, context);
      case 'max_modules':
        return this.checkMaxModules(boundary, context);
      case 'require_approval':
        return this.checkBoundaryApproval(boundary, context);
      default:
        return {
          allowed: true,
          reason: `Unknown boundary type '${(boundary as BoundaryRule).type}', skipping`,
          escalationRequired: false,
        };
    }
  }

  /**
   * Check if target files or scope match a forbidden glob pattern.
   * Forbidden boundaries block access to specific paths/modules.
   */
  private checkForbidden(boundary: BoundaryRule, context: GovernanceContext): GovernanceDecision {
    const pattern = String(boundary.value);

    // Check individual files against the forbidden pattern
    if (context.targetFiles) {
      for (const file of context.targetFiles) {
        if (GovernanceEngine.matchesGlob(pattern, file)) {
          const msg = `File '${file}' matches forbidden pattern '${pattern}' (boundary: ${boundary.name})`;
          return this.applyScopeEscalation(msg, context);
        }
      }
    }

    // Check target scope against the forbidden pattern
    if (context.targetScope) {
      if (GovernanceEngine.matchesGlob(pattern, context.targetScope)) {
        const msg = `Scope '${context.targetScope}' matches forbidden pattern '${pattern}' (boundary: ${boundary.name})`;
        return this.applyScopeEscalation(msg, context);
      }
    }

    return {
      allowed: true,
      reason: `Forbidden pattern '${pattern}' not matched (boundary: ${boundary.name})`,
      escalationRequired: false,
    };
  }

  /**
   * Check if file count exceeds the maximum allowed per scope.
   */
  private checkMaxFiles(boundary: BoundaryRule, context: GovernanceContext): GovernanceDecision {
    const max = Number(boundary.value);
    if (Number.isNaN(max)) {
      return {
        allowed: true,
        reason: `Invalid max_files value '${boundary.value}' in boundary ${boundary.name}, skipping`,
        escalationRequired: false,
      };
    }

    if (context.fileCount !== undefined && context.fileCount > max) {
      const msg = `File count ${context.fileCount} exceeds maximum ${max} per ${boundary.scope} (boundary: ${boundary.name})`;
      return this.applyScopeEscalation(msg, context);
    }

    return {
      allowed: true,
      reason: `File count ${context.fileCount ?? 'N/A'} within limit ${max} (boundary: ${boundary.name})`,
      escalationRequired: false,
    };
  }

  /**
   * Check if line count exceeds the maximum allowed per scope.
   */
  private checkMaxLines(boundary: BoundaryRule, context: GovernanceContext): GovernanceDecision {
    const max = Number(boundary.value);
    if (Number.isNaN(max)) {
      return {
        allowed: true,
        reason: `Invalid max_lines value '${boundary.value}' in boundary ${boundary.name}, skipping`,
        escalationRequired: false,
      };
    }

    if (context.lineCount !== undefined && context.lineCount > max) {
      const msg = `Line count ${context.lineCount} exceeds maximum ${max} per ${boundary.scope} (boundary: ${boundary.name})`;
      return this.applyScopeEscalation(msg, context);
    }

    return {
      allowed: true,
      reason: `Line count ${context.lineCount ?? 'N/A'} within limit ${max} (boundary: ${boundary.name})`,
      escalationRequired: false,
    };
  }

  /**
   * Check if module count exceeds the maximum allowed per scope.
   */
  private checkMaxModules(boundary: BoundaryRule, context: GovernanceContext): GovernanceDecision {
    const max = Number(boundary.value);
    if (Number.isNaN(max)) {
      return {
        allowed: true,
        reason: `Invalid max_modules value '${boundary.value}' in boundary ${boundary.name}, skipping`,
        escalationRequired: false,
      };
    }

    if (context.targetModules !== undefined && context.targetModules > max) {
      const msg = `Module count ${context.targetModules} exceeds maximum ${max} per ${boundary.scope} (boundary: ${boundary.name})`;
      return this.applyScopeEscalation(msg, context);
    }

    return {
      allowed: true,
      reason: `Module count ${context.targetModules ?? 'N/A'} within limit ${max} (boundary: ${boundary.name})`,
      escalationRequired: false,
    };
  }

  /**
   * If boundary requires approval, escalate regardless of other factors.
   */
  private checkBoundaryApproval(
    boundary: BoundaryRule,
    context: GovernanceContext,
  ): GovernanceDecision {
    if (boundary.value === true) {
      const msg = `Action requires approval per boundary: ${boundary.name}`;
      return this.applyScopeEscalation(msg, context);
    }

    return {
      allowed: true,
      reason: `Boundary '${boundary.name}' does not require approval`,
      escalationRequired: false,
    };
  }

  /**
   * Time-based restrictions from governance rule conditions.
   * Supports:
   *   - day:<dayName>       blocks action on that day (e.g. day:friday)
   *   - hours:<start>-<end> blocks action during those hours (e.g. hours:9-17)
   */
  private checkTimeRestrictions(context: GovernanceContext): GovernanceDecision {
    const now = context.currentTime ?? new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    for (const rule of this.timeRestrictedRules) {
      if (!rule.conditions || rule.conditions.length === 0) continue;

      for (const condition of rule.conditions) {
        if (condition.startsWith('day:')) {
          const dayName = condition.slice(4).toLowerCase().trim();
          const restrictedDay = DAY_NAME_MAP[dayName];
          if (restrictedDay !== undefined && currentDay === restrictedDay) {
            const msg = `Action restricted on ${dayName} by governance rule: ${rule.name}`;
            if (rule.action === 'block') {
              return {
                allowed: false,
                reason: msg,
                rule,
                escalationRequired: rule.level === 'critical' || rule.level === 'high',
              };
            }
            return {
              allowed: true,
              reason: msg,
              rule,
              escalationRequired: true,
            };
          }
        }

        if (condition.startsWith('hours:')) {
          const range = condition.slice(6).trim();
          const [startStr, endStr] = range.split('-');
          const start = Number.parseInt(startStr, 10);
          const end = Number.parseInt(endStr, 10);
          if (
            !Number.isNaN(start) &&
            !Number.isNaN(end) &&
            currentHour >= start &&
            currentHour <= end
          ) {
            const msg = `Action restricted during hours ${start}-${end} by governance rule: ${rule.name}`;
            if (rule.action === 'block') {
              return {
                allowed: false,
                reason: msg,
                rule,
                escalationRequired: rule.level === 'critical' || rule.level === 'high',
              };
            }
            return {
              allowed: true,
              reason: msg,
              rule,
              escalationRequired: true,
            };
          }
        }
      }
    }

    return { allowed: true, reason: 'No time restrictions apply', escalationRequired: false };
  }

  /**
   * Dependency boundary from governance rule conditions.
   * Supports:
   *   - dependency:<allowed1>,<allowed2>  blocks dependencies not in the list
   */
  private checkDependencyBoundary(context: GovernanceContext): GovernanceDecision {
    if (!context.targetDependency) {
      return { allowed: true, reason: 'No dependency change detected', escalationRequired: false };
    }

    for (const rule of this.dependencyRules) {
      if (!rule.conditions || rule.conditions.length === 0) continue;

      for (const condition of rule.conditions) {
        if (condition.startsWith('dependency:')) {
          const allowedList = condition
            .slice(11)
            .split(',')
            .map((d: string) => d.trim())
            .filter(Boolean);

          if (!allowedList.includes(context.targetDependency)) {
            const msg =
              `Dependency '${context.targetDependency}' is not in the allowed list ` +
              `[${allowedList.join(', ')}] for governance rule: ${rule.name}`;
            if (rule.action === 'block') {
              return {
                allowed: false,
                reason: msg,
                rule,
                escalationRequired: rule.level === 'critical' || rule.level === 'high',
              };
            }
            return {
              allowed: true,
              reason: msg,
              rule,
              escalationRequired: true,
            };
          }
        }
      }
    }

    return {
      allowed: true,
      reason: `Dependency '${context.targetDependency}' passed boundary check`,
      escalationRequired: false,
    };
  }

  /**
   * Scope escalation: if a boundary is violated but the agent has
   * architect-level or higher authority, allow with a warning.
   * Lower-authority agents are blocked.
   */
  private applyScopeEscalation(
    violationMsg: string,
    context: GovernanceContext,
  ): GovernanceDecision {
    const agentLevel = AUTHORITY_HIERARCHY[context.agentAuthority];
    if (agentLevel >= AUTHORITY_HIERARCHY.architect) {
      return {
        allowed: true,
        reason:
          `Boundary violated but scope-escalated: ${violationMsg}. ` +
          `Agent authority '${context.agentAuthority}' (level ${agentLevel}) overrides the restriction.`,
        escalationRequired: true,
      };
    }

    return {
      allowed: false,
      reason:
        `Boundary violation: ${violationMsg}. ` +
        `Agent authority '${context.agentAuthority}' (level ${agentLevel}) is insufficient to override.`,
      escalationRequired: true,
    };
  }

  // ----------------------------------------------------------
  // Glob Matching
  // ----------------------------------------------------------

  /**
   * Minimal glob pattern matcher.
   * - `*`  matches any characters except path separators
   * - `**` matches any characters including path separators
   * - `?`  matches exactly one character except path separators
   * - `.`  and other characters match literally
   */
  static matchesGlob(pattern: string, path: string): boolean {
    // Normalise separators to forward-slash for cross-platform matching
    const normalisedPattern = pattern.replace(/\\/g, '/');
    const normalisedPath = path.replace(/\\/g, '/');

    // Build a regex from the glob pattern — escape all regex-special characters first
    let regexStr = '';
    let i = 0;
    while (i < normalisedPattern.length) {
      const ch = normalisedPattern[i];
      if (ch === '*' && normalisedPattern[i + 1] === '*') {
        // ** — matches everything including /
        regexStr += '.*';
        i += 2;
        // Consume trailing /
        if (normalisedPattern[i] === '/') i += 1;
      } else if (ch === '*') {
        // * — matches anything except /
        regexStr += '[^/]*';
        i += 1;
      } else if (ch === '?') {
        regexStr += '[^/]';
        i += 1;
      } else {
        // Escape all regex-special characters for literal matching
        regexStr += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        i += 1;
      }
    }

    const regex = new RegExp(`^${regexStr}$`);
    return regex.test(normalisedPath);
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Obtém o próximo nível na cadeia de escalção
   */
  escalate(currentLevel: AuthorityLevelValue): AuthorityLevelValue | null {
    return this.escalationChain.get(currentLevel) ?? null;
  }

  /**
   * Lista todas as regras que se aplicam a um contexto
   */
  getApplicableRules(context: GovernanceContext): GovernanceRule[] {
    return this.getCandidateRules(context).filter((rule) => this.ruleApplies(rule, context));
  }

  /**
   * Resumo das regras de governança
   */
  summary(): string {
    const lines: string[] = [];
    lines.push(`Governance Rules: ${this.rules.length}`);
    const byLevel = new Map<string, number>();
    for (const rule of this.rules) {
      byLevel.set(rule.level, (byLevel.get(rule.level) ?? 0) + 1);
    }
    for (const [level, count] of byLevel) {
      lines.push(`  ${level}: ${count}`);
    }
    return lines.join('\n');
  }
}
