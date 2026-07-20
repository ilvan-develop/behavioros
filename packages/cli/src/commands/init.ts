import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';
import ora from 'ora';

interface InitAnswers {
  projectName: string;
  description: string;
  teamSize: string;
  governanceLevel: string;
  qualityGates: boolean;
  author: string;
}

interface ProtocolVars {
  PROJECT_NAME: string;
  PROTOCOL_PATH: string;
  MCP_SERVER_COMMAND: string;
  DNA_PATH: string;
  ENFORCEMENT_LEVEL: string;
}

function buildYAML(answers: InitAnswers): string {
  const teamSizeMap: Record<string, number> = {
    small: 5,
    medium: 15,
    large: 50,
  };

  const maxAgents = teamSizeMap[answers.teamSize] ?? 10;

  const governanceRules =
    answers.governanceLevel === 'strict'
      ? [
          '  - id: gov-code-review\n    name: Code Review Required\n    level: critical\n    action: block\n    conditions:\n      - type:feature\n      - type:bugfix',
          '  - id: gov-security-scan\n    name: Security Scan\n    level: high\n    action: block\n    conditions:\n      - type:security',
          '  - id: gov-quality-gate\n    name: Quality Gate\n    level: high\n    action: block\n    conditions:\n      - type:feature',
        ]
      : answers.governanceLevel === 'standard'
        ? [
            '  - id: gov-code-review\n    name: Code Review\n    level: medium\n    action: warn\n    conditions:\n      - type:feature',
            '  - id: gov-quality-gate\n    name: Quality Gate\n    level: high\n    action: escalate\n    conditions:\n      - type:feature',
          ]
        : [
            '  - id: gov-quality-gate\n    name: Quality Gate\n    level: medium\n    action: log\n    conditions:\n      - type:feature',
          ];

  const qualityGates = answers.qualityGates
    ? [
        '  - id: qg-lint\n    name: Lint Check\n    type: lint\n    pass: true',
        '  - id: qg-typecheck\n    name: Type Check\n    type: typecheck\n    pass: true',
        '  - id: qg-test-coverage\n    name: Test Coverage\n    type: test_coverage\n    threshold: 80',
      ]
    : [];

  const lines = [
    `id: ${answers.projectName}`,
    `name: ${answers.projectName}`,
    "version: '1.0.0'",
    answers.description
      ? `description: ${answers.description}`
      : `description: BehaviorOS DNA package for ${answers.projectName}`,
    `author: ${answers.author}`,
    '',
    'personas:',
    '  - role: engineer',
    '    authority: senior',
    '    name: Senior Engineer',
    `    description: Senior developer for ${answers.projectName}`,
    '    skills:',
    '      - full-stack-development',
    '      - code-review',
    '    tools:',
    '      - read',
    '      - write',
    '',
    '  - role: qa',
    '    authority: senior',
    '    name: QA Lead',
    `    description: Quality assurance for ${answers.projectName}`,
    '    skills:',
    '      - test-strategy',
    '      - quality-gates',
    '    tools:',
    '      - read',
    '      - write',
    '',
    'governance:',
    ...governanceRules,
    '',
    `# maxAgents: ${maxAgents}`,
  ];

  if (qualityGates.length > 0) {
    lines.push('');
    lines.push('quality:');
    lines.push(...qualityGates);
  }

  lines.push('');
  return lines.join('\n');
}

function detectProjectName(): string {
  const pkgPath = join(process.cwd(), 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.name ?? 'my-project';
  } catch {
    return 'my-project';
  }
}

function findProtocolTemplatesDir(): string {
  let baseDir: string;
  try {
    baseDir = dirname(fileURLToPath(import.meta.url));
  } catch {
    baseDir = dirname(process.argv[1] ?? '');
  }

  const candidates = [
    resolve(baseDir, '../../templates/protocol-strict'),
    resolve(baseDir, '../templates/protocol-strict'),
    resolve(baseDir, '../../../templates/protocol-strict'),
  ];

  for (const dir of candidates) {
    try {
      if (statSync(dir).isDirectory()) return dir;
    } catch {
      // not found, try next
    }
  }

  throw new Error(
    'Could not find protocol template directory. ' +
      'Ensure @behavioros/cli is properly installed with its templates/ directory.',
  );
}

function substituteVars(content: string, vars: ProtocolVars): string {
  return content
    .replace(/\{\{PROJECT_NAME\}\}/g, vars.PROJECT_NAME)
    .replace(/\{\{PROTOCOL_PATH\}\}/g, vars.PROTOCOL_PATH)
    .replace(/\{\{MCP_SERVER_COMMAND\}\}/g, vars.MCP_SERVER_COMMAND)
    .replace(/\{\{DNA_PATH\}\}/g, vars.DNA_PATH)
    .replace(/\{\{ENFORCEMENT_LEVEL\}\}/g, vars.ENFORCEMENT_LEVEL);
}

