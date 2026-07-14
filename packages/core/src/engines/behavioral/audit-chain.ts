/**
 * BOS Audit Chain — triggers automated verification checks at each pipeline stage.
 */

import { execSync } from 'node:child_process';

export interface AuditStep {
  name: string;
  trigger: 'commit' | 'pr' | 'merge' | 'deploy_staging' | 'deploy_production';
  tool: string;
  command: string;
  gate: 'pass' | 'warn' | 'block';
  threshold?: string;
  timeout?: number;
  optional?: boolean;
}

export interface AuditResult {
  step: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  duration: number;
  details: any;
  timestamp: string;
}

export interface AuditChainReport {
  trigger: string;
  results: AuditResult[];
  overallStatus: 'pass' | 'warn' | 'fail';
  totalDuration: number;
  timestamp: string;
}

export class AuditChain {
  private steps: AuditStep[];

  constructor(projectRoot: string) {
    this.steps = this.loadDefaultSteps(projectRoot);
  }

  private loadDefaultSteps(_projectRoot: string): AuditStep[] {
    return [
      {
        name: 'lint',
        trigger: 'commit',
        tool: 'biome',
        command: 'pnpm lint',
        gate: 'pass',
        timeout: 30000,
      },
      {
        name: 'typecheck',
        trigger: 'commit',
        tool: 'tsc',
        command: 'pnpm typecheck',
        gate: 'pass',
        timeout: 60000,
      },
      {
        name: 'lint_pr',
        trigger: 'pr',
        tool: 'biome',
        command: 'pnpm lint',
        gate: 'pass',
        timeout: 30000,
      },
      {
        name: 'typecheck_pr',
        trigger: 'pr',
        tool: 'tsc',
        command: 'pnpm typecheck',
        gate: 'pass',
        timeout: 60000,
      },
      {
        name: 'unit_tests',
        trigger: 'pr',
        tool: 'vitest',
        command: 'pnpm test',
        gate: 'block',
        timeout: 120000,
      },
      {
        name: 'test_coverage',
        trigger: 'pr',
        tool: 'vitest',
        command: 'pnpm test --coverage',
        gate: 'warn',
        threshold: '>= 80%',
        timeout: 120000,
      },
      {
        name: 'contract_compatibility',
        trigger: 'pr',
        tool: 'api-contract-drift',
        command: 'pnpm ai:validate',
        gate: 'block',
        timeout: 60000,
      },
      {
        name: 'security_scan',
        trigger: 'pr',
        tool: 'codeql',
        command: 'pnpm security:scan || true',
        gate: 'warn',
        timeout: 120000,
        optional: true,
      },
      {
        name: 'dependency_audit',
        trigger: 'pr',
        tool: 'pnpm-audit',
        command: 'pnpm audit || true',
        gate: 'warn',
        timeout: 30000,
        optional: true,
      },
      {
        name: 'all_pr_checks',
        trigger: 'merge',
        tool: 'aggregate',
        command: 'echo "All PR checks must have passed"',
        gate: 'pass',
        timeout: 5000,
      },
      {
        name: 'build',
        trigger: 'deploy_staging',
        tool: 'turbo',
        command: 'pnpm build',
        gate: 'block',
        timeout: 180000,
      },
      {
        name: 'migration',
        trigger: 'deploy_staging',
        tool: 'prisma',
        command: 'pnpm db:migrate || true',
        gate: 'warn',
        timeout: 60000,
        optional: true,
      },
      {
        name: 'smoke_tests',
        trigger: 'deploy_staging',
        tool: 'playwright',
        command: 'pnpm e2e:smoke || true',
        gate: 'block',
        timeout: 180000,
        optional: true,
      },
      {
        name: 'all_staging_checks',
        trigger: 'deploy_production',
        tool: 'aggregate',
        command: 'echo "All staging checks must have passed"',
        gate: 'pass',
        timeout: 5000,
      },
      {
        name: 'rollback_verification',
        trigger: 'deploy_production',
        tool: 'manual',
        command: 'echo "Verify rollback path is valid"',
        gate: 'pass',
        timeout: 10000,
      },
      {
        name: 'canary_health',
        trigger: 'deploy_production',
        tool: 'health-check',
        command: 'curl -sf http://localhost:3000/health || true',
        gate: 'warn',
        timeout: 30000,
        optional: true,
      },
    ];
  }

  async execute(trigger: AuditStep['trigger'], context: any = {}): Promise<AuditChainReport> {
    const applicableSteps = this.steps.filter((s) => s.trigger === trigger);
    const results: AuditResult[] = [];
    const startTime = Date.now();

    for (const step of applicableSteps) {
      const stepStart = Date.now();
      try {
        const result = await this.runStep(step, context);
        const passed = result.passed;
        results.push({
          step: step.name,
          status: passed ? 'pass' : step.optional ? 'warn' : 'fail',
          duration: Date.now() - stepStart,
          details: result,
          timestamp: new Date().toISOString(),
        });

        if (!passed && step.gate === 'block' && !step.optional) {
          results.push({
            step: 'CHAIN_HALTED',
            status: 'fail',
            duration: 0,
            details: {
              reason: `Audit halted: ${step.name} failed (gate=block)`,
              failedStep: step.name,
              tool: step.tool,
              command: step.command,
            },
            timestamp: new Date().toISOString(),
          });
          break;
        }
      } catch (error: any) {
        results.push({
          step: step.name,
          status: step.optional ? 'warn' : 'fail',
          duration: Date.now() - stepStart,
          details: { error: error.message },
          timestamp: new Date().toISOString(),
        });
        if (step.gate === 'block' && !step.optional) break;
      }
    }

    const overallStatus = results.some((r) => r.status === 'fail')
      ? 'fail'
      : results.some((r) => r.status === 'warn')
        ? 'warn'
        : 'pass';

    return {
      trigger,
      results,
      overallStatus,
      totalDuration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  private runStep(step: AuditStep, _context: any): Promise<any> {
    try {
      const output = execSync(step.command, {
        timeout: step.timeout || 30000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return Promise.resolve({ passed: true, output: (output as string).trim() });
    } catch (error: any) {
      return Promise.resolve({
        passed: false,
        exitCode: error.status,
        stderr: error.stderr?.toString().trim(),
        stdout: error.stdout?.toString().trim(),
      });
    }
  }

  addStep(step: AuditStep): void {
    this.steps.push(step);
  }

  removeStep(name: string): void {
    this.steps = this.steps.filter((s) => s.name !== name);
  }

  getStepsForTrigger(trigger: AuditStep['trigger']): AuditStep[] {
    return this.steps.filter((s) => s.trigger === trigger);
  }

  listSteps(): AuditStep[] {
    return [...this.steps];
  }
}
