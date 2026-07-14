import { expect, test } from '@playwright/test';

const API_BASE = process.env.BEHAVIOROS_API_URL ?? 'http://localhost:4000';

test.describe('BehaviorOS Smoke Tests', () => {
  test('GET /api/stats returns system status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/stats`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('stats');
  });

  test('GET /api/missions returns an array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/missions`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('missions');
    expect(Array.isArray(body.missions)).toBeTruthy();
  });

  test('POST /api/missions creates a mission', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/missions`, {
      data: {
        title: `Smoke Test ${Date.now()}`,
        type: 'feature',
        priority: 'low',
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('mission');
    expect(body.mission).toHaveProperty('id');
    expect(body.mission.title).toContain('Smoke Test');
  });

  test('GET /api/agents returns an array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/agents`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('agents');
    expect(Array.isArray(body.agents)).toBeTruthy();
  });

  test('GET /api/dnas returns an array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/dnas`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('dnas');
    expect(Array.isArray(body.dnas)).toBeTruthy();
  });
});
