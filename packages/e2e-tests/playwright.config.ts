import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

config({ path: resolve(__dirname, '../../.env') });

const baseURL = process.env.BASE_URL || 'http://localhost:3000';
const apiBaseURL = process.env.API_BASE_URL || 'http://localhost:4000';

export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  use: {
    baseURL,
    trace: process.env.CI ? 'on-first-retry' : 'on',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
    extraHTTPHeaders: {
      'X-Request-Id': '[requestId]',
    },
  },
  projects: [
    {
      name: 'api',
      testDir: './src/api',
      use: {
        baseURL: apiBaseURL,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    },
    {
      name: 'web',
      testDir: './src/web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL,
      },
    },
    {
      name: 'mobile-chrome',
      testDir: './src/mobile',
      use: {
        ...devices['Pixel 5'],
        baseURL,
      },
    },
    {
      name: 'mobile-safari',
      testDir: './src/mobile',
      use: {
        ...devices['iPhone 13'],
        baseURL,
      },
    },
    {
      name: 'behavioros',
      testDir: './src/behavioros',
      use: {
        baseURL: apiBaseURL,
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      },
    },
  ],
  webServer: process.env.CI
    ? []
    : [
        {
          command: 'pnpm --filter @behavioros/web dev',
          url: baseURL,
          reuseExistingServer: true,
          cwd: resolve(__dirname, '../..'),
          timeout: 120_000,
        },
      ],
  globalSetup: resolve(__dirname, 'src/helpers/global-setup.ts'),
  globalTeardown: resolve(__dirname, 'src/helpers/global-teardown.ts'),
});
