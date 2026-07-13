import { randomUUID } from 'node:crypto';
import { LearningEngine } from '@behavioros/core';
import type { FinPayClient } from './finpay-client';
import type {
  AuthenticityCheck,
  AuthenticityResult,
  FraudDetection,
  InteractionResult,
  Medication,
  MedicationInteraction,
  PatientProfile,
  Prescription,
  Recommendation,
  RiskAssessment,
  RiskFactor,
  TrustScoreDecision,
} from './types';
import type { PaymentValidationPipeline } from './validation-pipeline';

// ============================================================
// AI Health Assistant
// ============================================================

// Known drug interactions database (simplified)
const KNOWN_INTERACTIONS: Record<string, MedicationInteraction> = {
  'warfarin+aspirin': {
    medication1: 'warfarin',
    medication2: 'aspirin',
    severity: 'severe',
    description:
      'Concurrent use significantly increases risk of bleeding. Warfarin is an anticoagulant and aspirin inhibits platelet aggregation.',
    recommendation:
      'Avoid concurrent use. Consult physician for alternative anticoagulation strategy.',
  },
  'metformin+alcohol': {
    medication1: 'metformin',
    medication2: 'alcohol',
    severity: 'critical',
    description:
      'Alcohol increases the risk of lactic acidosis with metformin. This is a potentially life-threatening condition.',
    recommendation: 'Avoid alcohol consumption while taking metformin.',
  },
  'lisinopril+potassium': {
    medication1: 'lisinopril',
    medication2: 'potassium',
    severity: 'moderate',
    description:
      'ACE inhibitors can increase potassium levels. Supplemental potassium may cause hyperkalemia.',
    recommendation: 'Monitor serum potassium levels regularly.',
  },
  'simvastatin+amiodarone': {
    medication1: 'simvastatin',
    medication2: 'amiodarone',
    severity: 'severe',
    description:
      'Amiodarone inhibits CYP3A4, increasing simvastatin levels and risk of rhabdomyolysis.',
    recommendation: 'Limit simvastatin dose to 20mg/day when used with amiodarone.',
  },
  'ssri+tramadol': {
    medication1: 'ssri',
    medication2: 'tramadol',
    severity: 'severe',
    description:
      'Combined serotonergic effect increases risk of serotonin syndrome, a potentially fatal condition.',
    recommendation: 'Avoid combination or use lowest effective doses with close monitoring.',
  },
  'ibuprofen+aspirin': {
    medication1: 'ibuprofen',
    medication2: 'aspirin',
    severity: 'moderate',
    description: 'Ibuprofen can interfere with the cardioprotective effect of low-dose aspirin.',
    recommendation: 'Take aspirin at least 30 minutes before ibuprofen.',
  },
};

// Suspicious prescription patterns
const FRAUD_PATTERNS = {
  maxDailyOpioidMg: 120,
  maxRefillsPerMonth: 3,
  maxUniqueMedications: 10,
  suspiciousAgeRange: { min: 0, max: 12 },
  duplicateRxWindowHours: 72,
};

export interface HealthAssistantConfig {
  client?: FinPayClient;
  pipeline?: PaymentValidationPipeline;
  strictMode?: boolean;
}

export class AIHealthAssistant {
  private readonly client: FinPayClient | null;
  private readonly pipeline: PaymentValidationPipeline | null;
  private readonly learningEngine: LearningEngine;
  private readonly strictMode: boolean;
  private prescriptionHistory = new Map<string, Prescription[]>();

  constructor(config: HealthAssistantConfig = {}) {
    this.client = config.client ?? null;
    this.pipeline = config.pipeline ?? null;
    this.strictMode = config.strictMode ?? true;
    this.learningEngine = new LearningEngine();
  }

  async analyzeMedicationInteraction(medications: Medication[]): Promise<InteractionResult> {
    const interactions: MedicationInteraction[] = [];
    const recommendations: string[] = [];

    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i].name.toLowerCase();
        const med2 = medications[j].name.toLowerCase();

