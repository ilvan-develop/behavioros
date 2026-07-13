import type { Locator, Page } from '@playwright/test';

export class PharmacyDashboardPage {
  readonly page: Page;
  readonly loginEmailInput: Locator;
  readonly loginPasswordInput: Locator;
  readonly loginButton: Locator;
  readonly dashboardTitle: Locator;
  readonly incomingOrdersTab: Locator;
  readonly ordersList: Locator;
  readonly orderStatusDropdown: Locator;
  readonly updateStatusButton: Locator;
  readonly inventoryTab: Locator;
  readonly inventoryList: Locator;
  readonly lowStockAlerts: Locator;
  readonly financialReportsTab: Locator;
  readonly revenueMetric: Locator;
  readonly ordersMetric: Locator;
  readonly staffTab: Locator;
  readonly staffList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginEmailInput = page.locator('[data-testid="login-email"]');
    this.loginPasswordInput = page.locator('[data-testid="login-password"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.dashboardTitle = page.locator('[data-testid="dashboard-title"]');
    this.incomingOrdersTab = page.locator('[data-testid="tab-incoming-orders"]');
    this.ordersList = page.locator('[data-testid="orders-list"]');
    this.orderStatusDropdown = page.locator('[data-testid="order-status-select"]');
    this.updateStatusButton = page.locator('[data-testid="update-status-button"]');
    this.inventoryTab = page.locator('[data-testid="tab-inventory"]');
    this.inventoryList = page.locator('[data-testid="inventory-list"]');
    this.lowStockAlerts = page.locator('[data-testid="low-stock-alerts"]');
    this.financialReportsTab = page.locator('[data-testid="tab-financial-reports"]');
    this.revenueMetric = page.locator('[data-testid="metric-revenue"]');
    this.ordersMetric = page.locator('[data-testid="metric-orders"]');
    this.staffTab = page.locator('[data-testid="tab-staff"]');
    this.staffList = page.locator('[data-testid="staff-list"]');
  }

  async goto() {
    await this.page.goto('/pharmacy/dashboard');
  }

  async login(email: string, password: string) {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForSelector('[data-testid="dashboard-title"]', { timeout: 15_000 });
  }

  async viewIncomingOrders() {
    await this.incomingOrdersTab.click();
    await this.page.waitForSelector('[data-testid="orders-list"]', { timeout: 10_000 });
  }

  async updateOrderStatus(orderIndex: number, newStatus: string) {
    const order = this.ordersList.locator('[data-testid="order-item"]').nth(orderIndex);
    await order.locator('[data-testid="order-status-select"]').selectOption(newStatus);
    await order.locator('[data-testid="update-status-button"]').click();
  }

  async viewInventory() {
    await this.inventoryTab.click();
    await this.page.waitForSelector('[data-testid="inventory-list"]', { timeout: 10_000 });
  }

  async viewFinancialReports() {
    await this.financialReportsTab.click();
    await this.page.waitForSelector('[data-testid="metric-revenue"]', { timeout: 10_000 });
  }

  async manageStaff() {
    await this.staffTab.click();
    await this.page.waitForSelector('[data-testid="staff-list"]', { timeout: 10_000 });
  }
}
