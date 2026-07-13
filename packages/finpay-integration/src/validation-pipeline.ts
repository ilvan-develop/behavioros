import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { AuditEngine, LearningEngine } from '@behavioros/core';
import type { FinPayClient } from './finpay-client';
import type {
  ComplianceResult,
  FraudSignal,
  OCRResult,
  PaymentEvidence,
  ReconciliationEntry,
  ReconciliationType,
  TrustScoreDecision,
  ValidationPipelineResult,
  ValidationStatus,
} from './types';

// ============================================================
// Payment Validation Pipeline
// ============================================================

export type PipelineStage =
  | 'evidence_upload'
  | 'ocr'
  | 'compliance'
  | 'fraud_detection'
  | 'trust_score'
  | 'reconciliation'
  | 'complete';

export interface PipelineEvents {
  'stage:start': [stage: PipelineStage, paymentId: string];
  'stage:complete': [stage: PipelineStage, paymentId: string, durationMs: number];
  'stage:error': [stage: PipelineStage, paymentId: string, error: Error];
  'pipeline:complete': [result: ValidationPipelineResult];
  'pipeline:error': [paymentId: string, error: Error];
}

export class PaymentValidationPipeline extends EventEmitter {
  private readonly auditEngine: AuditEngine;
  private readonly learningEngine: LearningEngine;
  private client: FinPayClient | null = null;
  private results = new Map<string, ValidationPipelineResult>();

  constructor() {
    super();
    this.auditEngine = new AuditEngine();
    this.learningEngine = new LearningEngine();
  }

  setClient(client: FinPayClient): void {
    this.client = client;
  }

  async validatePayment(
    paymentId: string,
    evidence: PaymentEvidence,
  ): Promise<ValidationPipelineResult> {
    const start = Date.now();
    const status: ValidationStatus = 'pending';
    const result: ValidationPipelineResult = {
      paymentId,
      status,
      trustScore: { decision: 'manual_review', score: 0, factors: [], confidence: 0 },
      fraudSignals: [],
      complianceResult: { passed: false, violations: [], warnings: [], score: 0 },
      recommendation: 'manual_review',
      completedAt: null,
    };

    try {
      // Stage 1: OCR
      this.emitStage('ocr', paymentId);
      const ocrStart = Date.now();
      let ocrResult: OCRResult | null = null;
      if (evidence.fileUrl) {
        ocrResult = await this.runOCR(evidence.fileUrl);
      }
      result.status = 'ocr_complete';
      this.emitStageComplete('ocr', paymentId, Date.now() - ocrStart);

      // Stage 2: Compliance
      this.emitStage('compliance', paymentId);
      const complianceStart = Date.now();
      const complianceInput = {
        paymentId,
        ocrResult,
        evidenceType: evidence.type,
        trustScore: evidence.trustScore,
      };
      result.complianceResult = await this.runComplianceCheck(complianceInput);
      result.status = 'compliance_complete';
      this.emitStageComplete('compliance', paymentId, Date.now() - complianceStart);

      // Stage 3: Fraud Detection
      this.emitStage('fraud_detection', paymentId);
      const fraudStart = Date.now();
      const fraudInput = {
        paymentId,
        ocrResult,
        complianceResult: result.complianceResult,
        evidenceType: evidence.type,
      };
      result.fraudSignals = await this.runFraudDetection(fraudInput);
      result.status = 'fraud_complete';
      this.emitStageComplete('fraud_detection', paymentId, Date.now() - fraudStart);

      // Stage 4: Trust Score
      this.emitStage('trust_score', paymentId);
      const trustStart = Date.now();
      result.trustScore = await this.calculateTrustScore(
        result.complianceResult,
        result.fraudSignals,
      );
      result.status = 'trust_scored';
      result.recommendation = result.trustScore.decision;
      this.emitStageComplete('trust_score', paymentId, Date.now() - trustStart);

      // Stage 5: Reconciliation
      this.emitStage('reconciliation', paymentId);
      const reconStart = Date.now();
      await this.reconcile(paymentId, result.trustScore);
      result.status = 'reconciled';
      this.emitStageComplete('reconciliation', paymentId, Date.now() - reconStart);

      result.completedAt = new Date().toISOString();
      result.status = 'reconciled';
      this.results.set(paymentId, result);

      // Record learning event
      this.learningEngine.record({
        type: 'insight',
        source: 'payment_validation',
        data: {
          paymentId,
          recommendation: result.recommendation,
          trustScore: result.trustScore.score,
          fraudSignalCount: result.fraudSignals.length,
        },
        confidence: result.trustScore.confidence,
        applied: result.recommendation === 'approve',
      });

      this.emit('pipeline:complete', result);
    } catch (error) {
      result.status = 'failed';
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('pipeline:error', paymentId, err);
      throw err;
    }

    return result;
  }

