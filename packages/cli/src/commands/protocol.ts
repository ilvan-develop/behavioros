import {
  PROTOCOL_STEP_NAMES,
  PROTOCOL_STEP_TOOLS,
  PROTOCOL_STEPS,
  ProtocolStateTracker,
} from '@behavioros/core';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

let _stateTracker: ProtocolStateTracker | null = null;

function getStateTracker(): ProtocolStateTracker {
  if (!_stateTracker) {
    _stateTracker = new ProtocolStateTracker();
  }
  return _stateTracker;
}

export function protocolCommand(program: Command): void {
  const protocol = program
    .command('protocol')
    .description('Check and manage BOS protocol enforcement');

  // ─── protocol check ───────────────────────────────────────
  protocol
    .command('check')
    .description('Verify protocol is active and enforced')
    .action(async () => {
      const spinner = ora('Checking protocol enforcement...').start();

      try {
        const tracker = getStateTracker();
        const status = tracker.getStatus();

        spinner.succeed('Protocol check complete');

        // Steps table
        const stepTable = new Table({
          head: [
            chalk.cyan.bold('#'),
            chalk.cyan.bold('Step'),
            chalk.cyan.bold('Status'),
            chalk.cyan.bold('Tool'),
          ],
          style: { head: [] },
        });

        const stepIds: { key: 1 | 2 | 3 | 4 | 5; name: string }[] = [
          {
            key: PROTOCOL_STEPS.DNA_SELECTED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED],
          },
          {
            key: PROTOCOL_STEPS.TRUTH_RESOLVED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED],
          },
          {
            key: PROTOCOL_STEPS.MISSION_CREATED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED],
          },
          { key: PROTOCOL_STEPS.AUDIT_DONE, name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.AUDIT_DONE] },
          {
            key: PROTOCOL_STEPS.LEARNING_RECORDED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.LEARNING_RECORDED],
          },
        ];

        for (let i = 0; i < stepIds.length; i++) {
          const step = stepIds[i];
          const completed = status.stepsCompleted.includes(step.name);
          stepTable.push([
            String(i + 1),
            step.name,
            completed ? chalk.green('✓ Completed') : chalk.yellow('○ Pending'),
            PROTOCOL_STEP_TOOLS[step.key],
          ]);
        }

        console.log(chalk.bold('\nProtocol Steps:'));
        console.log(stepTable.toString());

        // Overall enforcement
        console.log(chalk.bold('\nEnforcement:'));
        if (status.valid) {
          console.log(`  ${chalk.green('✓')} All steps completed — protocol fully enforced`);
        } else {
          console.log(
            `  ${chalk.yellow('○')} ${status.stepsMissing.length} step(s) missing: ${status.stepsMissing.join(', ')}`,
          );
        }

        // Next step
        if (status.nextRequiredStep) {
          console.log(chalk.bold('\nNext Required Step:'));
          console.log(`  ${chalk.cyan('→')} ${status.nextRequiredStep}`);
        }
        console.log('');
      } catch (err) {
        spinner.fail('Protocol check failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── protocol enforce ─────────────────────────────────────
  protocol
    .command('enforce')
    .description('Set enforcement level')
    .requiredOption('-l, --level <level>', 'Enforcement level: strict, standard, audit')
    .action(async (options: { level: string }) => {
      const spinner = ora(`Setting enforcement level to ${options.level}...`).start();

      try {
        const validLevels = ['strict', 'standard', 'audit'];
        if (!validLevels.includes(options.level)) {
          spinner.fail(
            `Invalid level: ${options.level}. Must be one of: ${validLevels.join(', ')}`,
          );
          process.exitCode = 1;
          return;
        }

        spinner.succeed(`Enforcement level set to ${chalk.bold(options.level)}`);

        const levelDescriptions: Record<string, string> = {
          strict: 'All steps are required — action tools blocked until protocol complete',
          standard: 'Critical steps required — warnings for non-critical skips',
          audit: 'All actions allowed — violations are logged for audit trail',
        };

        console.log(chalk.gray(`\n  ${levelDescriptions[options.level] ?? ''}\n`));
      } catch (err) {
        spinner.fail('Failed to set enforcement level');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });

  // ─── protocol status ──────────────────────────────────────
  protocol
    .command('status')
    .description('Show detailed protocol enforcement status')
    .action(async () => {
      const spinner = ora('Loading protocol status...').start();

      try {
        const tracker = getStateTracker();
        const status = tracker.getStatus();

        spinner.succeed('Protocol status loaded');

        // Header
        console.log(chalk.bold('\n╔════════════════════════════════════════════════╗'));
        console.log(chalk.bold('║     BEHAVIOROS PROTOCOL ENFORCEMENT STATUS    ║'));
        console.log(chalk.bold('╚════════════════════════════════════════════════╝'));

        // Current step
        const currentStepName =
          status.currentStep > 0
            ? PROTOCOL_STEP_NAMES[status.currentStep as keyof typeof PROTOCOL_STEP_NAMES]
            : 'none';

        console.log(
          `\n  ${chalk.cyan('Current Step:')}    ${currentStepName} (${status.currentStep}/5)`,
        );
        console.log(`  ${chalk.cyan('Next Required:')}  ${status.nextRequiredStep}`);
        console.log(
          `  ${chalk.cyan('Overall Status:')} ${status.valid ? chalk.green('Valid') : chalk.yellow('Incomplete')}`,
        );

        // Detailed step status
        console.log(chalk.bold('\n  Steps:'));
        const stepIds: { key: number; name: string; tool: string }[] = [
          {
            key: PROTOCOL_STEPS.DNA_SELECTED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.DNA_SELECTED],
            tool: PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.DNA_SELECTED],
          },
          {
            key: PROTOCOL_STEPS.TRUTH_RESOLVED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.TRUTH_RESOLVED],
            tool: PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.TRUTH_RESOLVED],
          },
          {
            key: PROTOCOL_STEPS.MISSION_CREATED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.MISSION_CREATED],
            tool: PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.MISSION_CREATED],
          },
          {
            key: PROTOCOL_STEPS.AUDIT_DONE,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.AUDIT_DONE],
            tool: PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.AUDIT_DONE],
          },
          {
            key: PROTOCOL_STEPS.LEARNING_RECORDED,
            name: PROTOCOL_STEP_NAMES[PROTOCOL_STEPS.LEARNING_RECORDED],
            tool: PROTOCOL_STEP_TOOLS[PROTOCOL_STEPS.LEARNING_RECORDED],
          },
        ];

        for (const step of stepIds) {
          const completed = status.stepsCompleted.includes(step.name);
          const icon = completed ? chalk.green('✓') : chalk.yellow('○');
          console.log(`    ${icon} ${step.name} (${step.tool})`);
        }

        // Timestamps
        if (status.lastActionTimestamps.length > 0) {
          console.log(chalk.bold('\n  Timestamps:'));
          for (const ts of status.lastActionTimestamps) {
            console.log(`    ${chalk.cyan(ts.step)}: ${new Date(ts.timestamp).toLocaleString()}`);
          }
        }

        // Order violations
        if (status.orderViolations.length > 0) {
          console.log(chalk.bold('\n  ⚠ Order Violations:'));
          for (const v of status.orderViolations) {
            console.log(
              `    ${chalk.red(v.step)}: Expected ${v.expected}, attempted ${v.attempted}`,
            );
          }
        }

        // Summary
        const completedCount = status.stepsCompleted.length;
        const totalCount = 5;
        const pct = Math.round((completedCount / totalCount) * 100);

        console.log(
          `\n  ${chalk.cyan('Progress:')} ${completedCount}/${totalCount} steps (${pct}%)`,
        );
        console.log('');
      } catch (err) {
        spinner.fail('Failed to load protocol status');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
