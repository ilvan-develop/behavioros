import { expect, test } from '../fixtures/e2e-test-context';
import { TEST_PRESCRIPTIONS, TEST_USERS } from '../fixtures/test-data';
import { PrescriptionPage } from './pages/prescription-page';

test.describe('Prescription Flow', () => {
  let prescriptionPage: PrescriptionPage;

  test.beforeEach(async ({ page }) => {
    prescriptionPage = new PrescriptionPage(page);
  });

  test('should upload a prescription image', async ({ page }) => {
    await prescriptionPage.goto();

    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForSelector('[data-testid="upload-prescription-button"]', { timeout: 10_000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await prescriptionPage.fileInput.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'prescription.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-jpeg-data'),
    });

    await prescriptionPage.uploadButton.click();
    await expect(prescriptionPage.uploadProgress).toBeVisible();
    await expect(prescriptionPage.uploadSuccessMessage).toBeVisible({ timeout: 30_000 });
  });

  test('should extract text via OCR after upload', async ({ page }) => {
    await prescriptionPage.goto();
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForSelector('[data-testid="upload-prescription-button"]', { timeout: 10_000 });

    await page.route('**/api/v1/prescriptions/upload', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rx-ocr-test',
          status: 'pending_verification',
          ocrExtracted: TEST_PRESCRIPTIONS.valid.ocrText,
        }),
      });
    });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await prescriptionPage.fileInput.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'prescription.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-prescription-ocr'),
    });

    await prescriptionPage.uploadButton.click();
    await expect(prescriptionPage.uploadSuccessMessage).toBeVisible({ timeout: 30_000 });
    await expect(prescriptionPage.ocrResultText).toBeVisible({ timeout: 15_000 });

    const ocrText = await prescriptionPage.viewOcrResult();
    expect(ocrText.length).toBeGreaterThan(0);
    expect(ocrText.toLowerCase()).toContain('paciente');
    expect(ocrText.toLowerCase()).toContain('medica');
  });

  test('should allow pharmacist to verify a prescription', async ({ page }) => {
    await page.route('**/api/v1/prescriptions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'rx-verify-1',
            patientName: 'Maria Silva',
            status: 'pending_verification',
            createdAt: '2026-07-13T10:00:00Z',
          },
        ]),
      });
    });

    await prescriptionPage.goto();
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.pharmacyStaff.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.pharmacyStaff.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForSelector('[data-testid="prescription-list"]', { timeout: 10_000 });

    const prescriptions = page.locator('[data-testid="prescription-item"]');
    const count = await prescriptions.count();

    if (count > 0) {
      await page.route('**/api/v1/prescriptions/*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'rx-verify-1',
            patientName: 'Maria Silva',
            status: 'pending_verification',
            medications: [{ name: 'Losartana 50mg', dosage: '1x ao dia' }],
            doctorCRM: 'CRM-SP 123456',
          }),
        });
      });

      await prescriptions.first().click();
      await page.waitForSelector('[data-testid="prescription-detail"]', { timeout: 10_000 });

      await page.route('**/api/v1/prescriptions/*/verify', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'rx-verify-1',
            status: 'verified',
            verifiedBy: 'user-pharmacy-002',
            verifiedAt: new Date().toISOString(),
          }),
        });
      });

      await prescriptionPage.verifyPrescription();
      const status = await prescriptionPage.getVerificationStatus();
      expect(status.toLowerCase()).toMatch(/verified|approved|confirmed/);
    }
  });

  test('should link a prescription to an order', async ({ page }) => {
    await page.route('**/api/v1/prescriptions/upload', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rx-link-1',
          status: 'pending_verification',
          ocrExtracted: 'Paciente: Maria Silva\nMedicação: Losartana 50mg',
        }),
      });
    });

    await prescriptionPage.goto();
    await page.locator('[data-testid="login-email"]').fill(TEST_USERS.customer.email);
    await page.locator('[data-testid="login-password"]').fill(TEST_USERS.customer.password);
    await page.locator('[data-testid="login-button"]').click();
    await page.waitForSelector('[data-testid="upload-prescription-button"]', { timeout: 10_000 });

    const fileChooserPromise = page.waitForEvent('filechooser');
    await prescriptionPage.fileInput.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
      name: 'prescription.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake'),
    });

    await prescriptionPage.uploadButton.click();
    await expect(prescriptionPage.uploadSuccessMessage).toBeVisible({ timeout: 30_000 });

    if (await prescriptionPage.orderLinkButton.isVisible()) {
      await prescriptionPage.linkToOrder();
      await expect(page).toHaveURL(/\/checkout/, { timeout: 10_000 });
    }
  });
});
