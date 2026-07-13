import { BehaviorOSEngine, type BehaviorOSEngineConfig } from '@behavioros/core'
import { DNALoader, type DNALoaderOptions } from '@behavioros/core'
import { AuditEngine, type AuditStage, type AuditPipelineResult } from '@behavioros/core'
import { QualityEngine, type QualityReport } from '@behavioros/core'
import { LearningEngine, type LearningReport } from '@behavioros/core'
import { MissionEngine, type MissionPlan, type MissionProgress } from '@behavioros/core'
import { DecisionEngine, type DecisionContext, type DecisionResult } from '@behavioros/core'
import { GovernanceEngine, type GovernanceContext, type GovernanceDecision } from '@behavioros/core'
import type { DNAPackage, Mission, AuditEvent, QualityMetric, LearningEvent } from '@behavioros/schemas'

// ============================================================
// BehaviorOS SDK — High-level API for AI Agent Orchestration
// ============================================================

export interface BehaviorOSConfig {
  dnaPath?: string
  dnaPackage?: DNAPackage
  dnaLoaderOptions?: DNALoaderOptions
  governance?: BehaviorOSEngineConfig['governance']
  quality?: BehaviorOSEngineConfig['quality']
  learning?: BehaviorOSEngineConfig['learning']
  audit?: BehaviorOSEngineConfig['audit']
  outputDir?: string
}

export interface BehaviorOSStatus {
  engine: boolean
  dna: string | null
  missions: number
  agents: number
  auditEvents: number
  qualityMetrics: number
  learningEvents: number
}

export class BehaviorOS {
  private engine: BehaviorOSEngine | null = null
  private auditEngine: AuditEngine
  private qualityEngine: QualityEngine
  private learningEngine: LearningEngine
  private missionEngine: MissionEngine
  private decisionEngine: DecisionEngine
  private governanceEngine: GovernanceEngine | null = null
  private dna: DNAPackage | null = null
  private initialized = false

  constructor(config: BehaviorOSConfig = {}) {
    // Initialize engines
    this.auditEngine = new AuditEngine()
    this.qualityEngine = new QualityEngine(config.quality?.enabled === false ? [] : undefined)
    this.learningEngine = new LearningEngine({
      persistPath: config.learning?.persistPath,
      autoApply: config.learning?.autoApply,
    })
    this.missionEngine = new MissionEngine()
    this.decisionEngine = new DecisionEngine()

    // Load DNA if provided
    if (config.dnaPackage) {
      this.dna = config.dnaPackage
    } else if (config.dnaPath) {
      const loader = new DNALoader(config.dnaLoaderOptions)
      this.dna = loader.load(config.dnaPath)
    }

    // Initialize core engine if DNA is available
    if (this.dna) {
      this.engine = new BehaviorOSEngine({
        dna: this.dna,
        governance: config.governance,
        quality: config.quality,
        learning: config.learning,
        audit: config.audit,
      })

      if (this.dna.governance && this.dna.governance.length > 0) {
        this.governanceEngine = new GovernanceEngine(this.dna.governance)
      }

      this.initialized = true
    }
  }

  // --- Initialization ---

  async init(): Promise<void> {
    if (this.initialized) return
    if (!this.engine) {
      throw new Error('BehaviorOS not initialized: no DNA package provided')
    }
    this.initialized = true
  }

  /**
   * Carrega um pacote DNA a partir de um caminho
   */
  loadDNA(path: string): void {
    const loader = new DNALoader()
    this.dna = loader.load(path)
    this.engine = new BehaviorOSEngine({ dna: this.dna })
    if (this.dna.governance && this.dna.governance.length > 0) {
      this.governanceEngine = new GovernanceEngine(this.dna.governance)
    }
    this.initialized = true
  }

  // --- Mission Management ---

  async createMission(input: {
    title: string
    description?: string
    type: Mission['type']
    priority?: Mission['priority']
    context?: Record<string, unknown>
  }): Promise<Mission> {
    this.ensureInitialized()
    return this.engine!.createMission(input)
  }

