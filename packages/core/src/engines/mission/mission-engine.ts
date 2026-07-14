import { randomUUID } from 'node:crypto';
import type { Mission, MissionStatus } from '@behavioros/schemas';
import { MissionSchema } from '@behavioros/schemas';

// ============================================================
// Mission Engine — Task decomposition, assignment, tracking
// ============================================================

export interface MissionPlan {
  id: string;
  rootMission: string;
  subMissions: Mission[];
  dependencies: Array<{ from: string; to: string }>;
  estimatedDuration: number;
  assignedAgents: string[];
}

export interface MissionProgress {
  missionId: string;
  status: MissionStatus;
  progress: number; // 0-100
  subTasks: number;
  completedSubTasks: number;
  blockers: string[];
  lastUpdated: string;
}

export class MissionEngine {
  private missions: Map<string, Mission> = new Map();
  private plans: Map<string, MissionPlan> = new Map();
  private progress: Map<string, MissionProgress> = new Map();

  /**
   * Decomponhe uma missão em sub-missões
   */
  decompose(mission: Mission, subMissions: Partial<Mission>[]): MissionPlan {
    const plan: MissionPlan = {
      id: randomUUID(),
      rootMission: mission.id,
      subMissions: [],
      dependencies: [],
      estimatedDuration: 0,
      assignedAgents: [],
    };

    for (const sub of subMissions) {
      const subMission = MissionSchema.parse({
        id: randomUUID(),
        title: sub.title ?? `Sub-task of ${mission.title}`,
        description: sub.description,
        type: sub.type ?? mission.type,
        priority: sub.priority ?? mission.priority,
        status: 'queued',
        context: { ...mission.context, parentMission: mission.id },
      });
      plan.subMissions.push(subMission);
      this.missions.set(subMission.id, subMission);
    }

    this.plans.set(plan.id, plan);
    return plan;
  }

  /**
   * Regista progresso de uma missão
   */
  updateProgress(missionId: string, updates: Partial<MissionProgress>): MissionProgress {
    const existing = this.progress.get(missionId) ?? {
      missionId,
      status: 'executing' as MissionStatus,
      progress: 0,
      subTasks: 0,
      completedSubTasks: 0,
      blockers: [],
      lastUpdated: new Date().toISOString(),
    };

    const updated = { ...existing, ...updates, lastUpdated: new Date().toISOString() };
    this.progress.set(missionId, updated);
    return updated;
  }

  /**
   * Obtém progresso de uma missão
   */
  getProgress(missionId: string): MissionProgress | undefined {
    return this.progress.get(missionId);
  }

  /**
   * Obtém plano de uma missão
   */
  getPlan(planId: string): MissionPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * Lista todas as missões
   */
  getAllMissions(): Mission[] {
    return Array.from(this.missions.values());
  }

  /**
   * Resume
   */
  summary(): string {
    const lines: string[] = [];
    lines.push(`Missions: ${this.missions.size}`);
    lines.push(`Plans: ${this.plans.size}`);

    const byStatus = new Map<string, number>();
    for (const m of this.missions.values()) {
      byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
    }
    for (const [status, count] of byStatus) {
      lines.push(`  ${status}: ${count}`);
    }

    return lines.join('\n');
  }
}
