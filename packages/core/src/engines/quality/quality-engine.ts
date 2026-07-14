import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { QualityGate, QualityMetric } from '@behavioros/schemas';

// ============================================================
// Quality Engine — Quality Gates, Metrics, Enforcement + Real Tool Integration
// ============================================================

export interface QualityCheckResult {
  gate: string;
  passed: boolean;
  actual: number | boolean;
  expected: number | boolean;
  message: string;
  details?: Record<string, unknown>;
}

export interface QualityReport {
  id: string;
  passed: boolean;
  score: number;
  checks: QualityCheckResult[];
  metrics: QualityMetric[];
  duration: number;
  timestamp: string;
}

export interface QualityEngineConfig {
  minScore?: number;
  persistPath?: string;
  timeout?: number;
}

function runCommand(
  cmd: string,
  cwd: string,
  timeout = 120000,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      cwd,
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? String(e),
      exitCode: e.status ?? 1,
    };
  }
}

function detectPackageManager(projectPath: string): string {
  if (existsSync(`${projectPath}/pnpm-lock.yaml`)) return 'pnpm';
  if (existsSync(`${projectPath}/yarn.lock`)) return 'yarn';
  return 'npm';
}

export class QualityEngine {
  private gates: QualityGate[];
  private history: QualityReport[] = [];
  private minScore: number;
  private persistPath?: string;
  private timeout: number;

  constructor(gates: QualityGate[] = [], options?: QualityEngineConfig) {
    this.gates = gates;
    this.minScore = options?.minScore ?? 80;
    this.persistPath = options?.persistPath;
    this.timeout = options?.timeout ?? 120000;
  }

