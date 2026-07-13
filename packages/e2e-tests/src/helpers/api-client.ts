import { type APIRequestContext, request } from '@playwright/test';
import { API_ENDPOINTS, TEST_USERS } from '../fixtures/test-data';

let sharedApiContext: APIRequestContext | null = null;

export async function getApiContext(baseURL?: string): Promise<APIRequestContext> {
  if (sharedApiContext) return sharedApiContext;
  sharedApiContext = await request.newContext({
    baseURL: baseURL || process.env.API_BASE_URL || 'http://localhost:4000',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  return sharedApiContext;
}

export async function disposeApiContext(): Promise<void> {
  if (sharedApiContext) {
    await sharedApiContext.dispose();
    sharedApiContext = null;
  }
}

export class AuthHelper {
  private tokens: Map<string, { accessToken: string; refreshToken: string }> = new Map();

  async loginAsCustomer(ctx: APIRequestContext): Promise<string> {
    return this.login(ctx, TEST_USERS.customer.email, TEST_USERS.customer.password, 'customer');
  }

  async loginAsPharmacyAdmin(ctx: APIRequestContext): Promise<string> {
    return this.login(
      ctx,
      TEST_USERS.pharmacyAdmin.email,
      TEST_USERS.pharmacyAdmin.password,
      'pharmacy_admin',
    );
  }

  async loginAsPharmacyStaff(ctx: APIRequestContext): Promise<string> {
    return this.login(
      ctx,
      TEST_USERS.pharmacyStaff.email,
      TEST_USERS.pharmacyStaff.password,
      'pharmacy_staff',
    );
  }

  async loginAsSuperAdmin(ctx: APIRequestContext): Promise<string> {
    return this.login(
      ctx,
      TEST_USERS.superAdmin.email,
      TEST_USERS.superAdmin.password,
      'super_admin',
    );
  }

  private async login(
    ctx: APIRequestContext,
    email: string,
    password: string,
    role: string,
  ): Promise<string> {
    const cached = this.tokens.get(role);
    if (cached) return cached.accessToken;

    const response = await ctx.post(API_ENDPOINTS.brocolis.auth.login, {
      data: { email, password },
    });

    if (!response.ok()) {
      throw new Error(`Login failed for ${role}: ${response.status()} ${await response.text()}`);
    }

    const body = await response.json();
    const tokens = { accessToken: body.accessToken || body.token, refreshToken: body.refreshToken };
    this.tokens.set(role, tokens);
    return tokens.accessToken;
  }

  async getGuestToken(ctx: APIRequestContext): Promise<string> {
    const response = await ctx.post(API_ENDPOINTS.brocolis.auth.guestCheckout, {
      data: { sessionId: `guest-${Date.now()}` },
    });

    if (!response.ok()) {
      throw new Error(`Guest checkout failed: ${response.status()}`);
    }

    const body = await response.json();
    return body.accessToken || body.token;
  }
}

export class FinPayClient {
  private ctx: APIRequestContext;
  private baseURL: string;
  private apiKey: string;

  constructor(ctx: APIRequestContext, options?: { baseURL?: string; apiKey?: string }) {
    this.ctx = ctx;
    this.baseURL = options?.baseURL || process.env.FINPAY_API_URL || 'https://api.finpay.com';
    this.apiKey = options?.apiKey || process.env.FINPAY_API_KEY || 'sk_test_0000000000000000';
  }

  private headers(token?: string) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...(token ? { 'X-Customer-Token': token } : {}),
    };
  }

  async createPaymentIntent(data: {
    amount: number;
    currency?: string;
    paymentMethod?: 'credit_card' | 'pix' | 'boleto';
    customerId?: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    const headers: Record<string, string> = this.headers(data.customerId);
    if (data.idempotencyKey) headers['Idempotency-Key'] = data.idempotencyKey;

    return this.ctx.post(`${this.baseURL}${API_ENDPOINTS.finpay.createPaymentIntent}`, {
      headers,
      data: {
        amount: Math.round(data.amount * 100),
        currency: data.currency || 'brl',
        paymentMethod: data.paymentMethod || 'credit_card',
        customerId: data.customerId,
        metadata: data.metadata,
      },
    });
  }

  async confirmPayment(
    paymentIntentId: string,
    data: { paymentMethodId?: string; customerToken?: string },
  ) {
    return this.ctx.post(
      `${this.baseURL}${API_ENDPOINTS.finpay.confirmPayment.replace(':id', paymentIntentId)}`,
      { headers: this.headers(data.customerToken), data },
    );
  }

  async capturePayment(paymentIntentId: string, customerToken?: string) {
    return this.ctx.post(
      `${this.baseURL}${API_ENDPOINTS.finpay.capturePayment.replace(':id', paymentIntentId)}`,
      { headers: this.headers(customerToken) },
    );
  }

  async processRefund(paymentIntentId: string, data?: { amount?: number; reason?: string }) {
    return this.ctx.post(
      `${this.baseURL}${API_ENDPOINTS.finpay.refund.replace(':id', paymentIntentId)}`,
      {
        headers: this.headers(),
        data: {
          amount: data?.amount ? Math.round(data.amount * 100) : undefined,
          reason: data?.reason,
        },
      },
    );
  }

  async uploadEvidence(
    paymentIntentId: string,
    evidence: { type: string; content: string; metadata?: Record<string, unknown> },
  ) {
    return this.ctx.post(`${this.baseURL}${API_ENDPOINTS.finpay.evidence}`, {
      headers: this.headers(),
      data: { paymentIntentId, ...evidence },
    });
  }

  async validateEvidence(paymentIntentId: string) {
    return this.ctx.post(`${this.baseURL}${API_ENDPOINTS.finpay.validate}`, {
      headers: this.headers(),
      data: { paymentIntentId },
    });
  }

  async getTrustScore(customerId: string) {
    return this.ctx.get(`${this.baseURL}${API_ENDPOINTS.finpay.trustScore}`, {
      headers: this.headers(),
      params: { customerId },
    });
  }

  async reconcile(date: string) {
    return this.ctx.post(`${this.baseURL}${API_ENDPOINTS.finpay.reconcile}`, {
      headers: this.headers(),
      data: { date },
    });
  }

  async simulateWebhook(event: string, data: Record<string, unknown>) {
    return this.ctx.post(`${this.baseURL}${API_ENDPOINTS.finpay.webhook}`, {
      headers: this.headers(),
      data: { event, data },
    });
  }

  async getPaymentIntent(id: string, customerToken?: string) {
    return this.ctx.get(`${this.baseURL}${API_ENDPOINTS.finpay.createPaymentIntent}/${id}`, {
      headers: this.headers(customerToken),
    });
  }
}

export class BrocolisClient {
  private ctx: APIRequestContext;
  private baseURL: string;
  private auth: AuthHelper;

  constructor(ctx: APIRequestContext, options?: { baseURL?: string }) {
    this.ctx = ctx;
    this.baseURL = options?.baseURL || process.env.API_BASE_URL || 'http://localhost:4000';
    this.auth = new AuthHelper();
  }

  private authHeaders(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  private url(path: string): string {
    return `${this.baseURL}${path}`;
  }

  async loginAs(
    role: 'customer' | 'pharmacy_admin' | 'pharmacy_staff' | 'super_admin',
  ): Promise<string> {
    switch (role) {
      case 'customer':
        return this.auth.loginAsCustomer(this.ctx);
      case 'pharmacy_admin':
        return this.auth.loginAsPharmacyAdmin(this.ctx);
      case 'pharmacy_staff':
        return this.auth.loginAsPharmacyStaff(this.ctx);
      case 'super_admin':
        return this.auth.loginAsSuperAdmin(this.ctx);
    }
  }

  async getGuestToken(): Promise<string> {
    return this.auth.getGuestToken(this.ctx);
  }

  async listProducts(params?: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.products.list), { params });
  }

  async getProduct(id: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.products.detail.replace(':id', id)));
  }

  async addToCart(
    token: string,
    items: Array<{ productId: string; quantity: number; pharmacyId?: string }>,
  ) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.cart.add), {
      headers: this.authHeaders(token),
      data: { items },
    });
  }

  async getCart(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.cart.get), {
      headers: this.authHeaders(token),
    });
  }

  async updateCartItem(token: string, itemId: string, data: { quantity: number }) {
    return this.ctx.patch(this.url(API_ENDPOINTS.brocolis.cart.update.replace(':id', itemId)), {
      headers: this.authHeaders(token),
      data,
    });
  }

  async removeCartItem(token: string, itemId: string) {
    return this.ctx.delete(this.url(API_ENDPOINTS.brocolis.cart.remove.replace(':id', itemId)), {
      headers: this.authHeaders(token),
    });
  }

  async createOrder(
    token: string,
    data: {
      items: Array<{
        productId: string;
        quantity: number;
        pharmacyId?: string;
        prescriptionId?: string;
      }>;
      shippingAddress: Record<string, string>;
      paymentIntentId?: string;
      couponCode?: string;
    },
  ) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.orders.create), {
      headers: this.authHeaders(token),
      data,
    });
  }

  async getOrders(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.orders.list), {
      headers: this.authHeaders(token),
    });
  }

  async getOrder(token: string, orderId: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.orders.detail.replace(':id', orderId)), {
      headers: this.authHeaders(token),
    });
  }

  async cancelOrder(token: string, orderId: string, reason?: string) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.orders.cancel.replace(':id', orderId)), {
      headers: this.authHeaders(token),
      data: { reason },
    });
  }

  async returnOrder(
    token: string,
    orderId: string,
    data: { items: Array<{ productId: string; quantity: number; reason: string }> },
  ) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.orders.return.replace(':id', orderId)), {
      headers: this.authHeaders(token),
      data,
    });
  }

  async trackOrder(token: string, orderId: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.orders.track.replace(':id', orderId)), {
      headers: this.authHeaders(token),
    });
  }

  async checkoutStart(
    token: string,
    data: {
      cartId: string;
      shippingAddress: Record<string, string>;
      paymentMethod: 'credit_card' | 'pix' | 'boleto';
    },
  ) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.checkout.start), {
      headers: this.authHeaders(token),
      data,
    });
  }

  async applyCoupon(token: string, code: string) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.checkout.applyCoupon), {
      headers: this.authHeaders(token),
      data: { code },
    });
  }

  async checkoutPayment(token: string, data: { checkoutId: string; paymentIntentId: string }) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.checkout.payment), {
      headers: this.authHeaders(token),
      data,
    });
  }

  async checkoutConfirm(token: string, checkoutId: string) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.checkout.confirm), {
      headers: this.authHeaders(token),
      data: { checkoutId },
    });
  }

  async uploadPrescription(token: string, formData: FormData) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.prescriptions.upload), {
      headers: { ...this.authHeaders(token) },
      data: formData,
    });
  }

  async verifyPrescription(
    token: string,
    prescriptionId: string,
    data: { verified: boolean; notes?: string },
  ) {
    return this.ctx.post(
      this.url(API_ENDPOINTS.brocolis.prescriptions.verify.replace(':id', prescriptionId)),
      {
        headers: this.authHeaders(token),
        data,
      },
    );
  }

  async getPrescription(token: string, prescriptionId: string) {
    return this.ctx.get(
      this.url(API_ENDPOINTS.brocolis.prescriptions.get.replace(':id', prescriptionId)),
      {
        headers: this.authHeaders(token),
      },
    );
  }

  async listPrescriptions(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.prescriptions.list), {
      headers: this.authHeaders(token),
    });
  }

  async getPharmacyDashboard(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.pharmacy.dashboard), {
      headers: this.authHeaders(token),
    });
  }

  async getPharmacyOrders(
    token: string,
    params?: { status?: string; page?: number; limit?: number },
  ) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.pharmacy.orders), {
      headers: this.authHeaders(token),
      params,
    });
  }

  async updateOrderStatus(token: string, orderId: string, status: string) {
    return this.ctx.patch(
      this.url(API_ENDPOINTS.brocolis.pharmacy.orderUpdate.replace(':id', orderId)),
      {
        headers: this.authHeaders(token),
        data: { status },
      },
    );
  }

  async getInventory(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.pharmacy.inventory), {
      headers: this.authHeaders(token),
    });
  }

  async updateInventory(token: string, productId: string, data: { stock: number }) {
    return this.ctx.patch(
      this.url(API_ENDPOINTS.brocolis.pharmacy.inventoryUpdate.replace(':id', productId)),
      {
        headers: this.authHeaders(token),
        data,
      },
    );
  }

  async getFinancialReports(
    token: string,
    params?: { period?: string; startDate?: string; endDate?: string },
  ) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.pharmacy.reports), {
      headers: this.authHeaders(token),
      params,
    });
  }

  async getAdminDashboard(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.admin.dashboard), {
      headers: this.authHeaders(token),
    });
  }

  async listPharmacies(token: string, params?: { status?: string; page?: number; limit?: number }) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.admin.pharmacies), {
      headers: this.authHeaders(token),
      params,
    });
  }

  async approvePharmacy(token: string, pharmacyId: string) {
    return this.ctx.post(
      this.url(API_ENDPOINTS.brocolis.admin.approvePharmacy.replace(':id', pharmacyId)),
      {
        headers: this.authHeaders(token),
      },
    );
  }

  async getCommissions(token: string, params?: { period?: string; pharmacyId?: string }) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.admin.commissions), {
      headers: this.authHeaders(token),
      params,
    });
  }

  async getAuditLog(token: string, params?: { page?: number; limit?: number; type?: string }) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.admin.auditLog), {
      headers: this.authHeaders(token),
      params,
    });
  }

  async getFeatureFlags(token: string) {
    return this.ctx.get(this.url(API_ENDPOINTS.brocolis.admin.featureFlags), {
      headers: this.authHeaders(token),
    });
  }

  async toggleFeatureFlag(token: string, flag: string, enabled: boolean) {
    return this.ctx.patch(this.url(API_ENDPOINTS.brocolis.admin.featureFlags), {
      headers: this.authHeaders(token),
      data: { flag, enabled },
    });
  }

  async aiChat(token: string, message: string, context?: Record<string, unknown>) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.aiAssistant.chat), {
      headers: this.authHeaders(token),
      data: { message, context },
    });
  }

  async aiAskMedication(token: string, query: string) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.aiAssistant.askMedication), {
      headers: this.authHeaders(token),
      data: { query },
    });
  }

  async aiRecommendations(token: string, symptoms: string[]) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.aiAssistant.recommendations), {
      headers: this.authHeaders(token),
      data: { symptoms },
    });
  }

  async aiVerifyPrescription(token: string, prescriptionId: string) {
    return this.ctx.post(this.url(API_ENDPOINTS.brocolis.aiAssistant.verifyPrescription), {
      headers: this.authHeaders(token),
      data: { prescriptionId },
    });
  }
}

