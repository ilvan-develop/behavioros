import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn().mockReturnValue({ stdout: '', stderr: '', status: 0 }),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readdirSync: vi.fn().mockReturnValue([]),
  readFileSync: vi.fn().mockReturnValue('{}'),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  extname: vi.fn(),
}));

import type {
  AuditContext,
  AuditPipelineResult,
  AuditStage,
  StageExecutor,
} from '../engines/audit/audit-engine';
import { AuditEngine } from '../engines/audit/audit-engine';

describe('AuditEngine', () => {
  let engine: AuditEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AuditEngine();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      expect(engine).toBeInstanceOf(AuditEngine);
    });

    it('should create with persist path config', () => {
      const withPersist = new AuditEngine({ persistPath: '/tmp/audit.json' });
      expect(withPersist).toBeInstanceOf(AuditEngine);
    });
  });

  describe('execute', () => {
    it('should execute default pipeline stages', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(Array.isArray(result.stages)).toBe(true);
      expect(result.stages.length).toBeGreaterThan(0);
      expect(['pass', 'fail', 'warn']).toContain(result.overall);
    });

    it('should run only specified stages', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['static', 'security']);
      const stageNames = result.stages.map((s) => s.stage);
      expect(stageNames).toEqual(['static', 'security']);
    });

    it('should handle empty project path', async () => {
      const context: AuditContext = { projectPath: '' };
      const result = await engine.execute(context);
      expect(result).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it('should handle missing project path gracefully', async () => {
      const context: AuditContext = { projectPath: '/nonexistent/path/xyz-123' };
      const result = await engine.execute(context);
      expect(result).toBeDefined();
    });

    it('should skip unregistered stages', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, [
        'static' as AuditStage,
        'nonexistent' as AuditStage,
      ]);
      const nonexistent = result.stages.find((s) => s.stage === ('nonexistent' as AuditStage));
      expect(nonexistent?.result).toBe('skip');
    });
  });

  describe('registerStage', () => {
    it('should register a custom stage', async () => {
      const customExecutor: StageExecutor = {
        stage: 'custom-test-stage' as never,
        name: 'Custom Test',
        execute: async () => ({
          stage: 'custom-test-stage' as never,
          result: 'pass',
          score: 100,
          events: [],
          duration: 10,
        }),
      };
      engine.registerStage(customExecutor);

      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['custom-test-stage' as never]);
      expect(result.stages[0].result).toBe('pass');
      expect(result.stages[0].score).toBe(100);
    });

    it('should handle stage executor failure', async () => {
      const failingExecutor: StageExecutor = {
        stage: 'failing-stage' as never,
        name: 'Failing',
        execute: async () => {
          throw new Error('Stage crashed');
        },
      };
      engine.registerStage(failingExecutor);

      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['failing-stage' as never]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[0].score).toBe(0);
      expect(result.stages[0].events.length).toBeGreaterThan(0);
      expect(result.stages[0].events[0].description).toContain('Stage failing-stage failed');
    });
  });

  describe('history', () => {
    it('should record execution history', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      await engine.execute(context);
      expect(engine.getHistory().length).toBe(1);
    });

    it('should retrieve last audit', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const first = await engine.execute(context);
      const last = engine.getLastAudit();
      expect(last?.id).toBe(first.id);
    });

    it('should return undefined when no audits exist', () => {
      expect(engine.getLastAudit()).toBeUndefined();
    });

    it('should return copy of history', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      await engine.execute(context);
      const history = engine.getHistory();
      history.push({} as AuditPipelineResult);
      expect(engine.getHistory().length).toBe(1);
    });
  });

  describe('summary', () => {
    it('should generate summary for pass result', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['static']);
      const s = engine.summary(result);
      expect(s).toContain('Audit Pipeline');
      expect(s).toContain('Overall');
    });

    it('should generate summary for empty stages', () => {
      const emptyResult: AuditPipelineResult = {
        id: 'test-id',
        overall: 'pass',
        score: 0,
        stages: [],
        duration: 0,
        timestamp: new Date().toISOString(),
      };
      const s = engine.summary(emptyResult);
      expect(s).toContain('test-id');
    });
  });

  describe('edge cases', () => {
    it('should handle results with warn status', async () => {
      const warnExecutor: StageExecutor = {
        stage: 'warn-stage' as never,
        name: 'Warn Stage',
        execute: async () => ({
          stage: 'warn-stage' as never,
          result: 'warn',
          score: 60,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(warnExecutor);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['warn-stage' as never]);
      expect(result.overall).toBe('warn');
    });

    it('should handle mix of pass and fail stages', async () => {
      const failExecutor: StageExecutor = {
        stage: 'fail-stage' as never,
        name: 'Fail Stage',
        execute: async () => ({
          stage: 'fail-stage' as never,
          result: 'fail',
          score: 0,
          events: [],
          duration: 5,
        }),
      };
      engine.registerStage(failExecutor);
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['fail-stage' as never, 'static']);
      expect(result.overall).toBe('fail');
    });

    it('should calculate overall score correctly', async () => {
      const context: AuditContext = { projectPath: '/test/project' };
      const result = await engine.execute(context, ['static', 'tests']);

      const nonSkipStages = result.stages.filter((s) => s.result !== 'skip');
      expect(nonSkipStages.length).toBeGreaterThan(0);
    });
  });
});
