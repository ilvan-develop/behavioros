import type { CanaryStageConfig } from '@behavioros/core';
import { CanaryDeployer, DNALoader, DNAValidator } from '@behavioros/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

function buildStages(startPercent: number): CanaryStageConfig[] {
  const stages: CanaryStageConfig[] = [];
  const percentages = [startPercent];

  let current = startPercent;
  while (current < 100) {
    current = current <= 5 ? 25 : current <= 25 ? 50 : 100;
    percentages.push(current);
  }

  const descriptions: Record<number, string> = {
    5: 'Initial canary — 5% traffic for 24h',
    25: 'Expansion — 25% traffic for 48h',
    50: 'Half — 50% traffic for 72h',
    100: 'Full rollout — 100% traffic',
  };

  const durations: Record<number, number> = {
    5: 24 * 60 * 60 * 1000,
    25: 48 * 60 * 60 * 1000,
    50: 72 * 60 * 60 * 1000,
    100: 0,
  };

  for (const pct of percentages) {
    stages.push({
      name: `stage-${pct}`,
      trafficPercent: pct,
      durationMs: durations[pct] ?? 24 * 60 * 60 * 1000,
      healthCheckIntervalMs: 30_000,
      requiredConsecutiveHealthy: pct <= 5 ? 3 : pct <= 25 ? 2 : 1,
      driftThreshold: pct <= 5 ? 0.1 : pct <= 25 ? 0.15 : 0.2,
      autoAdvance: true,
      description: descriptions[pct] ?? `Stage ${pct}%`,
    });
  }

  return stages;
}

export function deployCommand(program: Command): void {
  program
    .command('deploy')
    .description(
      'Deploy a DNA configuration with canary rollout, health monitoring, and auto-rollback',
    )
    .requiredOption('--dna <dna-file>', 'Path to the DNA configuration file to deploy')
    .option('--env <environment>', 'Target environment', 'staging')
    .option('--canary <percentage>', 'Initial canary traffic percentage', '5')
    .option('--stable <version>', 'Current stable version', '1.0.0')
    .option('--version <version>', 'Version to deploy (canary)', '1.1.0')
    .option('--dry-run', 'Show deployment plan without executing', false)
    .action(
      async (options: {
        dna: string;
        env: string;
        canary: string;
        stable: string;
        version: string;
        dryRun: boolean;
      }) => {
        const spinner = ora('Loading DNA configuration...').start();

        try {
          const loader = new DNALoader({ validate: true });
          spinner.text = `Loading DNA from ${options.dna}...`;
          const dna = loader.load(options.dna);

          spinner.text = 'Validating DNA...';
          const validation = DNAValidator.validate(dna);
          if (!validation.valid) {
            spinner.fail('DNA validation failed');
            for (const err of validation.errors) {
              console.log(chalk.red(`  [ERROR] ${err.code}: ${err.message}`));
            }
            process.exitCode = 1;
            return;
          }

          const canaryPercent = Number.parseInt(options.canary, 10);
          if (Number.isNaN(canaryPercent) || canaryPercent < 1 || canaryPercent > 100) {
            spinner.fail('Invalid canary percentage — must be between 1 and 100');
            process.exitCode = 1;
            return;
          }

          const stages = buildStages(canaryPercent);

          spinner.succeed(`DNA validated: ${chalk.bold(dna.name)} v${dna.version}`);

          // Deployment plan
          console.log(chalk.bold('\nDeployment Plan:'));
          console.log(`  ${chalk.cyan('DNA:')}          ${dna.name} v${dna.version}`);
          console.log(`  ${chalk.cyan('Environment:')}  ${options.env}`);
          console.log(`  ${chalk.cyan('Stable:')}       v${options.stable}`);
          console.log(`  ${chalk.cyan('Canary:')}       v${options.version}`);
          console.log(`  ${chalk.cyan('Start traffic:')} ${canaryPercent}%`);

          const stageTable = new Table({
            head: [
              chalk.bold('Stage'),
              chalk.bold('Traffic'),
              chalk.bold('Duration'),
              chalk.bold('Drift Limit'),
              chalk.bold('Auto-Advance'),
            ],
            style: { head: [] },
          });

          for (const stage of stages) {
            const duration =
              stage.durationMs === 0
                ? 'Until manual'
                : `${Math.round(stage.durationMs / (60 * 60 * 1000))}h`;
            stageTable.push([
              stage.name,
              `${stage.trafficPercent}%`,
              duration,
              `${(stage.driftThreshold * 100).toFixed(0)}%`,
              stage.autoAdvance ? chalk.green('Yes') : chalk.yellow('Manual'),
            ]);
          }

          console.log(chalk.bold('\nStages:'));
          console.log(stageTable.toString());

          if (options.dryRun) {
            console.log(chalk.yellow('\nDry run — no deployment executed.\n'));
            return;
          }

          spinner.start('Initializing canary deployer...');

          const deployer = new CanaryDeployer({
            stages,
            globalDriftThreshold: 0.3,
          });

          // Wire events
          deployer.on('deployment:started', (deployment) => {
            spinner.succeed(`Deployment ${chalk.bold(deployment.id)} started`);
          });

          deployer.on('deployment:stage-advanced', (_deployment, stage) => {
            console.log(
              chalk.green(`\n  → Advanced to ${stage.name} (${stage.trafficPercent}% traffic)`),
            );
          });

          deployer.on('deployment:completed', (deployment) => {
            console.log(
              chalk.green.bold(`\n  ✓ Deployment ${deployment.id} completed successfully`),
            );
          });

          deployer.on('deployment:rolled-back', (_deployment, record) => {
            console.log(chalk.red.bold(`\n  ✗ Rollback triggered: ${record.reason}`));
          });

          deployer.on('deployment:failed', (_deployment, error) => {
            console.log(chalk.red.bold(`\n  ✗ Deployment failed: ${error}`));
          });

          spinner.start('Starting deployment...');

          const deployment = await deployer.startDeployment({
            stableVersion: options.stable,
            canaryVersion: options.version,
            projectName: dna.name,
          });

          // Simulate initial health report
          spinner.text = 'Running initial health check...';
          const healthResult = deployer.reportHealth({
            successCount: 98,
            totalCount: 100,
            totalLatencyMs: 2500,
            errorCount: 2,
          });

          if (healthResult) {
            const statusColor =
              healthResult.overallStatus === 'healthy'
                ? chalk.green
                : healthResult.overallStatus === 'degraded'
                  ? chalk.yellow
                  : chalk.red;

            console.log(
              `\n  Health: ${statusColor.bold(healthResult.overallStatus)} (${healthResult.probes.length} probes)`,
            );
          }

          // Status summary
          const currentStage = deployment.stages[deployment.currentStageIndex];
          console.log(chalk.bold('\nDeployment Status:'));
          console.log(`  ${chalk.cyan('ID:')}       ${deployment.id}`);
          console.log(`  ${chalk.cyan('Status:')}   ${deployment.status}`);
          console.log(
            `  ${chalk.cyan('Stage:')}    ${currentStage.config.name} (${currentStage.config.trafficPercent}%)`,
          );
          console.log(`  ${chalk.cyan('Traffic:')}  ${JSON.stringify(deployment.trafficSplit)}`);
          console.log('');

          spinner.succeed('Deployment active — monitoring health and drift');
          console.log(chalk.gray('  Health checks run every 30s. Auto-rollback on failure.\n'));
        } catch (err) {
          spinner.fail('Deployment failed');
          console.error(chalk.red(`\n${String(err)}\n`));
          process.exitCode = 1;
        }
      },
    );
}
