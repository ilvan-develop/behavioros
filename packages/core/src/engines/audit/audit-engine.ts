import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { AuditEvent, AuditResult, AuditSeverity } from '@behavioros/schemas';

// ============================================================
// Audit Engine — Continuous Audit Pipeline (10 real stages)
// ============================================================

export type AuditStage =
  | 'static'
  | 'architecture'
  | 'security'
  | 'performance'
  | 'tests'
  | 'coverage'
  | 'contracts'
  | 'docs'
  | 'compliance'
  | 'benchmarks';

export interface AuditStageResult {
  stage: AuditStage;
  result: AuditResult;
  score: number; // 0-100
  events: AuditEvent[];
  duration: number; // ms
}

export interface AuditPipelineResult {
  id: string;
  overall: AuditResult;
  score: number;
  stages: AuditStageResult[];
  duration: number;
  timestamp: string;
}

export interface StageExecutor {
  stage: AuditStage;
  name: string;
  execute: (context: AuditContext) => Promise<AuditStageResult>;
}

export interface AuditContext {
  projectPath: string;
  targetPath?: string;
  options?: Record<string, unknown>;
}

export interface AuditEngineConfig {
  persistPath?: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// --- Helpers ---

function runCommand(cmd: string, cwd: string): CommandResult {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 60_000,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: execErr.stdout ?? '',
      stderr: execErr.stderr ?? '',
      exitCode: execErr.status ?? 1,
    };
  }
}

function makeEvent(
  type: string,
  severity: AuditSeverity,
  result: AuditResult,
  description: string,
  details?: Record<string, unknown>,
  suggestions?: string[],
): AuditEvent {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    severity,
    result,
    description,
    ...(details ? { details } : {}),
    ...(suggestions ? { suggestions } : {}),
  };
}

function fileExists(projectPath: string, relPath: string): boolean {
  return existsSync(join(projectPath, relPath));
}

function readJsonSafe(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return undefined;
  }
}

function walkFiles(dir: string, ext: string, maxDepth = 8): string[] {
  const results: string[] = [];
  if (maxDepth <= 0) return results;
  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((e) => e.name);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      if (statSync(full).isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(entry)) {
          results.push(...walkFiles(full, ext, maxDepth - 1));
        }
      } else if (extname(entry) === ext) {
        results.push(full);
      }
    } catch {
      // skip inaccessible
    }
  }
  return results;
}

function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function extractImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const imports: string[] = [];
    const importRegex = /(?:import|from|require)\s+['"]([^'"]+)['"]/g;
    let match = importRegex.exec(content);
    while (match) {
      imports.push(match[1]);
      match = importRegex.exec(content);
    }
    return imports;
  } catch {
    return [];
  }
}

