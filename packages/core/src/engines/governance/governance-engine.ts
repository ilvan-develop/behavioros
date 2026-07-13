import type { GovernanceRule, AuthorityLevel, AgentPersona } from '@behavioros/schemas'

// ============================================================
// Governance Engine — Authority, Boundaries, Policies, Escalation
// ============================================================

export type AuthorityLevelValue = 'junior' | 'senior' | 'architect' | 'lead' | 'director' | 'vp' | 'c-level'

export interface GovernanceContext {
  agentId: string
  agentRole: string
  agentAuthority: AuthorityLevelValue
  action: string
  targetType: 'file' | 'module' | 'service' | 'config' | 'infrastructure' | 'database'
  targetScope?: string
  impact: 'low' | 'medium' | 'high' | 'critical'
  metadata?: Record<string, unknown>
}

export interface GovernanceDecision {
  allowed: boolean
  reason: string
  rule?: GovernanceRule
  escalationRequired: boolean
  requiredAuthority?: AuthorityLevelValue
}

const AUTHORITY_HIERARCHY: Record<AuthorityLevelValue, number> = {
  junior: 1,
  senior: 2,
  architect: 3,
  lead: 4,
  director: 5,
  vp: 6,
  'c-level': 7,
}

export class GovernanceEngine {
  private rules: GovernanceRule[]
  private escalationChain: Map<AuthorityLevelValue, AuthorityLevelValue> = new Map([
    ['junior', 'senior'],
    ['senior', 'architect'],
    ['architect', 'lead'],
    ['lead', 'director'],
    ['director', 'vp'],
    ['vp', 'c-level'],
  ])

  constructor(rules: GovernanceRule[]) {
    this.rules = rules
  }

  /**
   * Avalia se um agente pode executar uma ação
   */
  evaluate(context: GovernanceContext): GovernanceDecision {
    // 1. Check authority level
    const authorityCheck = this.checkAuthority(context)
    if (!authorityCheck.allowed) {
      return authorityCheck
    }

    // 2. Check governance rules
    const ruleCheck = this.checkRules(context)
    if (!ruleCheck.allowed) {
      return ruleCheck
    }

    // 3. Check boundaries
    const boundaryCheck = this.checkBoundaries(context)
    if (!boundaryCheck.allowed) {
      return boundaryCheck
    }

    return { allowed: true, reason: 'All governance checks passed', escalationRequired: false }
  }

  private checkAuthority(context: GovernanceContext): GovernanceDecision {
    const agentLevel = AUTHORITY_HIERARCHY[context.agentAuthority]
    const requiredLevel = this.getRequiredAuthority(context)

    if (agentLevel < requiredLevel) {
      const requiredRole = Object.entries(AUTHORITY_HIERARCHY).find(([, v]) => v === requiredLevel)?.[0]
      return {
        allowed: false,
        reason: `Authority level ${context.agentAuthority} (level ${agentLevel}) is insufficient. Required: ${requiredRole} (level ${requiredLevel})`,
        escalationRequired: true,
        requiredAuthority: requiredRole as AuthorityLevelValue,
      }
    }

    return { allowed: true, reason: 'Authority check passed', escalationRequired: false }
  }

  private getRequiredAuthority(context: GovernanceContext): number {
    const impactMap: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    }
    return impactMap[context.impact] ?? 1
  }

  private checkRules(context: GovernanceContext): GovernanceDecision {
    for (const rule of this.rules) {
      if (this.ruleApplies(rule, context)) {
        if (rule.action === 'block') {
          return {
            allowed: false,
            reason: `Blocked by governance rule: ${rule.name}`,
            rule,
            escalationRequired: rule.level === 'critical' || rule.level === 'high',
          }
        }
        if (rule.action === 'require_approval') {
          return {
            allowed: false,
            reason: `Approval required by governance rule: ${rule.name}`,
            rule,
            escalationRequired: true,
          }
        }
        if (rule.action === 'escalate') {
          return {
            allowed: true,
            reason: `Escalated by governance rule: ${rule.name}`,
            rule,
            escalationRequired: true,
          }
        }
      }
    }
    return { allowed: true, reason: 'No governance rules blocked action', escalationRequired: false }
  }

  private ruleApplies(rule: GovernanceRule, context: GovernanceContext): boolean {
    // Check scope
    if (rule.scope && rule.scope.length > 0) {
      if (!rule.scope.includes(context.targetType) && !rule.scope.includes(context.action)) {
        return false
      }
    }

    // Check conditions
    if (rule.conditions && rule.conditions.length > 0) {
      for (const condition of rule.conditions) {
        if (condition.includes(context.impact) || condition.includes(context.targetType)) {
          return true
        }
      }
      return false
    }

    return true
  }

  private checkBoundaries(context: GovernanceContext): GovernanceDecision {
    // This would check agent-specific boundaries
    // For now, return allowed
    return { allowed: true, reason: 'Boundary check passed', escalationRequired: false }
  }

  /**
   * Obtém o próximo nível na cadeia de escalção
   */
  escalate(currentLevel: AuthorityLevelValue): AuthorityLevelValue | null {
    return this.escalationChain.get(currentLevel) ?? null
  }

  /**
   * Lista todas as regras que se aplicam a um contexto
   */
  getApplicableRules(context: GovernanceContext): GovernanceRule[] {
    return this.rules.filter((rule) => this.ruleApplies(rule, context))
  }

  /**
   * Resumo das regras de governança
   */
  summary(): string {
    const lines: string[] = []
    lines.push(`Governance Rules: ${this.rules.length}`)
    const byLevel = new Map<string, number>()
    for (const rule of this.rules) {
      byLevel.set(rule.level, (byLevel.get(rule.level) ?? 0) + 1)
    }
    for (const [level, count] of byLevel) {
      lines.push(`  ${level}: ${count}`)
    }
    return lines.join('\n')
  }
}
