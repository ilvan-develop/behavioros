import type { BehaviorOSEngine } from '@behavioros/core';
import { z } from 'zod';

// ============================================================
// Observability Tools — System health & metrics
// ============================================================

let _engineRef: BehaviorOSEngine | null = null;

export function setObservabilityEngine(engine: BehaviorOSEngine) {
  _engineRef = engine;
}

// --- Input schemas ---

export const bosSystemHealthInput = z.object({});

export type BosSystemHealthInput = z.infer<typeof bosSystemHealthInput>;

export const bosPipelineMetricsInput = z.object({
  pipelineId: z.string().optional().describe('Filter by pipeline ID'),
});

export type BosPipelineMetricsInput = z.infer<typeof bosPipelineMetricsInput>;

export const bosAgentMetricsInput = z.object({
  agentId: z.string().optional().describe('Filter by agent ID'),
});

export type BosAgentMetricsInput = z.infer<typeof bosAgentMetricsInput>;

// --- Tool handlers ---

export async function bosSystemHealth() {
  if (!_engineRef) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              status: 'degraded',
              reason: 'Engine not initialized',
              engines: {},
              memory: { rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed },
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const stats = _engineRef.getStats();
  const agents = _engineRef.getAllAgents();
  const missions = _engineRef.getAllMissions();

  const engineStatus = {
    governance: stats.auditEvents > 0 ? 'active' : 'inactive',
    quality: stats.qualityMetrics > 0 ? 'active' : 'inactive',
    missions: missions.length > 0 ? 'active' : 'idle',
    agents: agents.length > 0 ? 'active' : 'idle',
  };

  const memory = process.memoryUsage();

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            status: 'healthy',
            engineStatus,
            stats: {
              agents: agents.length,
              missions: missions.length,
              activeMissions: missions.filter((m) => m.status === 'executing').length,
              auditEvents: stats.auditEvents,
              qualityMetrics: stats.qualityMetrics,
              learningEvents: stats.learningEvents,
            },
            memory: {
              rss: memory.rss,
              heapUsed: memory.heapUsed,
              heapTotal: memory.heapTotal,
              external: memory.external,
            },
            uptime: process.uptime(),
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function bosPipelineMetrics(input: BosPipelineMetricsInput) {
  if (!_engineRef) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Engine not initialized' }, null, 2),
        },
      ],
    };
  }

  const missions = _engineRef.getAllMissions();

  let filtered = missions;
  if (input.pipelineId) {
    filtered = missions.filter((m) => m.id === input.pipelineId);
  }

  const completed = filtered.filter((m) => m.status === 'completed');
  const failed = filtered.filter((m) => m.status === 'failed');
  const executing = filtered.filter((m) => m.status === 'executing');

  const totalDurations = completed
    .filter((m) => m.completedAt && m.startedAt)
    .map((m) => new Date(m.completedAt!).getTime() - new Date(m.startedAt!).getTime());

  const avgDuration =
    totalDurations.length > 0
      ? totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length
      : 0;

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: filtered.length,
            completed: completed.length,
            failed: failed.length,
            executing: executing.length,
            successRate:
              filtered.length > 0
                ? `${((completed.length / filtered.length) * 100).toFixed(1)}%`
                : 'N/A',
            avgDurationMs: Math.round(avgDuration),
            byPriority: {
              critical: filtered.filter((m) => m.priority === 'critical').length,
              high: filtered.filter((m) => m.priority === 'high').length,
              medium: filtered.filter((m) => m.priority === 'medium').length,
              low: filtered.filter((m) => m.priority === 'low').length,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

export async function bosAgentMetrics(input: BosAgentMetricsInput) {
  if (!_engineRef) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: 'Engine not initialized' }, null, 2),
        },
      ],
    };
  }

  const agents = _engineRef.getAllAgents();
  const missions = _engineRef.getAllMissions();

  let filteredAgents = agents;
  if (input.agentId) {
    filteredAgents = agents.filter((a) => a.id === input.agentId);
  }

  const agentMetrics = filteredAgents.map((agent) => {
    const agentMissions = missions.filter((m) => m.assignees?.includes(agent.id));
    const completed = agentMissions.filter((m) => m.status === 'completed');
    const failed = agentMissions.filter((m) => m.status === 'failed');

    const totalDurations = completed
      .filter((m) => m.completedAt && m.startedAt)
      .map((m) => new Date(m.completedAt!).getTime() - new Date(m.startedAt!).getTime());

    const avgDuration =
      totalDurations.length > 0
        ? totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length
        : 0;

    return {
      id: agent.id,
      role: agent.role,
      status: agent.status,
      reputation: agent.reputation,
      missionsAssigned: agentMissions.length,
      missionsCompleted: completed.length,
      missionsFailed: failed.length,
      successRate:
        agentMissions.length > 0
          ? `${((completed.length / agentMissions.length) * 100).toFixed(1)}%`
          : 'N/A',
      avgDurationMs: Math.round(avgDuration),
    };
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            totalAgents: filteredAgents.length,
            agents: agentMetrics,
          },
          null,
          2,
        ),
      },
    ],
  };
}
