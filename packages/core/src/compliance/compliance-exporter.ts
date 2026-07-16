import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { EUAIActAssessment, EUSRiskClassificationInput } from './eu-ai-act';
import { EUAIActAssessor } from './eu-ai-act';
import type { PCIAssessment, PCIAssessmentInput } from './pci-dss';
import { PCIDSSAssessor } from './pci-dss';
import type { SOC2Assessment, SOC2AssessmentInput } from './soc2';
import { SOC2Assessor } from './soc2';

// ============================================================
// ComplianceExporter — Multi-format regulatory report generator
// ============================================================

/**
 * Supported export output formats.
 */
export type ComplianceExportFormat = 'json' | 'markdown' | 'csv';

/**
 * Supported compliance frameworks.
 */
export type ComplianceFramework = 'eu-ai-act' | 'pci-dss' | 'soc2';

/**
 * Audit chain hash entry for verification.
 */
export interface AuditChainEntry {
  /** Audit step name (e.g., 'lint', 'typecheck', 'security'). */
  step: string;
  /** SHA-256 hash of the step output. */
  hash: string;
  /** ISO-8601 timestamp of the entry. */
  timestamp: string;
  /** Whether the step passed. */
  passed: boolean;
}

/**
 * Audit chain verification status.
 */
export interface AuditChainVerification {
  /** Whether the full chain is intact (all hashes link sequentially). */
  chainIntact: boolean;
  /** Total entries in the chain. */
  totalEntries: number;
  /** Number of verified entries. */
  verifiedEntries: number;
  /** Number of broken links. */
  brokenLinks: number;
  /** The computed chain hash (hash of all concatenated hashes). */
  chainHash: string;
  /** Individual verification results. */
  entries: AuditChainEntry[];
}

/**
 * Summary statistics across all frameworks.
 */
export interface ComplianceSummaryStatistics {
  /** Total checks across all frameworks. */
  totalChecks: number;
  /** Total passed checks. */
  totalPassed: number;
  /** Total failed checks. */
  totalFailed: number;
  /** Total warned checks. */
  totalWarned: number;
  /** Total skipped/na checks. */
  totalSkipped: number;
  /** Overall compliance score (0-100). */
  overallScore: number;
  /** Per-framework scores. */
  frameworkScores: Record<ComplianceFramework, number>;
  /** Total recommendations. */
  totalRecommendations: number;
  /** Critical gaps (mandatory failed checks). */
  criticalGaps: number;
  /** Risk level if EU AI Act is assessed. */
  euRiskLevel?: string;
}

/**
 * Complete compliance export report.
 */
export interface ComplianceExportReport {
  /** Unique report ID. */
  id: string;
  /** ISO-8601 report generation timestamp. */
  timestamp: string;
  /** Project name. */
  projectName: string;
  /** DNA version (optional). */
  dnaVersion?: string;
  /** Frameworks included in the report. */
  frameworks: ComplianceFramework[];
  /** EU AI Act assessment (if included). */
  euAiAct?: EUAIActAssessment;
  /** PCI-DSS assessment (if included). */
  pciDss?: PCIAssessment;
  /** SOC 2 assessment (if included). */
  soc2?: SOC2Assessment;
  /** Aggregated summary statistics. */
  summary: ComplianceSummaryStatistics;
  /** Audit chain verification status. */
  auditChain: AuditChainVerification;
  /** All recommendations consolidated. */
  recommendations: string[];
}

/**
 * Configuration for ComplianceExporter.
 */
export interface ComplianceExporterConfig {
  /** Frameworks to include. Default: all three. */
  frameworks: ComplianceFramework[];
  /** Project name. */
  projectName: string;
  /** DNA version. */
  dnaVersion?: string;
}

// ============================================================
// ComplianceExporter
// ============================================================

export class ComplianceExporter {
  private config: ComplianceExporterConfig;

