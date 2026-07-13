import type { Locator, Page } from '@playwright/test';

export class AiAssistantPage {
  readonly page: Page;
  readonly chatButton: Locator;
  readonly chatInput: Locator;
  readonly sendMessageButton: Locator;
  readonly chatMessages: Locator;
  readonly medicationQueryInput: Locator;
  readonly askMedicationButton: Locator;
  readonly medicationResult: Locator;
  readonly recommendationInput: Locator;
  readonly getRecommendationsButton: Locator;
  readonly recommendationsList: Locator;
  readonly verifyPrescriptionButton: Locator;
  readonly verificationResult: Locator;

  constructor(page: Page) {
    this.page = page;
    this.chatButton = page.locator('[data-testid="ai-assistant-button"]');
    this.chatInput = page.locator('[data-testid="chat-input"]');
    this.sendMessageButton = page.locator('[data-testid="send-message-button"]');
    this.chatMessages = page.locator('[data-testid="chat-messages"]');
    this.medicationQueryInput = page.locator('[data-testid="medication-query-input"]');
    this.askMedicationButton = page.locator('[data-testid="ask-medication-button"]');
    this.medicationResult = page.locator('[data-testid="medication-result"]');
    this.recommendationInput = page.locator('[data-testid="recommendation-input"]');
    this.getRecommendationsButton = page.locator('[data-testid="get-recommendations-button"]');
    this.recommendationsList = page.locator('[data-testid="recommendations-list"]');
    this.verifyPrescriptionButton = page.locator('[data-testid="verify-prescription-button"]');
    this.verificationResult = page.locator('[data-testid="verification-result"]');
  }

  async open() {
    await this.chatButton.click();
    await this.page.waitForSelector('[data-testid="chat-input"]', { timeout: 10_000 });
  }

  async sendMessage(message: string) {
    await this.chatInput.fill(message);
    await this.sendMessageButton.click();
    await this.page.waitForTimeout(2000);
  }

  async getLastResponse(): Promise<string> {
    const messages = this.chatMessages.locator('[data-testid="message"]');
    const count = await messages.count();
    return (await messages.nth(count - 1).textContent()) || '';
  }

  async askAboutMedication(query: string) {
    await this.medicationQueryInput.fill(query);
    await this.askMedicationButton.click();
    await this.page.waitForSelector('[data-testid="medication-result"]', { timeout: 15_000 });
  }

  async getMedicationInfo(query: string) {
    await this.askAboutMedication(query);
    return (await this.medicationResult.textContent()) || '';
  }

  async getRecommendations(symptoms: string) {
    await this.recommendationInput.fill(symptoms);
    await this.getRecommendationsButton.click();
    await this.page.waitForSelector('[data-testid="recommendations-list"]', { timeout: 15_000 });
  }

  async verifyPrescription() {
    await this.verifyPrescriptionButton.click();
    await this.page.waitForSelector('[data-testid="verification-result"]', { timeout: 15_000 });
  }
}