export class TestDataGenerator {
  static randomEmail(): string {
    return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  }

  static randomCPF(): string {
    const nums = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const d1 = ((nums.reduce((s, n, i) => s + n * (10 - i), 0) * 10) % 11) % 10;
    nums.push(d1);
    const d2 = ((nums.reduce((s, n, i) => s + n * (11 - i), 0) * 10) % 11) % 10;
    nums.push(d2);
    const formatted = nums.join('');
    return `${formatted.slice(0, 3)}.${formatted.slice(3, 6)}.${formatted.slice(6, 9)}-${formatted.slice(9)}`;
  }

  static randomPhone(): string {
    return `+55 11 9${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`;
  }

  static randomAddress() {
    return {
      street: `Rua ${Math.random().toString(36).slice(2, 10)}, ${Math.floor(Math.random() * 5000)}`,
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zip: `${String(Math.floor(Math.random() * 90000 + 10000))}-${String(Math.floor(Math.random() * 900 + 100))}`,
    };
  }

  static orderPayload(overrides?: Record<string, unknown>) {
    return {
      items: [
        { productId: 'prod-omeprazol-002', quantity: 2 },
        { productId: 'prod-vitaminac-004', quantity: 1 },
      ],
      shippingAddress: TestDataGenerator.randomAddress(),
      ...overrides,
    };
  }

  static paymentPayload(
    overrides?: Record<string, unknown> & { paymentMethod?: 'credit_card' | 'pix' | 'boleto' },
  ) {
    return {
      amount: 59.3,
      currency: 'brl',
      paymentMethod: 'credit_card' as const,
      customerId: `cust-${Date.now()}`,
      metadata: { orderType: 'e2e-test', source: 'playwright' },
      ...overrides,
    };
  }
}