  /**
   * Run all quality gates against a real project
   */
  async runAll(projectPath: string): Promise<QualityReport> {
    const reportId = randomUUID();
    const start = Date.now();
    const checks: QualityCheckResult[] = [];
    const metrics: QualityMetric[] = [];

    for (const gate of this.gates) {
      try {
        const result = await this.runGate(gate.name, projectPath);
        checks.push(result.check);
        if (result.metric) metrics.push(result.metric);
      } catch (error) {
        checks.push({
          gate: gate.name,
          passed: false,
          actual: 'error',
          expected: true,
          message: `Gate ${gate.name} failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const passedChecks = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 100;
    const passed = score >= this.minScore && checks.every((c) => c.passed);

    const report: QualityReport = {
      id: reportId,
      passed,
      score,
      checks,
      metrics,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    this.history.push(report);
    return report;
  }

  /**
   * Run a single quality gate
   */
  async runGate(
    gateName: string,
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    switch (gateName) {
      case 'lint':
        return this.runLint(projectPath);
      case 'typecheck':
        return this.runTypecheck(projectPath);
      case 'test_coverage':
        return this.runCoverage(projectPath);
      case 'security':
        return this.runSecurity(projectPath);
      case 'performance':
        return this.runPerformance(projectPath);
      default:
        return this.runCustomGate(gateName, projectPath);
    }
  }

  private async runLint(
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    // Try biome first, then eslint
    let result = runCommand(
      'npx biome check . --no-errors-on-unmatched --max-diagnostics=100',
      projectPath,
      this.timeout,
    );

    if (result.exitCode !== 0 && result.stdout.includes('biome')) {
      // Fallback to eslint
      result = runCommand(
        'npx eslint . --format json --max-warnings=1000',
        projectPath,
        this.timeout,
      );
    }

    const errorCount = this.parseLintErrors(result.stdout, result.stderr);
    const passed = errorCount === 0;

    return {
      check: {
        gate: 'lint',
        passed,
        actual: errorCount,
        expected: 0,
        message: passed ? 'Lint: no errors found' : `Lint: ${errorCount} error(s) found`,
        details: { output: result.stdout.slice(0, 2000) },
      },
      metric: { name: 'lint', value: errorCount, unit: 'errors', passed },
    };
  }

  private parseLintErrors(stdout: string, stderr: string): number {
    // Biome format: look for "errors" in summary
    const biomeMatch = stdout.match(/(\d+)\s+error/);
    if (biomeMatch) return Number.parseInt(biomeMatch[1], 10);

    // ESLint JSON format
    try {
      const data = JSON.parse(stdout);
      if (Array.isArray(data)) {
        return data.reduce(
          (sum: number, file: { errorCount?: number }) => sum + (file.errorCount ?? 0),
          0,
        );
      }
    } catch {
      // Not JSON, count error lines
    }

    const lines = (stdout + stderr).split('\n');
    return lines.filter((l) => l.includes('error') && !l.includes('0 errors')).length;
  }

  private async runTypecheck(
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    const result = runCommand('npx tsc --noEmit --pretty false', projectPath, this.timeout);

    const errorCount = this.parseTypecheckErrors(result.stdout, result.stderr);
    const passed = errorCount === 0;

    return {
      check: {
        gate: 'typecheck',
        passed,
        actual: errorCount,
        expected: 0,
        message: passed ? 'TypeScript: no type errors' : `TypeScript: ${errorCount} type error(s)`,
        details: { output: result.stdout.slice(0, 2000) },
      },
      metric: { name: 'typecheck', value: errorCount, unit: 'errors', passed },
    };
  }

  private parseTypecheckErrors(stdout: string, stderr: string): number {
    const output = stdout + stderr;
    // tsc outputs "Found X errors" at the end
    const match = output.match(/Found (\d+) error/);
    if (match) return Number.parseInt(match[1], 10);

    // Count lines that look like errors (contain "error TS")
    return output.split('\n').filter((l) => l.includes('error TS')).length;
  }

  private async runCoverage(
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    const pkgMgr = detectPackageManager(projectPath);

    // Check if vitest or jest
    let testCmd = `${pkgMgr} run test -- --coverage`;
    try {
      const pkgJson = JSON.parse(
        require('node:fs').readFileSync(`${projectPath}/package.json`, 'utf-8'),
      );
      if (pkgJson.devDependencies?.vitest || pkgJson.dependencies?.vitest) {
        testCmd = `${pkgMgr} run test:coverage`;
      } else if (pkgJson.devDependencies?.jest || pkgJson.dependencies?.jest) {
        testCmd = `${pkgMgr} run test -- --coverage`;
      }
    } catch {
      // Use default
    }

    const result = runCommand(testCmd, projectPath, this.timeout * 2);
    const coverage = this.parseCoverageOutput(result.stdout, result.stderr);

    const gate = this.gates.find((g) => g.name === 'test_coverage');
    const threshold = gate?.threshold ?? 80;
    const passed = coverage >= threshold;

    return {
      check: {
        gate: 'test_coverage',
        passed,
        actual: coverage,
        expected: threshold,
        message: passed
          ? `Coverage: ${coverage}% >= ${threshold}%`
          : `Coverage: ${coverage}% < ${threshold}% (threshold not met)`,
        details: { output: result.stdout.slice(0, 2000) },
      },
      metric: { name: 'test_coverage', value: coverage, unit: '%', threshold, passed },
    };
  }

  private parseCoverageOutput(stdout: string, stderr: string): number {
    const output = stdout + stderr;

    // Try to find "All files" line in text coverage summary
    const allFilesMatch = output.match(/All files\s+\|\s+([\d.]+)/);
    if (allFilesMatch) return Number.parseFloat(allFilesMatch[1]);

    // Try JSON coverage-summary.json format
    try {
      const match2 = output.match(/"total":\s*\{[^}]*"lines":\s*\{[^}]*"pct":\s*([\d.]+)/);
      if (match2) return Number.parseFloat(match2[1]);
    } catch {
      // Not JSON
    }

    // Try to find any percentage
    const pctMatch = output.match(/([\d.]+)%\s+Lines/);
    if (pctMatch) return Number.parseFloat(pctMatch[1]);

    return 0;
  }

  private async runSecurity(
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    const pkgMgr = detectPackageManager(projectPath);
    const auditCmd = pkgMgr === 'pnpm' ? 'pnpm audit --json' : `${pkgMgr} audit --json`;

    const result = runCommand(auditCmd, projectPath, this.timeout);
    const vulns = this.parseAuditOutput(result.stdout, result.stderr);

    const critical = vulns.critical + vulns.high;
    const passed = critical === 0;

    return {
      check: {
        gate: 'security',
        passed,
        actual: critical,
        expected: 0,
        message: passed
          ? `Security: ${vulns.total} vulnerabilities (0 critical/high)`
          : `Security: ${critical} critical/high vulnerabilities found`,
        details: vulns,
      },
      metric: { name: 'security', value: vulns.total, unit: 'vulnerabilities', passed },
    };
  }

  private parseAuditOutput(
    stdout: string,
    _stderr: string,
  ): {
    total: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    info: number;
  } {
    const vulns = { total: 0, critical: 0, high: 0, moderate: 0, low: 0, info: 0 };

    try {
      const data = JSON.parse(stdout);

      // npm audit JSON format
      if (data.vulnerabilities) {
        for (const [, vuln] of Object.entries(data.vulnerabilities) as Array<
          [string, { severity: string }]
        >) {
          const sev = vuln.severity as keyof typeof vulns;
          if (sev in vulns) vulns[sev]++;
          vulns.total++;
        }
      }

      // pnpm audit format
      if (data.advisories) {
        for (const advisory of Object.values(data.advisories) as Array<{ severity: string }>) {
          const sev = advisory.severity as keyof typeof vulns;
          if (sev in vulns) vulns[sev]++;
          vulns.total++;
        }
      }
    } catch {
      // Parse text output
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('critical')) vulns.critical++;
        else if (line.includes('high')) vulns.high++;
        else if (line.includes('moderate')) vulns.moderate++;
        else if (line.includes('low')) vulns.low++;
      }
      vulns.total = vulns.critical + vulns.high + vulns.moderate + vulns.low;
    }

    return vulns;
  }

  private async runPerformance(
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    // Check for large files (>500 lines)
    const largeFiles = this.findLargeFiles(projectPath, 500);
    const score = Math.max(0, 100 - largeFiles.length * 5);
    const passed = score >= 80;

    return {
      check: {
        gate: 'performance',
        passed,
        actual: score,
        expected: 80,
        message: passed
          ? `Performance: score ${score}/100 (${largeFiles.length} large files)`
          : `Performance: score ${score}/100 (${largeFiles.length} files exceed 500 lines)`,
        details: { largeFiles: largeFiles.slice(0, 20) },
      },
      metric: { name: 'performance', value: score, unit: 'score', threshold: 80, passed },
    };
  }

  private findLargeFiles(projectPath: string, maxLines: number): string[] {
    const largeFiles: string[] = [];
    try {
      const result = runCommand(
        `find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | head -500`,
        projectPath,
        10000,
      );
      const files = result.stdout.trim().split('\n').filter(Boolean);

      for (const file of files) {
        try {
          const content = require('node:fs').readFileSync(`${projectPath}/${file}`, 'utf-8');
          const lines = content.split('\n').length;
          if (lines > maxLines) {
            largeFiles.push(`${file} (${lines} lines)`);
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // find command not available
    }
    return largeFiles;
  }

  private async runCustomGate(
    gateName: string,
    projectPath: string,
  ): Promise<{ check: QualityCheckResult; metric?: QualityMetric }> {
    const gate = this.gates.find((g) => g.name === gateName);
    if (!gate) {
      return {
        check: {
          gate: gateName,
          passed: true,
          actual: 'unknown',
          expected: true,
          message: `Unknown gate: ${gateName}, auto-pass`,
        },
      };
    }

    // If gate has a config with a command, run it
    const config = gate.config as Record<string, unknown> | undefined;
    if (config?.command) {
      const result = runCommand(String(config.command), projectPath, this.timeout);
      const passed = result.exitCode === 0;
      return {
        check: {
          gate: gateName,
          passed,
          actual: passed ? 'pass' : 'fail',
          expected: true,
          message: passed
            ? `${gateName}: passed`
            : `${gateName}: failed (exit code ${result.exitCode})`,
          details: { output: result.stdout.slice(0, 2000) },
        },
        metric: { name: gateName, value: passed ? 1 : 0, passed },
      };
    }

    return {
      check: {
        gate: gateName,
        passed: true,
        actual: 'no_config',
        expected: true,
        message: `${gateName}: no execution config, auto-pass`,
      },
    };
  }

  /**
   * Create a report from raw results
   */
  createReport(results: QualityCheckResult[]): QualityReport {
    const passedChecks = results.filter((c) => c.passed).length;
    const score = results.length > 0 ? Math.round((passedChecks / results.length) * 100) : 100;

    const metrics: QualityMetric[] = results.map((r) => ({
      name: r.gate,
      value:
        typeof r.actual === 'number' ? r.actual : r.actual === 'pass' || r.actual === true ? 1 : 0,
      passed: r.passed,
      timestamp: new Date().toISOString(),
    }));

    return {
      id: randomUUID(),
      passed: score >= this.minScore && results.every((c) => c.passed),
      score,
      checks: results,
      metrics,
      duration: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // --- Existing API ---

  evaluate(metrics: QualityMetric[]): QualityReport {
    const reportId = randomUUID();
    const start = Date.now();
    const checks: QualityCheckResult[] = [];

    for (const gate of this.gates) {
      const metric = metrics.find((m) => m.name === gate.name);
      if (!metric) {
        checks.push({
          gate: gate.name,
          passed: false,
          actual: 'missing',
          expected: gate.threshold ?? gate.pass,
          message: `Metric not found for gate: ${gate.name}`,
        });
        continue;
      }
      const check = this.evaluateGate(gate, metric);
      checks.push(check);
    }

    const passedChecks = checks.filter((c) => c.passed).length;
    const score = checks.length > 0 ? Math.round((passedChecks / checks.length) * 100) : 100;
    const passed = score >= this.minScore && checks.every((c) => c.passed);

    const report: QualityReport = {
      id: reportId,
      passed,
      score,
      checks,
      metrics,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    this.history.push(report);
    return report;
  }

  private evaluateGate(gate: QualityGate, metric: QualityMetric): QualityCheckResult {
    if (gate.threshold !== undefined) {
      const actual = metric.value;
      const passed = actual >= gate.threshold;
      return {
        gate: gate.name,
        passed,
        actual,
        expected: gate.threshold,
        message: passed
          ? `${gate.name}: ${actual} >= ${gate.threshold}`
          : `${gate.name}: ${actual} < ${gate.threshold} (threshold not met)`,
      };
    }

    if (gate.pass !== undefined) {
      const actual = metric.pass ?? metric.value > 0;
      const passed = actual === gate.pass;
      return {
        gate: gate.name,
        passed,
        actual,
        expected: gate.pass,
        message: passed ? `${gate.name}: passed` : `${gate.name}: failed (expected ${gate.pass})`,
      };
    }

    return {
      gate: gate.name,
      passed: true,
      actual: metric.value,
      expected: 'any',
      message: `${gate.name}: no threshold configured, auto-pass`,
    };
  }

  addGate(gate: QualityGate): void {
    const existing = this.gates.findIndex((g) => g.name === gate.name);
    if (existing >= 0) {
      this.gates[existing] = gate;
    } else {
      this.gates.push(gate);
    }
  }

  removeGate(name: string): boolean {
    const index = this.gates.findIndex((g) => g.name === name);
    if (index >= 0) {
      this.gates.splice(index, 1);
      return true;
    }
    return false;
  }

  getGates(): QualityGate[] {
    return [...this.gates];
  }

  getHistory(): QualityReport[] {
    return [...this.history];
  }

  getLastReport(): QualityReport | undefined {
    return this.history[this.history.length - 1];
  }

  summary(report: QualityReport): string {
    const lines: string[] = [];
    lines.push(`Quality Report: ${report.id}`);
    lines.push(`Overall: ${report.passed ? '✅ PASSED' : '❌ FAILED'} (${report.score}/100)`);
    lines.push(
      `Checks: ${report.checks.filter((c) => c.passed).length}/${report.checks.length} passed`,
    );
    lines.push(`Duration: ${report.duration}ms`);
    for (const check of report.checks) {
      const icon = check.passed ? '✅' : '❌';
      lines.push(`  ${icon} ${check.message}`);
    }
    return lines.join('\n');
  }
}
