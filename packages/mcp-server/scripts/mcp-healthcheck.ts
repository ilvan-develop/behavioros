import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

const SERVER_PATH = path.resolve(__dirname, '../dist/server.js');
const DNA_PATH = path.resolve(__dirname, '../../../dnas/enterprise-governance.yaml');
const HEALTHCHECK_TIMEOUT = 15_000;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let requestId = 0;

function nextId(): number {
  return ++requestId;
}

function sendRequest(
  proc: ChildProcess,
  method: string,
  params?: Record<string, unknown>,
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const request: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
    const lineReader = createInterface({ input: proc.stdout! });

    const timeout = setTimeout(() => {
      lineReader.close();
      proc.kill();
      reject(new Error(`Timeout waiting for response to ${method} (id: ${id})`));
    }, HEALTHCHECK_TIMEOUT);

    lineReader.on('line', (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const parsed = JSON.parse(trimmed) as JsonRpcResponse;
        if (parsed.id === id) {
          clearTimeout(timeout);
          lineReader.close();
          resolve(parsed);
        }
      } catch {
        // Skip non-JSON lines (e.g. stray log output)
      }
    });

    lineReader.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.stdin!.write(JSON.stringify(request) + '\n');
  });
}

const EXPECTED_TOOLS = [
  'create-mission',
  'get-status',
  'update-progress',
  'list-agents',
  'list-missions',
  'evaluate-governance',
  'record-learning',
  'run-audit',
  'bos_select_dna',
  'bos_resolve_conflict',
  'bos_check_escalation',
  'bos_run_audit',
  'bos_get_insights',
  'bos_list_patterns',
  'bos_resolve_truth',
  'bos_lsp_diagnostics',
  'bos_lsp_validate',
  'start-pipeline',
  'get-pipeline-status',
  'validate-layer',
  'get-pipeline-report',
  'approve-layer',
  'get-gate-results',
  'cicd-run-audit',
  'cicd-get-audit-history',
  'cicd-record-learning',
  'cicd-get-learning-report',
];

interface HealthCheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function healthcheck(): Promise<void> {
  console.log('🧪 BehaviorOS MCP Healthcheck\n');
  console.log(`Server:   ${SERVER_PATH}`);
  console.log(`DNA:      ${DNA_PATH}`);
  console.log(`Timeout:  ${HEALTHCHECK_TIMEOUT}ms\n`);

  const results: HealthCheckResult[] = [];

  let proc: ChildProcess | null = null;

  try {
    proc = spawn('node', [SERVER_PATH], {
      env: {
        ...process.env,
        BEHAVIOROS_DNA_PATH: DNA_PATH,
        BEHAVIOROS_PROJECT: 'behavioros',
        BEHAVIOROS_LOG_LEVEL: 'error',
        BEHAVIOROS_MCP_AUTO_START: 'true',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Collect stderr for diagnostics
    let stderrLog = '';
    proc.stderr!.on('data', (data: Buffer) => {
      stderrLog += data.toString();
    });

    // ---- Test 1: tools/list ----
    console.log('─── Test 1: tools/list ───');
    const listResponse = await sendRequest(proc, 'tools/list');
    const toolsList = (
      listResponse.result as {
        tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
      }
    )?.tools;

    if (!toolsList || !Array.isArray(toolsList)) {
      results.push({
        name: 'tools/list',
        passed: false,
        detail: 'Response did not contain tools array',
      });
      console.log('  ❌ tools/list — invalid response');
    } else {
      const toolNames = toolsList.map((t) => t.name);
      const missing = EXPECTED_TOOLS.filter((t) => !toolNames.includes(t));
      const extra = toolNames.filter((t) => !EXPECTED_TOOLS.includes(t));

      if (missing.length === 0) {
        results.push({
          name: 'tools/list',
          passed: true,
          detail: `${toolNames.length} tools listed, all expected tools present`,
        });
        console.log(`  ✅ tools/list — ${toolNames.length} tools listed`);
      } else {
        results.push({
          name: 'tools/list',
          passed: false,
          detail: `Missing tools: ${missing.join(', ')}`,
        });
        console.log(`  ❌ tools/list — missing: ${missing.join(', ')}`);
      }

      if (extra.length > 0) {
        console.log(`  ℹ️  Extra tools found: ${extra.join(', ')}`);
      }
    }

    // ---- Test 2: tools/call create-mission ----
    console.log('\n─── Test 2: create-mission ───');
    const createResponse = await sendRequest(proc, 'tools/call', {
      name: 'create-mission',
      arguments: {
        title: 'Healthcheck Test Mission',
        type: 'research',
        priority: 'low',
        description: 'Auto-generated by healthcheck script',
      },
    });

    if (createResponse.error) {
      results.push({
        name: 'create-mission',
        passed: false,
        detail: `Error: ${createResponse.error.message}`,
      });
      console.log(`  ❌ create-mission — ${createResponse.error.message}`);
    } else {
      const content = (createResponse.result as { content?: Array<{ type: string; text: string }> })
        ?.content;
      if (content && Array.isArray(content) && content.length > 0) {
        try {
          const mission = JSON.parse(content[0].text);
          if (mission.id && mission.title) {
            results.push({
              name: 'create-mission',
              passed: true,
              detail: `Mission created: ${mission.id} — "${mission.title}"`,
            });
            console.log(`  ✅ create-mission — ${mission.id} "${mission.title}"`);
          } else {
            results.push({
              name: 'create-mission',
              passed: false,
              detail: 'Response missing id/title',
            });
            console.log('  ❌ create-mission — missing id/title in response');
          }
        } catch {
          results.push({
            name: 'create-mission',
            passed: false,
            detail: `Failed to parse response: ${content[0].text.slice(0, 80)}`,
          });
          console.log(`  ❌ create-mission — parse error: ${content[0].text.slice(0, 80)}`);
        }
      } else {
        results.push({
          name: 'create-mission',
          passed: false,
          detail: 'Empty or invalid content response',
        });
        console.log('  ❌ create-mission — empty response');
      }
    }

    // ---- Test 3: tools/call get-status ----
    console.log('\n─── Test 3: get-status ───');
    const statusResponse = await sendRequest(proc, 'tools/call', {
      name: 'get-status',
    });

    if (statusResponse.error) {
      results.push({
        name: 'get-status',
        passed: false,
        detail: `Error: ${statusResponse.error.message}`,
      });
      console.log(`  ❌ get-status — ${statusResponse.error.message}`);
    } else {
      results.push({ name: 'get-status', passed: true, detail: 'Status retrieved successfully' });
      console.log('  ✅ get-status — success');
    }

    // ---- Summary ----
    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log('           HEALTHCHECK SUMMARY         ');
    console.log('═══════════════════════════════════════');

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    for (const r of results) {
      const icon = r.passed ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.detail}`);
    }

    console.log(`\n  📊 ${passed} passed, ${failed} failed, ${results.length} total`);

    if (stderrLog) {
      console.log('\n  ⚠️  Server stderr output:');
      const lines = stderrLog.trim().split('\n').filter(Boolean);
      for (const line of lines.slice(0, 5)) {
        console.log(`    ${line}`);
      }
      if (lines.length > 5) {
        console.log(`    ... and ${lines.length - 5} more lines`);
      }
    }

    console.log('\n═══════════════════════════════════════\n');

    process.exitCode = failed > 0 ? 1 : 0;
  } catch (err) {
    console.error('\n❌ Healthcheck crashed:', err);
    process.exitCode = 1;
  } finally {
    if (proc && !proc.killed) {
      proc.kill();
    }
  }
}

healthcheck();
