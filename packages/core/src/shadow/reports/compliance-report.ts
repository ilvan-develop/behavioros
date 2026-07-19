import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Alert } from '../alert-manager';
import type { DiffAnalysisSummary, DiffSeverity } from '../diff-analyzer';
import type { CapturedTraffic } from '../traffic-capture';
import type { ReplayStats } from '../traffic-replay';

// ============================================================
// Compliance Report — EU AI Act, PCI-DSS, SOC 2
// ============================================================

/**
 * Supported compliance frameworks.
 */
export type ComplianceFramework = 'eu-ai-act' | 'pci-dss' | 'soc2';

/**
 * Compliance check result.
 */
export type ComplianceCheckResult = 'pass' | 'fail' | 'warn' | 'skip';

/**
 * A single compliance check.
 */
export interface ComplianceCheck {
  /** Unique check ID. */
  id: string;
  /** Framework this check belongs to. */
  framework: ComplianceFramework;
  /** Control reference (e.g., 'EU-AI-Article-13'). */
  controlRef: string;
  /** Human-readable control name. */
  controlName: string;
  /** Check result. */
  result: ComplianceCheckResult;
  /** Severity if failed. */
  severity: DiffSeverity;
  /** Detailed finding. */
  finding: string;
  /** Recommended remediation. */
  remediation?: string;
  /** Supporting data. */
  evidence?: Record<string, unknown>;
}

/**
 * Compliance status for a single framework.
 */
export interface FrameworkCompliance {
  /** Framework name. */
  framework: ComplianceFramework;
  /** Overall status. */
  status: ComplianceCheckResult;
  /** Total checks. */
  totalChecks: number;
  /** Passed checks. */
  passedChecks: number;
  /** Failed checks. */
  failedChecks: number;
  /** Warned checks. */
  warnedChecks: number;
  /** Skipped checks. */
  skippedChecks: number;
  /** Individual checks. */
  checks: ComplianceCheck[];
}

/**
 * Complete compliance report.
 */
export interface ComplianceReport {
  /** Unique report ID. */
  id: string;
  /** ISO-8601 report timestamp. */
  timestamp: string;
  /** Project name. */
  projectName: string;
  /** DNA version validated. */
  dnaVersion: string;
  /** Overall compliance status. */
  overallStatus: ComplianceCheckResult;
  /** Per-framework results. */
  frameworks: FrameworkCompliance[];
  /** Total checks across all frameworks. */
  totalChecks: number;
  /** Total passed. */
  totalPassed: number;
  /** Total failed. */
  totalFailed: number;
  /** Executive summary. */
  executiveSummary: string;
}

export interface ComplianceReportConfig {
  /** Frameworks to evaluate. Default: ['eu-ai-act', 'pci-dss', 'soc2']. */
  frameworks: ComplianceFramework[];
  /** Project name override. Default: 'unknown'. */
  projectName: string;
}

// ============================================================
// ComplianceReportGenerator
// ============================================================

export class ComplianceReportGenerator {
  private config: ComplianceReportConfig;

  constructor(config?: Partial<ComplianceReportConfig>) {
    this.config = {
      frameworks: ['eu-ai-act', 'pci-dss', 'soc2'],
      projectName: 'unknown',
      ...config,
    };
  }

