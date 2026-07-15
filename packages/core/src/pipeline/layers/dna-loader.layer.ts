import type { DNAPackage } from '@behavioros/schemas';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 1 — DNA Loader
// Validates DNA package exists, is well-formed, and loads metadata.
// Structural layer: fails fast on invalid DNA.
// ============================================================

export interface DNALoaderLayerOptions {
  dnaPath?: string;
  dnaPackage?: DNAPackage;
}

export class DNALoaderLayer implements PipelineLayer {
  readonly id = 'dna';
  readonly name = 'DNA Loader';
  readonly order = 1;

  private dnaPackage: DNAPackage | undefined;

  constructor(private options: DNALoaderLayerOptions = {}) {
    this.dnaPackage = options.dnaPackage;
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      const dna = this.dnaPackage;

      if (!dna) {
        return this.fail('No DNA package provided or loaded', start);
      }

      // Validate required fields
      if (!dna.id || !dna.name || !dna.version) {
        return this.fail(
          `DNA package missing required fields: ${[
            !dna.id && 'id',
            !dna.name && 'name',
            !dna.version && 'version',
          ]
            .filter(Boolean)
            .join(', ')}`,
          start,
        );
      }

      // Validate personas exist
      if (!dna.personas || dna.personas.length === 0) {
        return this.fail('DNA package must define at least one persona', start);
      }

      // Store DNA in context metadata for downstream layers
      context.metadata.set('dna', dna);
      context.metadata.set('dnaId', dna.id);

      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: 100,
        duration: Date.now() - start,
        details: {
          dnaId: dna.id,
          dnaName: dna.name,
          version: dna.version,
          personasCount: dna.personas.length,
          governanceCount: dna.governance?.length ?? 0,
          qualityGatesCount: dna.quality?.length ?? 0,
          patternsCount: dna.patterns?.length ?? 0,
          workflowsCount: dna.workflows?.length ?? 0,
        },
      };
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : 'Unknown error in DNA loader',
        start,
      );
    }
  }

  private fail(error: string, start: number): DispatcherLayerResult {
    return {
      layerId: this.id,
      layerName: this.name,
      passed: false,
      score: 0,
      duration: Date.now() - start,
      details: {},
      error,
    };
  }

  getDNA(): DNAPackage | undefined {
    return this.dnaPackage;
  }

  setDNA(dna: DNAPackage): void {
    this.dnaPackage = dna;
  }
}
