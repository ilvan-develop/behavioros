import { expect, test } from '../fixtures/e2e-test-context';

test.describe('BehaviorOS EAARG Pipeline', () => {
  let pipelineId: string;
  let dnaId: string;

  test.beforeAll(async () => {
    dnaId = `e2e-dna-${Date.now()}`;
  });

  test('should start the EAARG pipeline', async ({ ctx }) => {
    const response = await ctx.api.post('/api/v1/pipeline/start', {
      data: {
        dnaId,
        options: {
          startLayer: 1,
          endLayer: 9,
        },
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      dnaId,
      status: 'running',
      currentLayer: 1,
    });
    pipelineId = body.id;
  });

  test('should validate each EAARG layer', async ({ ctx }) => {
    const layers = [
      { layer: 1, name: 'Business', evidence: ['ev-bus-1', 'ev-bus-2', 'ev-bus-3'] },
      { layer: 2, name: 'Product', evidence: ['ev-prod-1', 'ev-prod-2'] },
      { layer: 3, name: 'Requirements', evidence: ['ev-req-1', 'ev-req-2', 'ev-req-3'] },
      { layer: 4, name: 'Architecture', evidence: ['ev-arch-1', 'ev-arch-2'] },
      { layer: 5, name: 'Technology', evidence: ['ev-tech-1', 'ev-tech-2', 'ev-tech-3'] },
      { layer: 6, name: 'Implementation', evidence: ['ev-impl-1', 'ev-impl-2'] },
      { layer: 7, name: 'Quality', evidence: ['ev-qa-1', 'ev-qa-2', 'ev-qa-3'] },
      { layer: 8, name: 'Governance', evidence: ['ev-gov-1', 'ev-gov-2'] },
      { layer: 9, name: 'Operations', evidence: ['ev-ops-1', 'ev-ops-2', 'ev-ops-3'] },
    ];

    for (const layer of layers) {
      const response = await ctx.api.post(`/api/v1/pipeline/${pipelineId}/validate`, {
        data: { layer: layer.layer, evidence: layer.evidence },
      });

      expect(response.status()).toBe(200);
      const result = await response.json();

      expect(result).toMatchObject({
        layer: layer.layer,
        layerName: layer.name,
        evidenceCollected: expect.any(Array),
        score: expect.any(Number),
      });
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.status).toBe('pass');
    }
  });

  test('should pause and resume the pipeline', async ({ ctx }) => {
    const pauseResponse = await ctx.api.post(`/api/v1/pipeline/${pipelineId}/pause`);
    expect(pauseResponse.status()).toBe(200);

    const paused = await pauseResponse.json();
    expect(paused.status).toBe('paused');

    const resumeResponse = await ctx.api.post(`/api/v1/pipeline/${pipelineId}/resume`);
    expect(resumeResponse.status()).toBe(200);

    const resumed = await resumeResponse.json();
    expect(resumed.status).toBe('running');
  });

  test('should generate a pipeline report', async ({ ctx }) => {
    const response = await ctx.api.get(`/api/v1/pipeline/${pipelineId}/report`);
    expect(response.status()).toBe(200);

    const report = await response.json();
    expect(report).toMatchObject({
      pipelineId,
      dnaId,
      totalLayers: 9,
      passedLayers: expect.any(Number),
      overallScore: expect.any(Number),
      overallStatus: expect.stringMatching(/^(pass|partial|fail)$/),
      layers: expect.any(Array),
    });
    expect(report.layers).toHaveLength(report.passedLayers);
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  test('should complete the pipeline with learning events', async ({ ctx }) => {
    const events = [
      {
        type: 'observation',
        source: 'pipeline',
        data: { pipelineId, layer: 1, finding: 'Business objectives clearly defined' },
        confidence: 0.9,
      },
      {
        type: 'pattern',
        source: 'pipeline',
        data: { pipelineId, layer: 3, pattern: 'Requirements traceability established' },
        confidence: 0.85,
      },
      {
        type: 'insight',
        source: 'pipeline',
        data: { pipelineId, layer: 5, insight: 'Cloud-native architecture recommended' },
        confidence: 0.75,
      },
      {
        type: 'feedback',
        source: 'pipeline',
        data: {
          pipelineId,
          layer: 7,
          feedback: 'Test coverage meets threshold but can be improved',
        },
        confidence: 0.8,
      },
    ];

    for (const event of events) {
      const response = await ctx.api.post('/api/v1/learning/events', {
        data: event,
      });

      expect(response.status()).toBe(201);
      const created = await response.json();
      expect(created).toMatchObject({
        id: expect.any(String),
        type: event.type,
        source: event.source,
      });
    }

    const reportResponse = await ctx.api.get('/api/v1/learning/report');
    expect(reportResponse.status()).toBe(200);
    const report = await reportResponse.json();
    expect(report).toMatchObject({
      totalEvents: expect.any(Number),
      patterns: expect.any(Array),
      recommendations: expect.any(Array),
    });
    expect(report.totalEvents).toBeGreaterThanOrEqual(events.length);
  });
});
