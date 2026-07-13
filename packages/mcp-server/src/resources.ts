import type { BehaviorOSEngine } from '@behavioros/core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerResources(server: McpServer, engine: BehaviorOSEngine): void {
  server.registerResource(
    'missions',
    'behavioros://missions',
    { description: 'All missions in the system' },
    async () => ({
      contents: [
        {
          uri: 'behavioros://missions',
          text: JSON.stringify(engine.getAllMissions(), null, 2),
          mimeType: 'application/json',
        },
      ],
    }),
  );

  server.registerResource(
    'agents',
    'behavioros://agents',
    { description: 'All agents in the system' },
    async () => ({
      contents: [
        {
          uri: 'behavioros://agents',
          text: JSON.stringify(engine.getAllAgents(), null, 2),
          mimeType: 'application/json',
        },
      ],
    }),
  );

  server.registerResource(
    'audit-log',
    'behavioros://audit-log',
    { description: 'Audit log of all events' },
    async () => ({
      contents: [
        {
          uri: 'behavioros://audit-log',
          text: JSON.stringify(engine.getAuditLog(), null, 2),
          mimeType: 'application/json',
        },
      ],
    }),
  );

  server.registerResource(
    'quality-metrics',
    'behavioros://quality-metrics',
    { description: 'Quality metrics from evaluations' },
    async () => ({
      contents: [
        {
          uri: 'behavioros://quality-metrics',
          text: JSON.stringify(engine.getStats(), null, 2),
          mimeType: 'application/json',
        },
      ],
    }),
  );

  server.registerResource(
    'learning-events',
    'behavioros://learning-events',
    { description: 'Learning events recorded by the system' },
    async () => ({
      contents: [
        {
          uri: 'behavioros://learning-events',
          text: JSON.stringify(engine.getLearningEvents(), null, 2),
          mimeType: 'application/json',
        },
      ],
    }),
  );
}
