import { expect, test } from '../fixtures/e2e-test-context';
import { TestDataGenerator } from '../helpers/api-client';

test.describe('FinPay Payment Flow', () => {
  let paymentIntentId: string;
  let customerId: string;

  test.beforeEach(() => {
    customerId = `cust-e2e-${Date.now()}`;
  });

  test('should create a payment intent', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 150.0 });

    const response = await ctx.finpay.createPaymentIntent(payload);
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      amount: 15000,
      currency: 'brl',
      status: 'requires_payment_method',
      customerId,
    });

    paymentIntentId = body.id;
  });

  test('should confirm a payment intent', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 89.9 });
    const createResp = await ctx.finpay.createPaymentIntent(payload);
    const created = await createResp.json();
    paymentIntentId = created.id;

    const confirmResp = await ctx.finpay.confirmPayment(paymentIntentId, {
      paymentMethodId: 'pm_card_visa',
      customerToken: customerId,
    });

    expect(confirmResp.status()).toBe(200);
    const confirmed = await confirmResp.json();
    expect(confirmed.status).toBe('succeeded');
    expect(confirmed.amount).toBe(8990);
  });

  test('should upload payment evidence and run OCR validation', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 200.0 });
    const createResp = await ctx.finpay.createPaymentIntent(payload);
    const created = await createResp.json();
    paymentIntentId = created.id;

    await ctx.finpay.confirmPayment(paymentIntentId, {
      paymentMethodId: 'pm_card_visa',
      customerToken: customerId,
    });

    const evidenceResp = await ctx.finpay.uploadEvidence(paymentIntentId, {
      type: 'payment_confirmation',
      content: JSON.stringify({
        transactionId: paymentIntentId,
        amount: 20000,
        timestamp: new Date().toISOString(),
        merchant: 'Brocolis',
      }),
      metadata: { source: 'finpay_gateway', format: 'ocr' },
    });

    expect(evidenceResp.status()).toBe(201);
    const evidence = await evidenceResp.json();
    expect(evidence.id).toBeDefined();
    expect(evidence.verified).toBeDefined();

    const validateResp = await ctx.finpay.validateEvidence(paymentIntentId);
    expect(validateResp.status()).toBe(200);
    const validation = await validateResp.json();
    expect(validation.valid).toBe(true);
    expect(validation.checks).toContainEqual(
      expect.objectContaining({ name: 'amount_match', passed: true }),
    );
  });

  test('should get trust score for a customer', async ({ ctx }) => {
    const scoreResp = await ctx.finpay.getTrustScore(customerId);
    expect(scoreResp.status()).toBe(200);

    const score = await scoreResp.json();
    expect(score).toMatchObject({
      customerId,
      score: expect.any(Number),
      level: expect.stringMatching(/^(low|medium|high|excellent)$/),
    });
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  test('should process a full refund', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 75.5 });
    const createResp = await ctx.finpay.createPaymentIntent(payload);
    const created = await createResp.json();
    paymentIntentId = created.id;

    await ctx.finpay.confirmPayment(paymentIntentId, {
      paymentMethodId: 'pm_card_visa',
      customerToken: customerId,
    });

    await ctx.finpay.capturePayment(paymentIntentId, customerId);

    const refundResp = await ctx.finpay.processRefund(paymentIntentId, {
      reason: 'customer_request',
    });

    expect(refundResp.status()).toBe(200);
    const refund = await refundResp.json();
    expect(refund.status).toBe('succeeded');
    expect(refund.amount).toBe(7550);

    const getResp = await ctx.finpay.getPaymentIntent(paymentIntentId);
    const intent = await getResp.json();
    expect(intent.status).toBe('refunded');
  });

  test('should process a partial refund', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 150.0 });
    const createResp = await ctx.finpay.createPaymentIntent(payload);
    const created = await createResp.json();
    paymentIntentId = created.id;

    await ctx.finpay.confirmPayment(paymentIntentId, {
      paymentMethodId: 'pm_card_visa',
      customerToken: customerId,
    });

    await ctx.finpay.capturePayment(paymentIntentId, customerId);

    const refundResp = await ctx.finpay.processRefund(paymentIntentId, {
      amount: 50.0,
      reason: 'partial_item_return',
    });

    expect(refundResp.status()).toBe(200);
    const refund = await refundResp.json();
    expect(refund.status).toBe('succeeded');
    expect(refund.amount).toBe(5000);
  });

  test('should reconcile payments for a given date', async ({ ctx }) => {
    const today = new Date().toISOString().split('T')[0];

    const reconcileResp = await ctx.finpay.reconcile(today);
    expect(reconcileResp.status()).toBe(200);

    const result = await reconcileResp.json();
    expect(result).toMatchObject({
      date: today,
      totalTransactions: expect.any(Number),
      totalAmount: expect.any(Number),
      matched: expect.any(Number),
      unmatched: expect.any(Number),
      discrepancies: expect.any(Array),
    });
    expect(result.matched + result.unmatched).toBe(result.totalTransactions);
  });

  test('should deliver webhook events', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 50.0 });
    const createResp = await ctx.finpay.createPaymentIntent(payload);
    const created = await createResp.json();
    paymentIntentId = created.id;

    const webhookResp = await ctx.finpay.simulateWebhook('payment_intent.succeeded', {
      id: paymentIntentId,
      amount: 5000,
      currency: 'brl',
      status: 'succeeded',
      customerId,
    });

    expect(webhookResp.status()).toBe(200);
    const delivery = await webhookResp.json();
    expect(delivery.delivered).toBe(true);
    expect(delivery.event).toBe('payment_intent.succeeded');
    expect(delivery.endpoint).toContain('brocolis');
  });

  test('should enforce idempotency on duplicate requests', async ({ ctx }) => {
    const idempotencyKey = `idemp-${Date.now()}`;
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 100.0, idempotencyKey });

    const firstResp = await ctx.finpay.createPaymentIntent(payload);
    expect(firstResp.status()).toBe(201);
    const first = await firstResp.json();

    const secondResp = await ctx.finpay.createPaymentIntent(payload);
    expect(secondResp.status()).toBe(200);
    const second = await secondResp.json();

    expect(second.id).toBe(first.id);
  });

  test('should enforce rate limiting', async ({ ctx }) => {
    const payload = TestDataGenerator.paymentPayload({ customerId, amount: 10.0 });

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => ctx.finpay.createPaymentIntent(payload)),
    );

    const statuses = results.map((r) => (r.status === 'fulfilled' ? r.value.status() : 429));
    const rateLimited = statuses.filter((s) => s === 429);

    expect(rateLimited.length).toBeGreaterThan(0);
  });

  test('should return 400 for invalid payment data', async ({ ctx }) => {
    const response = await ctx.finpay.createPaymentIntent({
      amount: -100,
      currency: 'brl',
    } as { amount: number; currency: string });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      error: expect.objectContaining({
        type: 'invalid_request_error',
        message: expect.stringContaining('amount'),
      }),
    });
  });

  test('should return 401 for unauthorized requests', async ({ ctx }) => {
    const response = await ctx.finpay.createPaymentIntent(
      TestDataGenerator.paymentPayload({ customerId: 'unauthorized' }),
    );

    const status = response.status();
    expect([401, 403]).toContain(status);
  });
});