  constructor(config?: Partial<ComplianceExporterConfig>) {
    this.config = {
      frameworks: ['eu-ai-act', 'pci-dss', 'soc2'],
      projectName: 'unknown',
      ...config,
    };
  }

  /**
   * Generate a full compliance export report from system state.
   */
  generate(params: {
    euRiskInput?: EUSRiskClassificationInput;
    pciInput?: PCIAssessmentInput;
    soc2Input?: SOC2AssessmentInput;
    auditTrailEntries?: number;
    hasGovernance?: boolean;
    hasQualityGates?: boolean;
    hasShadowPipeline?: boolean;
    hasLearningSystem?: boolean;
    activeAlerts?: number;
    criticalAlerts?: number;
    driftScore?: number;
    testCoverage?: number;
    hasDocumentation?: boolean;
    hasDataGovernance?: boolean;
    totalAgents?: number;
    auditChain?: AuditChainEntry[];
    dnaVersion?: string;
  }): ComplianceExportReport {
    let euAiAct: EUAIActAssessment | undefined;
    let pciDss: PCIAssessment | undefined;
    let soc2: SOC2Assessment | undefined;

    if (this.config.frameworks.includes('eu-ai-act') && params.euRiskInput) {
      const assessor = new EUAIActAssessor(this.config.projectName);
      euAiAct = assessor.assess({
        riskInput: params.euRiskInput,
        auditTrailEntries: params.auditTrailEntries,
        hasGovernance: params.hasGovernance,
        hasQualityGates: params.hasQualityGates,
        hasLearningSystem: params.hasLearningSystem,
        hasShadowPipeline: params.hasShadowPipeline,
        totalAgents: params.totalAgents,
        activeAlerts: params.activeAlerts,
        criticalAlerts: params.criticalAlerts,
        driftScore: params.driftScore,
        testCoverage: params.testCoverage,
        hasDocumentation: params.hasDocumentation,
        hasDataGovernance: params.hasDataGovernance,
      });
    }

    if (this.config.frameworks.includes('pci-dss') && params.pciInput) {
      const assessor = new PCIDSSAssessor(this.config.projectName);
      pciDss = assessor.assess({
        input: params.pciInput,
        auditTrailEntries: params.auditTrailEntries,
        hasGovernance: params.hasGovernance,
        hasQualityGates: params.hasQualityGates,
        hasShadowPipeline: params.hasShadowPipeline,
        hasLearningSystem: params.hasLearningSystem,
        activeAlerts: params.activeAlerts,
        criticalAlerts: params.criticalAlerts,
      });
    }

    if (this.config.frameworks.includes('soc2') && params.soc2Input) {
      const assessor = new SOC2Assessor(this.config.projectName);
      soc2 = assessor.assess({
        input: params.soc2Input,
        auditTrailEntries: params.auditTrailEntries,
        hasGovernance: params.hasGovernance,
        hasQualityGates: params.hasQualityGates,
        hasShadowPipeline: params.hasShadowPipeline,
        hasLearningSystem: params.hasLearningSystem,
        activeAlerts: params.activeAlerts,
        criticalAlerts: params.criticalAlerts,
        testCoverage: params.testCoverage,
        totalAgents: params.totalAgents,
      });
    }

    const summary = this.buildSummary(euAiAct, pciDss, soc2);
    const auditChain = this.verifyAuditChain(params.auditChain ?? []);
    const recommendations = this.consolidateRecommendations(euAiAct, pciDss, soc2);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      projectName: this.config.projectName,
      dnaVersion: params.dnaVersion ?? this.config.dnaVersion,
      frameworks: this.config.frameworks,
      euAiAct,
      pciDss,
      soc2,
      summary,
      auditChain,
      recommendations,
    };
  }

  /**
   * Export a compliance report to a specific format.
   */
  export(report: ComplianceExportReport, format: ComplianceExportFormat): string {
    switch (format) {
      case 'json':
        return this.exportJSON(report);
      case 'markdown':
        return this.exportMarkdown(report);
      case 'csv':
        return this.exportCSV(report);
    }
  }

  /**
   * Save a compliance report to disk in the specified format.
   */
  async save(
    report: ComplianceExportReport,
    path: string,
    format?: ComplianceExportFormat,
  ): Promise<void> {
    const ext = format ?? this.detectFormat(path);
    const content = this.export(report, ext);
    const dir = dirname(path);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(path, content, 'utf-8');
  }

  /**
   * Load a JSON compliance report from disk.
   */
  async load(path: string): Promise<ComplianceExportReport> {
    if (!existsSync(path)) throw new Error(`Report file not found: ${path}`);
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw) as ComplianceExportReport;
  }

  getConfig(): Readonly<ComplianceExporterConfig> {
    return this.config;
  }

  // ── JSON Export ───────────────────────────────────────────

  private exportJSON(report: ComplianceExportReport): string {
    return JSON.stringify(report, null, 2);
  }

  // ── Markdown Export ───────────────────────────────────────

  private exportMarkdown(report: ComplianceExportReport): string {
    const lines: string[] = [];

    lines.push(`# Compliance Report — ${report.projectName}`);
    lines.push('');
    lines.push(`**Generated:** ${report.timestamp}`);
    lines.push(`**Report ID:** ${report.id}`);
    if (report.dnaVersion) lines.push(`**DNA Version:** ${report.dnaVersion}`);
    lines.push(`**Frameworks:** ${report.frameworks.join(', ')}`);
    lines.push('');

    lines.push('## Executive Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Overall Score | ${report.summary.overallScore}% |`);
    lines.push(`| Total Checks | ${report.summary.totalChecks} |`);
    lines.push(`| Passed | ${report.summary.totalPassed} |`);
    lines.push(`| Failed | ${report.summary.totalFailed} |`);
    lines.push(`| Warnings | ${report.summary.totalWarned} |`);
    lines.push(`| Critical Gaps | ${report.summary.criticalGaps} |`);
    lines.push('');

    lines.push('### Framework Scores');
    lines.push('');
    lines.push(`| Framework | Score |`);
    lines.push(`|-----------|-------|`);
    for (const [fw, score] of Object.entries(report.summary.frameworkScores)) {
      lines.push(`| ${fw} | ${score}% |`);
    }
    lines.push('');

    if (report.euAiAct) {
      lines.push('## EU AI Act Assessment');
      lines.push('');
      lines.push(`**Risk Level:** ${report.euAiAct.riskLevel}`);
      lines.push(`**Compliance Score:** ${report.euAiAct.complianceScore}%`);
      lines.push(`**Checks:** ${report.euAiAct.passedChecks}/${report.euAiAct.totalChecks} passed`);
      lines.push('');
      lines.push('### Checklist Status');
      lines.push('');
      lines.push('#### Transparency Requirements');
      for (const [key, value] of Object.entries(report.euAiAct.transparencyRequirements)) {
        lines.push(`- [${value ? 'x' : ' '}] ${key}`);
      }
      lines.push('');
      lines.push('#### Human Oversight Requirements');
      for (const [key, value] of Object.entries(report.euAiAct.humanOversightRequirements)) {
        lines.push(`- [${value ? 'x' : ' '}] ${key}`);
      }
      lines.push('');
      lines.push('#### Data Governance Requirements');
      for (const [key, value] of Object.entries(report.euAiAct.dataGovernanceRequirements)) {
        lines.push(`- [${value ? 'x' : ' '}] ${key}`);
      }
      lines.push('');
      lines.push('#### Technical Documentation Requirements');
      for (const [key, value] of Object.entries(report.euAiAct.technicalDocRequirements)) {
        lines.push(`- [${value ? 'x' : ' '}] ${key}`);
      }
      lines.push('');
    }

    if (report.pciDss) {
      lines.push('## PCI-DSS Assessment');
      lines.push('');
      lines.push(`**Compliance Score:** ${report.pciDss.complianceScore}%`);
      lines.push(`**Checks:** ${report.pciDss.passedChecks}/${report.pciDss.totalChecks} passed`);
      lines.push('');
      lines.push('### Failed Checks');
      for (const check of report.pciDss.checks) {
        if (check.result === 'fail') {
          lines.push(
            `- **[Req ${check.requirementNumber}]** ${check.requirementName}: ${check.finding}`,
          );
          if (check.remediation) lines.push(`  - *Remediation:* ${check.remediation}`);
        }
      }
      lines.push('');
    }

    if (report.soc2) {
      lines.push('## SOC 2 Assessment');
      lines.push('');
      lines.push(`**Compliance Score:** ${report.soc2.complianceScore}%`);
      lines.push(`**Checks:** ${report.soc2.passedChecks}/${report.soc2.totalChecks} passed`);
      lines.push('');
      lines.push('### Control Mappings');
      for (const mapping of report.soc2.controlMappings) {
        lines.push(
          `- **${mapping.criteria}**: ${mapping.implemented}/${mapping.total} controls (${mapping.score}%)`,
        );
      }
      lines.push('');
      if (report.soc2.gapAnalysis.length > 0) {
        lines.push('### Gap Analysis');
        for (const gap of report.soc2.gapAnalysis) {
          lines.push(`- **[${gap.severity.toUpperCase()}]** ${gap.title}: ${gap.remediation}`);
        }
        lines.push('');
      }
    }

    lines.push('## Audit Chain Verification');
    lines.push('');
    lines.push(`- Chain intact: ${report.auditChain.chainIntact ? 'Yes' : 'No'}`);
    lines.push(
      `- Verified entries: ${report.auditChain.verifiedEntries}/${report.auditChain.totalEntries}`,
    );
    lines.push(`- Broken links: ${report.auditChain.brokenLinks}`);
    lines.push(`- Chain hash: \`${report.auditChain.chainHash}\``);
    lines.push('');

    if (report.recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      for (let i = 0; i < report.recommendations.length; i++) {
        lines.push(`${i + 1}. ${report.recommendations[i]}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ── CSV Export ────────────────────────────────────────────

  private exportCSV(report: ComplianceExportReport): string {
    const rows: string[] = [];

    rows.push('Framework,Control ID,Control Name,Result,Score,Category,Remediation');

    if (report.euAiAct) {
      for (const check of report.euAiAct.checks) {
        rows.push(
          [
            'eu-ai-act',
            check.article,
            this.csvEscape(check.title),
            check.result,
            check.score,
            check.category,
            this.csvEscape(check.remediation ?? ''),
          ].join(','),
        );
      }
    }

    if (report.pciDss) {
      for (const check of report.pciDss.checks) {
        rows.push(
          [
            'pci-dss',
            check.requirementNumber,
            this.csvEscape(check.requirementName),
            check.result,
            check.score,
            check.category,
            this.csvEscape(check.remediation ?? ''),
          ].join(','),
        );
      }
    }

    if (report.soc2) {
      for (const check of report.soc2.checks) {
        rows.push(
          [
            'soc2',
            check.controlRef,
            this.csvEscape(check.title),
            check.result,
            check.score,
            check.trustService,
            this.csvEscape(check.remediation ?? ''),
          ].join(','),
        );
      }
    }

    return rows.join('\n');
  }

  // ── Audit Chain Verification ──────────────────────────────

  private verifyAuditChain(entries: AuditChainEntry[]): AuditChainVerification {
    if (entries.length === 0) {
      return {
        chainIntact: false,
        totalEntries: 0,
        verifiedEntries: 0,
        brokenLinks: 0,
        chainHash: '',
        entries: [],
      };
    }

    let brokenLinks = 0;

    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (!prev || !curr) {
        brokenLinks++;
        continue;
      }
      if (!prev.passed) {
        brokenLinks++;
      }
    }

    const chainHash = entries.map((e) => e.hash).reduce((acc, h) => this.sha256(acc + h), '');

    return {
      chainIntact: brokenLinks === 0,
      totalEntries: entries.length,
      verifiedEntries: entries.filter((e) => e.passed).length,
      brokenLinks,
      chainHash,
      entries,
    };
  }

  // ── Summary Statistics ────────────────────────────────────

  private buildSummary(
    euAiAct?: EUAIActAssessment,
    pciDss?: PCIAssessment,
    soc2?: SOC2Assessment,
  ): ComplianceSummaryStatistics {
    const frameworkScores: Record<string, number> = {};

    let totalChecks = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalWarned = 0;
    let totalSkipped = 0;
    let totalRecommendations = 0;
    let criticalGaps = 0;

    if (euAiAct) {
      totalChecks += euAiAct.totalChecks;
      totalPassed += euAiAct.passedChecks;
      totalFailed += euAiAct.failedChecks;
      totalSkipped += euAiAct.checks.filter((c) => c.result === 'skip').length;
      totalWarned += euAiAct.checks.filter((c) => c.result === 'warn').length;
      totalRecommendations += euAiAct.recommendations.length;
      criticalGaps += euAiAct.checks.filter((c) => c.result === 'fail' && c.mandatory).length;
      frameworkScores['eu-ai-act'] = euAiAct.complianceScore;
    }

    if (pciDss) {
      totalChecks += pciDss.totalChecks;
      totalPassed += pciDss.passedChecks;
      totalFailed += pciDss.failedChecks;
      totalSkipped += pciDss.checks.filter((c) => c.result === 'na').length;
      totalWarned += pciDss.checks.filter((c) => c.result === 'warn').length;
      totalRecommendations += pciDss.recommendations.length;
      criticalGaps += pciDss.checks.filter((c) => c.result === 'fail' && c.mandatory).length;
      frameworkScores['pci-dss'] = pciDss.complianceScore;
    }

    if (soc2) {
      totalChecks += soc2.totalChecks;
      totalPassed += soc2.passedChecks;
      totalFailed += soc2.failedChecks;
      totalSkipped += soc2.checks.filter((c) => c.result === 'partial').length;
      totalWarned += soc2.checks.filter((c) => c.result === 'warn').length;
      totalRecommendations += soc2.recommendations.length;
      criticalGaps += soc2.checks.filter((c) => c.result === 'fail' && c.mandatory).length;
      frameworkScores['soc2'] = soc2.complianceScore;
    }

    const scores = Object.values(frameworkScores);
    const overallScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    return {
      totalChecks,
      totalPassed,
      totalFailed,
      totalWarned,
      totalSkipped,
      overallScore,
      frameworkScores: frameworkScores as Record<ComplianceFramework, number>,
      totalRecommendations,
      criticalGaps,
      euRiskLevel: euAiAct?.riskLevel,
    };
  }

  // ── Recommendations Consolidation ─────────────────────────

  private consolidateRecommendations(
    euAiAct?: EUAIActAssessment,
    pciDss?: PCIAssessment,
    soc2?: SOC2Assessment,
  ): string[] {
    const all: string[] = [];

    if (euAiAct) all.push(...euAiAct.recommendations);
    if (pciDss) all.push(...pciDss.recommendations);
    if (soc2) all.push(...soc2.recommendations);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const rec of all) {
      if (!seen.has(rec)) {
        seen.add(rec);
        unique.push(rec);
      }
    }

    return unique;
  }

  // ── Helpers ───────────────────────────────────────────────

  private detectFormat(path: string): ComplianceExportFormat {
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.csv')) return 'csv';
    return 'json';
  }

  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private sha256(input: string): string {
    const { createHash } = require('node:crypto') as typeof import('node:crypto');
    return createHash('sha256').update(input).digest('hex');
  }
}
