import type { BehaviorOSEngine } from '@behavioros/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAuditHistoryStore, getPipelines } from '../tools/cicd-tools.js';
import { getDeployments, getOrders, getValidations } from '../tools/integration-tools.js';

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
    { description: 'Unified observability metrics from Brocolis, FinPay, and BehaviorOS' },
    async () => {
      const orders = getOrders();
      const validations = getValidations();
      const deployments = getDeployments();

      const totalOrders = orders.size;
      const failedOrders = Array.from(orders.values()).filter((o) => o.status === 'failed').length;
      const totalValidations = validations.length;
      const failedValidations = validations.filter((v) => !v.valid).length;
      const allDeployments = Array.from(deployments.values());

      const metrics = {
        timestamp: new Date().toISOString(),
        brocolis: {
          ordersProcessed: totalOrders,
          errorRate:
            totalOrders > 0 ? Math.round((failedOrders / totalOrders) * 100 * 100) / 100 : 0,
        },
        finpay: {
          paymentsProcessed: totalValidations,
          failureRate:
            totalValidations > 0
              ? Math.round((failedValidations / totalValidations) * 100 * 100) / 100
              : 0,
        },
        deployments: {
          total: allDeployments.length,
          active: allDeployments.filter((d) => d.status === 'canary' || d.status === 'full').length,
          failed: allDeployments.filter((d) => d.status === 'failed').length,
        },
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

  server.registerResource(
    'deploy-status',
    'deploy://status',
    { description: 'Current deployment status across all environments' },
    async () => {
      const deployments = getDeployments();
      const all = Array.from(deployments.values());

      const byStatus: Record<string, number> = {};
      for (const d of all) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
      }

      return {
        contents: [
          {
            uri: 'deploy://status',
            text: JSON.stringify(
              {
                total: all.length,
                byStatus,
                deployments: all.map((d) => ({
                  id: d.id,
                  version: d.version,
                  environment: d.environment,
                  status: d.status,
                  qualityGatesPassed: d.qualityGatesPassed,
                  canaryTraffic: d.canaryTraffic,
                  deployedAt: d.deployedAt,
                  rolledBackAt: d.rolledBackAt,
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
}
