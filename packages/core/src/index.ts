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
export type { OPAInput, OPAOutput } from './compiler/opa-evaluator';
export { OPAEvaluator } from './compiler/opa-evaluator';
export { PolicyStore } from './compiler/policy-store';
export type { OPARegoPolicy, OPARegoRule } from './compiler/yaml-to-opa';
export { YAMLToOPACompiler } from './compiler/yaml-to-opa';
export {
  STAGE_5_CONFIG,
  STAGE_5_THRESHOLDS,
  STAGE_25_CONFIG,
  STAGE_25_THRESHOLDS,
  STAGE_50_CONFIG,
  STAGE_50_THRESHOLDS,
  STAGE_100_CONFIG,
  STAGE_100_THRESHOLDS,
} from './deploy';
// Deploy — Canary deployment system
export type {
  CanaryDeployerConfig,
  CanaryDeployerEvents,
  CanaryDeployment,
  CanaryDeploymentStatus,
  CanaryStageState,
} from './deploy/canary-deployer';
export { CanaryDeployer } from './deploy/canary-deployer';
export type {
  HealthCheckCategory,
  HealthCheckerConfig,
  HealthCheckerEvents,
  HealthCheckProbe,
  HealthCheckResult,
  HealthCheckStatus,
  HealthThreshold,
} from './deploy/health-checker';
export { HealthChecker } from './deploy/health-checker';
export type {
  RollbackManagerConfig,
  RollbackManagerEvents,
  RollbackRecord,
  RollbackStatus,
  RollbackTrigger,
} from './deploy/rollback-manager';
export { RollbackManager } from './deploy/rollback-manager';
export type {
  RoutingDecision,
  SplitStrategy,
  StickySession,
  TrafficRoute,
  TrafficSplitterConfig,
  TrafficSplitterEvents,
} from './deploy/traffic-splitter';
export { TrafficSplitter } from './deploy/traffic-splitter';
export type { CanaryStageConfig } from './deploy/types';
// Domain — DDD Boundaries & Anti-Corruption Layer
export type {
  ACLResult as DomainACLResult,
  AgentContextValidationResult,
  AntiCorruptionLayer as DomainAntiCorruptionLayer,
  AuthorityLevel as DomainAuthorityLevel,
  Boundary as DomainBoundary,
  BoundaryResult as DomainBoundaryResult,
  BoundaryType as DomainBoundaryType,
  DNAContextValidationResult,
  EventType as DomainEventType,
} from './domain';
export {
  AgentACL as DomainAgentACL,
  AgentBoundary as DomainAgentBoundary,
  AgentContext as DomainAgentContext,
  DataACL as DomainDataACL,
  DNABoundary as DomainDNABoundary,
  DNAContext as DomainDNAContext,
  EventACL as DomainEventACL,
  ExecutionBoundary as DomainExecutionBoundary,
} from './domain';
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
// Audit Chain hash-chain integrity verifier. IMPORTANT: this lives at
// engines/behavioral/audit-chain/ (a directory with its own index.ts), which is shadowed by
// the sibling engines/behavioral/audit-chain.ts file above under plain module resolution —
// a bare `from './engines/behavioral/audit-chain'` always resolves to the .ts file, never the
// directory. That's why bos_run_audit never had access to this: the barrel file that exports
// it was structurally unreachable from this package's public API, not just unused.
export type {
  AuditEntry as AuditChainEntry,
  AuditEntryPayload as AuditChainEntryPayload,
  VerificationResult as AuditChainVerificationResult,
} from './engines/behavioral/audit-chain/index';
export { AuditChainVerifier, HashChain } from './engines/behavioral/audit-chain/index';
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
  CoverageDimension,
  CoverageEngineOptions,
  CoverageReport,
} from './engines/coverage-engine';
export { CoverageEngine } from './engines/coverage-engine';
export type {
  DecisionContext,
  DecisionOption,
  DecisionParticipant,
  DecisionResult,
  DecisionVote,
} from './engines/decision/decision-engine';
export { DecisionEngine } from './engines/decision/decision-engine';
// Ecosystem Registry
export type {
  DoctorResult,
  EcosystemRegistryOptions,
  SyncResults,
} from './engines/ecosystem-registry';
export { EcosystemRegistry } from './engines/ecosystem-registry';
export type {
  AuthorityLevelValue,
  GovernanceContext,
  GovernanceDecision,
} from './engines/governance/governance-engine';
export { GovernanceEngine } from './engines/governance/governance-engine';
export type { LearningReport, PatternInsight } from './engines/learning/learning-engine';
export { LearningEngine } from './engines/learning/learning-engine';
export type { MemoryEngineOptions, MemoryEntry, MemoryFile } from './engines/memory-engine';
// Memory — Persistent memory engine
export { MemoryEngine } from './engines/memory-engine';
export type { MissionPlan, MissionProgress } from './engines/mission/mission-engine';
export { MissionEngine } from './engines/mission/mission-engine';
export { AutonomousOrchestrator } from './engines/orchestrator/autonomous-orchestrator';
// Handoff Protocol
export type {
  HandoffContext,
  HandoffRecord,
  HandoffRejectReason,
  HandoffStatus,
} from './engines/orchestrator/handoff-protocol';
export { HandoffProtocol } from './engines/orchestrator/handoff-protocol';
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
  OrderViolation,
  ProtocolState,
  ProtocolStatus,
  ProtocolStepNumber,
  ProtocolValidation,
} from './engines/protocol-engine';
export {
  PROTOCOL_STEP_NAMES,
  PROTOCOL_STEP_TOOLS,
  PROTOCOL_STEPS,
  ProtocolStateTracker,
} from './engines/protocol-engine';
export type {
  QualityCheckResult,
  QualityEngineConfig,
  QualityReport,
} from './engines/quality/quality-engine';
export { QualityEngine } from './engines/quality/quality-engine';
// Quality — Self-Healing Engine
export type {
  HealingAction,
  SelfHealingEngineOptions,
} from './engines/quality/self-healing-engine';
export { SelfHealingEngine } from './engines/quality/self-healing-engine';
// Recovery — Context Recovery Engine
export type {
  ContextRecoveryEngineOptions,
  RecoveryCheckpoint,
  RecoveryResult,
} from './engines/recovery/context-recovery-engine';
export { ContextRecoveryEngine } from './engines/recovery/context-recovery-engine';
// Skill Engine
export type {
  DelegationValidation,
  InstallResult,
  SkillEngineDoctorReport,
  SkillEngineStatus,
  SyncFromDNAResult,
  SyncFromLocalResult,
} from './engines/skill-engine';
export { SkillEngine } from './engines/skill-engine';
// Telemetry — opt-in, aggregate-only governance metrics
export type {
  AgentCounter,
  GovernanceTelemetrySummary,
  RuleCounter,
  TelemetryConfig,
} from './engines/telemetry/governance-telemetry';
export { GovernanceTelemetryEngine } from './engines/telemetry/governance-telemetry';
// Events — Event Sourcing foundation
export type {
  AgentAssignedPayload,
  AgentEventType,
  AgentRegisteredPayload,
  AgentStatusChangedPayload,
  AllEventTypes,
  AllPayloads,
  AuditEventType,
  AuditPipelineFinishedPayload,
  AuditStageCompletedPayload,
  BehaviorOSEvent,
  DNAComposedPayload,
  DNAEventType,
  DNALoadedPayload,
  DNAValidatedPayload,
  EventStoreConfig,
  GovernanceBlockedPayload,
  GovernanceEscalatedPayload,
  GovernanceEvaluatedPayload,
  GovernanceEventType,
  LearningEventRecordedPayload,
  LearningEventType,
  LearningPatternDetectedPayload,
  MissionCompletedPayload,
  MissionCreatedPayload,
  MissionEventType,
  MissionFailedPayload,
  MissionStartedPayload,
  PipelineEventType,
  PipelineExecutedPayload,
  PipelineFailedPayload,
  PipelineLayerCompletedPayload,
  QualityEventType,
  QualityGateCheckedPayload,
  QualityMetricRecordedPayload,
  SkillDeprecatedPayload,
  SkillEventType,
  SkillInstalledPayload,
  SkillResolvedPayload,
  Snapshot,
} from './events';
export { createEvent, EventReplay, EventStore } from './events';
// Kernel — Engine & Capability Registries
export type { CapabilityInfo, EngineInfo } from './kernel';
export { CapabilityRegistry, EngineRegistry } from './kernel';
// Mesh — 5-bus Event Mesh
export type { Bus, BusMessage, BusSubscription } from './mesh';
export { CommandBus, EventBus, MeshHub, NotificationBus, QueryBus, StreamBus } from './mesh';
// Persistence — Audit trail
export type { AuditEntry, ChainVerificationResult } from './persistence/sqlite-audit-store';
export { SQLiteAuditStore } from './persistence/sqlite-audit-store';
// Note: SQLiteStore is intentionally NOT re-exported from this main barrel — it's the
// only thing in this package with a hard runtime dependency on better-sqlite3, a native
// module with no prebuilt binary for every platform/Node version (see package.json's
// optionalDependencies). A value re-export here would eagerly load it for every consumer
// of `@behavioros/core`, even those who never touch SQLite persistence, and crash on
// machines where the optional native module couldn't install. Import it explicitly from
// `@behavioros/core/sqlite` instead — that's an opt-in cost, not a load-bearing one.
export type { LayerMetrics } from './pipeline/interceptors/metrics-interceptor';
export { MetricsInterceptor } from './pipeline/interceptors/metrics-interceptor';
export { TimeoutInterceptor } from './pipeline/interceptors/timeout-interceptor';
export { CoverageGateLayer } from './pipeline/layers/coverage-gate.layer';
export { DelegationEnforcementLayer } from './pipeline/layers/delegation-enforcement.layer';
export { shouldSkipForConversational } from './pipeline/mode/conversational.adapter';
export { shouldSkipForTransactional } from './pipeline/mode/transactional.adapter';
// Pipeline Dispatcher
export type {
  DispatcherLayerResult,
  PipelineDispatcherContext,
} from './pipeline/pipeline-context';
export { createDispatcherContext } from './pipeline/pipeline-context';
export type {
  PipelineDispatcherInterceptor,
  PipelineDispatcherLayer,
} from './pipeline/pipeline-dispatcher';
export { PipelineDispatcher } from './pipeline/pipeline-dispatcher';
export type { LayerMetricEntry, PipelineMetrics } from './pipeline/telemetry/metrics';
export { MetricsCollector } from './pipeline/telemetry/metrics';
// Resilience — Agent Isolation
export type {
  AgentBehaviorSnapshot,
  AnomalyType,
  CapturedData,
  EvidenceSeverity,
  EvidenceType,
  ExecutionPermission,
  ForensicCollectorConfig,
  ForensicCollectorEvents,
  ForensicEntry,
  ForensicEvidenceReport,
  QuarantineEntry,
  QuarantineManagerConfig,
  QuarantineManagerEvents,
  QuarantineReason,
  QuarantineResult,
  QuarantineStatus,
  SandboxEvidence,
  SandboxExecution,
  SandboxExecutorConfig,
  SandboxExecutorEvents,
  SandboxOutput,
  SandboxStatus as AgentSandboxStatus,
  SideEffect,
  SuspicionDetectorConfig,
  SuspicionDetectorEvents,
  SuspicionEvent,
  SuspicionLevel,
  SuspicionResult,
} from './resilience/agent-isolation';
export {
  ForensicCollector,
  QuarantineManager,
  SandboxExecutor,
  SuspicionDetector,
} from './resilience/agent-isolation';
export type { EphemeralConfig } from './sandbox/environments/ephemeral-env';
export { EphemeralEnvironment } from './sandbox/environments/ephemeral-env';
export type { PersistentConfig } from './sandbox/environments/persistent-env';
export { PersistentEnvironment } from './sandbox/environments/persistent-env';
export type {
  DiffEntry,
  ShadowConfig,
  TrafficCaptureEntry,
} from './sandbox/environments/shadow-env';
export { ShadowEnvironment } from './sandbox/environments/shadow-env';
// Sandbox — Isolated environments + simulation
export type {
  SandboxEnvironment as SandboxEnv,
  SandboxStatus,
  SandboxType,
} from './sandbox/sandbox-engine';
export { SandboxEngine } from './sandbox/sandbox-engine';
export type { PromptScenario } from './sandbox/simulation/prompt-simulator';
export { PromptSimulator } from './sandbox/simulation/prompt-simulator';
export type { CollectedResponse } from './sandbox/simulation/response-collector';
export { ResponseCollector } from './sandbox/simulation/response-collector';
export type { TrafficCapture } from './sandbox/simulation/traffic-replay';
export { TrafficReplay } from './sandbox/simulation/traffic-replay';
// Security — Authority verification, DNA sanitization
export type {
  AuthorityLevel,
  AuthorityToken,
  VerificationResult,
} from './security/authority-verifier';
export { AuthorityVerifier } from './security/authority-verifier';
export type { SanitizationResult, SanitizationViolation } from './security/dna-sanitizer';
export { analyzeIntent, sanitizeDNA } from './security/dna-sanitizer';
export type { LogEntry } from './shared/logger';
// Shared — Logger
export { Logger } from './shared/logger';
export type {
  SecurityBlock,
  SignedProtocolFields,
  SignedStateFile,
  StateReadReason,
  StateReadResult,
} from './state/agent-state-store';
export {
  atomicWriteFileSync,
  getOrCreateStateSecret,
  getStateSecretPath,
  isStrictModeEnrolled,
  readState,
  signProtocolState,
  writeSignedState,
} from './state/agent-state-store';
