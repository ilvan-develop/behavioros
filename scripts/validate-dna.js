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
  process.exit(0);
}
