import type { Command } from 'commander'
import { input, select, confirm } from '@inquirer/prompts'
import { writeFileSync, existsSync } from 'node:fs'
import chalk from 'chalk'
import ora from 'ora'

interface InitAnswers {
  projectName: string
  description: string
  teamSize: string
  governanceLevel: string
  qualityGates: boolean
  author: string
}

function buildYAML(answers: InitAnswers): string {
  const teamSizeMap: Record<string, number> = {
    small: 5,
    medium: 15,
    large: 50,
  }

  const maxAgents = teamSizeMap[answers.teamSize] ?? 10

  const governanceRules = answers.governanceLevel === 'strict'
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
        ]

  const qualityGates = answers.qualityGates
    ? [
        '  - id: qg-lint\n    name: Lint Check\n    type: lint\n    pass: true',
        '  - id: qg-typecheck\n    name: Type Check\n    type: typecheck\n    pass: true',
        '  - id: qg-test-coverage\n    name: Test Coverage\n    type: test_coverage\n    threshold: 80',
      ]
    : []

  const lines = [
    `id: ${answers.projectName}`,
    `name: ${answers.projectName}`,
    "version: '1.0.0'",
    answers.description ? `description: ${answers.description}` : `description: BehaviorOS DNA package for ${answers.projectName}`,
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
  ]

  if (qualityGates.length > 0) {
    lines.push('')
    lines.push('quality:')
    lines.push(...qualityGates)
  }

  lines.push('')
  return lines.join('\n')
}

export function initCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new BehaviorOS configuration in the current directory')
    .action(async () => {
      const targetFile = 'behavioros.yaml'

      if (existsSync(targetFile)) {
        const overwrite = await confirm({
          message: `${targetFile} already exists. Overwrite?`,
          default: false,
        })
        if (!overwrite) {
          console.log(chalk.yellow('Aborted.'))
          return
        }
      }

      console.log(chalk.bold('\n🧬 BehaviorOS Init Wizard\n'))

      const answers: InitAnswers = {
        projectName: await input({
          message: 'Project name:',
          default: 'my-project',
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
            { name: 'Standard (critical changes require approval)', value: 'standard' },
            { name: 'Relaxed (warnings only)', value: 'relaxed' },
          ],
        }),
        qualityGates: await confirm({
          message: 'Include default quality gates (lint, typecheck, coverage)?',
          default: true,
        }),
      }

      const spinner = ora('Generating behavioros.yaml...').start()

      try {
        const yaml = buildYAML(answers)
        writeFileSync(targetFile, yaml, 'utf-8')
        spinner.succeed(`Created ${targetFile}`)
        console.log(chalk.green(`\n✅ BehaviorOS initialized successfully!\n`))
        console.log(`  Next steps:`)
        console.log(`    ${chalk.cyan('behavioros validate')}  — Validate your DNA config`)
        console.log(`    ${chalk.cyan('behavioros compile')}   — Compile to generated files`)
        console.log(`    ${chalk.cyan('behavioros status')}    — View project status\n`)
      } catch (err) {
        spinner.fail('Failed to create config')
        console.error(chalk.red(String(err)))
        process.exitCode = 1
      }
    })
}
