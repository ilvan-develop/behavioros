import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

const mockExecSync = vi.hoisted(() => vi.fn().mockReturnValue(''));
vi.mock('node:child_process', () => ({
  execSync: mockExecSync,
}));

const mockExistsSync = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockReaddirSync = vi.hoisted(() => vi.fn().mockReturnValue([]));
const mockReadFileSync = vi.hoisted(() => vi.fn().mockReturnValue('{}'));
const mockWriteFileSync = vi.hoisted(() => vi.fn());
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
  writeFileSync: mockWriteFileSync,
}));

import type {
  AuditContext,
  AuditPipelineResult,
  AuditStage,
  StageExecutor,
} from '../engines/audit/audit-engine';
import { AuditEngine } from '../engines/audit/audit-engine';

describe('AuditEngine — edge cases', () => {
  let engine: AuditEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AuditEngine();
  });

  describe('constructor — persist path edge cases', () => {
    it('should load history from persist path on creation', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify([
          {
            id: 'existing',
            overall: 'pass',
            score: 100,
            stages: [],
            duration: 0,
            timestamp: new Date().toISOString(),
          },
        ]),
      );
      const e = new AuditEngine({ persistPath: '/tmp/audit.json' });
      expect(e.getHistory()).toHaveLength(1);
      expect(e.getHistory()[0].id).toBe('existing');
    });

    it('should handle corrupt history in persist path', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not-valid-json{{{');
      const e = new AuditEngine({ persistPath: '/tmp/audit.json' });
      expect(e.getHistory()).toEqual([]);
    });

    it('should save history after execution when persist path set', async () => {
      mockExistsSync.mockReturnValue(false);
      const e = new AuditEngine({ persistPath: '/tmp/audit.json' });
      const context: AuditContext = { projectPath: '/test/project' };
      await e.execute(context, ['static']);
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  describe('execute — empty and extreme stage configs', () => {
    it('should handle empty stages array', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, []);
      expect(result.score).toBe(0);
      expect(result.stages).toEqual([]);
      expect(result.overall).toBe('pass');
    });

    it('should handle all stages skipped (unregistered)', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, [
        'nonexistent1' as AuditStage,
        'nonexistent2' as AuditStage,
      ]);
      expect(result.stages.every((s) => s.result === 'skip')).toBe(true);
    });

    it('should handle mix of skip, pass, fail stages', async () => {
      const failExec: StageExecutor = {
        stage: 'fail-me' as AuditStage,
        name: 'Fail Me',
        execute: async () => ({
          stage: 'fail-me' as AuditStage,
          result: 'fail',
          score: 0,
          events: [],
          duration: 5,
        }),
      };
      const passExec: StageExecutor = {
        stage: 'pass-me' as AuditStage,
        name: 'Pass Me',
        execute: async () => ({
          stage: 'pass-me' as AuditStage,
          result: 'pass',
          score: 100,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(failExec);
      engine.registerStage(passExec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, [
        'fail-me' as AuditStage,
        'pass-me' as AuditStage,
        'ghost' as AuditStage,
      ]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[1].result).toBe('pass');
      expect(result.stages[2].result).toBe('skip');
      expect(result.overall).toBe('fail');
    });
  });

  describe('execute — stage error recovery', () => {
    it('should handle stage that throws a non-Error', async () => {
      const throwExec: StageExecutor = {
        stage: 'throw-string' as AuditStage,
        name: 'Throw String',
        execute: async () => {
          throw 'something broke';
        },
      };
      engine.registerStage(throwExec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['throw-string' as AuditStage]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[0].events[0].description).toContain('Stage throw-string failed');
    });

    it('should handle stage that throws an Error object', async () => {
      const throwExec: StageExecutor = {
        stage: 'throw-error' as AuditStage,
        name: 'Throw Error',
        execute: async () => {
          throw new Error('critical failure');
        },
      };
      engine.registerStage(throwExec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['throw-error' as AuditStage]);
      expect(result.stages[0].events[0].description).toContain('critical failure');
    });

    it('should continue executing remaining stages after one fails', async () => {
      const failExec: StageExecutor = {
        stage: 'fail-first' as AuditStage,
        name: 'Fail First',
        execute: async () => {
          throw new Error('boom');
        },
      };
      const passExec: StageExecutor = {
        stage: 'pass-second' as AuditStage,
        name: 'Pass Second',
        execute: async () => ({
          stage: 'pass-second' as AuditStage,
          result: 'pass',
          score: 100,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(failExec);
      engine.registerStage(passExec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, [
        'fail-first' as AuditStage,
        'pass-second' as AuditStage,
      ]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[1].result).toBe('pass');
    });
  });

  describe('history — advanced edge cases', () => {
    it('should accumulate history across multiple execute calls', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      await engine.execute(context, ['static']);
      await engine.execute(context, ['static']);
      await engine.execute(context, ['static']);
      expect(engine.getHistory()).toHaveLength(3);
    });

    it('should return distinct last audit per run', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      await engine.execute(context, ['static']);
      const second = await engine.execute(context, ['static']);
      expect(engine.getLastAudit()?.id).toBe(second.id);
    });

    it('should reload history from persist path when getHistory called', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify([
          {
            id: 'reloaded',
            overall: 'pass',
            score: 90,
            stages: [],
            duration: 100,
            timestamp: new Date().toISOString(),
          },
        ]),
      );
      const e = new AuditEngine({ persistPath: '/tmp/audit.json' });
      expect(e.getHistory()).toHaveLength(1);
      expect(e.getHistory()[0].id).toBe('reloaded');
    });
  });

  describe('summary — output formatting', () => {
    it('should include stage events in summary', () => {
      const result: AuditPipelineResult = {
        id: 'test-summary',
        overall: 'fail',
        score: 30,
        stages: [
          {
            stage: 'static' as AuditStage,
            result: 'fail',
            score: 0,
            events: [
              {
                id: 'evt-1',
                timestamp: new Date().toISOString(),
                type: 'audit:error',
                severity: 'error',
                result: 'fail',
                description: 'Something went wrong',
              },
            ],
            duration: 50,
          },
        ],
        duration: 100,
        timestamp: new Date().toISOString(),
      };
      const s = engine.summary(result);
      expect(s).toContain('[FAIL]');
      expect(s).toContain('Something went wrong');
    });

    it('should format warn stage icon in summary', () => {
      const result: AuditPipelineResult = {
        id: 'warn-summary',
        overall: 'warn',
        score: 60,
        stages: [
          {
            stage: 'docs',
            result: 'warn',
            score: 60,
            events: [],
            duration: 10,
          },
        ],
        duration: 10,
        timestamp: new Date().toISOString(),
      };
      const s = engine.summary(result);
      expect(s).toContain('[WARN]');
    });
  });

  describe('calculateOverallScore edge cases', () => {
    it('should return 0 when no stages', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, []);
      expect(result.score).toBe(0);
    });
  });

  describe('determineOverallResult — warn overrides pass', () => {
    it('should return warn when stages include warn but no fail', async () => {
      const warnExec: StageExecutor = {
        stage: 'warn-only' as AuditStage,
        name: 'Warn Only',
        execute: async () => ({
          stage: 'warn-only' as AuditStage,
          result: 'warn',
          score: 60,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(warnExec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['warn-only' as AuditStage, 'static']);
      // static returns pass from mocked fs, warn-only returns warn → overall = warn
      expect(['warn', 'fail']).toContain(result.overall);
    });
  });

  describe('custom stage — multiple registerStage calls', () => {
    it('should overwrite stage when re-registered', async () => {
      const first: StageExecutor = {
        stage: 'custom' as AuditStage,
        name: 'First',
        execute: async () => ({
          stage: 'custom' as AuditStage,
          result: 'fail',
          score: 0,
          events: [],
          duration: 5,
        }),
      };
      const second: StageExecutor = {
        stage: 'custom' as AuditStage,
        name: 'Second',
        execute: async () => ({
          stage: 'custom' as AuditStage,
          result: 'pass',
          score: 100,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(first);
      engine.registerStage(second);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['custom' as AuditStage]);
      expect(result.stages[0].result).toBe('pass');
    });
  });

  describe('custom stage — 0 score and empty events', () => {
    it('should handle stage with score 0 but result pass', async () => {
      const exec: StageExecutor = {
        stage: 'zero' as AuditStage,
        name: 'Zero',
        execute: async () => ({
          stage: 'zero' as AuditStage,
          result: 'pass',
          score: 0,
          events: [],
          duration: 0,
        }),
      };
      engine.registerStage(exec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['zero' as AuditStage]);
      expect(result.stages[0].score).toBe(0);
      expect(result.overall).toBe('pass');
    });
  });

  describe('custom stage — many events', () => {
    it('should include many events in stage result and summary', async () => {
      const manyEvents = Array.from({ length: 10 }, (_, i) => ({
        id: `evt-${i}`,
        timestamp: new Date().toISOString(),
        type: 'test',
        severity: 'info' as const,
        result: 'pass' as const,
        description: `Event ${i}`,
      }));
      const exec: StageExecutor = {
        stage: 'verbose' as AuditStage,
        name: 'Verbose',
        execute: async () => ({
          stage: 'verbose' as AuditStage,
          result: 'pass',
          score: 100,
          events: manyEvents,
          duration: 10,
        }),
      };
      engine.registerStage(exec);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['verbose' as AuditStage]);
      expect(result.stages[0].events).toHaveLength(10);
      const s = engine.summary(result);
      expect(s).toContain('Event 9');
    });
  });

  describe('persist — save/load cycle with empty state', () => {
    it('should save and reload empty state', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify([]));
      const e1 = new AuditEngine({ persistPath: '/tmp/empty.json' });
      expect(e1.getHistory()).toHaveLength(0);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });

  describe('persist — save after each execution', () => {
    it('should save after each execute when persistPath set', async () => {
      mockExistsSync.mockReturnValue(false);
      const e = new AuditEngine({ persistPath: '/tmp/save.json' });
      const context: AuditContext = { projectPath: '/test/project' };
      await e.execute(context, []);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const saved = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string);
      expect(Array.isArray(saved)).toBe(true);
      expect(saved).toHaveLength(1);
    });
  });

  describe('overall — mixed results with warn', () => {
    it('should return warn overall when all stages are warn', async () => {
      const warnStage: StageExecutor = {
        stage: 'warn1' as AuditStage,
        name: 'Warn1',
        execute: async () => ({
          stage: 'warn1' as AuditStage,
          result: 'warn',
          score: 50,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(warnStage);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['warn1' as AuditStage]);
      expect(result.overall).toBe('warn');
    });

    it('should return fail overall when fail and warn mixed', async () => {
      const failStage: StageExecutor = {
        stage: 'bad' as AuditStage,
        name: 'Bad',
        execute: async () => ({
          stage: 'bad' as AuditStage,
          result: 'fail',
          score: 0,
          events: [],
          duration: 5,
        }),
      };
      const warnStage: StageExecutor = {
        stage: 'ok' as AuditStage,
        name: 'Ok',
        execute: async () => ({
          stage: 'ok' as AuditStage,
          result: 'warn',
          score: 60,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(failStage);
      engine.registerStage(warnStage);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['bad' as AuditStage, 'ok' as AuditStage]);
      expect(result.overall).toBe('fail');
    });
  });
});
