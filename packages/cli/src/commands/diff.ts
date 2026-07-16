import { DNALoader } from '@behavioros/core';
import type { BehaviorPattern, DNAPackage, GovernanceRule, QualityGate } from '@behavioros/schemas';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

interface DiffResult {
  governance: {
    added: GovernanceRule[];
    removed: GovernanceRule[];
    changed: Array<{ id: string; field: string; from: unknown; to: unknown }>;
  };
  quality: {
    added: QualityGate[];
    removed: QualityGate[];
    changed: Array<{ id: string; field: string; from: unknown; to: unknown }>;
  };
  patterns: {
    added: BehaviorPattern[];
    removed: BehaviorPattern[];
    changed: Array<{ id: string; field: string; from: unknown; to: unknown }>;
  };
  personas: { added: number; removed: number; changed: number };
  workflows: { added: number; removed: number; changed: number };
}

function diffArrays<T extends { id: string }>(
  from: T[],
  to: T[],
  compareFields: (keyof T)[],
): {
  added: T[];
  removed: T[];
  changed: Array<{ id: string; field: string; from: unknown; to: unknown }>;
} {
  const fromMap = new Map(from.map((item) => [item.id, item]));
  const toMap = new Map(to.map((item) => [item.id, item]));

  const added = to.filter((item) => !fromMap.has(item.id));
  const removed = from.filter((item) => !toMap.has(item.id));
  const changed: Array<{ id: string; field: string; from: unknown; to: unknown }> = [];

  for (const [id, toItem] of toMap) {
    const fromItem = fromMap.get(id);
    if (!fromItem) continue;

    for (const field of compareFields) {
      const fromVal = JSON.stringify(fromItem[field]);
      const toVal = JSON.stringify(toItem[field]);
      if (fromVal !== toVal) {
        changed.push({ id, field: String(field), from: fromItem[field], to: toItem[field] });
      }
    }
  }

  return { added, removed, changed };
}

function comparePersonas(from: DNAPackage, to: DNAPackage): DiffResult['personas'] {
  const fromRoles = from.personas.map((p) => `${p.role}:${p.authority}`);
  const toRoles = to.personas.map((p) => `${p.role}:${p.authority}`);
  const fromSet = new Set(fromRoles);
  const toSet = new Set(toRoles);
  return {
    added: toRoles.filter((r) => !fromSet.has(r)).length,
    removed: fromRoles.filter((r) => !toSet.has(r)).length,
    changed: 0,
  };
}

function compareWorkflows(from: DNAPackage, to: DNAPackage): DiffResult['workflows'] {
  const fromIds = new Set((from.workflows ?? []).map((w) => w.id));
  const toIds = new Set((to.workflows ?? []).map((w) => w.id));
  return {
    added: [...toIds].filter((id) => !fromIds.has(id)).length,
    removed: [...fromIds].filter((id) => !toIds.has(id)).length,
    changed: 0,
  };
}

function computeDiff(from: DNAPackage, to: DNAPackage): DiffResult {
  return {
    governance: diffArrays(from.governance ?? [], to.governance ?? [], [
      'name',
      'level',
      'action',
      'conditions',
    ]),
    quality: diffArrays(from.quality ?? [], to.quality ?? [], [
      'name',
      'type',
      'threshold',
      'pass',
    ]),
    patterns: diffArrays(from.patterns ?? [], to.patterns ?? [], [
      'name',
      'type',
      'triggers',
      'actions',
    ]),
    personas: comparePersonas(from, to),
    workflows: compareWorkflows(from, to),
  };
}

function hasChanges(diff: DiffResult): boolean {
  return (
    diff.governance.added.length > 0 ||
    diff.governance.removed.length > 0 ||
    diff.governance.changed.length > 0 ||
    diff.quality.added.length > 0 ||
    diff.quality.removed.length > 0 ||
    diff.quality.changed.length > 0 ||
    diff.patterns.added.length > 0 ||
    diff.patterns.removed.length > 0 ||
    diff.patterns.changed.length > 0 ||
    diff.personas.added > 0 ||
    diff.personas.removed > 0 ||
    diff.workflows.added > 0 ||
    diff.workflows.removed > 0
  );
}

