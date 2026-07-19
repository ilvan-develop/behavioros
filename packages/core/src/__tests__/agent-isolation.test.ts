import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForensicCollector } from '../resilience/agent-isolation/forensic-collector';
import { QuarantineManager } from '../resilience/agent-isolation/quarantine-manager';
import { SandboxExecutor } from '../resilience/agent-isolation/sandbox-executor';
import { SuspicionDetector } from '../resilience/agent-isolation/suspicion-detector';

// ============================================================
// SuspicionDetector Tests
// ============================================================

describe('SuspicionDetector', () => {
  let detector: SuspicionDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new SuspicionDetector({
      failureThreshold: 5,
      failureWindowMs: 300_000,
      rateSpikeMultiplier: 3,
      rateBaselineWindowMs: 600_000,
      anomalyScoreThreshold: 45,
      coolDownMs: 120_000,
      maxTrackedAgents: 100,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('anomaly detection', () => {
    it('should return none level for normal requests', () => {
      const result = detector.recordRequest('agent-1', 'read', true);
      expect(result.level).toBe('none');
      expect(result.score).toBe(0);
      expect(result.shouldQuarantine).toBe(false);
    });

    it('should detect repeated failures', () => {
      for (let i = 0; i < 10; i++) {
        detector.recordRequest('agent-1', 'read', false);
      }
      const result = detector.recordRequest('agent-1', 'read', false);
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events.some((e) => e.anomalyType === 'repeated-failure')).toBe(true);
    });

    it('should escalate level based on score', () => {
      const result = detector.checkAccess('agent-1', '/admin', ['public']);
      expect(result.level).toBe('low');
      expect(result.score).toBe(40);
    });

    it('should reach critical level with multiple anomalies', () => {
      detector.checkPrivilegeEscalation('agent-1', 'c-level', 'junior');
      detector.checkAccess('agent-1', '/secret', ['public']);
      detector.checkAccess('agent-1', '/admin', ['public']);
      const result = detector.checkAccess('agent-1', '/root', ['public']);
      expect(result.level).toBe('critical');
      expect(result.shouldQuarantine).toBe(true);
    });

    it('should cap score at 100', () => {
      for (let i = 0; i < 20; i++) {
        detector.checkAccess('agent-1', `/resource-${i}`, ['public']);
      }
      expect(detector.getScore('agent-1')).toBeLessThanOrEqual(100);
    });
  });

  describe('access checking', () => {
    it('should not flag authorized access', () => {
      const result = detector.checkAccess('agent-1', '/public', ['/public', '/admin']);
      expect(result.events).toHaveLength(0);
      expect(result.level).toBe('none');
    });

    it('should flag unauthorized access', () => {
      const result = detector.checkAccess('agent-1', '/admin', ['/public']);
      expect(result.events).toHaveLength(1);
      expect(result.events[0].anomalyType).toBe('unauthorized-access');
    });
  });

  describe('privilege escalation', () => {
    it('should detect privilege escalation', () => {
      const result = detector.checkPrivilegeEscalation('agent-1', 'admin', 'user');
      expect(result.events).toHaveLength(1);
      expect(result.events[0].anomalyType).toBe('privilege-escalation');
      expect(result.events[0].level).toBe('critical');
    });

    it('should not flag when authority matches', () => {
      const result = detector.checkPrivilegeEscalation('agent-1', 'senior', 'senior');
      expect(result.events).toHaveLength(0);
    });
  });

  describe('snapshots and queries', () => {
    it('should return null snapshot for unknown agent', () => {
      expect(detector.getSnapshot('unknown')).toBeNull();
    });

    it('should return snapshot for tracked agent', () => {
      detector.recordRequest('agent-1', 'read', true);
      detector.recordRequest('agent-1', 'write', true);
      const snapshot = detector.getSnapshot('agent-1');
      expect(snapshot).not.toBeNull();
      expect(snapshot!.agentId).toBe('agent-1');
      expect(snapshot!.totalRequests).toBe(2);
    });

    it('should get level and score for agent', () => {
      expect(detector.getLevel('agent-1')).toBe('none');
      expect(detector.getScore('agent-1')).toBe(0);
    });

    it('should return all suspicious agents sorted by score', () => {
      detector.checkAccess('agent-low', '/x', []);
      detector.checkPrivilegeEscalation('agent-high', 'c-level', 'junior');
      const suspicious = detector.getAllSuspicious();
      expect(suspicious.length).toBeGreaterThanOrEqual(2);
      expect(suspicious[0].score).toBeGreaterThanOrEqual(suspicious[1].score);
    });
  });

  describe('score decay and reset', () => {
    it('should decay score', () => {
      detector.checkAccess('agent-1', '/x', []);
      const before = detector.getScore('agent-1');
      detector.decayScore('agent-1', 10);
      expect(detector.getScore('agent-1')).toBe(before - 10);
    });

    it('should not decay below zero', () => {
      detector.decayScore('agent-1', 1000);
      expect(detector.getScore('agent-1')).toBe(0);
    });

    it('should reset agent', () => {
      detector.checkAccess('agent-1', '/x', []);
      detector.resetAgent('agent-1');
      expect(detector.getLevel('agent-1')).toBe('none');
    });

    it('should fully reset', () => {
      detector.checkAccess('agent-1', '/x', []);
      detector.reset();
      expect(detector.getAllSuspicious()).toHaveLength(0);
    });
  });

  describe('events', () => {
    it('should emit suspicion-detected event', () => {
      const handler = vi.fn();
      detector.on('suspicion-detected', handler);
      detector.checkAccess('agent-1', '/admin', ['public']);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'unauthorized-access',
        }),
      );
    });

    it('should emit level-changed event', () => {
      const handler = vi.fn();
      detector.on('level-changed', handler);
      detector.checkAccess('agent-1', '/admin', ['public']);
      expect(handler).toHaveBeenCalledWith('agent-1', 'none', 'low');
    });

    it('should emit quarantine-recommended for critical level', () => {
      const handler = vi.fn();
      detector.on('quarantine-recommended', handler);
      detector.checkPrivilegeEscalation('agent-1', 'c-level', 'junior');
      detector.checkPrivilegeEscalation('agent-1', 'director', 'junior');
      expect(handler).toHaveBeenCalled();
    });
  });
});

