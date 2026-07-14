import type { AuditChain, AuditChainReport, AuditResult } from '@behavioros/core';
import { z } from 'zod';

export const bosRunAuditInput = z.object({
  trigger: z
    .enum(['commit', 'pr', 'merge', 'deploy_staging', 'deploy_production'])
    .describe('Audit trigger stage'),
  context: z.record(z.unknown()).optional().describe('Audit context (branch, files, author)'),
});

export type BosRunAuditInput = z.infer<typeof bosRunAuditInput>;

function formatAuditReport(report: AuditChainReport): string {
  const statusIcon = (status: AuditResult['status']): string => {
    switch (status) {
      case 'pass':
        return '[PASS]';
      case 'warn':
        return '[WARN]';
      case 'fail':
        return '[FAIL]';
      case 'skip':
        return '[SKIP]';
      default:
        return `[${String(status).toUpperCase()}]`;
    }
  };

  const lines: string[] = [
    `Audit Pipeline: ${report.trigger}`,
    `Overall Status: ${report.overallStatus.toUpperCase()}`,
    `Total Duration: ${report.totalDuration}ms`,
    `Timestamp: ${report.timestamp}`,
    '',
    '--- STAGE RESULTS ---',
  ];

  for (const result of report.results) {
    const durationStr = result.duration > 0 ? ` (${result.duration}ms)` : '';
    lines.push(`${statusIcon(result.status)} ${result.step}${durationStr}`);

    if (result.status === 'fail' && result.details) {
      const details = result.details as Record<string, unknown>;
      if (details.reason) {
        lines.push(`      Reason: ${details.reason}`);
      }
      if (details.stderr) {
        const stderr = String(details.stderr).split('\n').slice(0, 5).join('\n      ');
        lines.push(`      stderr: ${stderr}`);
      }
      if (details.error) {
        lines.push(`      Error: ${details.error}`);
      }
    }
    if (result.status === 'warn' && result.details) {
      const details = result.details as Record<string, unknown>;
      if (details.output) {
        const output = String(details.output).split('\n').slice(0, 3).join('\n      ');
        lines.push(`      output: ${output}`);
      }
    }
  }

  const passCount = report.results.filter((r) => r.status === 'pass').length;
  const warnCount = report.results.filter((r) => r.status === 'warn').length;
  const failCount = report.results.filter((r) => r.status === 'fail').length;
  lines.push('', `Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`);

  return lines.join('\n');
}

export async function bosRunAudit(auditChain: AuditChain, input: BosRunAuditInput) {
  const report = await auditChain.execute(input.trigger, input.context ?? {});
  const formatted = formatAuditReport(report);

  return {
    content: [
      { type: 'text' as const, text: formatted },
      { type: 'text' as const, text: `\n--- RAW DATA ---\n${JSON.stringify(report, null, 2)}` },
    ],
  };
}