function detectPackageManager(projectPath: string): string {
  if (existsSync(join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectPath, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function detectTestFramework(projectPath: string): string | undefined {
  const pkgJson = readJsonSafe(join(projectPath, 'package.json')) as
    | Record<string, unknown>
    | undefined;
  if (!pkgJson) return undefined;
  const deps = Object.keys({
    ...(pkgJson.dependencies as Record<string, unknown> | undefined),
    ...(pkgJson.devDependencies as Record<string, unknown> | undefined),
  });
  if (deps.includes('vitest')) return 'vitest';
  if (deps.includes('jest')) return 'jest';
  return undefined;
}

function scoreFromViolations(violations: number, penalty: number, floor = 0): number {
  return Math.max(floor, 100 - violations * penalty);
}

// ============================================================
// AuditEngine
// ============================================================

export class AuditEngine {
  private stages: Map<AuditStage, StageExecutor> = new Map();
  private history: AuditPipelineResult[] = [];
  private requiredStages: AuditStage[] = ['static', 'security', 'tests', 'coverage', 'contracts'];
  private persistPath?: string;

  constructor(config?: AuditEngineConfig) {
    this.persistPath = config?.persistPath;
    if (this.persistPath) {
      this.loadHistory();
    }
    this.registerDefaultStages();
  }

  async execute(context: AuditContext, stages?: AuditStage[]): Promise<AuditPipelineResult> {
    const pipelineId = randomUUID();
    const targetStages = stages ?? this.requiredStages;
    const start = Date.now();
    const stageResults: AuditStageResult[] = [];

    for (const stageName of targetStages) {
      const executor = this.stages.get(stageName);
      if (!executor) {
        stageResults.push({
          stage: stageName,
          result: 'skip',
          score: 0,
          events: [],
          duration: 0,
        });
        continue;
      }

      const stageStart = Date.now();
      try {
        const result = await executor.execute(context);
        result.duration = Date.now() - stageStart;
        stageResults.push(result);
      } catch (error) {
        stageResults.push({
          stage: stageName,
          result: 'fail',
          score: 0,
          events: [
            makeEvent(
              `audit:${stageName}:error`,
              'error',
              'fail',
              `Stage ${stageName} failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
          ],
          duration: Date.now() - stageStart,
        });
      }
    }

    const overallScore = this.calculateOverallScore(stageResults);
    const overall = this.determineOverallResult(stageResults);

    const pipelineResult: AuditPipelineResult = {
      id: pipelineId,
      overall,
      score: overallScore,
      stages: stageResults,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    this.history.push(pipelineResult);
    if (this.persistPath) {
      this.saveHistory();
    }
    return pipelineResult;
  }

  registerStage(executor: StageExecutor): void {
    this.stages.set(executor.stage, executor);
  }

  getHistory(): AuditPipelineResult[] {
    if (this.persistPath) {
      this.loadHistory();
    }
    return [...this.history];
  }

  getLastAudit(): AuditPipelineResult | undefined {
    return this.history[this.history.length - 1];
  }

  summary(result: AuditPipelineResult): string {
    const lines: string[] = [];
    lines.push(`Audit Pipeline: ${result.id}`);
    lines.push(
      `Overall: ${result.overall === 'pass' ? 'PASS' : result.overall === 'fail' ? 'FAIL' : 'WARN'} (${result.score}/100)`,
    );
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(`Stages: ${result.stages.length}`);
    for (const stage of result.stages) {
      const icon =
        stage.result === 'pass'
          ? '[PASS]'
          : stage.result === 'fail'
            ? '[FAIL]'
            : stage.result === 'skip'
              ? '[SKIP]'
              : '[WARN]';
      lines.push(`  ${icon} ${stage.stage}: ${stage.score}/100 (${stage.duration}ms)`);
      for (const evt of stage.events) {
        lines.push(`    - ${evt.description}`);
      }
    }
    return lines.join('\n');
  }

  // --- Private helpers ---

  private calculateOverallScore(stages: AuditStageResult[]): number {
    if (stages.length === 0) return 0;
    const total = stages.reduce((sum, s) => sum + s.score, 0);
    return Math.round(total / stages.length);
  }

  private determineOverallResult(stages: AuditStageResult[]): AuditResult {
    if (stages.some((s) => s.result === 'fail')) return 'fail';
    if (stages.some((s) => s.result === 'warn')) return 'warn';
    return 'pass';
  }

  private loadHistory(): void {
    if (!this.persistPath) return;
    try {
      const raw = readFileSync(this.persistPath, 'utf-8');
      this.history = JSON.parse(raw) as AuditPipelineResult[];
    } catch {
      this.history = [];
    }
  }

  private saveHistory(): void {
    if (!this.persistPath) return;
    try {
      writeFileSync(this.persistPath, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch {
      // non-fatal
    }
  }

  // ============================================================
  // Default stage implementations — REAL, not stubs
  // ============================================================

  private registerDefaultStages(): void {
    this.registerStaticStage();
    this.registerTestsStage();
    this.registerCoverageStage();
    this.registerSecurityStage();
    this.registerPerformanceStage();
    this.registerArchitectureStage();
    this.registerContractsStage();
    this.registerDocsStage();
    this.registerComplianceStage();
    this.registerBenchmarksStage();
  }

  // --- 1. STATIC ANALYSIS ---

  private registerStaticStage(): void {
    this.stages.set('static', {
      stage: 'static',
      name: 'Static Analysis',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const pkgJson = readJsonSafe(join(projectPath, 'package.json')) as
          | Record<string, unknown>
          | undefined;
        const deps = pkgJson
          ? Object.keys({
              ...(pkgJson.dependencies as Record<string, unknown> | undefined),
              ...(pkgJson.devDependencies as Record<string, unknown> | undefined),
            })
          : [];

        const hasBiome = deps.includes('@biomejs/biome') || fileExists(projectPath, 'biome.json');
        const hasEslint =
          deps.includes('eslint') ||
          fileExists(projectPath, '.eslintrc.js') ||
          fileExists(projectPath, '.eslintrc.json');

        let errors = 0;
        let warnings = 0;
        let toolUsed = 'none';

        if (hasBiome) {
          toolUsed = 'biome';
          const r = runCommand('npx biome check --no-errors-on-unmatched .', projectPath);
          const output = r.stdout + r.stderr;
          // Biome: " errors" and " warnings" in summary line
          const errMatch = output.match(/(\d+)\s+errors?/);
          const warnMatch = output.match(/(\d+)\s+warnings?/);
          errors = errMatch ? Number.parseInt(errMatch[1], 10) : 0;
          warnings = warnMatch ? Number.parseInt(warnMatch[1], 10) : 0;
        } else if (hasEslint) {
          toolUsed = 'eslint';
          const r = runCommand('npx eslint . --format json', projectPath);
          try {
            const eslintResults = JSON.parse(r.stdout) as Array<{
              errorCount: number;
              warningCount: number;
            }>;
            for (const file of eslintResults) {
              errors += file.errorCount;
              warnings += file.warningCount;
            }
          } catch {
            // fallback: count lines with "error" in output
            const lines = r.stdout.split('\n');
            for (const line of lines) {
              if (line.includes('error')) errors++;
              if (line.includes('warning')) warnings++;
            }
          }
        } else {
          // No linter detected — run tsc --noEmit as fallback static check
          toolUsed = 'tsc';
          const r = runCommand('npx tsc --noEmit', projectPath);
          if (r.exitCode !== 0) {
            errors =
              (r.stdout.match(/error TS/g) || []).length ||
              (r.stderr.match(/error TS/g) || []).length;
          }
        }

        if (toolUsed === 'none') {
          events.push(
            makeEvent(
              'audit:static:skip',
              'warning',
              'warn',
              'No static analysis tool found (biome/eslint). Fell back to tsc.',
              { toolUsed },
            ),
          );
        }

        if (errors > 0) {
          events.push(
            makeEvent(
              'audit:static:errors',
              'error',
              'fail',
              `Found ${errors} error(s) and ${warnings} warning(s) via ${toolUsed}`,
              {
                toolUsed,
                errors,
                warnings,
              },
            ),
          );
        } else if (warnings > 0) {
          events.push(
            makeEvent(
              'audit:static:warnings',
              'warning',
              'warn',
              `Found ${warnings} warning(s) via ${toolUsed}`,
              {
                toolUsed,
                warnings,
              },
            ),
          );
        } else {
          events.push(
            makeEvent('audit:static:pass', 'info', 'pass', `No issues found via ${toolUsed}`, {
              toolUsed,
            }),
          );
        }

        const score = scoreFromViolations(errors, 5) - Math.min(warnings, 20);
        return {
          stage: 'static',
          result: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
          score: Math.max(0, Math.min(100, score)),
          events,
          duration: 0,
        };
      },
    });
  }

  // --- 2. TESTS ---

  private registerTestsStage(): void {
    this.stages.set('tests', {
      stage: 'tests',
      name: 'Test Execution',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const framework = detectTestFramework(projectPath);

        if (!framework) {
          events.push(
            makeEvent(
              'audit:tests:no-framework',
              'warning',
              'skip',
              'No test framework detected (vitest/jest)',
              {},
            ),
          );
          return { stage: 'tests', result: 'skip', score: 0, events, duration: 0 };
        }

        const pkg = detectPackageManager(projectPath);
        const cmd =
          framework === 'vitest'
            ? `${pkg} run --reporter=json`
            : `${pkg} test --json --outputFile=/dev/stdout`;
        const r = runCommand(cmd, projectPath);
        const output = r.stdout + r.stderr;

        let passed = 0;
        let failed = 0;
        let total = 0;

        if (framework === 'vitest') {
          // Vitest JSON output: { testResults: [{ status, ... }] }
          try {
            // Vitest json output is wrapped — find JSON array/object
            const jsonStart = output.indexOf('{');
            if (jsonStart !== -1) {
              const parsed = JSON.parse(output.slice(jsonStart)) as {
                testResults?: Array<{ status: string }>;
              };
              const results = parsed.testResults ?? [];
              total = results.length;
              passed = results.filter((t) => t.status === 'passed').length;
              failed = results.filter((t) => t.status === 'failed').length;
            }
          } catch {
            // fallback: parse summary lines
            const passMatch = output.match(/(\d+)\s+passed/);
            const failMatch = output.match(/(\d+)\s+failed/);
            passed = passMatch ? Number.parseInt(passMatch[1], 10) : 0;
            failed = failMatch ? Number.parseInt(failMatch[1], 10) : 0;
            total = passed + failed;
          }
        } else {
          // Jest JSON output: { numPassedTests, numFailedTests, numTotalTests }
          try {
            const parsed = JSON.parse(output) as {
              numPassedTests?: number;
              numFailedTests?: number;
              numTotalTests?: number;
            };
            passed = parsed.numPassedTests ?? 0;
            failed = parsed.numFailedTests ?? 0;
            total = parsed.numTotalTests ?? passed + failed;
          } catch {
            const passMatch = output.match(/(\d+)\s+passed/);
            const failMatch = output.match(/(\d+)\s+failed/);
            passed = passMatch ? Number.parseInt(passMatch[1], 10) : 0;
            failed = failMatch ? Number.parseInt(failMatch[1], 10) : 0;
            total = passed + failed;
          }
        }

        if (total === 0) {
          events.push(
            makeEvent(
              'audit:tests:no-tests',
              'warning',
              'warn',
              `${framework} ran but found 0 tests`,
              { framework },
            ),
          );
          return { stage: 'tests', result: 'warn', score: 50, events, duration: 0 };
        }

        events.push(
          makeEvent(
            'audit:tests:result',
            failed > 0 ? 'error' : 'info',
            failed > 0 ? 'fail' : 'pass',
            `${passed}/${total} tests passed (${failed} failed) [${framework}]`,
            { framework, passed, failed, total },
          ),
        );

        const score = total > 0 ? Math.round((passed / total) * 100) : 0;
        return {
          stage: 'tests',
          result: failed > 0 ? 'fail' : 'pass',
          score,
          events,
          duration: 0,
        };
      },
    });
  }

  // --- 3. COVERAGE ---

  private registerCoverageStage(): void {
    this.stages.set('coverage', {
      stage: 'coverage',
      name: 'Code Coverage',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const framework = detectTestFramework(projectPath);

        if (!framework) {
          events.push(
            makeEvent(
              'audit:coverage:no-framework',
              'warning',
              'skip',
              'No test framework — cannot run coverage',
              {},
            ),
          );
          return { stage: 'coverage', result: 'skip', score: 0, events, duration: 0 };
        }

        const pkg = detectPackageManager(projectPath);
        const coverageFlag = framework === 'vitest' ? 'vitest run --coverage' : 'jest --coverage';
        const cmd = `${pkg} ${coverageFlag}`;
        const r = runCommand(cmd, projectPath);
        const output = r.stdout + r.stderr;

        // Parse text summary: "Lines": 85.5 | "Branches": 78.2 | "Functions": 90.1 | "Statements": 84.3
        let lines = 0;
        let branches = 0;
        let functions = 0;
        let statements = 0;

        const linesMatch =
          output.match(/Lines\s*:\s*([\d.]+)/i) ?? output.match(/"Lines":\s*([\d.]+)/);
        const branchesMatch =
          output.match(/Branches\s*:\s*([\d.]+)/i) ?? output.match(/"Branches":\s*([\d.]+)/);
        const functionsMatch =
          output.match(/Functions\s*:\s*([\d.]+)/i) ?? output.match(/"Functions":\s*([\d.]+)/);
        const statementsMatch =
          output.match(/Statements\s*:\s*([\d.]+)/i) ?? output.match(/"Statements":\s*([\d.]+)/);

        if (linesMatch) lines = Number.parseFloat(linesMatch[1]);
        if (branchesMatch) branches = Number.parseFloat(branchesMatch[1]);
        if (functionsMatch) functions = Number.parseFloat(functionsMatch[1]);
        if (statementsMatch) statements = Number.parseFloat(statementsMatch[1]);

        // If we didn't parse anything, try the JSON report
        if (lines === 0 && branches === 0 && functions === 0 && statements === 0) {
          const coverageJsonPath = join(projectPath, 'coverage', 'coverage-summary.json');
          if (existsSync(coverageJsonPath)) {
            const report = readJsonSafe(coverageJsonPath) as
              | Record<
                  string,
                  {
                    lines?: { pct?: number };
                    branches?: { pct?: number };
                    functions?: { pct?: number };
                    statements?: { pct?: number };
                  }
                >
              | undefined;
            if (report?.total) {
              lines = report.total.lines?.pct ?? 0;
              branches = report.total.branches?.pct ?? 0;
              functions = report.total.functions?.pct ?? 0;
              statements = report.total.statements?.pct ?? 0;
            }
          }
        }

        const hasAny = lines > 0 || branches > 0 || functions > 0 || statements > 0;
        if (!hasAny) {
          events.push(
            makeEvent(
              'audit:coverage:no-data',
              'warning',
              'warn',
              'Coverage ran but no data could be parsed',
              { output: output.slice(0, 500) },
            ),
          );
          return { stage: 'coverage', result: 'warn', score: 0, events, duration: 0 };
        }

        const avg =
          (lines + branches + functions + statements) /
          (lines > 0 && branches > 0 && functions > 0 && statements > 0 ? 4 : lines > 0 ? 1 : 1);
        const score = Math.round(Math.min(100, avg));
        const result: AuditResult = score >= 80 ? 'pass' : score >= 60 ? 'warn' : 'fail';

        events.push(
          makeEvent(
            'audit:coverage:result',
            result === 'fail' ? 'error' : 'info',
            result,
            `Coverage: Lines=${lines}% Branches=${branches}% Functions=${functions}% Statements=${statements}%`,
            { lines, branches, functions, statements, average: avg },
          ),
        );

        return { stage: 'coverage', result, score, events, duration: 0 };
      },
    });
  }

  // --- 4. SECURITY ---

  private registerSecurityStage(): void {
    this.stages.set('security', {
      stage: 'security',
      name: 'Security Analysis',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const pkg = detectPackageManager(projectPath);

        // Run audit --json
        const auditCmd = pkg === 'pnpm' ? 'pnpm audit --json' : 'npm audit --json';
        const r = runCommand(auditCmd, projectPath);

        let critical = 0;
        let high = 0;
        let moderate = 0;
        let low = 0;

        try {
          const parsed = JSON.parse(r.stdout) as {
            metadata?: {
              vulnerabilities?: {
                critical?: number;
                high?: number;
                moderate?: number;
                low?: number;
              };
            };
            vulnerabilities?: Record<string, { severity: string }>;
          };
          if (parsed.metadata?.vulnerabilities) {
            critical = parsed.metadata.vulnerabilities.critical ?? 0;
            high = parsed.metadata.vulnerabilities.high ?? 0;
            moderate = parsed.metadata.vulnerabilities.moderate ?? 0;
            low = parsed.metadata.vulnerabilities.low ?? 0;
          } else if (parsed.vulnerabilities) {
            for (const vuln of Object.values(parsed.vulnerabilities)) {
              if (vuln.severity === 'critical') critical++;
              else if (vuln.severity === 'high') high++;
              else if (vuln.severity === 'moderate') moderate++;
              else if (vuln.severity === 'low') low++;
            }
          }
        } catch {
          // fallback: count lines
          const lines = r.stderr.split('\n');
          for (const line of lines) {
            const lower = line.toLowerCase();
            if (lower.includes('critical')) critical++;
            else if (lower.includes('high')) high++;
            else if (lower.includes('moderate')) moderate++;
            else if (lower.includes('low')) low++;
          }
        }

        const totalVulns = critical + high + moderate + low;

        if (critical > 0) {
          events.push(
            makeEvent(
              'audit:security:critical',
              'critical',
              'fail',
              `${critical} critical vulnerability(ies) found`,
              { critical, high, moderate, low },
            ),
          );
        }
        if (high > 0) {
          events.push(
            makeEvent(
              'audit:security:high',
              'error',
              'fail',
              `${high} high severity vulnerability(ies) found`,
              { high },
            ),
          );
        }
        if (moderate > 0) {
          events.push(
            makeEvent(
              'audit:security:moderate',
              'warning',
              'warn',
              `${moderate} moderate vulnerability(ies) found`,
              { moderate },
            ),
          );
        }
        if (low > 0) {
          events.push(
            makeEvent(
              'audit:security:low',
              'info',
              'warn',
              `${low} low severity vulnerability(ies) found`,
              { low },
            ),
          );
        }
        if (totalVulns === 0) {
          events.push(
            makeEvent('audit:security:pass', 'info', 'pass', 'No known vulnerabilities found', {}),
          );
        }

        const score = Math.max(0, 100 - critical * 30 - high * 15 - moderate * 5 - low * 2);
        const result: AuditResult =
          critical > 0 ? 'fail' : high > 0 ? 'fail' : moderate > 0 ? 'warn' : 'pass';

        return { stage: 'security', result, score, events, duration: 0 };
      },
    });
  }

  // --- 5. PERFORMANCE (typecheck) ---

  private registerPerformanceStage(): void {
    this.stages.set('performance', {
      stage: 'performance',
      name: 'Performance Analysis',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];

        const r = runCommand('npx tsc --noEmit', projectPath);
        const output = r.stdout + r.stderr;

        let typeErrors = 0;
        const tsMatches = output.match(/error TS\d+/g);
        if (tsMatches) {
          typeErrors = tsMatches.length;
        }

        // Check for lint-staged / large bundle indicators
        const largeFiles: string[] = [];
        const tsFiles = walkFiles(projectPath, '.ts', 3).concat(walkFiles(projectPath, '.tsx', 3));
        for (const file of tsFiles.slice(0, 200)) {
          const lines = countLines(file);
          if (lines > 500) {
            largeFiles.push(file.replace(projectPath, '.'));
          }
        }

        if (typeErrors > 0) {
          events.push(
            makeEvent(
              'audit:performance:type-errors',
              'error',
              'fail',
              `${typeErrors} TypeScript type error(s)`,
              { typeErrors },
            ),
          );
        }
        if (largeFiles.length > 0) {
          events.push(
            makeEvent(
              'audit:performance:large-files',
              'warning',
              'warn',
              `${largeFiles.length} file(s) exceed 500 lines`,
              { files: largeFiles.slice(0, 10) },
            ),
          );
        }
        if (typeErrors === 0 && largeFiles.length === 0) {
          events.push(
            makeEvent(
              'audit:performance:pass',
              'info',
              'pass',
              'No type errors and no oversized files',
              {},
            ),
          );
        }

        const score = scoreFromViolations(typeErrors, 3) - Math.min(largeFiles.length * 5, 30);
        const result: AuditResult =
          typeErrors > 0 ? 'fail' : largeFiles.length > 0 ? 'warn' : 'pass';

        return { stage: 'performance', result, score: Math.max(0, score), events, duration: 0 };
      },
    });
  }

  // --- 6. ARCHITECTURE ---

  private registerArchitectureStage(): void {
    this.stages.set('architecture', {
      stage: 'architecture',
      name: 'Architecture Analysis',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const violations: string[] = [];
        const largeFiles: string[] = [];

        // Check file sizes
        const allTs = walkFiles(projectPath, '.ts', 4).concat(walkFiles(projectPath, '.tsx', 4));
        for (const file of allTs) {
          const lines = countLines(file);
          if (lines > 500) {
            largeFiles.push(file.replace(projectPath, '.'));
          }
        }

        // Simple circular dependency detection via import analysis
        const importMap = new Map<string, Set<string>>();
        for (const file of allTs) {
          const imports = extractImports(file);
          const relFile = file.replace(projectPath, '.');
          const resolved = new Set<string>();
          for (const imp of imports) {
            if (imp.startsWith('.')) {
              resolved.add(imp);
            }
          }
          importMap.set(relFile, resolved);
        }

        // Check A -> B -> A (depth 2)
        const circularPairs: string[] = [];
        for (const [file, imports] of importMap) {
          for (const imp of imports) {
            const targetImports = importMap.get(imp);
            if (targetImports?.has(file)) {
              const pair = `${file} <-> ${imp}`;
              if (!circularPairs.includes(pair)) {
                circularPairs.push(pair);
              }
            }
          }
        }

        if (largeFiles.length > 0) {
          violations.push(...largeFiles.map((f) => `Oversized file: ${f}`));
          events.push(
            makeEvent(
              'audit:architecture:large-files',
              'warning',
              'warn',
              `${largeFiles.length} file(s) > 500 lines`,
              { files: largeFiles.slice(0, 10) },
            ),
          );
        }
        if (circularPairs.length > 0) {
          violations.push(...circularPairs.map((p) => `Circular dependency: ${p}`));
          events.push(
            makeEvent(
              'audit:architecture:circular',
              'error',
              'fail',
              `${circularPairs.length} circular dependency(ies) detected`,
              { pairs: circularPairs.slice(0, 10) },
            ),
          );
        }
        if (violations.length === 0) {
          events.push(
            makeEvent(
              'audit:architecture:pass',
              'info',
              'pass',
              'No architecture violations detected',
              {},
            ),
          );
        }

        const score = Math.max(0, 100 - violations.length * 15);
        const result: AuditResult =
          circularPairs.length > 0 ? 'fail' : largeFiles.length > 0 ? 'warn' : 'pass';

        return { stage: 'architecture', result, score, events, duration: 0 };
      },
    });
  }

  // --- 7. CONTRACTS ---

  private registerContractsStage(): void {
    this.stages.set('contracts', {
      stage: 'contracts',
      name: 'Contract Validation',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const findings: string[] = [];

        // Look for OpenAPI / GraphQL schemas
        const openApiFiles = walkFiles(projectPath, '.yaml', 3)
          .concat(walkFiles(projectPath, '.json', 3))
          .filter((f) => {
            const lower = f.toLowerCase();
            return lower.includes('openapi') || lower.includes('swagger');
          });

        const graphqlFiles = walkFiles(projectPath, '.graphql', 3).concat(
          walkFiles(projectPath, '.gql', 3),
        );

        // Check for schema definitions in code
        const hasApiSchema = openApiFiles.length > 0;
        const hasGraphqlSchema = graphqlFiles.length > 0;

        if (!hasApiSchema && !hasGraphqlSchema) {
          findings.push('No OpenAPI or GraphQL schema files found');
          events.push(
            makeEvent(
              'audit:contracts:no-schema',
              'warning',
              'warn',
              'No API contract files detected (openapi/swagger/graphql)',
              {},
            ),
          );
        } else {
          // Validate OpenAPI files
          for (const file of openApiFiles) {
            const content = readJsonSafe(file) as Record<string, unknown> | undefined;
            if (content) {
              if (!content.openapi && !content.swagger) {
                findings.push(
                  `${file.replace(projectPath, '.')} missing openapi/swagger version field`,
                );
              }
              if (
                !content.paths ||
                Object.keys(content.paths as Record<string, unknown>).length === 0
              ) {
                findings.push(`${file.replace(projectPath, '.')} has no paths defined`);
              }
            }
          }

          // Validate GraphQL schemas have type definitions
          for (const file of graphqlFiles) {
            try {
              const content = readFileSync(file, 'utf-8');
              if (!content.includes('type ') && !content.includes('schema ')) {
                findings.push(`${file.replace(projectPath, '.')} has no type definitions`);
              }
            } catch {
              // skip unreadable
            }
          }

          if (findings.length > 0) {
            events.push(
              makeEvent(
                'audit:contracts:issues',
                'warning',
                'warn',
                `${findings.length} contract issue(s) found`,
                { findings: findings.slice(0, 10) },
              ),
            );
          } else {
            events.push(
              makeEvent(
                'audit:contracts:pass',
                'info',
                'pass',
                `${openApiFiles.length + graphqlFiles.length} API contract(s) validated`,
                {
                  openApi: openApiFiles.length,
                  graphql: graphqlFiles.length,
                },
              ),
            );
          }
        }

        const schemaCount = openApiFiles.length + graphqlFiles.length;
        const hasSchemas = schemaCount > 0;
        const score = hasSchemas ? Math.max(0, 100 - findings.length * 20) : 50;
        const result: AuditResult = findings.length > 0 ? 'warn' : hasSchemas ? 'pass' : 'warn';

        return { stage: 'contracts', result, score, events, duration: 0 };
      },
    });
  }

  // --- 8. DOCS ---

  private registerDocsStage(): void {
    this.stages.set('docs', {
      stage: 'docs',
      name: 'Documentation Check',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const checks: Array<{ name: string; found: boolean }> = [];

        checks.push({ name: 'README.md', found: fileExists(projectPath, 'README.md') });
        checks.push({ name: 'CHANGELOG.md', found: fileExists(projectPath, 'CHANGELOG.md') });
        checks.push({ name: 'CONTRIBUTING.md', found: fileExists(projectPath, 'CONTRIBUTING.md') });
        checks.push({ name: 'docs/ directory', found: existsSync(join(projectPath, 'docs')) });
        checks.push({
          name: 'LICENSE',
          found: fileExists(projectPath, 'LICENSE') || fileExists(projectPath, 'LICENSE.md'),
        });

        // Check for API docs
        const hasApiDocs = walkFiles(projectPath, '.md', 2).some((f) => {
          const lower = f.toLowerCase();
          return lower.includes('api') || lower.includes('sdk');
        });
        checks.push({ name: 'API docs', found: hasApiDocs });

        const found = checks.filter((c) => c.found).length;
        const missing = checks.filter((c) => !c.found).map((c) => c.name);

        if (missing.length > 0) {
          events.push(
            makeEvent(
              'audit:docs:missing',
              'warning',
              'warn',
              `Missing documentation: ${missing.join(', ')}`,
              { missing, found, total: checks.length },
            ),
          );
        } else {
          events.push(
            makeEvent(
              'audit:docs:pass',
              'info',
              'pass',
              `All documentation checks passed (${found}/${checks.length})`,
              { found, total: checks.length },
            ),
          );
        }

        const score = Math.round((found / checks.length) * 100);
        const result: AuditResult =
          found === checks.length ? 'pass' : found >= checks.length / 2 ? 'warn' : 'fail';

        return { stage: 'docs', result, score, events, duration: 0 };
      },
    });
  }

  // --- 9. COMPLIANCE ---

  private registerComplianceStage(): void {
    this.stages.set('compliance', {
      stage: 'compliance',
      name: 'Compliance Check',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];
        const checks: Array<{ name: string; found: boolean }> = [];

        checks.push({
          name: 'LICENSE',
          found: fileExists(projectPath, 'LICENSE') || fileExists(projectPath, 'LICENSE.md'),
        });
        checks.push({
          name: '.env.example',
          found: fileExists(projectPath, '.env.example') || fileExists(projectPath, '.env.sample'),
        });
        checks.push({ name: '.gitignore', found: fileExists(projectPath, '.gitignore') });
        checks.push({
          name: 'CI/CD config',
          found:
            fileExists(projectPath, '.github') ||
            fileExists(projectPath, '.gitlab-ci.yml') ||
            fileExists(projectPath, 'Jenkinsfile') ||
            fileExists(projectPath, '.circleci'),
        });
        checks.push({ name: '.editorconfig', found: fileExists(projectPath, '.editorconfig') });
        checks.push({
          name: 'Dockerfile',
          found:
            fileExists(projectPath, 'Dockerfile') ||
            fileExists(projectPath, 'docker-compose.yml') ||
            fileExists(projectPath, 'docker-compose.yaml'),
        });

        // Check for secrets in source
        const envFiles = walkFiles(projectPath, '.env', 2).filter((f) => {
          const base = f.split('/').pop() ?? '';
          return base === '.env' && !base.endsWith('.example') && !base.endsWith('.sample');
        });
        const hasCommittedSecrets = envFiles.length > 0;

        if (hasCommittedSecrets) {
          checks.push({ name: 'no committed secrets', found: false });
          events.push(
            makeEvent(
              'audit:compliance:secrets',
              'critical',
              'fail',
              '.env file found in source — secrets may be committed',
              { files: envFiles },
            ),
          );
        } else {
          checks.push({ name: 'no committed secrets', found: true });
        }

        const found = checks.filter((c) => c.found).length;
        const missing = checks.filter((c) => !c.found).map((c) => c.name);

        if (missing.length > 0) {
          events.push(
            makeEvent(
              'audit:compliance:missing',
              'warning',
              'warn',
              `Missing compliance items: ${missing.join(', ')}`,
              { missing, found, total: checks.length },
            ),
          );
        } else {
          events.push(
            makeEvent(
              'audit:compliance:pass',
              'info',
              'pass',
              `All compliance checks passed (${found}/${checks.length})`,
              { found, total: checks.length },
            ),
          );
        }

        const score = Math.round((found / checks.length) * 100);
        const result: AuditResult = hasCommittedSecrets
          ? 'fail'
          : found === checks.length
            ? 'pass'
            : found >= checks.length / 2
              ? 'warn'
              : 'fail';

        return { stage: 'compliance', result, score, events, duration: 0 };
      },
    });
  }

  // --- 10. BENCHMARKS ---

  private registerBenchmarksStage(): void {
    this.stages.set('benchmarks', {
      stage: 'benchmarks',
      name: 'Benchmark Check',
      execute: async (context) => {
        const { projectPath } = context;
        const events: AuditEvent[] = [];

        // Look for benchmark files
        const benchFiles = walkFiles(projectPath, '.bench.ts', 3)
          .concat(walkFiles(projectPath, '.bench.js', 3))
          .concat(walkFiles(projectPath, '.benchmark.ts', 3));

        const _hasPerfConfig =
          fileExists(projectPath, 'vitest.config.ts') || fileExists(projectPath, 'jest.config.ts');
        const benchScript = (() => {
          try {
            const pkg = readJsonSafe(join(projectPath, 'package.json')) as
              | { scripts?: Record<string, string> }
              | undefined;
            const scripts = pkg?.scripts ?? {};
            return scripts.bench ?? scripts.benchmark ?? undefined;
          } catch {
            return undefined;
          }
        })();

        if (benchFiles.length === 0 && !benchScript) {
          events.push(
            makeEvent(
              'audit:benchmarks:none',
              'info',
              'skip',
              'No benchmark files or scripts found',
              {},
            ),
          );
          return { stage: 'benchmarks', result: 'skip', score: 0, events, duration: 0 };
        }

        // Try to run benchmarks
        if (benchScript) {
          const pkg = detectPackageManager(projectPath);
          const r = runCommand(`${pkg} run bench`, projectPath);
          const output = r.stdout + r.stderr;

          if (r.exitCode === 0) {
            events.push(
              makeEvent(
                'audit:benchmarks:run',
                'info',
                'pass',
                'Benchmarks executed successfully',
                { output: output.slice(0, 1000) },
              ),
            );
          } else {
            events.push(
              makeEvent('audit:benchmarks:failed', 'error', 'fail', 'Benchmark execution failed', {
                exitCode: r.exitCode,
                output: output.slice(0, 500),
              }),
            );
            return { stage: 'benchmarks', result: 'fail', score: 30, events, duration: 0 };
          }
        }

        // Static check: count bench files
        events.push(
          makeEvent(
            'audit:benchmarks:found',
            'info',
            'pass',
            `${benchFiles.length} benchmark file(s) detected`,
            { files: benchFiles.map((f) => f.replace(projectPath, '.')) },
          ),
        );

        return {
          stage: 'benchmarks',
          result: 'pass',
          score: benchScript ? 80 : 60,
          events,
          duration: 0,
        };
      },
    });
  }
}
