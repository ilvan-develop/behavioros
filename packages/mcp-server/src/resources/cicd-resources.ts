import type { BehaviorOSEngine } from '@behavioros/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuditHistoryStore, getPipelines } from '../tools/cicd-tools.js';

export function registerCICDResources(server: McpServer, _engine: BehaviorOSEngine): void {
  server.registerResource(
    'pipeline-current',
    'pipeline://current',
    { description: 'Current pipeline state across all active pipelines' },
    async () => {
      const pipelines = getPipelines();
      const active = Array.from(pipelines.values()).filter(
        (p) => p.status === 'created' || p.status === 'running',
      );

      return {
        contents: [
          {
            uri: 'pipeline://current',
            text: JSON.stringify(
              {
                activeCount: active.length,
                pipelines: active.map((p) => ({
                  id: p.id,
                  project: p.project,
                  status: p.status,
                  layers: p.layers.map((l) => ({
                    id: l.id,
                    name: l.name,
                    status: l.status,
                  })),
                  createdAt: p.createdAt,
                  startedAt: p.startedAt,
                })),
              },
              null,
              2,
            ),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.registerResource(
    'pipeline-report',
    'pipeline://report',
    { description: 'Latest pipeline report with gate results and evidence' },
    async () => {
      const pipelines = getPipelines();
      const allPipelines = Array.from(pipelines.values());
      const latest = allPipelines[allPipelines.length - 1];

      if (!latest) {
        return {
          contents: [
            {
              uri: 'pipeline://report',
              text: JSON.stringify({ message: 'No pipelines found' }, null, 2),
              mimeType: 'application/json',
            },
          ],
        };
      }

      const totalGates = latest.layers.reduce((sum, l) => sum + l.gates.length, 0);
      const passedGates = latest.layers.reduce(
        (sum, l) => sum + l.gates.filter((g) => g.passed).length,
        0,
      );

      return {
        contents: [
          {
            uri: 'pipeline://report',
            text: JSON.stringify(
              {
                id: latest.id,
                project: latest.project,
                status: latest.status,
                summary: {
                  layers: latest.layers.length,
                  totalGates,
                  passedGates,
                  failedGates: totalGates - passedGates,
                },
                layers: latest.layers.map((l) => ({
                  id: l.id,
                  name: l.name,
                  status: l.status,
                  gates: l.gates,
                  evidenceCount: l.evidence.length,
                })),
                timeline: {
                  createdAt: latest.createdAt,
                  startedAt: latest.startedAt,
                  completedAt: latest.completedAt,
                },
              },
              null,
              2,
            ),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.registerResource(
    'audit-history',
    'audit://history',
    { description: 'Historical audit results across all pipelines' },
    async () => {
      const history = getAuditHistoryStore();

      return {
        contents: [
          {
            uri: 'audit://history',
            text: JSON.stringify(
              {
                total: history.length,
                records: history,
              },
              null,
              2,
            ),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );

  server.registerResource(
    'metrics-unified',
    'metrics://unified',
    { description: 'Unified observability metrics from BehaviorOS' },
    async () => {
      const metrics = {
        timestamp: new Date().toISOString(),
        auditEvents: 0,
        qualityMetrics: 0,
        learningEvents: 0,
      };

      return {
        contents: [
          {
            uri: 'metrics://unified',
            text: JSON.stringify(metrics, null, 2),
            mimeType: 'application/json',
          },
        ],
      };
    },
  );
}
