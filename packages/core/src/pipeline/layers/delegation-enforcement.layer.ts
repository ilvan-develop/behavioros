import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

/**
 * DelegationEnforcementLayer — Blocks orchestrator from executing work directly.
 *
 * Verifies that orchestrator delegated via Task tool before processing.
 * Checks for missionId, dnaPattern, and delegatedTo in context metadata.
 */
export class DelegationEnforcementLayer implements PipelineLayer {
  readonly id = 'delegation-enforcement';
  readonly name = 'Delegation Enforcement';
  readonly order = 0;

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    const agentRole = context.agentId.split('-')[0];
    if (agentRole !== 'orchestrator') {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: 100,
        duration: Date.now() - start,
        details: { skipped: true, reason: 'Not an orchestrator agent' },
      };
    }

    const hasMission = context.metadata.get('missionId') !== undefined;
    const hasDNA = context.metadata.get('dnaPattern') !== undefined;
    const hasDelegation = context.metadata.get('delegatedTo') !== undefined;

    if (!hasMission || !hasDNA || !hasDelegation) {
      return {
        layerId: this.id,
        layerName: this.name,
        passed: false,
        score: 0,
        duration: Date.now() - start,
        details: {
          blocked: true,
          reason: 'Orchestrator attempted direct execution without delegation',
          missing: {
            missionId: !hasMission,
            dnaPattern: !hasDNA,
            delegatedTo: !hasDelegation,
          },
          requiredActions: [
            'Run bos_select_dna to select DNA pattern',
            'Run bos_resolve_truth to get truth sources',
            'Create mission via create-mission',
            'Delegate via Task tool to appropriate subagent',
          ],
        },
      };
    }

    return {
      layerId: this.id,
      layerName: this.name,
      passed: true,
      score: 100,
      duration: Date.now() - start,
      details: { delegationVerified: true },
    };
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }
}
