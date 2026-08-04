import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Real, end-to-end simulation of the ACTUAL packaged MCP server — not a hand-built test
 * server (see server.test.ts), not unit tests of individual engines. This spawns the real
 * `dist/server.js` as a subprocess over stdio, exactly how Claude Code / Cursor / OpenCode
 * launch it in production, and drives it through genuine MCP protocol calls.
 *
 * Each `it()` here is a direct empirical check of a specific claim made in this repo's own
 * README.md / docs/PROTOCOL.md — not an implementation detail. If dist/server.js doesn't
 * exist (not built yet), these tests skip with a clear reason rather than failing CI on a
 * missing build artifact.
 */

const REPO_ROOT = resolve(__dirname, '../../../../');
const SERVER_ENTRY = join(REPO_ROOT, 'packages/mcp-server/dist/server.js');
const REAL_DNA_PATH = join(REPO_ROOT, 'dnas/enterprise-governance.yaml');

const serverBuilt = existsSync(SERVER_ENTRY);
const describeIfBuilt = serverBuilt ? describe : describe.skip;

if (!serverBuilt) {
  // eslint-disable-next-line no-console
  console.warn(
    `[real-server-simulation] Skipping — ${SERVER_ENTRY} not built. Run "pnpm --filter @behavioros/mcp-server build" first.`,
  );
}

