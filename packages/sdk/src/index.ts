import {
  AuditEngine,
  type AuditPipelineResult,
  type AuditStage,
  BehaviorOSEngine,
  type BehaviorOSEngineConfig,
  type DecisionContext,
  DecisionEngine,
  type DecisionResult,
  DNALoader,
  type DNALoaderOptions,
  type GovernanceContext,
  type GovernanceDecision,
  GovernanceEngine,
  LearningEngine,
  type LearningReport,
  MissionEngine,
  PipelineEngine,
  type PipelineOptions,
  QualityEngine,
} from '@behavioros/core';
import type {
  AgentPersona,
  AgentRole,
  AgentStatus,
  AuditResult,
  AuditSeverity,
  AuthorityLevel,
  BoundaryRule,
  DNAPackage,
  LayerResult,
  LearningEvent,
  Mission,
  MissionPriority,
  MissionStatus,
  PipelineReport,
  PipelineState,
  QualityMetric,
  VotingStrategy,
} from '@behavioros/schemas';

// ============================================================
// BehaviorOS SDK — High-level API for AI Agent Orchestration
// ============================================================

export interface BehaviorOSConfig {
  dnaPath?: string;
  dnaPackage?: DNAPackage;
  dnaLoaderOptions?: DNALoaderOptions;
  governance?: BehaviorOSEngineConfig['governance'];
  quality?: BehaviorOSEngineConfig['quality'];
  learning?: BehaviorOSEngineConfig['learning'];
  audit?: BehaviorOSEngineConfig['audit'];
  outputDir?: string;
}

export interface BehaviorOSStatus {
  engine: boolean;
  dna: string | null;
  missions: number;
  agents: number;
  auditEvents: number;
  qualityMetrics: number;
  learningEvents: number;
}

export class BehaviorOS {
  private engine: BehaviorOSEngine | null = null;
  private auditEngine: AuditEngine;
  private learningEngine: LearningEngine;
  private decisionEngine: DecisionEngine;
  private governanceEngine: GovernanceEngine | null = null;
  private dna: DNAPackage | null = null;
  private initialized = false;
  private _dnaPath?: string;
  private _dnaLoaderOptions?: DNALoaderOptions;

  constructor(config: BehaviorOSConfig = {}) {
    // Initialize engines
    this.auditEngine = new AuditEngine();
    this.learningEngine = new LearningEngine({
      persistPath: config.learning?.persistPath,
      autoApply: config.learning?.autoApply,
    });
    this.decisionEngine = new DecisionEngine();

    // Load DNA if provided directly
    if (config.dnaPackage) {
      this.dna = config.dnaPackage;
    } else if (config.dnaPath) {
      // Store path for async loading in init()
      this._dnaPath = config.dnaPath;
      this._dnaLoaderOptions = config.dnaLoaderOptions;
    }

    // Initialize core engine if DNA is available
    if (this.dna) {
      this.engine = new BehaviorOSEngine({
        dna: this.dna,
        governance: config.governance,
        quality: config.quality,
        learning: config.learning,
        audit: config.audit,
      });

      if (this.dna.governance && this.dna.governance.length > 0) {
        this.governanceEngine = new GovernanceEngine(this.dna.governance);
      }

      this.initialized = true;
    }
  }

  // --- Initialization ---

  async init(): Promise<void> {
    if (this.initialized) return;

    // Load DNA asynchronously if path was provided
    if (this._dnaPath && !this.dna) {
      const loader = new DNALoader(this._dnaLoaderOptions);
      this.dna = await loader.load(this._dnaPath);
    }

    if (!this.dna) {
      throw new Error('BehaviorOS not initialized: no DNA package provided');
    }

    // Initialize core engine if not already done
    if (!this.engine) {
      this.engine = new BehaviorOSEngine({
        dna: this.dna,
      });

      if (this.dna.governance && this.dna.governance.length > 0) {
        this.governanceEngine = new GovernanceEngine(this.dna.governance);
      }
    }

    this.initialized = true;
  }

