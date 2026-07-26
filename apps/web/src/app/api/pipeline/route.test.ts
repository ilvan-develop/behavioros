import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: vi.fn(() => ({
    getPipelineState: () => ({ status: 'idle', currentLayer: null }),
    getPipelineProgress: () => ({ completed: 0, total: 9, percentage: 0 }),
    getPipelineReport: () => ({ score: 0, layers: [] }),
    runPipeline: vi.fn(() => Promise.resolve({ status: 'running', pipelineId: 'p-001' })),
    advancePipeline: vi.fn(() => Promise.resolve({ advanced: true, layer: 'dna' })),
    pausePipeline: vi.fn(() => ({ status: 'paused' })),
    resumePipeline: vi.fn(() => ({ status: 'running' })),
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

describe('GET /api/pipeline', () => {
  it('returns pipeline state, progress, and report', async () => {
    const { GET } = await import('./route');
    const response = await GET();
    expect(response.body).toHaveProperty('state');
    expect(response.body).toHaveProperty('progress');
    expect(response.body).toHaveProperty('report');
  });
});

describe('POST /api/pipeline', () => {
  it('starts pipeline', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pipeline', {
      method: 'POST',
      body: JSON.stringify({ action: 'start' }),
    });
    const response = await POST(request);
    expect(response.body.state.status).toBe('running');
  });

  it('advances pipeline', async () => {
    const { POST } = await import('./route');
    const request = new Request('http://localhost/api/pipeline', {
      method: 'POST',
      body: JSON.stringify({ action: 'advance' }),
    });
    const response = await POST(request);
    expect(response.body.result.advanced).toBe(true);
  });
});
