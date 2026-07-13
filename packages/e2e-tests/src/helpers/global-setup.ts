import type { FullConfig } from '@playwright/test';
import { disposeApiContext, getApiContext } from './api-client';

async function globalSetup(_config: FullConfig) {
  console.log('Running global setup...');

  const apiBaseURL = process.env.API_BASE_URL || 'http://localhost:4000';
  const healthCheckURL = `${apiBaseURL}/health`;

  try {
    const ctx = await getApiContext();
    const response = await ctx.get(healthCheckURL, { timeout: 10_000 });

    if (response.ok()) {
      console.log(`API health check passed: ${healthCheckURL}`);
    } else {
      console.warn(`API health check returned ${response.status()}. Some tests may fail.`);
    }
  } catch (error) {
    console.warn(`API health check failed: ${healthCheckURL}`);
    console.warn('Ensure the API server is running. Tests may fail with connection errors.');
    console.warn(`Error: ${error instanceof Error ? error.message : error}`);
  }

  try {
    await disposeApiContext();
  } catch {
    // ignore cleanup errors in setup
  }

  console.log('Global setup complete.');
}

export default globalSetup;
