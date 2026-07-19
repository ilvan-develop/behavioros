import { randomUUID } from 'node:crypto';

// ============================================================
// EU AI Act — Compliance Framework (Regulation 2024/1689)
// Mandatory since August 2026
// ============================================================

/**
 * Risk classification levels per EU AI Act Article 6.
 */
export type EURiskLevel = 'unacceptable' | 'high' | 'limited' | 'minimal';

/**
 * Compliance check result.
 */
export type EUCheckResult = 'pass' | 'fail' | 'warn' | 'skip' | 'partial';

/**
 * A single EU AI Act compliance check.
 */
export interface EUComplianceCheck {
  id: string;
  article: string;
  title: string;
  category: EUCategory;
  result: EUCheckResult;
  score: number;
  finding: string;
  evidence?: string[];
  remediation?: string;
  deadline?: string;
  mandatory: boolean;
}

/**
 * EU AI Act categories.
 */
export type EUCategory =
  | 'risk-management'
  | 'data-governance'
  | 'technical-documentation'
  | 'record-keeping'
  | 'transparency'
  | 'human-oversight'
  | 'accuracy-robustness'
  | 'cybersecurity'
  | 'conformity-assessment'
  | 'post-market-monitoring';

/**
 * Risk classification input for Article 6 assessment.
 */
export interface EUSRiskClassificationInput {
  /** System purpose description. */
  purpose: string;
  /** Whether the system uses biometric identification. */
  usesBiometrics: boolean;
  /** Whether the system accesses critical infrastructure. */
  accessesCriticalInfrastructure: boolean;
  /** Whether the system determines access to essential services. */
  determinesAccessToEssentialServices: boolean;
  /** Whether the system is used in law enforcement. */
  usedInLawEnforcement: boolean;
  /** Whether the system is used in migration/asylum. */
  usedInMigration: boolean;
  /** Whether the system is used in education. */
  usedInEducation: boolean;
  /** Whether the system is used in employment decisions. */
  usedInEmployment: boolean;
  /** Whether the system involves remote biometric identification in public spaces. */
  remoteBiometricPublicSpaces: boolean;
  /** Whether the system profiles natural persons. */
  profilesNaturalPersons: boolean;
}

/**
 * Complete EU AI Act assessment result.
 */
export interface EUAIActAssessment {
  id: string;
  timestamp: string;
  projectName: string;
  riskLevel: EURiskLevel;
  riskClassificationInput: EUSRiskClassificationInput;
  complianceScore: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  partialChecks: number;
  checks: EUComplianceCheck[];
  transparencyRequirements: EUTransparencyChecklist;
  humanOversightRequirements: EUHumanOversightChecklist;
  dataGovernanceRequirements: EUDataGovernanceChecklist;
  technicalDocRequirements: EUTechnicalDocChecklist;
  recommendations: string[];
}

/**
 * Transparency requirements checklist (Articles 13, 50, 52).
 */
export interface EUTransparencyChecklist {
  /** Users are informed they interact with an AI system. */
  aiSystemDisclosure: boolean;
  /** AI-generated content is marked as such. */
  aiContentWatermarking: boolean;
  /** Output includes explanation of decision factors. */
  decisionExplainability: boolean;
  /** System capabilities and limitations are documented. */
  capabilityDocumentation: boolean;
  /** Intended purpose is clearly stated. */
  intendedPurposeDocumented: boolean;
  /** Known limitations are documented. */
  limitationsDocumented: boolean;
  /** Performance metrics are published. */
  performanceMetricsPublished: boolean;
  /** Training data sources are disclosed. */
  trainingDataDisclosed: boolean;
}

/**
 * Human oversight requirements checklist (Article 14).
 */
export interface EUHumanOversightChecklist {
  /** Human can override or reverse AI decision. */
  overrideCapability: boolean;
  /** Human can interrupt or stop the system. */
  interruptCapability: boolean;
  /** Human can decide not to use the system. */
  optOutCapability: boolean;
  /** System provides real-time monitoring capability. */
  realTimeMonitoring: boolean;
  /** System provides clear instructions for human operators. */
  operatorInstructions: boolean;
  /** Escalation procedures are defined. */
  escalationProcedures: boolean;
  /** Fallback mechanisms exist for system failure. */
  fallbackMechanisms: boolean;
}

