/**
 * Cursor `afterFileEdit` hook. Runs the DNA validator after a file edit lands.
 *
 * IMPORTANT: Cursor's `afterFileEdit` hook is documented as informational only — it
 * fires after the edit already happened and cannot deny, message, or otherwise stop
 * the agent (unlike `beforeShellExecution`/`beforeMCPExecution`, which support a JSON
 * `permission: deny` response). So this hook can never *block* a bad edit. What exit
 * code it returns still matters, though: Cursor and any CI/log tooling that inspects
 * this script's exit code need it to actually reflect pass/fail, not silently claim
 * success on every run (the previous version called `process.exit(0)` in both the
 * try and catch branches, which meant a failing DNA could never be distinguished from
 * a passing one).
 */
const { execSync } = require('child_process');

try {
  const result = execSync('pnpm --filter @behavioros/cli build 2>/dev/null && node packages/cli/dist/bin.mjs validate dnas/enterprise-governance.yaml 2>&1 || node packages/cli/dist/bin.mjs validate dnas/enterprise-governance.yaml 2>&1', {
    timeout: 30000,
    encoding: 'utf-8',
  });
  console.log('DNA validation passed:', result.trim());
  process.exit(0);
} catch (err) {
  console.error('DNA validation failed:', err.stderr || err.message);
  process.exit(1);
}
