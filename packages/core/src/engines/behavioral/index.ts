export type { AuditChainReport, AuditResult, AuditStep } from './audit-chain';
export { AuditChain } from './audit-chain';
export type { DnaSelection, TaskContext } from './behavior-selector';
// BOS Behavioral Engines
export { BehaviorSelector } from './behavior-selector';
export type { ConflictContext, Resolution } from './conflict-resolver';
export { ConflictResolver } from './conflict-resolver';
export type { CompositionResult } from './dna-composer';
export { DNAComposer } from './dna-composer';
export { ContextManager } from './dna-isolation/context-manager';
export type { CrossDNARequest, CrossDNAResult } from './dna-isolation/cross-dna-guard';
export { CrossDNAGuard } from './dna-isolation/cross-dna-guard';
export type {
  DNAMode,
  Permission,
  PermissionAction,
  PermissionMatrix,
} from './dna-isolation/permission-matrix';
export { PermissionMatrixManager } from './dna-isolation/permission-matrix';
export type { DNALoaderOptions } from './dna-loader';
export { DNALoader } from './dna-loader';
export type { ResolvedDna } from './dna-resolver';
export { DnaResolver } from './dna-resolver';
export type { ValidationError, ValidationResult, ValidationWarning } from './dna-validator';
export { DNAValidator } from './dna-validator';
export type { EscalationEvent, EscalationTrigger } from './escalation-manager';
export { EscalationManager } from './escalation-manager';
export type {
  AgentAuthority,
  ConflictResolution as BosConflictResolution,
  EscalationRule as BosEscalationRule,
  GovernanceConfig as BosGovernanceConfig,
  ValidationResult as BosValidationResult,
} from './governance-engine';
export { BosGovernanceEngine, matchesGlob } from './governance-engine';
export type { BehavioralRecord, DnaMutation, PatternInsight } from './learning-engine';
export { BosLearningEngine } from './learning-engine';
