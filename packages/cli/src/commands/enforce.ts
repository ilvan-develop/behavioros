import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';

import {
  type ComplianceCheck,
  type ComplianceReport,
  type DoctorSuggestion,
  findProjectRoot,
  generateSuggestions,
  printDoctorSuggestions,
  printReport,
  runCheck,
} from './compliance.js';

// ---------------------------------------------------------------------------
// Additional enforce-only checks
// ---------------------------------------------------------------------------

async function checkDnaValidated(projectRoot: string): Promise<ComplianceCheck> {
  const dnasDir = join(projectRoot, 'dnas');
  if (!existsSync(dnasDir)) {
    return {
      id: 'dna-validated',
      name: 'dna-validated -> dnas/ directory missing',
      pass: false,
      detail: 'dnas/ directory not found',
    };
  }

  let files: string[];
  try {
    files = readdirSync(dnasDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    return {
      id: 'dna-validated',
      name: 'dna-validated -> cannot read dnas/',
      pass: false,
      detail: 'Failed to read dnas/ directory',
    };
  }

  if (files.length === 0) {
    return {
      id: 'dna-validated',
      name: 'dna-validated -> no YAML files in dnas/',
      pass: false,
      detail: 'dnas/ contains no .yaml or .yml files',
    };
  }

  // Try running validate on each file; pass if at least one succeeds
  for (const file of files) {
    const filePath = join(dnasDir, file);
    try {
      execSync(`node "${process.argv[1]}" validate "${filePath}"`, {
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 15000,
      });
      return {
        id: 'dna-validated',
        name: `dna-validated -> ${file}`,
        pass: true,
        detail: `Found ${files.length} YAML file(s), validated ${file} successfully`,
      };
    } catch {
      // continue to next file
    }
  }

  return {
    id: 'dna-validated',
    name: 'dna-validated -> all files failed validation',
    pass: false,
    detail: `Found ${files.length} YAML file(s) but none passed validation`,
  };
}

async function checkPrecommitHook(projectRoot: string): Promise<ComplianceCheck> {
  const candidates = [
    { path: join(projectRoot, '.githooks', 'pre-commit'), label: '.githooks/pre-commit' },
    { path: join(projectRoot, '.husky', 'pre-commit'), label: '.husky/pre-commit' },
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate.path)) {
      return {
        id: 'precommit-hook',
        name: `precommit-hook -> ${candidate.label}`,
        pass: true,
        detail: `found at ${candidate.label}`,
      };
    }
  }

  return {
    id: 'precommit-hook',
    name: 'precommit-hook -> missing',
    pass: false,
    detail: 'Neither .githooks/pre-commit nor .husky/pre-commit found',
  };
}

// ---------------------------------------------------------------------------
// Enforce-specific suggestiions
// ---------------------------------------------------------------------------

function generateEnforceSuggestions(
  report: ComplianceReport,
  projectRoot: string,
): DoctorSuggestion[] {
  const base = generateSuggestions(report, projectRoot);

  for (const check of report.checks) {
    if (check.pass) continue;

    switch (check.id) {
      case 'dna-validated': {
        const detail = check.detail;
        if (detail.includes('directory not found')) {
          base.push({
            checkId: check.id,
            title: 'Create dnas/ directory with DNA YAML files',
            command: `mkdir -p "${join(projectRoot, 'dnas')}"`,
            description:
              'Create the dnas/ directory and add at least one valid DNA YAML pattern file',
          });
        } else if (detail.includes('no YAML files')) {
          base.push({
            checkId: check.id,
            title: 'Add DNA YAML files to dnas/',
            command: `touch "${join(projectRoot, 'dnas', 'my-pattern.yaml')}"`,
            description:
              'Add at least one YAML DNA pattern file to the dnas/ directory following the DNA schema',
          });
        } else {
          base.push({
            checkId: check.id,
            title: 'Fix DNA YAML validation errors',
            command: `npx @behavioros/cli validate "${join(projectRoot, 'dnas')}"`,
            description:
              'Run DNA validation to see specific errors and fix them according to the DNA schema',
          });
        }
        break;
      }
      case 'precommit-hook': {
        base.push({
          checkId: check.id,
          title: 'Create pre-commit hook',
          command: `mkdir -p "${join(projectRoot, '.githooks')}"`,
          description:
            'Create .githooks/pre-commit with BehaviorOS protocol enforcement, then run: git config core.hooksPath .githooks',
        });
        break;
      }
    }
  }

  return base;
}

// ---------------------------------------------------------------------------
// Enforce runner
// ---------------------------------------------------------------------------

async function runEnforceCheck(projectRoot: string): Promise<ComplianceReport> {
  const complianceReport = await runCheck(projectRoot);

  const extraChecks = await Promise.all([
    checkDnaValidated(projectRoot),
    checkPrecommitHook(projectRoot),
  ]);

  const allChecks = [...complianceReport.checks, ...extraChecks];
  const passed = allChecks.filter((c) => c.pass).length;

  return {
    ...complianceReport,
    checks: allChecks,
    passed,
    total: allChecks.length,
  };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function enforceCommand(program: Command): void {
  const enforce = program
    .command('enforce')
    .description('Enforce BehaviorOS protocol compliance with extended checks');

  enforce
    .command('check')
    .description('Run all compliance checks including DNA and pre-commit hook checks')
    .option('--project <path>', 'Path to the project root (default: auto-detect)')
    .action(async (options: { project?: string }) => {
      const projectRoot = options.project
        ? join(process.cwd(), options.project)
        : findProjectRoot();

      if (!existsSync(projectRoot)) {
        console.error(chalk.red(`\n  ✗ Project path not found: ${projectRoot}\n`));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.gray(`Scanning: ${relative(process.cwd(), projectRoot) || '.'}`));

      try {
        const report = await runEnforceCheck(projectRoot);
        printReport(report);

        if (report.passed !== report.total) {
          process.exitCode = 1;
        }
      } catch (err) {
        console.error(chalk.red(`\n  ✗ Enforce check failed: ${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  enforce
    .command('doctor')
    .description('Analyze enforcement failures and suggest fixes')
    .option('--project <path>', 'Path to the project root (default: auto-detect)')
    .action(async (options: { project?: string }) => {
      const projectRoot = options.project
        ? join(process.cwd(), options.project)
        : findProjectRoot();

      if (!existsSync(projectRoot)) {
        console.error(chalk.red(`\n  ✗ Project path not found: ${projectRoot}\n`));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.gray(`Analyzing: ${relative(process.cwd(), projectRoot) || '.'}`));

      try {
        const report = await runEnforceCheck(projectRoot);
        printReport(report);
        const suggestions = generateEnforceSuggestions(report, projectRoot);
        printDoctorSuggestions(suggestions);
      } catch (err) {
        console.error(chalk.red(`\n  ✗ Doctor analysis failed: ${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
