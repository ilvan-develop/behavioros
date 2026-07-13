import type { Locator, Page } from '@playwright/test';

export class CheckoutPage {
  readonly page: Page;
  readonly cartItems: Locator;
  readonly cartTotal: Locator;
  readonly checkoutButton: Locator;
  readonly couponInput: Locator;
  readonly applyCouponButton: Locator;
  readonly couponSuccessMessage: Locator;
  readonly paymentMethodCreditCard: Locator;
  readonly paymentMethodPix: Locator;
  readonly paymentMethodBoleto: Locator;
  readonly cardNumberInput: Locator;
  readonly cardExpiryInput: Locator;
  readonly cardCvcInput: Locator;
  readonly cardNameInput: Locator;
  readonly payButton: Locator;
  readonly orderConfirmationTitle: Locator;
  readonly orderIdText: Locator;
  readonly orderStatusBadge: Locator;
  readonly errorMessage: Locator;
  readonly shippingAddressForm: Locator;
  readonly continueToPaymentButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.cartItems = page.locator('[data-testid="cart-item"]');
    this.cartTotal = page.locator('[data-testid="cart-total"]');
    this.checkoutButton = page.locator('[data-testid="checkout-button"]');
    this.couponInput = page.locator('[data-testid="coupon-input"]');
    this.applyCouponButton = page.locator('[data-testid="apply-coupon"]');
    this.couponSuccessMessage = page.locator('[data-testid="coupon-success"]');
    this.paymentMethodCreditCard = page.locator('[data-testid="payment-method-credit-card"]');
    this.paymentMethodPix = page.locator('[data-testid="payment-method-pix"]');
    this.paymentMethodBoleto = page.locator('[data-testid="payment-method-boleto"]');
    this.cardNumberInput = page.locator('[data-testid="card-number"]');
    this.cardExpiryInput = page.locator('[data-testid="card-expiry"]');
    this.cardCvcInput = page.locator('[data-testid="card-cvc"]');
    this.cardNameInput = page.locator('[data-testid="card-name"]');
    this.payButton = page.locator('[data-testid="pay-button"]');
    this.orderConfirmationTitle = page.locator('[data-testid="order-confirmation-title"]');
    this.orderIdText = page.locator('[data-testid="order-id"]');
    this.orderStatusBadge = page.locator('[data-testid="order-status"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.shippingAddressForm = page.locator('[data-testid="shipping-address-form"]');
    this.continueToPaymentButton = page.locator('[data-testid="continue-to-payment"]');
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  async addToCart(productId: string, quantity: number = 1) {
    await this.page.goto(`/products/${productId}`);
    await this.page.locator('[data-testid="quantity-selector"]').fill(String(quantity));
    await this.page.locator('[data-testid="add-to-cart-button"]').click();
  }

  async applyCoupon(code: string) {
    await this.couponInput.fill(code);
    await this.applyCouponButton.click();
  }

  async selectPaymentMethod(method: 'credit_card' | 'pix' | 'boleto') {
    const selector = {
      credit_card: this.paymentMethodCreditCard,
      pix: this.paymentMethodPix,
      boleto: this.paymentMethodBoleto,
    }[method];
    await selector.click();
  }

  async fillCardDetails(details: { number: string; expiry: string; cvc: string; name: string }) {
    await this.cardNumberInput.fill(details.number);
    await this.cardExpiryInput.fill(details.expiry);
    await this.cardCvcInput.fill(details.cvc);
    await this.cardNameInput.fill(details.name);
  }

  async fillShippingAddress(address: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  }) {
    await this.page.locator('[data-testid="address-street"]').fill(address.street);
    await this.page.locator('[data-testid="address-neighborhood"]').fill(address.neighborhood);
    await this.page.locator('[data-testid="address-city"]').fill(address.city);
    await this.page.locator('[data-testid="address-state"]').fill(address.state);
    await this.page.locator('[data-testid="address-zip"]').fill(address.zip);
  }

  async proceedToPayment() {
    await this.continueToPaymentButton.click();
  }

  async completePayment() {
    await this.payButton.click();
    await this.page.waitForSelector('[data-testid="order-confirmation-title"]', {
      timeout: 30_000,
    });
  }

  async getOrderId(): Promise<string> {
    return (await this.orderIdText.textContent()) || '';
  }

  async isOrderConfirmed(): Promise<boolean> {
    return this.orderConfirmationTitle.isVisible();
  }
}
