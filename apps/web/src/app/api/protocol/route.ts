import { NextResponse } from 'next/server';
import { getBehaviorOS } from '@/lib/bos';
import type { EnforcementLevel, ProtocolStep, ProtocolViolation } from '@/types';

export const dynamic = 'force-dynamic';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const defaultSteps: ProtocolStep[] = [
  {
    id: 1,
    name: 'Select DNA',
    tool: 'bos_select_dna',
    enforced: true,
    enforcementLevel: 'critical',
  },
  {
    id: 2,
    name: 'Display DNA Block',
    tool: 'visual template',
    enforced: true,
    enforcementLevel: 'high',
  },
  {
    id: 3,
    name: 'Resolve Truth',
    tool: 'bos_resolve_truth',
    enforced: true,
    enforcementLevel: 'critical',
  },
  {
    id: 4,
    name: 'Create Mission',
    tool: 'create-mission',
    enforced: true,
    enforcementLevel: 'high',
  },
  { id: 5, name: 'Delegate', tool: 'Task tool', enforced: true, enforcementLevel: 'critical' },
  { id: 6, name: 'Run Audit', tool: 'bos_run_audit', enforced: true, enforcementLevel: 'critical' },
  {
    id: 7,
    name: 'Record Learning',
    tool: 'record-learning',
    enforced: false,
    enforcementLevel: 'medium',
  },
];

const seedViolations: ProtocolViolation[] = [
  {
    id: 'viol-001',
    timestamp: hoursAgo(1),
    step: 'Select DNA',
    message: 'Agent attempted to edit files without calling bos_select_dna first',
    severity: 'critical',
  },
  {
    id: 'viol-002',
    timestamp: hoursAgo(3),
    step: 'Delegate',
    message: 'Orchestrator attempted to edit files directly instead of delegating',
    severity: 'critical',
  },
  {
    id: 'viol-003',
    timestamp: hoursAgo(6),
    step: 'Run Audit',
    message: 'Mission completed without running bos_run_audit',
    severity: 'high',
  },
  {
    id: 'viol-004',
    timestamp: hoursAgo(12),
    step: 'Resolve Truth',
    message: 'Delegation proceeded without resolving truth sources first',
    severity: 'high',
  },
  {
    id: 'viol-005',
    timestamp: hoursAgo(24),
    step: 'Record Learning',
    message: 'Learning event not recorded after mission completion (warning)',
    severity: 'medium',
  },
  {
    id: 'viol-006',
    timestamp: hoursAgo(48),
    step: 'Create Mission',
    message: 'Work started without a mission ID',
    severity: 'high',
  },
];

export async function GET() {
  try {
    const bos = getBehaviorOS();
    const status = bos.getStatus();

    // Determine enforcement level from SDK config
    let enforcementLevel: EnforcementLevel = 'standard';
    try {
      const state = bos.getPipelineState();
      if (state) {
        enforcementLevel = 'strict';
      }
    } catch {
      // fallback to standard
    }

    return NextResponse.json({
      enforcementLevel,
      dnaLoaded: !!status.dna,
      dnaName: status.dna,
      steps: defaultSteps,
      violations: seedViolations,
      totalViolations: seedViolations.length,
    });
  } catch (error) {
    console.error('GET /api/protocol error:', error);
    return NextResponse.json({
      enforcementLevel: 'standard' as EnforcementLevel,
      dnaLoaded: false,
      steps: defaultSteps,
      violations: seedViolations,
      totalViolations: seedViolations.length,
    });
  }
}
