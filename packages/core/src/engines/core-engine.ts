import EventEmitter from 'eventemitter3'
import type {
  DNAPackage,
  Mission,
  MissionStatus,
  AgentState,
  AuditEvent,
  AuditResult,
  QualityMetric,
  LearningEvent,
  BehaviorOSConfig,
  BehaviorPattern,
  GovernanceRule,
  QualityGate,
} from '@behavioros/schemas'
import { MissionSchema } from '@behavioros/schemas'
import { randomUUID } from 'node:crypto'

// ============================================================
// BehaviorOS Core Engine — Central Orchestrator
// ============================================================

export interface EngineEvents {
  'mission:created': (mission: Mission) => void
  'mission:started': (mission: Mission) => void
  'mission:completed': (mission: Mission) => void
  'mission:failed': (mission: Mission, error: Error) => void
  'agent:assigned': (agent: AgentState, mission: Mission) => void
  'agent:status': (agent: AgentState, status: string) => void
  'audit:event': (event: AuditEvent) => void
  'quality:metric': (metric: QualityMetric) => void
  'learning:event': (event: LearningEvent) => void
  'governance:violation': (rule: GovernanceRule, context: unknown) => void
  'governance:approved': (rule: GovernanceRule, context: unknown) => void
}

export interface BehaviorOSEngineConfig {
  dna: DNAPackage
  governance?: BehaviorOSConfig['governance']
  quality?: BehaviorOSConfig['quality']
  learning?: BehaviorOSConfig['learning']
  audit?: BehaviorOSConfig['audit']
}

export class BehaviorOSEngine extends EventEmitter<EngineEvents> {
  private dna: DNAPackage
  private missions: Map<string, Mission> = new Map()
  private agents: Map<string, AgentState> = new Map()
  private auditLog: AuditEvent[] = []
  private qualityMetrics: QualityMetric[] = []
  private learningEvents: LearningEvent[] = []
  private config: BehaviorOSEngineConfig

  constructor(config: BehaviorOSEngineConfig) {
    super()
    this.config = config
    this.dna = config.dna
    this.initializeAgents()
  }

  private initializeAgents(): void {
    for (const persona of this.dna.personas) {
      const agent: AgentState = {
        id: `agent-${persona.role}-${randomUUID().slice(0, 8)}`,
        role: persona.role,
        status: 'idle',
        authority: persona.authority,
        completedMissions: [],
        reputation: 50,
      }
      this.agents.set(agent.id, agent)
    }
  }

  async createMission(input: {
    title: string
    description?: string
    type: Mission['type']
    priority?: Mission['priority']
    context?: Record<string, unknown>
  }): Promise<Mission> {
    const mission = MissionSchema.parse({
      id: randomUUID(),
      title: input.title,
      description: input.description,
      type: input.type,
      priority: input.priority ?? 'medium',
      status: 'draft',
      context: input.context ?? {},
    })

    this.missions.set(mission.id, mission)
    this.emit('mission:created', mission)
    this.auditEvent('mission:created', 'info', 'pass', `Mission created: ${mission.title}`, { missionId: mission.id })

    return mission
  }

  async startMission(missionId: string): Promise<Mission> {
    const mission = this.missions.get(missionId)
    if (!mission) throw new Error(`Mission not found: ${missionId}`)

    const updated = { ...mission, status: 'executing' as const, startedAt: new Date().toISOString() }
    this.missions.set(missionId, updated)

    const assignedAgents = this.selectAgents(updated)
    for (const agent of assignedAgents) {
      agent.status = 'working'
      agent.currentMission = missionId
      this.emit('agent:assigned', agent, updated)
    }

    this.emit('mission:started', updated)
    this.auditEvent('mission:started', 'info', 'pass', `Mission started: ${updated.title}`, { missionId })

    return updated
  }

  async completeMission(missionId: string, output?: Record<string, unknown>): Promise<Mission> {
    const mission = this.missions.get(missionId)
    if (!mission) throw new Error(`Mission not found: ${missionId}`)

    const updated = { ...mission, status: 'completed' as const, completedAt: new Date().toISOString(), output }
    this.missions.set(missionId, updated)

    for (const agent of this.agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = 'idle'
        agent.currentMission = undefined
        agent.completedMissions.push(missionId)
        agent.reputation = Math.min(100, agent.reputation + 2)
      }
    }

