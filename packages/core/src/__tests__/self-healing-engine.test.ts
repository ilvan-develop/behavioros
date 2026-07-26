import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealingAction } from '../engines/quality/self-healing-engine';
import { SelfHealingEngine } from '../engines/quality/self-healing-engine';

describe('SelfHealingEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('monitor', () => {
    it('returns null for passed gates', async () => {
      const engine = new SelfHealingEngine();
      const result = await engine.monitor({ gate: 'lint', passed: true });

      expect(result).toBeNull();
    });

    it('returns null when disabled', async () => {
      const engine = new SelfHealingEngine({ enabled: false });
      const result = await engine.monitor({ gate: 'lint', passed: false, error: 'fail' });

      expect(result).toBeNull();
    });

    it('returns alert when no fix pattern registered', async () => {
      const engine = new SelfHealingEngine();
      const result = await engine.monitor({
        gate: 'unknown-gate',
        passed: false,
        error: 'something broke',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('alert');
      expect(result!.target).toBe('unknown-gate');
      expect(result!.description).toContain('No auto-fix pattern');
    });

    it('returns auto-fix action when pattern registered', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('lint', async () => true);

      const result = await engine.monitor({
        gate: 'lint',
        passed: false,
        error: 'lint error',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('auto-fix');
      expect(result!.success).toBe(true);
    });

    it('returns auto-fix with success=false when fix fails', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('lint', async () => false);

      const result = await engine.monitor({
        gate: 'lint',
        passed: false,
        error: 'lint error',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('auto-fix');
      expect(result!.success).toBe(false);
    });

    it('escalates to alert after maxRetries exceeded', async () => {
      const engine = new SelfHealingEngine({ maxRetries: 2 });
      engine.registerFixPattern('lint', async () => false);

      await engine.monitor({ gate: 'lint', passed: false, error: 'err' });
      await engine.monitor({ gate: 'lint', passed: false, error: 'err' });
      const third = await engine.monitor({ gate: 'lint', passed: false, error: 'err' });

      expect(third!.type).toBe('alert');
      expect(third!.description).toContain('Max retries');
    });

    it('resets retry count after alert escalation', async () => {
      const engine = new SelfHealingEngine({ maxRetries: 2 });
      engine.registerFixPattern('lint', async () => false);

      await engine.monitor({ gate: 'lint', passed: false, error: 'err' });
      await engine.monitor({ gate: 'lint', passed: false, error: 'err' });
      await engine.monitor({ gate: 'lint', passed: false, error: 'err' });
      const fourth = await engine.monitor({ gate: 'lint', passed: false, error: 'err' });

      expect(fourth!.type).toBe('auto-fix');
    });

    it('handles fix pattern that throws', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('lint', async () => {
        throw new Error('boom');
      });

      const result = await engine.monitor({
        gate: 'lint',
        passed: false,
        error: 'lint fail',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('auto-fix');
      expect(result!.success).toBe(false);
    });
  });

  describe('autoFix', () => {
    it('returns true when handler succeeds', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('typecheck', async () => true);

      const result = await engine.autoFix('typecheck', { file: 'index.ts' });

      expect(result).toBe(true);
    });

    it('returns false when handler fails', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('typecheck', async () => false);

      const result = await engine.autoFix('typecheck', {});

      expect(result).toBe(false);
    });

    it('returns false when pattern not registered', async () => {
      const engine = new SelfHealingEngine();

      const result = await engine.autoFix('nonexistent', {});

      expect(result).toBe(false);
    });

    it('returns false when handler throws', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('typecheck', async () => {
        throw new Error('crash');
      });

      const result = await engine.autoFix('typecheck', {});

      expect(result).toBe(false);
    });
  });

  describe('rollback', () => {
    it('returns true for valid checkpoint id', async () => {
      const engine = new SelfHealingEngine();

      const result = await engine.rollback('checkpoint-001');

      expect(result).toBe(true);
    });

    it('returns false for empty checkpoint id', async () => {
      const engine = new SelfHealingEngine();

      const result = await engine.rollback('');

      expect(result).toBe(false);
    });

    it('records rollback action in history', async () => {
      const engine = new SelfHealingEngine();
      await engine.rollback('cp-1');

      const history = await engine.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('rollback');
      expect(history[0].target).toBe('cp-1');
    });
  });

  describe('getHistory', () => {
    it('returns empty array initially', async () => {
      const engine = new SelfHealingEngine();

      const history = await engine.getHistory();

      expect(history).toEqual([]);
    });

    it('accumulates all actions', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('lint', async () => true);

      await engine.monitor({ gate: 'lint', passed: false, error: 'err' });
      await engine.rollback('cp-1');
      await engine.monitor({ gate: 'unknown', passed: false, error: 'err' });

      const history = await engine.getHistory();
      expect(history).toHaveLength(3);
      expect(history.map((h) => h.type)).toEqual(['auto-fix', 'rollback', 'alert']);
    });

    it('returns a copy (not mutable reference)', async () => {
      const engine = new SelfHealingEngine();
      await engine.rollback('cp-1');

      const history1 = await engine.getHistory();
      history1.push({} as HealingAction);
      const history2 = await engine.getHistory();

      expect(history2).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('returns zero stats when empty', async () => {
      const engine = new SelfHealingEngine();

      const stats = await engine.getStats();

      expect(stats.totalAttempts).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.byType).toEqual({});
    });

    it('counts successful and failed actions', async () => {
      const engine = new SelfHealingEngine();
      let callCount = 0;
      engine.registerFixPattern('lint', async () => {
        callCount++;
        return callCount === 1;
      });

      await engine.monitor({ gate: 'lint', passed: false, error: 'e1' });
      await engine.monitor({ gate: 'lint', passed: false, error: 'e2' });
      await engine.rollback('cp-1');

      const stats = await engine.getStats();
      expect(stats.totalAttempts).toBe(3);
      expect(stats.successful).toBe(2);
      expect(stats.failed).toBe(1);
    });

    it('tracks byType correctly', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('lint', async () => true);

      await engine.monitor({ gate: 'lint', passed: false, error: 'e' });
      await engine.rollback('cp-1');
      await engine.monitor({ gate: 'unknown', passed: false, error: 'e' });

      const stats = await engine.getStats();
      expect(stats.byType['auto-fix']).toBe(1);
      expect(stats.byType.rollback).toBe(1);
      expect(stats.byType.alert).toBe(1);
    });
  });

  describe('registerFixPattern', () => {
    it('registers a new pattern', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('security', async () => true);

      const result = await engine.autoFix('security', {});
      expect(result).toBe(true);
    });

    it('overwrites existing pattern', async () => {
      const engine = new SelfHealingEngine();
      engine.registerFixPattern('lint', async () => false);
      engine.registerFixPattern('lint', async () => true);

      const result = await engine.autoFix('lint', {});
      expect(result).toBe(true);
    });
  });
});
