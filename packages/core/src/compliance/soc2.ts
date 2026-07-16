import { randomUUID } from 'node:crypto';

// ============================================================
// SOC 2 — Trust Service Criteria (AICPA TSC 2017)
// ============================================================

/**
 * SOC 2 Trust Service Criteria.
 */
export type SOCTrustCriteria =
  | 'security'
  | 'availability'
  | 'processing-integrity'
  | 'confidentiality'
  | 'privacy';

/**
 * Compliance check result.
 */
export type SOC2CheckResult = 'pass' | 'fail' | 'warn' | 'partial';

/**
 * A single SOC 2 compliance check.
 */
export interface SOC2ComplianceCheck {
  id: string;
  criteria: string;
  controlRef: string;
  title: string;
  trustService: SOCTrustCriteria;
  result: SOC2CheckResult;
  score: number;
  finding: string;
  evidence?: string[];
  remediation?: string;
  mandatory: boolean;
}

/**
 * SOC 2 control mapping — maps controls to trust criteria.
 */
export interface SOC2ControlMapping {
  criteria: SOCTrustCriteria;
  controls: string[];
  implemented: number;
  total: number;
  score: number;
}

/**
 * SOC 2 gap analysis item.
 */
export interface SOC2GapItem {
  controlRef: string;
  title: string;
  trustService: SOCTrustCriteria;
  severity: 'critical' | 'high' | 'medium' | 'low';
  currentState: string;
  requiredState: string;
  remediation: string;
  estimatedEffort: string;
}

/**
 * SOC 2 assessment input.
 */
export interface SOC2AssessmentInput {
  /** Whether access controls are implemented. */
  hasAccessControls: boolean;
  /** Whether MFA is enforced. */
  hasMFA: boolean;
  /** Whether audit logging is enabled. */
  hasAuditLogging: boolean;
  /** Whether monitoring/alerting is active. */
  hasMonitoring: boolean;
  /** Whether change management is enforced. */
  hasChangeManagement: boolean;
  /** Whether data encryption is used. */
  hasDataEncryption: boolean;
  /** Whether backup/recovery exists. */
  hasBackupRecovery: boolean;
  /** Whether incident response procedures exist. */
  hasIncidentResponse: boolean;
  /** Whether risk assessment is performed. */
  hasRiskAssessment: boolean;
  /** Whether vendor management exists. */
  hasVendorManagement: boolean;
  /** Whether data classification is performed. */
  hasDataClassification: boolean;
  /** Whether privacy policies exist. */
  hasPrivacyPolicies: boolean;
  /** Whether penetration testing is done. */
  hasPenetrationTesting: boolean;
  /** Whether SOC 2 audit trail is maintained. */
  hasAuditTrail: boolean;
  /** System uptime percentage. */
  uptimePercentage?: number;
  /** Data retention policy in days. */
  dataRetentionDays?: number;
}

/**
 * Complete SOC 2 assessment result.
 */
export interface SOC2Assessment {
  id: string;
  timestamp: string;
  projectName: string;
  complianceScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: SOC2ComplianceCheck[];
  controlMappings: SOC2ControlMapping[];
  gapAnalysis: SOC2GapItem[];
  recommendations: string[];
}

// ============================================================
// SOC2Assessor
// ============================================================

export class SOC2Assessor {
  private projectName: string;

  constructor(projectName = 'unknown') {
    this.projectName = projectName;
  }

