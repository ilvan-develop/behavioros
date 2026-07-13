import { randomUUID } from 'node:crypto';
import type { FinPayClient } from './finpay-client';
import type {
  BrocolisOrder,
  DeliveryPaymentResult,
  Invoice,
  InvoiceItem,
  PaymentIntent,
  PaymentMethod,
  PaymentResult,
  ReconciliationEntry,
  SettlementReport,
  SplitPayment,
  VerificationResult,
} from './types';
import type { PaymentValidationPipeline } from './validation-pipeline';

// ============================================================
// Brocolis Marketplace Adapter
// ============================================================

export interface BrocolisOrderStore {
  getOrder(orderId: string): Promise<BrocolisOrder | null>;
  getOrdersByPharmacy(pharmacyId: string, start: string, end: string): Promise<BrocolisOrder[]>;
}

export interface BrocolisPrescriptionStore {
  getPrescription(prescriptionId: string): Promise<{
    id: string;
    verified: boolean;
    doctorSignature: string;
    medications: { name: string; dosage: string }[];
  } | null>;
}

export class BrocolisAdapter {
  private readonly client: FinPayClient;
  private readonly pipeline: PaymentValidationPipeline;
  private readonly orderStore: BrocolisOrderStore;
  private readonly prescriptionStore: BrocolisPrescriptionStore;
  private readonly platformFeePercent: number;

  constructor(
    client: FinPayClient,
    pipeline: PaymentValidationPipeline,
    orderStore: BrocolisOrderStore,
    prescriptionStore: BrocolisPrescriptionStore,
    options?: { platformFeePercent?: number },
  ) {
    this.client = client;
    this.pipeline = pipeline;
    this.orderStore = orderStore;
    this.prescriptionStore = prescriptionStore;
    this.platformFeePercent = options?.platformFeePercent ?? 5;
  }

  async processOrderPayment(orderId: string, paymentMethod: PaymentMethod): Promise<PaymentResult> {
    const order = await this.orderStore.getOrder(orderId);
    if (!order) {
      return {
        orderId,
        paymentIntent: this.createStubPaymentIntent(orderId, 0),
        validation: this.createStubValidation(orderId),
        success: false,
        error: `Order ${orderId} not found`,
      };
    }

    if (order.prescriptionId) {
      const verification = await this.verifyPrescriptionPayment(order.prescriptionId);
      if (!verification.verified) {
        return {
          orderId,
          paymentIntent: this.createStubPaymentIntent(orderId, order.totalAmount),
          validation: this.createStubValidation(orderId),
          success: false,
          error: `Prescription verification failed: ${verification.warnings.join(', ')}`,
        };
      }
    }

    const paymentIntent = await this.client.createPaymentIntent({
      amount: order.totalAmount,
      currency: order.currency,
      customerId: order.customerId,
      metadata: {
        orderId,
        pharmacyId: order.pharmacyId,
        paymentMethod,
        itemCount: order.items.length,
      },
    });

    const validation = await this.pipeline.validatePayment(paymentIntent.id, {
      id: randomUUID(),
      paymentId: paymentIntent.id,
      type: 'receipt',
      fileUrl: '',
      ocrResult: null,
      trustScore: 0.8,
      uploadedAt: new Date().toISOString(),
    });

    return {
      orderId,
      paymentIntent,
      validation,
      success: validation.recommendation === 'approve',
    };
  }

  async verifyPrescriptionPayment(prescriptionId: string): Promise<VerificationResult> {
    const prescription = await this.prescriptionStore.getPrescription(prescriptionId);

    if (!prescription) {
      return {
        prescriptionId,
        verified: false,
        paymentRequired: false,
        authenticityScore: 0,
        warnings: ['Prescription not found'],
      };
    }

    const checks: string[] = [];
    const warnings: string[] = [];
    let authenticityScore = 1.0;

    if (!prescription.verified) {
      authenticityScore -= 0.3;
      checks.push('verification_pending');
      warnings.push('Prescription has not been verified by a pharmacist');
    }

    if (!prescription.doctorSignature || prescription.doctorSignature.length === 0) {
      authenticityScore -= 0.4;
      checks.push('missing_signature');
      warnings.push('No doctor digital signature found');
    }

    if (prescription.medications.length === 0) {
      authenticityScore -= 0.2;
      checks.push('no_medications');
      warnings.push('Prescription contains no medications');
    }

    const score = Math.max(0, authenticityScore);

    return {
      prescriptionId,
      verified: score >= 0.7,
      paymentRequired: score >= 0.7,
      authenticityScore: score,
      warnings,
    };
  }

