import { beforeEach, describe, expect, it } from 'vitest';
import { HandoffProtocol } from '../../engines/orchestrator/handoff-protocol';

describe('HandoffProtocol', () => {
  let protocol: HandoffProtocol;

  beforeEach(() => {
    protocol = new HandoffProtocol(10); // Max 10 active handoffs
  });

  // ─── request() ─────────────────────────────────────────────

  describe('request()', () => {
    it('should create a pending handoff', async () => {
      const result = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 'subtask-1',
          title: 'Implement API',
          type: 'implementation',
          requiredSkill: 'api-development',
          status: 'pending',
        },
        missionId: 'mission-1',
      });

      expect(result.handoffId).toBeTruthy();
      expect(result.status).toBe('pending');
    });

    it('should store full context in handoff', async () => {
      const previousOutput = { data: 'test' };
      const result = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 'subtask-1',
          title: 'Implement API',
          type: 'implementation',
          requiredSkill: 'api-development',
          status: 'pending',
        },
        missionId: 'mission-1',
        previousOutput,
      });

      const record = await protocol.get(result.handoffId);
      expect(record!.context.missionId).toBe('mission-1');
      expect(record!.context.previousOutput).toEqual(previousOutput);
    });

    it('should reject when max active handoffs reached', async () => {
      const smallProtocol = new HandoffProtocol(1);

      await smallProtocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await expect(
        smallProtocol.request('agent-a', 'agent-b', {
          subtask: {
            id: 's2',
            title: 'T2',
            type: 'implementation',
            requiredSkill: 'dev',
            status: 'pending',
          },
          missionId: 'm2',
        }),
      ).rejects.toThrow('Maximum active handoffs reached');
    });
  });

  // ─── accept() ──────────────────────────────────────────────

  describe('accept()', () => {
    it('should transition pending to accepted then in_progress', async () => {
      const { handoffId } = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await protocol.accept(handoffId);
      const record = await protocol.status(handoffId);
      expect(record.status).toBe('in_progress');
    });

    it('should throw for non-existent handoff', async () => {
      await expect(protocol.accept('non-existent')).rejects.toThrow('Handoff not found');
    });

    it('should throw for already completed handoff', async () => {
      const { handoffId } = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await protocol.accept(handoffId);
      await protocol.complete(handoffId, { result: 'done' });

      await expect(protocol.accept(handoffId)).rejects.toThrow(
        'Cannot accept handoff in status: completed',
      );
    });
  });

  // ─── reject() ──────────────────────────────────────────────

  describe('reject()', () => {
    it('should transition pending to rejected with reason', async () => {
      const { handoffId } = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await protocol.reject(handoffId, {
        code: 'missing-skill',
        details: 'Agent does not have the required skill',
        suggestion: 'Try rerouting to another agent',
      });

      const record = await protocol.status(handoffId);
      expect(record.status).toBe('rejected');
      expect(record.rejectionReason!.code).toBe('missing-skill');
      expect(record.rejectionReason!.suggestion).toBe('Try rerouting to another agent');
    });

    it('should throw for already accepted handoff', async () => {
      const { handoffId } = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await protocol.accept(handoffId);

      await expect(
        protocol.reject(handoffId, { code: 'missing-skill', details: 'Nope' }),
      ).rejects.toThrow('Cannot reject handoff in status');
    });
  });

  // ─── complete() ────────────────────────────────────────────

  describe('complete()', () => {
    it('should mark handoff as completed with output', async () => {
      const { handoffId } = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await protocol.accept(handoffId);
      await protocol.complete(handoffId, { code: 'implementation-complete', tests: 10 });

      const record = await protocol.status(handoffId);
      expect(record.status).toBe('completed');
      expect(record.output).toEqual({ code: 'implementation-complete', tests: 10 });
      expect(record.completedAt).toBeTruthy();
    });

    it('should throw for pending handoff', async () => {
      const { handoffId } = await protocol.request('agent-a', 'agent-b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await expect(protocol.complete(handoffId, {})).rejects.toThrow(
        'Cannot complete handoff in status',
      );
    });
  });

  // ─── listActive() ──────────────────────────────────────────

  describe('listActive()', () => {
    it('should return only active handoffs', async () => {
      const h1 = await protocol.request('a', 'b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });
      const h2 = await protocol.request('a', 'b', {
        subtask: {
          id: 's2',
          title: 'T2',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      await protocol.accept(h1.handoffId);
      await protocol.complete(h1.handoffId, {});

      const active = await protocol.listActive();
      expect(active.length).toBe(1);
      expect(active[0]!.handoffId).toBe(h2.handoffId);
    });
  });

  // ─── listForAgent() ────────────────────────────────────────

  describe('listForAgent()', () => {
    it('should return handoffs sent or received by agent', async () => {
      await protocol.request('orchestrator', 'backend-agent', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      const records = await protocol.listForAgent('backend-agent');
      expect(records.length).toBe(1);
      expect(records[0]!.to).toBe('backend-agent');
    });
  });

  // ─── getAll() ──────────────────────────────────────────────

  describe('getAll()', () => {
    it('should return all handoffs', async () => {
      await protocol.request('a', 'b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });
      await protocol.request('b', 'c', {
        subtask: {
          id: 's2',
          title: 'T2',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm2',
      });

      const all = await protocol.getAll();
      expect(all.length).toBe(2);
    });
  });

  // ─── countByStatus() ───────────────────────────────────────

  describe('countByStatus()', () => {
    it('should return counts for each status', async () => {
      const h1 = await protocol.request('a', 'b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });
      await protocol.request('a', 'b', {
        subtask: {
          id: 's2',
          title: 'T2',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm2',
      });

      await protocol.accept(h1.handoffId);
      await protocol.complete(h1.handoffId, {});

      const counts = await protocol.countByStatus();
      expect(counts.completed).toBe(1);
      expect(counts.pending).toBe(1);
    });
  });

  // ─── exists() ──────────────────────────────────────────────

  describe('exists()', () => {
    it('should return true for existing handoff', async () => {
      const { handoffId } = await protocol.request('a', 'b', {
        subtask: {
          id: 's1',
          title: 'T1',
          type: 'implementation',
          requiredSkill: 'dev',
          status: 'pending',
        },
        missionId: 'm1',
      });

      const exists = await protocol.exists(handoffId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existing handoff', async () => {
      const exists = await protocol.exists('non-existent');
      expect(exists).toBe(false);
    });
  });
});
