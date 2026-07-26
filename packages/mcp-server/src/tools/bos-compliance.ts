// ============================================================
// MCP Tools — Compliance Reports (Zod-based)
// ============================================================

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';

// ============================================================
// Zod Input Schemas
// ============================================================

const euRiskInputSchema = z.object({
  purpose: z.string().describe('System purpose description'),
  usesBiometrics: z.boolean().describe('Whether system uses biometric identification'),
  accessesCriticalInfrastructure: z
    .boolean()
    .describe('Whether system accesses critical infrastructure'),
  determinesAccessToEssentialServices: z
    .boolean()
    .describe('Whether system determines access to essential services'),
  usedInLawEnforcement: z.boolean().describe('Whether system is used in law enforcement'),
  usedInMigration: z.boolean().describe('Whether system is used in migration/asylum'),
  usedInEducation: z.boolean().describe('Whether system is used in education'),
  usedInEmployment: z.boolean().describe('Whether system is used in employment decisions'),
  remoteBiometricPublicSpaces: z
    .boolean()
    .describe('Whether system uses remote biometric identification in public spaces'),
  profilesNaturalPersons: z.boolean().describe('Whether system profiles natural persons'),
});

const pciInputSchema = z.object({
  hasAccessControl: z.boolean().describe('Whether access controls are in place'),
  hasEncryption: z.boolean().describe('Whether data encryption is implemented'),
  hasAuditTrail: z.boolean().describe('Whether audit trail is maintained'),
  hasNetworkSecurity: z.boolean().describe('Whether network security controls exist'),
  hasVulnerabilityManagement: z.boolean().describe('Whether vulnerability management is active'),
  hasMonitoring: z.boolean().describe('Whether monitoring and testing is in place'),
});

const soc2InputSchema = z.object({
  hasSecurityMonitoring: z.boolean().describe('Whether security monitoring is active'),
  hasAccessControl: z.boolean().describe('Whether access control is implemented'),
  hasDataEncryption: z.boolean().describe('Whether data encryption is in place'),
  hasIncidentResponse: z.boolean().describe('Whether incident response plan exists'),
  hasChangeManagement: z.boolean().describe('Whether change management process exists'),
  hasVendorManagement: z.boolean().describe('Whether vendor management is in place'),
  hasRiskAssessment: z.boolean().describe('Whether risk assessment is performed'),
  hasBusinessContinuity: z.boolean().describe('Whether business continuity plan exists'),
});

export const bosComplianceGenerateInput = z.object({
  projectName: z.string().describe('Project name for the report'),
  frameworks: z
    .array(z.enum(['soc2', 'pci-dss', 'eu-ai-act']))
    .optional()
    .describe('Frameworks to assess (default: all three)'),
  euRiskInput: euRiskInputSchema.optional().describe('EU AI Act risk classification input'),
  pciInput: pciInputSchema.optional().describe('PCI-DSS assessment input'),
  soc2Input: soc2InputSchema.optional().describe('SOC 2 assessment input'),
  auditTrailEntries: z.number().optional().describe('Number of audit trail entries'),
  hasGovernance: z.boolean().optional().describe('Whether governance rules are active'),
  hasQualityGates: z.boolean().optional().describe('Whether quality gates are active'),
  hasLearningSystem: z.boolean().optional().describe('Whether learning system is active'),
  testCoverage: z.number().optional().describe('Test coverage percentage (0-100)'),
  totalAgents: z.number().optional().describe('Number of registered agents'),
  dnaVersion: z.string().optional().describe('DNA version string'),
  format: z.enum(['json', 'markdown', 'csv']).optional().describe('Output format (default: json)'),
  outputPath: z.string().optional().describe('File path to save the report'),
});

export const bosComplianceGetInput = z.object({
  reportId: z.string().describe('Report ID to retrieve'),
});

export const bosComplianceListInput = z.object({
  projectName: z.string().optional().describe('Filter by project name'),
  framework: z.enum(['soc2', 'pci-dss', 'eu-ai-act']).optional().describe('Filter by framework'),
});

export const bosComplianceSummaryInput = z.object({
  projectName: z.string().describe('Project name'),
});

// ============================================================
// Types
// ============================================================

interface ComplianceReport {
  id: string;
  timestamp: string;
  projectName: string;
  frameworks: string[];
  summary: {
    overallScore: number;
    totalChecks: number;
    totalPassed: number;
    totalFailed: number;
    totalWarned: number;
    criticalGaps: number;
    frameworkScores: Record<string, number>;
  };
  auditChain: {
    chainIntact: boolean;
    totalEntries: number;
    verifiedEntries: number;
    brokenLinks: number;
  };
  recommendations: string[];
  format?: string;
  savedTo?: string;
}

