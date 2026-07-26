import { beforeEach, describe, expect, it } from 'vitest';
import { AutoDocumentationTrigger } from '../../engines/orchestrator/auto-documentation-trigger';

describe('AutoDocumentationTrigger', () => {
  let trigger: AutoDocumentationTrigger;

  beforeEach(() => {
    trigger = new AutoDocumentationTrigger({ writeFiles: false });
    trigger.clear();
  });

  // ─── onSubtaskComplete() ───────────────────────────────────

  describe('onSubtaskComplete()', () => {
    it('should generate design documentation', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-1',
          title: 'Design API Architecture',
          type: 'design',
          requiredSkill: 'architecture',
          status: 'completed',
        },
        { pattern: 'hexagonal' },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('docs');
    });

    it('should generate feature documentation for implementation', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-2',
          title: 'Implement Payment Gateway',
          type: 'implementation',
          requiredSkill: 'api-development',
          status: 'completed',
        },
        { code: 'payment.ts' },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('docs');
    });

    it('should generate testing documentation', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-3',
          title: 'Test Payment Flow',
          type: 'testing',
          requiredSkill: 'quality-assurance',
          status: 'completed',
        },
        { testsPassed: 20 },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('testing');
    });

    it('should generate review documentation', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-4',
          title: 'Review Payment Feature',
          type: 'review',
          requiredSkill: 'code-review',
          status: 'completed',
        },
        { findings: [] },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('reviews');
    });

    it('should generate security advisory', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-5',
          title: 'Security Scan Payment Module',
          type: 'security',
          requiredSkill: 'security-review',
          status: 'completed',
        },
        { vulnerabilities: [] },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('security');
    });

    it('should generate deployment documentation', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-6',
          title: 'Deploy to Production',
          type: 'deployment',
          requiredSkill: 'devops',
          status: 'completed',
        },
        { url: 'https://example.com' },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('deployments');
    });

    it('should track documentation type without generating files', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-7',
          title: 'Write User Guide',
          type: 'documentation',
          requiredSkill: 'technical-writing',
          status: 'completed',
        },
        { content: 'user guide' },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('tracked:documentation');
    });

    it('should generate compliance documentation', async () => {
      const result = await trigger.onSubtaskComplete(
        {
          id: 'sub-8',
          title: 'GDPR Compliance Check',
          type: 'compliance',
          requiredSkill: 'compliance',
          status: 'completed',
        },
        { compliant: true },
      );

      expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
      expect(result.docsGenerated[0]).toContain('compliance');
    });
  });

  // ─── getGeneratedDocs() ────────────────────────────────────

  describe('getGeneratedDocs()', () => {
    it('should return all generated docs', async () => {
      await trigger.onSubtaskComplete(
        {
          id: 'sub-1',
          title: 'Design API',
          type: 'design',
          requiredSkill: 'architecture',
          status: 'completed',
        },
        {},
      );

      await trigger.onSubtaskComplete(
        {
          id: 'sub-2',
          title: 'Implement API',
          type: 'implementation',
          requiredSkill: 'development',
          status: 'completed',
        },
        {},
      );

      const docs = trigger.getGeneratedDocs();
      expect(docs.length).toBeGreaterThanOrEqual(2);
    });

    it('should clear the list on clear()', async () => {
      await trigger.onSubtaskComplete(
        {
          id: 'sub-1',
          title: 'Design API',
          type: 'design',
          requiredSkill: 'architecture',
          status: 'completed',
        },
        {},
      );

      trigger.clear();
      expect(trigger.getGeneratedDocs()).toHaveLength(0);
    });
  });

  // ─── default options ───────────────────────────────────────

  it('should use project root from options', () => {
    const customTrigger = new AutoDocumentationTrigger({
      projectRoot: '/custom/project',
      writeFiles: false,
    });
    expect(customTrigger).toBeDefined();
  });

  it('should handle unknown subtask types with generic doc', async () => {
    const result = await trigger.onSubtaskComplete(
      {
        id: 'sub-x',
        title: 'Custom Task',
        type: 'unknown-type' as any,
        requiredSkill: 'custom',
        status: 'completed',
      },
      {},
    );

    expect(result.docsGenerated.length).toBeGreaterThanOrEqual(1);
  });
});
