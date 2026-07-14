/**
 * MCP Server End-to-End Test
 * Spawns the MCP server as a child process, sends JSON-RPC requests via stdio,
 * and validates that BOS tools work correctly.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const MCP_SERVER_PATH =
  'C:/Users/Ilvan/Desktop/GitHub Apps/behavioros/packages/mcp-server/dist/server.mjs';

console.log('═══════════════════════════════════════════════════════');
console.log('  MCP Server End-to-End Test');
console.log('═══════════════════════════════════════════════════════\n');

// Spawn MCP server as a child process with stdio pipes
const server = spawn('node', [MCP_SERVER_PATH], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});

let responseBuffer = '';
let requestId = 0;
const pendingCallbacks = new Map();

// Capture stderr (server logs)
server.stderr.on('data', (data) => {
  const msg = data.toString().trim();
  if (msg) console.error(`   [server stderr] ${msg}`);
});

// Handle stdout (JSON-RPC responses)
server.stdout.on('data', (data) => {
  responseBuffer += data.toString();

  // MCP uses newline-delimited JSON or content-length headers
  // Try to parse complete JSON-RPC messages
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop(); // Keep incomplete line in buffer

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const msg = JSON.parse(trimmed);
      const cb = pendingCallbacks.get(msg.id);
      if (cb) {
        pendingCallbacks.delete(msg.id);
        cb(msg);
      }
    } catch {
      // Not JSON yet, skip
    }
  }
});

function sendRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    requestId++;
    const id = requestId;
    const request =
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }) + '\n';

    pendingCallbacks.set(id, resolve);
    server.stdin.write(request);

    // Timeout after 120s (audit chain runs real commands)
    setTimeout(() => {
      if (pendingCallbacks.has(id)) {
        pendingCallbacks.delete(id);
        reject(new Error(`Timeout waiting for response to ${method} (id=${id})`));
      }
    }, 120000);
  });
}

// Helper to wait for server to be ready
function waitForReady() {
  return new Promise((resolve) => {
    // Give server 2s to start
    setTimeout(resolve, 2000);
  });
}

try {
  await waitForReady();
  console.log('📋 Server spawned, sending initialize...\n');

  // ─── TEST 1: Initialize ──────────────────────────────────
  console.log('📋 TEST 1: Initialize MCP session');
  const initResult = await sendRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '1.0.0' },
  });
  console.log('   Response:', JSON.stringify(initResult, null, 2).slice(0, 300));
  console.log(initResult.error ? '   ❌ FAIL\n' : '   ✅ Initialize OK\n');

  // Send initialized notification
  server.stdin.write(
    JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n',
  );

  // ─── TEST 2: bos_list_patterns ────────────────────────────
  console.log('📋 TEST 2: bos_list_patterns');
  const patternsResult = await sendRequest('tools/call', {
    name: 'bos_list_patterns',
    arguments: {},
  });
  const patternsText = patternsResult?.result?.content?.[0]?.text || '';
  console.log('   Response (first 500 chars):', patternsText.slice(0, 500));
  console.assert(
    patternsText.includes('manufacturing') || patternsText.includes('pattern'),
    'Should list patterns',
  );
  console.log(patternsResult.error ? '   ❌ FAIL\n' : '   ✅ Patterns listed\n');

  // ─── TEST 3: bos_select_dna ───────────────────────────────
  console.log('📋 TEST 3: bos_select_dna');
  const selectResult = await sendRequest('tools/call', {
    name: 'bos_select_dna',
    arguments: {
      taskType: 'bug_fix',
      domain: 'payments',
      riskLevel: 'high',
      complexity: 'complex',
      agentId: 'finpay-backend',
    },
  });
  const selectText = selectResult?.result?.content?.[0]?.text || '';
  console.log('   Response (first 600 chars):', selectText.slice(0, 600));
  console.assert(
    selectText.includes('primary') || selectText.includes('pattern'),
    'Should return DNA selection',
  );
  console.log(selectResult.error ? '   ❌ FAIL\n' : '   ✅ DNA selection OK\n');

  // ─── TEST 4: bos_check_escalation ─────────────────────────
  console.log('📋 TEST 4: bos_check_escalation');
  const escalationResult = await sendRequest('tools/call', {
    name: 'bos_check_escalation',
    arguments: {
      trigger: 'production_incident',
      context: 'Payment gateway returning 500 errors',
      severity: 'critical',
    },
  });
  const escalationText = escalationResult?.result?.content?.[0]?.text || '';
  console.log('   Response (first 500 chars):', escalationText.slice(0, 500));
  console.log(escalationResult.error ? '   ❌ FAIL\n' : '   ✅ Escalation check OK\n');

  // ─── TEST 5: bos_resolve_conflict ─────────────────────────
  console.log('📋 TEST 5: bos_resolve_conflict');
  const conflictResult = await sendRequest('tools/call', {
    name: 'bos_resolve_conflict',
    arguments: {
      type: 'security_vs_feature',
      agentA: 'finpay-security',
      agentB: 'finpay-backend',
      context:
        'Security wants to block all changes until audit passes, Backend wants to ship hotfix to unblock users',
    },
  });
  const conflictText = conflictResult?.result?.content?.[0]?.text || '';
  console.log('   Response (first 500 chars):', conflictText.slice(0, 500));
  console.log(conflictResult.error ? '   ❌ FAIL\n' : '   ✅ Conflict resolution OK\n');

  // ─── TEST 6: bos_run_audit ────────────────────────────────
  console.log('📋 TEST 6: bos_run_audit');
  const auditResult = await sendRequest('tools/call', {
    name: 'bos_run_audit',
    arguments: {
      trigger: 'commit',
      context: {
        branch: 'feat/idempotency-key',
        files: ['packages/core/src/payment.ts'],
        author: 'finpay-backend',
      },
    },
  });
  const auditText = auditResult?.result?.content?.[0]?.text || '';
  console.log('   Response (first 500 chars):', auditText.slice(0, 500));
  console.log(auditResult.error ? '   ❌ FAIL\n' : '   ✅ Audit check OK\n');

  // ─── TEST 7: get-status (existing tool) ───────────────────
  console.log('📋 TEST 7: get-status');
  const statusResult = await sendRequest('tools/call', {
    name: 'get-status',
    arguments: {},
  });
  const statusText = statusResult?.result?.content?.[0]?.text || '';
  console.log('   Response (first 400 chars):', statusText.slice(0, 400));
  console.log(statusResult.error ? '   ❌ FAIL\n' : '   ✅ Status OK\n');

  console.log('═══════════════════════════════════════════════════════');
  console.log('  All MCP tests completed!');
  console.log('═══════════════════════════════════════════════════════');
} catch (err) {
  console.error('\n❌ Test failed with error:', err.message);
} finally {
  server.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}
