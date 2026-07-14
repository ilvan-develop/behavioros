import { expect, test } from '@playwright/test';

// ============================================================
// BehaviorOS E2E Tests — Real functionality testing
// ============================================================

const API_BASE = process.env.BEHAVIOROS_API_URL ?? 'http://localhost:3000';

test.describe('BehaviorOS API — Missions', () => {
  let missionId: string;

  test('GET /api/stats returns system status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/stats`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('stats');
    expect(body.status).toHaveProperty('engine');
    expect(body.status).toHaveProperty('dna');
  });

  test('POST /api/missions creates a mission', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/missions`, {
      data: {
        title: `E2E Test Mission ${Date.now()}`,
        description: 'Created by E2E test',
        type: 'feature',
        priority: 'high',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('mission');
    expect(body.mission).toHaveProperty('id');
    expect(body.mission.title).toContain('E2E Test Mission');
    expect(body.mission.status).toBe('draft');
    missionId = body.mission.id;
  });

  test('GET /api/missions returns mission list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/missions`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('missions');
    expect(Array.isArray(body.missions)).toBeTruthy();
  });

  test('POST /api/missions rejects invalid input', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/missions`, {
      data: { title: '' },
    });

    expect(response.status()).toBe(400);
  });
});

test.describe('BehaviorOS API — Governance', () => {
  test('GET /api/governance returns rules', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/governance`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('rules');
    expect(Array.isArray(body.rules)).toBeTruthy();
    expect(body.rules.length).toBeGreaterThan(0);
  });

  test('POST /api/governance evaluates an action', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/governance`, {
      data: {
        action: 'deploy-production',
        context: { type: 'deployment', agent: 'devops' },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('approved');
    expect(typeof body.approved).toBe('boolean');
  });
});

test.describe('BehaviorOS API — Quality', () => {
  test('GET /api/quality returns gates', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/quality`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('gates');
    expect(Array.isArray(body.gates)).toBeTruthy();
  });
});

test.describe('BehaviorOS API — Audit', () => {
  test('GET /api/audit returns audit log', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/audit`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('events');
    expect(Array.isArray(body.events)).toBeTruthy();
  });
});

test.describe('BehaviorOS API — Agents', () => {
  test('GET /api/agents returns agent list', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/agents`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('agents');
    expect(Array.isArray(body.agents)).toBeTruthy();
    expect(body.agents.length).toBeGreaterThan(0);
  });
});

test.describe('BehaviorOS API — Pipeline', () => {
  test('GET /api/pipeline returns pipeline status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/pipeline`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('state');
    expect(body).toHaveProperty('progress');
    expect(body).toHaveProperty('report');
  });

  test('POST /api/pipeline starts pipeline', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/pipeline`, {
      data: { action: 'start' },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty('state');
    expect(body.state).toHaveProperty('status');
    expect(['running', 'paused', 'created']).toContain(body.state.status);
  });
});

test.describe('BehaviorOS API — DNAs', () => {
  test('GET /api/dnas returns DNA patterns', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/dnas`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('dnas');
    expect(Array.isArray(body.dnas)).toBeTruthy();
    expect(body.dnas.length).toBeGreaterThan(0);
  });
});

test.describe('BehaviorOS Web Dashboard', () => {
  test('homepage loads and shows dashboard', async ({ page }) => {
    await page.goto(API_BASE);

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check that the page has a title or heading
    const heading = page.locator('h1, h2, [class*="heading"]').first();
    await expect(heading).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.goto(API_BASE);
    await page.waitForLoadState('networkidle');

    // Check for navigation links
    const nav = page.locator('nav, [class*="sidebar"], [class*="nav"]').first();
    if (await nav.isVisible()) {
      const links = nav.locator('a');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});
