import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_COUPONS, TEST_PAYMENT_DATA, TEST_USERS } from '../fixtures/test-data';
import { CheckoutPage } from './pages/checkout-page';

test.describe('Web Checkout Flow', () => {
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page);
  });

  test('should browse catalog, add to cart, and checkout', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

    await page.locator('[data-testid="product-card"]').first().click();
    await page.waitForSelector('[data-testid="product-detail"]');

    await page.locator('[data-testid="add-to-cart-button"]').click();
    await expect(page.locator('[data-testid="cart-badge"]')).toBeVisible();

    await page.goto('/cart');
    await expect(page.locator('[data-testid="cart-item"]')).toBeVisible();

    await checkoutPage.goto();
    await expect(checkoutPage.shippingAddressForm).toBeVisible();

    await checkoutPage.fillShippingAddress(TEST_USERS.customer.address);
    await checkoutPage.proceedToPayment();

    await checkoutPage.selectPaymentMethod('credit_card');
    await checkoutPage.fillCardDetails({
      number: TEST_PAYMENT_DATA.creditCard.cardNumber,
      expiry: `${TEST_PAYMENT_DATA.creditCard.expiryMonth}/${TEST_PAYMENT_DATA.creditCard.expiryYear}`,
      cvc: TEST_PAYMENT_DATA.creditCard.cvv,
      name: TEST_PAYMENT_DATA.creditCard.cardHolder,
    });

    await checkoutPage.completePayment();
    expect(await checkoutPage.isOrderConfirmed()).toBe(true);
  });

  test('should apply a coupon code', async ({ page }) => {
    await page.goto('/products');
    await page.locator('[data-testid="product-card"]').first().click();
    await page.locator('[data-testid="add-to-cart-button"]').click();
    await page.goto('/cart');
    await page.goto('/checkout');

    const originalTotal = await checkoutPage.cartTotal.textContent();

    await checkoutPage.applyCoupon(TEST_COUPONS[0].code);
    await expect(checkoutPage.couponSuccessMessage).toBeVisible();

    const discountedTotal = await checkoutPage.cartTotal.textContent();
    expect(discountedTotal).not.toBe(originalTotal);
  });

  test('should select Stripe payment method', async ({ page }) => {
    await page.goto('/checkout');
    await checkoutPage.fillShippingAddress(TEST_USERS.customer.address);
    await checkoutPage.proceedToPayment();

    await checkoutPage.selectPaymentMethod('credit_card');
    await expect(page.locator('[data-testid="stripe-element"]')).toBeVisible();
  });

  test('should select FinPay payment method', async ({ page }) => {
    await page.goto('/checkout');
    await checkoutPage.fillShippingAddress(TEST_USERS.customer.address);
    await checkoutPage.proceedToPayment();

    await page.locator('[data-testid="payment-method-pix"]').click();
    await expect(page.locator('[data-testid="pix-qrcode"]')).toBeVisible();
  });

  test('should complete payment and see order confirmation', async ({ page }) => {
    await page.goto('/checkout');
    await checkoutPage.fillShippingAddress(TEST_USERS.customer.address);
    await checkoutPage.proceedToPayment();
    await checkoutPage.selectPaymentMethod('credit_card');
    await checkoutPage.fillCardDetails({
      number: TEST_PAYMENT_DATA.creditCard.cardNumber,
      expiry: '12/28',
      cvc: '123',
      name: 'Maria Silva',
    });
    await checkoutPage.completePayment();

    await expect(checkoutPage.orderConfirmationTitle).toBeVisible();
    await expect(checkoutPage.orderIdText).not.toBeEmpty();
    await expect(checkoutPage.orderStatusBadge).toContainText(/confirmed|processing/);
  });

  test('should view order confirmation and track status', async ({ page }) => {
    await page.goto('/checkout');
    await checkoutPage.fillShippingAddress(TEST_USERS.customer.address);
    await checkoutPage.proceedToPayment();
    await checkoutPage.selectPaymentMethod('credit_card');
    await checkoutPage.fillCardDetails({
      number: '4111111111111111',
      expiry: '12/28',
      cvc: '123',
      name: 'Maria Silva',
    });
    await checkoutPage.completePayment();

    const orderId = await checkoutPage.getOrderId();
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('[data-testid="order-tracking"]')).toBeVisible();
    await expect(page.locator('[data-testid="order-status"]')).toBeVisible();

    const statusSteps = page.locator('[data-testid="status-step"]');
    await expect(statusSteps.first()).toBeVisible();
    const activeStep = statusSteps.locator('[class*="active"]');
    expect(await activeStep.count()).toBeGreaterThanOrEqual(1);
  });

  test('should handle payment failure gracefully', async ({ page }) => {
    await page.goto('/checkout');
    await checkoutPage.fillShippingAddress(TEST_USERS.customer.address);
    await checkoutPage.proceedToPayment();
    await checkoutPage.selectPaymentMethod('credit_card');
    await checkoutPage.fillCardDetails({
      number: '4000000000000002',
      expiry: '12/28',
      cvc: '123',
      name: 'Maria Silva',
    });
    await checkoutPage.payButton.click();

    await expect(checkoutPage.errorMessage).toBeVisible({ timeout: 15_000 });
    await expect(checkoutPage.errorMessage).toContainText(/declined|insufficient|error/);

    await expect(page.locator('[data-testid="retry-payment-button"]')).toBeVisible();
  });
});
