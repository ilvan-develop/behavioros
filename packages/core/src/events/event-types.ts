// ============================================================
// Event Sourcing — Event Type Definitions
// ============================================================

// --- Base Event Interface ---

export interface BehaviorOSEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  timestamp: string;
  version: number;
  metadata: Record<string, unknown>;
  payload: unknown;
}

// --- Snapshot ---

export interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  state: unknown;
  version: number;
  timestamp: string;
}

// --- Event Store Config ---

export interface EventStoreConfig {
  maxEvents?: number;
  snapshotInterval?: number;
  persistPath?: string;
}

// --- Aggregate Types ---

export type AggregateType =
  | 'mission'
  | 'agent'
  | 'pipeline'
  | 'governance'
  | 'quality'
  | 'audit'
  | 'learning'
  | 'dna'
  | 'skill';

// --- Mission Events ---

export type MissionEventType =
  | 'mission.created'
  | 'mission.started'
  | 'mission.completed'
  | 'mission.failed';

export interface MissionCreatedPayload {
  title: string;
  type: string;
  priority: string;
  description?: string;
}

export interface MissionStartedPayload {
  agentId: string;
  startedAt: string;
}

export interface MissionCompletedPayload {
  result: unknown;
  duration: number;
}

export interface MissionFailedPayload {
  error: string;
  stage?: string;
}

// --- Agent Events ---

export type AgentEventType = 'agent.registered' | 'agent.assigned' | 'agent.status_changed';

export interface AgentRegisteredPayload {
  role: string;
  authority: string;
  capabilities: string[];
}

export interface AgentAssignedPayload {
  missionId: string;
}

export interface AgentStatusChangedPayload {
  previousStatus: string;
  newStatus: string;
}

// --- Pipeline Events ---

export type PipelineEventType =
  | 'pipeline.executed'
  | 'pipeline.layer_completed'
  | 'pipeline.failed';

export interface PipelineExecutedPayload {
  dnaId: string;
  totalLayers: number;
}

export interface PipelineLayerCompletedPayload {
  layerNumber: number;
  layerName: string;
  status: string;
  score: number;
}

export interface PipelineFailedPayload {
  failedLayer: string;
  error: string;
}

// --- Governance Events ---

export type GovernanceEventType =
  | 'governance.evaluated'
  | 'governance.blocked'
  | 'governance.escalated';

export interface GovernanceEvaluatedPayload {
  ruleId: string;
  action: string;
  result: string;
}

export interface GovernanceBlockedPayload {
  ruleId: string;
  reason: string;
}

export interface GovernanceEscalatedPayload {
  ruleId: string;
  escalationTarget: string;
  reason: string;
}

// --- Quality Events ---

export type QualityEventType = 'quality.gate_checked' | 'quality.metric_recorded';

export interface QualityGateCheckedPayload {
  gateId: string;
  gateName: string;
  passed: boolean;
  threshold?: number;
  actual?: number;
}

export interface QualityMetricRecordedPayload {
  name: string;
  value: number;
  unit?: string;
}

// --- Audit Events ---

export type AuditEventType = 'audit.stage_completed' | 'audit.pipeline_finished';

export interface AuditStageCompletedPayload {
  stage: string;
  result: string;
  duration: number;
}

export interface AuditPipelineFinishedPayload {
  totalStages: number;
  passedStages: number;
  overallResult: string;
}

// --- Learning Events ---

export type LearningEventType = 'learning.event_recorded' | 'learning.pattern_detected';

export interface LearningEventRecordedPayload {
  eventType: string;
  source: string;
  confidence: number;
}

export interface LearningPatternDetectedPayload {
  pattern: string;
  occurrences: number;
  confidence: number;
}

// --- DNA Events ---

export type DNAEventType = 'dna.loaded' | 'dna.validated' | 'dna.composed';

export interface DNALoadedPayload {
  dnaId: string;
  name: string;
  version: string;
}

export interface DNAValidatedPayload {
  dnaId: string;
  valid: boolean;
  errors: string[];
}

export interface DNAComposedPayload {
  primaryDnaId: string;
  secondaryDnaId: string;
  blendRatio: { primary: number; secondary: number };
}

// --- Skill Events ---

export type SkillEventType = 'skill.installed' | 'skill.resolved' | 'skill.deprecated';

export interface SkillInstalledPayload {
  skillId: string;
  version: string;
}

export interface SkillResolvedPayload {
  skillId: string;
  agentId: string;
}

export interface SkillDeprecatedPayload {
  skillId: string;
  replacement?: string;
}

// --- Engine Events ---

export type EngineEventType =
  | 'intent-detected'
  | 'goal-decomposed'
  | 'plan-created'
  | 'mission-compiled'
  | 'task-queued'
  | 'task-started'
  | 'task-completed'
  | 'task-failed'
  | 'knowledge-node-added'
  | 'event-stored';

export interface IntentDetectedPayload {
  type: string;
  confidence: number;
  description: string;
}

export interface GoalDecomposedPayload {
  goals: Array<{ id: string; title: string }>;
}

export interface PlanCreatedPayload {
  id: string;
  missionTitle: string;
}

export interface MissionCompiledPayload {
  missionId: string;
  totalSteps: number;
  totalEstimatedDuration: number;
}

export interface TaskQueuedPayload {
  taskId: string;
  type: string;
  priority: string;
}

export interface TaskStartedPayload {
  taskId: string;
}

export interface TaskCompletedPayload {
  taskId: string;
  result: unknown;
}

export interface TaskFailedPayload {
  taskId: string;
  error: string;
}

export interface KnowledgeNodeAddedPayload {
  nodeId: string;
  label: string;
  type: string;
}

export interface EventStoredPayload {
  eventType: string;
  aggregateId: string;
}

// --- Union Types ---

export type AllEventTypes =
  | MissionEventType
  | AgentEventType
  | PipelineEventType
  | GovernanceEventType
  | QualityEventType
  | AuditEventType
  | LearningEventType
  | DNAEventType
  | SkillEventType
  | EngineEventType;

export type AllPayloads =
  | MissionCreatedPayload
  | MissionStartedPayload
  | MissionCompletedPayload
  | MissionFailedPayload
  | AgentRegisteredPayload
  | AgentAssignedPayload
  | AgentStatusChangedPayload
  | PipelineExecutedPayload
  | PipelineLayerCompletedPayload
  | PipelineFailedPayload
  | GovernanceEvaluatedPayload
  | GovernanceBlockedPayload
  | GovernanceEscalatedPayload
  | QualityGateCheckedPayload
  | QualityMetricRecordedPayload
  | AuditStageCompletedPayload
  | AuditPipelineFinishedPayload
  | LearningEventRecordedPayload
  | LearningPatternDetectedPayload
  | DNALoadedPayload
  | DNAValidatedPayload
  | DNAComposedPayload
  | SkillInstalledPayload
  | SkillResolvedPayload
  | SkillDeprecatedPayload
  | IntentDetectedPayload
  | GoalDecomposedPayload
  | PlanCreatedPayload
  | MissionCompiledPayload
  | TaskQueuedPayload
  | TaskStartedPayload
  | TaskCompletedPayload
  | TaskFailedPayload
  | KnowledgeNodeAddedPayload
  | EventStoredPayload;

// --- Helper: Create Event ---

export function createEvent(
  overrides: Partial<BehaviorOSEvent> &
    Pick<BehaviorOSEvent, 'type' | 'aggregateId' | 'aggregateType'>,
): BehaviorOSEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: 1,
    metadata: {},
    payload: null,
    ...overrides,
  };
}
