import { readFileSync } from 'node:fs';

import { DNALoader, DNAValidator } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

interface LayerSimulation {
  name: string;
  passed: boolean;
  score: number;
  details: string[];
}

function simulateGovernance(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  const rules = dna.governance ?? [];
  let score = 100;

  if (rules.length === 0) {
    details.push('No governance rules defined — unrestricted execution');
    score = 50;
  } else {
    const criticalRules = rules.filter((r) => r.level === 'critical');
    const blockingRules = rules.filter((r) => r.action === 'block');

    details.push(`${rules.length} governance rules loaded`);
    details.push(`${criticalRules.length} critical rules, ${blockingRules.length} blocking rules`);

    if (criticalRules.length === 0) {
      details.push('Warning: No critical-level rules');
      score -= 10;
    }
    if (blockingRules.length === 0) {
      details.push('Warning: No blocking rules — all violations are warnings');
      score -= 5;
    }
  }

  return { name: 'Governance', passed: score >= 70, score, details };
}

function simulateQuality(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  const gates = dna.quality ?? [];
  let score = 100;

  if (gates.length === 0) {
    details.push('No quality gates defined');
    score = 40;
  } else {
    details.push(`${gates.length} quality gates configured`);

    for (const gate of gates) {
      const status =
        gate.pass === true
          ? 'pass'
          : gate.threshold != null
            ? `threshold: ${gate.threshold}`
            : 'unchecked';
      details.push(`  ${gate.id}: ${gate.type} — ${status}`);

      if (gate.type === 'security' && gate.pass !== true) {
        details.push(`  Warning: Security gate not enforced`);
        score -= 15;
      }
    }

    const hasCoverage = gates.some((g) => g.type === 'test_coverage');
    const hasLint = gates.some((g) => g.type === 'lint');
    const hasTypecheck = gates.some((g) => g.type === 'typecheck');

    if (!hasCoverage) {
      details.push('Warning: No test coverage gate');
      score -= 5;
    }
    if (!hasLint) {
      details.push('Warning: No lint gate');
      score -= 5;
    }
    if (!hasTypecheck) {
      details.push('Warning: No typecheck gate');
      score -= 5;
    }
  }

  return { name: 'Quality Gates', passed: score >= 70, score, details };
}

function simulateBehavioral(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  let score = 100;

  const personas = dna.personas ?? [];
  details.push(`${personas.length} personas configured`);

  if (personas.length === 0) {
    details.push('No personas — agents have no behavioral constraints');
    score = 30;
  } else {
    const withBoundaries = personas.filter((p) => p.boundaries && p.boundaries.length > 0);
    details.push(`${withBoundaries.length}/${personas.length} personas have boundaries`);

    if (withBoundaries.length < personas.length) {
      details.push('Warning: Some personas lack boundary rules');
      score -= 10;
    }

    const withSkills = personas.filter((p) => p.skills && p.skills.length > 0);
    details.push(`${withSkills.length}/${personas.length} personas have defined skills`);
  }

  return { name: 'Behavioral', passed: score >= 70, score, details };
}

function simulatePatterns(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  const patterns = dna.patterns ?? [];
  let score = 100;

  if (patterns.length === 0) {
    details.push('No behavioral patterns defined');
    score = 60;
  } else {
    details.push(`${patterns.length} patterns configured`);

    const withTriggers = patterns.filter((p) => p.triggers && p.triggers.length > 0);
    const withActions = patterns.filter((p) => p.actions && p.actions.length > 0);

    details.push(`${withTriggers.length}/${patterns.length} patterns have triggers`);
    details.push(`${withActions.length}/${patterns.length} patterns have actions`);

    if (withTriggers.length < patterns.length) {
      details.push('Warning: Some patterns lack triggers');
      score -= 5;
    }
  }

  return { name: 'Patterns', passed: score >= 70, score, details };
}

function simulateWorkflows(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  const workflows = dna.workflows ?? [];
  let score = 100;

  if (workflows.length === 0) {
    details.push('No workflows defined');
    score = 60;
  } else {
    details.push(`${workflows.length} workflows configured`);

    const withTimeout = workflows.filter((w) => w.timeout != null);
    const withRetries = workflows.filter((w) => w.retries != null);

    details.push(`${withTimeout.length}/${workflows.length} workflows have timeouts`);
    details.push(`${withRetries.length}/${workflows.length} workflows have retry config`);

    if (withTimeout.length < workflows.length) {
      details.push('Warning: Some workflows lack timeouts — may hang indefinitely');
      score -= 10;
    }
  }

  return { name: 'Workflows', passed: score >= 70, score, details };
}

function simulateSchema(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  const result = DNAValidator.validate(dna);
  const score = result.valid ? 100 : Math.max(0, 100 - result.errors.length * 20);

  details.push(`Errors: ${result.errors.length}`);
  details.push(`Warnings: ${result.warnings.length}`);

  for (const err of result.errors.slice(0, 5)) {
    details.push(`  [ERROR] ${err.code}: ${err.message}`);
  }
  for (const warn of result.warnings.slice(0, 5)) {
    details.push(`  [WARN] ${warn.code}: ${warn.message}`);
  }

  return { name: 'Schema Validation', passed: result.valid, score, details };
}