  async handleDeliveryPayment(
    deliveryId: string,
    driverId: string,
  ): Promise<DeliveryPaymentResult> {
    const paymentIntent = await this.client.createPaymentIntent({
      amount: 0,
      currency: 'BRL',
      customerId: driverId,
      metadata: {
        deliveryId,
        driverId,
        type: 'delivery',
      },
    });

    const splitPayments: SplitPayment[] = [];

    return {
      deliveryId,
      driverId,
      paymentIntent,
      splitPayments,
      success: true,
    };
  }

  async generateInvoice(orderId: string): Promise<Invoice> {
    const order = await this.orderStore.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const items: InvoiceItem[] = order.items.map((item) => ({
      description: item.medicationName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.totalPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = Math.round(subtotal * 0.12 * 100) / 100;
    const total = subtotal + tax;

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    return {
      id: randomUUID(),
      orderId,
      items,
      subtotal,
      tax,
      total,
      currency: order.currency,
      issuedAt: now.toISOString(),
      dueAt: dueDate.toISOString(),
      pdfUrl: `https://brocolis.com/invoices/${orderId}.pdf`,
    };
  }

  async reconcilePharmacySettlements(period: {
    start: string;
    end: string;
  }): Promise<SettlementReport> {
    const orders = await this.orderStore.getOrdersByPharmacy('', period.start, period.end);
    const pharmacyMap = new Map<string, ReconciliationEntry[]>();

    let totalTransactions = 0;
    let totalAmount = 0;

    for (const order of orders) {
      totalTransactions++;
      totalAmount += order.totalAmount;

      const existing = pharmacyMap.get(order.pharmacyId) ?? [];
      existing.push({
        id: randomUUID(),
        paymentId: `pay_${order.id}`,
        type: 'payment',
        amount: order.totalAmount,
        timestamp: order.createdAt,
        ledger: `pharmacy_${order.pharmacyId}`,
      });
      pharmacyMap.set(order.pharmacyId, existing);
    }

    const allEntries = [...pharmacyMap.values()].flat();
    const totalFees = Math.round(totalAmount * (this.platformFeePercent / 100) * 100) / 100;
    const netSettlement = totalAmount - totalFees;

    return {
      period,
      pharmacyId: '',
      totalTransactions,
      totalAmount,
      totalFees,
      netSettlement,
      entries: allEntries,
      generatedAt: new Date().toISOString(),
    };
  }

  splitOrderPayment(
    order: BrocolisOrder,
  ): { pharmacyId: string; amount: number; medicationCount: number }[] {
    const pharmacyMap = new Map<string, { amount: number; count: number }>();

    for (const item of order.items) {
      const key = order.pharmacyId;
      const existing = pharmacyMap.get(key) ?? { amount: 0, count: 0 };
      existing.amount += item.totalPrice;
      existing.count += item.quantity;
      pharmacyMap.set(key, existing);
    }

    return [...pharmacyMap.entries()].map(([pharmacyId, data]) => ({
      pharmacyId,
      amount: data.amount,
      medicationCount: data.count,
    }));
  }

  private createStubPaymentIntent(orderId: string, amount: number): PaymentIntent {
    return {
      id: `stub_${orderId}`,
      amount,
      currency: 'BRL',
      customerId: '',
      metadata: { orderId },
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private createStubValidation(orderId: string): import('./types').ValidationPipelineResult {
    return {
      paymentId: `stub_${orderId}`,
      status: 'failed',
      trustScore: { decision: 'reject', score: 0, factors: [], confidence: 0 },
      fraudSignals: [],
      complianceResult: { passed: false, violations: ['Order not found'], warnings: [], score: 0 },
      recommendation: 'reject',
      completedAt: null,
    };
  }
}