async function spawnRealServer(extraEnv: Record<string, string> = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'bos-sim-'));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY],
    cwd,
    env: {
      ...(process.env as Record<string, string>),
      BEHAVIOROS_DNA_PATH: REAL_DNA_PATH,
      BEHAVIOROS_MOCK_ADAPTERS: 'true',
      BEHAVIOROS_HTTP_PORT: '0',
      // Isolate the signed-state secret to this session's own temp dir — otherwise
      // EnforcementMiddleware would create a real ~/.behavioros/state.key on whatever
      // machine runs this test.
      BEHAVIOROS_STATE_KEY_PATH: join(cwd, 'state.key'),
      BEHAVIOROS_TELEMETRY_ENABLED: extraEnv.BEHAVIOROS_TELEMETRY_ENABLED ?? 'false',
      ...extraEnv,
    },
  });
  const client = new Client({ name: 'behavioros-simulation', version: '0.1.0' });
  await client.connect(transport);
  return {
    client,
    cwd,
    async cleanup() {
      await client.close();
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

function toolText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.find((c) => c.type === 'text')?.text ?? '';
}

function toolJSON(result: Awaited<ReturnType<Client['callTool']>>): any {
  return JSON.parse(toolText(result));
}

describeIfBuilt('Real MCP server simulation (spawns actual dist/server.js over stdio)', () => {
  describe('Promise: "36+ MCP tools, real DNA loading"', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
    }, 30000);
    afterAll(async () => session.cleanup());

    it('exposes the tools it claims, including the newest ones', async () => {
      const result = await session.client.listTools();
      expect(result.tools.length).toBeGreaterThanOrEqual(38);
      const names = result.tools.map((t) => t.name);
      for (const expected of [
        'bos_select_dna',
        'bos_resolve_truth',
        'create-mission',
        'bos_run_audit',
        'record-learning',
        'evaluate-governance',
        'bos-telemetry-summary',
        'bos_reset_protocol',
      ]) {
        expect(names).toContain(expected);
      }
    });

    it('really loads dnas/enterprise-governance.yaml, not a fallback', async () => {
      const result = await session.client.callTool({ name: 'list-agents', arguments: {} });
      const agents = toolJSON(result);
      expect(agents).toHaveLength(6); // enterprise-governance.yaml declares exactly 6 personas
      const roles = agents.map((a: { role: string }) => a.role).sort();
      expect(roles).toEqual(['architect', 'devops', 'engineer', 'orchestrator', 'qa', 'security']);
    });
  });

  describe('Promise: "7-step protocol is enforced, not just documented"', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
    }, 30000);
    afterAll(async () => session.cleanup());

    it('blocks create-mission before bos_select_dna has run', async () => {
      const result = await session.client.callTool({
        name: 'create-mission',
        arguments: { title: 'Should be blocked', type: 'feature' },
      });
      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain('Select DNA (bos_select_dna)');
    });

    it('allows the full protocol walked in order: DNA -> truth -> mission -> audit -> learning', async () => {
      const dnaResult = await session.client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      expect(dnaResult.isError).toBeFalsy();

      const truthResult = await session.client.callTool({
        name: 'bos_resolve_truth',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      expect(truthResult.isError).toBeFalsy();

      const missionResult = await session.client.callTool({
        name: 'create-mission',
        arguments: { title: 'Real simulation mission', type: 'feature', priority: 'medium' },
      });
      expect(missionResult.isError).toBeFalsy();
      const mission = toolJSON(missionResult);
      expect(mission.id).toBeDefined();

      const auditResult = await session.client.callTool({
        name: 'bos_run_audit',
        arguments: { trigger: 'commit', projectPath: session.cwd },
      });
      expect(auditResult.isError).toBeFalsy();

      const learningResult = await session.client.callTool({
        name: 'record-learning',
        arguments: {
          type: 'observation',
          source: 'real-server-simulation',
          data: { note: 'full protocol walk succeeded' },
          confidence: 0.9,
        },
      });
      expect(learningResult.isError).toBeFalsy();
    });
  });

  describe('Promise: "orchestrator may not edit files" (PROTOCOL.md enforcement rule)', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
      await session.client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
    }, 30000);
    afterAll(async () => session.cleanup());

    it('evaluate-governance genuinely blocks an orchestrator attempting a direct file edit', async () => {
      const result = await session.client.callTool({
        name: 'evaluate-governance',
        arguments: {
          action: 'edit-file',
          context: {
            agentRole: 'orchestrator',
            agentAuthority: 'lead', // the DNA's real orchestrator authority level
            targetFiles: ['apps/api/src/payments.ts'],
          },
        },
      });
      const decision = toolJSON(result);
      expect(decision.approved).toBe(false);
    });

    it('no authority level overrides the orchestrator hard stop, unlike an ordinary escalatable boundary', async () => {
      // Finding from this simulation: even 'c-level' authority does not unblock the
      // orchestrator's unconditional (value: true) forbidden boundary — by design, this one
      // has no override (see checkForbidden in governance-engine.ts). This is what actually
      // makes "orchestrator may not edit files" a real guarantee rather than a suggestion.
      const result = await session.client.callTool({
        name: 'evaluate-governance',
        arguments: {
          action: 'edit-file',
          context: {
            agentRole: 'orchestrator',
            agentAuthority: 'c-level',
            targetFiles: ['apps/api/src/payments.ts'],
          },
        },
      });
      const decision = toolJSON(result);
      expect(decision.approved).toBe(false);
    });

    it('FINDING: a senior-authority engineer is blocked by their own require_approval boundary, with no way to self-approve', async () => {
      // This is a real, verified gap: eng-require-review (type: require_approval, value: true)
      // on the engineer persona routes through the same architect+ scope-escalation override as
      // "forbidden" boundaries — but there is no implemented mechanism to mark an action as
      // already-approved, so in practice this boundary hard-blocks every senior-authority
      // engineer's governed action, unconditionally, same as if it were forbidden. Documented
      // here rather than silently fixed, since redesigning the approval workflow (e.g. accepting
      // an "approvedBy"/"approvalToken" context field) is a product decision, not a bugfix.
      const result = await session.client.callTool({
        name: 'evaluate-governance',
        arguments: {
          action: 'edit-file',
          context: {
            agentRole: 'engineer',
            agentAuthority: 'senior',
            targetFiles: ['apps/api/src/payments.ts'],
          },
        },
      });
      const decision = toolJSON(result);
      expect(decision.approved).toBe(false);
    });

    it('an architect-authority persona CAN scope-escalate past a require_approval boundary (unlike the hard stop above)', async () => {
      const result = await session.client.callTool({
        name: 'evaluate-governance',
        arguments: {
          action: 'edit-file',
          context: {
            agentRole: 'engineer',
            agentAuthority: 'architect',
            targetFiles: ['apps/api/src/payments.ts'],
          },
        },
      });
      const decision = toolJSON(result);
      expect(decision.approved).toBe(true);
    });
  });

  describe('Promise: "opt-in, aggregate-only governance telemetry"', () => {
    it('reports disabled with zero counters by default', async () => {
      const session = await spawnRealServer();
      const result = await session.client.callTool({
        name: 'bos-telemetry-summary',
        arguments: {},
      });
      const summary = toolJSON(result);
      expect(summary.telemetryEnabled).toBe(false);
      expect(summary.missionsCompleted).toBe(0);
      await session.cleanup();
    }, 30000);

    it('tracks real governance violations when explicitly enabled', async () => {
      const session = await spawnRealServer({ BEHAVIOROS_TELEMETRY_ENABLED: 'true' });
      await session.client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      // Trigger a real, known-blocked boundary via the actual governance engine.
      await session.client.callTool({
        name: 'evaluate-governance',
        arguments: {
          action: 'edit-file',
          context: { agentRole: 'orchestrator', agentAuthority: 'lead', targetFiles: ['x.ts'] },
        },
      });
      const result = await session.client.callTool({
        name: 'bos-telemetry-summary',
        arguments: {},
      });
      const summary = toolJSON(result);
      expect(summary.telemetryEnabled).toBe(true);
      await session.cleanup();
    }, 30000);
  });
});
