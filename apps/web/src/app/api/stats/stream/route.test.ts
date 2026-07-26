import { beforeAll, describe, expect, it, vi } from 'vitest';

// Mock getBehaviorOS before any imports
const mockGetStatus = vi.fn();
const mockGetStats = vi.fn();
const mockGetPipelineState = vi.fn();

vi.mock('@/lib/bos', () => ({
  getBehaviorOS: () => ({
    getStatus: mockGetStatus,
    getStats: mockGetStats,
    getPipelineState: mockGetPipelineState,
  }),
}));

describe('GET /api/stats/stream', () => {
  beforeAll(() => {
    mockGetStatus.mockReturnValue({
      engine: true,
      dna: 'enterprise-governance',
      missions: 8,
      agents: 5,
      auditEvents: 15,
      qualityMetrics: 87,
    });
    mockGetStats.mockReturnValue({
      missions: { total: 8, completed: 3, failed: 1 },
      agents: { total: 5, active: 3 },
      auditEvents: 15,
      qualityMetrics: 87,
    });
    mockGetPipelineState.mockReturnValue({
      status: 'running',
      currentLayer: 4,
      totalLayers: 9,
    });
  });

  it('returns SSE response with correct headers', async () => {
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/api/stats/stream');
    const res = await GET(req);

    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('Connection')).toBe('keep-alive');
  });

  it('streams stats data in SSE format', async () => {
    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/api/stats/stream');
    const res = await GET(req);

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      const decoder = new TextDecoder();
      const { value, done } = await reader.read();
      expect(done).toBe(false);
      const text = decoder.decode(value);
      expect(text).toContain('data: ');
      expect(text).toContain('missions');
      expect(text).toContain('agents');
      expect(text).toContain('auditEvents');

      reader.cancel();
    }
  });

  it('handles errors gracefully', async () => {
    mockGetStatus.mockImplementationOnce(() => {
      throw new Error('SDK error');
    });

    const { GET } = await import('./route');
    const req = new Request('http://localhost:3000/api/stats/stream');
    const res = await GET(req);

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    if (reader) {
      const decoder = new TextDecoder();
      const { value } = await reader.read();
      const text = decoder.decode(value);
      expect(text).toContain('data: ');
      expect(text).toContain('error');
      reader.cancel();
    }
  });
});