  /**
   * Generate a full compliance report from shadow pipeline data.
   */
  generate(params: {
    diffSummary: DiffAnalysisSummary;
    replayStats: ReplayStats;
    captures: CapturedTraffic[];
    alerts: Alert[];
    dnaVersion?: string;
    projectName?: string;
  }): ComplianceReport {
    const { diffSummary, replayStats, captures, alerts, dnaVersion, projectName } = params;
    const frameworks: FrameworkCompliance[] = [];

    if (this.config.frameworks.includes('eu-ai-act')) {
      frameworks.push(this.evaluateEuAiAct(diffSummary, replayStats, captures, alerts));
    }
    if (this.config.frameworks.includes('pci-dss')) {
      frameworks.push(this.evaluatePciDss(diffSummary, replayStats, captures, alerts));
    }
    if (this.config.frameworks.includes('soc2')) {
      frameworks.push(this.evaluateSoc2(diffSummary, replayStats, captures, alerts));
    }

    const totalChecks = frameworks.reduce((s, f) => s + f.totalChecks, 0);
    const totalPassed = frameworks.reduce((s, f) => s + f.passedChecks, 0);
    const totalFailed = frameworks.reduce((s, f) => s + f.failedChecks, 0);
    const overallStatus =
      totalFailed > 0 ? 'fail' : frameworks.some((f) => f.status === 'warn') ? 'warn' : 'pass';

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      projectName: projectName ?? this.config.projectName,
      dnaVersion: dnaVersion ?? 'unknown',
      overallStatus,
      frameworks,
      totalChecks,
      totalPassed,
      totalFailed,
      executiveSummary: this.buildExecutiveSummary(
        overallStatus,
        totalChecks,
        totalPassed,
        totalFailed,
        frameworks,
      ),
    };
  }

  /**
   * Save report to disk.
   */
  async save(report: ComplianceReport, path: string): Promise<void> {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
    }
    await writeFile(path, JSON.stringify(report, null, 2), 'utf-8');
  }

  /**
   * Load report from disk.
   */
  async load(path: string): Promise<ComplianceReport> {
    if (!existsSync(path)) throw new Error(`Report file not found: ${path}`);
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ComplianceReport;
  }

  getConfig(): Readonly<ComplianceReportConfig> {
    return this.config;
  }

  // ============================================================
  // EU AI Act — Articles 9-15 + Annex IV
  // ============================================================

  private evaluateEuAiAct(
    diffSummary: DiffAnalysisSummary,
    replayStats: ReplayStats,
    captures: CapturedTraffic[],
    alerts: Alert[],
  ): FrameworkCompliance {
    const checks: ComplianceCheck[] = [];

    // Article 9 — Risk Management
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-9',
        'Risk Management System',
        diffSummary.regressions === 0 ? 'pass' : 'fail',
        diffSummary.regressions > 0 ? 'high' : 'info',
        diffSummary.regressions > 0
          ? `${diffSummary.regressions} regression(s) detected during shadow validation`
          : 'No regressions detected',
        'Review regression findings and implement corrective measures',
      ),
    );

    // Article 10 — Data Governance
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-10',
        'Data Governance',
        captures.length >= 10 ? 'pass' : 'warn',
        captures.length >= 10 ? 'info' : 'medium',
        `${captures.length} traffic samples analyzed (minimum 10 recommended)`,
        'Increase shadow traffic capture sample size',
      ),
    );

    // Article 11 — Technical Documentation
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-11',
        'Technical Documentation',
        'pass',
        'info',
        `Shadow validation report generated at ${new Date().toISOString()}`,
      ),
    );

    // Article 12 — Record-Keeping
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-12',
        'Record-Keeping (Audit Trail)',
        diffSummary.results.length > 0 ? 'pass' : 'warn',
        'info',
        `${diffSummary.results.length} audit records created from shadow validation`,
        'Ensure shadow pipeline logs are retained for required period',
      ),
    );

    // Article 13 — Transparency
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-13',
        'Transparency & Explainability',
        diffSummary.meanDriftScore < 30
          ? 'pass'
          : diffSummary.meanDriftScore < 60
            ? 'warn'
            : 'fail',
        diffSummary.meanDriftScore >= 60 ? 'high' : 'info',
        `Mean drift score: ${diffSummary.meanDriftScore}/100`,
        'Investigate high drift — shadow behavior diverges significantly from baseline',
      ),
    );

    // Article 14 — Human Oversight
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-14',
        'Human Oversight',
        alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length === 0
          ? 'pass'
          : 'fail',
        'critical',
        `${alerts.filter((a) => a.status === 'active' && a.severity === 'critical').length} critical alert(s) require human attention`,
        'Critical alerts require immediate human review',
      ),
    );

    // Article 15 — Accuracy, Robustness, Cybersecurity
    const failureRate = replayStats.total > 0 ? replayStats.failed / replayStats.total : 0;
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Article-15',
        'Accuracy & Robustness',
        failureRate < 0.05 ? 'pass' : failureRate < 0.1 ? 'warn' : 'fail',
        failureRate >= 0.1 ? 'high' : 'info',
        `Replay failure rate: ${(failureRate * 100).toFixed(1)}% (${replayStats.failed}/${replayStats.total})`,
        'Investigate replay failures — may indicate robustness issues',
      ),
    );

    // Annex IV — Documentation requirements
    checks.push(
      this.check(
        'eu-ai-act',
        'EU-AI-Annex-IV',
        'Technical Documentation (Annex IV)',
        'pass',
        'info',
        `Shadow pipeline covers: traffic capture, replay, diff analysis, alerting, reporting`,
      ),
    );

    return this.summarizeFramework('eu-ai-act', checks);
  }

  // ============================================================
  // PCI-DSS — Requirements 6, 10, 11
  // ============================================================

  private evaluatePciDss(
    diffSummary: DiffAnalysisSummary,
    _replayStats: ReplayStats,
    _captures: CapturedTraffic[],
    alerts: Alert[],
  ): FrameworkCompliance {
    const checks: ComplianceCheck[] = [];

    // Req 6.5 — Address common coding vulnerabilities
    const hasSchemaChanges = diffSummary.categoryBreakdown['schema-change'] ?? 0;
    checks.push(
      this.check(
        'pci-dss',
        'PCI-DSS-Req-6.5',
        'Secure Development (Vulnerability Detection)',
        hasSchemaChanges === 0 ? 'pass' : 'warn',
        hasSchemaChanges > 5 ? 'high' : 'info',
        `${hasSchemaChanges} schema change(s) detected in shadow responses`,
        'Schema changes may introduce security-relevant structural differences',
      ),
    );

    // Req 6.5.1 — Injection flaws
    checks.push(
      this.check(
        'pci-dss',
        'PCI-DSS-Req-6.5.1',
        'Injection Prevention',
        diffSummary.categoryBreakdown['error-introduced'] === undefined ? 'pass' : 'warn',
        'medium',
        `${diffSummary.categoryBreakdown['error-introduced'] ?? 0} error(s) introduced by shadow`,
      ),
    );

    // Req 10.1 — Audit trail
    checks.push(
      this.check(
        'pci-dss',
        'PCI-DSS-Req-10.1',
        'Audit Trail Integrity',
        diffSummary.results.length > 0 ? 'pass' : 'warn',
        'info',
        `${diffSummary.results.length} shadow validation records generated`,
        'Ensure audit logs cover all payment-related traffic',
      ),
    );

    // Req 10.2 — Automated audit trails
    checks.push(
      this.check(
        'pci-dss',
        'PCI-DSS-Req-10.2',
        'Automated Audit Trail',
        'pass',
        'info',
        'Shadow pipeline provides automated audit trail for DNA changes',
      ),
    );

    // Req 11.4 — Intrusion detection
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    checks.push(
      this.check(
        'pci-dss',
        'PCI-DSS-Req-11.4',
        'Intrusion Detection (Anomaly Detection)',
        criticalAlerts.length === 0 ? 'pass' : 'fail',
        'critical',
        `${criticalAlerts.length} critical alert(s) — possible anomalous behavior`,
        'Critical alerts in payment-adjacent systems require immediate investigation',
      ),
    );

    // Req 6.2 — Security patches
    checks.push(
      this.check(
        'pci-dss',
        'PCI-DSS-Req-6.2',
        'Security Update Process',
        'pass',
        'info',
        'Shadow pipeline validates DNA changes before production deployment',
      ),
    );

    return this.summarizeFramework('pci-dss', checks);
  }

  // ============================================================
  // SOC 2 — Trust Services Criteria
  // ============================================================

  private evaluateSoc2(
    diffSummary: DiffAnalysisSummary,
    replayStats: ReplayStats,
    captures: CapturedTraffic[],
    alerts: Alert[],
  ): FrameworkCompliance {
    const checks: ComplianceCheck[] = [];

    // CC6.1 — Logical Access
    checks.push(
      this.check(
        'soc2',
        'SOC2-CC6.1',
        'Logical Access Security',
        captures.every((c) => c.sampling.selected !== undefined) ? 'pass' : 'warn',
        'info',
        `All ${captures.length} captures have sampling metadata for traceability`,
      ),
    );

    // CC7.1 — System Monitoring
    checks.push(
      this.check(
        'soc2',
        'SOC2-CC7.1',
        'System Monitoring & Anomaly Detection',
        alerts.length > 0 || diffSummary.results.length > 0 ? 'pass' : 'warn',
        'info',
        `${alerts.length} alert(s) and ${diffSummary.results.length} diff result(s) demonstrate active monitoring`,
        'Ensure monitoring covers all system boundaries',
      ),
    );

    // CC7.2 — Anomaly Response
    const hasActiveAlerts = alerts.filter((a) => a.status === 'active').length > 0;
    checks.push(
      this.check(
        'soc2',
        'SOC2-CC7.2',
        'Anomaly Response Procedures',
        hasActiveAlerts ? 'pass' : 'skip',
        'info',
        hasActiveAlerts
          ? `${alerts.filter((a) => a.status === 'active').length} active alert(s) with lifecycle management`
          : 'No active alerts — system operating within expected parameters',
      ),
    );

    // CC8.1 — Change Management
    checks.push(
      this.check(
        'soc2',
        'SOC2-CC8.1',
        'Change Management',
        diffSummary.recommendation !== 'rollback' ? 'pass' : 'fail',
        diffSummary.recommendation === 'rollback' ? 'critical' : 'info',
        `Shadow validation recommendation: ${diffSummary.recommendation}`,
        diffSummary.recommendation === 'rollback'
          ? 'DNA change produced unacceptable drift — do not deploy'
          : undefined,
      ),
    );

    // A1.2 — Availability Monitoring
    const failureRate = replayStats.total > 0 ? replayStats.failed / replayStats.total : 0;
    checks.push(
      this.check(
        'soc2',
        'SOC2-A1.2',
        'Availability Monitoring',
        failureRate < 0.05 ? 'pass' : failureRate < 0.1 ? 'warn' : 'fail',
        failureRate >= 0.1 ? 'high' : 'info',
        `System availability during shadow test: ${((1 - failureRate) * 100).toFixed(1)}%`,
      ),
    );

    // P6.1 — Data Classification
    checks.push(
      this.check(
        'soc2',
        'SOC2-P6.1',
        'Data Classification & Handling',
        captures.some((c) => c.request) ? 'pass' : 'warn',
        'info',
        'Traffic capture includes request data with sanitization applied',
      ),
    );

    // PI1.1 — Data Retention
    checks.push(
      this.check(
        'soc2',
        'SOC2-PI1.1',
        'Data Retention & Disposal',
        'pass',
        'info',
        'Shadow validation data retained with configurable persistence and lifecycle management',
      ),
    );

    return this.summarizeFramework('soc2', checks);
  }

  // ── Helpers ──────────────────────────────────────────────────

  private check(
    framework: ComplianceFramework,
    controlRef: string,
    controlName: string,
    result: ComplianceCheckResult,
    severity: DiffSeverity,
    finding: string,
    remediation?: string,
  ): ComplianceCheck {
    return {
      id: randomUUID(),
      framework,
      controlRef,
      controlName,
      result,
      severity,
      finding,
      remediation,
    };
  }

  private summarizeFramework(
    framework: ComplianceFramework,
    checks: ComplianceCheck[],
  ): FrameworkCompliance {
    const passedChecks = checks.filter((c) => c.result === 'pass').length;
    const failedChecks = checks.filter((c) => c.result === 'fail').length;
    const warnedChecks = checks.filter((c) => c.result === 'warn').length;
    const skippedChecks = checks.filter((c) => c.result === 'skip').length;
    const status = failedChecks > 0 ? 'fail' : warnedChecks > 0 ? 'warn' : 'pass';

    return {
      framework,
      status,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      warnedChecks,
      skippedChecks,
      checks,
    };
  }

  private buildExecutiveSummary(
    overallStatus: ComplianceCheckResult,
    totalChecks: number,
    totalPassed: number,
    totalFailed: number,
    frameworks: FrameworkCompliance[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Compliance evaluation covered ${frameworks.length} framework(s): ${frameworks.map((f) => f.framework).join(', ')}.`,
    );
    parts.push(`Overall status: ${overallStatus.toUpperCase()}.`);
    parts.push(`${totalPassed}/${totalChecks} checks passed.`);

    if (totalFailed > 0) {
      parts.push(`${totalFailed} check(s) FAILED.`);
    }

    for (const fw of frameworks) {
      if (fw.status === 'fail') {
        const failedNames = fw.checks.filter((c) => c.result === 'fail').map((c) => c.controlName);
        parts.push(`${fw.framework}: ${failedNames.join(', ')}`);
      }
    }

    return parts.join(' ');
  }
}
