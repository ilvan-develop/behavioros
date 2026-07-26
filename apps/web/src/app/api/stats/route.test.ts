import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getStatus: () => ({ engine: true, missions: 5, agents: 3 }),
    getStats: () => ({
      missions: { total: 8, completed: 3, failed: 1 },
      agents: { total: 5, active: 3 },
    }),
    getPipelineState: () => ({ status: 'idle', layers: [] }),
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

describe('GET /api/stats', () => {
  it('returns status, stats, and pipeline data', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('stats');
    expect(response.body).toHaveProperty('pipeline');
  });

  it('returns engine status', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body.status.engine).toBe(true);
    expect(response.body.status.missions).toBe(5);
  });

  it('returns mission statistics', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body.stats.missions.total).toBe(8);
    expect(response.body.stats.missions.completed).toBe(3);
  });

  it('returns pipeline state', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body.pipeline.status).toBe('idle');
  });
});
