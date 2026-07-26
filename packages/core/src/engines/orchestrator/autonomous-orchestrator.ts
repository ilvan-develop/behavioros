/**
 * BehaviorOS AutonomousOrchestrator — The engine that makes BOS truly autonomous.
 *
 * When a human says "implementa módulo de pagamento", this engine:
 *   1. Decomposes the task into subtasks automatically
 *   2. Routes each subtask to the right agent based on skills
 *   3. Handles handoffs between agents with full context
 *   4. Handles agent rejections with intelligent fallback
 *   5. Generates documentation automatically
 *   6. Runs the full lifecycle pipeline
 *   7. Only escalates to humans when necessary
 *
 * Part of the AutonomousOrchestrator engine (Phase 2).
 */

import { randomUUID } from 'node:crypto';
import type {
  AutonomousMission,
  EcosystemReport,
  RejectionReason,
  SubTask,
  TaskRoute,
} from '@behavioros/schemas';
import type { DNALoader } from '../behavioral/dna-loader';
import type { EcosystemRegistry } from '../ecosystem-registry';
import type { MissionEngine } from '../mission/mission-engine';
import type { SkillEngine } from '../skill-engine';
import { AutoDocumentationTrigger } from './auto-documentation-trigger';
import { AutonomousDecomposer } from './autonomous-decomposer';
import { HandoffProtocol } from './handoff-protocol';
import { LifecyclePipeline } from './lifecycle-pipeline';
import { SkillRouter } from './skill-router';

// ============================================================
// Types
// ============================================================

/**
 * OrchestratorStatusValue — Union type: idle, processing, completed, failed, escalated;.
 */
export type OrchestratorStatusValue = 'idle' | 'processing' | 'completed' | 'failed' | 'escalated';

/**
 * OrchestratorInput — Configuration and options interface.
 */
export interface OrchestratorInput {
  title: string;
  type: string;
  priority: string;
  description?: string;
}

/**
 * OrchestratorResult — Configuration and options interface.
 */
export interface OrchestratorResult {
  status: OrchestratorStatusValue;
  mission: AutonomousMission;
  report: EcosystemReport;
  humanRequired?: {
    reason: string;
    context: unknown;
  };
}

/**
 * RejectionEvent — Configuration and options interface.
 */
export interface RejectionEvent {
  handoffId: string;
  reason: RejectionReason;
  subtask: SubTask;
}

/**
 * EscalationEvent — Configuration and options interface.
 */
export interface EscalationEvent {
  reason: string;
  context: unknown;
  severity: string;
}

/**
 * EscalationResult — Configuration and options interface.
 */
export interface EscalationResult {
  humanRequired: true;
  message: string;
  suggestedAction: string;
}

/**
 * OrchestratorStatusReport — Configuration and options interface.
 */
export interface OrchestratorStatusReport {
  activeMissions: number;
  activeHandoffs: number;
  agentsUtilization: { agentId: string; activeTasks: number; status: string }[];
  recentEscalations: number;
}

/**
 * OrchestratorOptions — Configuration and options interface.
 */
export interface OrchestratorOptions {
  dnaLoader?: DNALoader;
  skillEngine: SkillEngine;
  ecosystemRegistry: EcosystemRegistry;
  lifecyclePipeline?: LifecyclePipeline;
  decomposer?: AutonomousDecomposer;
  handoffProtocol?: HandoffProtocol;
  missionEngine?: MissionEngine;
  missionManager?: {
    create?: (input: unknown) => Promise<{ id: string }>;
    update?: (id: string, data: unknown) => Promise<void>;
  };
}

// ============================================================
// AutonomousOrchestrator
// ============================================================

/**
 * AutonomousOrchestrator — ============================================================.
 */
export class AutonomousOrchestrator {
  private dnaLoader?: DNALoader;
  private skillEngine: SkillEngine;
  private ecosystemRegistry: EcosystemRegistry;
  private lifecyclePipeline: LifecyclePipeline;
  private decomposer?: AutonomousDecomposer;
  private handoffProtocol?: HandoffProtocol;
  private missionEngine?: MissionEngine;
  private missionManager?: OrchestratorOptions['missionManager'];

  private activeMissions: Map<string, AutonomousMission> = new Map();
  private escalationLog: EscalationEvent[] = [];
  private status: OrchestratorStatusValue = 'idle';

