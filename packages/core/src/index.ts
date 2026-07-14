// @behavioros/core — Barrel Export

export type {
  CompilerOutput,
  GeneratedAgent,
  GeneratedCICD,
  GeneratedDocs,
  GeneratedFile,
  GeneratedHook,
  GeneratedMCP,
  GeneratedOrganization,
  GeneratedWorkflow,
} from './compiler/behavior-compiler';
export { BehaviorCompiler } from './compiler/behavior-compiler';
export type {
  AuditContext,
  AuditPipelineResult,
  AuditStage,
  AuditStageResult,
  StageExecutor,
} from './engines/audit/audit-engine';
export { AuditEngine } from './engines/audit/audit-engine';
export type { AuditChainReport, AuditResult, AuditStep } from './engines/behavioral/audit-chain';
export { AuditChain } from './engines/behavioral/audit-chain';
export type { DnaSelection, TaskContext } from './engines/behavioral/behavior-selector';
// BOS Behavioral Engines
export { BehaviorSelector } from './engines/behavioral/behavior-selector';
export type { ConflictContext, Resolution } from './engines/behavioral/conflict-resolver';
export { ConflictResolver } from './engines/behavioral/conflict-resolver';
export type { CompositionResult } from './engines/behavioral/dna-composer';
export { DNAComposer } from './engines/behavioral/dna-composer';
export type { DNALoaderOptions } from './engines/behavioral/dna-loader';
export { DNALoader } from './engines/behavioral/dna-loader';
export type { ResolvedDna } from './engines/behavioral/dna-resolver';
export { DnaResolver } from './engines/behavioral/dna-resolver';
export type {
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from './engines/behavioral/dna-validator';
export { DNAValidator } from './engines/behavioral/dna-validator';
export type { EscalationEvent, EscalationTrigger } from './engines/behavioral/escalation-manager';
export { EscalationManager } from './engines/behavioral/escalation-manager';
export type {
  AgentAuthority as BosAgentAuthority,
  ConflictResolution as BosConflictResolution,
  EscalationRule as BosGovernanceEscalationRule,
  GovernanceConfig as BosGovernanceConfig,
  ValidationResult as BosGovernanceValidationResult,
} from './engines/behavioral/governance-engine';
export {
  BosGovernanceEngine,
  matchesGlob as bosMatchesGlob,
} from './engines/behavioral/governance-engine';
export type {
  BehavioralRecord,
  DnaMutation,
  PatternInsight as BosPatternInsight,
} from './engines/behavioral/learning-engine';
export { BosLearningEngine } from './engines/behavioral/learning-engine';
export type { BehaviorOSEngineConfig, EngineEvents } from './engines/core-engine';
export { BehaviorOSEngine } from './engines/core-engine';
export type {
  DecisionContext,
  DecisionOption,
  DecisionParticipant,
  DecisionResult,
  DecisionVote,
} from './engines/decision/decision-engine';
export { DecisionEngine } from './engines/decision/decision-engine';
export type {
  AuthorityLevelValue,
  GovernanceContext,
  GovernanceDecision,
} from './engines/governance/governance-engine';
export { GovernanceEngine } from './engines/governance/governance-engine';
export type { LearningReport, PatternInsight } from './engines/learning/learning-engine';
export { LearningEngine } from './engines/learning/learning-engine';
export type { MissionPlan, MissionProgress } from './engines/mission/mission-engine';
export { MissionEngine } from './engines/mission/mission-engine';

export { PipelineEngine } from './engines/pipeline/pipeline-engine';
export type {
  EvidenceValidationResult,
  GateCheckResult,
  LayerExecutionResult,
  PipelineContext,
  PipelineEngineEvents,
  PipelineOptions,
} from './engines/pipeline/types';
export type {
  QualityCheckResult,
  QualityEngineConfig,
  QualityReport,
} from './engines/quality/quality-engine';
export { QualityEngine } from './engines/quality/quality-engine';
export type { PersistenceConfig } from './persistence/sqlite-store';
// Persistence
export { SQLiteStore } from './persistence/sqlite-store';