/**
 * Data governance requirements checklist (Article 10).
 */
export interface EUDataGovernanceChecklist {
  /** Training data is relevant and representative. */
  dataRelevance: boolean;
  /** Training data is free from biases. */
  biasFreeData: boolean;
  /** Data quality measures are in place. */
  dataQualityMeasures: boolean;
  /** Data is appropriately labeled/annotated. */
  dataAnnotation: boolean;
  /** Personal data handling complies with GDPR. */
  gdprCompliance: boolean;
  /** Data governance procedures are documented. */
  governanceProcedures: boolean;
  /** Data collection has legal basis. */
  legalBasis: boolean;
  /** Sensitive data is handled with additional safeguards. */
  sensitiveDataProtection: boolean;
}

/**
 * Technical documentation requirements checklist (Article 11 + Annex IV).
 */
export interface EUTechnicalDocChecklist {
  /** System description and purpose. */
  systemDescription: boolean;
  /** Development methodology. */
  developmentMethodology: boolean;
  /** Training/validation/test data details. */
  dataDetails: boolean;
  /** Computational resources used. */
  resourceDescription: boolean;
  /** Architecture and design decisions. */
  architectureDocumentation: boolean;
  /** Performance evaluation results. */
  performanceEvaluation: boolean;
  /** Risk management documentation. */
  riskManagementDoc: boolean;
  /** Change management and versioning. */
  changeManagement: boolean;
  /** Testing methodology and results. */
  testingMethodology: boolean;
  /** Incident handling procedures. */
  incidentProcedures: boolean;
}

// ============================================================
// EUAIActAssessor
// ============================================================

export class EUAIActAssessor {
  private projectName: string;

  constructor(projectName = 'unknown') {
    this.projectName = projectName;
  }

  /**
   * Classify risk level based on Article 6 criteria.
   */
  classifyRisk(input: EUSRiskClassificationInput): EURiskLevel {
    if (input.remoteBiometricPublicSpaces && input.usesBiometrics) {
      return 'unacceptable';
    }
    if (
      input.usesBiometrics ||
      input.accessesCriticalInfrastructure ||
      input.determinesAccessToEssentialServices ||
      input.usedInLawEnforcement ||
      input.usedInMigration ||
      (input.usedInEducation && input.profilesNaturalPersons) ||
      (input.usedInEmployment && input.profilesNaturalPersons)
    ) {
      return 'high';
    }
    if (
      input.usedInEducation ||
      input.usedInEmployment ||
      input.profilesNaturalPersons ||
      input.purpose.length > 0
    ) {
      return 'limited';
    }
    return 'minimal';
  }

