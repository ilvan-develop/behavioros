import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Alert } from '../alert-manager';
import type { DiffAnalysisSummary, DiffResult, DiffSeverity } from '../diff-analyzer';
import type { ReplayStats } from '../traffic-replay';

// ============================================================
// Shadow Report — Validation report with recommendation
// ============================================================

/**
 * Top-level recommendation from a shadow validation run.
 */
export type ShadowRecommendation = 'proceed' | 'rollback' | 'investigate';

/**
 * Section within the shadow report.
 */
export interface ReportSection {
  /** Section title. */
  title: string;
  /** Section content (markdown). */
  content: string;
  /** Section severity level. */
  severity: DiffSeverity;
}

/**
 * Complete shadow validation report.
 */
export interface ShadowReport {
  /** Unique report ID. */
  id: string;
  /** ISO-8601 report generation timestamp. */
  timestamp: string;
  /** Report title. */
  title: string;
  /** Project or DNA name. */
  projectName: string;
  /** DNA version tested. */
  dnaVersion: string;
  /** DNA version being compared against. */
  baselineVersion?: string;
  /** Final recommendation. */
  recommendation: ShadowRecommendation;
  /** Overall confidence score (0-100). */
  confidenceScore: number;
  /** Executive summary. */
  executiveSummary: string;
  /** Report sections. */
  sections: ReportSection[];
  /** Diff analysis summary. */
  diffSummary: DiffAnalysisSummary;
  /** Replay statistics. */
  replayStats: ReplayStats;
  /** Active alerts at time of report. */
  alerts: Alert[];
  /** Total traffic entries analyzed. */
  totalEntries: number;
  /** Time range of captured traffic. */
  trafficTimeRange: { start: string; end: string };
}

export interface ShadowReportConfig {
  /** Report output directory. */
  outputDir?: string;
  /** Whether to include individual diff results. Default: false. */
  includeDiffDetails: boolean;
  /** Maximum diff results to include per section. Default: 20. */
  maxDiffDetails: number;
  /** Project name override. Default: 'unknown'. */
  projectName: string;
}

// --- Defaults ---

const DEFAULT_REPORT_CONFIG: ShadowReportConfig = {
  includeDiffDetails: false,
  maxDiffDetails: 20,
  projectName: 'unknown',
};

// ============================================================
// ShadowReportGenerator
// ============================================================

export class ShadowReportGenerator {
  private config: ShadowReportConfig;

  constructor(config?: Partial<ShadowReportConfig>) {
    this.config = { ...DEFAULT_REPORT_CONFIG, ...config };
  }

  // ── Report generation ────────────────────────────────────────

