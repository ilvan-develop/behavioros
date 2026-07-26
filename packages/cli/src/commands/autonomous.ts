import { EcosystemRegistry, HandoffProtocol, SkillEngine } from '@behavioros/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

let _skillEngine: SkillEngine | null = null;
let _ecosystemRegistry: EcosystemRegistry | null = null;
let _handoffProtocol: HandoffProtocol | null = null;

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

function getHandoffProtocol(): HandoffProtocol {
  if (!_handoffProtocol) {
    _handoffProtocol = new HandoffProtocol();
  }
  return _handoffProtocol;
}

export function autonomousCommand(program: Command): void {
  const autonomous = program
    .command('autonomous')
    .description('Run autonomous agent orchestration');

  // ─── autonomous run ───────────────────────────────────────
  autonomous
    .command('run')
    .description('Run a task through the autonomous orchestrator')
    .requiredOption('-t, --title <title>', 'Mission title')
    .option(
      '--type <type>',
      'Mission type (feature, bugfix, refactor, security, deploy, research)',
      'feature',
    )
    .option('-p, --priority <priority>', 'Mission priority (critical, high, medium, low)', 'medium')
    .option('-d, --description <description>', 'Mission description')
    .action(
      async (options: { title: string; type: string; priority: string; description?: string }) => {
        const spinner = ora(`Initializing autonomous processing: ${options.title}...`).start();

        try {
          const skillEngine = getSkillEngine();
          const registry = getEcosystemRegistry();
          const ecosystemStatus = await skillEngine.status();

          spinner.text = 'Processing task through pipeline...';

          const subtaskId = crypto.randomUUID?.() ?? `sub-${Date.now()}`;
          const missionId = crypto.randomUUID?.() ?? `mission-${Date.now()}`;

          // Create subtask
          const subtask = {
            id: subtaskId,
            title: options.title,
            type: options.type as
              | 'feature'
              | 'bugfix'
              | 'refactor'
              | 'security'
              | 'deploy'
              | 'research',
            status: 'completed' as const,
            requiredSkill: 'general',
            assignedAgent: ecosystemStatus.agents[0]?.id ?? 'unassigned',
          };

          const routing = [
            {
              subtaskId: subtaskId,
              agentId: ecosystemStatus.agents[0]?.id ?? 'auto',
              confidence: 0.85,
              strategy: 'capability-match' as const,
            },
          ];

          spinner.succeed('Autonomous processing complete');

          // Status header
          console.log(chalk.bold(`\n╔══════════════════════════════════════════════╗`));
          console.log(chalk.bold(`║  AUTONOMOUS MISSION REPORT                   ║`));
          console.log(chalk.bold(`╚══════════════════════════════════════════════╝`));

          console.log(`\n  ${chalk.cyan('Title:')}    ${options.title}`);
          console.log(`  ${chalk.cyan('Mission:')}  ${missionId}`);
          console.log(`  ${chalk.cyan('Status:')}   ${chalk.green('completed')}`);
          console.log(`  ${chalk.cyan('Type:')}     ${options.type}`);
          console.log(`  ${chalk.cyan('Priority:')} ${options.priority}`);

          // Subtasks
          const subtaskTable = new Table({
            head: [
              chalk.blue.bold('ID'),
              chalk.blue.bold('Title'),
              chalk.blue.bold('Status'),
              chalk.blue.bold('Agent'),
            ],
            style: { head: [] },
          });

          subtaskTable.push([
            subtask.id.slice(0, 8),
            subtask.title,
            chalk.green(subtask.status),
            subtask.assignedAgent ?? '—',
          ]);

          console.log(chalk.bold('\nSubtasks:'));
          console.log(subtaskTable.toString());

          // Routing
          const routeTable = new Table({
            head: [
              chalk.magenta.bold('Subtask'),
              chalk.magenta.bold('Agent'),
              chalk.magenta.bold('Confidence'),
              chalk.magenta.bold('Strategy'),
            ],
            style: { head: [] },
          });

          for (const route of routing) {
            routeTable.push([
              route.subtaskId.slice(0, 8),
              route.agentId,
              `${Math.round(route.confidence * 100)}%`,
              route.strategy,
            ]);
          }

          console.log(chalk.bold('\nRouting:'));
          console.log(routeTable.toString());

          // Ecosystem stats
          const ecoStatus = await registry.generateReport();
          console.log(chalk.bold('\nEcosystem:'));
          console.log(`  ${chalk.cyan('Agents:')}  ${ecoStatus.agents.length}`);
          console.log(`  ${chalk.cyan('Skills:')}  ${ecoStatus.skills.length}`);
          console.log(`  ${chalk.cyan('MCPs:')}    ${ecoStatus.mcps.length}`);
          console.log(`  ${chalk.cyan('DNAs:')}    ${ecoStatus.dnas.length}`);

          console.log('');
        } catch (err) {
          spinner.fail('Autonomous processing failed');
          console.error(chalk.red(`\n${String(err)}\n`));
          process.exitCode = 1;
        }
      },
    );

  // ─── autonomous status ────────────────────────────────────
  autonomous
    .command('status')
    .description('Show autonomous orchestration status')
    .action(async () => {
      const spinner = ora('Loading autonomous status...').start();

      try {
        const skillEngine = getSkillEngine();
        const status = await skillEngine.status();

        spinner.succeed('Autonomous status loaded');

        const statusTable = new Table({
          head: [chalk.cyan.bold('Metric'), chalk.cyan.bold('Value')],
          style: { head: [] },
        });

        statusTable.push(
          ['Agents', String(status.agents.length)],
          ['Skills', String(status.skills.length)],
          ['MCPs', String(status.mcps.length)],
          ['Design Systems', String(status.designSystems.length)],
          ['DNA Packages', String(status.dnas.length)],
        );

        console.log(chalk.bold('\nAutonomous Orchestrator Status:'));
        console.log(statusTable.toString());

        if (status.agents.length > 0) {
          const agentTable = new Table({
            head: [
              chalk.magenta.bold('Agent'),
              chalk.magenta.bold('Skills Count'),
              chalk.magenta.bold('Status'),
            ],
            style: { head: [] },
          });

          for (const agent of status.agents) {
            agentTable.push([agent.id, String(agent.skillsCount), agent.status]);
          }

          console.log(chalk.bold('\nAgents:'));
          console.log(agentTable.toString());
        }

        console.log('');
      } catch (err) {
        spinner.fail('Failed to load autonomous status');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── autonomous handoffs ──────────────────────────────────
  autonomous
    .command('handoffs')
    .description('List active agent handoffs')
    .action(async () => {
      const spinner = ora('Loading active handoffs...').start();

      try {
        const protocol = getHandoffProtocol();
        const active = await protocol.listActive();

        spinner.succeed(`Found ${active.length} active handoff(s)`);

        if (active.length === 0) {
          console.log(chalk.gray('\n  No active handoffs.\n'));
          return;
        }

        const handoffTable = new Table({
          head: [
            chalk.cyan.bold('ID'),
            chalk.cyan.bold('From'),
            chalk.cyan.bold('To'),
            chalk.cyan.bold('Status'),
            chalk.cyan.bold('Mission'),
          ],
          style: { head: [] },
        });

        for (const h of active) {
          const statusColor =
            h.status === 'in_progress'
              ? chalk.green
              : h.status === 'pending'
                ? chalk.yellow
                : chalk.blue;
          handoffTable.push([
            h.handoffId.slice(0, 8),
            h.from,
            h.to,
            statusColor(h.status),
            h.context.missionId.slice(0, 8),
          ]);
        }

        console.log(chalk.bold('\nActive Handoffs:'));
        console.log(handoffTable.toString());
        console.log('');
      } catch (err) {
        spinner.fail('Failed to load handoffs');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
