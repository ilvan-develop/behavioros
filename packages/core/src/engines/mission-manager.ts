import { randomUUID } from 'node:crypto';
import type { AgentState, Mission, MissionStatus } from '@behavioros/schemas';
import { MissionSchema } from '@behavioros/schemas';
import type EventEmitter from 'eventemitter3';

// ============================================================
// MissionManager — Extracted from BehaviorOSEngine
// Manages mission CRUD lifecycle
// ============================================================

type AuditFn = (
  type: string,
  severity: 'info' | 'warning' | 'error',
  result: 'pass' | 'fail' | 'skip',
  description: string,
  details?: Record<string, unknown>,
) => void;

/** Minimal emitter shape — avoids circular import with core-engine */
interface MissionEmitter {
  emit(event: string, ...args: unknown[]): boolean;
}

export class MissionManager {
  private missions: Map<string, Mission> = new Map();
  private emitter: MissionEmitter;
  private auditFn: AuditFn;

  constructor(emitter: MissionEmitter, auditFn: AuditFn) {
    this.emitter = emitter;
    this.auditFn = auditFn;
  }

  async create(input: {
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
    this.emitter.emit('mission:created', mission);
    this.auditFn('mission:created', 'info', 'pass', `Mission created: ${mission.title}`, {
      missionId: mission.id,
    });

    return mission;
  }

  async start(missionId: string, agents: Map<string, AgentState>): Promise<Mission> {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    const updated = {
      ...mission,
      status: 'executing' as const,
      startedAt: new Date().toISOString(),
    };
    this.missions.set(missionId, updated);

    const assignedAgents = this.selectAgents(agents);
    for (const agent of assignedAgents) {
      agent.status = 'working';
      agent.currentMission = missionId;
      this.emitter.emit('agent:assigned', agent, updated);
    }

    this.emitter.emit('mission:started', updated);
    this.auditFn('mission:started', 'info', 'pass', `Mission started: ${updated.title}`, {
      missionId,
    });

    return updated;
  }

  async complete(
    missionId: string,
    agents: Map<string, AgentState>,
    output?: Record<string, unknown>,
  ): Promise<Mission> {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    const updated = {
      ...mission,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      output,
    };
    this.missions.set(missionId, updated);

    for (const agent of agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = 'idle';
        agent.currentMission = undefined;
        agent.completedMissions.push(missionId);
        agent.reputation = Math.min(100, agent.reputation + 2);
      }
    }

    this.emitter.emit('mission:completed', updated);
    this.auditFn('mission:completed', 'info', 'pass', `Mission completed: ${updated.title}`, {
      missionId,
    });
    return updated;
  }

  async fail(missionId: string, agents: Map<string, AgentState>, error: Error): Promise<Mission> {
    const mission = this.missions.get(missionId);
    if (!mission) throw new Error(`Mission not found: ${missionId}`);

    const updated = {
      ...mission,
      status: 'failed' as const,
      completedAt: new Date().toISOString(),
    };
    this.missions.set(missionId, updated);

    for (const agent of agents.values()) {
      if (agent.currentMission === missionId) {
        agent.status = 'idle';
        agent.currentMission = undefined;
        agent.reputation = Math.max(0, agent.reputation - 5);
      }
    }

    this.emitter.emit('mission:failed', updated, error);
    this.auditFn(
      'mission:failed',
      'error',
      'fail',
      `Mission failed: ${updated.title} — ${error.message}`,
      { missionId },
    );
    return updated;
  }

  get(id: string): Mission | undefined {
    return this.missions.get(id);
  }

  getAll(): Mission[] {
    return Array.from(this.missions.values());
  }

  getByStatus(status: MissionStatus): Mission[] {
    return Array.from(this.missions.values()).filter((m) => m.status === status);
  }

  private selectAgents(agents: Map<string, AgentState>): AgentState[] {
    const available = Array.from(agents.values()).filter((a) => a.status === 'idle');
    return available
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, Math.min(3, available.length));
  }
}
