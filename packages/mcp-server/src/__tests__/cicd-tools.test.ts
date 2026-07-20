import { BehaviorOSEngine } from '@behavioros/core';
import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  approveLayer,
  cicdRecordLearning,
  cicdRunAudit,
  getAuditHistory,
  getAuditHistoryStore,
  getGateResults,
  getLearningEventsStore,
  getLearningReport,
  getPipelineReport,
  getPipelineStatus,
  getPipelines,
  setEngine,
  startPipeline,
  validateLayer,
} from '../tools/cicd-tools.js';

const testDNA: DNAPackage = {
  id: 'test-dna',
  name: 'Test DNA',
  version: '1.0.0',
  personas: [{ role: 'engineer', authority: 'senior', name: 'Test Engineer' }],
  governance: [
    {
      id: 'test-rule',
      name: 'Test Rule',
      level: 'medium',
      action: 'warn',
      conditions: ['type:feature'],
    },
  ],
  quality: [{ id: 'test-coverage', name: 'Test Coverage', type: 'test_coverage', threshold: 80 }],
  patterns: [
    {
      id: 'test-pattern',
      name: 'Test Pattern',
      type: 'collaboration',
      triggers: ['agent:engineer'],
      actions: ['code-review'],
    },
  ],
};

function createTestEngine(): BehaviorOSEngine {
  return new BehaviorOSEngine({
    dna: testDNA,
    governance: { enabled: true, level: 'standard', requireApproval: true, maxAgents: 10 },
    quality: { enabled: true, minCoverage: 80, enforceTypecheck: true, enforceLint: true },
    learning: { enabled: true, autoApply: false },
    audit: { enabled: true },
  });
}