    this.emit('mission:completed', updated)
    this.auditEvent('mission:completed', 'info', 'pass', `Mission completed: ${updated.title}`, { missionId })
    return updated
  }

  async failMission(missionId: string, error: Error): Promise<Mission> {
    const mission = this.missions.get(missionId)
    if (!mission) throw new Error(`Mission not found: ${missionId}`)

    const updated = { ...mission, status: 'failed' as const, completedAt: new Date().toISOString() }
    this.missions.set(missionId, updated)

    for (const agent of this.agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = 'idle'
        agent.currentMission = undefined
        agent.reputation = Math.max(0, agent.reputation - 5)
      }
    }

    this.emit('mission:failed', updated, error)
    this.auditEvent('mission:failed', 'error', 'fail', `Mission failed: ${updated.title} — ${error.message}`, { missionId })
    return updated
  }

  private selectAgents(mission: Mission): AgentState[] {
    const available = Array.from(this.agents.values()).filter((a) => a.status === 'idle')
    return available.sort((a, b) => b.reputation - a.reputation).slice(0, Math.min(3, available.length))
  }

  getAgent(id: string): AgentState | undefined { return this.agents.get(id) }
  getAllAgents(): AgentState[] { return Array.from(this.agents.values()) }
  getAgentsByRole(role: string): AgentState[] { return Array.from(this.agents.values()).filter((a) => a.role === role) }

  async evaluateGovernance(action: string, context: Record<string, unknown>) {
    if (!this.config.governance?.enabled) return { approved: true, violations: [] as GovernanceRule[], warnings: [] as GovernanceRule[] }

    const rules = this.dna.governance ?? []
    const violations: GovernanceRule[] = []
    const warnings: GovernanceRule[] = []

    for (const rule of rules) {
      if (rule.conditions?.some((c) => c.includes(action) || c.includes(String(context.type)))) {
        if (rule.level === 'critical' || rule.level === 'high') {
          violations.push(rule)
          this.emit('governance:violation', rule, context)
        } else {
          warnings.push(rule)
        }
      }
    }

    return { approved: violations.length === 0, violations, warnings }
  }

  async evaluateQuality(metrics: QualityMetric[]) {
    if (!this.config.quality?.enabled) return { passed: true, failedGates: [] as QualityGate[], metrics }

    const gates = this.dna.quality ?? []
    const failedGates: QualityGate[] = []
    const enriched: QualityMetric[] = []

    for (const metric of metrics) {
      const gate = gates.find((g) => g.name === metric.name)
      const m = { ...metric, timestamp: new Date().toISOString() }
      if (gate?.threshold !== undefined) { m.threshold = gate.threshold; m.passed = metric.value >= gate.threshold }
      if (m.passed === false) failedGates.push(gate!)
      enriched.push(m)
      this.qualityMetrics.push(m)
      this.emit('quality:metric', m)
    }

    return { passed: failedGates.length === 0, failedGates, metrics: enriched }
  }

  async recordLearning(event: Omit<LearningEvent, 'id' | 'timestamp'>): Promise<LearningEvent> {
    const enriched: LearningEvent = { id: randomUUID(), timestamp: new Date().toISOString(), ...event }
    this.learningEvents.push(enriched)
    this.emit('learning:event', enriched)
    return enriched
  }

  getLearningEvents(): LearningEvent[] { return [...this.learningEvents] }

  private auditEvent(type: string, severity: AuditEvent['severity'], result: AuditResult, description: string, details?: Record<string, unknown>): AuditEvent {
    const event: AuditEvent = { id: randomUUID(), timestamp: new Date().toISOString(), type, severity, result, description, details }
    this.auditLog.push(event)
    this.emit('audit:event', event)
    return event
  }

  getAuditLog(): AuditEvent[] { return [...this.auditLog] }
  getMission(id: string): Mission | undefined { return this.missions.get(id) }
  getAllMissions(): Mission[] { return Array.from(this.missions.values()) }
  getMissionsByStatus(status: MissionStatus): Mission[] { return Array.from(this.missions.values()).filter((m) => m.status === status) }
  getPatternsByType(type: BehaviorPattern['type']): BehaviorPattern[] { return (this.dna.patterns ?? []).filter((p) => p.type === type) }
  getPatternByName(name: string): BehaviorPattern | undefined { return (this.dna.patterns ?? []).find((p) => p.name === name) }
  getGovernanceRules(): GovernanceRule[] { return [...(this.dna.governance ?? [])] }
  getGovernanceRuleById(id: string): GovernanceRule | undefined { return (this.dna.governance ?? []).find((r) => r.id === id) }
  getQualityGates(): QualityGate[] { return [...(this.dna.quality ?? [])] }
  getQualityGateByName(name: string): QualityGate | undefined { return (this.dna.quality ?? []).find((g) => g.name === name) }

  getStats() {
    const missions: Record<string, number> = {}
    for (const m of this.missions.values()) missions[m.status] = (missions[m.status] || 0) + 1
    const agents: Record<string, number> = {}
    for (const a of this.agents.values()) agents[a.status] = (agents[a.status] || 0) + 1
    return { missions: missions as Record<MissionStatus, number>, agents, auditEvents: this.auditLog.length, qualityMetrics: this.qualityMetrics.length, learningEvents: this.learningEvents.length }
  }
}
