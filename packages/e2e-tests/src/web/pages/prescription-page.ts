import type { Locator, Page } from '@playwright/test';

export class PrescriptionPage {
  readonly page: Page;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly uploadProgress: Locator;
  readonly uploadSuccessMessage: Locator;
  readonly ocrResultText: Locator;
  readonly verifyButton: Locator;
  readonly verificationStatus: Locator;
  readonly prescriptionList: Locator;
  readonly prescriptionDetail: Locator;
  readonly orderLinkButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.fileInput = page.locator('[data-testid="prescription-file-input"]');
    this.uploadButton = page.locator('[data-testid="upload-prescription-button"]');
    this.uploadProgress = page.locator('[data-testid="upload-progress"]');
    this.uploadSuccessMessage = page.locator('[data-testid="upload-success"]');
    this.ocrResultText = page.locator('[data-testid="ocr-result"]');
    this.verifyButton = page.locator('[data-testid="verify-prescription-button"]');
    this.verificationStatus = page.locator('[data-testid="verification-status"]');
    this.prescriptionList = page.locator('[data-testid="prescription-list"]');
    this.prescriptionDetail = page.locator('[data-testid="prescription-detail"]');
    this.orderLinkButton = page.locator('[data-testid="link-to-order-button"]');
  }

  async goto() {
    await this.page.goto('/prescriptions');
  }

  async uploadPrescription(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
    await this.page.waitForSelector('[data-testid="upload-success"]', { timeout: 30_000 });
  }

  async viewOcrResult(): Promise<string> {
    return (await this.ocrResultText.textContent()) || '';
  }

  async verifyPrescription() {
    await this.verifyButton.click();
    await this.page.waitForSelector('[data-testid="verification-status"]', { timeout: 15_000 });
  }

  async getVerificationStatus(): Promise<string> {
    return (await this.verificationStatus.textContent()) || '';
  }

  async linkToOrder() {
    await this.orderLinkButton.click();
  }
}
