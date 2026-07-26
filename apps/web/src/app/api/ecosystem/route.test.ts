import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getStatus: () => ({ engine: true, agents: 3 }),
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

describe('GET /api/ecosystem', () => {
  it('returns ecosystem summary', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body).toHaveProperty('totalSkills');
    expect(response.body).toHaveProperty('totalMCPs');
    expect(response.body).toHaveProperty('activeAgents');
    expect(response.body).toHaveProperty('skills');
    expect(response.body).toHaveProperty('mcps');
  });
});
