import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import chalk from 'chalk';
import type { Command } from 'commander';

interface ComplianceCheck {
  id: string;
  name: string;
  pass: boolean;
  detail: string;
}

interface ComplianceReport {
  projectPath: string;
  projectName: string;
  checks: ComplianceCheck[];
  passed: number;
  total: number;
}

function findProjectRoot(start = process.cwd()): string {
  let dir = start;
  while (dir.length > 1) {
    if (
      existsSync(join(dir, 'package.json')) ||
      existsSync(join(dir, 'behavioros.yaml')) ||
      existsSync(join(dir, '.behaviorosrc'))
    ) {
      return dir;
    }
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function fileContains(filePath: string, pattern: RegExp | string): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (typeof pattern === 'string') {
      return content.includes(pattern);
    }
    return pattern.test(content);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Check implementations
// ---------------------------------------------------------------------------

async function checkCanonicalDoc(projectRoot: string): Promise<ComplianceCheck> {
  const docPath = join(projectRoot, 'docs', 'PROTOCOL.md');
  const exists = existsSync(docPath);
  return {
    id: 'canonical-doc',
    name: exists
      ? 'canonical-doc -> docs/PROTOCOL.md'
      : 'canonical-doc -> docs/PROTOCOL.md missing',
    pass: exists,
    detail: exists ? 'found' : 'docs/PROTOCOL.md not found',
  };
}

async function checkRulesExist(projectRoot: string): Promise<ComplianceCheck> {
  const target = join(projectRoot, '.opencode', 'rules', 'behavioros-protocol.md');
  const exists = existsSync(target);
  return {
    id: 'rules-exist',
    name: exists
      ? 'rules-exist -> .opencode/rules/behavioros-protocol.md'
      : 'rules-exist -> .opencode/rules/behavioros-protocol.md',
    pass: exists,
    detail: exists ? 'found' : '.opencode/rules/behavioros-protocol.md not found',
  };
}

async function checkPlatformConfigs(projectRoot: string): Promise<ComplianceCheck> {
  const expected: { path: string; label: string }[] = [
    {
      path: join(projectRoot, '.cursor', 'rules', 'behavioros-protocol.mdc'),
      label: '.cursor/rules',
    },
    { path: join(projectRoot, 'CLAUDE.md'), label: 'CLAUDE.md' },
    {
      path: join(projectRoot, '.github', 'copilot-instructions.md'),
      label: '.github/copilot-instructions.md',
    },
    { path: join(projectRoot, '.windsurfrules'), label: '.windsurfrules' },
  ];

  const missing: string[] = [];

  for (const entry of expected) {
    if (!existsSync(entry.path)) {
      missing.push(entry.label);
      continue;
    }
    if (entry.label === 'CLAUDE.md') {
      const hasProtocol = fileContains(entry.path, /behavioros.?protocol/i);
      if (!hasProtocol) {
        missing.push(`${entry.label} (no protocol section)`);
      }
    }
    if (entry.label === '.windsurfrules') {
      const hasProtocol = fileContains(entry.path, /behavioros/i);
      if (!hasProtocol) {
        missing.push(`${entry.label} (no BehaviorOS reference)`);
      }
    }
  }

  if (missing.length === 0) {
    return {
      id: 'platform-configs',
      name: 'platform-configs -> all present',
      pass: true,
      detail: 'cursor, claude, copilot, windsurf',
    };
  }

  return {
    id: 'platform-configs',
    name: `platform-configs -> ${missing.join(', ')} missing`,
    pass: false,
    detail: missing.join(', '),
  };
}

async function checkMcpEnabled(projectRoot: string): Promise<ComplianceCheck> {
  const possibleConfigs = ['opencode.json', 'opencode.jsonc'];
  let mcpConfigured = false;

  for (const configFile of possibleConfigs) {
    const configPath = join(projectRoot, configFile);
    if (!existsSync(configPath)) continue;

    try {
      const content = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.mcp && Object.keys(parsed.mcp).length > 0) {
        for (const [, serverConfig] of Object.entries(parsed.mcp)) {
          const sc = serverConfig as { command?: string; args?: string[] };
          const cmd = sc.command ?? '';
          const args = sc.args?.join(' ') ?? '';
          if (
            cmd.includes('behavioros') ||
            cmd.includes('mcp-server') ||
            args.includes('behavioros') ||
            args.includes('mcp-server')
          ) {
            mcpConfigured = true;
            break;
          }
        }
      }
    } catch {
      // skip unparseable configs
    }
  }

  if (mcpConfigured) {
    return {
      id: 'mcp-enabled',
      name: 'mcp-enabled',
      pass: true,
      detail: 'found in opencode config',
    };
  }

  if (process.env.BEHAVIOROS_DNA_PATH) {
    return {
      id: 'mcp-enabled',
      name: 'mcp-enabled',
      pass: true,
      detail: 'via BEHAVIOROS_DNA_PATH env',
    };
  }

  return {
    id: 'mcp-enabled',
    name: 'mcp-enabled',
    pass: false,
    detail: 'no BehaviorOS MCP server in opencode.json',
  };
}

// ---------------------------------------------------------------------------
// Report printing
// ---------------------------------------------------------------------------

function printReport(report: ComplianceReport): void {
  const { projectName, checks, passed, total } = report;
  const statusStr = passed === total ? chalk.green('PASS') : chalk.red('FAIL');
  const allPassed = passed === total;
  const bar = '═'.repeat(56);

  const lines: string[] = [];

  lines.push(`╔${bar}╗`);
  lines.push(`║ ${chalk.bold('BEHAVIOROS PROTOCOL COMPLIANCE REPORT')}${' '.repeat(17)}║`);
  lines.push(`╠${bar}╣`);
  lines.push(`║ Project: ${projectName.padEnd(45)}║`);
  lines.push(
    `║ Status:  ${typeof statusStr === 'string' ? statusStr : 'PASS/FAIL'}${' '.repeat(42)}║`,
  );
  lines.push(`╠${bar}╣`);
  lines.push(`║ ${chalk.bold('CHECKS:')}${' '.repeat(48)}║`);

  for (const check of checks) {
    const icon = check.pass ? chalk.green('✓') : chalk.red('✗');
    const line = `  ${icon}  ${check.name}`;
    const pad = Math.max(1, 56 - line.length);
    lines.push(`║ ${line}${' '.repeat(pad)}║`);
  }

  lines.push(`╠${bar}╣`);
  const summary = `SUMMARY: ${passed}/${total} checks passing`;
  const summaryPad = Math.max(1, 56 - summary.length);
  lines.push(`║ ${chalk.bold(summary)}${' '.repeat(summaryPad)}║`);

  if (!allPassed) {
    lines.push(`║ ${chalk.bold('REMEDIATION:')}${' '.repeat(42)}║`);
    lines.push(`║  Run: npx @behavioros/cli init --with-protocol${' '.repeat(15)}║`);
  }

  lines.push(`╚${bar}╝`);

  console.log('\n' + lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Doctor suggestions
// ---------------------------------------------------------------------------

interface DoctorSuggestion {
  checkId: string;
  title: string;
  command: string;
  description: string;
}

function generateSuggestions(report: ComplianceReport, projectRoot: string): DoctorSuggestion[] {
  const suggestions: DoctorSuggestion[] = [];

  for (const check of report.checks) {
    if (check.pass) continue;

    switch (check.id) {
      case 'canonical-doc': {
        suggestions.push({
          checkId: check.id,
          title: 'Create docs/PROTOCOL.md',
          command: `mkdir -p "${join(projectRoot, 'docs')}"`,
          description:
            'Create the canonical protocol document at docs/PROTOCOL.md with the 7 mandatory steps',
        });
        break;
      }
      case 'rules-exist': {
        suggestions.push({
          checkId: check.id,
          title: 'Create .opencode/rules/behavioros-protocol.md',
          command: `mkdir -p "${join(projectRoot, '.opencode', 'rules')}"`,
          description:
            'Create the OpenCode protocol rules file at .opencode/rules/behavioros-protocol.md',
        });
        break;
      }
      case 'platform-configs': {
        const missing = check.detail;
        if (missing.includes('.cursor/rules')) {
          suggestions.push({
            checkId: check.id,
            title: 'Create .cursor/rules/behavioros-protocol.mdc',
            command: `mkdir -p "${join(projectRoot, '.cursor', 'rules')}"`,
            description: 'Create the Cursor protocol file referencing docs/PROTOCOL.md',
          });
        }
        if (missing.includes('CLAUDE.md')) {
          suggestions.push({
            checkId: check.id,
            title: 'Update CLAUDE.md with protocol section',
            command: `echo -e "\\n# BehaviorOS Protocol\\nMandatory steps: bos_select_dna, bos_resolve_truth, create-mission, delegate, bos_run_audit, record-learning" >> "${join(projectRoot, 'CLAUDE.md')}"`,
            description: 'Append the BehaviorOS Protocol section to CLAUDE.md',
          });
        }
        if (missing.includes('.github/copilot-instructions.md')) {
          suggestions.push({
            checkId: check.id,
            title: 'Create .github/copilot-instructions.md',
            command: `mkdir -p "${join(projectRoot, '.github')}"`,
            description: 'Create copilot-instructions.md with the BehaviorOS Protocol workflow',
          });
        }
        if (missing.includes('.windsurfrules')) {
          suggestions.push({
            checkId: check.id,
            title: 'Create .windsurfrules',
            command: `touch "${join(projectRoot, '.windsurfrules')}"`,
            description: 'Create .windsurfrules with the mandatory 7-step protocol',
          });
        }
        break;
      }
      case 'mcp-enabled': {
        suggestions.push({
          checkId: check.id,
          title: 'Configure MCP server in opencode.json',
          command: `Edit "${join(projectRoot, 'opencode.json')}" to add behavioros MCP server`,
          description:
            'Add the BehaviorOS MCP server configuration to opencode.json with command and args',
        });
        break;
      }
    }
  }

  return suggestions;
}

function printDoctorSuggestions(suggestions: DoctorSuggestion[]): void {
  if (suggestions.length === 0) {
    console.log(chalk.green('\n  ✓ No issues found — your project is fully compliant!\n'));
    return;
  }

  console.log(chalk.bold('\n🔧 Doctor Prescription:\n'));

  for (const suggestion of suggestions) {
    console.log(`  ${chalk.yellow('⚕')}  ${chalk.bold(suggestion.title)}`);
    console.log(`     ${chalk.gray(suggestion.description)}`);
    console.log(`     ${chalk.cyan('$')} ${suggestion.command}`);
    console.log('');
  }

  console.log(
    chalk.gray('  Run these commands or follow the descriptions above to fix each issue.\n'),
  );
}

// ---------------------------------------------------------------------------
// Main — compliance check
// ---------------------------------------------------------------------------

async function runCheck(projectRoot: string): Promise<ComplianceReport> {
  const checks = await Promise.all([
    checkCanonicalDoc(projectRoot),
    checkRulesExist(projectRoot),
    checkPlatformConfigs(projectRoot),
    checkMcpEnabled(projectRoot),
  ]);

  const passed = checks.filter((c) => c.pass).length;

  let projectName = 'unknown';
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      projectName = pkg.name ?? projectName;
    } catch {
      // fallback
    }
  } else if (existsSync(join(projectRoot, 'behavioros.yaml'))) {
    projectName = 'behavioros-project';
  }

  return {
    projectPath: projectRoot,
    projectName,
    checks,
    passed,
    total: checks.length,
  };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function complianceCommand(program: Command): void {
  const compliance = program
    .command('compliance')
    .description('Check BehaviorOS protocol compliance and auto-fix suggestions');

  compliance
    .command('check')
    .description('Run all compliance checks against the current project')
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
        const report = await runCheck(projectRoot);
        printReport(report);

        if (report.passed !== report.total) {
          process.exitCode = 1;
        }
      } catch (err) {
        console.error(chalk.red(`\n  ✗ Compliance check failed: ${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  compliance
    .command('doctor')
    .description('Analyze compliance failures and suggest fixes')
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
        const report = await runCheck(projectRoot);
        printReport(report);
        const suggestions = generateSuggestions(report, projectRoot);
        printDoctorSuggestions(suggestions);
      } catch (err) {
        console.error(chalk.red(`\n  ✗ Doctor analysis failed: ${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
