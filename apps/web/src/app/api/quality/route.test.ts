import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getStats: () => ({
      qualityMetrics: 0,
      missions: { total: 0, completed: 0, failed: 0 },
      agents: { total: 0, active: 0 },
    }),
  })),
  BehaviorOS: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body) => ({
      status: 200,
      body,
      json: () => Promise.resolve(body),
    })),
  },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body) => ({
      status: 200,
      body,
      json: () => Promise.resolve(body),
    })),
  },
}));

describe('GET /api/quality', () => {
  it('returns quality metrics and gates', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('qualityMetrics');
    expect(response.body).toHaveProperty('qualityGates');
  });
});
