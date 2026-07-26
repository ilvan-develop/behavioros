import { CoverageEngine } from '../../engines/coverage-engine';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer — Coverage Gate
// Runs BEFORE execution and blocks if context coverage < threshold.
// ============================================================

export class CoverageGateLayer implements PipelineLayer {
  readonly id = 'coverage-gate';
  readonly name = 'Context Coverage Gate';
  readonly order = -1;

  private engine: CoverageEngine;

  constructor(threshold?: number) {
    this.engine = new CoverageEngine({ threshold });
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    const projectPath = (context.metadata.get('projectPath') as string) || process.cwd();

    try {
      const report = await this.engine.calculate(projectPath);
      const { passed, missing } = this.engine.checkThreshold(report);

      return {
        layerId: this.id,
        layerName: this.name,
        passed,
        score: report.overallPercentage,
        duration: Date.now() - start,
        details: {
          overallPercentage: report.overallPercentage,
          totalFound: report.totalFound,
          totalExpected: report.totalExpected,
          dimensions: report.dimensions.map((d) => ({
            name: d.name,
            percentage: d.percentage,
            missing: d.missing,
          })),
          missing,
          blocked: !passed,
          reason: passed
            ? `Context coverage ${report.overallPercentage}% meets threshold`
            : `Context coverage ${report.overallPercentage}% below threshold — blocking execution`,
        },
      };
    } catch (error) {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: false,
        score: 0,
        duration: Date.now() - start,
        details: {
          blocked: true,
          error: error instanceof Error ? error.message : 'Unknown coverage error',
          reason: 'Coverage gate failed to execute — blocking by default',
        },
      };
    }
  }
}
