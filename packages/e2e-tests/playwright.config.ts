import { defineConfig } from '@playwright/test';

const PORT = 3001;

export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    trace: 'on-first-retry',
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `pnpm --filter @behavioros/web dev`,
    url: `http://localhost:${PORT}`,
    env: {
      PORT: String(PORT),
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