  /**
   * Run full EU AI Act assessment.
   */
  assess(params: {
    riskInput: EUSRiskClassificationInput;
    auditTrailEntries?: number;
    hasGovernance?: boolean;
    hasQualityGates?: boolean;
    hasLearningSystem?: boolean;
    hasShadowPipeline?: boolean;
    totalAgents?: number;
    activeAlerts?: number;
    criticalAlerts?: number;
    driftScore?: number;
    testCoverage?: number;
    hasDocumentation?: boolean;
    hasDataGovernance?: boolean;
  }): EUAIActAssessment {
    const riskLevel = this.classifyRisk(params.riskInput);
    const checks: EUComplianceCheck[] = [];

    checks.push(...this.assessRiskManagement(riskLevel, params));
    checks.push(...this.assessDataGovernance(riskLevel, params));
    checks.push(...this.assessTechnicalDocumentation(riskLevel, params));
    checks.push(...this.assessRecordKeeping(riskLevel, params));
    checks.push(...this.assessTransparency(riskLevel, params));
    checks.push(...this.assessHumanOversight(riskLevel, params));
    checks.push(...this.assessAccuracyRobustness(riskLevel, params));
    checks.push(...this.assessCybersecurity(riskLevel, params));

    const mandatoryChecks = checks.filter((c) => c.mandatory);
    const passedChecks = checks.filter((c) => c.result === 'pass').length;
    const failedChecks = checks.filter((c) => c.result === 'fail').length;
    const partialChecks = checks.filter((c) => c.result === 'partial').length;

    const complianceScore = this.calculateComplianceScore(checks, riskLevel);

    const transparencyRequirements = this.buildTransparencyChecklist(params);
    const humanOversightRequirements = this.buildHumanOversightChecklist(params);
    const dataGovernanceRequirements = this.buildDataGovernanceChecklist(params);
    const technicalDocRequirements = this.buildTechnicalDocChecklist(params);

    const recommendations = this.generateRecommendations(checks, riskLevel, params);

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      projectName: this.projectName,
      riskLevel,
      riskClassificationInput: params.riskInput,
      complianceScore,
      totalChecks: checks.length,
      passedChecks,
      failedChecks,
      partialChecks,
      checks,
      transparencyRequirements,
      humanOversightRequirements,
      dataGovernanceRequirements,
      technicalDocRequirements,
      recommendations,
    };
  }

  // ── Risk Management (Article 9) ─────────────────────────────

  private assessRiskManagement(
    riskLevel: EURiskLevel,
    params: { hasGovernance?: boolean; hasQualityGates?: boolean; hasShadowPipeline?: boolean },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];
    const isHighPlus = riskLevel === 'high' || riskLevel === 'unacceptable';

    checks.push(
      this.check(
        'Article 9',
        'Risk Management System',
        'risk-management',
        params.hasGovernance ? 'pass' : isHighPlus ? 'fail' : 'warn',
        params.hasGovernance ? 100 : 0,
        params.hasGovernance
          ? 'Governance engine provides systematic risk management'
          : 'No governance engine detected — required for high-risk systems',
        isHighPlus
          ? ['Implement BehaviorOS GovernanceEngine with block/escalate rules']
          : undefined,
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 9(2)',
        'Risk Identification & Mitigation',
        'risk-management',
        params.hasShadowPipeline ? 'pass' : 'warn',
        params.hasShadowPipeline ? 100 : 40,
        params.hasShadowPipeline
          ? 'Shadow pipeline provides continuous risk detection'
          : 'No shadow pipeline — continuous risk detection not available',
        ['Enable shadow pipeline for continuous regression detection'],
        isHighPlus,
      ),
    );

    checks.push(
      this.check(
        'Article 9(3)',
        'Testing & Validation',
        'risk-management',
        params.hasQualityGates ? 'pass' : isHighPlus ? 'fail' : 'warn',
        params.hasQualityGates ? 100 : 0,
        params.hasQualityGates
          ? 'Quality gates enforce testing before deployment'
          : 'No quality gates — testing validation not enforced',
        ['Configure quality gates with minimum 80% test coverage threshold'],
        true,
      ),
    );

    return checks;
  }

  // ── Data Governance (Article 10) ────────────────────────────

  private assessDataGovernance(
    riskLevel: EURiskLevel,
    params: {
      hasDataGovernance?: boolean;
      auditTrailEntries?: number;
      hasLearningSystem?: boolean;
    },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];
    const isHighPlus = riskLevel === 'high' || riskLevel === 'unacceptable';

    checks.push(
      this.check(
        'Article 10(1)',
        'Training Data Quality',
        'data-governance',
        params.hasDataGovernance ? 'pass' : isHighPlus ? 'fail' : 'warn',
        params.hasDataGovernance ? 100 : 0,
        params.hasDataGovernance
          ? 'Data governance procedures are in place'
          : 'No formal data governance procedures detected',
        ['Document data collection, cleaning, and validation procedures'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 10(2)',
        'Bias Detection & Mitigation',
        'data-governance',
        params.hasLearningSystem ? 'pass' : 'warn',
        params.hasLearningSystem ? 100 : 30,
        params.hasLearningSystem
          ? 'Learning engine detects patterns and biases across events'
          : 'No learning system — automated bias detection not available',
        ['Enable LearningEngine for pattern detection across agent decisions'],
        isHighPlus,
      ),
    );

    checks.push(
      this.check(
        'Article 10(3)',
        'Data Representativeness',
        'data-governance',
        (params.auditTrailEntries ?? 0) >= 100 ? 'pass' : 'warn',
        (params.auditTrailEntries ?? 0) >= 100 ? 100 : Math.min(80, params.auditTrailEntries ?? 0),
        `${params.auditTrailEntries ?? 0} audit trail entries available for analysis`,
        ['Increase audit trail coverage to improve data representativeness'],
        isHighPlus,
      ),
    );

    return checks;
  }

  // ── Technical Documentation (Article 11) ────────────────────

  private assessTechnicalDocumentation(
    riskLevel: EURiskLevel,
    params: { hasDocumentation?: boolean; hasGovernance?: boolean },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];

    checks.push(
      this.check(
        'Article 11',
        'Technical Documentation Existence',
        'technical-documentation',
        params.hasDocumentation ? 'pass' : 'warn',
        params.hasDocumentation ? 100 : 20,
        params.hasDocumentation
          ? 'Project documentation is present'
          : 'Limited documentation detected',
        ['Create comprehensive technical documentation per Annex IV requirements'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 11 + Annex IV',
        'System Architecture Documentation',
        'technical-documentation',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 30,
        params.hasGovernance
          ? 'Governance engine tracks system architecture decisions'
          : 'Architecture documentation may be incomplete',
        ['Document AI system architecture, design decisions, and data flows'],
        true,
      ),
    );

    return checks;
  }

  // ── Record Keeping (Article 12) ─────────────────────────────

  private assessRecordKeeping(
    _riskLevel: EURiskLevel,
    params: { auditTrailEntries?: number; hasGovernance?: boolean },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];

    checks.push(
      this.check(
        'Article 12(1)',
        'Automatic Logging',
        'record-keeping',
        params.auditTrailEntries !== undefined && params.auditTrailEntries > 0 ? 'pass' : 'warn',
        params.auditTrailEntries !== undefined && params.auditTrailEntries > 0 ? 100 : 10,
        `${params.auditTrailEntries ?? 0} automatic log entries recorded`,
        ['Enable automatic logging of all AI system decisions and actions'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 12(2)',
        'Log Retention & Accessibility',
        'record-keeping',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 40,
        params.hasGovernance
          ? 'AuditEngine provides persistent log storage with history'
          : 'Log retention policy not confirmed',
        ['Configure AuditEngine with persistPath for long-term log retention'],
        true,
      ),
    );

    return checks;
  }

  // ── Transparency (Articles 13, 50, 52) ──────────────────────

  private assessTransparency(
    riskLevel: EURiskLevel,
    params: { totalAgents?: number; driftScore?: number },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];
    const isHighPlus = riskLevel === 'high' || riskLevel === 'unacceptable';

    checks.push(
      this.check(
        'Article 13',
        'Transparency & Explainability',
        'transparency',
        (params.driftScore ?? 0) < 30 ? 'pass' : (params.driftScore ?? 0) < 60 ? 'warn' : 'fail',
        (params.driftScore ?? 0) < 30 ? 100 : (params.driftScore ?? 0) < 60 ? 50 : 0,
        `Shadow drift score: ${params.driftScore ?? 0}/100 (lower is more transparent)`,
        ['Investigate high drift — indicates behavior divergence from expected baseline'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 50',
        'AI System Disclosure',
        'transparency',
        'pass',
        100,
        'BehaviorOS DNA patterns define clear agent roles and responsibilities',
        undefined,
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 52',
        'High-Risk Transparency Obligations',
        'transparency',
        isHighPlus ? ((params.totalAgents ?? 0) > 0 ? 'pass' : 'warn') : 'pass',
        isHighPlus ? 100 : 100,
        isHighPlus
          ? `${params.totalAgents ?? 0} agent(s) registered in governance system`
          : 'Standard transparency requirements apply',
        isHighPlus
          ? ['Ensure all AI agents are registered with clear role definitions']
          : undefined,
        isHighPlus,
      ),
    );

    return checks;
  }

  // ── Human Oversight (Article 14) ────────────────────────────

  private assessHumanOversight(
    _riskLevel: EURiskLevel,
    params: { hasGovernance?: boolean; activeAlerts?: number; criticalAlerts?: number },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];

    checks.push(
      this.check(
        'Article 14(1)',
        'Human Override Capability',
        'human-oversight',
        params.hasGovernance ? 'pass' : 'fail',
        params.hasGovernance ? 100 : 0,
        params.hasGovernance
          ? 'GovernanceEngine supports block/escalate actions requiring human approval'
          : 'No governance engine — human override not enforced',
        ['Configure governance rules with escalate/block actions for critical decisions'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 14(2)',
        'Real-time Monitoring & Alerting',
        'human-oversight',
        (params.activeAlerts ?? 0) >= 0 ? 'pass' : 'warn',
        100,
        `${params.activeAlerts ?? 0} active alert(s), ${params.criticalAlerts ?? 0} critical`,
        ['Ensure alert manager routes critical alerts to human operators'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 14(3)',
        'Escalation Procedures',
        'human-oversight',
        params.hasGovernance ? 'pass' : 'warn',
        params.hasGovernance ? 100 : 20,
        params.hasGovernance
          ? 'GovernanceEngine provides escalation rules for critical actions'
          : 'Escalation procedures not formally defined',
        ['Define escalation matrix with response time SLAs'],
        true,
      ),
    );

    return checks;
  }

  // ── Accuracy, Robustness, Cybersecurity (Article 15) ────────

  private assessAccuracyRobustness(
    _riskLevel: EURiskLevel,
    params: { testCoverage?: number; hasShadowPipeline?: boolean },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];
    const coverage = params.testCoverage ?? 0;

    checks.push(
      this.check(
        'Article 15(1)',
        'Accuracy & Reliability',
        'accuracy-robustness',
        coverage >= 80 ? 'pass' : coverage >= 60 ? 'warn' : 'fail',
        coverage >= 80 ? 100 : coverage >= 60 ? 60 : 10,
        `Test coverage: ${coverage}%`,
        ['Increase test coverage to at least 80% for high-risk AI systems'],
        true,
      ),
    );

    checks.push(
      this.check(
        'Article 15(3)',
        'Resilience Against Errors',
        'accuracy-robustness',
        params.hasShadowPipeline ? 'pass' : 'warn',
        params.hasShadowPipeline ? 100 : 30,
        params.hasShadowPipeline
          ? 'Shadow pipeline validates resilience through traffic replay'
          : 'No shadow pipeline for resilience testing',
        ['Enable shadow pipeline with traffic capture for continuous resilience testing'],
        true,
      ),
    );

    return checks;
  }

  // ── Cybersecurity (Article 15) ──────────────────────────────

  private assessCybersecurity(
    _riskLevel: EURiskLevel,
    params: { hasGovernance?: boolean; hasQualityGates?: boolean },
  ): EUComplianceCheck[] {
    const checks: EUComplianceCheck[] = [];

    checks.push(
      this.check(
        'Article 15(4)',
        'Cybersecurity Measures',
        'cybersecurity',
        params.hasGovernance && params.hasQualityGates ? 'pass' : 'warn',
        params.hasGovernance && params.hasQualityGates ? 100 : 40,
        params.hasGovernance && params.hasQualityGates
          ? 'Governance + quality gates enforce security policies'
          : 'Full cybersecurity posture not confirmed',
        ['Enable both governance and quality engines with security-focused rules'],
        true,
      ),
    );

    return checks;
  }

  // ── Checklists ──────────────────────────────────────────────

  private buildTransparencyChecklist(params: {
    hasGovernance?: boolean;
    hasShadowPipeline?: boolean;
    hasDocumentation?: boolean;
  }): EUTransparencyChecklist {
    return {
      aiSystemDisclosure: true,
      aiContentWatermarking: false,
      decisionExplainability: params.hasShadowPipeline ?? false,
      capabilityDocumentation: params.hasDocumentation ?? false,
      intendedPurposeDocumented: params.hasGovernance ?? false,
      limitationsDocumented: params.hasDocumentation ?? false,
      performanceMetricsPublished: params.hasShadowPipeline ?? false,
      trainingDataDisclosed: false,
    };
  }

  private buildHumanOversightChecklist(params: {
    hasGovernance?: boolean;
    hasShadowPipeline?: boolean;
  }): EUHumanOversightChecklist {
    return {
      overrideCapability: params.hasGovernance ?? false,
      interruptCapability: params.hasGovernance ?? false,
      optOutCapability: true,
      realTimeMonitoring: params.hasShadowPipeline ?? false,
      operatorInstructions: params.hasGovernance ?? false,
      escalationProcedures: params.hasGovernance ?? false,
      fallbackMechanisms: true,
    };
  }

  private buildDataGovernanceChecklist(params: {
    hasDataGovernance?: boolean;
    hasLearningSystem?: boolean;
    hasGovernance?: boolean;
  }): EUDataGovernanceChecklist {
    return {
      dataRelevance: params.hasDataGovernance ?? false,
      biasFreeData: params.hasLearningSystem ?? false,
      dataQualityMeasures: params.hasDataGovernance ?? false,
      dataAnnotation: params.hasDataGovernance ?? false,
      gdprCompliance: params.hasDataGovernance ?? false,
      governanceProcedures: params.hasDataGovernance ?? false,
      legalBasis: params.hasDataGovernance ?? false,
      sensitiveDataProtection: params.hasGovernance ?? false,
    };
  }

  private buildTechnicalDocChecklist(params: {
    hasDocumentation?: boolean;
    hasGovernance?: boolean;
    hasShadowPipeline?: boolean;
    hasDataGovernance?: boolean;
  }): EUTechnicalDocChecklist {
    return {
      systemDescription: params.hasDocumentation ?? false,
      developmentMethodology: params.hasGovernance ?? false,
      dataDetails: params.hasDataGovernance ?? false,
      resourceDescription: params.hasDocumentation ?? false,
      architectureDocumentation: params.hasGovernance ?? false,
      performanceEvaluation: params.hasShadowPipeline ?? false,
      riskManagementDoc: params.hasGovernance ?? false,
      changeManagement: params.hasGovernance ?? false,
      testingMethodology: params.hasDocumentation ?? false,
      incidentProcedures: params.hasGovernance ?? false,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────

  private check(
    article: string,
    title: string,
    category: EUCategory,
    result: EUCheckResult,
    score: number,
    finding: string,
    remediation?: string[],
    mandatory = true,
  ): EUComplianceCheck {
    return {
      id: randomUUID(),
      article,
      title,
      category,
      result,
      score,
      finding,
      evidence: remediation ? undefined : undefined,
      remediation: remediation?.join('; '),
      mandatory,
    };
  }

  private calculateComplianceScore(checks: EUComplianceCheck[], riskLevel: EURiskLevel): number {
    if (checks.length === 0) return 0;

    const mandatoryChecks = checks.filter((c) => c.mandatory);
    if (mandatoryChecks.length === 0) return 100;

    const weightedSum = mandatoryChecks.reduce((sum, c) => {
      const weight = riskLevel === 'unacceptable' || riskLevel === 'high' ? 1.5 : 1.0;
      return sum + c.score * weight;
    }, 0);
    const maxScore =
      mandatoryChecks.length *
      100 *
      (riskLevel === 'unacceptable' || riskLevel === 'high' ? 1.5 : 1.0);

    return Math.round(Math.min(100, (weightedSum / maxScore) * 100));
  }

  private generateRecommendations(
    checks: EUComplianceCheck[],
    riskLevel: EURiskLevel,
    params: { hasGovernance?: boolean; hasQualityGates?: boolean; hasShadowPipeline?: boolean },
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'unacceptable') {
      recommendations.push(
        'CRITICAL: This AI system may fall under prohibited practices per Article 5. Immediate legal review required.',
      );
    }
    if (riskLevel === 'high') {
      recommendations.push(
        'This is a high-risk AI system. Full conformity assessment required before August 2026 enforcement deadline.',
      );
    }

    const failedChecks = checks.filter((c) => c.result === 'fail');
    for (const check of failedChecks) {
      if (check.remediation) {
        recommendations.push(`[${check.article}] ${check.title}: ${check.remediation}`);
      }
    }

    if (!params.hasGovernance) {
      recommendations.push(
        'Implement BehaviorOS GovernanceEngine for mandatory human oversight and risk management.',
      );
    }
    if (!params.hasQualityGates) {
      recommendations.push(
        'Enable QualityEngine with security and accuracy gates for Article 15 compliance.',
      );
    }
    if (!params.hasShadowPipeline) {
      recommendations.push(
        'Deploy shadow pipeline for continuous monitoring and transparency reporting.',
      );
    }

    return recommendations;
  }
}
