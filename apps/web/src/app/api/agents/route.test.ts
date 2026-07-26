import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getAllAgents: () => [],
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

describe('GET /api/agents', () => {
  it('returns agents with total count', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('agents');
    expect(response.body).toHaveProperty('total');
  });

  it('returns seed agents when SDK returns empty', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body.agents.length).toBe(5);
    expect(response.body.agents[0]).toHaveProperty('id');
    expect(response.body.agents[0]).toHaveProperty('name');
    expect(response.body.agents[0]).toHaveProperty('role');
    expect(response.body.agents[0]).toHaveProperty('status');
  });
});
