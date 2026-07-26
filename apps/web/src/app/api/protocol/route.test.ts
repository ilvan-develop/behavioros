import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getStatus: () => ({ engine: true }),
    getPipelineState: () => ({ status: 'idle' }),
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

describe('GET /api/protocol', () => {
  it('returns protocol status', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('enforcementLevel');
    expect(response.body).toHaveProperty('dnaLoaded');
    expect(response.body).toHaveProperty('steps');
    expect(response.body).toHaveProperty('violations');
  });
});
