import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_USERS } from '../fixtures/test-data';
import { AiAssistantPage } from './pages/ai-assistant-page';

test.describe('AI Assistant', () => {
  let aiPage: AiAssistantPage;

  test.beforeEach(async ({ page }) => {
    aiPage = new AiAssistantPage(page);
  });

  test('should open AI assistant', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await aiPage.open();
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-assistant-header"]')).toContainText(
      /assistente|ajuda|ai/i,
    );
  });

  test('should answer medication questions', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await aiPage.open();
    await aiPage.sendMessage('Quais os efeitos colaterais da Losartana?');
    const response = await aiPage.getLastResponse();

    expect(response).toBeTruthy();
    expect(response.toLowerCase()).toContain('losartana');
  });

  test('should provide health recommendations', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await aiPage.open();
    await aiPage.getRecommendations('Estou com dor de cabeça e febre há 3 dias');

    await expect(aiPage.recommendationsList).toBeVisible();
    const recommendations = aiPage.recommendationsList.locator(
      '[data-testid="recommendation-item"]',
    );
    expect(await recommendations.count()).toBeGreaterThan(0);

    const firstRec = await recommendations.first().textContent();
    expect(firstRec).toBeTruthy();
    expect(firstRec?.toLowerCase()).toContain('recomend');
  });

  test('should get medication information', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await aiPage.open();
    const info = await aiPage.getMedicationInfo('Omeprazol 20mg para que serve?');

    expect(info).toBeTruthy();
    expect(info.toLowerCase()).toContain('omeprazol');
  });

  test('should verify prescription via AI assistant', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.pharmacyStaff.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.pharmacyStaff.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForURL(/\/?$/, { timeout: 15_000 });

    await aiPage.open();
    await aiPage.verifyPrescription();
    await expect(aiPage.verificationResult).toBeVisible();

    const result = await aiPage.verificationResult.textContent();
    expect(result?.toLowerCase()).toMatch(/verified|approved|valid/);
  });
});