  /**
   * Run full SOC 2 Trust Service Criteria assessment.
   */
  assess(params: {
    input: SOC2AssessmentInput;
    auditTrailEntries?: number;
    hasGovernance?: boolean;
    hasQualityGates?: boolean;
    hasShadowPipeline?: boolean;
    hasLearningSystem?: boolean;
    activeAlerts?: number;
    criticalAlerts?: number;
    testCoverage?: number;
    totalAgents?: number;
  }): SOC2Assessment {
    const checks: SOC2ComplianceCheck[] = [];

    checks.push(...this.assessSecurity(params));
    checks.push(...this.assessAvailability(params));
    checks.push(...this.assessProcessingIntegrity(params));
    checks.push(...this.assessConfidentiality(params));
    checks.push(...this.assessPrivacy(params));

    const passedChecks = checks.filter((c) => c.result === 'pass').length;
    const failedChecks = checks.filter((c) => c.result === 'fail').length;
    const complianceScore = this.calculateComplianceScore(checks);

    const controlMappings = this.buildControlMappings(checks);
    const gapAnalysis = this.buildGapAnalysis(checks);
    const recommendations = this.generateRecommendations(checks, params);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      projectName: this.projectName,
      complianceScore,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      checks,
      controlMappings,
      gapAnalysis,
      recommendations,
    };
  }

  // ── CC6.x — Security (Logical & Physical Access) ───────────

  private assessSecurity(params: {
    input: SOC2AssessmentInput;
    hasGovernance?: boolean;
    hasQualityGates?: boolean;
    hasShadowPipeline?: boolean;
    criticalAlerts?: number;
  }): SOC2ComplianceCheck[] {
    const checks: SOC2ComplianceCheck[] = [];

    checks.push(
      this.check(
        'CC6.1',
        'security',
        'Logical Access Security',
        params.input.hasAccessControls ? 'pass' : 'fail',
        params.input.hasAccessControls ? 100 : 0,
        params.input.hasAccessControls
          ? 'Access controls are implemented'
          : 'No access control system detected',
        'Implement role-based access control for all system components',
        true,
      ),
    );

    checks.push(
      this.check(
        'CC6.2',
        'security',
        'Multi-Factor Authentication',
        params.input.hasMFA ? 'pass' : 'fail',
        params.input.hasMFA ? 100 : 0,
        params.input.hasMFA ? 'MFA is enforced for system access' : 'MFA not enforced',
        'Enable multi-factor authentication for all administrative access',
        true,
      ),
    );

    checks.push(
      this.check(
        'CC6.3',
        'security',
        'Access Revocation',
        params.input.hasAccessControls ? 'pass' : 'warn',
        params.input.hasAccessControls ? 100 : 40,
        params.input.hasAccessControls
          ? 'Access control system supports revocation'
          : 'Access revocation process not confirmed',
        'Implement automated access revocation for terminated users',
        true,
      ),
    );

    checks.push(
      this.check(
        'CC7.1',
        'security',
        'System Monitoring',
        params.input.hasMonitoring ? 'pass' : 'fail',
        params.input.hasMonitoring ? 100 : 0,
        params.input.hasMonitoring
          ? 'Monitoring and anomaly detection is active'
          : 'No system monitoring detected',
        'Enable AlertManager with rules for anomalous behavior',
        true,
      ),
    );

    checks.push(
      this.check(
        'CC7.2',
        'security',
        'Anomaly Response',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 40,
        params.hasGovernance
          ? 'Governance engine provides escalation for anomalies'
          : 'Anomaly response procedures not formally defined',
        'Configure governance escalation rules for security events',
        true,
      ),
    );

    checks.push(
      this.check(
        'CC8.1',
        'security',
        'Change Management',
        params.input.hasChangeManagement ? 'pass' : 'fail',
        params.input.hasChangeManagement ? 100 : 0,
        params.input.hasChangeManagement
          ? 'Change management procedures are enforced'
          : 'No change management process',
        'Implement governance rules requiring approval for production changes',
        true,
      ),
    );

    return checks;
  }

  // ── A1.x — Availability ─────────────────────────────────────

  private assessAvailability(params: {
    input: SOC2AssessmentInput;
    hasShadowPipeline?: boolean;
    hasGovernance?: boolean;
  }): SOC2ComplianceCheck[] {
    const checks: SOC2ComplianceCheck[] = [];

    const uptime = params.input.uptimePercentage ?? 0;

    checks.push(
      this.check(
        'A1.1',
        'availability',
        'Uptime Commitment',
        uptime >= 99.9 ? 'pass' : uptime >= 99.0 ? 'warn' : 'fail',
        uptime >= 99.9 ? 100 : uptime >= 99.0 ? 70 : 20,
        `System uptime: ${uptime}%`,
        'Implement redundancy and failover to achieve 99.9%+ uptime',
        true,
      ),
    );

    checks.push(
      this.check(
        'A1.2',
        'availability',
        'Disaster Recovery',
        params.input.hasBackupRecovery ? 'pass' : 'fail',
        params.input.hasBackupRecovery ? 100 : 0,
        params.input.hasBackupRecovery
          ? 'Backup and recovery procedures are in place'
          : 'No disaster recovery procedures detected',
        'Implement automated backups with tested recovery procedures',
        true,
      ),
    );

    checks.push(
      this.check(
        'A1.3',
        'availability',
        'Incident Response',
        params.input.hasIncidentResponse ? 'pass' : 'warn',
        params.input.hasIncidentResponse ? 100 : 40,
        params.input.hasIncidentResponse
          ? 'Incident response procedures are documented'
          : 'Incident response procedures not confirmed',
        'Document and test incident response plan with defined escalation paths',
        true,
      ),
    );

    checks.push(
      this.check(
        'A1.4',
        'availability',
        'System Resilience',
        params.hasShadowPipeline ? 'pass' : 'warn',
        params.hasShadowPipeline ? 100 : 40,
        params.hasShadowPipeline
          ? 'Shadow pipeline validates system resilience'
          : 'System resilience not continuously tested',
        'Deploy shadow pipeline with traffic replay for resilience validation',
        true,
      ),
    );

    return checks;
  }

  // ── PI1.x — Processing Integrity ────────────────────────────

  private assessProcessingIntegrity(params: {
    input: SOC2AssessmentInput;
    hasQualityGates?: boolean;
    hasGovernance?: boolean;
    testCoverage?: number;
  }): SOC2ComplianceCheck[] {
    const checks: SOC2ComplianceCheck[] = [];
    const coverage = params.testCoverage ?? 0;

    checks.push(
      this.check(
        'PI1.1',
        'processing-integrity',
        'Data Input Validation',
        params.input.hasAccessControls ? 'pass' : 'warn',
        params.input.hasAccessControls ? 100 : 40,
        params.input.hasAccessControls
          ? 'Access controls ensure authorized data input'
          : 'Data input validation not formally verified',
        'Implement schema validation for all data inputs',
        true,
      ),
    );

    checks.push(
      this.check(
        'PI1.2',
        'processing-integrity',
        'Processing Error Detection',
        params.hasQualityGates ? 'pass' : 'warn',
        params.hasQualityGates ? 100 : 40,
        params.hasQualityGates
          ? 'Quality gates detect processing errors before deployment'
          : 'Automated error detection not confirmed',
        'Enable quality gates with typecheck and test coverage thresholds',
        true,
      ),
    );

    checks.push(
      this.check(
        'PI1.3',
        'processing-integrity',
        'Data Accuracy & Completeness',
        coverage >= 80 ? 'pass' : coverage >= 60 ? 'warn' : 'fail',
        coverage >= 80 ? 100 : coverage >= 60 ? 60 : 10,
        `Test coverage: ${coverage}% — validates data processing accuracy`,
        'Increase test coverage to at least 80% for processing integrity validation',
        true,
      ),
    );

    checks.push(
      this.check(
        'PI1.4',
        'processing-integrity',
        'Processing Timeliness',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 50,
        params.hasGovernance
          ? 'Governance engine enforces SLA-aware processing'
          : 'Processing timeliness not formally monitored',
        'Implement timeout interceptors and SLA monitoring via governance',
        false,
      ),
    );

    return checks;
  }

  // ── C1.x — Confidentiality ──────────────────────────────────

  private assessConfidentiality(params: {
    input: SOC2AssessmentInput;
    hasDataClassification?: boolean;
    hasGovernance?: boolean;
    hasDataEncryption?: boolean;
  }): SOC2ComplianceCheck[] {
    const checks: SOC2ComplianceCheck[] = [];
    const dataClassification = params.input.hasDataClassification;

    checks.push(
      this.check(
        'C1.1',
        'confidentiality',
        'Data Classification',
        dataClassification ? 'pass' : 'fail',
        dataClassification ? 100 : 0,
        dataClassification
          ? 'Data classification procedures are in place'
          : 'No data classification system',
        'Implement data classification with sensitivity levels and handling rules',
        true,
      ),
    );

    checks.push(
      this.check(
        'C1.2',
        'confidentiality',
        'Data Encryption',
        params.input.hasDataEncryption ? 'pass' : 'fail',
        params.input.hasDataEncryption ? 100 : 0,
        params.input.hasDataEncryption
          ? 'Data encryption is implemented'
          : 'No data encryption detected',
        'Implement AES-256 encryption for confidential data at rest and TLS for transit',
        true,
      ),
    );

    checks.push(
      this.check(
        'C1.3',
        'confidentiality',
        'Confidentiality Agreements',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 40,
        params.hasGovernance
          ? 'DNA patterns enforce confidentiality boundaries'
          : 'Confidentiality agreements not formally tracked',
        'Define DNA governance rules for data access boundaries',
        false,
      ),
    );

    return checks;
  }

  // ── P6.x — Privacy ──────────────────────────────────────────

  private assessPrivacy(params: {
    input: SOC2AssessmentInput;
    hasGovernance?: boolean;
    hasLearningSystem?: boolean;
  }): SOC2ComplianceCheck[] {
    const checks: SOC2ComplianceCheck[] = [];

    checks.push(
      this.check(
        'P6.1',
        'privacy',
        'Privacy Notice & Consent',
        params.input.hasPrivacyPolicies ? 'pass' : 'warn',
        params.input.hasPrivacyPolicies ? 100 : 30,
        params.input.hasPrivacyPolicies
          ? 'Privacy policies are documented'
          : 'Privacy policies not confirmed',
        'Document privacy notice and obtain appropriate consent',
        true,
      ),
    );

    checks.push(
      this.check(
        'P6.2',
        'privacy',
        'Data Collection Limitation',
        params.input.hasDataClassification ? 'pass' : 'warn',
        params.input.hasDataClassification ? 100 : 40,
        params.input.hasDataClassification
          ? 'Data classification limits collection to necessary data'
          : 'Data collection scope not formally limited',
        'Implement data minimization principles via governance rules',
        true,
      ),
    );

    checks.push(
      this.check(
        'P7.1',
        'privacy',
        'Data Retention & Disposal',
        params.input.dataRetentionDays !== undefined ? 'pass' : 'warn',
        params.input.dataRetentionDays !== undefined ? 100 : 30,
        params.input.dataRetentionDays !== undefined
          ? `Data retention policy: ${params.input.dataRetentionDays} days`
          : 'Data retention policy not defined',
        'Define and enforce data retention periods with automated disposal',
        true,
      ),
    );

    checks.push(
      this.check(
        'P8.1',
        'privacy',
        'Privacy Impact Assessment',
        params.hasLearningSystem ? 'pass' : 'warn',
        params.hasLearningSystem ? 100 : 30,
        params.hasLearningSystem
          ? 'Learning engine tracks privacy-relevant patterns'
          : 'Privacy impact assessment not confirmed',
        'Conduct privacy impact assessment and document findings',
        false,
      ),
    );

    return checks;
  }

  // ── Control Mappings ────────────────────────────────────────

  private buildControlMappings(checks: SOC2ComplianceCheck[]): SOC2ControlMapping[] {
    const criteriaMap = new Map<SOCTrustCriteria, SOC2ComplianceCheck[]>();
    for (const check of checks) {
      const existing = criteriaMap.get(check.trustService) ?? [];
      existing.push(check);
      criteriaMap.set(check.trustService, existing);
    }

    const mappings: SOC2ControlMapping[] = [];
    for (const [criteria, criteriaChecks] of criteriaMap) {
      const implemented = criteriaChecks.filter((c) => c.result === 'pass').length;
      mappings.push({
        criteria,
        controls: criteriaChecks.map((c) => c.controlRef),
        implemented,
        total: criteriaChecks.length,
        score:
          criteriaChecks.length > 0 ? Math.round((implemented / criteriaChecks.length) * 100) : 0,
      });
    }

    return mappings;
  }

  // ── Gap Analysis ────────────────────────────────────────────

  private buildGapAnalysis(checks: SOC2ComplianceCheck[]): SOC2GapItem[] {
    const gaps: SOC2GapItem[] = [];

    for (const check of checks) {
      if (check.result === 'fail') {
        gaps.push({
          controlRef: check.controlRef,
          title: check.title,
          trustService: check.trustService,
          severity: check.mandatory ? 'critical' : 'high',
          currentState: 'Not implemented',
          requiredState: check.finding.includes('detected')
            ? 'Must be implemented'
            : 'Must be active',
          remediation: check.remediation ?? 'Implement required control',
          estimatedEffort: this.estimateEffort(check),
        });
      } else if (check.result === 'warn') {
        gaps.push({
          controlRef: check.controlRef,
          title: check.title,
          trustService: check.trustService,
          severity: 'medium',
          currentState: 'Partially implemented',
          requiredState: 'Fully implemented',
          remediation: check.remediation ?? 'Complete implementation',
          estimatedEffort: this.estimateEffort(check),
        });
      }
    }

    return gaps;
  }

  // ── Helpers ─────────────────────────────────────────────────

  private check(
    controlRef: string,
    trustService: SOCTrustCriteria,
    title: string,
    result: SOC2CheckResult,
    score: number,
    finding: string,
    remediation?: string,
    mandatory = true,
  ): SOC2ComplianceCheck {
    return {
      id: randomUUID(),
      criteria: `${controlRef}`,
      controlRef,
      title,
      trustService,
      result,
      score,
      finding,
      remediation,
      mandatory,
    };
  }

  private calculateComplianceScore(checks: SOC2ComplianceCheck[]): number {
    const mandatoryChecks = checks.filter((c) => c.mandatory);
    if (mandatoryChecks.length === 0) return 100;
    const passed = mandatoryChecks.filter((c) => c.result === 'pass').length;
    return Math.round((passed / mandatoryChecks.length) * 100);
  }

  private estimateEffort(check: SOC2ComplianceCheck): string {
    if (check.trustService === 'security') return '1-2 weeks';
    if (check.trustService === 'availability') return '2-4 weeks';
    if (check.trustService === 'processing-integrity') return '1-2 weeks';
    if (check.trustService === 'confidentiality') return '1-3 weeks';
    if (check.trustService === 'privacy') return '2-6 weeks';
    return '1-2 weeks';
  }

  private generateRecommendations(
    checks: SOC2ComplianceCheck[],
    params: { input: SOC2AssessmentInput; hasGovernance?: boolean; hasQualityGates?: boolean },
  ): string[] {
    const recommendations: string[] = [];

    const failedChecks = checks.filter((c) => c.result === 'fail');
    for (const check of failedChecks) {
      if (check.remediation) {
        recommendations.push(`[${check.controlRef}] ${check.title}: ${check.remediation}`);
      }
    }

    if (!params.input.hasAccessControls) {
      recommendations.push('Implement access control system (CC6.1) — foundational for SOC 2.');
    }
    if (!params.input.hasMFA) {
      recommendations.push('Enable MFA (CC6.2) — required for SOC 2 Type II.');
    }
    if (!params.input.hasMonitoring) {
      recommendations.push('Deploy monitoring and alerting (CC7.1) — mandatory for SOC 2.');
    }
    if (!params.input.hasChangeManagement) {
      recommendations.push('Implement change management (CC8.1) — critical for SOC 2 audit.');
    }
    if (!params.hasGovernance) {
      recommendations.push(
        'Enable BehaviorOS GovernanceEngine for automated compliance enforcement.',
      );
    }
    if (!params.hasQualityGates) {
      recommendations.push('Enable QualityEngine for processing integrity validation (PI1.2).');
    }

    return recommendations;
  }
}
