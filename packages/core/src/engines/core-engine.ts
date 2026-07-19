import { randomUUID } from 'node:crypto';
import type {
  AuditEvent,
  AuditResult,
  BehaviorOSConfig,
  BehaviorPattern,
  DNAPackage,
  GovernanceRule,
  LearningEvent,
  Mission,
  MissionStatus,
  QualityGate,
  QualityMetric,
} from '@behavioros/schemas';
import EventEmitter from 'eventemitter3';
import { AgentManager } from './agent-manager';
import type { AuditPipelineResult, AuditStage } from './audit/audit-engine';
import { AuditEngine } from './audit/audit-engine';
import type { AuthorityLevelValue, GovernanceContext } from './governance/governance-engine';
import { GovernanceEngine } from './governance/governance-engine';
import { LearningEngine } from './learning/learning-engine';
import { MissionEngine } from './mission/mission-engine';
import { MissionManager } from './mission-manager';
import { QualityEngine } from './quality/quality-engine';

// ============================================================
// BehaviorOS Core Engine — Central Orchestrator (Facade)
// Delegates to MissionManager, AgentManager, and sub-engines
// ============================================================

export interface EngineEvents {
  'mission:created': (mission: Mission) => void;
  'mission:started': (mission: Mission) => void;
  'mission:completed': (mission: Mission) => void;
  'mission:failed': (mission: Mission, error: Error) => void;
  'agent:assigned': (agent: any, mission: Mission) => void;
  'agent:status': (agent: any, status: string) => void;
  'audit:event': (event: AuditEvent) => void;
  'quality:metric': (metric: QualityMetric) => void;
  'learning:event': (event: LearningEvent) => void;
  'governance:violation': (rule: GovernanceRule, context: unknown) => void;
  'governance:approved': (rule: GovernanceRule, context: unknown) => void;
}

export interface BehaviorOSEngineConfig {
  dna: DNAPackage;
  governance?: BehaviorOSConfig['governance'];
  quality?: BehaviorOSConfig['quality'];
  learning?: BehaviorOSConfig['learning'];
  audit?: BehaviorOSConfig['audit'];
}

export class BehaviorOSEngine extends EventEmitter<EngineEvents> {
  private dna: DNAPackage;
  private auditLog: AuditEvent[] = [];
  private qualityMetrics: QualityMetric[] = [];
  private config: BehaviorOSEngineConfig;

  // Extracted managers
  private missionManager: MissionManager;
  private agentManager: AgentManager;

  // Sub-engines — public for advanced usage
  public governanceEngine: GovernanceEngine;
  public qualityEngine: QualityEngine;
  public learningEngine: LearningEngine;
  public missionEngine: MissionEngine;
  public auditEngine: AuditEngine;

  constructor(config: BehaviorOSEngineConfig) {
    super();
    this.config = config;
    this.dna = config.dna;

    // Instantiate sub-engines
    this.governanceEngine = new GovernanceEngine(this.dna.governance ?? []);
    this.qualityEngine = new QualityEngine(this.dna.quality ?? [], {
      minScore: config.quality?.minCoverage ?? 80,
    });
    this.learningEngine = new LearningEngine({
      persistPath: config.learning?.persistPath,
      autoApply: config.learning?.autoApply,
    });
    this.missionEngine = new MissionEngine();
    this.auditEngine = new AuditEngine();

    // Instantiate extracted managers
    this.agentManager = new AgentManager(this.dna);
    this.missionManager = new MissionManager(this, this.auditEvent.bind(this));
  }

  // ─── Mission Management (delegates to MissionManager) ─────

  async createMission(input: {
    title: string;
    description?: string;
    type: Mission['type'];
    priority?: Mission['priority'];
    context?: Record<string, unknown>;
  }): Promise<Mission> {
    return this.missionManager.create(input);
  }

  async startMission(missionId: string): Promise<Mission> {
    return this.missionManager.start(missionId, this.agentManager.getRawMap());
  }

  async completeMission(missionId: string, output?: Record<string, unknown>): Promise<Mission> {
    return this.missionManager.complete(missionId, this.agentManager.getRawMap(), output);
  }

  async failMission(missionId: string, error: Error): Promise<Mission> {
    return this.missionManager.fail(missionId, this.agentManager.getRawMap(), error);
  }

  // ─── Agent Management (delegates to AgentManager) ─────────

  getAgent(id: string) {
    return this.agentManager.get(id);
  }
  getAgentByOpenCodeName(name: string) {
    return this.agentManager.getByOpenCodeName(name);
  }
  getAllAgents() {
    return this.agentManager.getAll();
  }
  getAgentsByRole(role: string) {
    return this.agentManager.getByRole(role);
  }

  // ─── Governance (delegates to GovernanceEngine) ──────────

