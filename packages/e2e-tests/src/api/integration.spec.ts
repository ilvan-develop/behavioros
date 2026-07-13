import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_ORDER_DATA, TEST_PRESCRIPTIONS } from '../fixtures/test-data';
import { TestDataGenerator } from '../helpers/api-client';

test.describe('Brocolis + FinPay Integration', () => {
  test('should complete full order → payment → validation → delivery flow', async ({ ctx }) => {
    const token = ctx.tokens.customer;

    const orderData = TestDataGenerator.orderPayload();
    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    expect(orderResp.status()).toBe(201);
    const order = await orderResp.json();

    const paymentPayload = TestDataGenerator.paymentPayload({
      amount: order.total,
      customerId: `cust-${Date.now()}`,
      metadata: { orderId: order.id },
    });
    const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
    expect(payResp.status()).toBe(201);
    const payment = await payResp.json();

    const confirmResp = await ctx.finpay.confirmPayment(payment.id, {
      paymentMethodId: 'pm_card_visa',
      customerToken: paymentPayload.customerId,
    });
    expect(confirmResp.status()).toBe(200);
    const confirmed = await confirmResp.json();
    expect(confirmed.status).toBe('succeeded');

    const evidenceResp = await ctx.finpay.uploadEvidence(payment.id, {
      type: 'payment_confirmation',
      content: JSON.stringify({
        paymentId: payment.id,
        orderId: order.id,
        amount: payment.amount,
        status: 'succeeded',
      }),
    });
    expect(evidenceResp.status()).toBe(201);

    const validateResp = await ctx.finpay.validateEvidence(payment.id);
    expect(validateResp.status()).toBe(200);
    const validation = await validateResp.json();
    expect(validation.valid).toBe(true);

    const trackResp = await ctx.brocolis.trackOrder(token, order.id);
    expect(trackResp.status()).toBe(200);
    const tracking = await trackResp.json();
    expect(tracking.status).not.toBe('cancelled');
  });

  test('should complete prescription verification → payment → fulfillment flow', async ({
    ctx,
  }) => {
    const customerToken = ctx.tokens.customer;
    const staffToken = ctx.tokens.pharmacyStaff;

    const formData = new FormData();
    const blob = new Blob(['prescription-content'], { type: 'image/jpeg' });
    formData.append('file', blob, 'rx.jpg');
    formData.append('patientCpf', TEST_PRESCRIPTIONS.valid.patientCpf);
    formData.append('doctorCRM', TEST_PRESCRIPTIONS.valid.doctorCRM);
    const uploadResp = await ctx.brocolis.uploadPrescription(customerToken, formData);
    const prescription = await uploadResp.json();

    const verifyResp = await ctx.brocolis.verifyPrescription(staffToken, prescription.id, {
      verified: true,
    });
    expect(verifyResp.status()).toBe(200);
    const verified = await verifyResp.json();
    expect(verified.status).toBe('verified');

    const orderData = TEST_ORDER_DATA.withPrescription;
    const orderResp = await ctx.brocolis.createOrder(customerToken, orderData);
    expect(orderResp.status()).toBe(201);
    const order = await orderResp.json();

    expect(
      order.items.some((i: { prescriptionId?: string }) => i.prescriptionId === prescription.id),
    ).toBe(true);

    const paymentPayload = TestDataGenerator.paymentPayload({
      amount: order.total,
      customerId: `cust-${Date.now()}`,
      metadata: { orderId: order.id, prescriptionId: prescription.id },
    });
    const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
    const payment = await payResp.json();
    await ctx.finpay.confirmPayment(payment.id, {
      paymentMethodId: 'pm_card_visa',
      customerToken: paymentPayload.customerId,
    });

    const getOrderResp = await ctx.brocolis.getOrder(customerToken, order.id);
    expect(getOrderResp.status()).toBe(200);
  });

  test('should split multi-pharmacy order with separate payments', async ({ ctx }) => {
    const token = ctx.tokens.customer;

    await ctx.brocolis.addToCart(token, TEST_ORDER_DATA.multiPharmacy.items);
    const cartResp = await ctx.brocolis.getCart(token);
    const cart = await cartResp.json();

    expect(cart.pharmacies).toHaveLength(2);
    expect(cart.groupedByPharmacy).toBeDefined();

    const checkoutResp = await ctx.brocolis.checkoutStart(token, {
      cartId: cart.id,
      shippingAddress: TestDataGenerator.randomAddress(),
      paymentMethod: 'credit_card',
    });
    expect(checkoutResp.status()).toBe(200);
    const checkout = await checkoutResp.json();
    expect(checkout.splits).toHaveLength(2);

    for (const split of checkout.splits) {
      const paymentPayload = TestDataGenerator.paymentPayload({
        amount: split.amount,
        customerId: `cust-${Date.now()}`,
        metadata: { checkoutId: checkout.id, pharmacyId: split.pharmacyId },
      });
      const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
      expect(payResp.status()).toBe(201);
      const payment = await payResp.json();

      await ctx.finpay.confirmPayment(payment.id, {
        paymentMethodId: 'pm_card_visa',
        customerToken: paymentPayload.customerId,
      });

      await ctx.brocolis.checkoutPayment(token, {
        checkoutId: checkout.id,
        paymentIntentId: payment.id,
      });
    }

    const confirmResp = await ctx.brocolis.checkoutConfirm(token, checkout.id);
    expect(confirmResp.status()).toBe(200);
    const confirmed = await confirmResp.json();
    expect(confirmed.status).toBe('confirmed');
  });

  test('should trigger fraud detection for suspicious transactions', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const adminToken = ctx.tokens.superAdmin;

    const orderData = TestDataGenerator.orderPayload({
      items: [
        { productId: 'prod-amoxicilina-003', quantity: 50 },
        { productId: 'prod-losartana-001', quantity: 100 },
      ],
    });
    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    const order = await orderResp.json();

    const paymentPayload = TestDataGenerator.paymentPayload({
      amount: 99999.99,
      customerId: `cust-${Date.now()}`,
      metadata: { orderId: order.id, suspicious: true },
    });
    const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
    const payment = await payResp.json();

    const confirmResp = await ctx.finpay.confirmPayment(payment.id, {
      paymentMethodId: 'pm_card_visa',
      customerToken: paymentPayload.customerId,
    });
    const confirmed = await confirmResp.json();

    expect(['requires_review', 'requires_capture', 'blocked']).toContain(confirmed.status);

    const auditResp = await ctx.brocolis.getAuditLog(adminToken, { type: 'fraud_alert' });
    expect(auditResp.status()).toBe(200);
  });

  test('should block payment on compliance violation', async ({ ctx }) => {
    const _token = ctx.tokens.customer;

    const paymentPayload = TestDataGenerator.paymentPayload({
      amount: 50000.0,
      customerId: 'cust-blocked-compliance',
      metadata: { complianceFlag: 'suspicious_origin' },
    });
    const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
    const payment = await payResp.json();

    const confirmResp = await ctx.finpay.confirmPayment(payment.id, {
      paymentMethodId: 'pm_card_visa',
      customerToken: 'cust-blocked-compliance',
    });
    expect(confirmResp.status()).toBe(403);

    const body = await confirmResp.json();
    expect(body).toMatchObject({
      error: expect.objectContaining({
        type: 'compliance_violation',
        code: expect.stringMatching(/^(blocked_by_governance|compliance_failure)$/),
      }),
    });
  });

  test('should adjust order status based on trust score', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const customerId = `cust-trust-${Date.now()}`;

    const scoreResp = await ctx.finpay.getTrustScore(customerId);
    const score = await scoreResp.json();

    const orderData = TestDataGenerator.orderPayload();
    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    const order = await orderResp.json();

    const expectedStatus = score.score < 30 ? 'requires_review' : 'pending';
    expect(order.status).toBe(expectedStatus);

    const trackResp = await ctx.brocolis.trackOrder(token, order.id);
    const tracking = await trackResp.json();
    if (score.score < 30) {
      expect(tracking.reviewRequired).toBe(true);
    }
  });

  test('should reconcile orders matching payments', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const date = new Date().toISOString().split('T')[0];

    const orderData = TestDataGenerator.orderPayload();
    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    const order = await orderResp.json();

    const paymentPayload = TestDataGenerator.paymentPayload({
      amount: order.total,
      customerId: `cust-${Date.now()}`,
      metadata: { orderId: order.id },
    });
    const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
    const payment = await payResp.json();
    await ctx.finpay.confirmPayment(payment.id, {
      paymentMethodId: 'pm_card_visa',
      customerToken: paymentPayload.customerId,
    });
    await ctx.finpay.uploadEvidence(payment.id, {
      type: 'payment_confirmation',
      content: JSON.stringify({ orderId: order.id }),
    });
    await ctx.finpay.capturePayment(payment.id, paymentPayload.customerId);

    const reconcileResp = await ctx.finpay.reconcile(date);
    expect(reconcileResp.status()).toBe(200);
    const reconciled = await reconcileResp.json();

    expect(reconciled.matched).toBeGreaterThanOrEqual(1);
    const match = reconciled.details?.find((d: { orderId: string }) => d.orderId === order.id);
    expect(match).toBeDefined();
    expect(match.status).toBe('matched');
  });
});
