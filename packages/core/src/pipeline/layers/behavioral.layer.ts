import type { DNAPackage } from '@behavioros/schemas';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 3 — Behavioral Layer
// Validates behavioral rules from DNA: agent permissions,
// persona boundaries, and role-based access.
// Structural layer: fails fast if agent is not authorized.
// ============================================================

export class BehavioralLayer implements PipelineLayer {
  readonly id = 'behavioral';
  readonly name = 'Behavioral';
  readonly order = 3;

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      const dna = context.metadata.get('dna') as DNAPackage | undefined;
      if (!dna) {
        return this.fail('DNA package not found in context (Layer 1 must run first)', start);
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      const details: Record<string, unknown> = {};

      // 1. Find matching persona for the agent
      const agentRole = context.agentId.split('-')[0] ?? 'engineer';
      const matchingPersona = dna.personas.find(
        (p) => p.role === agentRole || p.role === context.agentId,
      );

      if (!matchingPersona) {
        // Try to match by agent ID pattern (e.g., "orchestrator-agent" -> "orchestrator")
        const fallbackPersona = dna.personas.find(
          (p) =>
            context.agentId.includes(p.role) ||
            (typeof p.name === 'string' && context.agentId.includes(p.name.toLowerCase())),
        );

        if (!fallbackPersona) {
          warnings.push(`No persona found for agent '${context.agentId}' with role '${agentRole}'`);
        }
      }

      const persona = matchingPersona ?? dna.personas[0];
      details.personaRole = persona.role;
      details.personaAuthority = persona.authority;

      // 2. Validate agent authority against action
      const authorityMap: Record<string, number> = {
        junior: 1,
        senior: 2,
        architect: 3,
        lead: 4,
        director: 5,
        vp: 6,
        'c-level': 7,
      };

      const agentAuthorityLevel = authorityMap[persona.authority] ?? 1;
      const actionSeverity = this.getActionSeverity(context.action);

      if (agentAuthorityLevel < actionSeverity) {
        errors.push(
          `Agent authority '${persona.authority}' (level ${agentAuthorityLevel}) ` +
            `is insufficient for action '${context.action}' (requires level ${actionSeverity})`,
        );
      }

      // 3. Check persona boundaries
      if (persona.boundaries && persona.boundaries.length > 0) {
        for (const boundary of persona.boundaries) {
          if (boundary.type === 'forbidden') {
            const forbiddenAction = String(boundary.value);
            if (context.action.includes(forbiddenAction)) {
              errors.push(
                `Action '${context.action}' matches forbidden boundary '${boundary.name}'`,
              );
            }
          }
        }
      }

      // 4. Validate DNA has required behavioral config
      if (!dna.governance || dna.governance.length === 0) {
        warnings.push('DNA package has no governance rules defined');
      }

      if (!dna.quality || dna.quality.length === 0) {
        warnings.push('DNA package has no quality gates defined');
      }

      const passed = errors.length === 0;
      const score = passed ? (warnings.length === 0 ? 100 : 80) : 0;

      return {
        layerId: this.id,
        layerName: this.name,
        passed,
        score,
        duration: Date.now() - start,
        details: {
          ...details,
          errors,
          warnings,
          boundariesChecked: persona.boundaries?.length ?? 0,
        },
        error: passed ? undefined : `Behavioral validation failed: ${errors.join('; ')}`,
      };
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : 'Unknown behavioral validation error',
        start,
      );
    }
  }

  private getActionSeverity(action: string): number {
    if (action.includes('deploy') || action.includes('production')) return 4;
    if (action.includes('delete') || action.includes('remove')) return 3;
    if (action.includes('update') || action.includes('modify')) return 2;
    return 1;
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
}
