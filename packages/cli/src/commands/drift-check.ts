import { DNALoader, DNAValidator } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import chalk from 'chalk';
import Table from 'cli-table3';
import type { Command } from 'commander';
import ora from 'ora';

interface DriftCategory {
  name: string;
  score: number;
  maxScore: number;
  findings: string[];
}

interface DriftReport {
  overallScore: number;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  categories: DriftCategory[];
  recommendations: string[];
  timestamp: string;
}

function compareSets(a: string[], b: string[]): { added: string[]; removed: string[] } {
  const setA = new Set(a);
  const setB = new Set(b);
  return {
    added: b.filter((x) => !setA.has(x)),
    removed: a.filter((x) => !setB.has(x)),
  };
}

function driftGovernance(from: DNAPackage, to: DNAPackage): DriftCategory {
  const findings: string[] = [];
  let score = 100;

  const fromRules = from.governance ?? [];
  const toRules = to.governance ?? [];

  const fromIds = new Set(fromRules.map((r) => r.id));
  const toIds = new Set(toRules.map((r) => r.id));

  const removed = fromRules.filter((r) => !toIds.has(r.id));
  const added = toRules.filter((r) => !fromIds.has(r.id));
  const changed = toRules.filter((r) => {
    const orig = fromRules.find((o) => o.id === r.id);
    return orig && (orig.level !== r.level || orig.action !== r.action);
  });

  if (removed.length > 0) {
    findings.push(
      `${removed.length} governance rule(s) removed: ${removed.map((r) => r.id).join(', ')}`,
    );
    score -= removed.length * 15;
  }
  if (added.length > 0) {
    findings.push(`${added.length} governance rule(s) added: ${added.map((r) => r.id).join(', ')}`);
    score -= added.length * 5;
  }
  if (changed.length > 0) {
    findings.push(
      `${changed.length} governance rule(s) changed: ${changed.map((r) => r.id).join(', ')}`,
    );
    score -= changed.length * 10;
  }

  const removedCritical = removed.filter((r) => r.level === 'critical');
  if (removedCritical.length > 0) {
    findings.push(`CRITICAL: ${removedCritical.length} critical rule(s) removed`);
    score -= removedCritical.length * 20;
  }

  return {
    name: 'Governance Rules',
    score: Math.max(0, score),
    maxScore: 100,
    findings,
  };
}

function driftQuality(from: DNAPackage, to: DNAPackage): DriftCategory {
  const findings: string[] = [];
  let score = 100;

  const fromGates = from.quality ?? [];
  const toGates = to.quality ?? [];

  const fromIds = new Set(fromGates.map((g) => g.id));
  const toIds = new Set(toGates.map((g) => g.id));

  const removed = fromGates.filter((g) => !toIds.has(g.id));
  const added = toGates.filter((g) => !fromIds.has(g.id));
  const lowered = toGates.filter((g) => {
    const orig = fromGates.find((o) => o.id === g.id);
    if (!orig) return false;
    if (orig.threshold != null && g.threshold != null) return g.threshold < orig.threshold;
    return false;
  });

  if (removed.length > 0) {
    findings.push(
      `${removed.length} quality gate(s) removed: ${removed.map((g) => g.id).join(', ')}`,
    );
    score -= removed.length * 15;
  }
  if (added.length > 0) {
    findings.push(`${added.length} quality gate(s) added: ${added.map((g) => g.id).join(', ')}`);
    score -= added.length * 3;
  }
  if (lowered.length > 0) {
    findings.push(
      `${lowered.length} quality gate threshold(s) lowered: ${lowered.map((g) => g.id).join(', ')}`,
    );
    score -= lowered.length * 10;
  }

  return {
    name: 'Quality Gates',
    score: Math.max(0, score),
    maxScore: 100,
    findings,
  };
}

function driftPersonas(from: DNAPackage, to: DNAPackage): DriftCategory {
  const findings: string[] = [];
  let score = 100;

  const fromRoles = from.personas.map((p) => `${p.role}:${p.authority}`);
  const toRoles = to.personas.map((p) => `${p.role}:${p.authority}`);

  const diff = compareSets(fromRoles, toRoles);

  if (diff.removed.length > 0) {
    findings.push(`${diff.removed.length} persona(s) removed: ${diff.removed.join(', ')}`);
    score -= diff.removed.length * 20;
  }
  if (diff.added.length > 0) {
    findings.push(`${diff.added.length} persona(s) added: ${diff.added.join(', ')}`);
    score -= diff.added.length * 5;
  }

  // Check boundary drift
  for (const toPersona of to.personas) {
    const fromPersona = from.personas.find(
      (p) => p.role === toPersona.role && p.authority === toPersona.authority,
    );
    if (!fromPersona) continue;

    const fromBoundaries = fromPersona.boundaries?.map((b) => b.id) ?? [];
    const toBoundaries = toPersona.boundaries?.map((b) => b.id) ?? [];
    const boundaryDiff = compareSets(fromBoundaries, toBoundaries);

    if (boundaryDiff.removed.length > 0) {
      findings.push(
        `${boundaryDiff.removed.length} boundary rule(s) removed from ${toPersona.role}: ${boundaryDiff.removed.join(', ')}`,
      );
      score -= boundaryDiff.removed.length * 10;
    }
  }

  return {
    name: 'Personas & Boundaries',
    score: Math.max(0, score),
    maxScore: 100,
    findings,
  };
}

