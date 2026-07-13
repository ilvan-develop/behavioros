import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinPayApiError, FinPayClient } from '../finpay-client';

// ============================================================
// FinPay Client Tests
// ============================================================

function createClient(overrides?: { maxRetries?: number; timeoutMs?: number }) {
  return new FinPayClient({
    apiKey: 'test-api-key',
    baseUrl: 'https://api.test.finpay.com',
    webhookSecret: 'test-webhook-secret',
    environment: 'sandbox',
    maxRetries: overrides?.maxRetries ?? 0,
    timeoutMs: overrides?.timeoutMs ?? 5_000,
  });
}

describe('FinPayClient', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent', async () => {
      const mockResponse = {
        id: 'pi_123',
        amount: 5000,
        currency: 'BRL',
        customerId: 'cust_abc',
        metadata: {},
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const client = createClient();
      const result = await client.createPaymentIntent({
        amount: 5000,
        currency: 'BRL',
        customerId: 'cust_abc',
      });

      expect(result).toEqual(mockResponse);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
      expect(options.headers['X-Correlation-ID']).toBeDefined();
    });

    it('should include idempotency key for refunds', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'refund_1',
          paymentId: 'pi_123',
          amount: 1000,
          status: 'pending',
          reason: 'test',
          processedAt: '2026-01-01T00:00:00Z',
        }),
      });

      const client = createClient();
      await client.processRefund('pi_123', 1000);

      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers['X-Idempotency-Key']).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw FinPayApiError on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error":"invalid_amount"}',
      });

      const client = createClient();
      await expect(
        client.createPaymentIntent({
          amount: -1,
          currency: 'BRL',
          customerId: 'cust_abc',
        }),
      ).rejects.toThrow(FinPayApiError);
    });

    it('should include correlation ID in error', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'server error',
      });

      const client = createClient();
      try {
        await client.createPaymentIntent({
          amount: 1000,
          currency: 'BRL',
          customerId: 'cust_abc',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(FinPayApiError);
        const apiError = error as FinPayApiError;
        expect(apiError.status).toBe(500);
        expect(apiError.correlationId).toBeDefined();
      }
    });
  });

  describe('retry logic', () => {
    it('should retry on 500 errors', async () => {
      fetchSpy
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'error',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'pi_retry',
            amount: 1000,
            currency: 'BRL',
            customerId: 'c',
            metadata: {},
            status: 'pending',
            createdAt: '',
            updatedAt: '',
          }),
        });

      const client = createClient({ maxRetries: 1 });
      const result = await client.createPaymentIntent({
        amount: 1000,
        currency: 'BRL',
        customerId: 'cust_abc',
      });

      expect(result.id).toBe('pi_retry');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 errors', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'bad request',
      });

      const client = createClient({ maxRetries: 3 });
      await expect(
        client.createPaymentIntent({
          amount: 1000,
          currency: 'BRL',
          customerId: 'cust_abc',
        }),
      ).rejects.toThrow(FinPayApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getValidationResult', () => {
    it('should fetch validation result', async () => {
      const mockResult = {
        paymentId: 'pi_123',
        status: 'reconciled',
        trustScore: { decision: 'approve', score: 85, factors: [], confidence: 0.9 },
        fraudSignals: [],
        complianceResult: { passed: true, violations: [], warnings: [], score: 95 },
        recommendation: 'approve',
        completedAt: '2026-01-01T00:00:00Z',
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const client = createClient();
      const result = await client.getValidationResult('pi_123');

      expect(result.paymentId).toBe('pi_123');
      expect(result.recommendation).toBe('approve');

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toContain('/v1/payment-intents/pi_123/validation');
    });
  });

  describe('getTrustScore', () => {
    it('should fetch trust score', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          decision: 'approve',
          score: 90,
          factors: ['compliance:95'],
          confidence: 0.95,
        }),
      });

      const client = createClient();
      const result = await client.getTrustScore('pi_123');

      expect(result.decision).toBe('approve');
      expect(result.score).toBe(90);
    });
  });

  describe('processRefund', () => {
    it('should process a refund', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'ref_1',
          paymentId: 'pi_123',
          amount: 500,
          status: 'pending',
          reason: 'customer_request',
          processedAt: '2026-01-01T00:00:00Z',
        }),
      });

      const client = createClient();
      const result = await client.processRefund('pi_123', 500);

      expect(result.amount).toBe(500);
      expect(result.paymentId).toBe('pi_123');
    });
  });

  describe('getReconciliation', () => {
    it('should fetch reconciliation entries', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'rec_1',
            paymentId: 'pi_123',
            type: 'payment',
            amount: 5000,
            timestamp: '2026-01-01',
            ledger: 'main',
          },
        ],
      });

      const client = createClient();
      const result = await client.getReconciliation('pi_123');

      expect(result).toHaveLength(1);
      expect(result[0].ledger).toBe('main');
    });
  });
});
