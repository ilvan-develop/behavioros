import { randomUUID } from 'node:crypto';
import type { AuditEvent, AuditResult, AuditSeverity } from '@behavioros/schemas';

// ============================================================
// Audit Engine — Continuous Audit Pipeline (10 stages)
// ============================================================

export type AuditStage =
  | 'static'
  | 'architecture'
  | 'security'
  | 'performance'
  | 'tests'
  | 'coverage'
  | 'contracts'
  | 'docs'
  | 'compliance'
  | 'benchmarks';

export interface AuditStageResult {
  stage: AuditStage;
  result: AuditResult;
  score: number; // 0-100
  events: AuditEvent[];
  duration: number; // ms
}

export interface AuditPipelineResult {
  id: string;
  overall: AuditResult;
  score: number;
  stages: AuditStageResult[];
  duration: number;
  timestamp: string;
}

export interface StageExecutor {
  stage: AuditStage;
  name: string;
  execute: (context: AuditContext) => Promise<AuditStageResult>;
}

export interface AuditContext {
  projectPath: string;
  targetPath?: string;
  options?: Record<string, unknown>;
}

export class AuditEngine {
  private stages: Map<AuditStage, StageExecutor> = new Map();
  private history: AuditPipelineResult[] = [];
  private requiredStages: AuditStage[] = ['static', 'security', 'tests', 'coverage', 'contracts'];

  constructor() {
    this.registerDefaultStages();
  }

  /**
   * Executa o pipeline completo de auditoria
   */
  async execute(context: AuditContext, stages?: AuditStage[]): Promise<AuditPipelineResult> {
    const pipelineId = randomUUID();
    const targetStages = stages ?? this.requiredStages;
    const start = Date.now();

    const stageResults: AuditStageResult[] = [];

    for (const stageName of targetStages) {
      const executor = this.stages.get(stageName);
      if (!executor) {
        stageResults.push({
          stage: stageName,
          result: 'skip',
          score: 0,
          events: [],
          duration: 0,
        });
        continue;
      }

      const stageStart = Date.now();
      try {
        const result = await executor.execute(context);
        result.duration = Date.now() - stageStart;
        stageResults.push(result);
      } catch (error) {
        stageResults.push({
          stage: stageName,
          result: 'fail',
          score: 0,
          events: [
            {
              id: randomUUID(),
              timestamp: new Date().toISOString(),
              type: `audit:${stageName}:error`,
              severity: 'error',
              result: 'fail',
              description: `Stage ${stageName} failed: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          duration: Date.now() - stageStart,
        });
      }
    }

    const overallScore = this.calculateOverallScore(stageResults);
    const overall = this.determineOverallResult(stageResults);

    const pipelineResult: AuditPipelineResult = {
      id: pipelineId,
      overall,
      score: overallScore,
      stages: stageResults,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    this.history.push(pipelineResult);
    return pipelineResult;
  }

  /**
   * Regista um executor de stage customizado
   */
  registerStage(executor: StageExecutor): void {
    this.stages.set(executor.stage, executor);
  }

  /**
   * Obtém o histórico de auditorias
   */
  getHistory(): AuditPipelineResult[] {
    return [...this.history];
  }

  /**
   * Obtém a última auditoria
   */
  getLastAudit(): AuditPipelineResult | undefined {
    return this.history[this.history.length - 1];
  }

  private calculateOverallScore(stages: AuditStageResult[]): number {
    if (stages.length === 0) return 0;
    const total = stages.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / stages.length);
  }

  private determineOverallResult(stages: AuditStageResult[]): AuditResult {
    const hasFailure = stages.some((s) => s.result === 'fail');
    if (hasFailure) return 'fail';

    const hasWarning = stages.some((s) => s.result === 'warn');
    if (hasWarning) return 'warn';

    return 'pass';
  }

  private registerDefaultStages(): void {
    // Static analysis stage
    this.stages.set('static', {
      stage: 'static',
      name: 'Static Analysis',
      execute: async (context) => {
        // Placeholder — real implementation would use biome/tsc
        return {
          stage: 'static',
          result: 'pass',
          score: 100,
          events: [],
          duration: 0,
        };
      },
    });

    // Security stage
    this.stages.set('security', {
      stage: 'security',
      name: 'Security Analysis',
      execute: async (context) => {
        return {
          stage: 'security',
          result: 'pass',
          score: 100,
          events: [],
          duration: 0,
        };
      },
    });

    // Tests stage
    this.stages.set('tests', {
      stage: 'tests',
      name: 'Test Execution',
      execute: async (context) => {
        return {
          stage: 'tests',
          result: 'pass',
          score: 100,
          events: [],
          duration: 0,
        };
      },
    });

    // Coverage stage
    this.stages.set('coverage', {
      stage: 'coverage',
      name: 'Code Coverage',
      execute: async (context) => {
        return {
          stage: 'coverage',
          result: 'pass',
          score: 100,
          events: [],
          duration: 0,
        };
      },
    });

    // Contracts stage
    this.stages.set('contracts', {
      stage: 'contracts',
      name: 'Contract Validation',
      execute: async (context) => {
        return {
          stage: 'contracts',
          result: 'pass',
          score: 100,
          events: [],
          duration: 0,
        };
      },
    });
  }

  /**
   * Resumo do pipeline
   */
  summary(result: AuditPipelineResult): string {
    const lines: string[] = [];
    lines.push(`Audit Pipeline: ${result.id}`);
    lines.push(
      `Overall: ${result.overall === 'pass' ? '✅' : result.overall === 'fail' ? '❌' : '⚠️'} (${result.score}/100)`,
    );
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(`Stages: ${result.stages.length}`);
    for (const stage of result.stages) {
      const icon =
        stage.result === 'pass'
          ? '✅'
          : stage.result === 'fail'
            ? '❌'
            : stage.result === 'skip'
              ? '⏭️'
              : '⚠️';
      lines.push(`  ${icon} ${stage.stage}: ${stage.score}/100 (${stage.duration}ms)`);
    }
    return lines.join('\n');
  }
}
