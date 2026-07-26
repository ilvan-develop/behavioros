import { SkillEngine } from '@behavioros/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

let _skillEngine: SkillEngine | null = null;

function getSkillEngine(): SkillEngine {
  if (!_skillEngine) {
    _skillEngine = new SkillEngine();
  }
  return _skillEngine;
}

export function agentCommand(program: Command): void {
  const agent = program.command('agent').description('Manage agents and their skills');

  // ─── agent list ───────────────────────────────────────────
  agent
    .command('list')
    .description('List all agents with status and skill counts')
    .action(async () => {
      const spinner = ora('Loading agents...').start();

      try {
        const engine = getSkillEngine();
        const status = await engine.status();

        spinner.succeed(`Found ${status.agents.length} agent(s)`);

        if (status.agents.length === 0) {
          console.log(
            chalk.yellow('\n  No agents registered. Load a DNA package to add agents.\n'),
          );
          return;
        }

        const agentTable = new Table({
          head: [chalk.cyan.bold('ID'), chalk.cyan.bold('Status'), chalk.cyan.bold('Skills')],
          style: { head: [] },
        });

        for (const agent of status.agents) {
          const statusColor =
            agent.status === 'active'
              ? chalk.green
              : agent.status === 'idle'
                ? chalk.yellow
                : chalk.red;
          agentTable.push([agent.id, statusColor(agent.status), String(agent.skillsCount)]);
        }

        console.log(chalk.bold('\nAgents:'));
        console.log(agentTable.toString());
        console.log('');
      } catch (err) {
        spinner.fail('Failed to list agents');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── agent skills ─────────────────────────────────────────
  agent
    .command('skills')
    .description('Show skills for a specific agent')
    .requiredOption('-i, --id <id>', 'Agent ID')
    .action(async (options: { id: string }) => {
      const spinner = ora(`Loading skills for ${options.id}...`).start();

      try {
        const engine = getSkillEngine();
        const status = await engine.status();

        const agent = status.agents.find((a) => a.id === options.id);
        if (!agent) {
          spinner.fail(`Agent not found: ${options.id}`);
          process.exitCode = 1;
          return;
        }

        spinner.succeed(`Agent: ${chalk.bold(options.id)}`);

        console.log(`\n  ${chalk.cyan('Status:')}  ${agent.status}`);
        console.log(`  ${chalk.cyan('Skills:')}  ${agent.skillsCount}`);

        if (agent.skills.length > 0) {
          const skillTable = new Table({
            head: [chalk.green.bold('#'), chalk.green.bold('Skill ID')],
            style: { head: [] },
          });

          for (let i = 0; i < agent.skills.length; i++) {
            skillTable.push([String(i + 1), agent.skills[i]]);
          }

          console.log(chalk.bold('\nDeclared Skills:'));
          console.log(skillTable.toString());
        } else {
          console.log(chalk.yellow('\n  No skills declared for this agent.\n'));
        }

        console.log('');
      } catch (err) {
        spinner.fail('Failed to load agent skills');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── agent validate ───────────────────────────────────────
  agent
    .command('validate')
    .description('Validate agent has required skills')
    .requiredOption('-i, --id <id>', 'Agent ID')
    .requiredOption('-s, --skills <skills...>', 'Required skill IDs')
    .action(async (options: { id: string; skills: string[] }) => {
      const spinner = ora(`Validating agent ${options.id}...`).start();

      try {
        const engine = getSkillEngine();
        const result = await engine.validateDelegation('cli', options.id, options.skills);

        spinner.succeed('Validation complete');

        if (result.allowed) {
          console.log(
            chalk.green(`\n  ✓ Agent ${chalk.bold(options.id)} has all required skills\n`),
          );
        } else {
          console.log(chalk.red(`\n  ✗ Agent ${chalk.bold(options.id)} is missing skills\n`));

          if (result.missingSkills.length > 0) {
            console.log(chalk.bold('  Missing Skills:'));
            for (const skill of result.missingSkills) {
              console.log(chalk.red(`    • ${skill}`));
            }
          }

          if (result.insufficientProficiency.length > 0) {
            console.log(chalk.bold('\n  Insufficient Proficiency:'));
            for (const skill of result.insufficientProficiency) {
              console.log(chalk.yellow(`    • ${skill}`));
            }
          }

          if (result.reason) {
            console.log(chalk.gray(`\n  Reason: ${result.reason}`));
          }

          console.log('');
          process.exitCode = 1;
        }
      } catch (err) {
        spinner.fail('Validation failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