  async startMission(missionId: string): Promise<Mission> {
    this.ensureInitialized()
    return this.engine!.startMission(missionId)
  }

  async completeMission(missionId: string, output?: Record<string, unknown>): Promise<Mission> {
    this.ensureInitialized()
    return this.engine!.completeMission(missionId, output)
  }

  async failMission(missionId: string, error: Error): Promise<Mission> {
    this.ensureInitialized()
    return this.engine!.failMission(missionId, error)
  }

  getMission(id: string): Mission | undefined {
    return this.engine?.getMission(id)
  }

  getAllMissions(): Mission[] {
    return this.engine?.getAllMissions() ?? []
  }

  // --- Agent Management ---

  getAllAgents() {
    return this.engine?.getAllAgents() ?? []
  }

  getAgentsByRole(role: string) {
    return this.engine?.getAgentsByRole(role) ?? []
  }

  // --- Governance ---

  async evaluateGovernance(action: string, context: Record<string, unknown>) {
    return this.engine?.evaluateGovernance(action, context) ?? { approved: true, violations: [], warnings: [] }
  }

  async evaluateGovernanceDetailed(context: GovernanceContext): Promise<GovernanceDecision> {
    if (!this.governanceEngine) {
      return { allowed: true, reason: 'No governance rules configured', escalationRequired: false }
    }
    return this.governanceEngine.evaluate(context)
  }

  // --- Quality ---

  async evaluateQuality(metrics: QualityMetric[]) {
    return this.engine?.evaluateQuality(metrics) ?? { passed: true, failedGates: [], metrics }
  }

  // --- Learning ---

  async recordLearning(event: Omit<LearningEvent, 'id' | 'timestamp'>) {
    return this.engine?.recordLearning(event) ?? this.learningEngine.record(event)
  }

  getLearningReport(): LearningReport {
    return this.learningEngine.generateReport()
  }

  // --- Audit ---

  async runAudit(projectPath: string, stages?: AuditStage[]): Promise<AuditPipelineResult> {
    return this.auditEngine.execute({ projectPath }, stages)
  }

  getAuditHistory(): AuditPipelineResult[] {
    return this.auditEngine.getHistory()
  }

  // --- Decisions ---

  async makeDecision(context: DecisionContext, votes: import('@behavioros/core').DecisionVote[]): Promise<DecisionResult> {
    return this.decisionEngine.vote(context, votes)
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
    }
  }

  // --- Stats ---

  getStats() {
    return this.engine?.getStats() ?? {
      missions: {} as Record<string, number>,
      agents: {} as Record<string, number>,
      auditEvents: 0,
      qualityMetrics: 0,
      learningEvents: 0,
    }
  }

  // --- Internal ---

  private ensureInitialized(): void {
    if (!this.initialized || !this.engine) {
      throw new Error('BehaviorOS not initialized. Call init() or provide DNA configuration.')
    }
  }
}

// Re-export everything
export { BehaviorOSEngine, DNALoader, DNALoaderOptions } from '@behavioros/core'
export { DNAValidator, type ValidationResult } from '@behavioros/core'
export { DNAComposer, type CompositionResult } from '@behavioros/core'
export { AuditEngine, type AuditStage, type AuditPipelineResult } from '@behavioros/core'
export { QualityEngine, type QualityReport } from '@behavioros/core'
export { LearningEngine, type LearningReport } from '@behavioros/core'
export { MissionEngine, type MissionPlan, type MissionProgress } from '@behavioros/core'
export { DecisionEngine, type DecisionContext, type DecisionResult, type DecisionVote } from '@behavioros/core'
export { GovernanceEngine, type GovernanceContext, type GovernanceDecision } from '@behavioros/core'
export type {
  DNAPackage,
  Mission,
  AgentState,
  AuditEvent,
  QualityMetric,
  LearningEvent,
  BehaviorPattern,
  GovernanceRule,
  QualityGate,
} from '@behavioros/schemas'
