import { tool } from '@opencode-ai/plugin';

export default tool({
  description:
    'Run the BehaviorOS audit pipeline stages (lint, typecheck, build, test) and return formatted results.',
  args: {
    stages: tool.schema
      .string()
      .optional()
      .describe(
        'Comma-separated stages to run: lint,typecheck,build,test. Defaults to all stages.',
      ),
  },
  async execute(args, context) {
    const { worktree, $ } = context;
    const requestedStages = args.stages
      ? args.stages.split(',').map((s) => s.trim())
      : ['lint', 'typecheck', 'build', 'test'];

    const stageResults: Array<{
      stage: string;
      passed: boolean;
      output: string;
      duration: string;
    }> = [];

    for (const stage of requestedStages) {
      const start = Date.now();
      let command: string;
      let passed = false;
      let output = '';

      switch (stage) {
        case 'lint':
          command = 'pnpm lint:check';
          break;
        case 'typecheck':
          command = 'pnpm typecheck';
          break;
        case 'build':
          command = 'pnpm build';
          break;
        case 'test':
          command = 'pnpm test';
          break;
        default:
          output = `Unknown stage: ${stage}. Valid stages: lint, typecheck, build, test`;
          stageResults.push({
            stage,
            passed: false,
            output,
            duration: '0ms',
          });
          continue;
      }

      try {
        const result = await $`${command}`.cwd(worktree).text();
        passed = true;
        output = result.trim();
      } catch (err) {
        passed = false;
        output = (err as Error).message || 'Stage failed';
      }

      const duration = `${Date.now() - start}ms`;
      stageResults.push({ stage, passed, output, duration });
    }

    // Format output
    const totalStages = stageResults.length;
    const passedStages = stageResults.filter((r) => r.passed).length;
    const failedStages = totalStages - passedStages;

    let report = `BehaviorOS Audit Pipeline Results\n`;
    report += `${'='.repeat(45)}\n`;
    report += `Stages run: ${totalStages}\n`;
    report += `Passed: ${passedStages}\n`;
    report += `Failed: ${failedStages}\n`;
    report += `Overall: ${failedStages === 0 ? 'PASS' : 'FAIL'}\n\n`;

    for (const result of stageResults) {
      const status = result.passed ? 'PASS' : 'FAIL';
      report += `[${status}] ${result.stage.toUpperCase()} (${result.duration})\n`;
      if (!result.passed && result.output) {
        // Show first 500 chars of error output
        const truncated =
          result.output.length > 500 ? result.output.substring(0, 500) + '...' : result.output;
        report += `  ${truncated}\n`;
      }
      report += '\n';
    }

    return report;
  },
});