  async runOCR(fileUrl: string): Promise<OCRResult> {
    const extractedFields: Record<string, string> = {};

    // Simulate OCR extraction from the file URL
    const urlParts = fileUrl.split('/');
    const filename = urlParts[urlParts.length - 1] ?? 'unknown';
    extractedFields['source_file'] = filename;

    return {
      text: `OCR extracted text from ${filename}`,
      confidence: 0.92,
      fields: extractedFields,
      extractedAt: new Date().toISOString(),
    };
  }

  async runComplianceCheck(data: {
    paymentId: string;
    ocrResult: OCRResult | null;
    evidenceType: string;
    trustScore: number;
  }): Promise<ComplianceResult> {
    const violations: string[] = [];
    const warnings: string[] = [];
    let score = 100;

    if (!data.ocrResult) {
      warnings.push('No OCR result available for evidence verification');
      score -= 10;
    }

    if (data.ocrResult && data.ocrResult.confidence < 0.7) {
      warnings.push(`Low OCR confidence: ${data.ocrResult.confidence}`);
      score -= 5;
    }

    if (data.evidenceType === 'prescription' && data.trustScore < 0.5) {
      violations.push('Prescription trust score below minimum threshold');
      score -= 30;
    }

    if (data.evidenceType === 'document' && data.trustScore < 0.3) {
      violations.push('Document trust score critically low');
      score -= 50;
    }

    return {
      passed: violations.length === 0 && score >= 60,
      violations,
      warnings,
      score: Math.max(0, score),
    };
  }

  async runFraudDetection(data: {
    paymentId: string;
    ocrResult: OCRResult | null;
    complianceResult: ComplianceResult;
    evidenceType: string;
  }): Promise<FraudSignal[]> {
    const signals: FraudSignal[] = [];

    if (data.complianceResult.score < 50) {
      signals.push({
        type: 'amount_mismatch',
        severity: 'high',
        details: `Low compliance score (${data.complianceResult.score}) suggests potential fraud`,
        detectedAt: new Date().toISOString(),
      });
    }

    if (data.complianceResult.violations.length > 2) {
      signals.push({
        type: 'velocity',
        severity: 'medium',
        details: `${data.complianceResult.violations.length} compliance violations detected`,
        detectedAt: new Date().toISOString(),
      });
    }

    if (data.ocrResult && data.ocrResult.confidence < 0.5) {
      signals.push({
        type: 'gps_anomaly',
        severity: 'low',
        details: 'Very low OCR confidence may indicate tampered evidence',
        detectedAt: new Date().toISOString(),
      });
    }

    return signals;
  }

  async calculateTrustScore(
    compliance: ComplianceResult,
    fraudSignals: FraudSignal[],
  ): Promise<TrustScoreDecision> {
    let score = compliance.score;
    const factors: string[] = [];

    // Compliance contribution
    factors.push(`compliance_score:${compliance.score}`);
    if (compliance.passed) {
      score = Math.min(100, score + 10);
      factors.push('compliance_passed:+10');
    } else {
      score = Math.max(0, score - 20);
      factors.push('compliance_failed:-20');
    }

    // Fraud signal penalties
    for (const signal of fraudSignals) {
      const penalty =
        signal.severity === 'critical'
          ? 40
          : signal.severity === 'high'
            ? 25
            : signal.severity === 'medium'
              ? 15
              : 5;
      score = Math.max(0, score - penalty);
      factors.push(`${signal.type}_${signal.severity}:-${penalty}`);
    }

    const normalizedScore = Math.max(0, Math.min(100, score));

    let decision: TrustScoreDecision['decision'];
    if (normalizedScore >= 70) {
      decision = 'approve';
    } else if (normalizedScore < 40) {
      decision = 'reject';
    } else {
      decision = 'manual_review';
    }

    const confidence =
      fraudSignals.length === 0 ? 0.9 : Math.max(0.3, 0.9 - fraudSignals.length * 0.15);

    return {
      decision,
      score: normalizedScore,
      factors,
      confidence,
    };
  }

  async reconcile(paymentId: string, decision: TrustScoreDecision): Promise<ReconciliationEntry[]> {
    let ledger: string;
    let type: ReconciliationType;

    if (decision.decision === 'approve') {
      ledger = 'approved_payments';
      type = 'payment';
    } else if (decision.decision === 'reject') {
      ledger = 'rejected_payments';
      type = 'adjustment';
    } else {
      ledger = 'pending_review';
      type = 'payment';
    }

    const entry: ReconciliationEntry = {
      id: randomUUID(),
      paymentId,
      type,
      amount: 0,
      timestamp: new Date().toISOString(),
      ledger,
    };

    return [entry];
  }

  getResult(paymentId: string): ValidationPipelineResult | undefined {
    return this.results.get(paymentId);
  }

  getAllResults(): ValidationPipelineResult[] {
    return [...this.results.values()];
  }

  getLearningReport() {
    return this.learningEngine.generateReport();
  }

  private emitStage(stage: PipelineStage, paymentId: string): void {
    this.emit('stage:start', stage, paymentId);
  }

  private emitStageComplete(stage: PipelineStage, paymentId: string, durationMs: number): void {
    this.emit('stage:complete', stage, paymentId, durationMs);
  }
}
