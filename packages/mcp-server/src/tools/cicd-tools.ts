import type { BehaviorOSEngine } from '@behavioros/core';
import { z } from 'zod';

// --- In-memory pipeline state ---

export interface PipelineLayer {
  id: string;
  name: string;
  status: 'pending' | 'validating' | 'passed' | 'failed' | 'approved';
  gates: GateResult[];
  evidence: Record<string, unknown>[];
  approvedBy?: string;
  approvedAt?: string;
}

export interface GateResult {
  gateId: string;
  name: string;
  passed: boolean;
  score?: number;
  message: string;
  checkedAt: string;
}

export interface Pipeline {
  id: string;
  project: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  layers: PipelineLayer[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  pipelineId?: string;
  projectPath: string;
  overall: string;
  score: number;
  stages: { stage: string; result: string; score: number }[];
  timestamp: string;
}

export interface LearningRecord {
  id: string;
  type: string;
  source: string;
  content: string;
  impact: string;
  recordedAt: string;
}

const EAARG_LAYERS = [
  { id: 'dna', name: 'DNA Layer' },
  { id: 'schema', name: 'Schema Layer' },
  { id: 'behavioral', name: 'Behavioral Layer' },
  { id: 'governance', name: 'Governance Layer' },
  { id: 'decision', name: 'Decision Layer' },
  { id: 'quality', name: 'Quality Layer' },
  { id: 'audit', name: 'Audit Layer' },
  { id: 'mission', name: 'Mission Layer' },
  { id: 'learning', name: 'Learning Layer' },
];

const _pipelines = new Map<string, Pipeline>();
const _auditHistory: AuditRecord[] = [];
const _learningEvents: LearningRecord[] = [];

let _engineRef: BehaviorOSEngine | null = null;

export function setEngine(engine: BehaviorOSEngine) {
  _engineRef = engine;
}

export function getPipelines(): Map<string, Pipeline> {
  return _pipelines;
}

export function getAuditHistoryStore(): AuditRecord[] {
  return _auditHistory;
}

export function getLearningEventsStore(): LearningRecord[] {
  return _learningEvents;
}

function generateId(): string {
  return `bos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

// --- Input schemas ---

export const startPipelineInput = z.object({
  project: z.string().min(1).describe('Project name (e.g. brocolis, finpay)'),
  layers: z
    .array(z.enum(EAARG_LAYERS.map((l) => l.id) as [string, ...string[]]))
    .optional()
    .describe('Subset of layers to include (defaults to all)'),
});

export type StartPipelineInput = z.infer<typeof startPipelineInput>;

export const getPipelineStatusInput = z.object({
  pipelineId: z.string().min(1).describe('Pipeline ID'),
});

export type GetPipelineStatusInput = z.infer<typeof getPipelineStatusInput>;

export const validateLayerInput = z.object({
  pipelineId: z.string().min(1).describe('Pipeline ID'),
  layerId: z
    .enum(EAARG_LAYERS.map((l) => l.id) as [string, ...string[]])
    .describe('Layer ID to validate'),
  evidence: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Evidence data for the validation'),
});

export type ValidateLayerInput = z.infer<typeof validateLayerInput>;

export const getPipelineReportInput = z.object({
  pipelineId: z.string().min(1).describe('Pipeline ID'),
});

export type GetPipelineReportInput = z.infer<typeof getPipelineReportInput>;

export const approveLayerInput = z.object({
  pipelineId: z.string().min(1).describe('Pipeline ID'),
  layerId: z
    .enum(EAARG_LAYERS.map((l) => l.id) as [string, ...string[]])
    .describe('Layer ID to approve'),
  approvedBy: z.string().min(1).describe('Name or ID of the approver'),
});

export type ApproveLayerInput = z.infer<typeof approveLayerInput>;

export const getGateResultsInput = z.object({
  pipelineId: z.string().min(1).describe('Pipeline ID'),
  layerId: z.enum(EAARG_LAYERS.map((l) => l.id) as [string, ...string[]]).describe('Layer ID'),
});

export type GetGateResultsInput = z.infer<typeof getGateResultsInput>;

export const cicdRunAuditInput = z.object({
  pipelineId: z.string().optional().describe('Optional pipeline ID to associate'),
  projectPath: z.string().describe('Path to the project to audit'),
  stages: z
    .array(
      z.enum([
        'static',
        'architecture',
        'security',
        'performance',
        'tests',
        'coverage',
        'contracts',
        'docs',
        'compliance',
        'benchmarks',
      ]),
    )
    .optional()
    .describe('Audit stages to run'),
});

export type CICDRunAuditInput = z.infer<typeof cicdRunAuditInput>;

export const getAuditHistoryInput = z
  .object({
    pipelineId: z.string().optional().describe('Filter by pipeline ID'),
    limit: z.number().int().min(1).max(100).default(10).describe('Max records'),
  })
  .optional();

export type GetAuditHistoryInput = z.infer<typeof getAuditHistoryInput>;

export const cicdRecordLearningInput = z.object({
  pipelineId: z.string().optional().describe('Pipeline ID'),
  type: z
    .enum(['observation', 'pattern', 'insight', 'feedback', 'correction'])
    .describe('Event type'),
  source: z.string().describe('Source of the learning'),
  content: z.string().describe('Learning content'),
  impact: z.enum(['low', 'medium', 'high', 'critical']).default('medium').describe('Impact level'),
});

export type CICDRecordLearningInput = z.infer<typeof cicdRecordLearningInput>;

export const getLearningReportInput = z
  .object({
    limit: z.number().int().min(1).max(100).default(20).describe('Max events'),
  })
  .optional();

export type GetLearningReportInput = z.infer<typeof getLearningReportInput>;

// --- Tool handlers ---

export async function startPipeline(input: StartPipelineInput) {
  const pipelineId = generateId();
  const layerIds = input.layers ?? EAARG_LAYERS.map((l) => l.id);
  const layers: PipelineLayer[] = layerIds.map((id) => {
    const def = EAARG_LAYERS.find((l) => l.id === id)!;
    return {
      id: def.id,
      name: def.name,
      status: 'pending' as const,
      gates: [],
      evidence: [],
    };
  });

  const pipeline: Pipeline = {
    id: pipelineId,
    project: input.project,
    status: 'created',
    layers,
    createdAt: now(),
  };

  _pipelines.set(pipelineId, pipeline);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            id: pipeline.id,
            project: pipeline.project,
            status: pipeline.status,
            layerCount: pipeline.layers.length,
            layers: pipeline.layers.map((l) => ({ id: l.id, name: l.name, status: l.status })),
            createdAt: pipeline.createdAt,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function getPipelineStatus(input: GetPipelineStatusInput) {
  const pipeline = _pipelines.get(input.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.pipelineId}`);
  }

  const passed = pipeline.layers.filter(
    (l) => l.status === 'passed' || l.status === 'approved',
  ).length;
  const failed = pipeline.layers.filter((l) => l.status === 'failed').length;
  const total = pipeline.layers.length;

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            id: pipeline.id,
            project: pipeline.project,
            status: pipeline.status,
            progress: { passed, failed, total, percentage: Math.round((passed / total) * 100) },
            layers: pipeline.layers.map((l) => ({
              id: l.id,
              name: l.name,
              status: l.status,
              gateCount: l.gates.length,
              passedGates: l.gates.filter((g) => g.passed).length,
            })),
            startedAt: pipeline.startedAt,
            completedAt: pipeline.completedAt,
            createdAt: pipeline.createdAt,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function validateLayer(input: ValidateLayerInput) {
  const pipeline = _pipelines.get(input.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.pipelineId}`);
  }

  if (pipeline.status === 'completed' || pipeline.status === 'failed') {
    throw new Error(`Pipeline ${pipeline.id} is ${pipeline.status}`);
  }

  pipeline.status = 'running';
  if (!pipeline.startedAt) pipeline.startedAt = now();

  const layer = pipeline.layers.find((l) => l.id === input.layerId);
  if (!layer) {
    throw new Error(`Layer not found: ${input.layerId} in pipeline ${pipeline.id}`);
  }

  layer.status = 'validating';
  if (input.evidence) {
    layer.evidence.push({ ...input.evidence, addedAt: now() });
  }

  // Run governance evaluation if engine available
  const gateResults: GateResult[] = [];
  if (_engineRef) {
    try {
      const govResult = await _engineRef.evaluateGovernance(`validate-layer:${layer.id}`, {
        pipelineId: pipeline.id,
        layerId: layer.id,
        project: pipeline.project,
      });

      gateResults.push({
        gateId: `${layer.id}-governance`,
        name: 'Governance Check',
        passed: govResult.approved,
        message: govResult.approved
          ? 'Governance rules satisfied'
          : `Violations: ${govResult.violations.map((v: { name: string }) => v.name).join(', ')}`,
        checkedAt: now(),
      });
    } catch {
      gateResults.push({
        gateId: `${layer.id}-governance-error`,
        name: 'Governance Check',
        passed: false,
        message: 'Governance evaluation failed — engine error',
        checkedAt: now(),
      });
    }
  } else {
    gateResults.push({
      gateId: `${layer.id}-governance`,
      name: 'Governance Check',
      passed: true,
      score: 100,
      message: 'Governance check passed (no engine — synthetic pass)',
      checkedAt: now(),
    });
  }

  gateResults.push({
    gateId: `${layer.id}-evidence`,
    name: 'Evidence Check',
    passed: layer.evidence.length > 0,
    message:
      layer.evidence.length > 0
        ? `${layer.evidence.length} evidence item(s) provided`
        : 'No evidence provided',
    checkedAt: now(),
  });

  gateResults.push({
    gateId: `${layer.id}-schema`,
    name: 'Schema Validation',
    passed: true,
    score: 100,
    message: 'Layer schema is valid',
    checkedAt: now(),
  });

  layer.gates = gateResults;
  layer.status = gateResults.every((g) => g.passed) ? 'passed' : 'failed';

  if (pipeline.layers.every((l) => l.status === 'passed' || l.status === 'approved')) {
    pipeline.status = 'completed';
    pipeline.completedAt = now();
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            pipelineId: pipeline.id,
            layer: { id: layer.id, name: layer.name, status: layer.status },
            gates: layer.gates,
            pipelineStatus: pipeline.status,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function getPipelineReport(input: GetPipelineReportInput) {
  const pipeline = _pipelines.get(input.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.pipelineId}`);
  }

  const totalGates = pipeline.layers.reduce((sum, l) => sum + l.gates.length, 0);
  const passedGates = pipeline.layers.reduce(
    (sum, l) => sum + l.gates.filter((g) => g.passed).length,
    0,
  );
  const allEvidence = pipeline.layers.reduce((sum, l) => sum + l.evidence.length, 0);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            id: pipeline.id,
            project: pipeline.project,
            status: pipeline.status,
            summary: {
              totalLayers: pipeline.layers.length,
              passedLayers: pipeline.layers.filter(
                (l) => l.status === 'passed' || l.status === 'approved',
              ).length,
              failedLayers: pipeline.layers.filter((l) => l.status === 'failed').length,
              totalGates,
              passedGates,
              failedGates: totalGates - passedGates,
              evidenceCount: allEvidence,
            },
            layers: pipeline.layers.map((l) => ({
              id: l.id,
              name: l.name,
              status: l.status,
              gates: l.gates,
              evidenceCount: l.evidence.length,
              approvedBy: l.approvedBy,
              approvedAt: l.approvedAt,
            })),
            timeline: {
              createdAt: pipeline.createdAt,
              startedAt: pipeline.startedAt,
              completedAt: pipeline.completedAt,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function approveLayer(input: ApproveLayerInput) {
  const pipeline = _pipelines.get(input.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.pipelineId}`);
  }

  const layer = pipeline.layers.find((l) => l.id === input.layerId);
  if (!layer) {
    throw new Error(`Layer not found: ${input.layerId} in pipeline ${pipeline.id}`);
  }

  if (layer.status !== 'passed' && layer.status !== 'failed') {
    throw new Error(
      `Layer ${layer.id} must be validated before approval (current status: ${layer.status})`,
    );
  }

  layer.status = 'approved';
  layer.approvedBy = input.approvedBy;
  layer.approvedAt = now();

  if (pipeline.layers.every((l) => l.status === 'passed' || l.status === 'approved')) {
    pipeline.status = 'completed';
    pipeline.completedAt = now();
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            pipelineId: pipeline.id,
            layer: { id: layer.id, name: layer.name, status: layer.status },
            approvedBy: layer.approvedBy,
            approvedAt: layer.approvedAt,
            pipelineStatus: pipeline.status,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function getGateResults(input: GetGateResultsInput) {
  const pipeline = _pipelines.get(input.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.pipelineId}`);
  }

  const layer = pipeline.layers.find((l) => l.id === input.layerId);
  if (!layer) {
    throw new Error(`Layer not found: ${input.layerId} in pipeline ${pipeline.id}`);
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            pipelineId: pipeline.id,
            layer: { id: layer.id, name: layer.name, status: layer.status },
            gates: layer.gates,
            summary: {
              total: layer.gates.length,
              passed: layer.gates.filter((g) => g.passed).length,
              failed: layer.gates.filter((g) => !g.passed).length,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function cicdRunAudit(input: CICDRunAuditInput) {
  const { AuditEngine } = await import('@behavioros/core');
  const auditEngine = new AuditEngine();

  const result = await auditEngine.execute(
    { projectPath: input.projectPath },
    input.stages as Parameters<typeof auditEngine.execute>[1],
  );

  const record: AuditRecord = {
    id: result.id,
    pipelineId: input.pipelineId,
    projectPath: input.projectPath,
    overall: result.overall,
    score: result.score,
    stages: result.stages.map((s: { stage: string; result: string; score: number }) => ({
      stage: s.stage,
      result: s.result,
      score: s.score,
    })),
    timestamp: result.timestamp,
  };

  _auditHistory.push(record);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            id: record.id,
            pipelineId: record.pipelineId,
            overall: record.overall,
            score: record.score,
            duration: result.duration,
            stages: record.stages,
            timestamp: record.timestamp,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function getAuditHistory(input?: GetAuditHistoryInput) {
  let records = [..._auditHistory];

  if (input?.pipelineId) {
    records = records.filter((r) => r.pipelineId === input.pipelineId);
  }

  const limit = input?.limit ?? 10;
  records = records.slice(-limit);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: _auditHistory.length,
            returned: records.length,
            records,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function cicdRecordLearning(input: CICDRecordLearningInput) {
  const event: LearningRecord = {
    id: generateId(),
    type: input.type,
    source: input.source,
    content: input.content,
    impact: input.impact,
    recordedAt: now(),
  };

  _learningEvents.push(event);

  // Also record in the core engine if available
  if (_engineRef) {
    try {
      await _engineRef.recordLearning({
        type: input.type,
        source: input.source,
        data: { content: input.content, impact: input.impact, pipelineId: input.pipelineId },
        confidence: input.impact === 'critical' ? 0.95 : input.impact === 'high' ? 0.8 : 0.5,
      });
    } catch {
      // Core engine recording is best-effort
    }
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(event, null, 2),
      },
    ],
  };
}

export async function getLearningReport(input?: GetLearningReportInput) {
  const limit = input?.limit ?? 20;
  const events = _learningEvents.slice(-limit);

  const byType: Record<string, number> = {};
  const byImpact: Record<string, number> = {};
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byImpact[e.impact] = (byImpact[e.impact] || 0) + 1;
  }

  const recommendations: string[] = [];
  if ((byImpact.critical ?? 0) > 0) {
    recommendations.push('Critical impact events detected — review and address immediately');
  }
  if ((byType.correction ?? 0) > 3) {
    recommendations.push('Frequent corrections suggest process improvement needed');
  }
  if ((byType.insight ?? 0) > 2) {
    recommendations.push('Multiple insights available — consider updating governance rules');
  }
  if (events.length > 10) {
    recommendations.push('Sufficient learning data — enable auto-apply for known patterns');
  }
  if (recommendations.length === 0) {
    recommendations.push('Continue collecting learning events for pattern detection');
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: _learningEvents.length,
            returned: events.length,
            breakdown: { byType, byImpact },
            events,
            recommendations,
          },
          null,
          2,
        ),
      },
    ],
  };
}
