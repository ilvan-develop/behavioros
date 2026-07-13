import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrocolisOrderStore, BrocolisPrescriptionStore } from '../brocolis-adapter';
import { BrocolisAdapter } from '../brocolis-adapter';
import type { FinPayClient } from '../finpay-client';
import type { BrocolisOrder } from '../types';
import { PaymentValidationPipeline } from '../validation-pipeline';

// ============================================================
// Brocolis Adapter Tests
// ============================================================

function createMockClient(): FinPayClient {
  return {
    createPaymentIntent: vi.fn().mockResolvedValue({
      id: 'pi_mock_1',
      amount: 15000,
      currency: 'BRL',
      customerId: 'cust_1',
      metadata: {},
      status: 'pending',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }),
    uploadEvidence: vi.fn(),
    getValidationResult: vi.fn(),
    getTrustScore: vi.fn().mockResolvedValue({
      decision: 'approve',
      score: 90,
      factors: [],
      confidence: 0.9,
    }),
    processRefund: vi.fn(),
    getReconciliation: vi.fn(),
  } as unknown as FinPayClient;
}

function createMockOrder(overrides?: Partial<BrocolisOrder>): BrocolisOrder {
  return {
    id: 'order_1',
    pharmacyId: 'pharmacy_abc',
    items: [
      {
        id: 'item_1',
        medicationName: 'Amoxicilina 500mg',
        quantity: 2,
        unitPrice: 2500,
        totalPrice: 5000,
      },
      {
        id: 'item_2',
        medicationName: 'Ibuprofeno 600mg',
        quantity: 1,
        unitPrice: 1500,
        totalPrice: 1500,
      },
    ],
    totalAmount: 6500,
    currency: 'BRL',
    status: 'created',
    customerId: 'cust_1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockOrderStore(): BrocolisOrderStore {
  const orders = new Map<string, BrocolisOrder>();
  orders.set('order_1', createMockOrder());
  orders.set('order_rx', createMockOrder({ id: 'order_rx', prescriptionId: 'rx_1' }));

  return {
    getOrder: vi.fn(async (id: string) => orders.get(id) ?? null),
    getOrdersByPharmacy: vi.fn(async () => [...orders.values()]),
  };
}

function createMockPrescriptionStore(): BrocolisPrescriptionStore {
  return {
    getPrescription: vi.fn(async (id: string) => {
      if (id === 'rx_1') {
        return {
          id: 'rx_1',
          verified: true,
          doctorSignature: 'sig_dr_silva_2026',
          medications: [{ name: 'Amoxicilina', dosage: '500mg' }],
        };
      }
      return null;
    }),
  };
}

describe('BrocolisAdapter', () => {
  let adapter: BrocolisAdapter;
  let mockClient: FinPayClient;
  let pipeline: PaymentValidationPipeline;
  let orderStore: BrocolisOrderStore;
  let prescriptionStore: BrocolisPrescriptionStore;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockClient = createMockClient();
    pipeline = new PaymentValidationPipeline();
    orderStore = createMockOrderStore();
    prescriptionStore = createMockPrescriptionStore();
    adapter = new BrocolisAdapter(mockClient, pipeline, orderStore, prescriptionStore);
  });

  describe('processOrderPayment', () => {
    it('should process payment for valid order', async () => {
      const result = await adapter.processOrderPayment('order_1', 'credit_card');

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('order_1');
      expect(result.paymentIntent).toBeDefined();
      expect(result.validation).toBeDefined();
    });

    it('should return error for non-existent order', async () => {
      const result = await adapter.processOrderPayment('order_nonexistent', 'pix');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should verify prescription when order has one', async () => {
      const result = await adapter.processOrderPayment('order_rx', 'credit_card');

      expect(result.success).toBe(true);
      expect(prescriptionStore.getPrescription).toHaveBeenCalledWith('rx_1');
    });

    it('should reject when prescription verification fails', async () => {
      const orderStoreWithBadRx = {
        getOrder: vi.fn(async (id: string) => {
          if (id === 'order_bad_rx') {
            return createMockOrder({ id: 'order_bad_rx', prescriptionId: 'rx_bad' });
          }
          return null;
        }),
        getOrdersByPharmacy: vi.fn(async () => []),
      };

      const adapter2 = new BrocolisAdapter(
        mockClient,
        pipeline,
        orderStoreWithBadRx,
        prescriptionStore,
      );

      const result = await adapter2.processOrderPayment('order_bad_rx', 'credit_card');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Prescription verification failed');
    });
  });

  describe('verifyPrescriptionPayment', () => {
    it('should verify a valid prescription', async () => {
      const result = await adapter.verifyPrescriptionPayment('rx_1');

      expect(result.verified).toBe(true);
      expect(result.paymentRequired).toBe(true);
      expect(result.authenticityScore).toBeGreaterThan(0.7);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject unknown prescription', async () => {
      const result = await adapter.verifyPrescriptionPayment('rx_unknown');

      expect(result.verified).toBe(false);
      expect(result.warnings).toContain('Prescription not found');
      expect(result.authenticityScore).toBe(0);
    });
  });

  describe('handleDeliveryPayment', () => {
    it('should create delivery payment', async () => {
      const result = await adapter.handleDeliveryPayment('del_1', 'driver_1');

      expect(result.success).toBe(true);
      expect(result.deliveryId).toBe('del_1');
      expect(result.driverId).toBe('driver_1');
      expect(result.paymentIntent).toBeDefined();
    });
  });

  describe('generateInvoice', () => {
    it('should generate invoice for valid order', async () => {
      const invoice = await adapter.generateInvoice('order_1');

      expect(invoice.orderId).toBe('order_1');
      expect(invoice.items).toHaveLength(2);
      expect(invoice.subtotal).toBe(6500);
      expect(invoice.tax).toBe(780);
      expect(invoice.total).toBe(7280);
      expect(invoice.currency).toBe('BRL');
      expect(invoice.pdfUrl).toContain('order_1');
    });

    it('should throw for non-existent order', async () => {
      await expect(adapter.generateInvoice('order_nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('reconcilePharmacySettlements', () => {
    it('should generate settlement report', async () => {
      const report = await adapter.reconcilePharmacySettlements({
        start: '2026-01-01',
        end: '2026-01-31',
      });

      expect(report.period.start).toBe('2026-01-01');
      expect(report.totalTransactions).toBeGreaterThan(0);
      expect(report.totalAmount).toBeGreaterThan(0);
      expect(report.totalFees).toBeGreaterThan(0);
      expect(report.netSettlement).toBeLessThan(report.totalAmount);
      expect(report.generatedAt).toBeDefined();
    });

    it('should calculate fees at 5% by default', async () => {
      const report = await adapter.reconcilePharmacySettlements({
        start: '2026-01-01',
        end: '2026-01-31',
      });

      const expectedFees = Math.round(report.totalAmount * 0.05 * 100) / 100;
      expect(report.totalFees).toBe(expectedFees);
    });
  });

  describe('splitOrderPayment', () => {
    it('should split order into pharmacy payments', async () => {
      const order = createMockOrder();
      const splits = adapter.splitOrderPayment(order);

      expect(splits).toHaveLength(1);
      expect(splits[0].pharmacyId).toBe('pharmacy_abc');
      expect(splits[0].amount).toBe(6500);
    });
  });
});
