import { randomUUID } from 'node:crypto';

// ============================================================
// PCI-DSS v4.0 — Compliance Framework
// Payment Card Industry Data Security Standard
// ============================================================

/**
 * PCI-DSS requirement categories (12 requirements).
 */
export type PCIRequirementCategory =
  | 'network-security'
  | 'data-protection'
  | 'vulnerability-management'
  | 'access-control'
  | 'monitoring-testing'
  | 'security-policies';

/**
 * Compliance check result.
 */
export type PCICheckResult = 'pass' | 'fail' | 'warn' | 'na' | 'partial';

/**
 * A single PCI-DSS compliance check.
 */
export interface PCIComplianceCheck {
  id: string;
  requirementNumber: string;
  requirementName: string;
  subRequirement?: string;
  category: PCIRequirementCategory;
  result: PCICheckResult;
  score: number;
  finding: string;
  evidence?: string[];
  remediation?: string;
  mandatory: boolean;
}

/**
 * PCI-DSS assessment input.
 */
export interface PCIAssessmentInput {
  /** Whether the system handles cardholder data. */
  handlesCardholderData: boolean;
  /** Whether the system processes payments. */
  processesPayments: boolean;
  /** Whether the system is internet-facing. */
  internetFacing: boolean;
  /** Number of payment transactions per year. */
  annualTransactions: number;
  /** Whether encryption is used for data in transit. */
  encryptsInTransit: boolean;
  /** Whether encryption is used for data at rest. */
  encryptsAtRest: boolean;
  /** Whether access control is implemented. */
  hasAccessControl: boolean;
  /** Whether monitoring/alerting is enabled. */
  hasMonitoring: boolean;
  /** Whether vulnerability scanning is performed. */
  hasVulnerabilityScanning: boolean;
  /** Whether security policies are documented. */
  hasSecurityPolicies: boolean;
  /** Whether a firewall is configured. */
  hasFirewall: boolean;
  /** Whether MFA is required. */
  hasMFA: boolean;
  /** Whether audit logging is enabled. */
  hasAuditLogging: boolean;
  /** Whether network segmentation exists. */
  hasNetworkSegmentation: boolean;
}

/**
 * Complete PCI-DSS assessment result.
 */
export interface PCIAssessment {
  id: string;
  timestamp: string;
  projectName: string;
  complianceScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  checks: PCIComplianceCheck[];
  networkSecurityControls: PCINetworkSecurityControls;
  dataProtectionMeasures: PCIDataProtectionMeasures;
  vulnerabilityManagement: PCIVulnerabilityManagement;
  accessControlMeasures: PCIAccessControlMeasures;
  monitoringAndTesting: PCIMonitoringAndTesting;
  recommendations: string[];
}

/**
 * Network security controls (Requirement 1).
 */
export interface PCINetworkSecurityControls {
  firewallConfigured: boolean;
  networkSegmentation: boolean;
  inboundTrafficRestricted: boolean;
  outboundTrafficRestricted: boolean;
  wirelessSecurityConfigured: boolean;
}

/**
 * Data protection measures (Requirement 3).
 */
export interface PCIDataProtectionMeasures {
  dataEncryptionAtRest: boolean;
  dataEncryptionInTransit: boolean;
  sensitiveDataMasked: boolean;
  dataRetentionPolicy: boolean;
  secureDisposal: boolean;
}

/**
 * Vulnerability management (Requirement 6).
 */
export interface PCIVulnerabilityManagement {
  vulnerabilityScanning: boolean;
  patchManagement: boolean;
  secureDevelopment: boolean;
  codeReview: boolean;
  securityTesting: boolean;
}

/**
 * Access control measures (Requirement 7-8).
 */
export interface PCIAccessControlMeasures {
  needToKnowAccess: boolean;
  multiFactorAuth: boolean;
  passwordPolicy: boolean;
  accessReview: boolean;
  uniqueUserIds: boolean;
}

/**
 * Monitoring and testing (Requirement 10-11).
 */
export interface PCIMonitoringAndTesting {
  auditLogging: boolean;
  logReview: boolean;
  intrusionDetection: boolean;
  fileIntegrityMonitoring: boolean;
  penetrationTesting: boolean;
}

// ============================================================
// PCIDSSAssessor
// ============================================================

export class PCIDSSAssessor {
  private projectName: string;

  constructor(projectName = 'unknown') {
    this.projectName = projectName;
  }