  /**
   * Carrega um pacote DNA a partir de um caminho
   */
  async loadDNA(path: string): Promise<void> {
    const loader = new DNALoader();
    this.dna = await loader.load(path);
    this.engine = new BehaviorOSEngine({ dna: this.dna });
    if (this.dna.governance && this.dna.governance.length > 0) {
      this.governanceEngine = new GovernanceEngine(this.dna.governance);
    }
    this.initialized = true;
  }

  // --- Mission Management ---

  async createMission(input: {
    title: string;
    description?: string;
    type: Mission['type'];
    priority?: Mission['priority'];
    context?: Record<string, unknown>;
  }): Promise<Mission> {
    this.ensureInitialized();
    return this.engine!.createMission(input);
  }

  async startMission(missionId: string): Promise<Mission> {
    this.ensureInitialized();
    return this.engine!.startMission(missionId);
  }

  async completeMission(missionId: string, output?: Record<string, unknown>): Promise<Mission> {
    this.ensureInitialized();
    return this.engine!.completeMission(missionId, output);
  }

  async failMission(missionId: string, error: Error): Promise<Mission> {
    this.ensureInitialized();
    return this.engine!.failMission(missionId, error);
  }

  getMission(id: string): Mission | undefined {
    return this.engine?.getMission(id);
  }

  getAllMissions(): Mission[] {
    return this.engine?.getAllMissions() ?? [];
  }

  // --- Agent Management ---

  getAllAgents() {
    return this.engine?.getAllAgents() ?? [];
  }

  getAgentsByRole(role: string) {
    return this.engine?.getAgentsByRole(role) ?? [];
  }

  // --- Governance ---

  async evaluateGovernance(action: string, context: Record<string, unknown>) {
    return (
      this.engine?.evaluateGovernance(action, context) ?? {
        approved: true,
        violations: [],
        warnings: [],
      }
    );
  }

  async evaluateGovernanceDetailed(context: GovernanceContext): Promise<GovernanceDecision> {
    if (!this.governanceEngine) {
      return { allowed: true, reason: 'No governance rules configured', escalationRequired: false };
    }
    return this.governanceEngine.evaluate(context);
  }

  // --- Quality ---

  async evaluateQuality(metrics: QualityMetric[]) {
    return this.engine?.evaluateQuality(metrics) ?? { passed: true, failedGates: [], metrics };
  }

  // --- Learning ---

  async recordLearning(event: Omit<LearningEvent, 'id' | 'timestamp'>) {
    return this.engine?.recordLearning(event) ?? this.learningEngine.record(event);
  }

  getLearningReport(): LearningReport {
    return this.learningEngine.generateReport();
  }

  // --- Audit ---

  async runAudit(projectPath: string, stages?: AuditStage[]): Promise<AuditPipelineResult> {
    return this.auditEngine.execute({ projectPath }, stages);
  }

  getAuditHistory(): AuditPipelineResult[] {
    return this.auditEngine.getHistory();
  }

  // --- Decisions ---

  async makeDecision(
    context: DecisionContext,
    votes: import('@behavioros/core').DecisionVote[],
  ): Promise<DecisionResult> {
    return this.decisionEngine.vote(context, votes);
  }

  // --- Pipeline (EAARG) ---

  private pipelineEngine: PipelineEngine | null = null;

  /**
   * Inicia um pipeline EAARG com o DNA carregado
   */
  async runPipeline(options: PipelineOptions = {}): Promise<PipelineState> {
    this.ensureInitialized();
    if (!this.dna) {
      throw new Error('No DNA package loaded for pipeline');
    }

    this.pipelineEngine = new PipelineEngine(this.dna, options);
    return this.pipelineEngine.start();
  }

  /**
   * Avança para a próxima layer do pipeline
   */
  async advancePipeline(): Promise<LayerResult> {
    if (!this.pipelineEngine) {
      throw new Error('No pipeline running. Call runPipeline() first.');
    }
    return this.pipelineEngine.advance();
  }

