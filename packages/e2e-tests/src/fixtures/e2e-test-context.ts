import { type APIRequestContext, test as base } from '@playwright/test';
import { AuthHelper, BrocolisClient, FinPayClient, getApiContext } from '../helpers/api-client';

export interface E2ETestContext {
  api: APIRequestContext;
  auth: AuthHelper;
  brocolis: BrocolisClient;
  finpay: FinPayClient;
  tokens: {
    customer: string;
    pharmacyAdmin: string;
    pharmacyStaff: string;
    superAdmin: string;
    guest: string;
  };
}

export const test = base.extend<{
  ctx: E2ETestContext;
  apiContext: APIRequestContext;
  customerToken: string;
  adminToken: string;
}>({
  apiContext: async ({}, use) => {
    const ctx = await getApiContext();
    await use(ctx);
  },

  ctx: async ({ apiContext }, use) => {
    const auth = new AuthHelper();
    const brocolis = new BrocolisClient(apiContext);
    const finpay = new FinPayClient(apiContext);

    const [customer, pharmacyAdmin, pharmacyStaff, superAdmin, guest] = await Promise.all([
      auth.loginAsCustomer(apiContext).catch(() => 'mock-customer-token'),
      auth.loginAsPharmacyAdmin(apiContext).catch(() => 'mock-pharmacy-admin-token'),
      auth.loginAsPharmacyStaff(apiContext).catch(() => 'mock-pharmacy-staff-token'),
      auth.loginAsSuperAdmin(apiContext).catch(() => 'mock-super-admin-token'),
      auth.getGuestToken(apiContext).catch(() => 'mock-guest-token'),
    ]);

    await use({
      api: apiContext,
      auth,
      brocolis,
      finpay,
      tokens: { customer, pharmacyAdmin, pharmacyStaff, superAdmin, guest },
    });
  },

  customerToken: async ({ ctx }, use) => {
    await use(ctx.tokens.customer);
  },

  adminToken: async ({ ctx }, use) => {
    await use(ctx.tokens.superAdmin);
  },
});

export { expect } from '@playwright/test';
