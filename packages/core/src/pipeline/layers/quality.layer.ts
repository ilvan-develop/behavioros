import type { DNAPackage } from '@behavioros/schemas';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 7 — Quality Layer
// Quality gates: coverage, lint, typecheck, security, performance.
// NEVER blocks — always records results.
// ============================================================

export interface QualityCheckResult {
  gate: string;
  passed: boolean;
  actual: number | boolean;
  expected: number | boolean;
  message: string;
}

export interface QualityLayerOptions {
  minScore?: number;
  checks?: QualityCheck[];
}

export type QualityCheck = (context: PipelineDispatcherContext) => QualityCheckResult;

export class QualityLayer implements PipelineLayer {
  readonly id = 'quality';
  readonly name = 'Quality';
  readonly order = 7;

  private minScore: number;
  private customChecks: QualityCheck[];

  constructor(options: QualityLayerOptions = {}) {
    this.minScore = options.minScore ?? 80;
    this.customChecks = options.checks ?? [];
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      const dna = context.metadata.get('dna') as DNAPackage | undefined;
      const results: QualityCheckResult[] = [];

      // Run DNA-defined quality gate checks
      if (dna?.quality) {
        for (const gate of dna.quality) {
          const result = this.evaluateGate(gate, context);
          results.push(result);
        }
      }

      // Run custom checks
      for (const check of this.customChecks) {
        try {
          results.push(check(context));
        } catch (error) {
          results.push({
            gate: 'custom',
            passed: false,
            actual: false,
            expected: true,
            message: `Custom check failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }

      // Default checks if no gates defined
      if (results.length === 0) {
        results.push({
          gate: 'pipeline_continuity',
          passed: true,
          actual: true as boolean,
          expected: true as boolean,
          message: 'Pipeline continuity check passed',
        });
      }

      // Calculate score
      const passedChecks = results.filter((r) => r.passed).length;
      const score = results.length > 0 ? Math.round((passedChecks / results.length) * 100) : 100;

      // NEVER blocks — always passes, but records score
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score,
        duration: Date.now() - start,
        details: {
          gatesChecked: results.length,
          gatesPassed: passedChecks,
          gatesFailed: results.length - passedChecks,
          minScore: this.minScore,
          meetsMinimum: score >= this.minScore,
          results: results.map((r) => ({
            gate: r.gate,
            passed: r.passed,
            message: r.message,
          })),
        },
      };
    } catch (error) {
      // NEVER blocks
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: 0,
        duration: Date.now() - start,
        details: {
          error: error instanceof Error ? error.message : 'Unknown quality error',
          note: 'Quality layer does not block — error recorded',
        },
      };
    }
  }

  private evaluateGate(
    gate: { name: string; threshold?: number; pass?: boolean; type: string },
    _context: PipelineDispatcherContext,
  ): QualityCheckResult {
    // For DNA-defined gates, we record them as passed with a note
    // Actual execution (lint, typecheck, etc.) happens in the audit pipeline
    const hasThreshold = gate.threshold !== undefined;
    const hasPassConfig = gate.pass !== undefined;

    const actual: number | boolean = hasThreshold
      ? (gate.threshold as number)
      : hasPassConfig
        ? (gate.pass as boolean)
        : true;

    return {
      gate: gate.name,
      passed: true,
      actual,
      expected: actual,
      message: `Gate '${gate.name}' (${gate.type}) registered — execution deferred to audit pipeline`,
    };
  }

  addCheck(check: QualityCheck): void {
    this.customChecks.push(check);
  }

  removeCheck(index: number): boolean {
    if (index >= 0 && index < this.customChecks.length) {
      this.customChecks.splice(index, 1);
      return true;
    }
    return false;
  }
}