function generateProtocolFiles(vars: ProtocolVars): string[] {
  const templatesDir = findProtocolTemplatesDir();
  const created: string[] = [];

  function walkDir(currentDir: string) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.endsWith('.template')) {
        const relativePath = relative(templatesDir, fullPath);
        const outputPath = join(process.cwd(), relativePath.replace(/\.template$/, ''));

        const content = readFileSync(fullPath, 'utf-8');
        const substituted = substituteVars(content, vars);

        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, substituted, 'utf-8');
        created.push(relativePath.replace(/\.template$/, ''));
      }
    }
  }

  walkDir(templatesDir);
  return created;
}

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new BehaviorOS configuration in the current directory')
    .option(
      '--with-protocol',
      'Also generate BehaviorOS Protocol files (AGENTS.md, platform rules, CI workflow)',
      false,
    )
    .action(async (opts?: { withProtocol?: boolean }) => {
      const targetFile = 'behavioros.yaml';

      if (existsSync(targetFile)) {
        const overwrite = await confirm({
          message: `${targetFile} already exists. Overwrite?`,
          default: false,
        });
        if (!overwrite) {
          console.log(chalk.yellow('Aborted.'));
          return;
        }
      }

      console.log(chalk.bold('\n🧬 BehaviorOS Init Wizard\n'));

      const projectNameDefault = detectProjectName();

      const answers: InitAnswers = {
        projectName: await input({
          message: 'Project name:',
          default: projectNameDefault,
        }),
        description: await input({
          message: 'Project description:',
          default: 'A BehaviorOS-managed project',
        }),
        author: await input({
          message: 'Author:',
          default: 'behavioros',
        }),
        teamSize: await select({
          message: 'Team size:',
          choices: [
            { name: 'Small (1-5 agents)', value: 'small' },
            { name: 'Medium (6-15 agents)', value: 'medium' },
            { name: 'Large (16-50 agents)', value: 'large' },
          ],
        }),
        governanceLevel: await select({
          message: 'Governance level:',
          choices: [
            { name: 'Strict (all changes require approval)', value: 'strict' },
            {
              name: 'Standard (critical changes require approval)',
              value: 'standard',
            },
            { name: 'Relaxed (warnings only)', value: 'relaxed' },
          ],
        }),
        qualityGates: await confirm({
          message: 'Include default quality gates (lint, typecheck, coverage)?',
          default: true,
        }),
      };

      const spinner = ora('Generating behavioros.yaml...').start();

      try {
        const yaml = buildYAML(answers);
        writeFileSync(targetFile, yaml, 'utf-8');
        spinner.succeed(`Created ${targetFile}`);

        if (opts?.withProtocol) {
          const protocolSpinner = ora('Generating protocol files...').start();

          try {
            const filesCreated = generateProtocolFiles({
              PROJECT_NAME: answers.projectName,
              PROTOCOL_PATH: 'docs/PROTOCOL.md',
              MCP_SERVER_COMMAND: 'node packages/mcp-server/dist/server.js',
              DNA_PATH: './behavioros.yaml',
              ENFORCEMENT_LEVEL: answers.governanceLevel,
            });

            protocolSpinner.succeed(`Generated ${filesCreated.length} protocol file(s)`);
            console.log(chalk.bold('\nProtocol files created:'));
            for (const file of filesCreated) {
              console.log(`  ${chalk.cyan('✓')} ${file}`);
            }
            console.log('');
          } catch (err) {
            protocolSpinner.fail('Protocol file generation failed');
            console.error(chalk.red(`\n${String(err)}\n`));
            process.exitCode = 1;
            return;
          }
        }

        console.log(chalk.green(`\n✅ BehaviorOS initialized successfully!\n`));
        console.log(`  Next steps:`);
        console.log(`    ${chalk.cyan('behavioros validate')}  — Validate your DNA config`);
        console.log(`    ${chalk.cyan('behavioros compile')}   — Compile to generated files`);
        console.log(`    ${chalk.cyan('behavioros status')}    — View project status`);
        if (opts?.withProtocol) {
          console.log(
            `    ${chalk.cyan('behavioros validate --protocol')}  — Validate protocol enforcement\n`,
          );
        } else {
          console.log('');
        }
      } catch (err) {
        spinner.fail('Failed to create config');
        console.error(chalk.red(String(err)));
        process.exitCode = 1;
      }
    });
}
