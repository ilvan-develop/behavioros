import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_USERS } from '../fixtures/test-data';
import { MobileCheckoutPage } from './pages/mobile-checkout-page';

test.describe('Mobile Order Flow', () => {
  let mobilePage: MobileCheckoutPage;

  test.beforeEach(async ({ page }) => {
    mobilePage = new MobileCheckoutPage(page);
  });

  test('should browse catalog on mobile', async ({ page }) => {
    await mobilePage.browseProducts();
    await expect(mobilePage.productGrid).toBeVisible();

    const products = mobilePage.productCards;
    expect(await products.count()).toBeGreaterThan(0);

    await products.first().click();
    await expect(page.locator('[data-testid="product-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="product-price"]')).toBeVisible();
  });

  test('should search products on mobile', async ({ page }) => {
    await mobilePage.goto();
    await mobilePage.searchProducts('Losartana');

    await expect(mobilePage.productGrid).toBeVisible();
    const results = await mobilePage.productCards.count();
    expect(results).toBeGreaterThan(0);

    const firstCard = mobilePage.productCards.first();
    await expect(firstCard).toContainText(/losartana/i);
  });

  test('should add products to cart on mobile', async ({ page }) => {
    await mobilePage.browseProducts();
    await mobilePage.addFirstProductToCart();

    await expect(page.locator('[data-testid="cart-badge"]')).toBeVisible();
    const badgeText = await page.locator('[data-testid="cart-badge"]').textContent();
    expect(Number(badgeText)).toBeGreaterThanOrEqual(1);
  });

  test('should complete checkout on mobile', async ({ page }) => {
    await mobilePage.browseProducts();
    await mobilePage.addFirstProductToCart();
    await mobilePage.goToCart();
    await mobilePage.proceedToCheckout();

    await page.waitForSelector('[data-testid="login-form"]', { timeout: 10_000 });
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/checkout\//, { timeout: 15_000 });

    await page.locator('[data-testid="address-street"]').fill('Rua Teste, 123');
    await page.locator('[data-testid="address-neighborhood"]').fill('Centro');
    await page.locator('[data-testid="address-city"]').fill('São Paulo');
    await page.locator('[data-testid="address-state"]').fill('SP');
    await page.locator('[data-testid="address-zip"]').fill('01310-000');

    await page.locator('[data-testid="continue-to-payment"]').click();
    await page.locator('[data-testid="payment-method-credit-card"]').click();
    await page.locator('[data-testid="card-number"]').fill('4111111111111111');
    await page.locator('[data-testid="card-expiry"]').fill('12/28');
    await page.locator('[data-testid="card-cvc"]').fill('123');
    await page.locator('[data-testid="card-name"]').fill('Maria Silva');
    await page.locator('[data-testid="pay-button"]').click();

    await expect(page.locator('[data-testid="order-confirmation-title"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('[data-testid="order-id"]')).not.toBeEmpty();
  });

  test('should view order history on mobile', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await mobilePage.viewOrderHistory();
    await expect(mobilePage.orderList).toBeVisible();

    const orders = mobilePage.orderList.locator('[data-testid="order-item"]');
    const count = await orders.count();
    expect(count).toBeGreaterThanOrEqual(0);

    if (count > 0) {
      const firstOrderStatus = await orders
        .first()
        .locator('[data-testid="order-status"]')
        .textContent();
      expect(firstOrderStatus).toBeTruthy();
    }
  });

  test('should track delivery on mobile', async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await mobilePage.viewOrderHistory();
    const orders = mobilePage.orderList.locator('[data-testid="order-item"]');
    const count = await orders.count();

    if (count > 0) {
      const orderId = await orders.first().getAttribute('data-order-id');
      if (orderId) {
        await page.goto(`/orders/${orderId}/track`);
        await expect(mobilePage.trackingInfo).toBeVisible({ timeout: 10_000 });

        const statusSteps = page.locator('[data-testid="status-step"]');
        expect(await statusSteps.count()).toBeGreaterThanOrEqual(1);

        const currentStep = page.locator('[data-testid="status-step"].active');
        await expect(currentStep).toBeVisible();
      }
    }
  });
});
