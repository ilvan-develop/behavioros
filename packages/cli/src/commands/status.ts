import { DNALoader, DNAValidator } from '@behavioros/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import { cosmiconfig } from 'cosmiconfig';
import ora from 'ora';

export function statusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current project status (agents, rules, gates)')
    .action(async () => {
      const spinner = ora('Loading configuration...').start();

      try {
        const explorer = cosmiconfig('behavioros', {
          searchPlaces: [
            'behavioros.yaml',
            'behavioros.yml',
            '.behaviorosrc',
            '.behaviorosrc.yaml',
            '.behaviorosrc.yml',
            '.behaviorosrc.json',
            'behavioros.config.js',
          ],
        });

        spinner.text = 'Searching for behavioros config...';
        const result = await explorer.search();

        if (!result) {
          spinner.fail('No behavioros configuration found');
          console.log(
            chalk.red(
              '\nNo behavioros.yaml, .behaviorosrc, or behavioros config found.\n' +
                'Run `behavioros init` to create one.',
            ),
          );
          process.exitCode = 1;
          return;
        }

        spinner.text = 'Loading DNA package...';
        const loader = new DNALoader({ validate: true });
        const dna = loader.load(result.filepath);

        const validation = DNAValidator.validate(dna);

        spinner.succeed(`Configuration: ${chalk.bold(result.filepath)}`);

        // Project info
        console.log(chalk.bold('\nProject:'));
        console.log(`  ${chalk.cyan('Name:')}        ${dna.name}`);
        console.log(`  ${chalk.cyan('Version:')}     ${dna.version}`);
        console.log(`  ${chalk.cyan('Description:')} ${dna.description ?? 'N/A'}`);
        console.log(`  ${chalk.cyan('Author:')}      ${dna.author ?? 'N/A'}`);

        // Agents table
        if (dna.personas.length > 0) {
          const agentTable = new Table({
            head: [
              chalk.cyan.bold('Role'),
              chalk.cyan.bold('Authority'),
              chalk.cyan.bold('Name'),
              chalk.cyan.bold('Skills'),
            ],
            style: { head: [] },
          });

          for (const persona of dna.personas) {
            agentTable.push([
              persona.role,
              persona.authority,
              persona.name ?? '—',
              persona.skills?.join(', ') ?? '—',
            ]);
          }

          console.log(chalk.bold('\nAgents:'));
          console.log(agentTable.toString());
        }

        // Governance rules
        if (dna.governance && dna.governance.length > 0) {
          const govTable = new Table({
            head: [
              chalk.magenta.bold('ID'),
              chalk.magenta.bold('Name'),
              chalk.magenta.bold('Level'),
              chalk.magenta.bold('Action'),
            ],
            style: { head: [] },
          });

          for (const rule of dna.governance) {
            govTable.push([rule.id, rule.name, rule.level, rule.action]);
          }

          console.log(chalk.bold('\nGovernance Rules:'));
          console.log(govTable.toString());
        }

        // Quality gates
        if (dna.quality && dna.quality.length > 0) {
          const qualityTable = new Table({
            head: [
              chalk.green.bold('ID'),
              chalk.green.bold('Name'),
              chalk.green.bold('Type'),
              chalk.green.bold('Threshold'),
            ],
            style: { head: [] },
          });

          for (const gate of dna.quality) {
            qualityTable.push([
              gate.id,
              gate.name,
              gate.type,
              gate.threshold != null
                ? String(gate.threshold)
                : gate.pass != null
                  ? String(gate.pass)
                  : '—',
            ]);
          }

          console.log(chalk.bold('\nQuality Gates:'));
          console.log(qualityTable.toString());
        }

        // Patterns
        if (dna.patterns && dna.patterns.length > 0) {
          const patternTable = new Table({
            head: [
              chalk.blue.bold('ID'),
              chalk.blue.bold('Name'),
              chalk.blue.bold('Type'),
              chalk.blue.bold('Triggers'),
            ],
            style: { head: [] },
          });

          for (const pattern of dna.patterns) {
            patternTable.push([
              pattern.id,
              pattern.name,
              pattern.type,
              pattern.triggers?.join(', ') ?? '—',
            ]);
          }

          console.log(chalk.bold('\nPatterns:'));
          console.log(patternTable.toString());
        }

        // Workflows
        if (dna.workflows && dna.workflows.length > 0) {
          const wfTable = new Table({
            head: [
              chalk.yellow.bold('ID'),
              chalk.yellow.bold('Name'),
              chalk.yellow.bold('Type'),
              chalk.yellow.bold('Agent'),
            ],
            style: { head: [] },
          });

          for (const step of dna.workflows) {
            wfTable.push([step.id, step.name, step.type, step.agent ?? '—']);
          }

          console.log(chalk.bold('\nWorkflows:'));
          console.log(wfTable.toString());
        }

        // Validation status
        console.log(chalk.bold('\nValidation:'));
        console.log(
          `  ${chalk.cyan('Status:')} ${validation.valid ? chalk.green('Valid') : chalk.red('Invalid')}`,
        );
        console.log(`  ${chalk.cyan('Errors:')} ${validation.errors.length}`);
        console.log(`  ${chalk.cyan('Warnings:')} ${validation.warnings.length}`);

        // Summary
        console.log(chalk.bold('\nSummary:'));
        console.log(`  ${chalk.cyan('Agents:')}       ${dna.personas.length}`);
        console.log(`  ${chalk.cyan('Governance:')}   ${dna.governance?.length ?? 0}`);
        console.log(`  ${chalk.cyan('Quality Gates:')} ${dna.quality?.length ?? 0}`);
        console.log(`  ${chalk.cyan('Patterns:')}     ${dna.patterns?.length ?? 0}`);
        console.log(`  ${chalk.cyan('Workflows:')}    ${dna.workflows?.length ?? 0}`);
        console.log('');
      } catch (err) {
        spinner.fail('Failed to load status');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
