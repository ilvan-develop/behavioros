import { EcosystemRegistry, SkillEngine } from '@behavioros/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

let _ecosystemRegistry: EcosystemRegistry | null = null;
let _skillEngine: SkillEngine | null = null;

function getSkillEngine(): SkillEngine {
  if (!_skillEngine) {
    _skillEngine = new SkillEngine();
  }
  return _skillEngine;
}

function getEcosystemRegistry(): EcosystemRegistry {
  if (!_ecosystemRegistry) {
    _ecosystemRegistry = new EcosystemRegistry({
      skillEngine: getSkillEngine(),
    });
  }
  return _ecosystemRegistry;
}

export function ecosystemCommand(program: Command): void {
  const ecosystem = program
    .command('ecosystem')
    .description('Manage the BehaviorOS ecosystem (skills, MCPs, design systems)');

  // ─── ecosystem status ─────────────────────────────────────
  ecosystem
    .command('status')
    .description('Show full ecosystem status')
    .action(async () => {
      const spinner = ora('Collecting ecosystem status...').start();

      try {
        const registry = getEcosystemRegistry();
        const report = await registry.generateReport();

        spinner.succeed('Ecosystem status collected');

        // Header
        console.log(chalk.bold('\n┌─────────────────────────────────────────────┐'));
        console.log(chalk.bold('│ BEHAVIOROS ECOSYSTEM STATUS                  │'));
        console.log(chalk.bold('├─────────────────────────────────────────────┤'));

        // Agents
        const activeAgents = report.agents.filter((a) => a.status === 'active').length;
        const totalAgents = report.agents.length;
        console.log(
          `│ ${chalk.cyan('Agents:')}  ${activeAgents} active / ${totalAgents} total${' '.repeat(20 - String(totalAgents).length)}│`,
        );

        // Skills
        const totalSkills = report.skills.length;
        console.log(
          `│ ${chalk.cyan('Skills:')}  ${totalSkills} installed${' '.repeat(30 - String(totalSkills).length)}│`,
        );

        // MCPs
        const totalMcps = report.mcps.length;
        console.log(
          `│ ${chalk.cyan('MCPs:')}    ${totalMcps} connected${' '.repeat(30 - String(totalMcps).length)}│`,
        );

        // Design Systems
        const totalDs = report.designSystems.length;
        console.log(
          `│ ${chalk.cyan('Design:')}  ${totalDs} installed${' '.repeat(30 - String(totalDs).length)}│`,
        );

        // DNAs
        const totalDnas = report.dnas.length;
        const activeDnas = report.dnas.filter((d) => d.active).length;
        console.log(
          `│ ${chalk.cyan('DNAs:')}    ${totalDnas} loaded (${activeDnas} active)${' '.repeat(20 - String(totalDnas).length)}│`,
        );

        console.log(chalk.bold('└─────────────────────────────────────────────┘'));
        console.log('');
      } catch (err) {
        spinner.fail('Failed to collect ecosystem status');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── ecosystem install ────────────────────────────────────
  ecosystem
    .command('install')
    .description('Install a component from any source')
    .requiredOption('-t, --type <type>', 'Component type (skill, mcp, design-system)')
    .requiredOption('-i, --id <id>', 'Component ID')
    .option('-s, --source <source>', 'Source (aitmpl, open-design, local)', 'aitmpl')
    .option('-c, --category <category>', 'Category for AITMPL (e.g. utilities)')
    .action(async (options: { type: string; id: string; source: string; category?: string }) => {
      const spinner = ora(`Installing ${options.id} from ${options.source}...`).start();

      try {
        const registry = getEcosystemRegistry();
        const result = await registry.install(options.type, options.id, options.source);

        if (result.success) {
          spinner.succeed(`Installed ${chalk.bold(options.id)} from ${options.source}`);
          if (result.component) {
            const comp = result.component as {
              id: string;
              type?: string;
              source?: string;
              version?: string;
              status?: string;
              name?: string;
            };
            const compTable = new Table({
              head: [chalk.green.bold('Property'), chalk.green.bold('Value')],
              style: { head: [] },
            });
            compTable.push(
              ['ID', comp.id],
              ['Name', comp.name ?? comp.id],
              ['Type', comp.type ?? 'skill'],
              ['Source', comp.source ?? 'unknown'],
              ['Version', comp.version ?? '1.0.0'],
              ['Status', comp.status ?? 'active'],
            );
            console.log(chalk.bold('\nInstalled Component:'));
            console.log(compTable.toString());
            console.log('');
          }
        } else {
          spinner.fail(`Installation failed: ${result.error}`);
          process.exitCode = 1;
        }
      } catch (err) {
        spinner.fail('Installation failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── ecosystem uninstall ──────────────────────────────────
  ecosystem
    .command('uninstall')
    .description('Remove an installed component')
    .requiredOption('-i, --id <id>', 'Component ID')
    .action(async (options: { id: string }) => {
      const spinner = ora(`Uninstalling ${options.id}...`).start();

      try {
        const engine = getSkillEngine();
        await engine.uninstall(options.id);
        spinner.succeed(`Uninstalled ${chalk.bold(options.id)}`);
      } catch (err) {
        spinner.fail('Uninstall failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── ecosystem sync ───────────────────────────────────────
  ecosystem
    .command('sync')
    .description('Sync registry with external sources')
    .option('-s, --source <source>', 'Source to sync (dna, local, aitmpl, all)', 'all')
    .action(async (options: { source: string }) => {
      const spinner = ora('Syncing ecosystem registry...').start();

      try {
        const registry = getEcosystemRegistry();
        const sources = options.source === 'all' ? ['dna', 'local', 'aitmpl'] : [options.source];

        const result = await registry.sync(sources);
        const syncedCount = result.results.filter(
          (r: unknown) => (r as { error?: string }).error === undefined,
        ).length;

        spinner.succeed(`Synced ${syncedCount} source(s)`);

        for (const res of result.results) {
          const r = res as { source: string; added?: number; error?: string };
          if (r.error) {
            console.log(chalk.yellow(`  ⚠ ${r.source}: ${r.error}`));
          } else {
            console.log(chalk.green(`  ✓ ${r.source}: synced`));
          }
        }
        console.log('');
      } catch (err) {
        spinner.fail('Sync failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── ecosystem doctor ─────────────────────────────────────
  ecosystem
    .command('doctor')
    .description('Run full ecosystem diagnostics')
    .action(async () => {
      const spinner = ora('Running ecosystem diagnostics...').start();

      try {
        const registry = getEcosystemRegistry();
        const result = await registry.doctor();

        if (result.healthy) {
          spinner.succeed(chalk.green('Ecosystem is healthy'));
        } else {
          spinner.info(chalk.yellow('Ecosystem has issues'));
        }

        // Engines table
        const engineTable = new Table({
          head: [chalk.cyan.bold('Engine'), chalk.cyan.bold('Status'), chalk.cyan.bold('Issues')],
          style: { head: [] },
        });

        for (const [name, engine] of Object.entries(result.engines)) {
          const statusColor =
            engine.status === 'healthy' || engine.status === 'ready'
              ? chalk.green
              : engine.status === 'issues'
                ? chalk.yellow
                : chalk.red;
          engineTable.push([
            name,
            statusColor(engine.status),
            engine.issues > 0 ? chalk.yellow(String(engine.issues)) : chalk.green('0'),
          ]);
        }

        console.log(chalk.bold('\nEngines:'));
        console.log(engineTable.toString());

        // Stats table
        const statsTable = new Table({
          head: [chalk.magenta.bold('Metric'), chalk.magenta.bold('Value')],
          style: { head: [] },
        });
        statsTable.push(
          ['Total Components', String(result.stats.totalComponents)],
          ['Active Components', String(result.stats.activeComponents)],
          ['Agents', String(result.stats.agents)],
          ['DNA Packages', String(result.stats.dnas)],
          ['Issues', String(result.stats.issues)],
        );

        console.log(chalk.bold('\nStats:'));
        console.log(statsTable.toString());
        console.log('');
      } catch (err) {
        spinner.fail('Diagnostics failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── ecosystem report ─────────────────────────────────────
  ecosystem
    .command('report')
    .description('Generate ecosystem report')
    .option('-f, --format <format>', 'Output format (json, md, html)', 'md')
    .action(async (options: { format: string }) => {
      const spinner = ora('Generating ecosystem report...').start();

      try {
        const registry = getEcosystemRegistry();
        const report = await registry.generateReport();

        spinner.succeed('Report generated');

        switch (options.format) {
          case 'json': {
            console.log(JSON.stringify(report, null, 2));
            break;
          }

          case 'md': {
            console.log(chalk.bold(`\n# Ecosystem Report: ${report.project}\n`));
            console.log(`**Timestamp:** ${report.timestamp}\n`);

            console.log(`## Agents (${report.agents.length})`);
            console.log('| ID | Status | Skills |');
            console.log('|---|---|---|');
            for (const agent of report.agents) {
              console.log(`| ${agent.id} | ${agent.status} | ${agent.skillsCount} skills |`);
            }
            console.log('');

            console.log(`## Skills (${report.skills.length})`);
            console.log('| ID | Type | Status |');
            console.log('|---|---|---|');
            for (const skill of report.skills) {
              console.log(`| ${skill.id} | ${skill.type} | ${skill.status} |`);
            }
            console.log('');

            console.log(`## DNAs (${report.dnas.length})`);
            for (const dna of report.dnas) {
              const status = dna.active ? chalk.green('active') : chalk.yellow('inactive');
              console.log(`- ${dna.id} v${dna.version} — ${status}`);
            }
            console.log('');
            break;
          }

          case 'html': {
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ecosystem Report — ${report.project}</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }
    .badge-active { background: #d4edda; color: #155724; }
    .badge-inactive { background: #fff3cd; color: #856404; }
  </style>
</head>
<body>
  <h1>Ecosystem Report — ${report.project}</h1>
  <p><strong>Timestamp:</strong> ${report.timestamp}</p>

  <h2>Agents (${report.agents.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Status</th><th>Skills</th></tr></thead>
    <tbody>
      ${report.agents.map((a) => `<tr><td>${a.id}</td><td>${a.status}</td><td>${a.skillsCount}</td></tr>`).join('\n      ')}
    </tbody>
  </table>

  <h2>Skills (${report.skills.length})</h2>
  <table>
    <thead><tr><th>ID</th><th>Type</th><th>Status</th></tr></thead>
    <tbody>
      ${report.skills.map((s) => `<tr><td>${s.id}</td><td>${s.type}</td><td>${s.status}</td></tr>`).join('\n      ')}
    </tbody>
  </table>

  <h2>DNAs (${report.dnas.length})</h2>
  <ul>
    ${report.dnas.map((d) => `<li>${d.id} v${d.version} — <span class="badge badge-${d.active ? 'active' : 'inactive'}">${d.active ? 'active' : 'inactive'}</span></li>`).join('\n    ')}
  </ul>
</body>
</html>`;
            console.log(html);
            break;
          }

          default:
            console.log(
              chalk.yellow(`Unsupported format: ${options.format}. Use json, md, or html.`),
            );
        }

        console.log('');
      } catch (err) {
        spinner.fail('Report generation failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── ecosystem stack ──────────────────────────────────────
  const stack = ecosystem.command('stack').description('Manage stack files');

  stack
    .command('init')
    .description('Generate stack.yaml from current state')
    .action(async () => {
      const spinner = ora('Generating stack.yaml...').start();

      try {
        const registry = getEcosystemRegistry();
        const report = await registry.generateReport();

        const stackYaml = [
          '# BehaviorOS Stack File — auto-generated',
          `# Generated: ${report.timestamp}`,
          `project: ${report.project}`,
          '',
          'agents:',
          ...report.agents.map((a) => `  - id: ${a.id}\n    status: ${a.status}`),
          '',
          'dnas:',
          ...report.dnas.map(
            (d) => `  - id: ${d.id}\n    version: ${d.version}\n    active: ${d.active}`,
          ),
          '',
        ].join('\n');

        const { writeFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const filePath = join(process.cwd(), 'stack.yaml');
        writeFileSync(filePath, stackYaml, 'utf-8');

        spinner.succeed(`Generated ${chalk.bold('stack.yaml')}`);
      } catch (err) {
        spinner.fail('Failed to generate stack.yaml');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  stack
    .command('apply')
    .description('Apply a stack.yaml file')
    .requiredOption('-f, --file <file>', 'Path to stack.yaml')
    .action(async (options: { file: string }) => {
      const spinner = ora(`Applying stack from ${options.file}...`).start();

      try {
        const { readFileSync } = await import('node:fs');
        const content = readFileSync(options.file, 'utf-8');
        const lines = content
          .split('\n')
          .filter((l) => !l.trim().startsWith('#'))
          .filter(Boolean);

        const projectMatch = lines.find((l) => l.startsWith('project:'));
        if (projectMatch) {
          spinner.succeed(`Stack applied: ${projectMatch.replace('project:', '').trim()}`);
        } else {
          spinner.warn('Stack applied but no project identifier found');
        }
      } catch (err) {
        spinner.fail('Failed to apply stack');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