// ============================================================
// QuarantineManager Tests
// ============================================================

describe('QuarantineManager', () => {
  let manager: QuarantineManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new QuarantineManager({
      defaultDurationMs: 60_000,
      maxDurationMs: 300_000,
      autoReleaseEnabled: false,
      checkIntervalMs: 10_000,
      maxQuarantinedAgents: 100,
      escalationThresholdMs: 120_000,
    });
  });

  afterEach(() => {
    manager.reset();
    vi.useRealTimers();
  });

  describe('quarantine', () => {
    it('should quarantine an agent', () => {
      const result = manager.quarantine('agent-1', 'suspicion-threshold');
      expect(result.success).toBe(true);
      expect(result.entry).not.toBeNull();
      expect(result.entry!.status).toBe('active');
    });

    it('should block actions for quarantined agent', () => {
      manager.quarantine('agent-1', 'manual');
      const check = manager.checkAction('agent-1', 'deploy');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('quarantined');
    });

    it('should allow actions for non-quarantined agent', () => {
      const check = manager.checkAction('agent-1', 'deploy');
      expect(check.allowed).toBe(true);
    });

    it('should not quarantine already quarantined agent', () => {
      manager.quarantine('agent-1', 'manual');
      const result = manager.quarantine('agent-1', 'repeated-failure');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('already quarantined');
    });

    it('should enforce max quarantined agents', () => {
      const smallManager = new QuarantineManager({ maxQuarantinedAgents: 2 });
      smallManager.quarantine('a1', 'manual');
      smallManager.quarantine('a2', 'manual');
      const result = smallManager.quarantine('a3', 'manual');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Maximum');
      smallManager.reset();
    });

    it('should apply default duration', () => {
      const result = manager.quarantine('agent-1', 'manual');
      expect(result.entry!.durationMs).toBe(60_000);
    });

    it('should respect max duration', () => {
      const result = manager.quarantine('agent-1', 'manual', 999_999);
      expect(result.entry!.durationMs).toBe(300_000);
    });
  });

  describe('release', () => {
    it('should release a quarantined agent', () => {
      manager.quarantine('agent-1', 'manual');
      const result = manager.release('agent-1', 'admin');
      expect(result.success).toBe(true);
      expect(result.entry!.status).toBe('released');
      expect(result.entry!.releasedBy).toBe('admin');
    });

    it('should allow actions after release', () => {
      manager.quarantine('agent-1', 'manual');
      manager.release('agent-1');
      const check = manager.checkAction('agent-1', 'deploy');
      expect(check.allowed).toBe(true);
    });

    it('should fail to release non-quarantined agent', () => {
      const result = manager.release('agent-1');
      expect(result.success).toBe(false);
      expect(result.reason).toContain('not quarantined');
    });
  });

  describe('auto-release after timeout', () => {
    it('should release agent when quarantine expires via isQuarantined check', () => {
      manager.quarantine('agent-1', 'manual', 5000);
      expect(manager.isQuarantined('agent-1')).toBe(true);

      vi.advanceTimersByTime(6000);
      expect(manager.isQuarantined('agent-1')).toBe(false);
    });

    it('should emit quarantine-expired event', () => {
      const handler = vi.fn();
      manager.on('quarantine-expired', handler);
      manager.quarantine('agent-1', 'manual', 5000);
      vi.advanceTimersByTime(6000);
      manager.isQuarantined('agent-1');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('queries', () => {
    it('should get active quarantines', () => {
      manager.quarantine('agent-1', 'manual');
      manager.quarantine('agent-2', 'manual');
      expect(manager.getActiveQuarantines()).toHaveLength(2);
    });

    it('should get entry for quarantined agent', () => {
      manager.quarantine('agent-1', 'manual');
      const entry = manager.getEntry('agent-1');
      expect(entry).not.toBeNull();
      expect(entry!.reason).toBe('manual');
    });

    it('should return null for unknown agent', () => {
      expect(manager.getEntry('unknown')).toBeNull();
    });

    it('should get history', () => {
      manager.quarantine('agent-1', 'manual');
      manager.release('agent-1');
      expect(manager.getHistory()).toHaveLength(1);
      expect(manager.getHistory('agent-1')).toHaveLength(1);
    });

    it('should get stats', () => {
      manager.quarantine('agent-1', 'manual');
      manager.quarantine('agent-2', 'manual');
      manager.release('agent-1');
      const stats = manager.getStats();
      expect(stats.active).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.released).toBe(1);
    });
  });

  describe('force release', () => {
    it('should force release all agents', () => {
      manager.quarantine('agent-1', 'manual');
      manager.quarantine('agent-2', 'manual');
      const count = manager.forceReleaseAll();
      expect(count).toBe(2);
      expect(manager.getActiveQuarantines()).toHaveLength(0);
    });
  });

  describe('events', () => {
    it('should emit agent-quarantined event', () => {
      const handler = vi.fn();
      manager.on('agent-quarantined', handler);
      manager.quarantine('agent-1', 'manual');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent-1' }));
    });

    it('should emit agent-released event', () => {
      const handler = vi.fn();
      manager.on('agent-released', handler);
      manager.quarantine('agent-1', 'manual');
      manager.release('agent-1');
      expect(handler).toHaveBeenCalled();
    });

    it('should emit escalation-required for long durations', () => {
      const handler = vi.fn();
      manager.on('escalation-required', handler);
      manager.quarantine('agent-1', 'privilege-escalation', 200_000);
      expect(handler).toHaveBeenCalled();
    });
  });
});

// ============================================================
// SandboxExecutor Tests
// ============================================================

describe('SandboxExecutor', () => {
  let executor: SandboxExecutor;

  beforeEach(() => {
    vi.useFakeTimers();
    executor = new SandboxExecutor({
      defaultTimeoutMs: 5000,
      maxTimeoutMs: 30_000,
      maxConcurrentExecutions: 3,
      allowedPermissions: ['read', 'write'],
    });
  });

  afterEach(() => {
    executor.reset();
    vi.useRealTimers();
  });

  describe('execution', () => {
    it('should execute handler in isolation', async () => {
      const execution = await executor.execute(
        'agent-1',
        'process-data',
        { key: 'value' },
        async (input) => ({ result: 'ok', input }),
      );
      expect(execution.status).toBe('completed');
      expect(execution.output).not.toBeNull();
      expect(execution.output!.returnValue).toEqual({ result: 'ok', input: { key: 'value' } });
    });

    it('should handle failed execution', async () => {
      const execution = await executor.execute('agent-1', 'failing-action', {}, async () => {
        throw new Error('something went wrong');
      });
      expect(execution.status).toBe('failed');
      expect(execution.error).toBe('something went wrong');
    });

    it('should handle timeout', async () => {
      const execution = executor.execute(
        'agent-1',
        'slow-action',
        {},
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          return 'done';
        },
        { timeoutMs: 100 },
      );

      vi.advanceTimersByTime(10_200);
      await execution;
      const completedEntries = executor.getCompleted();
      const timeoutEntry = completedEntries.find((e) => e.status === 'timeout');
      expect(timeoutEntry).toBeDefined();
      expect(timeoutEntry!.error).toContain('timed out');
    });

    it('should capture evidence', async () => {
      const execution = await executor.execute('agent-1', 'action', {}, async () => 'result');
      expect(execution.evidence).toBeDefined();
      expect(execution.evidence.agentId).toBe('agent-1');
    });

    it('should reject disallowed permissions', async () => {
      await expect(
        executor.execute('agent-1', 'action', {}, async () => 'result', {
          permissions: ['network'],
        }),
      ).rejects.toThrow('Permission "network" is not allowed');
    });

    it('should enforce max concurrent executions', async () => {
      const slowHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return 'done';
      };

      const p1 = executor.execute('agent-1', 'a1', {}, slowHandler, { timeoutMs: 10_000 });
      const p2 = executor.execute('agent-2', 'a2', {}, slowHandler, { timeoutMs: 10_000 });
      const p3 = executor.execute('agent-3', 'a3', {}, slowHandler, { timeoutMs: 10_000 });

      await expect(executor.execute('agent-4', 'a4', {}, slowHandler)).rejects.toThrow(
        'Maximum concurrent executions',
      );

      vi.advanceTimersByTime(10_000);
      await Promise.all([p1, p2, p3]);
    });
  });

  describe('read-only execution', () => {
    it('should execute read-only handler', async () => {
      const execution = await executor.executeReadOnly('agent-1', 'read-data', async () => ({
        data: [1, 2, 3],
      }));
      expect(execution.status).toBe('completed');
      expect(execution.permissions).toEqual(['read']);
    });
  });

  describe('kill', () => {
    it('should kill an active execution', async () => {
      const promise = executor.execute(
        'agent-1',
        'long-action',
        {},
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10_000));
          return 'done';
        },
        { timeoutMs: 30_000 },
      );

      vi.advanceTimersByTime(100);
      const executions = executor.getActive();
      expect(executions).toHaveLength(1);

      const killed = executor.kill(executions[0].id);
      expect(killed).toBe(true);
      expect(executor.getActive()).toHaveLength(0);

      vi.advanceTimersByTime(10_000);
      await promise;
      const completedEntries = executor.getCompleted();
      const killedEntry = completedEntries.find((e) => e.status === 'killed');
      expect(killedEntry).toBeDefined();
    });

    it('should return false for unknown execution', () => {
      expect(executor.kill('unknown')).toBe(false);
    });

    it('should kill all active executions', async () => {
      executor.execute(
        'agent-1',
        'a1',
        {},
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10_000));
        },
        { timeoutMs: 30_000 },
      );
      executor.execute(
        'agent-2',
        'a2',
        {},
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10_000));
        },
        { timeoutMs: 30_000 },
      );

      vi.advanceTimersByTime(100);
      const count = executor.killAll();
      expect(count).toBe(2);
    });
  });

  describe('queries', () => {
    it('should get completed executions', async () => {
      await executor.execute('agent-1', 'a1', {}, async () => 'done');
      expect(executor.getCompleted()).toHaveLength(1);
    });

    it('should get execution by id', async () => {
      const execution = await executor.execute('agent-1', 'a1', {}, async () => 'done');
      expect(executor.getExecution(execution.id)).not.toBeNull();
    });

    it('should return null for unknown execution', () => {
      expect(executor.getExecution('unknown')).toBeNull();
    });

    it('should get stats', async () => {
      await executor.execute('agent-1', 'a1', {}, async () => 'done');
      await executor.execute('agent-2', 'a2', {}, async () => {
        throw new Error('fail');
      });
      const stats = executor.getStats();
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
    });

    it('should prune old executions', async () => {
      await executor.execute('agent-1', 'a1', {}, async () => 'done');
      vi.advanceTimersByTime(86_400_001);
      const pruned = executor.prune(86_400_000);
      expect(pruned).toBe(1);
    });
  });

  describe('events', () => {
    it('should emit execution-started', async () => {
      const handler = vi.fn();
      executor.on('execution-started', handler);
      await executor.execute('agent-1', 'a1', {}, async () => 'done');
      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution-completed', async () => {
      const handler = vi.fn();
      executor.on('execution-completed', handler);
      await executor.execute('agent-1', 'a1', {}, async () => 'done');
      expect(handler).toHaveBeenCalled();
    });

    it('should emit execution-failed', async () => {
      const handler = vi.fn();
      executor.on('execution-failed', handler);
      await executor.execute('agent-1', 'a1', {}, async () => {
        throw new Error('fail');
      });
      expect(handler).toHaveBeenCalled();
    });
  });
});

