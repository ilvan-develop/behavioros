import type { Locator, Page } from '@playwright/test';

export class MobileCheckoutPage {
  readonly page: Page;
  readonly hamburgerMenu: Locator;
  readonly cartIcon: Locator;
  readonly productGrid: Locator;
  readonly productCards: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly addToCartButton: Locator;
  readonly cartItems: Locator;
  readonly checkoutButton: Locator;
  readonly orderHistoryButton: Locator;
  readonly orderList: Locator;
  readonly orderDetail: Locator;
  readonly trackingInfo: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.hamburgerMenu = page.locator('[data-testid="mobile-menu-button"]');
    this.cartIcon = page.locator('[data-testid="cart-icon"]');
    this.productGrid = page.locator('[data-testid="product-grid"]');
    this.productCards = page.locator('[data-testid="product-card"]');
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.searchButton = page.locator('[data-testid="search-button"]');
    this.addToCartButton = page.locator('[data-testid="add-to-cart-button"]');
    this.cartItems = page.locator('[data-testid="cart-item"]');
    this.checkoutButton = page.locator('[data-testid="checkout-button"]');
    this.orderHistoryButton = page.locator('[data-testid="order-history-button"]');
    this.orderList = page.locator('[data-testid="order-list"]');
    this.orderDetail = page.locator('[data-testid="order-detail"]');
    this.trackingInfo = page.locator('[data-testid="tracking-info"]');
    this.backButton = page.locator('[data-testid="back-button"]');
  }

  async goto() {
    await this.page.goto('/');
  }

  async browseProducts() {
    await this.page.goto('/products');
    await this.page.waitForSelector('[data-testid="product-grid"]', { timeout: 15_000 });
  }

  async searchProducts(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.page.waitForSelector('[data-testid="product-grid"]', { timeout: 10_000 });
  }

  async addFirstProductToCart() {
    await this.productCards.first().click();
    await this.page.waitForSelector('[data-testid="add-to-cart-button"]', { timeout: 10_000 });
    await this.addToCartButton.click();
  }

  async goToCart() {
    await this.cartIcon.click();
    await this.page.waitForSelector('[data-testid="cart-item"]', { timeout: 10_000 });
  }

  async proceedToCheckout() {
    await this.checkoutButton.click();
  }

  async viewOrderHistory() {
    await this.orderHistoryButton.click();
    await this.page.waitForSelector('[data-testid="order-list"]', { timeout: 10_000 });
  }

  async viewOrderDetail(orderIndex: number) {
    await this.orderList.locator('[data-testid="order-item"]').nth(orderIndex).click();
    await this.page.waitForSelector('[data-testid="order-detail"]', { timeout: 10_000 });
  }

  async viewTracking() {
    await this.page.locator('[data-testid="track-order-button"]').click();
    await this.page.waitForSelector('[data-testid="tracking-info"]', { timeout: 10_000 });
  }
}