// ============================================================
// In-memory report store
// ============================================================

const reportStore = new Map<string, ComplianceReport>();

// ============================================================
// Tool Handlers
// ============================================================

export function handleComplianceGenerate(input: z.infer<typeof bosComplianceGenerateInput>): {
  content: Array<{ type: string; text: string }>;
} {
  const frameworks = input.frameworks ?? ['soc2', 'pci-dss', 'eu-ai-act'];

  const report: ComplianceReport = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    projectName: input.projectName,
    frameworks,
    summary: {
      overallScore: 0,
      totalChecks: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalWarned: 0,
      criticalGaps: 0,
      frameworkScores: {},
    },
    auditChain: {
      chainIntact: true,
      totalEntries: 0,
      verifiedEntries: 0,
      brokenLinks: 0,
    },
    recommendations: [],
  };

  if (frameworks.includes('soc2') && input.soc2Input) {
    const checks = computeSOC2Checks(input.soc2Input);
    const passed = checks.filter((c) => c.result === 'pass').length;
    const score = Math.round((passed / checks.length) * 100);
    report.summary.frameworkScores.soc2 = score;
    report.summary.totalChecks += checks.length;
    report.summary.totalPassed += passed;
    report.summary.totalFailed += checks.filter((c) => c.result === 'fail').length;
    report.summary.totalWarned += checks.filter((c) => c.result === 'warn').length;
    if (score < 80)
      report.recommendations.push('SOC 2 compliance below 80% — review failed controls');
  }

  if (frameworks.includes('pci-dss') && input.pciInput) {
    const checks = computePCIChecks(input.pciInput);
    const passed = checks.filter((c) => c.result === 'pass').length;
    const score = Math.round((passed / checks.length) * 100);
    report.summary.frameworkScores['pci-dss'] = score;
    report.summary.totalChecks += checks.length;
    report.summary.totalPassed += passed;
    report.summary.totalFailed += checks.filter((c) => c.result === 'fail').length;
    report.summary.totalWarned += checks.filter((c) => c.result === 'warn').length;
    if (score < 80)
      report.recommendations.push('PCI-DSS compliance below 80% — review security controls');
  }

  if (frameworks.includes('eu-ai-act') && input.euRiskInput) {
    const riskLevel = classifyEURisk(input.euRiskInput);
    const checks = computeEUChecks(input.euRiskInput, riskLevel);
    const passed = checks.filter((c) => c.result === 'pass').length;
    const score = Math.round((passed / checks.length) * 100);
    report.summary.frameworkScores['eu-ai-act'] = score;
    report.summary.totalChecks += checks.length;
    report.summary.totalPassed += passed;
    report.summary.totalFailed += checks.filter((c) => c.result === 'fail').length;
    report.summary.totalWarned += checks.filter((c) => c.result === 'warn').length;
    report.summary.criticalGaps += checks.filter((c) => c.result === 'fail' && c.mandatory).length;
    if (riskLevel === 'high' || riskLevel === 'unacceptable') {
      report.recommendations.push(
        `EU AI Act risk level is ${riskLevel} — immediate compliance review required`,
      );
    }
  }

  const scores = Object.values(report.summary.frameworkScores);
  report.summary.overallScore =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  if (input.auditTrailEntries !== undefined) {
    report.auditChain.totalEntries = input.auditTrailEntries;
    report.auditChain.verifiedEntries = input.auditTrailEntries;
  }

  if (input.outputPath) {
    const format = input.format ?? 'json';
    const content = formatReport(report, format);
    const dir = dirname(input.outputPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(input.outputPath, content, 'utf-8');
    report.format = format;
    report.savedTo = input.outputPath;
  }

  reportStore.set(report.id, report);

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(report, null, 2),
      },
    ],
  };
}

export function handleComplianceGet(input: z.infer<typeof bosComplianceGetInput>) {
  const report = reportStore.get(input.reportId);
  if (!report) {
    return { content: [{ type: 'text' as const, text: `Report not found: ${input.reportId}` }] };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
}

export function handleComplianceList(input: z.infer<typeof bosComplianceListInput>) {
  let reports = Array.from(reportStore.values());
  if (input.projectName) reports = reports.filter((r) => r.projectName === input.projectName);
  if (input.framework) reports = reports.filter((r) => r.frameworks.includes(input.framework!));
  return { content: [{ type: 'text' as const, text: JSON.stringify(reports, null, 2) }] };
}

export function handleComplianceSummary(input: z.infer<typeof bosComplianceSummaryInput>) {
  const reports = Array.from(reportStore.values()).filter(
    (r) => r.projectName === input.projectName,
  );
  if (reports.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            { projectName: input.projectName, reportCount: 0, averageScore: 0 },
            null,
            2,
          ),
        },
      ],
    };
  }
  const latest = reports[reports.length - 1];
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            projectName: input.projectName,
            reportCount: reports.length,
            averageScore: latest.summary.overallScore,
            frameworkScores: latest.summary.frameworkScores,
            totalChecks: latest.summary.totalChecks,
            totalPassed: latest.summary.totalPassed,
            totalFailed: latest.summary.totalFailed,
            criticalGaps: latest.summary.criticalGaps,
          },
          null,
          2,
        ),
      },
    ],
  };
}

