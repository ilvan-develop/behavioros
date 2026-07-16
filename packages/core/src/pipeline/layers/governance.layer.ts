import type { DNAPackage, GovernanceRule } from '@behavioros/schemas';
import {
  type AuthorityLevelValue,
  GovernanceEngine,
} from '../../engines/governance/governance-engine';
import { Logger } from '../../shared/logger';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 5 — Governance Layer
// Evaluates governance rules: block/escalate/warn/log.
// Can block execution on critical violations.
// ============================================================

export interface GovernanceLayerOptions {
  governanceEngine?: GovernanceEngine;
  strict?: boolean;
}

export class GovernanceLayer implements PipelineLayer {
  readonly id = 'governance';
  readonly name = 'Governance';
  readonly order = 5;

  private engine: GovernanceEngine | undefined;
  private strict: boolean;
  private bypassAttempts = new Map<string, number>();
  private logger = new Logger('governance');

  constructor(options: GovernanceLayerOptions = {}) {
    this.strict = options.strict ?? false;
    if (options.governanceEngine) {
      this.engine = options.governanceEngine;
    }
  }

  private recordBypass(agentId: string, reason: string) {
    const count = (this.bypassAttempts.get(agentId) || 0) + 1;
    this.bypassAttempts.set(agentId, count);
    if (count > 3) {
      this.logger.error(`Agent ${agentId} has ${count} governance bypass attempts`, {
        agentId,
        bypassCount: count,
        reason,
        severity: 'security',
      });
    }
  }

  private getBypassCount(agentId: string): number {
    return this.bypassAttempts.get(agentId) || 0;
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      // Initialize engine from DNA if not provided externally
      if (!this.engine) {
        const dna = context.metadata.get('dna') as DNAPackage | undefined;
        if (dna?.governance) {
          this.engine = new GovernanceEngine(dna.governance);
        } else {
          // No governance rules — auto-pass with warning
          return {
            layerId: this.id,
            layerName: this.name,
            passed: true,
            score: 70,
            duration: Date.now() - start,
            details: {
              skipped: true,
              reason: 'No governance rules defined',
            },
          };
        }
      }

      const decisions: Array<{
        rule: string;
        action: string;
        allowed: boolean;
        reason: string;
      }> = [];

      // Authority verification: warn if not verified against signed token
      if (!context.verifiedAuthority) {
        decisions.push({
          rule: 'authority-verification',
          action: 'warn',
          allowed: true,
          reason: `Authority for agent '${context.agentId}' is self-declared (not verified against signed token)`,
        });
      }

      // Validate agent authority is in the known authority list
      const knownAuthorities: AuthorityLevelValue[] = [
        'junior',
        'senior',
        'architect',
        'lead',
        'director',
        'vp',
        'c-level',
      ];
      if (!knownAuthorities.includes(context.agentAuthority as AuthorityLevelValue)) {
        return {
          layerId: this.id,
          layerName: this.name,
          passed: this.strict ? false : true,
          score: 0,
          duration: Date.now() - start,
          details: {
            rulesEvaluated: 0,
            rulesMatched: 0,
            blocked: true,
            escalationRequired: false,
            decisions: [],
          },
          error: `Rejected: unknown authority level '${context.agentAuthority}'`,
        };
      }

      let blocked = false;
      let escalationRequired = false;
      let blockReason = '';

      // Evaluate against all applicable rules
      const rules = (this.engine as unknown as { rules: GovernanceRule[] }).rules ?? [];

      for (const rule of rules) {
        const matches = this.ruleApplies(rule, context);

        if (matches) {
          let allowed = true;
          let reason = '';

          switch (rule.action) {
            case 'block':
              allowed = false;
              reason = `Blocked by governance rule: ${rule.name} (${rule.level})`;
              blocked = true;
              blockReason = reason;
              break;
            case 'escalate':
              allowed = true;
              escalationRequired = true;
              reason = `Escalated by governance rule: ${rule.name} (${rule.level})`;
              break;
            case 'warn':
              allowed = true;
              reason = `Warning from governance rule: ${rule.name} (${rule.level})`;
              break;
            case 'log':
              allowed = true;
              reason = `Logged by governance rule: ${rule.name} (${rule.level})`;
              break;
            default:
              allowed = true;
              reason = `Rule ${rule.name}: action '${rule.action}' not handled, allowing`;
              break;
          }

          decisions.push({
            rule: rule.id,
            action: rule.action,
            allowed,
            reason,
          });
        }
      }

      if (escalationRequired) {
        const agentId = (context.metadata.get('agentId') as string) || 'unknown';
        this.recordBypass(agentId, `Escalation triggered by governance rules`);
      }

      const passed = this.strict ? !blocked : true;
      const score = blocked ? 0 : escalationRequired ? 60 : decisions.length === 0 ? 70 : 100;

      return {
        layerId: this.id,
        layerName: this.name,
        passed,
        score,
        duration: Date.now() - start,
        details: {
          rulesEvaluated: rules.length,
          rulesMatched: decisions.length,
          blocked,
          escalationRequired,
          decisions,
          bypassAttempts: escalationRequired
            ? this.getBypassCount((context.metadata.get('agentId') as string) || 'unknown')
            : 0,
        },
        error: passed ? undefined : blockReason,
      };
    } catch (error) {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: false,
        score: 0,
        duration: Date.now() - start,
        details: {},
        error: error instanceof Error ? error.message : 'Unknown governance error',
      };
    }
  }

  private ruleApplies(rule: GovernanceRule, context: PipelineDispatcherContext): boolean {
    // Check scope
    if (rule.scope && rule.scope.length > 0) {
      const matchesScope = rule.scope.some(
        (s: string) => context.action.includes(s) || context.payload?.[s] !== undefined,
      );
      if (!matchesScope) return false;
    }

    // Check conditions
    if (rule.conditions && rule.conditions.length > 0) {
      return rule.conditions.some(
        (c: string) =>
          context.action.includes(c) ||
          context.payload?.[c] !== undefined ||
          context.metadata.has(c),
      );
    }

    // No conditions = applies to all
    return true;
  }

  setEngine(engine: GovernanceEngine): void {
    this.engine = engine;
  }

  getEngine(): GovernanceEngine | undefined {
    return this.engine;
  }
}
