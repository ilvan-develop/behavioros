import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComplianceResult, FraudSignal, PaymentEvidence, TrustScoreDecision } from '../types';
import { PaymentValidationPipeline } from '../validation-pipeline';

// ============================================================
// Payment Validation Pipeline Tests
// ============================================================

function createEvidence(overrides?: Partial<PaymentEvidence>): PaymentEvidence {
  return {
    id: 'ev_1',
    paymentId: 'pi_1',
    type: 'receipt',
    fileUrl: 'https://storage.example.com/evidence/receipt_001.pdf',
    ocrResult: null,
    trustScore: 0.8,
    uploadedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('PaymentValidationPipeline', () => {
  let pipeline: PaymentValidationPipeline;

  beforeEach(() => {
    pipeline = new PaymentValidationPipeline();
  });

  describe('validatePayment', () => {
    it('should complete full pipeline successfully', async () => {
      const evidence = createEvidence();
      const result = await pipeline.validatePayment('pi_1', evidence);

      expect(result.paymentId).toBe('pi_1');
      expect(result.status).toBe('reconciled');
      expect(result.completedAt).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it('should emit pipeline events', async () => {
      const startEvents: string[] = [];
      const completeEvents: string[] = [];

      pipeline.on('stage:start', (stage) => startEvents.push(stage));
      pipeline.on('stage:complete', (stage) => completeEvents.push(stage));

      await pipeline.validatePayment('pi_1', createEvidence());

      expect(startEvents.length).toBeGreaterThan(0);
      expect(completeEvents.length).toBe(startEvents.length);
    });

    it('should emit pipeline:complete', async () => {
      let completedResult: unknown = null;
      pipeline.on('pipeline:complete', (result) => {
        completedResult = result;
      });

      await pipeline.validatePayment('pi_1', createEvidence());

      expect(completedResult).toBeDefined();
    });

    it('should store results', async () => {
      await pipeline.validatePayment('pi_1', createEvidence());

      const result = pipeline.getResult('pi_1');
      expect(result).toBeDefined();
      expect(result?.paymentId).toBe('pi_1');
    });

    it('should return all results', async () => {
      await pipeline.validatePayment('pi_1', createEvidence());
      await pipeline.validatePayment('pi_2', createEvidence({ paymentId: 'pi_2' }));

      const allResults = pipeline.getAllResults();
      expect(allResults).toHaveLength(2);
    });
  });

  describe('runOCR', () => {
    it('should extract OCR data from file URL', async () => {
      const result = await pipeline.runOCR('https://storage.example.com/receipt.pdf');

      expect(result.text).toContain('receipt.pdf');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.fields['source_file']).toBe('receipt.pdf');
      expect(result.extractedAt).toBeDefined();
    });
  });

  describe('runComplianceCheck', () => {
    it('should pass with valid data', async () => {
      const result = await pipeline.runComplianceCheck({
        paymentId: 'pi_1',
        ocrResult: { text: 'valid', confidence: 0.95, fields: {}, extractedAt: '' },
        evidenceType: 'receipt',
        trustScore: 0.9,
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.score).toBeGreaterThan(80);
    });

    it('should warn on low OCR confidence', async () => {
      const result = await pipeline.runComplianceCheck({
        paymentId: 'pi_1',
        ocrResult: { text: 'partial', confidence: 0.4, fields: {}, extractedAt: '' },
        evidenceType: 'receipt',
        trustScore: 0.8,
      });

      expect(result.warnings.some((w) => w.includes('Low OCR confidence'))).toBe(true);
    });

    it('should fail on prescription with low trust score', async () => {
      const result = await pipeline.runComplianceCheck({
        paymentId: 'pi_1',
        ocrResult: { text: 'data', confidence: 0.9, fields: {}, extractedAt: '' },
        evidenceType: 'prescription',
        trustScore: 0.3,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should warn when no OCR result', async () => {
      const result = await pipeline.runComplianceCheck({
        paymentId: 'pi_1',
        ocrResult: null,
        evidenceType: 'receipt',
        trustScore: 0.8,
      });

      expect(result.warnings.some((w) => w.includes('No OCR result'))).toBe(true);
    });
  });

  describe('runFraudDetection', () => {
    it('should detect low compliance as fraud signal', async () => {
      const signals = await pipeline.runFraudDetection({
        paymentId: 'pi_1',
        ocrResult: null,
        complianceResult: { passed: false, violations: ['a', 'b', 'c'], warnings: [], score: 30 },
        evidenceType: 'receipt',
      });

      expect(signals.length).toBeGreaterThan(0);
      expect(signals.some((s) => s.type === 'amount_mismatch')).toBe(true);
    });

    it('should detect velocity with many violations', async () => {
      const signals = await pipeline.runFraudDetection({
        paymentId: 'pi_1',
        ocrResult: null,
        complianceResult: {
          passed: false,
          violations: ['v1', 'v2', 'v3'],
          warnings: [],
          score: 40,
        },
        evidenceType: 'document',
      });

      expect(signals.some((s) => s.type === 'velocity')).toBe(true);
    });

    it('should return empty for clean data', async () => {
      const signals = await pipeline.runFraudDetection({
        paymentId: 'pi_1',
        ocrResult: { text: 'clean', confidence: 0.95, fields: {}, extractedAt: '' },
        complianceResult: { passed: true, violations: [], warnings: [], score: 95 },
        evidenceType: 'receipt',
      });

      expect(signals).toHaveLength(0);
    });
  });

  describe('calculateTrustScore', () => {
    it('should approve with high compliance and no fraud', async () => {
      const decision = await pipeline.calculateTrustScore(
        { passed: true, violations: [], warnings: [], score: 90 },
        [],
      );

      expect(decision.decision).toBe('approve');
      expect(decision.score).toBeGreaterThan(70);
      expect(decision.confidence).toBeGreaterThan(0.8);
    });

    it('should reject with low compliance and fraud', async () => {
      const decision = await pipeline.calculateTrustScore(
        { passed: false, violations: ['v1', 'v2'], warnings: [], score: 30 },
        [
          { type: 'amount_mismatch', severity: 'critical', details: '', detectedAt: '' },
          { type: 'velocity', severity: 'high', details: '', detectedAt: '' },
        ],
      );

      expect(decision.decision).toBe('reject');
      expect(decision.score).toBeLessThan(40);
    });

    it('should manual_review for mid-range scores', async () => {
      const decision = await pipeline.calculateTrustScore(
        { passed: false, violations: ['v1'], warnings: [], score: 75 },
        [{ type: 'velocity', severity: 'low', details: '', detectedAt: '' }],
      );

      expect(decision.decision).toBe('manual_review');
    });

    it('should reduce confidence with more fraud signals', async () => {
      const decision1 = await pipeline.calculateTrustScore(
        { passed: true, violations: [], warnings: [], score: 80 },
        [],
      );

      const decision2 = await pipeline.calculateTrustScore(
        { passed: true, violations: [], warnings: [], score: 80 },
        [
          { type: 'velocity', severity: 'low', details: '', detectedAt: '' },
          { type: 'gps_anomaly', severity: 'low', details: '', detectedAt: '' },
        ],
      );

      expect(decision2.confidence).toBeLessThan(decision1.confidence);
    });
  });

  describe('reconcile', () => {
    it('should create approved payment entry', async () => {
      const entries = await pipeline.reconcile('pi_1', {
        decision: 'approve',
        score: 90,
        factors: [],
        confidence: 0.9,
      });

      expect(entries).toHaveLength(1);
      expect(entries[0].ledger).toBe('approved_payments');
      expect(entries[0].paymentId).toBe('pi_1');
    });

    it('should create rejected adjustment entry', async () => {
      const entries = await pipeline.reconcile('pi_1', {
        decision: 'reject',
        score: 20,
        factors: [],
        confidence: 0.5,
      });

      expect(entries[0].ledger).toBe('rejected_payments');
      expect(entries[0].type).toBe('adjustment');
    });

    it('should create pending review entry', async () => {
      const entries = await pipeline.reconcile('pi_1', {
        decision: 'manual_review',
        score: 55,
        factors: [],
        confidence: 0.6,
      });

      expect(entries[0].ledger).toBe('pending_review');
    });
  });

  describe('learning integration', () => {
    it('should record learning events after validation', async () => {
      await pipeline.validatePayment('pi_1', createEvidence());

      const report = pipeline.getLearningReport();
      expect(report.totalEvents).toBeGreaterThan(0);
    });
  });
});