  /**
   * Pausa o pipeline em execução
   */
  pausePipeline(): PipelineState {
    if (!this.pipelineEngine) {
      throw new Error('No pipeline running.');
    }
    return this.pipelineEngine.pause();
  }

  /**
   * Retoma o pipeline pausado
   */
  resumePipeline(): PipelineState {
    if (!this.pipelineEngine) {
      throw new Error('No pipeline running.');
    }
    return this.pipelineEngine.resume();
  }

  /**
   * Valida uma layer específica com evidências
   */
  async validatePipelineLayer(layer: number, evidence: string[]): Promise<LayerResult> {
    if (!this.pipelineEngine) {
      throw new Error('No pipeline running. Call runPipeline() first.');
    }
    return this.pipelineEngine.validateLayer(layer, evidence);
  }

  /**
   * Obtém o estado atual do pipeline
   */
  getPipelineState(): PipelineState | undefined {
    return this.pipelineEngine?.getState();
  }

  /**
   * Obtém o relatório do pipeline
   */
  getPipelineReport(): PipelineReport | undefined {
    return this.pipelineEngine?.getReport();
  }

  /**
   * Obtém o progresso do pipeline
   */
  getPipelineProgress(): { current: number; total: number; percent: number } | undefined {
    return this.pipelineEngine?.getProgress();
  }

  // --- Status ---

  getStatus(): BehaviorOSStatus {
    return {
      engine: this.initialized,
      dna: this.dna?.name ?? null,
      missions: this.engine?.getAllMissions().length ?? 0,
      agents: this.engine?.getAllAgents().length ?? 0,
      auditEvents: this.engine?.getAuditLog().length ?? 0,
      qualityMetrics: this.engine?.getStats().qualityMetrics ?? 0,
      learningEvents: this.engine?.getStats().learningEvents ?? 0,
    };
  }

  // --- Stats ---

  getStats() {
    return (
      this.engine?.getStats() ?? {
        missions: {} as Record<string, number>,
        agents: {} as Record<string, number>,
        auditEvents: 0,
        qualityMetrics: 0,
        learningEvents: 0,
      }
    );
  }

  // --- Internal ---

  private ensureInitialized(): void {
    if (!this.initialized || !this.engine) {
      throw new Error('BehaviorOS not initialized. Call init() or provide DNA configuration.');
    }
  }
}

// Re-export everything
export {
  AuditEngine,
  type AuditPipelineResult,
  type AuditStage,
  BehaviorOSEngine,
  type CompositionResult,
  type DecisionContext,
  DecisionEngine,
  type DecisionResult,
  type DecisionVote,
  DNAComposer,
  DNALoader,
  DNALoaderOptions,
  DNAValidator,
  type EvidenceValidationResult,
  type GateCheckResult,
  type GovernanceContext,
  type GovernanceDecision,
  GovernanceEngine,
  type LayerExecutionResult,
  LearningEngine,
  type LearningReport,
  MissionEngine,
  type MissionPlan,
  type MissionProgress,
  PipelineEngine,
  type PipelineEngineEvents,
  type PipelineOptions,
  QualityEngine,
  type QualityReport,
  type ValidationResult,
} from '@behavioros/core';
export type {
  AgentPersona,
  AgentRole,
  AgentState,
  AgentStatus,
  AuditEvent,
  AuditResult,
  AuditSeverity,
  AuthorityLevel,
  BehaviorPattern,
  BoundaryRule,
  ConversationProtocol,
  DiscoveryQuestion,
  DNAPackage,
  EAARGStep,
  GovernanceRule,
  LayerCriteria,
  LayerResult,
  LearningEvent,
  Mission,
  MissionPriority,
  MissionStatus,
  PipelineReport,
  PipelineState,
  QualityGate,
  QualityMetric,
  RequiredEvidence,
  VotingStrategy,
} from '@behavioros/schemas';