  /**
   * Generate a complete shadow validation report.
   */
  generate(params: {
    diffSummary: DiffAnalysisSummary;
    replayStats: ReplayStats;
    alerts: Alert[];
    captures: Array<{ timestamp: string }>;
    dnaVersion?: string;
    baselineVersion?: string;
    projectName?: string;
  }): ShadowReport {
    const { diffSummary, replayStats, alerts, captures, dnaVersion, baselineVersion, projectName } =
      params;

    const activeAlerts = alerts.filter((a) => a.status === 'active');
    const confidenceScore = this.calculateConfidence(diffSummary, replayStats, activeAlerts);
    const recommendation = diffSummary.recommendation;

    const timeRange = this.getTimeRange(captures);
    const sections = this.buildSections(diffSummary, replayStats, activeAlerts);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      title: `Shadow Validation Report — ${projectName ?? this.config.projectName}`,
      projectName: projectName ?? this.config.projectName,
      dnaVersion: dnaVersion ?? 'unknown',
      baselineVersion,
      recommendation,
      confidenceScore,
      executiveSummary: this.buildExecutiveSummary(
        recommendation,
        confidenceScore,
        diffSummary,
        activeAlerts,
      ),
      sections,
      diffSummary,
      replayStats,
      alerts: activeAlerts,
      totalEntries: diffSummary.totalPairs,
      trafficTimeRange: timeRange,
    };
  }

  // ── Persistence ──────────────────────────────────────────────

  /**
   * Save report to a JSON file.
   */
  async save(report: ShadowReport, path: string): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
    }
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8');
  }

  /**
   * Load a report from a JSON file.
   */
  async load(path: string): Promise<ShadowReport> {
    if (!existsSync(path)) throw new Error(`Report file not found: ${path}`);
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ShadowReport;
  }

  // ── Config ───────────────────────────────────────────────────

  getConfig(): Readonly<ShadowReportConfig> {
    return this.config;
  }

  // ── Section builders ─────────────────────────────────────────

  private buildSections(
    diffSummary: DiffAnalysisSummary,
    replayStats: ReplayStats,
    activeAlerts: Alert[],
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    sections.push(this.buildOverviewSection(diffSummary, replayStats));
    sections.push(this.buildDriftSection(diffSummary));
    sections.push(this.buildPerformanceSection(diffSummary, replayStats));
    sections.push(this.buildRegressionSection(diffSummary));

    if (activeAlerts.length > 0) {
      sections.push(this.buildAlertsSection(activeAlerts));
    }

    if (this.config.includeDiffDetails && diffSummary.results.length > 0) {
      sections.push(this.buildDiffDetailsSection(diffSummary.results));
    }

    sections.push(this.buildRecommendationSection(diffSummary));

    return sections;
  }

  private buildOverviewSection(
    diffSummary: DiffAnalysisSummary,
    replayStats: ReplayStats,
  ): ReportSection {
    const lines: string[] = [];
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Pairs Analyzed | ${diffSummary.totalPairs} |`);
    lines.push(`| Succeeded | ${replayStats.succeeded}/${replayStats.total} |`);
    lines.push(`| Failed | ${replayStats.failed}/${replayStats.total} |`);
    lines.push(`| Mean Drift Score | ${diffSummary.meanDriftScore}/100 |`);
    lines.push(`| P95 Drift Score | ${diffSummary.p95DriftScore}/100 |`);
    lines.push(`| Regressions | ${diffSummary.regressions} |`);
    lines.push(`| Improvements | ${diffSummary.improvements} |`);
    lines.push(`| Status Code Mismatches | ${diffSummary.statusCodeMismatches} |`);
    lines.push(`| Mean Latency Ratio | ${diffSummary.meanLatencyRatio}x |`);

    return {
      title: 'Overview',
      content: lines.join('\n'),
      severity: 'info',
    };
  }

  private buildDriftSection(diffSummary: DiffAnalysisSummary): ReportSection {
    const lines: string[] = [];
    lines.push(`**Mean Drift Score: ${diffSummary.meanDriftScore}/100**`);
    lines.push('');

    const severityEntries = Object.entries(diffSummary.severityBreakdown);
    if (severityEntries.length > 0) {
      lines.push('| Severity | Count |');
      lines.push('|----------|-------|');
      for (const [sev, count] of severityEntries) {
        lines.push(`| ${sev} | ${count} |`);
      }
    }

    const categoryEntries = Object.entries(diffSummary.categoryBreakdown);
    if (categoryEntries.length > 0) {
      lines.push('');
      lines.push('| Category | Count |');
      lines.push('|----------|-------|');
      for (const [cat, count] of categoryEntries) {
        lines.push(`| ${cat} | ${count} |`);
      }
    }

    return {
      title: 'Drift Analysis',
      content: lines.join('\n'),
      severity:
        diffSummary.meanDriftScore > 60
          ? 'critical'
          : diffSummary.meanDriftScore > 30
            ? 'high'
            : 'info',
    };
  }

  private buildPerformanceSection(
    diffSummary: DiffAnalysisSummary,
    replayStats: ReplayStats,
  ): ReportSection {
    const lines: string[] = [];
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Avg Shadow Latency | ${replayStats.avgLatencyMs}ms |`);
    lines.push(`| P50 Latency | ${replayStats.p50LatencyMs}ms |`);
    lines.push(`| P95 Latency | ${replayStats.p95LatencyMs}ms |`);
    lines.push(`| P99 Latency | ${replayStats.p99LatencyMs}ms |`);
    lines.push(`| Total Batch Duration | ${replayStats.totalDurationMs}ms |`);
    lines.push(`| Mean Latency Ratio | ${diffSummary.meanLatencyRatio}x |`);

    return {
      title: 'Performance',
      content: lines.join('\n'),
      severity: diffSummary.meanLatencyRatio > 2.0 ? 'high' : 'info',
    };
  }

  private buildRegressionSection(diffSummary: DiffAnalysisSummary): ReportSection {
    const lines: string[] = [];

    if (diffSummary.regressions === 0) {
      lines.push(
        'No regressions detected. All shadow responses matched or improved upon the baseline.',
      );
    } else {
      lines.push(`**${diffSummary.regressions} regression(s) detected.**`);
      lines.push('');
      lines.push(
        'Regressions indicate the shadow DNA produced errors or degraded responses that the baseline did not.',
      );

      if (diffSummary.improvements > 0) {
        lines.push('');
        lines.push(`Note: ${diffSummary.improvements} improvement(s) were also detected.`);
      }
    }

    return {
      title: 'Regressions',
      content: lines.join('\n'),
      severity: diffSummary.regressions > 0 ? 'high' : 'info',
    };
  }

  private buildAlertsSection(alerts: Alert[]): ReportSection {
    const lines: string[] = [];
    lines.push(`**${alerts.length} active alert(s) at time of report.**`);
    lines.push('');
    lines.push('| Alert | Severity | Type | Drift |');
    lines.push('|-------|----------|------|-------|');
    for (const alert of alerts.slice(0, 20)) {
      lines.push(
        `| ${alert.summary.slice(0, 60)} | ${alert.severity} | ${alert.type} | ${alert.driftScore} |`,
      );
    }

    return {
      title: 'Active Alerts',
      content: lines.join('\n'),
      severity: alerts.some((a) => a.severity === 'critical') ? 'critical' : 'high',
    };
  }

  private buildDiffDetailsSection(results: DiffResult[]): ReportSection {
    const lines: string[] = [];
    const limited = results.slice(0, this.config.maxDiffDetails);

    for (const result of limited) {
      lines.push(`### Pair ${result.captureId.slice(0, 8)}`);
      lines.push(`- Drift: ${result.driftScore}/100 | Severity: ${result.overallSeverity}`);
      lines.push(`- Status match: ${result.statusCodeMatch ? 'yes' : 'no'}`);
      lines.push(`- Latency ratio: ${result.latencyRatio}x`);

      if (result.findings.length > 0) {
        lines.push(`- Findings:`);
        for (const f of result.findings.slice(0, 5)) {
          lines.push(`  - [${f.severity}] ${f.description}`);
        }
      }
      lines.push('');
    }

    return {
      title: 'Diff Details',
      content: lines.join('\n'),
      severity: 'info',
    };
  }

  private buildRecommendationSection(diffSummary: DiffAnalysisSummary): ReportSection {
    const rec = diffSummary.recommendation;
    const lines: string[] = [];

    switch (rec) {
      case 'proceed':
        lines.push('**Recommendation: PROCEED**');
        lines.push('');
        lines.push(
          'Shadow DNA validation passed. The new DNA produces responses that are sufficiently similar to the baseline.',
        );
        lines.push('Safe to promote to production.');
        break;

      case 'investigate':
        lines.push('**Recommendation: INVESTIGATE**');
        lines.push('');
        lines.push(
          'Shadow DNA validation shows moderate drift. Review the findings before promoting.',
        );
        lines.push('Consider running a longer shadow period or reducing the sample rate.');
        break;

      case 'rollback':
        lines.push('**Recommendation: ROLLBACK**');
        lines.push('');
        lines.push(
          'Shadow DNA validation failed. The new DNA produces significantly different or degraded responses.',
        );
        lines.push(
          'Do NOT promote to production. Investigate regressions and re-run shadow validation.',
        );
        break;
    }

    return {
      title: 'Recommendation',
      content: lines.join('\n'),
      severity: rec === 'rollback' ? 'critical' : rec === 'investigate' ? 'medium' : 'info',
    };
  }

  // ── Confidence & Summary ─────────────────────────────────────

  private calculateConfidence(
    diffSummary: DiffAnalysisSummary,
    replayStats: ReplayStats,
    activeAlerts: Alert[],
  ): number {
    let score = 100;

    // Penalize for drift
    score -= diffSummary.meanDriftScore * 0.5;
    score -= diffSummary.p95DriftScore * 0.3;

    // Penalize for regressions
    score -= diffSummary.regressions * 15;

    // Penalize for failures
    score -= (replayStats.failed / Math.max(1, replayStats.total)) * 30;

    // Penalize for active critical alerts
    const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical');
    score -= criticalAlerts.length * 20;

    // Penalize for high-severity alerts
    const highAlerts = activeAlerts.filter((a) => a.severity === 'high');
    score -= highAlerts.length * 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private buildExecutiveSummary(
    recommendation: ShadowRecommendation,
    confidenceScore: number,
    diffSummary: DiffAnalysisSummary,
    activeAlerts: Alert[],
  ): string {
    const parts: string[] = [];

    parts.push(`Shadow validation analyzed ${diffSummary.totalPairs} traffic pairs.`);
    parts.push(
      `Mean drift score: ${diffSummary.meanDriftScore}/100 (P95: ${diffSummary.p95DriftScore}).`,
    );

    if (diffSummary.regressions > 0) {
      parts.push(`${diffSummary.regressions} regression(s) detected.`);
    }
    if (diffSummary.improvements > 0) {
      parts.push(`${diffSummary.improvements} improvement(s) detected.`);
    }
    if (activeAlerts.length > 0) {
      parts.push(`${activeAlerts.length} active alert(s).`);
    }

    parts.push(`Confidence: ${confidenceScore}%.`);

    switch (recommendation) {
      case 'proceed':
        parts.push('Recommendation: PROCEED — safe to promote.');
        break;
      case 'investigate':
        parts.push('Recommendation: INVESTIGATE — review before promoting.');
        break;
      case 'rollback':
        parts.push('Recommendation: ROLLBACK — do not promote.');
        break;
    }

    return parts.join(' ');
  }

  private getTimeRange(captures: Array<{ timestamp: string }>): { start: string; end: string } {
    if (captures.length === 0) {
      return { start: new Date().toISOString(), end: new Date().toISOString() };
    }
    const timestamps = captures.map((c) => c.timestamp).sort();
    return { start: timestamps[0], end: timestamps[timestamps.length - 1] };
  }
}
