/**
 * BehaviorOS Orchestrator — Autonomous orchestration engine exports.
 *
 * Phase 2: Autonomous Orchestrator
 * Makes BehaviorOS truly autonomous by decomposing, routing, delegating,
 * and monitoring tasks without human intervention.
 */

export type { AutoDocumentationOptions, DocGenerationResult } from './auto-documentation-trigger';
export { AutoDocumentationTrigger } from './auto-documentation-trigger';
export type {
  DecomposerOptions,
  MissionInput,
  MissionType,
} from './autonomous-decomposer';
export { AutonomousDecomposer } from './autonomous-decomposer';
export type {
  EscalationEvent,
  EscalationResult,
  OrchestratorInput,
  OrchestratorOptions,
  OrchestratorResult,
  OrchestratorStatusReport,
  OrchestratorStatusValue,
  RejectionEvent,
} from './autonomous-orchestrator';
export { AutonomousOrchestrator } from './autonomous-orchestrator';
export type {
  HandoffContext,
  HandoffRecord,
  HandoffRejectReason,
  HandoffStatus,
} from './handoff-protocol';
export { HandoffProtocol } from './handoff-protocol';
export type {
  PipelineInput,
  PipelineOptions,
  PipelineResult,
  PipelineStage,
  QualityGateResult,
} from './lifecycle-pipeline';
export { LifecyclePipeline } from './lifecycle-pipeline';
export type {
  AgentDescriptor,
  RouteMatch,
  RoutingResult,
  SkillRouterOptions,
} from './skill-router';
export { SkillRouter } from './skill-router';
