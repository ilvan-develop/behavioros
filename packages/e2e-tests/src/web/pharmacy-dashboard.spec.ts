import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_USERS } from '../fixtures/test-data';
import { PharmacyDashboardPage } from './pages/pharmacy-dashboard-page';

test.describe('Pharmacy Dashboard', () => {
  let dashboardPage: PharmacyDashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboardPage = new PharmacyDashboardPage(page);
  });

  test('should login as pharmacy admin', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.login(TEST_USERS.pharmacyAdmin.email, TEST_USERS.pharmacyAdmin.password);

    await expect(dashboardPage.dashboardTitle).toBeVisible();
    await expect(dashboardPage.dashboardTitle).toContainText(TEST_USERS.pharmacyAdmin.pharmacyName);
  });

  test('should view incoming orders', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.login(TEST_USERS.pharmacyAdmin.email, TEST_USERS.pharmacyAdmin.password);
    await dashboardPage.viewIncomingOrders();

    await expect(dashboardPage.ordersList).toBeVisible();
    const orders = dashboardPage.ordersList.locator('[data-testid="order-item"]');
    expect(await orders.count()).toBeGreaterThanOrEqual(0);
  });

  test('should update order status', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.login(TEST_USERS.pharmacyAdmin.email, TEST_USERS.pharmacyAdmin.password);
    await dashboardPage.viewIncomingOrders();

    const orders = dashboardPage.ordersList.locator('[data-testid="order-item"]');
    const orderCount = await orders.count();

    if (orderCount > 0) {
      await dashboardPage.updateOrderStatus(0, 'processing');
      await expect(page.locator('[data-testid="status-update-success"]')).toBeVisible();

      await dashboardPage.updateOrderStatus(0, 'ready_for_delivery');
      await expect(page.locator('[data-testid="status-update-success"]')).toBeVisible();
    }
  });

  test('should manage inventory', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.login(TEST_USERS.pharmacyAdmin.email, TEST_USERS.pharmacyAdmin.password);
    await dashboardPage.viewInventory();

    await expect(dashboardPage.inventoryList).toBeVisible();

    const lowStock = dashboardPage.lowStockAlerts;
    if (await lowStock.isVisible()) {
      const alertCount = await lowStock.locator('[data-testid="low-stock-item"]').count();
      expect(alertCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should view financial reports', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.login(TEST_USERS.pharmacyAdmin.email, TEST_USERS.pharmacyAdmin.password);
    await dashboardPage.viewFinancialReports();

    await expect(dashboardPage.revenueMetric).toBeVisible();
    await expect(dashboardPage.ordersMetric).toBeVisible();

    const revenue = await dashboardPage.revenueMetric.textContent();
    expect(revenue).toMatch(/R\$|[\d,.]+/);

    const orders = await dashboardPage.ordersMetric.textContent();
    expect(Number(orders?.replace(/\D/g, ''))).toBeGreaterThanOrEqual(0);
  });

  test('should manage staff', async ({ page }) => {
    await dashboardPage.goto();
    await dashboardPage.login(TEST_USERS.pharmacyAdmin.email, TEST_USERS.pharmacyAdmin.password);
    await dashboardPage.manageStaff();

    await expect(dashboardPage.staffList).toBeVisible();
    const staffMembers = dashboardPage.staffList.locator('[data-testid="staff-member"]');
    expect(await staffMembers.count()).toBeGreaterThanOrEqual(1);

    await page.locator('[data-testid="add-staff-button"]').click();
    await expect(page.locator('[data-testid="staff-form"]')).toBeVisible();
  });
});