  /**
   * Run full PCI-DSS v4.0 assessment.
   */
  assess(params: {
    input: PCIAssessmentInput;
    auditTrailEntries?: number;
    hasGovernance?: boolean;
    hasQualityGates?: boolean;
    hasShadowPipeline?: boolean;
    hasLearningSystem?: boolean;
    activeAlerts?: number;
    criticalAlerts?: number;
  }): PCIAssessment {
    const checks: PCIComplianceCheck[] = [];

    checks.push(...this.assessNetworkSecurity(params));
    checks.push(...this.assessDataProtection(params));
    checks.push(...this.assessVulnerabilityManagement(params));
    checks.push(...this.assessAccessControl(params));
    checks.push(...this.assessMonitoringAndTesting(params));
    checks.push(...this.assessSecurityPolicies(params));

    const passedChecks = checks.filter((c) => c.result === 'pass').length;
    const failedChecks = checks.filter((c) => c.result === 'fail').length;
    const complianceScore = this.calculateComplianceScore(checks);

    const networkSecurityControls = this.buildNetworkSecurityControls(params);
    const dataProtectionMeasures = this.buildDataProtectionMeasures(params);
    const vulnerabilityManagement = this.buildVulnerabilityManagement(params);
    const accessControlMeasures = this.buildAccessControlMeasures(params);
    const monitoringAndTesting = this.buildMonitoringAndTesting(params);
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
      networkSecurityControls,
      dataProtectionMeasures,
      vulnerabilityManagement,
      accessControlMeasures,
      monitoringAndTesting,
      recommendations,
    };
  }

  // ── Requirement 1-2: Network Security ───────────────────────

  private assessNetworkSecurity(params: {
    input: PCIAssessmentInput;
    hasGovernance?: boolean;
  }): PCIComplianceCheck[] {
    const checks: PCIComplianceCheck[] = [];
    const { input } = params;

    checks.push(
      this.check(
        '1.1',
        'Firewall Configuration',
        'network-security',
        input.hasFirewall ? 'pass' : 'fail',
        input.hasFirewall ? 100 : 0,
        input.hasFirewall
          ? 'Firewall is configured for network perimeter'
          : 'No firewall detected — critical for cardholder data environment',
        'Configure firewall rules restricting inbound/outbound traffic to cardholder data environment',
        true,
      ),
    );

    checks.push(
      this.check(
        '1.2',
        'Network Segmentation',
        'network-security',
        input.hasNetworkSegmentation ? 'pass' : input.handlesCardholderData ? 'fail' : 'na',
        input.hasNetworkSegmentation ? 100 : 0,
        input.hasNetworkSegmentation
          ? 'Network segmentation isolates cardholder data environment'
          : 'Network segmentation not detected',
        'Implement network segmentation to isolate cardholder data from other systems',
        input.handlesCardholderData,
      ),
    );

    checks.push(
      this.check(
        '1.3',
        'Inbound Traffic Restriction',
        'network-security',
        input.hasFirewall ? 'pass' : 'fail',
        input.hasFirewall ? 100 : 0,
        input.hasFirewall
          ? 'Firewall rules restrict inbound traffic'
          : 'Inbound traffic not restricted',
        'Configure firewall to deny all inbound traffic except as needed for business purposes',
        true,
      ),
    );

    checks.push(
      this.check(
        '2.1',
        'Secure Configuration',
        'network-security',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 40,
        params.hasGovernance
          ? 'Governance engine enforces secure configuration changes'
          : 'Configuration management not formally controlled',
        'Implement change management via governance engine for all infrastructure changes',
        true,
      ),
    );

    return checks;
  }

  // ── Requirement 3-4: Data Protection ────────────────────────

  private assessDataProtection(params: {
    input: PCIAssessmentInput;
    hasGovernance?: boolean;
  }): PCIComplianceCheck[] {
    const checks: PCIComplianceCheck[] = [];
    const { input } = params;

    checks.push(
      this.check(
        '3.4',
        'Data Encryption at Rest',
        'data-protection',
        input.encryptsAtRest ? 'pass' : input.handlesCardholderData ? 'fail' : 'na',
        input.encryptsAtRest ? 100 : 0,
        input.encryptsAtRest
          ? 'Cardholder data is encrypted at rest'
          : 'No encryption at rest detected',
        'Implement AES-256 encryption for all stored cardholder data',
        input.handlesCardholderData,
      ),
    );

    checks.push(
      this.check(
        '4.2',
        'Data Encryption in Transit',
        'data-protection',
        input.encryptsInTransit ? 'pass' : 'fail',
        input.encryptsInTransit ? 100 : 0,
        input.encryptsInTransit
          ? 'TLS encryption enforced for data in transit'
          : 'Data in transit not encrypted',
        'Enforce TLS 1.2+ for all cardholder data transmissions',
        true,
      ),
    );

    checks.push(
      this.check(
        '3.3',
        'Sensitive Data Masking',
        'data-protection',
        input.handlesCardholderData ? (input.encryptsAtRest ? 'warn' : 'fail') : 'na',
        input.handlesCardholderData ? 50 : 100,
        input.handlesCardholderData
          ? 'Verify PAN masking is implemented (first 6/last 4 visible)'
          : 'No cardholder data handling',
        'Implement PAN masking — show only first 6 and last 4 digits',
        input.handlesCardholderData,
      ),
    );

    return checks;
  }

  // ── Requirement 5-6: Vulnerability Management ───────────────

  private assessVulnerabilityManagement(params: {
    input: PCIAssessmentInput;
    hasQualityGates?: boolean;
    hasShadowPipeline?: boolean;
    hasGovernance?: boolean;
  }): PCIComplianceCheck[] {
    const checks: PCIComplianceCheck[] = [];

    checks.push(
      this.check(
        '5.2',
        'Anti-Malware / Security Scanning',
        'vulnerability-management',
        params.hasQualityGates ? 'pass' : 'warn',
        params.hasQualityGates ? 100 : 40,
        params.hasQualityGates
          ? 'Quality gates include security vulnerability scanning'
          : 'Automated security scanning not confirmed',
        'Enable security gate in QualityEngine with zero critical/high tolerance',
        true,
      ),
    );

    checks.push(
      this.check(
        '6.2',
        'Secure Development Process',
        'vulnerability-management',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 40,
        params.hasGovernance
          ? 'Governance engine enforces secure development practices'
          : 'Secure development process not formally tracked',
        'Implement governance rules requiring code review and security checks',
        true,
      ),
    );

    checks.push(
      this.check(
        '6.3',
        'Security Patch Management',
        'vulnerability-management',
        params.hasGovernance && params.hasQualityGates ? 'pass' : 'warn',
        params.hasGovernance && params.hasQualityGates ? 100 : 50,
        'Governance + quality gates provide change control for patches',
        'Ensure all security patches are applied within 30 days of release',
        true,
      ),
    );

    checks.push(
      this.check(
        '6.4',
        'Change Control Procedures',
        'vulnerability-management',
        params.hasGovernance ? 'pass' : params.input.processesPayments ? 'fail' : 'warn',
        params.hasGovernance ? 100 : 0,
        params.hasGovernance
          ? 'Governance engine provides change control with approval workflows'
          : 'Change control procedures not enforced',
        'Configure governance rules to require approval for all production changes',
        params.input.processesPayments,
      ),
    );

    return checks;
  }

  // ── Requirement 7-8: Access Control ─────────────────────────

  private assessAccessControl(params: {
    input: PCIAssessmentInput;
    hasGovernance?: boolean;
    totalAgents?: number;
  }): PCIComplianceCheck[] {
    const checks: PCIComplianceCheck[] = [];

    checks.push(
      this.check(
        '7.1',
        'Need-to-Know Access',
        'access-control',
        params.input.hasAccessControl ? 'pass' : 'fail',
        params.input.hasAccessControl ? 100 : 0,
        params.input.hasAccessControl
          ? 'Access control measures are in place'
          : 'No access control detected',
        'Implement role-based access control with least privilege principle',
        true,
      ),
    );

    checks.push(
      this.check(
        '8.2',
        'Multi-Factor Authentication',
        'access-control',
        params.input.hasMFA ? 'pass' : 'fail',
        params.input.hasMFA ? 100 : 0,
        params.input.hasMFA
          ? 'MFA is required for administrative access'
          : 'MFA not enforced — critical for payment systems',
        'Enable MFA for all administrative and payment-related access',
        params.input.processesPayments,
      ),
    );

    checks.push(
      this.check(
        '8.3',
        'Unique User Identification',
        'access-control',
        params.input.hasAccessControl ? 'pass' : 'fail',
        params.input.hasAccessControl ? 100 : 0,
        params.input.hasAccessControl
          ? 'Unique user IDs enforced via governance'
          : 'Shared accounts detected',
        'Ensure every agent/user has a unique identifier — no shared accounts',
        true,
      ),
    );

    return checks;
  }

  // ── Requirement 9-11: Monitoring & Testing ──────────────────

  private assessMonitoringAndTesting(params: {
    input: PCIAssessmentInput;
    hasAuditLogging?: boolean;
    hasMonitoring?: boolean;
    hasShadowPipeline?: boolean;
    hasGovernance?: boolean;
    criticalAlerts?: number;
  }): PCIComplianceCheck[] {
    const checks: PCIComplianceCheck[] = [];

    checks.push(
      this.check(
        '10.1',
        'Audit Trail',
        'monitoring-testing',
        params.input.hasAuditLogging ? 'pass' : 'fail',
        params.input.hasAuditLogging ? 100 : 0,
        params.input.hasAuditLogging
          ? 'Audit logging is enabled for all access to cardholder data'
          : 'No audit logging — PCI-DSS Requirement 10 is mandatory',
        'Enable AuditEngine with persistPath for immutable audit trail',
        true,
      ),
    );

    checks.push(
      this.check(
        '10.2',
        'Automated Audit Trails',
        'monitoring-testing',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 40,
        params.hasGovernance
          ? 'Governance engine provides automated audit trail for all actions'
          : 'Audit trails may not cover all required events',
        'Configure audit logging for: access, changes, exceptions, and data access',
        true,
      ),
    );

    checks.push(
      this.check(
        '11.1',
        'Intrusion Detection',
        'monitoring-testing',
        params.hasMonitoring ? 'pass' : params.input.internetFacing ? 'fail' : 'warn',
        params.hasMonitoring ? 100 : 0,
        params.hasMonitoring
          ? 'Monitoring and alerting system is active'
          : 'No intrusion detection — critical for internet-facing systems',
        'Enable AlertManager with rules for anomalous behavior detection',
        params.input.internetFacing,
      ),
    );

    checks.push(
      this.check(
        '11.4',
        'Anomaly Detection',
        'monitoring-testing',
        params.hasShadowPipeline ? 'pass' : 'warn',
        params.hasShadowPipeline ? 100 : 40,
        params.hasShadowPipeline
          ? 'Shadow pipeline provides anomaly detection via traffic replay'
          : 'Anomaly detection capabilities not confirmed',
        'Deploy shadow pipeline with diff analysis for behavioral anomaly detection',
        params.input.processesPayments,
      ),
    );

    return checks;
  }

  // ── Requirement 12: Security Policies ───────────────────────

  private assessSecurityPolicies(params: {
    input: PCIAssessmentInput;
    hasGovernance?: boolean;
    hasSecurityPolicies?: boolean;
  }): PCIComplianceCheck[] {
    const checks: PCIComplianceCheck[] = [];

    checks.push(
      this.check(
        '12.1',
        'Information Security Policy',
        'security-policies',
        params.hasSecurityPolicies ? 'pass' : 'fail',
        params.hasSecurityPolicies ? 100 : 0,
        params.hasSecurityPolicies
          ? 'Security policies are documented'
          : 'No formal security policy document',
        'Create and maintain information security policy reviewed annually',
        true,
      ),
    );

    checks.push(
      this.check(
        '12.2',
        'Risk Assessment Process',
        'security-policies',
        params.hasGovernance ? 'pass' : 'fail',
        params.hasGovernance ? 100 : 0,
        params.hasGovernance
          ? 'Governance engine provides ongoing risk assessment'
          : 'No formal risk assessment process',
        'Implement BehaviorOS GovernanceEngine for continuous risk assessment',
        true,
      ),
    );

    checks.push(
      this.check(
        '12.3',
        'Usage Policies',
        'security-policies',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 50,
        params.hasGovernance
          ? 'DNA patterns define acceptable usage policies for agents'
          : 'Usage policies for AI agents not formally documented',
        'Define DNA patterns with explicit usage boundaries and forbidden actions',
        params.input.processesPayments,
      ),
    );

    return checks;
  }

  // ── Checklist Builders ──────────────────────────────────────

  private buildNetworkSecurityControls(params: {
    input: PCIAssessmentInput;
    hasGovernance?: boolean;
  }): PCINetworkSecurityControls {
    return {
      firewallConfigured: params.input.hasFirewall,
      networkSegmentation: params.input.hasNetworkSegmentation,
      inboundTrafficRestricted: params.input.hasFirewall,
      outboundTrafficRestricted: params.input.hasFirewall,
      wirelessSecurityConfigured: params.hasGovernance ?? false,
    };
  }

  private buildDataProtectionMeasures(params: {
    input: PCIAssessmentInput;
  }): PCIDataProtectionMeasures {
    return {
      dataEncryptionAtRest: params.input.encryptsAtRest,
      dataEncryptionInTransit: params.input.encryptsInTransit,
      sensitiveDataMasked: params.input.encryptsAtRest,
      dataRetentionPolicy: false,
      secureDisposal: false,
    };
  }

  private buildVulnerabilityManagement(params: {
    input: PCIAssessmentInput;
    hasQualityGates?: boolean;
    hasGovernance?: boolean;
  }): PCIVulnerabilityManagement {
    return {
      vulnerabilityScanning:
        params.input.hasVulnerabilityScanning || (params.hasQualityGates ?? false),
      patchManagement: params.hasGovernance ?? false,
      secureDevelopment: params.hasGovernance ?? false,
      codeReview: params.hasGovernance ?? false,
      securityTesting: params.hasQualityGates ?? false,
    };
  }

  private buildAccessControlMeasures(params: {
    input: PCIAssessmentInput;
    hasGovernance?: boolean;
  }): PCIAccessControlMeasures {
    return {
      needToKnowAccess: params.input.hasAccessControl,
      multiFactorAuth: params.input.hasMFA,
      passwordPolicy: params.hasGovernance ?? false,
      accessReview: params.hasGovernance ?? false,
      uniqueUserIds: params.input.hasAccessControl,
    };
  }

  private buildMonitoringAndTesting(params: {
    input: PCIAssessmentInput;
    hasMonitoring?: boolean;
    hasShadowPipeline?: boolean;
    hasGovernance?: boolean;
  }): PCIMonitoringAndTesting {
    return {
      auditLogging: params.input.hasAuditLogging,
      logReview: params.hasGovernance ?? false,
      intrusionDetection: params.hasMonitoring ?? false,
      fileIntegrityMonitoring: params.hasShadowPipeline ?? false,
      penetrationTesting: false,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private check(
    requirementNumber: string,
    requirementName: string,
    category: PCIRequirementCategory,
    result: PCICheckResult,
    score: number,
    finding: string,
    remediation?: string,
    mandatory = true,
  ): PCIComplianceCheck {
    return {
      id: randomUUID(),
      requirementNumber,
      requirementName,
      category,
      result,
      score,
      finding,
      remediation,
      mandatory,
    };
  }

  private calculateComplianceScore(checks: PCIComplianceCheck[]): number {
    const mandatoryChecks = checks.filter((c) => c.mandatory);
    if (mandatoryChecks.length === 0) return 100;
    const passed = mandatoryChecks.filter((c) => c.result === 'pass').length;
    return Math.round((passed / mandatoryChecks.length) * 100);
  }

  private generateRecommendations(
    checks: PCIComplianceCheck[],
    params: { input: PCIAssessmentInput; hasGovernance?: boolean; hasQualityGates?: boolean },
  ): string[] {
    const recommendations: string[] = [];

    if (params.input.processesPayments) {
      recommendations.push(
        'This system processes payments — full PCI-DSS compliance is mandatory.',
      );
    }

    const failedChecks = checks.filter((c) => c.result === 'fail');
    for (const check of failedChecks) {
      if (check.remediation) {
        recommendations.push(
          `[Req ${check.requirementNumber}] ${check.requirementName}: ${check.remediation}`,
        );
      }
    }

    if (!params.input.encryptsAtRest && params.input.handlesCardholderData) {
      recommendations.push('URGENT: Enable encryption at rest for all cardholder data (Req 3.4).');
    }
    if (!params.input.encryptsInTransit) {
      recommendations.push('URGENT: Enforce TLS 1.2+ for all data transmissions (Req 4.2).');
    }
    if (!params.input.hasMFA) {
      recommendations.push(
        'Enable multi-factor authentication for all administrative access (Req 8.2).',
      );
    }
    if (!params.hasGovernance) {
      recommendations.push(
        'Implement BehaviorOS governance for automated PCI-DSS compliance enforcement.',
      );
    }
    if (!params.hasQualityGates) {
      recommendations.push(
        'Enable security scanning via QualityEngine for vulnerability management (Req 6.2).',
      );
    }

    return recommendations;
  }
}