  constructor(options: OrchestratorOptions) {
    this.dnaLoader = options.dnaLoader;
    this.skillEngine = options.skillEngine;
    this.ecosystemRegistry = options.ecosystemRegistry;
    this.lifecyclePipeline =
      options.lifecyclePipeline ??
      new LifecyclePipeline(
        options.decomposer ?? new AutonomousDecomposer(),
        new SkillRouter(options.skillEngine),
        options.handoffProtocol ?? new HandoffProtocol(),
        new AutoDocumentationTrigger(),
        options.skillEngine,
      );
    this.decomposer = options.decomposer;
    this.handoffProtocol = options.handoffProtocol;
    this.missionEngine = options.missionEngine;
    this.missionManager = options.missionManager;
  }

  /**
   * Main entry point — receives a high-level task from a human.
   * Processes the full autonomous pipeline and returns the result.
   */
  async processTask(input: OrchestratorInput): Promise<OrchestratorResult> {
    this.status = 'processing';

    // Record mission in local tracking
    const trackingMission: AutonomousMission = {
      id: randomUUID(),
      title: input.title,
      type: input.type as AutonomousMission['type'],
      priority: input.priority as AutonomousMission['priority'],
      status: 'created',
      subtasks: [],
      routing: [],
      createdAt: new Date().toISOString(),
      lifecycle: {
        docsGenerated: false,
        testsGenerated: false,
        auditPassed: false,
        learningRecorded: false,
      },
    };

    this.activeMissions.set(trackingMission.id, trackingMission);

    // If mission manager is available, create mission there too
    if (this.missionManager?.create) {
      try {
        await this.missionManager.create(input);
      } catch (error) {
        console.warn(
          'AutonomousOrchestrator: Failed to create mission in manager:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // Execute the full lifecycle pipeline
    const pipelineResult = await this.lifecyclePipeline.execute({
      title: input.title,
      type: input.type,
      priority: input.priority,
      description: input.description,
    });

    // Update local tracking
    const tracked = this.activeMissions.get(trackingMission.id);
    if (tracked) {
      tracked.status = pipelineResult.mission.status;
      tracked.subtasks = pipelineResult.mission.subtasks;
      tracked.routing = pipelineResult.mission.routing;
      tracked.completedAt = pipelineResult.mission.completedAt;
      tracked.lifecycle = pipelineResult.mission.lifecycle;
    }

    // Check if escalation is needed
    if (pipelineResult.status === 'escalated') {
      this.status = 'escalated';
      return {
        status: 'escalated',
        mission: pipelineResult.mission,
        report: pipelineResult.report,
        humanRequired: {
          reason: 'Pipeline escalated due to routing failures',
          context: {
            pipelineStatus: pipelineResult.status,
            missionId: pipelineResult.mission.id,
            duration: pipelineResult.duration,
          },
        },
      };
    }

    // Check if the pipeline failed
    if (pipelineResult.status === 'failed') {
      this.status = 'failed';
    } else {
      this.status = 'completed';
    }

    // Update status in mission manager
    if (this.missionManager?.update) {
      try {
        await this.missionManager.update(pipelineResult.mission.id, {
          status: pipelineResult.mission.status,
          completedAt: pipelineResult.mission.completedAt,
        });
      } catch (error) {
        console.warn(
          'AutonomousOrchestrator: Failed to update mission in manager:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    // If there was a critical failure, suggest escalation
    if (pipelineResult.status === 'failed') {
      return {
        status: 'failed',
        mission: pipelineResult.mission,
        report: pipelineResult.report,
        humanRequired: {
          reason: `Pipeline failed for mission "${input.title}" after ${pipelineResult.duration}ms`,
          context: {
            missionId: pipelineResult.mission.id,
            subtasks: pipelineResult.mission.subtasks.filter(
              (s) => s.status === 'failed' || s.status === 'rejected',
            ),
            pipelineDuration: pipelineResult.duration,
          },
        },
      };
    }

    return {
      status: 'completed',
      mission: pipelineResult.mission,
      report: pipelineResult.report,
    };
  }

  /**
   * Handle agent rejection with intelligent fallback.
   * Attempts to reroute the subtask to another agent or escalates.
   */
  async handleRejection(event: RejectionEvent): Promise<{
    status: 'rerouted' | 'escalated';
    newRoute?: TaskRoute;
  }> {
    const { handoffId, reason, subtask } = event;

    // Check if we have available agents
    const allAgents = await this.listAvailableAgents();
    const remainingAgents = allAgents.filter((a) => a.id !== this.getHandoffAgent(handoffId));

    if (remainingAgents.length === 0) {
      // No more agents to try — escalate
      this.logEscalation({
        reason: `All agents rejected subtask "${subtask.title}": ${reason.details}`,
        context: { handoffId, subtask, reason },
        severity: 'high',
      });

      return { status: 'escalated' };
    }

    // Try to reroute to another agent
    const reroute = await this.tryReroute(subtask, remainingAgents);
    if (reroute) {
      return { status: 'rerouted', newRoute: reroute };
    }

    // Could not reroute — escalate
    this.logEscalation({
      reason: `No suitable agent found for subtask "${subtask.title}" after rejection: ${reason.details}`,
      context: { handoffId, subtask, reason, remainingAgents: remainingAgents.map((a) => a.id) },
      severity: 'high',
    });

    return { status: 'escalated' };
  }

  /**
   * Escalate to human when needed (security, breaking changes, no agent available).
   */
  async escalate(event: EscalationEvent): Promise<EscalationResult> {
    this.logEscalation(event);
    this.status = 'escalated';

    let suggestedAction = 'Review the context and provide guidance';

    switch (event.severity) {
      case 'critical':
        suggestedAction = 'Immediate human intervention required — critical issue detected';
        break;
      case 'high':
        suggestedAction = 'Review the escalation context and decide on next steps';
        break;
      case 'medium':
        suggestedAction = 'Review and provide feedback to the autonomous system';
        break;
      default:
        suggestedAction = 'Acknowledge the escalation and provide direction';
    }

    return {
      humanRequired: true,
      message: event.reason,
      suggestedAction,
    };
  }

  /**
   * Get the full status of current orchestration.
   */
  async getStatus(): Promise<OrchestratorStatusReport> {
    const agentsUtilization: { agentId: string; activeTasks: number; status: string }[] = [];

    // Get agent information from skill engine
    try {
      const status = await this.skillEngine.status();
      for (const agent of status.agents) {
        const activeTasks = this.countActiveTasksForAgent(agent.id);
        agentsUtilization.push({
          agentId: agent.id,
          activeTasks,
          status: agent.status,
        });
      }
    } catch {
      // If skill engine is not available, return empty utilization
    }

    const activeHandoffs = 0; // In a full implementation, query handoff protocol

    return {
      activeMissions: this.activeMissions.size,
      activeHandoffs,
      agentsUtilization,
      recentEscalations: this.escalationLog.length,
    };
  }

  // ─── Private Methods ───────────────────────────────────────

  /**
   * List all available agents from the skill engine.
   */
  private async listAvailableAgents(): Promise<{ id: string; skills: string[] }[]> {
    try {
      const status = await this.skillEngine.status();
      return status.agents.map((a) => ({
        id: a.id,
        skills: a.skills,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Try to reroute a subtask to one of the remaining agents.
   */
  private async tryReroute(
    subtask: SubTask,
    agents: { id: string; skills: string[] }[],
  ): Promise<TaskRoute | null> {
    // Simple strategy: pick first agent that has the required skill
    for (const agent of agents) {
      const hasSkill = agent.skills.some(
        (s) =>
          s.toLowerCase() === subtask.requiredSkill.toLowerCase() ||
          s.toLowerCase().includes(subtask.requiredSkill.toLowerCase()),
      );
      if (hasSkill) {
        return {
          subtaskId: subtask.id,
          agentId: agent.id,
          confidence: 0.6,
          strategy: 'capability-match',
        };
      }
    }
    return null;
  }

  /**
   * Get the agent assigned to a handoff.
   */
  private getHandoffAgent(_handoffId: string): string {
    // In a real implementation, look up the handoff
    return 'unknown';
  }

  /**
   * Count active tasks for a given agent.
   */
  private countActiveTasksForAgent(agentId: string): number {
    let count = 0;
    for (const mission of this.activeMissions.values()) {
      for (const subtask of mission.subtasks) {
        if (
          subtask.assignedAgent === agentId &&
          (subtask.status === 'pending' ||
            subtask.status === 'routed' ||
            subtask.status === 'accepted' ||
            subtask.status === 'in_progress')
        ) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Log an escalation event.
   */
  private logEscalation(event: EscalationEvent): void {
    this.escalationLog.push({
      ...event,
      context: {
        ...(event.context as Record<string, unknown>),
        timestamp: new Date().toISOString(),
      },
    });
  }
}