describe('CI/CD Tools', () => {
  let engine: BehaviorOSEngine;

  beforeEach(() => {
    engine = createTestEngine();
    setEngine(engine);
    getPipelines().clear();
    getAuditHistoryStore().length = 0;
    getLearningEventsStore().length = 0;
  });

  describe('start_pipeline', () => {
    it('should create a pipeline with all default layers', async () => {
      const result = await startPipeline({ project: 'my-project' });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBeDefined();
      expect(parsed.project).toBe('my-project');
      expect(parsed.status).toBe('created');
      expect(parsed.layerCount).toBe(9);
      expect(parsed.createdAt).toBeDefined();
    });

    it('should create a pipeline with custom layers', async () => {
      const result = await startPipeline({
        project: 'my-project',
        layers: ['dna', 'governance', 'quality'],
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.project).toBe('my-project');
      expect(parsed.layerCount).toBe(3);
      expect(parsed.layers.map((l: { id: string }) => l.id)).toEqual([
        'dna',
        'governance',
        'quality',
      ]);
    });
  });

  describe('get_pipeline_status', () => {
    it('should return pipeline status', async () => {
      const createResult = await startPipeline({ project: 'my-project' });
      const created = JSON.parse(createResult.content[0].text);

      const result = await getPipelineStatus({ pipelineId: created.id });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(created.id);
      expect(parsed.project).toBe('my-project');
      expect(parsed.status).toBe('created');
      expect(parsed.progress).toEqual({
        passed: 0,
        failed: 0,
        total: 9,
        percentage: 0,
      });
    });

    it('should throw for non-existent pipeline', async () => {
      await expect(getPipelineStatus({ pipelineId: 'non-existent' })).rejects.toThrow(
        'Pipeline not found',
      );
    });
  });

  describe('validate_layer', () => {
    it('should validate a layer and set it to passed', async () => {
      const createResult = await startPipeline({
        project: 'my-project',
        layers: ['dna'],
      });
      const created = JSON.parse(createResult.content[0].text);

      const result = await validateLayer({
        pipelineId: created.id,
        layerId: 'dna',
        evidence: { type: 'yaml_validation', passed: true },
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.layer.id).toBe('dna');
      expect(parsed.layer.status).toBe('passed');
      expect(parsed.gates.length).toBeGreaterThan(0);
      expect(parsed.pipelineStatus).toBe('completed');
    });

    it('should mark layer as failed when evidence is missing', async () => {
      const createResult = await startPipeline({
        project: 'my-project',
        layers: ['schema'],
      });
      const created = JSON.parse(createResult.content[0].text);

      const result = await validateLayer({
        pipelineId: created.id,
        layerId: 'schema',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.layer.id).toBe('schema');
      expect(parsed.layer.status).toBe('failed');
      const evidenceGate = parsed.gates.find(
        (g: { gateId: string }) => g.gateId === 'schema-evidence',
      );
      expect(evidenceGate.passed).toBe(false);
    });

    it('should throw for non-existent pipeline', async () => {
      await expect(validateLayer({ pipelineId: 'bad-id', layerId: 'dna' })).rejects.toThrow(
        'Pipeline not found',
      );
    });
  });

  describe('approve_layer', () => {
    it('should approve a validated layer', async () => {
      const createResult = await startPipeline({
        project: 'my-project',
        layers: ['governance'],
      });
      const created = JSON.parse(createResult.content[0].text);

      await validateLayer({
        pipelineId: created.id,
        layerId: 'governance',
        evidence: { check: 'passed' },
      });

      const result = await approveLayer({
        pipelineId: created.id,
        layerId: 'governance',
        approvedBy: 'qa-lead',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.layer.status).toBe('approved');
      expect(parsed.approvedBy).toBe('qa-lead');
      expect(parsed.approvedAt).toBeDefined();
    });

    it('should throw when approving unvalidated layer', async () => {
      const createResult = await startPipeline({
        project: 'my-project',
        layers: ['quality'],
      });
      const created = JSON.parse(createResult.content[0].text);

      await expect(
        approveLayer({
          pipelineId: created.id,
          layerId: 'quality',
          approvedBy: 'reviewer',
        }),
      ).rejects.toThrow('must be validated before approval');
    });
  });

  describe('get_pipeline_report', () => {
    it('should return full pipeline report', async () => {
      const createResult = await startPipeline({
        project: 'my-project',
        layers: ['dna', 'schema'],
      });
      const created = JSON.parse(createResult.content[0].text);

      await validateLayer({
        pipelineId: created.id,
        layerId: 'dna',
        evidence: { valid: true },
      });

      const result = await getPipelineReport({ pipelineId: created.id });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBe(created.id);
      expect(parsed.summary.totalLayers).toBe(2);
      expect(parsed.summary.evidenceCount).toBeGreaterThanOrEqual(1);
      expect(parsed.layers).toHaveLength(2);
      expect(parsed.timeline.createdAt).toBeDefined();
    });
  });

  describe('get_gate_results', () => {
    it('should return gate results for a layer', async () => {
      const createResult = await startPipeline({
        project: 'my-project',
        layers: ['audit'],
      });
      const created = JSON.parse(createResult.content[0].text);

      await validateLayer({
        pipelineId: created.id,
        layerId: 'audit',
        evidence: { audit: 'complete' },
      });

      const result = await getGateResults({
        pipelineId: created.id,
        layerId: 'audit',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.layer.id).toBe('audit');
      expect(parsed.gates).toBeDefined();
      expect(parsed.summary.total).toBeGreaterThan(0);
    });
  });

  describe('cicd_run_audit', () => {
    it('should run audit and store result', async () => {
      const result = await cicdRunAudit({
        projectPath: '/tmp/test',
        stages: ['static'],
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBeDefined();
      expect(parsed.overall).toBeDefined();
      expect(parsed.score).toBeDefined();
      expect(parsed.stages).toBeDefined();
    });

    it('should associate audit with pipeline', async () => {
      const createResult = await startPipeline({ project: 'my-project' });
      const created = JSON.parse(createResult.content[0].text);

      const result = await cicdRunAudit({
        pipelineId: created.id,
        projectPath: '/tmp/test',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.pipelineId).toBe(created.id);
    });
  });

  describe('get_audit_history', () => {
    it('should return audit history', async () => {
      await cicdRunAudit({ projectPath: '/tmp/test1' });
      await cicdRunAudit({ projectPath: '/tmp/test2' });

      const result = await getAuditHistory();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.total).toBe(2);
      expect(parsed.records).toHaveLength(2);
    });

    it('should filter by pipeline ID', async () => {
      const createResult = await startPipeline({ project: 'my-project' });
      const created = JSON.parse(createResult.content[0].text);

      await cicdRunAudit({ pipelineId: created.id, projectPath: '/tmp/test' });
      await cicdRunAudit({ projectPath: '/tmp/test2' });

      const result = await getAuditHistory({ pipelineId: created.id, limit: 10 });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.total).toBe(2);
      expect(parsed.returned).toBe(1);
    });
  });

  describe('cicd_record_learning', () => {
    it('should record a learning event', async () => {
      const result = await cicdRecordLearning({
        type: 'insight',
        source: 'cicd-pipeline',
        content: 'Reduced build time by 40% with caching',
        impact: 'high',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBeDefined();
      expect(parsed.type).toBe('insight');
      expect(parsed.impact).toBe('high');
    });

    it('should record with pipeline association', async () => {
      const createResult = await startPipeline({ project: 'my-project' });
      const created = JSON.parse(createResult.content[0].text);

      const result = await cicdRecordLearning({
        pipelineId: created.id,
        type: 'pattern',
        source: 'gate-analysis',
        content: 'Governance checks consistently pass on small PRs',
        impact: 'medium',
      });
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.id).toBeDefined();
    });
  });

  describe('get_learning_report', () => {
    it('should return learning report with recommendations', async () => {
      await cicdRecordLearning({
        type: 'insight',
        source: 'test',
        content: 'Test insight 1',
        impact: 'high',
      });
      await cicdRecordLearning({
        type: 'correction',
        source: 'test',
        content: 'Test correction 1',
        impact: 'low',
      });

      const result = await getLearningReport();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.total).toBe(2);
      expect(parsed.breakdown.byType.insight).toBe(1);
      expect(parsed.breakdown.byType.correction).toBe(1);
      expect(parsed.recommendations).toBeDefined();
      expect(parsed.recommendations.length).toBeGreaterThan(0);
    });

    it('should return default recommendation for minimal data', async () => {
      const result = await getLearningReport();
      const parsed = JSON.parse(result.content[0].text);

      expect(parsed.total).toBe(0);
      expect(parsed.recommendations).toContain(
        'Continue collecting learning events for pattern detection',
      );
    });
  });
});
