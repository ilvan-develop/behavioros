import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_PHARMACIES, TEST_USERS } from '../fixtures/test-data';
import { AdminDashboardPage } from './pages/admin-dashboard-page';

test.describe('Admin Dashboard', () => {
  let adminPage: AdminDashboardPage;

  test.beforeEach(async ({ page }) => {
    adminPage = new AdminDashboardPage(page);
  });

  test('should login as super admin', async ({ page }) => {
    await adminPage.goto();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);

    await expect(adminPage.dashboardTitle).toBeVisible();
    await expect(adminPage.page).toHaveURL(/\/admin\/dashboard/);
  });

  test('should view platform analytics', async ({ page }) => {
    await adminPage.goto();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await adminPage.viewPlatformAnalytics();

    await expect(adminPage.totalUsersMetric).toBeVisible();
    await expect(adminPage.totalOrdersMetric).toBeVisible();
    await expect(adminPage.totalRevenueMetric).toBeVisible();

    const users = await adminPage.totalUsersMetric.textContent();
    expect(Number(users?.replace(/\D/g, ''))).toBeGreaterThanOrEqual(0);

    const orders = await adminPage.totalOrdersMetric.textContent();
    expect(Number(orders?.replace(/\D/g, ''))).toBeGreaterThanOrEqual(0);
  });

  test('should approve a new pharmacy', async ({ page }) => {
    await adminPage.goto();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await adminPage.approvePharmacy(0);

    await expect(page.locator('[data-testid="approval-success"]')).toBeVisible();

    await page.reload();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await adminPage.pharmaciesTab.click();

    const pharmacyStatus = page.locator(`[data-testid="pharmacy-status-${TEST_PHARMACIES[2].id}"]`);
    if (await pharmacyStatus.isVisible()) {
      await expect(pharmacyStatus).toHaveText(/active|approved/);
    }
  });

  test('should manage commissions', async ({ page }) => {
    await adminPage.goto();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await adminPage.viewCommissions();

    await expect(adminPage.commissionList).toBeVisible();
    const commissions = adminPage.commissionList.locator('[data-testid="commission-item"]');

    if ((await commissions.count()) > 0) {
      const firstCommissionValue = await commissions
        .first()
        .locator('[data-testid="commission-value"]')
        .textContent();
      expect(firstCommissionValue).toMatch(/R\$|[\d,.]+/);
    }

    await page.locator('[data-testid="adjust-commission-button"]').first().click();
    await expect(page.locator('[data-testid="commission-form"]')).toBeVisible();
  });

  test('should view audit log', async ({ page }) => {
    await adminPage.goto();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await adminPage.viewAuditLog();

    await expect(adminPage.auditLogList).toBeVisible();
    const entries = adminPage.auditLogList.locator('[data-testid="audit-entry"]');
    expect(await entries.count()).toBeGreaterThanOrEqual(1);

    const firstEntryType = await entries
      .first()
      .locator('[data-testid="audit-entry-type"]')
      .textContent();
    expect(firstEntryType).toBeTruthy();
  });

  test('should manage feature flags', async ({ page }) => {
    await adminPage.goto();
    await adminPage.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
    await adminPage.manageFeatureFlags();

    const initialToggleState = await adminPage.featureFlagToggle.first().isChecked();

    await adminPage.toggleFeatureFlag(0);
    await expect(page.locator('[data-testid="flag-update-success"]')).toBeVisible();

    await adminPage.toggleFeatureFlag(0);
    const finalToggleState = await adminPage.featureFlagToggle.first().isChecked();
    expect(finalToggleState).toBe(initialToggleState);
  });
});
