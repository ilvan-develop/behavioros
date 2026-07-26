import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getLearningReport: () => undefined,
    recordLearning: vi.fn(({ type, source, data }) =>
      Promise.resolve({ id: 'mock-learn', type, source, data }),
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

describe('GET /api/learning', () => {
  it('returns learning report', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('totalEvents');
    expect(response.body).toHaveProperty('patterns');
    expect(response.body).toHaveProperty('trends');
  });
});

describe('POST /api/learning', () => {
  it('records a learning event', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/learning', {
      method: 'POST',
      body: JSON.stringify({ type: 'insight', source: 'test', content: 'Test insight' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(response.body.event.type).toBe('insight');
  });
});
