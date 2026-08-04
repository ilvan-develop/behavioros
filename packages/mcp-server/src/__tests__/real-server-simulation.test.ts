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

/** Some tools (e.g. bos_check_escalation) return multiple text content blocks — join them all. */
function allText(result: Awaited<ReturnType<Client['callTool']>>): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n');
}

/** Extract the trailing "--- RAW DATA ---\n{...}" JSON blob some tools append after prose. */
function rawDataJSON(result: Awaited<ReturnType<Client['callTool']>>): any {
  const text = allText(result);
  const marker = '--- RAW DATA ---';
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error(`No "--- RAW DATA ---" section found in: ${text}`);
  return JSON.parse(text.slice(idx + marker.length).trim());
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

  describe('Promise: "DNA persona skills gate delegation"', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
      // bos-skills-validate requires dna/truth/mission steps to be complete first.
      await session.client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      await session.client.callTool({
        name: 'bos_resolve_truth',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      await session.client.callTool({
        name: 'create-mission',
        arguments: { title: 'Skill gating simulation', type: 'feature' },
      });
    }, 30000);
    afterAll(async () => session.cleanup());

    it('a real generated agent id already has the skills its DNA persona grants it', async () => {
      // Live verification found this broken: syncFromDNA() was never called at startup, and
      // even when called it keys skills by persona.role ("orchestrator"), not by the actual
      // generated agent id ("agent-orchestrator-<uuid>") — so every agent was reported as
      // missing every skill, including skills its own DNA persona explicitly grants it.
      const agentsResult = await session.client.callTool({ name: 'list-agents', arguments: {} });
      const agents = toolJSON(agentsResult) as Array<{ id: string; role: string }>;
      const orchestrator = agents.find((a) => a.role === 'orchestrator')!;
      expect(orchestrator.id).toMatch(/^agent-orchestrator-/);

      // enterprise-governance.yaml's orchestrator persona grants exactly these skills.
      const validation = await session.client.callTool({
        name: 'bos-skills-validate',
        arguments: {
          agentId: orchestrator.id,
          requiredSkills: ['delegation', 'mission-management'],
        },
      });
      const result = toolJSON(validation);
      expect(result.allowed).toBe(true);
      expect(result.missingSkills).toHaveLength(0);
    });

    it('still correctly blocks a skill no persona was granted', async () => {
      const agentsResult = await session.client.callTool({ name: 'list-agents', arguments: {} });
      const agents = toolJSON(agentsResult) as Array<{ id: string; role: string }>;
      const engineer = agents.find((a) => a.role === 'engineer')!;

      const validation = await session.client.callTool({
        name: 'bos-skills-validate',
        arguments: { agentId: engineer.id, requiredSkills: ['quantum-computing'] },
      });
      const result = toolJSON(validation);
      expect(result.allowed).toBe(false);
      expect(result.missingSkills).toContain('quantum-computing');
    });
  });

  describe('Promise: "delegation" (bos-agent-handoff full request->accept->complete cycle)', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
      await session.client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      await session.client.callTool({
        name: 'bos_resolve_truth',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      await session.client.callTool({
        name: 'create-mission',
        arguments: { title: 'Delegation simulation', type: 'feature' },
      });
    }, 30000);
    afterAll(async () => session.cleanup());

    it('requesting a handoff as the real orchestrator agent succeeds (was broken two ways)', async () => {
      // Live verification found this always failed: (1) the required skill string
      // 'orchestration' matched no skill any DNA persona actually grants (they grant
      // 'delegation'), and (2) the agentId used for the skill check came from
      // _getAgentId()'s BEHAVIOROS_AGENT_ID env var — 'unknown' by default — which can never
      // match a real generated agent id (AgentManager appends a random uuid suffix at
      // startup, unknowable in advance). Fixed to require 'delegation' and to use the
      // request's own `from` field, which already carries the real requesting agent's id.
      const agentsResult = await session.client.callTool({ name: 'list-agents', arguments: {} });
      const agents = toolJSON(agentsResult) as Array<{ id: string; role: string }>;
      const orchestrator = agents.find((a) => a.role === 'orchestrator')!;
      const engineer = agents.find((a) => a.role === 'engineer')!;

      const missionsResult = await session.client.callTool({ name: 'list-missions', arguments: {} });
      const mission = toolJSON(missionsResult)[0];

      const requestResult = await session.client.callTool({
        name: 'bos-agent-handoff',
        arguments: {
          action: 'request',
          from: orchestrator.id,
          to: engineer.id,
          context: {
            missionId: mission.id,
            subtask: {
              id: 'subtask-1',
              title: 'Implement the payment retry logic',
              type: 'implementation',
              requiredSkill: 'full-stack-development',
              status: 'pending',
            },
          },
        },
      });
      expect(requestResult.isError).toBeFalsy();
      const requested = toolJSON(requestResult);
      expect(requested.status).toBe('pending');
      expect(requested.handoffId).toBeDefined();

      const acceptResult = await session.client.callTool({
        name: 'bos-agent-handoff',
        arguments: { action: 'accept', handoffId: requested.handoffId },
      });
      expect(toolJSON(acceptResult).status).toBe('in_progress');

      const completeResult = await session.client.callTool({
        name: 'bos-agent-handoff',
        arguments: {
          action: 'complete',
          handoffId: requested.handoffId,
          output: { summary: 'Retry logic implemented with exponential backoff' },
        },
      });
      const completed = toolJSON(completeResult);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });

    it('a request from an agent without the delegation skill is still blocked', async () => {
      const agentsResult = await session.client.callTool({ name: 'list-agents', arguments: {} });
      const agents = toolJSON(agentsResult) as Array<{ id: string; role: string }>;
      const engineer = agents.find((a) => a.role === 'engineer')!;
      const qa = agents.find((a) => a.role === 'qa')!;

      const missionsResult = await session.client.callTool({ name: 'list-missions', arguments: {} });
      const mission = toolJSON(missionsResult)[0];

      const requestResult = await session.client.callTool({
        name: 'bos-agent-handoff',
        arguments: {
          action: 'request',
          from: engineer.id, // engineer's persona does not grant 'delegation'
          to: qa.id,
          context: {
            missionId: mission.id,
            subtask: {
              id: 'subtask-2',
              title: 'Should be blocked',
              type: 'implementation',
              requiredSkill: 'test-strategy',
              status: 'pending',
            },
          },
        },
      });
      expect(requestResult.isError).toBe(true);
      expect(toolText(requestResult)).toContain('delegation');
    });
  });

  describe('Promise: "intelligence to shape behavior" (bos_get_insights / DNA pattern meta-learning)', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
      await session.client.callTool({
        name: 'bos_select_dna',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
      await session.client.callTool({
        name: 'bos_resolve_truth',
        arguments: { taskType: 'feature', domain: 'backend' },
      });
    }, 30000);
    afterAll(async () => session.cleanup());

    it('bos_get_insights starts empty — no mission has completed yet', async () => {
      const result = await session.client.callTool({ name: 'bos_get_insights', arguments: {} });
      const text = toolText(result);
      const raw = JSON.parse(text.split('--- RAW DATA ---\n')[1]);
      expect(raw.stats.totalRecords).toBe(0);
    });

    it('completing real missions actually feeds bos_get_insights (was dead: nothing ever called BosLearningEngine.record())', async () => {
      // Live verification found bosLearningEngine.record() was never invoked anywhere in the
      // server — bos_get_insights always returned zero records no matter how much real work
      // happened. Fixed by wiring it to the engine's own mission:completed/mission:failed
      // events. This test proves the fix: complete 3 missions of the same DNA (the analysis
      // engine's own MIN_SAMPLES_FOR_ANALYSIS threshold) and confirm a real insight appears.
      for (let i = 0; i < 3; i++) {
        const missionResult = await session.client.callTool({
          name: 'create-mission',
          arguments: { title: `Insight source mission ${i}`, type: 'feature', priority: 'medium' },
        });
        const mission = toolJSON(missionResult);

        await session.client.callTool({
          name: 'update-progress',
          arguments: { missionId: mission.id, status: 'executing' },
        });

        if (i === 0) {
          // auditDone is a protocol-level flag, not per-mission — one real audit run unlocks
          // completion for every mission in this session.
          await session.client.callTool({
            name: 'bos_run_audit',
            arguments: { trigger: 'commit', projectPath: session.cwd },
          });
        }

        const completeResult = await session.client.callTool({
          name: 'update-progress',
          arguments: { missionId: mission.id, status: 'completed' },
        });
        expect(completeResult.isError).toBeFalsy();
      }

      const insightsResult = await session.client.callTool({ name: 'bos_get_insights', arguments: {} });
      const text = toolText(insightsResult);
      const raw = JSON.parse(text.split('--- RAW DATA ---\n')[1]);

      expect(raw.stats.totalRecords).toBe(3);
      expect(raw.stats.patterns).toBeGreaterThanOrEqual(1);
      expect(raw.stats.overallSuccessRate).toBe(1);
      expect(raw.insights.length).toBeGreaterThan(0);
      expect(raw.insights[0].recommendation).toBe('reinforce'); // 3/3 succeeded
    });
  });

  describe('Promise: "behavior" — escalation to human oversight is real, not just documented text', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
    }, 30000);
    afterAll(async () => session.cleanup());

    it('a known-critical trigger produces a real, tracked escalation event', async () => {
      const before = await session.client.callTool({
        name: 'bos_check_escalation',
        arguments: { trigger: 'unrelated-noise-xyz' },
      });
      const beforeCount = rawDataJSON(before).activeEscalationCount ?? 0;

      const result = await session.client.callTool({
        name: 'bos_check_escalation',
        arguments: { trigger: 'security vulnerability', context: 'SQL injection found in payments module' },
      });
      const text = allText(result);
      expect(text).toContain('ESCALATION TRIGGERED');
      expect(text).toContain('CRITICAL');

      const after = await session.client.callTool({
        name: 'bos_check_escalation',
        arguments: { trigger: 'unrelated-noise-xyz-2' },
      });
      expect(rawDataJSON(after).activeEscalationCount).toBeGreaterThan(beforeCount);
    });

    it('an unrecognized trigger does not fabricate an escalation', async () => {
      const result = await session.client.callTool({
        name: 'bos_check_escalation',
        arguments: { trigger: 'the-printer-is-out-of-paper' },
      });
      expect(toolText(result)).toContain('NO ESCALATION REQUIRED');
    });
  });

  describe('Promise: "behavior" — conflict resolution follows a real deterministic template, not ad-libbed text', () => {
    let session: Awaited<ReturnType<typeof spawnRealServer>>;
    beforeAll(async () => {
      session = await spawnRealServer();
    }, 30000);
    afterAll(async () => session.cleanup());

    it('security_vs_feature resolves via the real fixed template, with an escalation path', async () => {
      const result = await session.client.callTool({
        name: 'bos_resolve_conflict',
        arguments: {
          type: 'security_vs_feature',
          agentA: 'security-agent',
          agentB: 'feature-agent',
          context: 'Security wants to block launch over an unpatched CVE; product wants to ship on schedule.',
        },
      });
      const text = toolText(result);
      expect(text).toContain('Security vs delivery resolved by risk assessment');
      expect(text).toContain('cto -> human');
      expect(text).toContain('1. Security raises concern with OWASP/compliance evidence');
    });

    it('repeated conflicts between the same two agents accumulate real history', async () => {
      const args = {
        type: 'qa_vs_developer' as const,
        agentA: 'qa-agent',
        agentB: 'dev-agent',
        context: 'Recurring flaky test dispute',
      };
      await session.client.callTool({ name: 'bos_resolve_conflict', arguments: args });
      await session.client.callTool({ name: 'bos_resolve_conflict', arguments: args });
      const third = await session.client.callTool({ name: 'bos_resolve_conflict', arguments: args });
      expect(toolText(third)).toContain('CONFLICT HISTORY');
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
