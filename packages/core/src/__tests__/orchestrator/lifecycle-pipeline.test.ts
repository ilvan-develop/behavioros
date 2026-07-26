import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { AutoDocumentationTrigger } from '../../engines/orchestrator/auto-documentation-trigger';
import { AutonomousDecomposer } from '../../engines/orchestrator/autonomous-decomposer';
import { HandoffProtocol } from '../../engines/orchestrator/handoff-protocol';
import { LifecyclePipeline } from '../../engines/orchestrator/lifecycle-pipeline';
import { SkillRouter } from '../../engines/orchestrator/skill-router';
import { SkillEngine } from '../../engines/skill-engine';

function makeSampleDNA(): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    description: 'Test DNA',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Engineer',
        skills: ['development', 'api-development', 'bug-fixing', 'refactoring', 'diagnosis'],
      },
      {
        role: 'qa',
        authority: 'senior',
        name: 'QA',
        skills: ['quality-assurance', 'testing', 'security-verification', 'staging-test'],
      },
      {
        role: 'architect',
        authority: 'architect',
        name: 'Architect',
        skills: ['task-decomposition', 'code-analysis', 'research'],
      },
    ],
  };
}

describe('LifecyclePipeline', () => {
  let pipeline: LifecyclePipeline;

  beforeEach(async () => {
    const engine = new SkillEngine();
    await engine.syncFromDNA(makeSampleDNA());

    const decomposer = new AutonomousDecomposer();
    const router = new SkillRouter(engine);
    const handoffProtocol = new HandoffProtocol();
    const autoDocs = new AutoDocumentationTrigger({ writeFiles: false });

    pipeline = new LifecyclePipeline(decomposer, router, handoffProtocol, autoDocs, engine);
  });

  // ─── execute() ─────────────────────────────────────────────

  describe('execute()', () => {
    it('should complete a feature mission successfully', async () => {
      const result = await pipeline.execute({
        title: 'Implement payment module',
        type: 'feature',
        priority: 'high',
        description: 'Create payment processing',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.status).toBe('completed');
      expect(result.mission.subtasks.length).toBeGreaterThan(0);
      expect(result.mission.lifecycle.auditPassed).toBe(true);
    });

    it('should return mission with all required fields', async () => {
      const result = await pipeline.execute({
        title: 'Test mission',
        type: 'bugfix',
        priority: 'medium',
        description: 'Fix a bug',
      });

      expect(result.mission.id).toBeTruthy();
      expect(result.mission.title).toBe('Test mission');
      expect(result.mission.type).toBe('bugfix');
      expect(result.mission.priority).toBe('medium');
      expect(result.mission.createdAt).toBeTruthy();
    });

    it('should decompose subtasks based on mission type', async () => {
      const result = await pipeline.execute({
        title: 'Security audit',
        type: 'security',
        priority: 'critical',
      });

      expect(result.mission.subtasks.length).toBe(6);
      expect(result.mission.subtasks[0]!.type).toBe('security');
    });

    it('should include duration in the result', async () => {
      const result = await pipeline.execute({
        title: 'Performance test',
        type: 'feature',
        priority: 'low',
      });

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should generate ecosystem report', async () => {
      const result = await pipeline.execute({
        title: 'Report test',
        type: 'feature',
        priority: 'medium',
      });

      expect(result.report.project).toBeTruthy();
      expect(result.report.timestamp).toBeTruthy();
      expect(result.report.audit).toBeDefined();
    });

    it('should handle research missions', async () => {
      const result = await pipeline.execute({
        title: 'Research AI frameworks',
        type: 'research',
        priority: 'medium',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.subtasks.length).toBe(4);
    });

    it('should have correct lifecycle flags on completion', async () => {
      const result = await pipeline.execute({
        title: 'Lifecycle test',
        type: 'feature',
        priority: 'high',
      });

      expect(result.mission.lifecycle.auditPassed).toBe(true);
      expect(result.mission.lifecycle.docsGenerated).toBe(true);
    });

    it('should route subtasks even with empty agents available', async () => {
      const result = await pipeline.execute({
        title: 'Empty agents test',
        type: 'feature',
        priority: 'low',
      });

      // Without agents, subtasks should still be created
      expect(result.mission.subtasks.length).toBeGreaterThan(0);
    });
  });
});
