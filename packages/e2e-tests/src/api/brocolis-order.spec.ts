import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_ORDER_DATA, TEST_PRESCRIPTIONS } from '../fixtures/test-data';
import { TestDataGenerator } from '../helpers/api-client';

test.describe('Brocolis Order Flow', () => {
  test('should create an order with a single pharmacy', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const orderData = TEST_ORDER_DATA.singlePharmacy;

    const response = await ctx.brocolis.createOrder(token, orderData);
    expect(response.status()).toBe(201);

    const order = await response.json();
    expect(order).toMatchObject({
      id: expect.any(String),
      status: 'pending',
      items: expect.arrayContaining([
        expect.objectContaining({ productId: 'prod-omeprazol-002' }),
        expect.objectContaining({ productId: 'prod-vitaminac-004' }),
      ]),
      pharmacyId: 'pharmacy-drogamais-001',
      total: expect.any(Number),
    });
    expect(order.items).toHaveLength(2);
  });

  test('should add items to cart from different pharmacies', async ({ ctx }) => {
    const token = ctx.tokens.customer;

    const addResponse = await ctx.brocolis.addToCart(token, [
      { productId: 'prod-omeprazol-002', quantity: 2, pharmacyId: 'pharmacy-drogamais-001' },
      { productId: 'prod-vitaminac-004', quantity: 1, pharmacyId: 'pharmacy-farmabem-002' },
    ]);
    expect(addResponse.status()).toBe(200);

    const cart = await ctx.brocolis.getCart(token);
    const cartBody = await cart.json();
    expect(cartBody.items).toHaveLength(2);
    expect(cartBody.pharmacies).toHaveLength(2);
    expect(cartBody.items[0].pharmacyId).toBeDefined();
  });

  test('should checkout with FinPay payment', async ({ ctx }) => {
    const token = ctx.tokens.customer;

    await ctx.brocolis.addToCart(token, [
      { productId: 'prod-omeprazol-002', quantity: 1, pharmacyId: 'pharmacy-drogamais-001' },
    ]);
    const cartResp = await ctx.brocolis.getCart(token);
    const cart = await cartResp.json();

    const checkoutResp = await ctx.brocolis.checkoutStart(token, {
      cartId: cart.id,
      shippingAddress: TestDataGenerator.randomAddress(),
      paymentMethod: 'credit_card',
    });
    expect(checkoutResp.status()).toBe(200);
    const checkout = await checkoutResp.json();
    expect(checkout.id).toBeDefined();
    expect(checkout.total).toBeGreaterThan(0);

    const paymentPayload = TestDataGenerator.paymentPayload({
      amount: checkout.total,
      customerId: `cust-${Date.now()}`,
      metadata: { checkoutId: checkout.id },
    });
    const payResp = await ctx.finpay.createPaymentIntent(paymentPayload);
    const payment = await payResp.json();

    await ctx.finpay.confirmPayment(payment.id, {
      paymentMethodId: 'pm_card_visa',
      customerToken: paymentPayload.customerId,
    });

    const checkoutPayResp = await ctx.brocolis.checkoutPayment(token, {
      checkoutId: checkout.id,
      paymentIntentId: payment.id,
    });
    expect(checkoutPayResp.status()).toBe(200);

    const confirmResp = await ctx.brocolis.checkoutConfirm(token, checkout.id);
    expect(confirmResp.status()).toBe(200);
    const confirmed = await confirmResp.json();
    expect(confirmed.status).toBe('confirmed');
  });

  test('should upload a prescription', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const formData = new FormData();
    const blob = new Blob(['fake-image-content'], { type: 'image/jpeg' });
    formData.append('file', blob, 'prescription.jpg');
    formData.append('patientCpf', TEST_PRESCRIPTIONS.valid.patientCpf);
    formData.append('doctorCRM', TEST_PRESCRIPTIONS.valid.doctorCRM);

    const response = await ctx.brocolis.uploadPrescription(token, formData);
    expect(response.status()).toBe(201);

    const prescription = await response.json();
    expect(prescription).toMatchObject({
      id: expect.any(String),
      status: 'pending_verification',
      ocrExtracted: expect.any(String),
    });
  });

  test('should verify a prescription', async ({ ctx }) => {
    const customerToken = ctx.tokens.customer;
    const formData = new FormData();
    const blob = new Blob(['prescription-data'], { type: 'image/jpeg' });
    formData.append('file', blob, 'rx.jpg');
    formData.append('patientCpf', TEST_PRESCRIPTIONS.valid.patientCpf);
    formData.append('doctorCRM', TEST_PRESCRIPTIONS.valid.doctorCRM);

    const uploadResp = await ctx.brocolis.uploadPrescription(customerToken, formData);
    const prescription = await uploadResp.json();

    const staffToken = ctx.tokens.pharmacyStaff;
    const verifyResp = await ctx.brocolis.verifyPrescription(staffToken, prescription.id, {
      verified: true,
      notes: 'Prescription verified. Doctor CRM matches registry.',
    });
    expect(verifyResp.status()).toBe(200);

    const verified = await verifyResp.json();
    expect(verified.status).toBe('verified');
    expect(verified.verifiedBy).toBeDefined();
    expect(verified.verifiedAt).toBeDefined();
  });

  test('should track delivery of an order', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const orderData = TestDataGenerator.orderPayload();

    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    const order = await orderResp.json();

    const trackResp = await ctx.brocolis.trackOrder(token, order.id);
    expect(trackResp.status()).toBe(200);

    const tracking = await trackResp.json();
    expect(tracking).toMatchObject({
      orderId: order.id,
      status: expect.any(String),
      events: expect.any(Array),
      estimatedDelivery: expect.any(String),
    });
  });

  test('should cancel an order', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const orderData = TestDataGenerator.orderPayload();

    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    const order = await orderResp.json();

    const cancelResp = await ctx.brocolis.cancelOrder(token, order.id, 'Changed my mind');
    expect(cancelResp.status()).toBe(200);

    const cancelled = await cancelResp.json();
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).toBeDefined();
  });

  test('should process a return', async ({ ctx }) => {
    const token = ctx.tokens.customer;
    const orderData = TestDataGenerator.orderPayload({
      items: [{ productId: 'prod-omeprazol-002', quantity: 2 }],
    });

    const orderResp = await ctx.brocolis.createOrder(token, orderData);
    const order = await orderResp.json();

    const returnResp = await ctx.brocolis.returnOrder(token, order.id, {
      items: [{ productId: 'prod-omeprazol-002', quantity: 1, reason: 'defective_product' }],
    });
    expect(returnResp.status()).toBe(200);

    const returned = await returnResp.json();
    expect(returned.status).toBe('return_requested');
    expect(returned.returnItems).toHaveLength(1);
    expect(returned.refundId).toBeDefined();
  });

  test('should complete guest checkout flow', async ({ ctx }) => {
    const guestToken = await ctx.brocolis.getGuestToken();

    const orderData = TestDataGenerator.orderPayload({
      guest: { email: TestDataGenerator.randomEmail(), phone: TestDataGenerator.randomPhone() },
    });

    const response = await ctx.brocolis.createOrder(guestToken, orderData);
    expect(response.status()).toBe(201);

    const order = await response.json();
    expect(order.guest).toBe(true);
    expect(order.status).toBe('pending');
  });

  test('should access pharmacy dashboard operations', async ({ ctx }) => {
    const token = ctx.tokens.pharmacyAdmin;

    const dashboardResp = await ctx.brocolis.getPharmacyDashboard(token);
    expect(dashboardResp.status()).toBe(200);
    const dashboard = await dashboardResp.json();
    expect(dashboard).toMatchObject({
      totalOrders: expect.any(Number),
      pendingOrders: expect.any(Number),
      revenue: expect.any(Number),
      inventoryAlerts: expect.any(Array),
    });

    const ordersResp = await ctx.brocolis.getPharmacyOrders(token, { status: 'pending' });
    expect(ordersResp.status()).toBe(200);
    const orders = await ordersResp.json();
    expect(Array.isArray(orders.data)).toBe(true);

    const inventoryResp = await ctx.brocolis.getInventory(token);
    expect(inventoryResp.status()).toBe(200);
    const inventory = await inventoryResp.json();
    expect(inventory).toMatchObject({
      items: expect.any(Array),
      totalItems: expect.any(Number),
      lowStockItems: expect.any(Array),
    });

    const reportsResp = await ctx.brocolis.getFinancialReports(token, { period: 'monthly' });
    expect(reportsResp.status()).toBe(200);
    const reports = await reportsResp.json();
    expect(reports).toMatchObject({
      period: 'monthly',
      totalRevenue: expect.any(Number),
      totalOrders: expect.any(Number),
      averageOrderValue: expect.any(Number),
    });
  });
});