function driftPatterns(from: DNAPackage, to: DNAPackage): DriftCategory {
  const findings: string[] = [];
  let score = 100;

  const fromPatterns = from.patterns ?? [];
  const toPatterns = to.patterns ?? [];

  const fromIds = new Set(fromPatterns.map((p) => p.id));
  const toIds = new Set(toPatterns.map((p) => p.id));

  const removed = fromPatterns.filter((p) => !toIds.has(p.id));
  const added = toPatterns.filter((p) => !fromIds.has(p.id));

  if (removed.length > 0) {
    findings.push(`${removed.length} pattern(s) removed: ${removed.map((p) => p.id).join(', ')}`);
    score -= removed.length * 10;
  }
  if (added.length > 0) {
    findings.push(`${added.length} pattern(s) added: ${added.map((p) => p.id).join(', ')}`);
    score -= added.length * 3;
  }

  return {
    name: 'Patterns',
    score: Math.max(0, score),
    maxScore: 100,
    findings,
  };
}

function driftWorkflows(from: DNAPackage, to: DNAPackage): DriftCategory {
  const findings: string[] = [];
  let score = 100;

  const fromWorkflows = from.workflows ?? [];
  const toWorkflows = to.workflows ?? [];

  const fromIds = new Set(fromWorkflows.map((w) => w.id));
  const toIds = new Set(toWorkflows.map((w) => w.id));

  const removed = fromWorkflows.filter((w) => !toIds.has(w.id));
  const added = toWorkflows.filter((w) => !fromIds.has(w.id));

  if (removed.length > 0) {
    findings.push(`${removed.length} workflow(s) removed: ${removed.map((w) => w.id).join(', ')}`);
    score -= removed.length * 10;
  }
  if (added.length > 0) {
    findings.push(`${added.length} workflow(s) added: ${added.map((w) => w.id).join(', ')}`);
    score -= added.length * 3;
  }

  return {
    name: 'Workflows',
    score: Math.max(0, score),
    maxScore: 100,
    findings,
  };
}

function buildRecommendations(report: DriftReport): string[] {
  const recs: string[] = [];

  for (const cat of report.categories) {
    if (cat.findings.length > 0 && cat.score < 80) {
      recs.push(`Review ${cat.name.toLowerCase()} — ${cat.findings.length} drift(s) detected`);
    }
  }

  if (report.overallScore < 50) {
    recs.push('Critical drift detected — consider rolling back to baseline');
  } else if (report.overallScore < 70) {
    recs.push('Significant drift detected — review changes before production deployment');
  } else if (report.overallScore < 90) {
    recs.push('Minor drift detected — acceptable for most deployments');
  }

  const govCat = report.categories.find((c) => c.name === 'Governance Rules');
  if (govCat?.findings.some((f) => f.includes('CRITICAL'))) {
    recs.push('CRITICAL governance rules were removed — immediate review required');
  }

  const qualCat = report.categories.find((c) => c.name === 'Quality Gates');
  if (qualCat?.findings.some((f) => f.includes('removed'))) {
    recs.push('Quality gates were removed — ensure coverage is maintained by other means');
  }

  return recs;
}

