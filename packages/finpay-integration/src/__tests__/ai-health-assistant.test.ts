import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIHealthAssistant } from '../ai-health-assistant';
import type { FinPayClient } from '../finpay-client';
import type { Medication, PatientProfile, Prescription } from '../types';

// ============================================================
// AI Health Assistant Tests
// ============================================================

function createMockClient(): FinPayClient {
  return {
    createPaymentIntent: vi.fn(),
    uploadEvidence: vi.fn(),
    getValidationResult: vi.fn(),
    getTrustScore: vi.fn().mockResolvedValue({
      decision: 'approve',
      score: 85,
      factors: [],
      confidence: 0.9,
    }),
    processRefund: vi.fn(),
    getReconciliation: vi.fn(),
  } as unknown as FinPayClient;
}

function createMedication(overrides?: Partial<Medication>): Medication {
  return {
    name: 'Amoxicilina',
    dosage: '500mg',
    frequency: '3x/day',
    startDate: '2026-01-01',
    ...overrides,
  };
}

function createPrescription(overrides?: Partial<Prescription>): Prescription {
  return {
    id: 'rx_test_1',
    patientId: 'patient_1',
    doctorId: 'doctor_1',
    medications: [createMedication()],
    issuedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-12-31T23:59:59Z',
    digitalSignature: 'sig_dr_1_valid',
    pdfUrl: 'https://example.com/rx.pdf',
    ...overrides,
  };
}

function createPatientProfile(overrides?: Partial<PatientProfile>): PatientProfile {
  return {
    id: 'patient_1',
    age: 35,
    medications: [createMedication()],
    allergies: [],
    conditions: [],
    insuranceProvider: 'Bradesco Saude',
    ...overrides,
  };
}

