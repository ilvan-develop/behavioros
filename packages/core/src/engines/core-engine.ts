import { randomUUID } from 'node:crypto';
import type {
  AgentState,
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
import { MissionSchema } from '@behavioros/schemas';
import EventEmitter from 'eventemitter3';
import type { AuditContext, AuditPipelineResult, AuditStage } from './audit/audit-engine';
// Real engines
import { AuditEngine } from './audit/audit-engine';
import type { AuthorityLevelValue, GovernanceContext } from './governance/governance-engine';
import { GovernanceEngine } from './governance/governance-engine';
import { LearningEngine } from './learning/learning-engine';
import { MissionEngine } from './mission/mission-engine';
import { QualityEngine } from './quality/quality-engine';

// ============================================================
// BehaviorOS Core Engine — Central Orchestrator
// ============================================================

export interface EngineEvents {
  'mission:created': (mission: Mission) => void;
  'mission:started': (mission: Mission) => void;
  'mission:completed': (mission: Mission) => void;
  'mission:failed': (mission: Mission, error: Error) => void;
  'agent:assigned': (agent: AgentState, mission: Mission) => void;
  'agent:status': (agent: AgentState, status: string) => void;
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
  private missions: Map<string, Mission> = new Map();
  private agents: Map<string, AgentState> = new Map();
  private auditLog: AuditEvent[] = [];
  private qualityMetrics: QualityMetric[] = [];
  private config: BehaviorOSEngineConfig;

  // Real engine instances — public for advanced usage
  public governanceEngine: GovernanceEngine;
  public qualityEngine: QualityEngine;
  public learningEngine: LearningEngine;
  public missionEngine: MissionEngine;
  public auditEngine: AuditEngine;

  constructor(config: BehaviorOSEngineConfig) {
    super();
    this.config = config;
    this.dna = config.dna;

    // Instantiate real engines
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

    this.initializeAgents();
  }

  private initializeAgents(): void {
    // 1. Register agents from personas
    for (const persona of this.dna.personas) {
      const agent: AgentState = {
        id: `agent-${persona.role}-${randomUUID().slice(0, 8)}`,
        role: persona.role,
        status: 'idle',
        authority: persona.authority,
        completedMissions: [],
        reputation: 50,
      };
      this.agents.set(agent.id, agent);
    }

    // 2. Register agents from agent_mapping (skip duplicates)
    if (this.dna.agent_mapping) {
      for (const mapping of Object.values(this.dna.agent_mapping)) {
        for (const agentName of mapping.opencode_agents) {
          if (this.agents.has(agentName)) continue;
          const agent: AgentState = {
            id: agentName,
            role: mapping.role,
            status: 'idle',
            authority: mapping.authority,
            completedMissions: [],
            reputation: 50,
          };
          this.agents.set(agent.id, agent);
        }
      }
    }
  }

  // ─── Mission Management ────────────────────────────────────

  async createMission(input: {
    title: string;
    description?: string;
    type: Mission['type'];
    priority?: Mission['priority'];
    context?: Record<string, unknown>;
  }): Promise<Mission> {
    const mission = MissionSchema.parse({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority ?? 'medium',
      status: 'draft',
      context: input.context ?? {},
    });

    this.missions.set(mission.id, mission);
    this.emit('mission:created', mission);
    this.auditEvent('mission:created', 'info', 'pass', `Mission created: ${mission.title}`, {
      missionId: mission.id,
    });

    return mission;
  }

  async startMission(missionId: string): Promise<Mission> {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    const updated = {
      ...mission,
      status: 'executing' as const,
      startedAt: new Date().toISOString(),
    };
    this.missions.set(missionId, updated);

    const assignedAgents = this.selectAgents(updated);
    for (const agent of assignedAgents) {
      agent.status = 'working';
      agent.currentMission = missionId;
      this.emit('agent:assigned', agent, updated);
    }

    this.emit('mission:started', updated);
    this.auditEvent('mission:started', 'info', 'pass', `Mission started: ${updated.title}`, {
      missionId,
    });

    return updated;
  }

  async completeMission(missionId: string, output?: Record<string, unknown>): Promise<Mission> {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    const updated = {
      ...mission,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      output,
    };
    this.missions.set(missionId, updated);

    for (const agent of this.agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = 'idle';
        agent.currentMission = undefined;
        agent.completedMissions.push(missionId);
        agent.reputation = Math.min(100, agent.reputation + 2);
      }
    }

    this.emit('mission:completed', updated);
    this.auditEvent('mission:completed', 'info', 'pass', `Mission completed: ${updated.title}`, {
      missionId,
    });
    return updated;
  }

  async failMission(missionId: string, error: Error): Promise<Mission> {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    const updated = {
      ...mission,
      status: 'failed' as const,
      completedAt: new Date().toISOString(),
    };
    this.missions.set(missionId, updated);

    for (const agent of this.agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = 'idle';
        agent.currentMission = undefined;
        agent.reputation = Math.max(0, agent.reputation - 5);
      }
    }

    this.emit('mission:failed', updated, error);
    this.auditEvent(
      'mission:failed',
      'error',
      'fail',
      `Mission failed: ${updated.title} — ${error.message}`,
      { missionId },
    );
    return updated;
  }

  private selectAgents(_mission: Mission): AgentState[] {
    const available = Array.from(this.agents.values()).filter((a) => a.status === 'idle');
    return available
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, Math.min(3, available.length));
  }

  // ─── Agent Management ──────────────────────────────────────

  getAgent(id: string): AgentState | undefined {
    return this.agents.get(id);
  }
  getAgentByOpenCodeName(name: string): AgentState | undefined {
    return Array.from(this.agents.values()).find((a) => a.id === name);
  }
  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }
  getAgentsByRole(role: string): AgentState[] {
    return Array.from(this.agents.values()).filter((a) => a.role === role);
  }

  // ─── Governance (delegates to real GovernanceEngine) ──────

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
    // Direct match to GovernanceContext targetType enum
    if (
      (['file', 'module', 'service', 'config', 'infrastructure', 'database'] as string[]).includes(
        type,
      )
    ) {
      return type as GovernanceContext['targetType'];
    }
    // For DNA condition types (e.g. "security", "payment", "api"), return raw value.
    // The real GovernanceEngine.ruleApplies() checks condition.includes(targetType),
    // so "type:security".includes("security") === true.
    return type as GovernanceContext['targetType'];
  }

  private mapImpact(context: Record<string, unknown>): GovernanceContext['impact'] {
    const impact = String(context.impact ?? '').toLowerCase();
    if ((['low', 'medium', 'high', 'critical'] as string[]).includes(impact)) {
      return impact as GovernanceContext['impact'];
    }
    return 'medium';
  }

  // ─── Quality (delegates to real QualityEngine) ────────────

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

  // ─── Learning (delegates to real LearningEngine) ──────────

  async recordLearning(event: Omit<LearningEvent, 'id' | 'timestamp'>): Promise<LearningEvent> {
    const enriched = this.learningEngine.record(event);
    this.emit('learning:event', enriched);
    return enriched;
  }

  getLearningEvents(): LearningEvent[] {
    return this.learningEngine.getEvents();
  }

  // ─── Audit (delegates to real AuditEngine) ────────────────

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
    return this.missions.get(id);
  }
  getAllMissions(): Mission[] {
    return Array.from(this.missions.values());
  }
  getMissionsByStatus(status: MissionStatus): Mission[] {
    return Array.from(this.missions.values()).filter((m) => m.status === status);
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
    for (const m of this.missions.values()) missions[m.status] = (missions[m.status] || 0) + 1;
    const agents: Record<string, number> = {};
    for (const a of this.agents.values()) agents[a.status] = (agents[a.status] || 0) + 1;
    return {
      missions: missions as Record<MissionStatus, number>,
      agents,
      auditEvents: this.auditLog.length,
      qualityMetrics: this.qualityMetrics.length,
      learningEvents: this.learningEngine.getEvents().length,
    };
  }
}