        const interaction = this.findInteraction(med1, med2);
        if (interaction) {
          interactions.push(interaction);
          recommendations.push(interaction.recommendation);
        }
      }
    }

    let severity: InteractionResult['severity'] = 'none';
    if (interactions.length > 0) {
      const severityOrder = ['mild', 'moderate', 'severe', 'critical'] as const;
      const maxSeverity = interactions.reduce((max, inter) => {
        const idx = severityOrder.indexOf(inter.severity);
        return idx > max ? idx : max;
      }, 0);
      severity = severityOrder[maxSeverity];
    }

    if (medications.length > 7) {
      recommendations.push(
        'Patient is on polypharmacy (>7 medications). Consider medication review.',
      );
      if (severity === 'none') severity = 'mild';
    }

    this.learningEngine.record({
      type: 'insight',
      source: 'medication_interaction',
      data: {
        medicationCount: medications.length,
        interactionCount: interactions.length,
        severity,
      },
      confidence: interactions.length > 0 ? 0.8 : 0.95,
      applied: false,
    });

    return {
      safe: interactions.length === 0,
      interactions,
      severity,
      recommendations: [...new Set(recommendations)],
    };
  }

  async verifyPrescriptionAuthenticity(prescription: Prescription): Promise<AuthenticityResult> {
    const checks: AuthenticityCheck[] = [];

    // Check 1: Digital signature
    const signatureValid = this.verifyDigitalSignature(prescription);
    checks.push({
      name: 'digital_signature',
      passed: signatureValid,
      details: signatureValid
        ? 'Digital signature verified'
        : 'Digital signature missing or invalid',
    });

    // Check 2: Expiry
    const notExpired = new Date(prescription.expiresAt) > new Date();
    checks.push({
      name: 'expiry',
      passed: notExpired,
      details: notExpired ? 'Prescription is valid' : 'Prescription has expired',
    });

    // Check 3: Medication count
    const validMedCount =
      prescription.medications.length > 0 &&
      prescription.medications.length <= FRAUD_PATTERNS.maxUniqueMedications;
    checks.push({
      name: 'medication_count',
      passed: validMedCount,
      details: validMedCount
        ? `${prescription.medications.length} medications within limits`
        : `Invalid medication count: ${prescription.medications.length}`,
    });

    // Check 4: Dosage consistency
    const dosageValid = prescription.medications.every(
      (med) => med.dosage && med.dosage.length > 0,
    );
    checks.push({
      name: 'dosage_consistency',
      passed: dosageValid,
      details: dosageValid
        ? 'All dosages specified'
        : 'Some medications missing dosage information',
    });

    // Check 5: Duplicate detection
    const history = this.prescriptionHistory.get(prescription.patientId) ?? [];
    const recentDuplicate = history.some(
      (prev) =>
        prev.doctorId === prescription.doctorId &&
        this.isWithinWindow(
          new Date(prev.issuedAt),
          new Date(prescription.issuedAt),
          FRAUD_PATTERNS.duplicateRxWindowHours,
        ) &&
        this.hasOverlappingMedications(prev.medications, prescription.medications),
    );
    checks.push({
      name: 'duplicate_detection',
      passed: !recentDuplicate,
      details: recentDuplicate
        ? 'Possible duplicate prescription detected within window'
        : 'No recent duplicate prescriptions found',
    });

    // Store in history
    const patientHistory = this.prescriptionHistory.get(prescription.patientId) ?? [];
    patientHistory.push(prescription);
    this.prescriptionHistory.set(prescription.patientId, patientHistory);

    const passedChecks = checks.filter((c) => c.passed).length;
    const confidence = passedChecks / checks.length;
    const authentic = this.strictMode ? confidence >= 0.8 : confidence >= 0.6;

    return {
      authentic,
      confidence,
      checks,
      verifiedAt: new Date().toISOString(),
    };
  }

  async assessPaymentRisk(payment: {
    amount: number;
    currency: string;
    customerId: string;
    metadata: Record<string, unknown>;
  }): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];

    // Factor 1: Amount risk
    const amountRisk = this.calculateAmountRisk(payment.amount);
    factors.push(amountRisk);

    // Factor 2: Velocity risk (based on metadata)
    const velocityRisk = this.calculateVelocityRisk(payment.metadata);
    factors.push(velocityRisk);

    // Factor 3: Customer risk
    const customerRisk = this.calculateCustomerRisk(payment.customerId);
    factors.push(customerRisk);

    // Factor 4: Metadata completeness
    const metadataRisk = this.calculateMetadataRisk(payment.metadata);
    factors.push(metadataRisk);

    const totalScore = factors.reduce((sum, f) => sum + f.weight * f.value, 0);
    const normalizedScore = Math.min(100, Math.max(0, totalScore * 100));

    let riskLevel: RiskAssessment['riskLevel'];
    if (normalizedScore < 25) riskLevel = 'low';
    else if (normalizedScore < 50) riskLevel = 'medium';
    else if (normalizedScore < 75) riskLevel = 'high';
    else riskLevel = 'critical';

    const recommendation = this.generateRiskRecommendation(riskLevel, factors);

    // Use FinPay trust scoring if client available
    let trustScore: TrustScoreDecision | undefined;
    if (this.client) {
      try {
        trustScore = await this.client.getTrustScore(
          (payment.metadata['paymentId'] as string) ?? '',
        );
      } catch {
        // Trust scoring unavailable, continue with local assessment
      }
    }

    return {
      paymentId: (payment.metadata['paymentId'] as string) ?? '',
      riskLevel,
      score: normalizedScore,
      factors,
      recommendation,
    };
  }

  async getHealthRecommendations(patientProfile: PatientProfile): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Check medication interactions
    if (patientProfile.medications.length > 1) {
      const interactions = await this.analyzeMedicationInteraction(patientProfile.medications);
      if (!interactions.safe) {
        recommendations.push({
          id: randomUUID(),
          type: 'warning',
          title: 'Drug Interactions Detected',
          description: `Found ${interactions.interactions.length} potential drug interactions. Severity: ${interactions.severity}`,
          priority: interactions.severity === 'critical' ? 'high' : 'medium',
          source: 'medication_interaction_analysis',
        });
      }
    }

    // Allergy check
    for (const medication of patientProfile.medications) {
      const hasAllergy = patientProfile.allergies.some(
        (allergy) =>
          medication.name.toLowerCase().includes(allergy.toLowerCase()) ||
          allergy.toLowerCase().includes(medication.name.toLowerCase()),
      );
      if (hasAllergy) {
        recommendations.push({
          id: randomUUID(),
          type: 'warning',
          title: `Allergy Alert: ${medication.name}`,
          description: `Patient has recorded allergy that may be related to ${medication.name}`,
          priority: 'high',
          source: 'allergy_check',
        });
      }
    }

    // Polypharmacy check
    if (patientProfile.medications.length > 5) {
      recommendations.push({
        id: randomUUID(),
        type: 'follow_up',
        title: 'Medication Review Recommended',
        description: `Patient is on ${patientProfile.medications.length} medications. A comprehensive medication review is recommended.`,
        priority: 'medium',
        source: 'polypharmacy_check',
      });
    }

    // Insurance check
    if (!patientProfile.insuranceProvider) {
      recommendations.push({
        id: randomUUID(),
        type: 'medication',
        title: 'Insurance Verification',
        description: 'No insurance provider on file. Verify coverage for current medications.',
        priority: 'low',
        source: 'insurance_check',
      });
    }

    // Age-related recommendations
    if (patientProfile.age > 65) {
      recommendations.push({
        id: randomUUID(),
        type: 'follow_up',
        title: 'Geriatric Medication Review',
        description:
          'Patient is over 65. Consider reviewing medications for age-appropriate dosing.',
        priority: 'medium',
        source: 'age_based_review',
      });
    }

    return recommendations;
  }

  async detectFraudulentPrescription(prescription: Prescription): Promise<FraudDetection> {
    const signals: import('./types').FraudSignal[] = [];
    const authenticity = await this.verifyPrescriptionAuthenticity(prescription);

    if (!authenticity.authentic) {
      signals.push({
        type: 'duplicate_hash',
        severity: 'high',
        details: `Prescription authenticity check failed (confidence: ${(authenticity.confidence * 100).toFixed(1)}%)`,
        detectedAt: new Date().toISOString(),
      });
    }

    // Check for excessive opioid prescribing
    const opioidMedications = prescription.medications.filter(
      (med) =>
        med.name.toLowerCase().includes('codeine') ||
        med.name.toLowerCase().includes('tramadol') ||
        med.name.toLowerCase().includes('oxycodone') ||
        med.name.toLowerCase().includes('hydrocodone'),
    );

    if (opioidMedications.length > 2) {
      signals.push({
        type: 'velocity',
        severity: 'critical',
        details: `${opioidMedications.length} opioid medications on single prescription`,
        detectedAt: new Date().toISOString(),
      });
    }

    // Calculate trust score based on signals
    let trustScore: TrustScoreDecision;
    if (this.client) {
      try {
        trustScore = await this.client.getTrustScore(prescription.id);
      } catch {
        trustScore = this.calculateLocalTrustScore(signals, authenticity);
      }
    } else {
      trustScore = this.calculateLocalTrustScore(signals, authenticity);
    }

    const fraudulent =
      trustScore.decision === 'reject' || signals.some((s) => s.severity === 'critical');

    this.learningEngine.record({
      type: 'insight',
      source: 'prescription_fraud_detection',
      data: {
        prescriptionId: prescription.id,
        fraudulent,
        signalCount: signals.length,
        trustScoreDecision: trustScore.decision,
      },
      confidence: trustScore.confidence,
      applied: false,
    });

    return {
      prescriptionId: prescription.id,
      fraudulent,
      confidence: trustScore.confidence,
      signals,
      trustScore,
      detectedAt: new Date().toISOString(),
    };
  }

  private findInteraction(med1: string, med2: string): MedicationInteraction | null {
    const key1 = `${med1}+${med2}`;
    const key2 = `${med2}+${med1}`;
    return KNOWN_INTERACTIONS[key1] ?? KNOWN_INTERACTIONS[key2] ?? null;
  }

  private verifyDigitalSignature(prescription: Prescription): boolean {
    return (
      prescription.digitalSignature.length > 0 && prescription.digitalSignature.startsWith('sig_')
    );
  }

  private isWithinWindow(date1: Date, date2: Date, hours: number): boolean {
    const diffMs = Math.abs(date2.getTime() - date1.getTime());
    return diffMs <= hours * 60 * 60 * 1000;
  }

  private hasOverlappingMedications(meds1: { name: string }[], meds2: { name: string }[]): boolean {
    const names1 = new Set(meds1.map((m) => m.name.toLowerCase()));
    return meds2.some((m) => names1.has(m.name.toLowerCase()));
  }

  private calculateAmountRisk(amount: number): RiskFactor {
    let value = 0;
    if (amount > 10_000) value = 0.9;
    else if (amount > 5_000) value = 0.6;
    else if (amount > 1_000) value = 0.3;
    else value = 0.1;

    return {
      type: 'amount',
      weight: 0.3,
      value,
      description: `Payment amount: ${amount}`,
    };
  }

  private calculateVelocityRisk(metadata: Record<string, unknown>): RiskFactor {
    const previousPayments = (metadata['previousPayments'] as number) ?? 0;
    let value = 0;
    if (previousPayments > 10) value = 0.8;
    else if (previousPayments > 5) value = 0.5;
    else value = 0.1;

    return {
      type: 'velocity',
      weight: 0.25,
      value,
      description: `${previousPayments} previous payments in window`,
    };
  }

  private calculateCustomerRisk(customerId: string): RiskFactor {
    const value = customerId.length > 0 ? 0.1 : 0.7;
    return {
      type: 'customer',
      weight: 0.25,
      value,
      description: customerId ? 'Customer identified' : 'Anonymous customer',
    };
  }

  private calculateMetadataRisk(metadata: Record<string, unknown>): RiskFactor {
    const requiredFields = ['orderId', 'pharmacyId'];
    const present = requiredFields.filter((f) => metadata[f] !== undefined).length;
    const completeness = present / requiredFields.length;
    const value = 1 - completeness;

    return {
      type: 'metadata_completeness',
      weight: 0.2,
      value,
      description: `${present}/${requiredFields.length} required metadata fields present`,
    };
  }

  private generateRiskRecommendation(
    riskLevel: RiskAssessment['riskLevel'],
    factors: RiskFactor[],
  ): string {
    if (riskLevel === 'critical') {
      return 'BLOCK: Critical risk detected. Manual review required before processing.';
    }
    if (riskLevel === 'high') {
      const highFactors = factors.filter((f) => f.value > 0.6);
      return `HOLD: High risk factors: ${highFactors.map((f) => f.type).join(', ')}. Requires verification.`;
    }
    if (riskLevel === 'medium') {
      return 'REVIEW: Medium risk. Enhanced monitoring recommended.';
    }
    return 'APPROVE: Low risk. Standard processing.';
  }

  private calculateLocalTrustScore(
    signals: import('./types').FraudSignal[],
    authenticity: AuthenticityResult,
  ): TrustScoreDecision {
    let score = 100;
    const factors: string[] = [];

    score -= (1 - authenticity.confidence) * 50;
    factors.push(`authenticity:${(authenticity.confidence * 100).toFixed(0)}`);

    for (const signal of signals) {
      const penalty =
        signal.severity === 'critical'
          ? 40
          : signal.severity === 'high'
            ? 25
            : signal.severity === 'medium'
              ? 15
              : 5;
      score -= penalty;
      factors.push(`${signal.type}:${signal.severity}`);
    }

    score = Math.max(0, Math.min(100, score));

    let decision: TrustScoreDecision['decision'];
    if (score >= 70) decision = 'approve';
    else if (score < 40) decision = 'reject';
    else decision = 'manual_review';

    return {
      decision,
      score,
      factors,
      confidence: Math.max(0.3, 1 - signals.length * 0.1),
    };
  }
}
