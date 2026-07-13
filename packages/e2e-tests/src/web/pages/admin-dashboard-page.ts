import type { Locator, Page } from '@playwright/test';

export class AdminDashboardPage {
  readonly page: Page;
  readonly loginEmailInput: Locator;
  readonly loginPasswordInput: Locator;
  readonly loginButton: Locator;
  readonly dashboardTitle: Locator;
  readonly platformAnalyticsTab: Locator;
  readonly totalUsersMetric: Locator;
  readonly totalOrdersMetric: Locator;
  readonly totalRevenueMetric: Locator;
  readonly pharmaciesTab: Locator;
  readonly pharmacyList: Locator;
  readonly approvePharmacyButton: Locator;
  readonly commissionsTab: Locator;
  readonly commissionList: Locator;
  readonly auditLogTab: Locator;
  readonly auditLogList: Locator;
  readonly featureFlagsTab: Locator;
  readonly featureFlagToggle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginEmailInput = page.locator('[data-testid="login-email"]');
    this.loginPasswordInput = page.locator('[data-testid="login-password"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.dashboardTitle = page.locator('[data-testid="admin-dashboard-title"]');
    this.platformAnalyticsTab = page.locator('[data-testid="tab-analytics"]');
    this.totalUsersMetric = page.locator('[data-testid="metric-total-users"]');
    this.totalOrdersMetric = page.locator('[data-testid="metric-total-orders"]');
    this.totalRevenueMetric = page.locator('[data-testid="metric-total-revenue"]');
    this.pharmaciesTab = page.locator('[data-testid="tab-pharmacies"]');
    this.pharmacyList = page.locator('[data-testid="pharmacy-list"]');
    this.approvePharmacyButton = page.locator('[data-testid="approve-pharmacy-button"]');
    this.commissionsTab = page.locator('[data-testid="tab-commissions"]');
    this.commissionList = page.locator('[data-testid="commission-list"]');
    this.auditLogTab = page.locator('[data-testid="tab-audit-log"]');
    this.auditLogList = page.locator('[data-testid="audit-log-list"]');
    this.featureFlagsTab = page.locator('[data-testid="tab-feature-flags"]');
    this.featureFlagToggle = page.locator('[data-testid="feature-flag-toggle"]');
  }

  async goto() {
    await this.page.goto('/admin/dashboard');
  }

  async login(email: string, password: string) {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForSelector('[data-testid="admin-dashboard-title"]', { timeout: 15_000 });
  }

  async viewPlatformAnalytics() {
    await this.platformAnalyticsTab.click();
    await this.page.waitForSelector('[data-testid="metric-total-users"]', { timeout: 10_000 });
  }

  async approvePharmacy(pharmacyIndex: number) {
    await this.pharmaciesTab.click();
    await this.page.waitForSelector('[data-testid="pharmacy-list"]', { timeout: 10_000 });
    await this.pharmacyList
      .locator('[data-testid="pharmacy-item"]')
      .nth(pharmacyIndex)
      .locator('[data-testid="approve-pharmacy-button"]')
      .click();
  }

  async viewCommissions() {
    await this.commissionsTab.click();
    await this.page.waitForSelector('[data-testid="commission-list"]', { timeout: 10_000 });
  }

  async viewAuditLog() {
    await this.auditLogTab.click();
    await this.page.waitForSelector('[data-testid="audit-log-list"]', { timeout: 10_000 });
  }

  async manageFeatureFlags() {
    await this.featureFlagsTab.click();
    await this.page.waitForSelector('[data-testid="feature-flag-toggle"]', { timeout: 10_000 });
  }

  async toggleFeatureFlag(index: number) {
    await this.featureFlagToggle.nth(index).click();
  }
}