describe('AIHealthAssistant', () => {
  let assistant: AIHealthAssistant;

  beforeEach(() => {
    vi.restoreAllMocks();
    assistant = new AIHealthAssistant();
  });

  describe('analyzeMedicationInteraction', () => {
    it('should detect no interaction for safe medications', async () => {
      const medications = [
        createMedication({ name: 'Amoxicilina' }),
        createMedication({ name: 'Vitamina C' }),
      ];

      const result = await assistant.analyzeMedicationInteraction(medications);

      expect(result.safe).toBe(true);
      expect(result.interactions).toHaveLength(0);
      expect(result.severity).toBe('none');
    });

    it('should detect warfarin + aspirin interaction', async () => {
      const medications = [
        createMedication({ name: 'Warfarin' }),
        createMedication({ name: 'Aspirin' }),
      ];

      const result = await assistant.analyzeMedicationInteraction(medications);

      expect(result.safe).toBe(false);
      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].severity).toBe('severe');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect metformin + alcohol interaction', async () => {
      const medications = [
        createMedication({ name: 'Metformin' }),
        createMedication({ name: 'Alcohol' }),
      ];

      const result = await assistant.analyzeMedicationInteraction(medications);

      expect(result.safe).toBe(false);
      expect(result.severity).toBe('critical');
    });

    it('should warn about polypharmacy', async () => {
      const medications = Array.from({ length: 8 }, (_, i) =>
        createMedication({ name: `Drug${i}` }),
      );

      const result = await assistant.analyzeMedicationInteraction(medications);

      expect(result.recommendations.some((r) => r.includes('polypharmacy'))).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const medications = [
        createMedication({ name: 'WARFARIN' }),
        createMedication({ name: 'aspirin' }),
      ];

      const result = await assistant.analyzeMedicationInteraction(medications);

      expect(result.safe).toBe(false);
    });
  });

  describe('verifyPrescriptionAuthenticity', () => {
    it('should verify a valid prescription', async () => {
      const prescription = createPrescription();
      const result = await assistant.verifyPrescriptionAuthenticity(prescription);

      expect(result.authentic).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('should reject expired prescription', async () => {
      const prescription = createPrescription({
        expiresAt: '2025-01-01T00:00:00Z',
        medications: [],
      });

      const result = await assistant.verifyPrescriptionAuthenticity(prescription);

      expect(result.authentic).toBe(false);
      expect(result.checks.some((c) => c.name === 'expiry' && !c.passed)).toBe(true);
    });

    it('should reject prescription without digital signature', async () => {
      const prescription = createPrescription({ digitalSignature: '', medications: [] });

      const result = await assistant.verifyPrescriptionAuthenticity(prescription);

      expect(result.authentic).toBe(false);
      expect(result.checks.some((c) => c.name === 'digital_signature' && !c.passed)).toBe(true);
    });

    it('should reject prescription with no medications', async () => {
      const prescription = createPrescription({ medications: [] });

      const result = await assistant.verifyPrescriptionAuthenticity(prescription);

      expect(result.checks.some((c) => c.name === 'medication_count' && !c.passed)).toBe(true);
    });

    it('should detect duplicate prescriptions within window', async () => {
      const now = new Date();
      const prescription1 = createPrescription({ id: 'rx_1', issuedAt: now.toISOString() });
      await assistant.verifyPrescriptionAuthenticity(prescription1);

      const prescription2 = createPrescription({
        id: 'rx_2',
        issuedAt: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
      });

      const result = await assistant.verifyPrescriptionAuthenticity(prescription2);

      expect(result.checks.some((c) => c.name === 'duplicate_detection' && !c.passed)).toBe(true);
    });
  });

  describe('assessPaymentRisk', () => {
    it('should assess low risk for small amount', async () => {
      const result = await assistant.assessPaymentRisk({
        amount: 500,
        currency: 'BRL',
        customerId: 'cust_1',
        metadata: { orderId: 'order_1', pharmacyId: 'pharmacy_1' },
      });

      expect(result.riskLevel).toBe('low');
      expect(result.score).toBeLessThan(25);
      expect(result.factors).toHaveLength(4);
    });

    it('should assess high risk for large amount', async () => {
      const result = await assistant.assessPaymentRisk({
        amount: 100_000,
        currency: 'BRL',
        customerId: '',
        metadata: { previousPayments: 20 },
      });

      expect(['high', 'critical']).toContain(result.riskLevel);
      expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should flag anonymous customer as risk', async () => {
      const result = await assistant.assessPaymentRisk({
        amount: 1000,
        currency: 'BRL',
        customerId: '',
        metadata: { orderId: 'order_1', pharmacyId: 'pharmacy_1' },
      });

      const customerFactor = result.factors.find((f) => f.type === 'customer');
      expect(customerFactor?.value).toBe(0.7);
    });

    it('should flag incomplete metadata', async () => {
      const result = await assistant.assessPaymentRisk({
        amount: 1000,
        currency: 'BRL',
        customerId: 'cust_1',
        metadata: {},
      });

      const metadataFactor = result.factors.find((f) => f.type === 'metadata_completeness');
      expect(metadataFactor?.value).toBeGreaterThan(0);
    });

    it('should use FinPay trust scoring when client available', async () => {
      const mockClient = createMockClient();
      const assistantWithClient = new AIHealthAssistant({ client: mockClient });

      const result = await assistantWithClient.assessPaymentRisk({
        amount: 1000,
        currency: 'BRL',
        customerId: 'cust_1',
        metadata: { paymentId: 'pi_1', orderId: 'order_1', pharmacyId: 'pharmacy_1' },
      });

      expect(result).toBeDefined();
    });
  });

  describe('getHealthRecommendations', () => {
    it('should recommend medication review for polypharmacy', async () => {
      const profile = createPatientProfile({
        medications: Array.from({ length: 6 }, (_, i) => createMedication({ name: `Drug${i}` })),
      });

      const recommendations = await assistant.getHealthRecommendations(profile);

      expect(recommendations.some((r) => r.title.includes('Medication Review'))).toBe(true);
    });

    it('should flag allergies', async () => {
      const profile = createPatientProfile({
        medications: [createMedication({ name: 'Amoxicilina' })],
        allergies: ['Amoxicilina'],
      });

      const recommendations = await assistant.getHealthRecommendations(profile);

      expect(recommendations.some((r) => r.title.includes('Allergy Alert'))).toBe(true);
    });

    it('should recommend geriatric review for elderly patients', async () => {
      const profile = createPatientProfile({ age: 70 });

      const recommendations = await assistant.getHealthRecommendations(profile);

      expect(recommendations.some((r) => r.title.includes('Geriatric'))).toBe(true);
    });

    it('should recommend insurance verification when missing', async () => {
      const profile = createPatientProfile({ insuranceProvider: undefined });

      const recommendations = await assistant.getHealthRecommendations(profile);

      expect(recommendations.some((r) => r.title.includes('Insurance'))).toBe(true);
    });

    it('should return empty for healthy young patient', async () => {
      const profile = createPatientProfile({
        age: 25,
        medications: [createMedication()],
        allergies: [],
        insuranceProvider: 'Sul America',
      });

      const recommendations = await assistant.getHealthRecommendations(profile);

      expect(recommendations).toHaveLength(0);
    });
  });

  describe('detectFraudulentPrescription', () => {
    it('should flag clean prescription as non-fraudulent', async () => {
      const prescription = createPrescription();
      const result = await assistant.detectFraudulentPrescription(prescription);

      expect(result.fraudulent).toBe(false);
      expect(result.signals).toHaveLength(0);
    });

    it('should flag prescription with too many opioids', async () => {
      const prescription = createPrescription({
        medications: [
          createMedication({ name: 'Codeine' }),
          createMedication({ name: 'Tramadol' }),
          createMedication({ name: 'Oxycodone' }),
        ],
      });

      const result = await assistant.detectFraudulentPrescription(prescription);

      expect(result.fraudulent).toBe(true);
      expect(result.signals.some((s) => s.type === 'velocity')).toBe(true);
    });

    it('should flag prescription with invalid signature', async () => {
      const prescription = createPrescription({
        digitalSignature: 'invalid',
        medications: [],
      });

      const result = await assistant.detectFraudulentPrescription(prescription);

      expect(result.signals.some((s) => s.type === 'duplicate_hash')).toBe(true);
      expect(result.confidence).toBeLessThan(1);
    });

    it('should use FinPay trust scoring when available', async () => {
      const mockClient = createMockClient();
      const assistantWithClient = new AIHealthAssistant({ client: mockClient });

      const prescription = createPrescription();
      const result = await assistantWithClient.detectFraudulentPrescription(prescription);

      expect(result.trustScore).toBeDefined();
    });

    it('should record learning events', async () => {
      const prescription = createPrescription();
      await assistant.detectFraudulentPrescription(prescription);

      const report = assistant['learningEngine'].generateReport();
      expect(report.totalEvents).toBeGreaterThan(0);
    });
  });
});