// ============================================================
// ForensicCollector Tests
// ============================================================

describe('ForensicCollector', () => {
  let collector: ForensicCollector;

  beforeEach(() => {
    vi.useFakeTimers();
    collector = new ForensicCollector({
      maxEntries: 1000,
      retentionMs: 86_400_000,
      captureRequestBodies: true,
      captureResponseBodies: true,
      enableHashing: true,
    });
  });

  afterEach(() => {
    collector.reset();
    vi.useRealTimers();
  });

  describe('recording evidence', () => {
    it('should record an entry', () => {
      const entry = collector.record('agent-1', 'action-log', 'deploy');
      expect(entry.id).toBeTruthy();
      expect(entry.agentId).toBe('agent-1');
      expect(entry.type).toBe('action-log');
      expect(entry.action).toBe('deploy');
      expect(entry.hash).toBeTruthy();
      expect(entry.previousHash).toBe('0'.repeat(64));
    });

    it('should chain hashes between entries', () => {
      const e1 = collector.record('agent-1', 'action-log', 'read');
      const e2 = collector.record('agent-1', 'action-log', 'write');
      expect(e2.previousHash).toBe(e1.hash);
    });

    it('should record action log with severity mapping', () => {
      const success = collector.recordAction('agent-1', 'read', 'success');
      expect(success.severity).toBe('info');

      const failure = collector.recordAction('agent-1', 'write', 'failure');
      expect(failure.severity).toBe('critical');

      const blocked = collector.recordAction('agent-1', 'deploy', 'blocked');
      expect(blocked.severity).toBe('warning');
    });

    it('should record request-response', () => {
      const entry = collector.recordRequestResponse(
        'agent-1',
        'api-call',
        { body: { query: 'test' } },
        { body: { result: 'ok' } },
      );
      expect(entry.type).toBe('request-response');
      expect(entry.request).not.toBeNull();
      expect(entry.response).not.toBeNull();
    });

    it('should record governance evaluation', () => {
      const entry = collector.recordGovernanceEvaluation('agent-1', 'deploy', 'blocked', [
        'missing-review',
      ]);
      expect(entry.type).toBe('governance-evaluation');
      expect(entry.severity).toBe('critical');
    });

    it('should record suspicion alert', () => {
      const entry = collector.recordSuspicionAlert('agent-1', 'critical', 95, ['unauthorized']);
      expect(entry.type).toBe('suspicion-alert');
      expect(entry.severity).toBe('critical');
    });

    it('should record quarantine event', () => {
      const entry = collector.recordQuarantineEvent('agent-1', 'quarantined', 'suspicion');
      expect(entry.type).toBe('quarantine-event');
      expect(entry.severity).toBe('warning');
    });
  });

  describe('queries', () => {
    it('should get entry by id', () => {
      const entry = collector.record('agent-1', 'action-log', 'test');
      expect(collector.getEntry(entry.id)).not.toBeNull();
    });

    it('should return null for unknown entry', () => {
      expect(collector.getEntry('unknown')).toBeNull();
    });

    it('should filter entries by agent', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-2', 'action-log', 'b');
      expect(collector.getEntries({ agentId: 'agent-1' })).toHaveLength(1);
    });

    it('should filter entries by type', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-1', 'suspicion-alert', 'b');
      expect(collector.getEntries({ type: 'action-log' })).toHaveLength(1);
    });

    it('should filter entries by severity', () => {
      collector.record('agent-1', 'action-log', 'a', { severity: 'info' });
      collector.record('agent-1', 'action-log', 'b', { severity: 'critical' });
      expect(collector.getEntries({ severity: 'critical' })).toHaveLength(1);
    });

    it('should limit results', () => {
      for (let i = 0; i < 5; i++) {
        collector.record('agent-1', 'action-log', `a${i}`);
      }
      expect(collector.getEntries({ limit: 3 })).toHaveLength(3);
    });

    it('should get agent timeline', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-2', 'action-log', 'b');
      collector.record('agent-1', 'action-log', 'c');
      expect(collector.getAgentTimeline('agent-1')).toHaveLength(2);
    });
  });

  describe('export and chain verification', () => {
    it('should export evidence report', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-1', 'action-log', 'b');
      const report = collector.exportEvidence();
      expect(report.totalEntries).toBe(2);
      expect(report.chainIntegrity).toBe(true);
    });

    it('should verify chain integrity', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-1', 'action-log', 'b');
      expect(collector.verifyChain()).toBe(true);
    });

    it('should return true for empty chain', () => {
      expect(collector.verifyChain()).toBe(true);
    });

    it('should emit chain-verified event', () => {
      const handler = vi.fn();
      collector.record('agent-1', 'action-log', 'a');
      collector.on('chain-verified', handler);
      collector.verifyChain();
      expect(handler).toHaveBeenCalledWith(true, 1);
    });
  });

  describe('stats', () => {
    it('should compute stats', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-2', 'suspicion-alert', 'b');
      const stats = collector.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.uniqueAgents).toBe(2);
      expect(stats.chainValid).toBe(true);
      expect(stats.byType['action-log']).toBe(1);
      expect(stats.byType['suspicion-alert']).toBe(1);
    });
  });

  describe('pruning and reset', () => {
    it('should prune old entries', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.record('agent-1', 'action-log', 'b');
      vi.advanceTimersByTime(86_400_001);
      const pruned = collector.prune(86_400_000);
      expect(pruned).toBe(2);
      expect(collector.getEntries()).toHaveLength(0);
    });

    it('should emit entry-pruned event', () => {
      const handler = vi.fn();
      collector.on('entry-pruned', handler);
      collector.record('agent-1', 'action-log', 'a');
      vi.advanceTimersByTime(86_400_001);
      collector.prune(86_400_000);
      expect(handler).toHaveBeenCalled();
    });

    it('should reset', () => {
      collector.record('agent-1', 'action-log', 'a');
      collector.reset();
      expect(collector.getEntries()).toHaveLength(0);
    });

    it('should enforce max entries', () => {
      const smallCollector = new ForensicCollector({ maxEntries: 2 });
      smallCollector.record('a', 'action-log', '1');
      smallCollector.record('a', 'action-log', '2');
      smallCollector.record('a', 'action-log', '3');
      expect(smallCollector.getEntries()).toHaveLength(2);
    });
  });

  describe('events', () => {
    it('should emit entry-recorded event', () => {
      const handler = vi.fn();
      collector.on('entry-recorded', handler);
      collector.record('agent-1', 'action-log', 'test');
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ agentId: 'agent-1' }));
    });

    it('should emit evidence-exported event', () => {
      const handler = vi.fn();
      collector.on('evidence-exported', handler);
      collector.exportEvidence();
      expect(handler).toHaveBeenCalled();
    });
  });
});