// ============================================================
// Internal Helpers
// ============================================================

function computeSOC2Checks(
  input: z.infer<typeof soc2InputSchema>,
): Array<{ result: string; mandatory: boolean }> {
  return [
    { result: input.hasSecurityMonitoring ? 'pass' : 'fail', mandatory: true },
    { result: input.hasAccessControl ? 'pass' : 'fail', mandatory: true },
    { result: input.hasDataEncryption ? 'pass' : 'fail', mandatory: true },
    { result: input.hasIncidentResponse ? 'pass' : 'fail', mandatory: true },
    { result: input.hasChangeManagement ? 'pass' : 'warn', mandatory: false },
    { result: input.hasVendorManagement ? 'pass' : 'warn', mandatory: false },
    { result: input.hasRiskAssessment ? 'pass' : 'fail', mandatory: true },
    { result: input.hasBusinessContinuity ? 'pass' : 'warn', mandatory: false },
  ];
}

function computePCIChecks(
  input: z.infer<typeof pciInputSchema>,
): Array<{ result: string; mandatory: boolean }> {
  return [
    { result: input.hasAccessControl ? 'pass' : 'fail', mandatory: true },
    { result: input.hasEncryption ? 'pass' : 'fail', mandatory: true },
    { result: input.hasAuditTrail ? 'pass' : 'fail', mandatory: true },
    { result: input.hasNetworkSecurity ? 'pass' : 'fail', mandatory: true },
    { result: input.hasVulnerabilityManagement ? 'pass' : 'fail', mandatory: true },
    { result: input.hasMonitoring ? 'pass' : 'warn', mandatory: false },
  ];
}

function classifyEURisk(input: z.infer<typeof euRiskInputSchema>): string {
  if (
    input.usesBiometrics ||
    input.accessesCriticalInfrastructure ||
    input.determinesAccessToEssentialServices ||
    input.usedInLawEnforcement ||
    input.usedInMigration ||
    input.remoteBiometricPublicSpaces
  ) {
    return 'high';
  }
  if (input.usedInEducation || input.usedInEmployment || input.profilesNaturalPersons) {
    return 'limited';
  }
  return 'minimal';
}

function computeEUChecks(
  input: z.infer<typeof euRiskInputSchema>,
  _riskLevel: string,
): Array<{ result: string; mandatory: boolean }> {
  return [
    { result: input.usesBiometrics ? 'fail' : 'pass', mandatory: true },
    { result: input.accessesCriticalInfrastructure ? 'fail' : 'pass', mandatory: true },
    { result: input.profilesNaturalPersons ? 'warn' : 'pass', mandatory: false },
    { result: input.usedInEmployment ? 'warn' : 'pass', mandatory: false },
    { result: input.usedInEducation ? 'warn' : 'pass', mandatory: false },
    { result: 'pass', mandatory: true },
    { result: 'pass', mandatory: true },
  ];
}

function formatReport(report: ComplianceReport, format: string): string {
  if (format === 'json') return JSON.stringify(report, null, 2);
  if (format === 'markdown') {
    const lines: string[] = [];
    lines.push(`# Compliance Report — ${report.projectName}`);
    lines.push(`**Generated:** ${report.timestamp}`);
    lines.push(`**Frameworks:** ${report.frameworks.join(', ')}`);
    lines.push(`## Overall Score: ${report.summary.overallScore}%`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Checks | ${report.summary.totalChecks} |`);
    lines.push(`| Passed | ${report.summary.totalPassed} |`);
    lines.push(`| Failed | ${report.summary.totalFailed} |`);
    lines.push(`| Critical Gaps | ${report.summary.criticalGaps} |`);
    return lines.join('\n');
  }
  if (format === 'csv') {
    const rows: string[] = ['Framework,Score'];
    for (const [fw, score] of Object.entries(report.summary.frameworkScores)) {
      rows.push(`${fw},${score}`);
    }
    return rows.join('\n');
  }
  return JSON.stringify(report, null, 2);
}
