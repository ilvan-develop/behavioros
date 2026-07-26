import type { DNAPackage } from '@behavioros/schemas';
import { beforeEach, describe, expect, it } from 'vitest';
import { EcosystemRegistry } from '../../engines/ecosystem-registry';
import { AutoDocumentationTrigger } from '../../engines/orchestrator/auto-documentation-trigger';
import { AutonomousDecomposer } from '../../engines/orchestrator/autonomous-decomposer';
import { AutonomousOrchestrator } from '../../engines/orchestrator/autonomous-orchestrator';
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
        skills: ['development', 'api-development', 'bug-fixing', 'task-decomposition'],
      },
      {
        role: 'qa',
        authority: 'senior',
        name: 'QA',
        skills: ['quality-assurance', 'testing'],
      },
    ],
  };
}

function createOrchestrator(): AutonomousOrchestrator {
  const engine = new SkillEngine();
  const registry = new EcosystemRegistry({ skillEngine: engine });
  const decomposer = new AutonomousDecomposer();
  const router = new SkillRouter(engine);
  const handoffProtocol = new HandoffProtocol();
  const autoDocs = new AutoDocumentationTrigger({ writeFiles: false });
  const pipeline = new LifecyclePipeline(decomposer, router, handoffProtocol, autoDocs, engine);

  return new AutonomousOrchestrator({
    skillEngine: engine,
    ecosystemRegistry: registry,
    lifecyclePipeline: pipeline,
  });
}

describe('AutonomousOrchestrator', () => {
  let orchestrator: AutonomousOrchestrator;

  beforeEach(async () => {
    orchestrator = createOrchestrator();
    const dna = makeSampleDNA();
    await (orchestrator as any).skillEngine.syncFromDNA(dna);
  });

  // ─── processTask() ─────────────────────────────────────────

  describe('processTask()', () => {
    it('should complete a feature task successfully', async () => {
      const result = await orchestrator.processTask({
        title: 'Implement payment module',
        type: 'feature',
        priority: 'high',
        description: 'Create payment processing module',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.title).toBe('Implement payment module');
      expect(result.mission.subtasks.length).toBeGreaterThan(0);
    });

    it('should complete a bugfix task', async () => {
      const result = await orchestrator.processTask({
        title: 'Fix login timeout',
        type: 'bugfix',
        priority: 'high',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.type).toBe('bugfix');
    });

    it('should generate an ecosystem report', async () => {
      const result = await orchestrator.processTask({
        title: 'Test report generation',
        type: 'feature',
        priority: 'low',
      });

      expect(result.report).toBeDefined();
      expect(result.report.project).toBeTruthy();
      expect(result.report.timestamp).toBeTruthy();
    });

    it('should handle security tasks', async () => {
      const result = await orchestrator.processTask({
        title: 'Security audit',
        type: 'security',
        priority: 'critical',
        description: 'Run security scan on auth module',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.subtasks.length).toBe(6);
    });

    it('should handle deploy tasks', async () => {
      const result = await orchestrator.processTask({
        title: 'Deploy to production',
        type: 'deploy',
        priority: 'critical',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.subtasks.length).toBe(5);
    });

    it('should handle research tasks', async () => {
      const result = await orchestrator.processTask({
        title: 'Research vector databases',
        type: 'research',
        priority: 'medium',
      });

      expect(result.status).toBe('completed');
      expect(result.mission.subtasks.length).toBe(4);
    });
  });

  // ─── handleRejection() ─────────────────────────────────────

  describe('handleRejection()', () => {
    it('should escalate when no remaining agents available', async () => {
      const result = await orchestrator.handleRejection({
        handoffId: 'handoff-1',
        reason: {
          code: 'missing-skill',
          details: 'Agent does not have required skill',
          suggestion: 'Try another agent',
          requiredSkill: 'quantum-computing',
        },
        subtask: {
          id: 'subtask-1',
          title: 'Quantum task',
          type: 'implementation',
          requiredSkill: 'quantum-computing',
          status: 'rejected',
        },
      });

      expect(result.status).toBe('escalated');
    });

    it('should return rerouted status when alternative agent found', async () => {
      // First sync a DNA with agents
      const dna = makeSampleDNA();
      await (orchestrator as any).skillEngine.syncFromDNA(dna);

      const result = await orchestrator.handleRejection({
        handoffId: 'handoff-1',
        reason: {
          code: 'overloaded',
          details: 'Agent is at capacity',
          requiredSkill: 'development',
        },
        subtask: {
          id: 'subtask-1',
          title: 'Development task',
          type: 'implementation',
          requiredSkill: 'development',
          status: 'rejected',
        },
      });

      // Since we synced DNA with agents that have 'development' skill, it should reroute
      expect(result.status).toBe('rerouted');
      expect(result.newRoute).toBeDefined();
      expect(result.newRoute!.agentId).toBe('engineer');
    });
  });

  // ─── escalate() ────────────────────────────────────────────

  describe('escalate()', () => {
    it('should return escalation result with critical severity', async () => {
      const result = await orchestrator.escalate({
        reason: 'Security vulnerability detected in payment module',
        context: { module: 'payment', severity: 'critical' },
        severity: 'critical',
      });

      expect(result.humanRequired).toBe(true);
      expect(result.message).toContain('Security vulnerability');
      expect(result.suggestedAction).toContain('Immediate human intervention');
    });

    it('should return escalation result with high severity', async () => {
      const result = await orchestrator.escalate({
        reason: 'Breaking API change required',
        context: { endpoint: '/api/v1/payments' },
        severity: 'high',
      });

      expect(result.humanRequired).toBe(true);
      expect(result.suggestedAction).toContain('Review the escalation context');
    });
  });

  // ─── getStatus() ───────────────────────────────────────────

  describe('getStatus()', () => {
    it('should return status with zero active missions initially', async () => {
      const status = await orchestrator.getStatus();

      expect(status.activeMissions).toBe(0);
      expect(status.activeHandoffs).toBe(0);
      expect(status.recentEscalations).toBe(0);
    });

    it('should update active missions after processing', async () => {
      await orchestrator.processTask({
        title: 'Status test',
        type: 'feature',
        priority: 'low',
      });

      const status = await orchestrator.getStatus();
      expect(status.activeMissions).toBe(1);
    });

    it('should include agents utilization when agents exist', async () => {
      const dna = makeSampleDNA();
      await (orchestrator as any).skillEngine.syncFromDNA(dna);

      const status = await orchestrator.getStatus();
      expect(status.agentsUtilization).toBeDefined();
    });
  });
});