function simulateGovernanceEval(dna: DNAPackage): LayerSimulation {
  const details: string[] = [];
  const rules = dna.governance ?? [];
  let score = 100;

  const actions = ['feature', 'bugfix', 'deploy', 'security', 'infrastructure'];
  let blockedCount = 0;
  let escalatedCount = 0;

  for (const action of actions) {
    const matching = rules.filter((r) =>
      r.conditions?.some((c) => c.includes(action) || c.includes('type:all')),
    );
    const blocking = matching.filter((r) => r.action === 'block');
    const escalating = matching.filter((r) => r.action === 'escalate');

    blockedCount += blocking.length;
    escalatedCount += escalating.length;

    if (matching.length === 0) {
      details.push(`  ${action}: no rules match — unrestricted`);
    } else {
      details.push(
        `  ${action}: ${matching.length} rules (${blocking.length} block, ${escalating.length} escalate)`,
      );
    }
  }

  if (blockedCount === 0) {
    details.push('Warning: No actions are blocked — no safety net');
    score -= 20;
  }
  if (escalatedCount === 0) {
    details.push('Warning: No actions require escalation — limited oversight');
    score -= 10;
  }

  return { name: 'Governance Evaluation', passed: score >= 70, score, details };
}

export function simulateCommand(program: Command): void {
  program
    .command('simulate')
    .description('Simulate a prompt against a DNA configuration and show layer pass/fail results')
    .requiredOption('--dna <dna-file>', 'Path to the DNA configuration file')
    .requiredOption('--prompt <prompt-file>', 'Path to the prompt file to simulate')
    .option('--model <model-name>', 'Model name to simulate with', 'default')
    .action(async (options: { dna: string; prompt: string; model: string }) => {
      const spinner = ora('Loading DNA configuration...').start();

      try {
        const loader = new DNALoader({ validate: true });
        spinner.text = `Loading DNA from ${options.dna}...`;
        const dna = loader.load(options.dna);

        spinner.text = `Loading prompt from ${options.prompt}...`;
        let promptContent: string;
        try {
          promptContent = readFileSync(options.prompt, 'utf-8');
        } catch {
          spinner.fail(`Cannot read prompt file: ${options.prompt}`);
          process.exitCode = 1;
          return;
        }

        spinner.succeed(`Loaded DNA: ${chalk.bold(dna.name)} v${dna.version}`);
        spinner.start('Running simulation...');

        const layers: LayerSimulation[] = [
          simulateSchema(dna),
          simulateBehavioral(dna),
          simulateGovernance(dna),
          simulateQuality(dna),
          simulatePatterns(dna),
          simulateWorkflows(dna),
          simulateGovernanceEval(dna),
        ];

        const overallScore = Math.round(
          layers.reduce((sum, l) => sum + l.score, 0) / layers.length,
        );
        const overallPassed = layers.every((l) => l.passed);

        spinner.succeed('Simulation complete');

        console.log(chalk.bold('\nSimulation Report:'));
        console.log(`  ${chalk.cyan('DNA:')}       ${dna.name} v${dna.version}`);
        console.log(`  ${chalk.cyan('Prompt:')}    ${options.prompt}`);
        console.log(`  ${chalk.cyan('Model:')}     ${options.model}`);
        console.log(`  ${chalk.cyan('Timestamp:')} ${new Date().toISOString()}`);

        // Layer results table
        const layerTable = new Table({
          head: [chalk.bold('Layer'), chalk.bold('Status'), chalk.bold('Score')],
          style: { head: [] },
          colWidths: [30, 12, 10],
        });

        for (const layer of layers) {
          const status = layer.passed ? chalk.green.bold('PASS') : chalk.red.bold('FAIL');
          const score = layer.passed
            ? chalk.green(`${layer.score}%`)
            : chalk.red(`${layer.score}%`);
          layerTable.push([layer.name, status, score]);
        }

        console.log(chalk.bold('\nLayer Results:'));
        console.log(layerTable.toString());

        // Detailed results
        for (const layer of layers) {
          const icon = layer.passed ? chalk.green('✓') : chalk.red('✗');
          console.log(chalk.bold(`\n${icon} ${layer.name} (${layer.score}%)`));
          for (const detail of layer.details) {
            console.log(`  ${detail}`);
          }
        }

        // Prompt preview
        console.log(chalk.bold('\nPrompt Preview:'));
        const previewLines = promptContent.split('\n').slice(0, 10);
        for (const line of previewLines) {
          console.log(`  ${chalk.gray(line)}`);
        }
        if (promptContent.split('\n').length > 10) {
          console.log(`  ${chalk.gray('...')}`);
        }

        // Overall summary
        console.log(chalk.bold('\nOverall:'));
        console.log(
          `  ${chalk.cyan('Status:')} ${overallPassed ? chalk.green.bold('PASS') : chalk.red.bold('FAIL')}`,
        );
        console.log(
          `  ${chalk.cyan('Score:')}  ${overallPassed ? chalk.green(`${overallScore}%`) : chalk.red(`${overallScore}%`)}`,
        );
        console.log(
          `  ${chalk.cyan('Layers:')} ${layers.filter((l) => l.passed).length}/${layers.length} passed`,
        );
        console.log('');

        if (!overallPassed) {
          process.exitCode = 1;
        }
      } catch (err) {
        spinner.fail('Simulation failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