export function diffCommand(program: Command): void {
  program
    .command('diff')
    .description(
      'Compare two DNA files and show differences in governance, quality gates, and patterns',
    )
    .requiredOption('--from <dna1>', 'Path to the source DNA file')
    .requiredOption('--to <dna2>', 'Path to the target DNA file')
    .action(async (options: { from: string; to: string }) => {
      const spinner = ora('Loading DNA files...').start();

      try {
        const loader = new DNALoader({ validate: true });

        spinner.text = `Loading ${options.from}...`;
        const from = loader.load(options.from);

        spinner.text = `Loading ${options.to}...`;
        const to = loader.load(options.to);

        spinner.succeed(
          `Comparing ${chalk.bold(from.name)} v${from.version} → ${chalk.bold(to.name)} v${to.version}`,
        );

        const diff = computeDiff(from, to);

        if (!hasChanges(diff)) {
          console.log(chalk.green('\nNo differences found. DNAs are identical.\n'));
          return;
        }

        // Governance diff
        if (
          diff.governance.added.length > 0 ||
          diff.governance.removed.length > 0 ||
          diff.governance.changed.length > 0
        ) {
          console.log(chalk.bold('\nGovernance Rules:'));
          if (diff.governance.added.length > 0) {
            const table = new Table({
              head: [
                chalk.green.bold('Added'),
                chalk.green.bold('Level'),
                chalk.green.bold('Action'),
              ],
              style: { head: [] },
            });
            for (const rule of diff.governance.added) {
              table.push([rule.id, rule.level, rule.action]);
            }
            console.log(table.toString());
          }
          if (diff.governance.removed.length > 0) {
            const table = new Table({
              head: [chalk.red.bold('Removed'), chalk.red.bold('Level'), chalk.red.bold('Action')],
              style: { head: [] },
            });
            for (const rule of diff.governance.removed) {
              table.push([rule.id, rule.level, rule.action]);
            }
            console.log(table.toString());
          }
          if (diff.governance.changed.length > 0) {
            const table = new Table({
              head: [
                chalk.yellow.bold('Changed'),
                chalk.yellow.bold('Field'),
                chalk.yellow.bold('From'),
                chalk.yellow.bold('To'),
              ],
              style: { head: [] },
            });
            for (const c of diff.governance.changed) {
              table.push([c.id, c.field, JSON.stringify(c.from), JSON.stringify(c.to)]);
            }
            console.log(table.toString());
          }
        }

        // Quality gates diff
        if (
          diff.quality.added.length > 0 ||
          diff.quality.removed.length > 0 ||
          diff.quality.changed.length > 0
        ) {
          console.log(chalk.bold('\nQuality Gates:'));
          if (diff.quality.added.length > 0) {
            const table = new Table({
              head: [
                chalk.green.bold('Added'),
                chalk.green.bold('Type'),
                chalk.green.bold('Threshold'),
              ],
              style: { head: [] },
            });
            for (const gate of diff.quality.added) {
              table.push([gate.id, gate.type, gate.threshold ?? gate.pass ?? '—']);
            }
            console.log(table.toString());
          }
          if (diff.quality.removed.length > 0) {
            const table = new Table({
              head: [
                chalk.red.bold('Removed'),
                chalk.red.bold('Type'),
                chalk.red.bold('Threshold'),
              ],
              style: { head: [] },
            });
            for (const gate of diff.quality.removed) {
              table.push([gate.id, gate.type, gate.threshold ?? gate.pass ?? '—']);
            }
            console.log(table.toString());
          }
          if (diff.quality.changed.length > 0) {
            const table = new Table({
              head: [
                chalk.yellow.bold('Changed'),
                chalk.yellow.bold('Field'),
                chalk.yellow.bold('From'),
                chalk.yellow.bold('To'),
              ],
              style: { head: [] },
            });
            for (const c of diff.quality.changed) {
              table.push([c.id, c.field, JSON.stringify(c.from), JSON.stringify(c.to)]);
            }
            console.log(table.toString());
          }
        }

        // Patterns diff
        if (
          diff.patterns.added.length > 0 ||
          diff.patterns.removed.length > 0 ||
          diff.patterns.changed.length > 0
        ) {
          console.log(chalk.bold('\nPatterns:'));
          if (diff.patterns.added.length > 0) {
            const table = new Table({
              head: [chalk.green.bold('Added'), chalk.green.bold('Type')],
              style: { head: [] },
            });
            for (const p of diff.patterns.added) {
              table.push([p.id, p.type]);
            }
            console.log(table.toString());
          }
          if (diff.patterns.removed.length > 0) {
            const table = new Table({
              head: [chalk.red.bold('Removed'), chalk.red.bold('Type')],
              style: { head: [] },
            });
            for (const p of diff.patterns.removed) {
              table.push([p.id, p.type]);
            }
            console.log(table.toString());
          }
          if (diff.patterns.changed.length > 0) {
            const table = new Table({
              head: [
                chalk.yellow.bold('Changed'),
                chalk.yellow.bold('Field'),
                chalk.yellow.bold('From'),
                chalk.yellow.bold('To'),
              ],
              style: { head: [] },
            });
            for (const c of diff.patterns.changed) {
              table.push([
                c.id,
                c.field,
                JSON.stringify(c.from).slice(0, 50),
                JSON.stringify(c.to).slice(0, 50),
              ]);
            }
            console.log(table.toString());
          }
        }

        // Personas summary
        if (diff.personas.added > 0 || diff.personas.removed > 0) {
          console.log(chalk.bold('\nPersonas:'));
          console.log(`  ${chalk.green('+')} ${diff.personas.added} added`);
          console.log(`  ${chalk.red('-')} ${diff.personas.removed} removed`);
        }

        // Workflows summary
        if (diff.workflows.added > 0 || diff.workflows.removed > 0) {
          console.log(chalk.bold('\nWorkflows:'));
          console.log(`  ${chalk.green('+')} ${diff.workflows.added} added`);
          console.log(`  ${chalk.red('-')} ${diff.workflows.removed} removed`);
        }

        // Summary
        const totalChanges =
          diff.governance.added.length +
          diff.governance.removed.length +
          diff.governance.changed.length +
          diff.quality.added.length +
          diff.quality.removed.length +
          diff.quality.changed.length +
          diff.patterns.added.length +
          diff.patterns.removed.length +
          diff.patterns.changed.length +
          diff.personas.added +
          diff.personas.removed +
          diff.workflows.added +
          diff.workflows.removed;

        console.log(chalk.bold('\nSummary:'));
        console.log(`  ${chalk.cyan('Total changes:')} ${totalChanges}`);
        console.log(
          `  ${chalk.green('Added:')}    ${diff.governance.added.length + diff.quality.added.length + diff.patterns.added.length + diff.personas.added + diff.workflows.added}`,
        );
        console.log(
          `  ${chalk.red('Removed:')}  ${diff.governance.removed.length + diff.quality.removed.length + diff.patterns.removed.length + diff.personas.removed + diff.workflows.removed}`,
        );
        console.log(
          `  ${chalk.yellow('Changed:')}  ${diff.governance.changed.length + diff.quality.changed.length + diff.patterns.changed.length}`,
        );
        console.log('');
      } catch (err) {
        spinner.fail('Diff failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
