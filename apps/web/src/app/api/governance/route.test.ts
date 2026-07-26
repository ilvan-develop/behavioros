import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getStatus: () => ({ engine: true, dna: 'enterprise-governance' }),
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

describe('GET /api/governance', () => {
  it('returns governance rules', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('rules');
    expect(response.body).toHaveProperty('dnaLoaded');
  });
});