function getSeverity(score: number): DriftReport['severity'] {
  if (score >= 95) return 'none';
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

function severityColor(severity: DriftReport['severity']) {
  switch (severity) {
    case 'none':
      return chalk.green;
    case 'low':
      return chalk.green;
    case 'medium':
      return chalk.yellow;
    case 'high':
      return chalk.red;
    case 'critical':
      return chalk.red.bold;
  }
}

export function driftCheckCommand(program: Command): void {
  program
    .command('drift-check')
    .description(
      'Check for behavioral drift between a current DNA and a baseline, with recommendations',
    )
    .requiredOption('--dna <dna-file>', 'Path to the current DNA configuration')
    .requiredOption('--baseline <baseline-file>', 'Path to the baseline DNA file')
    .action(async (options: { dna: string; baseline: string }) => {
      const spinner = ora('Loading DNA files...').start();

      try {
        const loader = new DNALoader({ validate: true });

        spinner.text = `Loading current DNA from ${options.dna}...`;
        const current = loader.load(options.dna);

        spinner.text = `Loading baseline DNA from ${options.baseline}...`;
        const baseline = loader.load(options.baseline);

        spinner.text = 'Validating DNAs...';
        const currentValidation = DNAValidator.validate(current);
        const baselineValidation = DNAValidator.validate(baseline);

        if (!currentValidation.valid || !baselineValidation.valid) {
          spinner.fail('DNA validation failed');
          if (!currentValidation.valid) {
            console.log(
              chalk.red(
                `  Current DNA (${options.dna}): ${currentValidation.errors.length} error(s)`,
              ),
            );
          }
          if (!baselineValidation.valid) {
            console.log(
              chalk.red(
                `  Baseline DNA (${options.baseline}): ${baselineValidation.errors.length} error(s)`,
              ),
            );
          }
          process.exitCode = 1;
          return;
        }

        spinner.succeed(
          `Comparing ${chalk.bold(current.name)} v${current.version} against baseline ${chalk.bold(baseline.name)} v${baseline.version}`,
        );

        spinner.start('Analyzing drift...');

        const categories: DriftCategory[] = [
          driftGovernance(baseline, current),
          driftQuality(baseline, current),
          driftPersonas(baseline, current),
          driftPatterns(baseline, current),
          driftWorkflows(baseline, current),
        ];

        const overallScore = Math.round(
          categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
        );

        const report: DriftReport = {
          overallScore,
          severity: getSeverity(overallScore),
          categories,
          recommendations: [],
          timestamp: new Date().toISOString(),
        };

        report.recommendations = buildRecommendations(report);

        spinner.succeed('Drift analysis complete');

        // Header
        const sevColor = severityColor(report.severity);
        console.log(chalk.bold('\nDrift Report:'));
        console.log(`  ${chalk.cyan('Current:')}   ${current.name} v${current.version}`);
        console.log(`  ${chalk.cyan('Baseline:')}  ${baseline.name} v${baseline.version}`);
        console.log(`  ${chalk.cyan('Timestamp:')} ${report.timestamp}`);

        // Category results
        const categoryTable = new Table({
          head: [chalk.bold('Category'), chalk.bold('Score'), chalk.bold('Findings')],
          style: { head: [] },
          colWidths: [28, 12, 50],
        });

        for (const cat of categories) {
          const scoreColor =
            cat.score >= 80 ? chalk.green : cat.score >= 60 ? chalk.yellow : chalk.red;
          categoryTable.push([
            cat.name,
            scoreColor(`${cat.score}/${cat.maxScore}`),
            cat.findings.length === 0 ? chalk.green('No drift') : `${cat.findings.length} issue(s)`,
          ]);
        }

        console.log(chalk.bold('\nCategory Breakdown:'));
        console.log(categoryTable.toString());

        // Detailed findings
        const hasFindings = categories.some((c) => c.findings.length > 0);
        if (hasFindings) {
          console.log(chalk.bold('\nDetailed Findings:'));
          for (const cat of categories) {
            if (cat.findings.length === 0) continue;
            const icon =
              cat.score >= 80
                ? chalk.green('✓')
                : cat.score >= 60
                  ? chalk.yellow('!')
                  : chalk.red('✗');
            console.log(chalk.bold(`\n  ${icon} ${cat.name}:`));
            for (const finding of cat.findings) {
              console.log(`    ${chalk.gray('•')} ${finding}`);
            }
          }
        }

        // Recommendations
        if (report.recommendations.length > 0) {
          console.log(chalk.bold('\nRecommendations:'));
          for (const rec of report.recommendations) {
            console.log(`  ${chalk.yellow('→')} ${rec}`);
          }
        }

        // Overall
        console.log(chalk.bold('\nOverall:'));
        console.log(
          `  ${chalk.cyan('Drift Score:')} ${sevColor.bold(`${report.overallScore}/100`)}`,
        );
        console.log(
          `  ${chalk.cyan('Severity:')}   ${sevColor.bold(report.severity.toUpperCase())}`,
        );

        const severityAdvice: Record<DriftReport['severity'], string> = {
          none: 'No drift — safe to deploy',
          low: 'Minimal drift — safe to deploy',
          medium: 'Moderate drift — review recommended before production',
          high: 'Significant drift — requires review before deployment',
          critical: 'Critical drift — do not deploy without resolution',
        };
        console.log(`  ${chalk.cyan('Advice:')}     ${severityAdvice[report.severity]}`);
        console.log('');

        if (report.severity === 'high' || report.severity === 'critical') {
          process.exitCode = 1;
        }
      } catch (err) {
        spinner.fail('Drift check failed');
        console.error(chalk.red(`\n${String(err)}\n`));
        process.exitCode = 1;
      }
    });
}
