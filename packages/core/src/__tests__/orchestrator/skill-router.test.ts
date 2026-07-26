import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { SkillRouter } from '../../engines/orchestrator/skill-router';
import { SkillEngine } from '../../engines/skill-engine';

function makeSampleDNA(): DNAPackage {
  return {
    id: 'test-dna',
    name: 'Test DNA',
    version: '1.0.0',
    description: 'Test DNA for skill router',
    personas: [
      {
        role: 'engineer',
        authority: 'senior',
        name: 'Frontend Engineer',
        skills: [
          { id: 'react', proficiency: 5 },
          { id: 'typescript', proficiency: 4 },
          { id: 'development', proficiency: 4 },
        ],
      },
      {
        role: 'architect',
        authority: 'senior',
        name: 'Backend Architect',
        skills: [
          { id: 'api-development', proficiency: 5 },
          { id: 'typescript', proficiency: 4 },
          { id: 'database', proficiency: 3 },
        ],
      },
      {
        role: 'qa',
        authority: 'senior',
        name: 'QA Specialist',
        skills: [
          { id: 'quality-assurance', proficiency: 5 },
          { id: 'testing', proficiency: 5 },
        ],
      },
    ],
  };
}

describe('SkillRouter', () => {
  let engine: SkillEngine;
  let router: SkillRouter;

  beforeEach(async () => {
    engine = new SkillEngine();
    router = new SkillRouter(engine);
    await engine.syncFromDNA(makeSampleDNA());
  });

  // ─── route() ───────────────────────────────────────────────

  describe('route()', () => {
    it('should route subtask via DNA match to best agent', async () => {
      const result = await router.route(
        {
          id: 'test-1',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'api-development',
          status: 'pending',
        },
        [
          { id: 'architect', skills: ['api-development', 'typescript'], proficiency: 5 },
          { id: 'engineer', skills: ['react', 'typescript'], proficiency: 4 },
        ],
      );

      expect(result.status).toBe('routed');
      expect(result.route!.agentId).toBe('architect');
      expect(result.route!.strategy).toBe('dna-match');
      expect(result.route!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('should route via capability match when no DNA match found', async () => {
      const result = await router.route(
        {
          id: 'test-2',
          title: 'Test',
          type: 'testing',
          requiredSkill: 'quality-assurance',
          status: 'pending',
        },
        [{ id: 'qa', skills: ['quality-assurance', 'testing'], proficiency: 5 }],
      );

      expect(result.status).toBe('routed');
      expect(result.route!.agentId).toBe('qa');
    });

    it('should escalate when no agents available', async () => {
      const result = await router.route(
        {
          id: 'test-3',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'anything',
          status: 'pending',
        },
        [],
      );

      expect(result.status).toBe('escalation');
      expect(result.reason!.code).toBe('out-of-scope');
    });

    it('should escalate when no agent has the required skill', async () => {
      const result = await router.route(
        {
          id: 'test-4',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'quantum-computing',
          status: 'pending',
        },
        [{ id: 'backend-agent', skills: ['api-development', 'typescript'], proficiency: 5 }],
      );

      expect(result.status).toBe('escalation');
      expect(result.reason!.code).toBe('missing-skill');
    });

    it('should return reason with suggestion on escalation', async () => {
      const result = await router.route(
        {
          id: 'test-5',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'quantum-computing',
          status: 'pending',
        },
        [{ id: 'backend-agent', skills: ['api-development'], proficiency: 5 }],
      );

      expect(result.status).toBe('escalation');
      expect(result.reason!.suggestion).toBeTruthy();
      expect(result.reason!.requiredSkill).toBe('quantum-computing');
    });

    it('should handle agents with no skills gracefully', async () => {
      const result = await router.route(
        {
          id: 'test-6',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'development',
          status: 'pending',
        },
        [{ id: 'empty-agent', skills: [], proficiency: 1 }],
      );

      expect(result.status).toBe('escalation');
    });

    it('should routeSubtask method work as alias', async () => {
      const result = await router.routeSubtask(
        {
          id: 'test-7',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'api-development',
          status: 'pending',
        },
        [{ id: 'backend-agent', skills: ['api-development'], proficiency: 5 }],
      );

      expect(result.status).toBe('routed');
    });

    it('should match agents with similar skills via semantic fallback', async () => {
      // Register a skill in the engine
      await engine.install({ type: 'skill', id: 'database-admin', source: 'local' });

      const result = await router.route(
        {
          id: 'test-8',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'database',
          status: 'pending',
        },
        [{ id: 'backend-agent', skills: ['database-admin'], proficiency: 3 }],
      );

      expect(result.status).toBe('routed');
    });

    it('should return the best confidence match among multiple agents', async () => {
      const result = await router.route(
        {
          id: 'test-9',
          title: 'Test',
          type: 'implementation',
          requiredSkill: 'typescript',
          status: 'pending',
        },
        [
          { id: 'frontend-agent', skills: ['typescript'], proficiency: 4 },
          { id: 'backend-agent', skills: ['typescript'], proficiency: 2 },
        ],
      );

      expect(result.status).toBe('routed');
      expect(result.route!.agentId).toBe('frontend-agent');
    });
  });
});
