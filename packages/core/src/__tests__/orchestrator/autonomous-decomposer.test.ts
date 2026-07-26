import { beforeEach, describe, expect, it } from 'vitest';
import { AutonomousDecomposer } from '../../engines/orchestrator/autonomous-decomposer';

describe('AutonomousDecomposer', () => {
  let decomposer: AutonomousDecomposer;

  beforeEach(() => {
    decomposer = new AutonomousDecomposer();
  });

  // ─── decompose() ───────────────────────────────────────────

  describe('decompose()', () => {
    it('should decompose a feature mission into 7 subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Implement payment module',
        type: 'feature',
        description: 'Create a payment processing module',
      });

      expect(subtasks).toHaveLength(7);
      expect(subtasks[0]!.type).toBe('design');
      expect(subtasks[1]!.type).toBe('implementation');
      expect(subtasks[2]!.type).toBe('testing');
      expect(subtasks[3]!.type).toBe('documentation');
      expect(subtasks[4]!.type).toBe('review');
      expect(subtasks[5]!.type).toBe('security');
      expect(subtasks[6]!.type).toBe('deployment');
    });

    it('should decompose a bugfix mission into 5 subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Fix payment timeout',
        type: 'bugfix',
      });

      expect(subtasks).toHaveLength(5);
      expect(subtasks[0]!.type).toBe('design');
      expect(subtasks[0]!.requiredSkill).toBe('diagnosis');
      expect(subtasks[1]!.type).toBe('implementation');
      expect(subtasks[1]!.requiredSkill).toBe('bug-fixing');
      expect(subtasks[2]!.type).toBe('testing');
      expect(subtasks[3]!.type).toBe('documentation');
      expect(subtasks[4]!.type).toBe('review');
    });

    it('should decompose a refactor mission into 5 subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Refactor auth service',
        type: 'refactor',
      });

      expect(subtasks).toHaveLength(5);
      expect(subtasks[0]!.type).toBe('design');
      expect(subtasks[0]!.requiredSkill).toBe('code-analysis');
      expect(subtasks[1]!.type).toBe('implementation');
      expect(subtasks[1]!.requiredSkill).toBe('refactoring');
    });

    it('should decompose a security mission into 6 subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Security audit',
        type: 'security',
        description: 'Run security scan on payment module',
      });

      expect(subtasks).toHaveLength(6);
      expect(subtasks[0]!.type).toBe('security');
      expect(subtasks[0]!.requiredSkill).toBe('security-scanning');
      expect(subtasks[1]!.requiredSkill).toBe('security-triage');
      expect(subtasks[4]!.type).toBe('documentation');
      expect(subtasks[5]!.type).toBe('review');
    });

    it('should decompose a deploy mission into 5 subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Deploy to production',
        type: 'deploy',
      });

      expect(subtasks).toHaveLength(5);
      expect(subtasks[0]!.type).toBe('deployment');
      expect(subtasks[0]!.requiredSkill).toBe('build');
      expect(subtasks[1]!.type).toBe('testing');
      expect(subtasks[2]!.type).toBe('deployment');
      expect(subtasks[4]!.type).toBe('deployment');
    });

    it('should decompose a research mission into 4 subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Research vector databases',
        type: 'research',
      });

      expect(subtasks).toHaveLength(4);
      expect(subtasks[0]!.type).toBe('implementation');
      expect(subtasks[0]!.requiredSkill).toBe('research');
      expect(subtasks[1]!.type).toBe('design');
      expect(subtasks[2]!.type).toBe('documentation');
      expect(subtasks[3]!.type).toBe('review');
    });

    it('should use description in subtask titles when provided', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Test module',
        type: 'feature',
        description: 'Custom description for testing',
      });

      for (const subtask of subtasks) {
        expect(subtask.description).toContain('Custom description for testing');
      }
    });

    it('should generate unique IDs for each subtask', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Unique IDs test',
        type: 'feature',
      });

      const ids = subtasks.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set status to pending for all subtasks', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Status test',
        type: 'feature',
      });

      for (const subtask of subtasks) {
        expect(subtask.status).toBe('pending');
      }
    });

    it('should fall back to feature decomposition for unknown types', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Unknown type',
        type: 'custom-type' as any,
      });

      expect(subtasks).toHaveLength(7);
    });

    it('should accept optional DNA parameter without error', async () => {
      const dna = { somePattern: 'test' };
      const subtasks = await decomposer.decompose({ title: 'DNA test', type: 'feature' }, dna);

      expect(subtasks).toHaveLength(7);
    });

    it('should create subtasks with requiredSkill field', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Skill test',
        type: 'feature',
      });

      for (const subtask of subtasks) {
        expect(subtask.requiredSkill).toBeTruthy();
        expect(typeof subtask.requiredSkill).toBe('string');
      }
    });

    it('should include title in each subtask', async () => {
      const subtasks = await decomposer.decompose({
        title: 'My Feature',
        type: 'feature',
      });

      for (const subtask of subtasks) {
        expect(subtask.title).toContain('My Feature');
      }
    });

    it('should handle research mission without description', async () => {
      const subtasks = await decomposer.decompose({
        title: 'Research AI agents',
        type: 'research',
      });

      expect(subtasks).toHaveLength(4);
      expect(subtasks[0]!.title).toContain('Research AI agents');
    });
  });

  describe('with options', () => {
    it('should accept DNA options in constructor', () => {
      const opts = { dna: { mode: 'strict' } };
      const customDecomposer = new AutonomousDecomposer(opts);
      expect(customDecomposer).toBeDefined();
    });
  });
});
