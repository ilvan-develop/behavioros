// @behavioros/core — Barrel Export
export { BehaviorOSEngine } from './engines/core-engine'
export type { BehaviorOSEngineConfig, EngineEvents } from './engines/core-engine'

export { DNALoader } from './engines/behavioral/dna-loader'
export type { DNALoaderOptions } from './engines/behavioral/dna-loader'
export { DNAValidator } from './engines/behavioral/dna-validator'
export type { ValidationResult, ValidationError, ValidationWarning } from './engines/behavioral/dna-validator'
export { DNAComposer } from './engines/behavioral/dna-composer'
export type { CompositionResult } from './engines/behavioral/dna-composer'

export { GovernanceEngine } from './engines/governance/governance-engine'
export type { GovernanceContext, GovernanceDecision, AuthorityLevelValue } from './engines/governance/governance-engine'

export { DecisionEngine } from './engines/decision/decision-engine'
export type { DecisionContext, DecisionParticipant, DecisionOption, DecisionVote, DecisionResult } from './engines/decision/decision-engine'

export { AuditEngine } from './engines/audit/audit-engine'
export type { AuditStage, AuditStageResult, AuditPipelineResult, StageExecutor, AuditContext } from './engines/audit/audit-engine'

export { QualityEngine } from './engines/quality/quality-engine'
export type { QualityCheckResult, QualityReport } from './engines/quality/quality-engine'

export { LearningEngine } from './engines/learning/learning-engine'
export type { PatternInsight, LearningReport } from './engines/learning/learning-engine'

export { MissionEngine } from './engines/mission/mission-engine'
export type { MissionPlan, MissionProgress } from './engines/mission/mission-engine'

export { BehaviorCompiler } from './compiler/behavior-compiler'
export type {
  CompilerOutput,
  GeneratedOrganization,
  GeneratedAgent,
  GeneratedWorkflow,
  GeneratedHook,
  GeneratedCICD,
  GeneratedMCP,
  GeneratedDocs,
  GeneratedFile,
} from './compiler/behavior-compiler'