  async evaluateGovernance(action: string, context: Record<string, unknown>) {
    if (!this.config.governance?.enabled)
      return {
        approved: true,
        violations: [] as GovernanceRule[],
        warnings: [] as GovernanceRule[],
        reason: undefined as string | undefined,
      };

    const govContext: GovernanceContext = {
      agentId: (context.agentId as string) ?? 'system',
      agentRole: (context.agentRole as string) ?? 'system',
      agentAuthority: (context.agentAuthority as AuthorityLevelValue) ?? 'c-level',
      action,
      targetType: this.mapTargetType(context),
      impact: this.mapImpact(context),
      metadata: context,
    };

    const decision = this.governanceEngine.evaluate(govContext);
    const applicableRules = this.governanceEngine.getApplicableRules(govContext);

    const violations: GovernanceRule[] = [];
    const warnings: GovernanceRule[] = [];

    for (const rule of applicableRules) {
      if (rule.level === 'critical' || rule.level === 'high') {
        violations.push(rule);
        this.emit('governance:violation', rule, context);
      } else {
        warnings.push(rule);
      }
    }

    if (!decision.allowed && violations.length === 0) {
      if (decision.rule) {
        violations.push(decision.rule);
        this.emit('governance:violation', decision.rule, context);
      }
    }

    return {
      approved: decision.allowed,
      violations,
      warnings,
      reason: decision.allowed ? undefined : decision.reason,
    };
  }

  evaluateGovernanceDetailed(context: GovernanceContext) {
    return this.governanceEngine.evaluate(context);
  }

  private mapTargetType(context: Record<string, unknown>): GovernanceContext['targetType'] {
    const type = String(context.targetType ?? context.type ?? '').toLowerCase();
    if (
      (['file', 'module', 'service', 'config', 'infrastructure', 'database'] as string[]).includes(
        type,
      )
    ) {
      return type as GovernanceContext['targetType'];
    }
    return type as GovernanceContext['targetType'];
  }

  private mapImpact(context: Record<string, unknown>): GovernanceContext['impact'] {
    const impact = String(context.impact ?? '').toLowerCase();
    if ((['low', 'medium', 'high', 'critical'] as string[]).includes(impact)) {
      return impact as GovernanceContext['impact'];
    }
    return 'medium';
  }

  // ─── Quality (delegates to QualityEngine) ────────────────

  async evaluateQuality(metrics: QualityMetric[]) {
    if (!this.config.quality?.enabled)
      return { passed: true, failedGates: [] as QualityGate[], metrics };

    const report = this.qualityEngine.evaluate(metrics);

    const failedGates: QualityGate[] = [];
    for (const check of report.checks) {
      if (!check.passed) {
        const gate = this.dna.quality?.find((g) => g.name === check.gate);
        if (gate) failedGates.push(gate);
      }
    }

    for (const m of report.metrics) {
      this.qualityMetrics.push(m);
      this.emit('quality:metric', m);
    }

    return { passed: report.passed, failedGates, metrics: report.metrics };
  }

  // ─── Learning (delegates to LearningEngine) ──────────────

  async recordLearning(event: Omit<LearningEvent, 'id' | 'timestamp'>): Promise<LearningEvent> {
    const enriched = this.learningEngine.record(event);
    this.emit('learning:event', enriched);
    return enriched;
  }

  getLearningEvents(): LearningEvent[] {
    return this.learningEngine.getEvents();
  }

  // ─── Audit (delegates to AuditEngine) ────────────────────

  async runAudit(projectPath: string, stages?: AuditStage[]): Promise<AuditPipelineResult> {
    return this.auditEngine.execute({ projectPath }, stages);
  }

  getAuditHistory(): AuditPipelineResult[] {
    return this.auditEngine.getHistory();
  }

  // ─── Internal Audit Log ───────────────────────────────────

  private auditEvent(
    type: string,
    severity: AuditEvent['severity'],
    result: AuditResult,
    description: string,
    details?: Record<string, unknown>,
  ): AuditEvent {
    const event: AuditEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      severity,
      result,
      description,
      details,
    };
    this.auditLog.push(event);
    this.emit('audit:event', event);
    return event;
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  // ─── Query Methods ────────────────────────────────────────

  getMission(id: string): Mission | undefined {
    return this.missionManager.get(id);
  }
  getAllMissions(): Mission[] {
    return this.missionManager.getAll();
  }
  getMissionsByStatus(status: MissionStatus): Mission[] {
    return this.missionManager.getByStatus(status);
  }
  getPatternsByType(type: BehaviorPattern['type']): BehaviorPattern[] {
    return (this.dna.patterns ?? []).filter((p) => p.type === type);
  }
  getPatternByName(name: string): BehaviorPattern | undefined {
    return (this.dna.patterns ?? []).find((p) => p.name === name);
  }
  getGovernanceRules(): GovernanceRule[] {
    return [...(this.dna.governance ?? [])];
  }
  getGovernanceRuleById(id: string): GovernanceRule | undefined {
    return (this.dna.governance ?? []).find((r) => r.id === id);
  }
  getQualityGates(): QualityGate[] {
    return [...(this.dna.quality ?? [])];
  }
  getQualityGateByName(name: string): QualityGate | undefined {
    return (this.dna.quality ?? []).find((g) => g.name === name);
  }

  // ─── Stats ────────────────────────────────────────────────

  getStats() {
    const missions: Record<string, number> = {};
    for (const m of this.missionManager.getAll())
      missions[m.status] = (missions[m.status] || 0) + 1;
    const agents: Record<string, number> = {};
    for (const a of this.agentManager.getAll()) agents[a.status] = (agents[a.status] || 0) + 1;
    return {
      missions: missions as Record<MissionStatus, number>,
      agents,
      auditEvents: this.auditLog.length,
      qualityMetrics: this.qualityMetrics.length,
      learningEvents: this.learningEngine.getEvents().length,
    };
  }
}
