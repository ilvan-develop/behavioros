import { beforeEach, describe, expect, it } from 'vitest';
import { AgentBoundary } from '../domain/boundaries/agent-boundary';
import { DNABoundary } from '../domain/boundaries/dna-boundary';
import { ExecutionBoundary } from '../domain/boundaries/execution-boundary';

// ============================================================
// Domain Boundary Tests
// ============================================================

describe('DNABoundary', () => {
  let boundary: DNABoundary;

  beforeEach(() => {
    boundary = new DNABoundary('payments-dna', ['deploy', 'validate', 'audit']);
  });

  describe('constructor', () => {
    it('should set id and name', () => {
      expect(boundary.id).toBe('dna-payments-dna');
      expect(boundary.name).toBe('DNA Boundary: payments-dna');
      expect(boundary.type).toBe('dna');
    });
  });

  describe('validate', () => {
    it('should pass for matching dnaId and allowed action', () => {
      const result = boundary.validate({ dnaId: 'payments-dna', action: 'deploy' });
      expect(result.passed).toBe(true);
    });

    it('should fail for mismatched dnaId', () => {
      const result = boundary.validate({ dnaId: 'other-dna', action: 'deploy' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('DNA mismatch');
      expect(result.reason).toContain('payments-dna');
      expect(result.reason).toContain('other-dna');
    });

    it('should fail for disallowed action', () => {
      const result = boundary.validate({ dnaId: 'payments-dna', action: 'delete' });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain("Action 'delete' not allowed");
      expect(result.reason).toContain('payments-dna');
    });

    it('should pass for all allowed actions', () => {
      for (const action of ['deploy', 'validate', 'audit']) {
        const result = boundary.validate({ dnaId: 'payments-dna', action });
        expect(result.passed).toBe(true);
      }
    });
  });

  describe('getters', () => {
    it('should return dnaId', () => {
      expect(boundary.getDnaId()).toBe('payments-dna');
    });

    it('should return a copy of allowedActions', () => {
      const actions = boundary.getAllowedActions();
      actions.push('extra');
      expect(boundary.getAllowedActions()).toHaveLength(3);
    });
  });
});

describe('AgentBoundary', () => {
  let boundary: AgentBoundary;

  beforeEach(() => {
    boundary = new AgentBoundary('agent-1', 'senior');
  });

  describe('constructor', () => {
    it('should set id and name', () => {
      expect(boundary.id).toBe('agent-agent-1');
      expect(boundary.name).toBe('Agent Boundary: agent-1');
      expect(boundary.type).toBe('agent');
    });
  });

  describe('validate', () => {
    it('should pass for matching agentId with sufficient authority', () => {
      const result = boundary.validate({
        agentId: 'agent-1',
        authority: 'senior',
        action: 'deploy',
      });
      expect(result.passed).toBe(true);
    });

    it('should pass for agentId with higher authority', () => {
      const result = boundary.validate({
        agentId: 'agent-1',
        authority: 'architect',
        action: 'deploy',
      });
      expect(result.passed).toBe(true);
    });

    it('should pass for agentId with cto authority', () => {
      const result = boundary.validate({
        agentId: 'agent-1',
        authority: 'cto',
        action: 'deploy',
      });
      expect(result.passed).toBe(true);
    });

    it('should fail for mismatched agentId', () => {
      const result = boundary.validate({
        agentId: 'agent-2',
        authority: 'senior',
        action: 'deploy',
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Agent mismatch');
      expect(result.reason).toContain('agent-1');
    });

    it('should fail for insufficient authority', () => {
      const result = boundary.validate({
        agentId: 'agent-1',
        authority: 'junior',
        action: 'deploy',
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Insufficient authority');
      expect(result.reason).toContain('senior');
      expect(result.reason).toContain('junior');
    });

    it('should fail for unknown authority level', () => {
      const result = boundary.validate({
        agentId: 'agent-1',
        authority: 'unknown-level',
        action: 'deploy',
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Unknown authority level');
    });
  });

  describe('authority hierarchy', () => {
    it('should enforce strict hierarchy (junior < senior < architect < tech_lead < cto)', () => {
      const hierarchy = ['junior', 'senior', 'architect', 'tech_lead', 'cto'];

      for (let i = 0; i < hierarchy.length; i++) {
        for (let j = 0; j < hierarchy.length; j++) {
          const b = new AgentBoundary(
            'agent-1',
            hierarchy[i] as 'junior' | 'senior' | 'architect' | 'tech_lead' | 'cto',
          );
          const result = b.validate({
            agentId: 'agent-1',
            authority: hierarchy[j],
            action: 'test',
          });

          if (j >= i) {
            expect(result.passed).toBe(true);
          } else {
            expect(result.passed).toBe(false);
          }
        }
      }
    });
  });

  describe('getters', () => {
    it('should return agentId', () => {
      expect(boundary.getAgentId()).toBe('agent-1');
    });

    it('should return requiredAuthority', () => {
      expect(boundary.getRequiredAuthority()).toBe('senior');
    });
  });
});

describe('ExecutionBoundary', () => {
  let boundary: ExecutionBoundary;

  beforeEach(() => {
    boundary = new ExecutionBoundary('exec-1', 5000);
  });

  describe('constructor', () => {
    it('should set id and name', () => {
      expect(boundary.id).toBe('execution-exec-1');
      expect(boundary.name).toBe('Execution Boundary: exec-1');
      expect(boundary.type).toBe('execution');
    });

    it('should use default timeout of 5000ms', () => {
      const defaultBoundary = new ExecutionBoundary('exec-default');
      expect(defaultBoundary.getTimeout()).toBe(5000);
    });
  });

  describe('validate', () => {
    it('should pass when execution is within timeout', () => {
      const result = boundary.validate({
        executionId: 'exec-1',
        startTime: Date.now(),
      });
      expect(result.passed).toBe(true);
    });

    it('should fail when execution exceeds timeout', () => {
      const result = boundary.validate({
        executionId: 'exec-1',
        startTime: Date.now() - 10_000, // 10 seconds ago, timeout is 5000ms
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Execution timeout');
      expect(result.reason).toContain('5000ms');
    });

    it('should fail for mismatched executionId', () => {
      const result = boundary.validate({
        executionId: 'exec-2',
        startTime: Date.now(),
      });
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Execution mismatch');
      expect(result.reason).toContain('exec-1');
    });

    it('should pass at exactly the boundary (just under timeout)', () => {
      const shortBoundary = new ExecutionBoundary('exec-1', 100);
      const result = shortBoundary.validate({
        executionId: 'exec-1',
        startTime: Date.now(),
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('getters', () => {
    it('should return executionId', () => {
      expect(boundary.getExecutionId()).toBe('exec-1');
    });

    it('should return timeout', () => {
      expect(boundary.getTimeout()).toBe(5000);
    });
  });
});
