import type { FullConfig } from '@playwright/test';
import { disposeApiContext } from './api-client';

async function globalTeardown(_config: FullConfig) {
  console.log('Running global teardown...');

  try {
    await disposeApiContext();
  } catch (error) {
    console.warn('Error during global teardown:', error instanceof Error ? error.message : error);
  }

  console.log('Global teardown complete.');
}

export default globalTeardown;
