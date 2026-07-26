import type { GovernanceContext } from './governance-engine';
import { GovernanceEngine } from './governance-engine';

/**
 * GateLevel — Union type: block, warn, log;.
 */
export type GateLevel = 'block' | 'warn' | 'log';

/**
 * GateStage — Union type: boundary, authority, policy, risk, compliance;.
 */
export type GateStage = 'boundary' | 'authority' | 'policy' | 'risk' | 'compliance';

/**
 * GateResult — Configuration and options interface.
 */
export interface GateResult {
  stage: GateStage;
  passed: boolean;
  level: GateLevel;
  message: string;
  details?: Record<string, unknown>;
  duration: number;
}

/**
 * GateReport — Configuration and options interface.
 */
export interface GateReport {
  pipelineId: string;
  results: GateResult[];
  passed: boolean;
  blocked: boolean;
  timestamp: string;
}

const STAGE_ORDER: GateStage[] = ['boundary', 'authority', 'policy', 'risk', 'compliance'];

const DEFAULT_LEVELS: Record<GateStage, GateLevel> = {
  boundary: 'block',
  authority: 'block',
  policy: 'warn',
  risk: 'warn',
  compliance: 'log',
};

const RISK_WEIGHTS: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10,
};

let pipelineCounter = 0;

function nextPipelineId(): string {
  pipelineCounter += 1;
  return `gate-${pipelineCounter}-${Date.now()}`;
}

/**
 * GovernanceGate — governance gate.
 *
 * Methods: setStageLevel, evaluate, getHistory, reset.
 */
export class GovernanceGate {
  private stageLevels: Map<GateStage, GateLevel>;
  private history: GateReport[] = [];

  constructor(defaultLevel?: GateLevel) {
    this.stageLevels = new Map();
    if (defaultLevel) {
      for (const stage of STAGE_ORDER) {
        this.stageLevels.set(stage, defaultLevel);
      }
    }
  }

  setStageLevel(stage: GateStage, level: GateLevel): void {
    this.stageLevels.set(stage, level);
  }

  private getLevel(stage: GateStage): GateLevel {
    return this.stageLevels.get(stage) ?? DEFAULT_LEVELS[stage];
  }

  async evaluate(context: Record<string, unknown>): Promise<GateReport> {
    const pipelineId = nextPipelineId();
    const results: GateResult[] = [];
    let blocked = false;

    const engine = context._governanceEngine
      ? (context._governanceEngine as GovernanceEngine)
      : new GovernanceEngine([]);
    const ctx = context as unknown as GovernanceContext;

    for (const stage of STAGE_ORDER) {
      const level = this.getLevel(stage);
      const start = performance.now();

      if (blocked) {
        const duration = performance.now() - start;
        results.push({
          stage,
          passed: false,
          level,
          message: 'Skipped — previous block-level stage failed',
          duration: Math.round(duration * 100) / 100,
        });
        continue;
      }

      const result = await this.runStage(stage, ctx, engine, level, start);
      results.push(result);

      if (!result.passed && level === 'block') {
        blocked = true;
      }
    }

    const report: GateReport = {
      pipelineId,
      results,
      passed: results.every((r) => r.passed),
      blocked: results.some((r) => !r.passed && r.level === 'block'),
      timestamp: new Date().toISOString(),
    };

    this.history.push(report);
    return report;
  }

  private runStage(
    stage: GateStage,
    ctx: GovernanceContext,
    engine: GovernanceEngine,
    level: GateLevel,
    start: number,
  ): GateResult {
    try {
      switch (stage) {
        case 'boundary': {
          const boundaryCtx: GovernanceContext = {
            ...ctx,
            impact: 'low',
            boundaries: ctx.boundaries ?? [],
          };
          const result = engine.evaluate(boundaryCtx);
          return {
            stage,
            passed: result.allowed,
            level,
            message: result.reason,
            details: { boundaryCount: ctx.boundaries?.length ?? 0 },
            duration: Math.round((performance.now() - start) * 100) / 100,
          };
        }

        case 'authority': {
          const authorityCtx: GovernanceContext = {
            ...ctx,
            boundaries: [],
          };
          const result = engine.evaluate(authorityCtx);
          return {
            stage,
            passed: result.allowed,
            level,
            message: result.reason,
            details: {
              agentAuthority: ctx.agentAuthority,
              escalationRequired: result.escalationRequired,
            },
            duration: Math.round((performance.now() - start) * 100) / 100,
          };
        }

        case 'policy': {
          const policyCtx: GovernanceContext = {
            ...ctx,
            boundaries: [],
          };
          const result = engine.evaluate(policyCtx);
          return {
            stage,
            passed: result.allowed,
            level,
            message: result.reason,
            details: result.rule ? { ruleName: result.rule.name } : undefined,
            duration: Math.round((performance.now() - start) * 100) / 100,
          };
        }

        case 'risk': {
          const impact = (ctx.impact as string) ?? 'low';
          const weight = RISK_WEIGHTS[impact] ?? 1;
          const threshold = (ctx as unknown as Record<string, unknown>).riskThreshold as
            | number
            | undefined;
          const passed = weight <= (threshold ?? 7);
          return {
            stage,
            passed,
            level,
            message: passed
              ? `Risk level '${impact}' (weight ${weight}) within threshold ${threshold ?? 7}`
              : `Risk level '${impact}' (weight ${weight}) exceeds threshold ${threshold ?? 7}`,
            details: { impact, weight, threshold: threshold ?? 7 },
            duration: Math.round((performance.now() - start) * 100) / 100,
          };
        }

        case 'compliance': {
          const contextAny = ctx as unknown as Record<string, unknown>;
          const policyIds = (contextAny.compliancePolicies as string[]) ?? [];
          const requiredPolicies = (contextAny.requiredCompliancePolicies as string[]) ?? [];
          const missing = requiredPolicies.filter((p) => !policyIds.includes(p));
          const passed = missing.length === 0;
          return {
            stage,
            passed,
            level,
            message: passed
              ? `All ${requiredPolicies.length} compliance policies satisfied`
              : `Missing compliance policies: ${missing.join(', ')}`,
            details: { policyCount: policyIds.length, missing },
            duration: Math.round((performance.now() - start) * 100) / 100,
          };
        }

        default:
          return {
            stage,
            passed: false,
            level,
            message: `Unknown stage: ${stage}`,
            duration: 0,
          };
      }
    } catch (error) {
      return {
        stage,
        passed: false,
        level,
        message: `Error: ${(error as Error).message}`,
        duration: Math.round((performance.now() - start) * 100) / 100,
      };
    }
  }

  getHistory(pipelineId?: string): GateReport[] {
    if (pipelineId) {
      return this.history.filter((r) => r.pipelineId === pipelineId);
    }
    return [...this.history];
  }

  reset(): void {
    this.history = [];
    this.stageLevels.clear();
  }
}
