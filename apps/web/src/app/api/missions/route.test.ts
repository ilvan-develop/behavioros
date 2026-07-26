import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getAllMissions: () => [],
    createMission: vi.fn(({ title, type }) =>
      Promise.resolve({ id: 'mock-id', title, type, status: 'draft' }),
    ),
  })),
  BehaviorOS: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      status: init?.status ?? 200,
      body,
      json: () => Promise.resolve(body),
    })),
  },
}));

describe('GET /api/missions', () => {
  it('returns missions with total count', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('missions');
    expect(response.body).toHaveProperty('total');
  });

  it('returns seed missions when SDK returns empty', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body.missions.length).toBeGreaterThanOrEqual(8);
  });
});

describe('POST /api/missions', () => {
  it('creates a mission with valid data', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/missions', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test mission', type: 'feature' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(response.body.mission.title).toBe('Test mission');
  });

  it('returns 400 for missing title', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/missions', {
      method: 'POST',
      body: JSON.stringify({ type: 'feature' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('title');
  });
});
