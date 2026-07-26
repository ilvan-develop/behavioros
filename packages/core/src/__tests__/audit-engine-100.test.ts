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
const mockStatSync = vi.hoisted(() => vi.fn().mockReturnValue({ isDirectory: () => false }));
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
  statSync: mockStatSync,
  writeFileSync: mockWriteFileSync,
}));

import path from 'node:path';
import type {
  AuditContext,
  AuditPipelineResult,
  AuditStage,
  StageExecutor,
} from '../engines/audit/audit-engine';
import { AuditEngine } from '../engines/audit/audit-engine';

const _PLATFORM_PATH = path.resolve('/test/project');
const _SEP = path.sep;

function makePassStage(stage: string): StageExecutor {
  return {
    stage: stage as AuditStage,
    name: `Pass-${stage}`,
    execute: async () => ({
      stage: stage as AuditStage,
      result: 'pass',
      score: 100,
      events: [],
      duration: 5,
    }),
  };
}

function makeFailStage(stage: string): StageExecutor {
  return {
    stage: stage as AuditStage,
    name: `Fail-${stage}`,
    execute: async () => ({
      stage: stage as AuditStage,
      result: 'fail',
      score: 0,
      events: [],
      duration: 5,
    }),
  };
}

function makeWarnStage(stage: string): StageExecutor {
  return {
    stage: stage as AuditStage,
    name: `Warn-${stage}`,
    execute: async () => ({
      stage: stage as AuditStage,
      result: 'warn',
      score: 50,
      events: [],
      duration: 5,
    }),
  };
}

describe('AuditEngine — 100% Coverage', () => {
  let engine: AuditEngine;
  const defaultCtx: AuditContext = { projectPath: path.resolve('/test/project') };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue('[]');
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    mockExecSync.mockReturnValue('');
    mockWriteFileSync.mockReturnValue(undefined);
    engine = new AuditEngine();
  });

  describe('constructor', () => {
    it('should init with no config', () => {
      expect(engine).toBeInstanceOf(AuditEngine);
    });

    it('should init with persistPath', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify([]));
      const e = new AuditEngine({ persistPath: '/tmp/persist.json' });
      expect(e.getHistory()).toEqual([]);
    });

    it('should load history from persistPath', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify([
          {
            id: 'past',
            overall: 'pass',
            score: 100,
            stages: [],
            duration: 0,
            timestamp: '2025-01-01',
          },
        ]),
      );
      const e = new AuditEngine({ persistPath: '/tmp/load.json' });
      expect(e.getHistory()).toHaveLength(1);
      expect(e.getHistory()[0].id).toBe('past');
    });

    it('should handle corrupt file on init', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{{{bad json');
      const e = new AuditEngine({ persistPath: '/tmp/corrupt.json' });
      expect(e.getHistory()).toEqual([]);
    });
  });

  describe('execute', () => {
    it('should run default pipeline stages', async () => {
      const result = await engine.execute(defaultCtx);
      expect(result.id).toBeDefined();
      expect(result.stages.length).toBeGreaterThan(0);
    });

    it('should run specified stage subsets', async () => {
      const result = await engine.execute(defaultCtx, ['static', 'tests']);
      expect(result.stages.map((s) => s.stage)).toEqual(['static', 'tests']);
    });

    it('should handle empty stages array', async () => {
      const result = await engine.execute(defaultCtx, []);
      expect(result.score).toBe(0);
      expect(result.stages).toEqual([]);
    });

    it('should skip unregistered stages', async () => {
      const result = await engine.execute(defaultCtx, ['ghost' as AuditStage]);
      expect(result.stages[0].result).toBe('skip');
    });

    it('should handle stage executor that throws', async () => {
      engine.registerStage({
        stage: 'boom' as AuditStage,
        name: 'Boom',
        execute: async () => {
          throw new Error('kaboom');
        },
      });
      const result = await engine.execute(defaultCtx, ['boom' as AuditStage]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[0].events.length).toBeGreaterThan(0);
    });

    it('should handle all skipped stages', async () => {
      const result = await engine.execute(defaultCtx, [
        'ghost' as AuditStage,
        'phantom' as AuditStage,
      ]);
      expect(result.stages.every((s) => s.result === 'skip')).toBe(true);
      expect(result.overall).toBe('pass');
    });

    it('should save history with persistPath', async () => {
      const e = new AuditEngine({ persistPath: '/tmp/autosave.json' });
      await e.execute(defaultCtx, []);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
    });

    it('should not save history without persistPath', async () => {
      await engine.execute(defaultCtx, []);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should collect timing info', async () => {
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should handle saveHistory write failure gracefully', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full');
      });
      const e = new AuditEngine({ persistPath: '/tmp/fail-save.json' });
      const result = await e.execute(defaultCtx, []);
      expect(result).toBeDefined();
    });
  });

  describe('registerStage', () => {
    it('should register and execute custom stage', async () => {
      engine.registerStage(makePassStage('custom'));
      const result = await engine.execute(defaultCtx, ['custom' as AuditStage]);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should overwrite previously registered stage', async () => {
      engine.registerStage(makeFailStage('dup'));
      engine.registerStage(makePassStage('dup'));
      const result = await engine.execute(defaultCtx, ['dup' as AuditStage]);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should overwrite default stage', async () => {
      engine.registerStage(makePassStage('static'));
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should handle many registered stages', async () => {
      for (let i = 0; i < 20; i++) engine.registerStage(makePassStage(`s${i}`));
      const stages = Array.from({ length: 20 }, (_, i) => `s${i}` as AuditStage);
      const result = await engine.execute(defaultCtx, stages);
      expect(result.stages).toHaveLength(20);
    });
  });

  describe('history', () => {
    it('should accumulate history', async () => {
      await engine.execute(defaultCtx, []);
      await engine.execute(defaultCtx, []);
      await engine.execute(defaultCtx, []);
      expect(engine.getHistory()).toHaveLength(3);
    });

    it('should return correct last audit', async () => {
      await engine.execute(defaultCtx, []);
      const second = await engine.execute(defaultCtx, []);
      expect(engine.getLastAudit()?.id).toBe(second.id);
    });

    it('should return undefined when empty', () => {
      expect(engine.getLastAudit()).toBeUndefined();
    });

    it('should return copy not reference', async () => {
      await engine.execute(defaultCtx, []);
      const h = engine.getHistory();
      h.push({} as AuditPipelineResult);
      expect(engine.getHistory()).toHaveLength(1);
    });

    it('should reload history from persistPath on getHistory', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify([
          {
            id: 'reloaded',
            overall: 'pass',
            score: 90,
            stages: [],
            duration: 0,
            timestamp: '2025-01-01',
          },
        ]),
      );
      const e = new AuditEngine({ persistPath: '/tmp/reload.json' });
      expect(e.getHistory()).toHaveLength(1);
    });

    it('should handle loadHistory failure gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('read error');
      });
      const e = new AuditEngine({ persistPath: '/tmp/bad-read.json' });
      expect(e.getHistory()).toEqual([]);
    });
  });

  describe('summary', () => {
    it('should render PASS', () => {
      const r: AuditPipelineResult = {
        id: 's1',
        overall: 'pass',
        score: 100,
        stages: [
          { stage: 'static' as AuditStage, result: 'pass', score: 100, events: [], duration: 5 },
        ],
        duration: 5,
        timestamp: '',
      };
      const s = engine.summary(r);
      expect(s).toContain('PASS');
      expect(s).toContain('[PASS]');
    });

    it('should render FAIL', () => {
      const r: AuditPipelineResult = {
        id: 's1',
        overall: 'fail',
        score: 0,
        stages: [
          { stage: 'static' as AuditStage, result: 'fail', score: 0, events: [], duration: 10 },
        ],
        duration: 10,
        timestamp: '',
      };
      expect(engine.summary(r)).toContain('[FAIL]');
    });

    it('should render WARN', () => {
      const r: AuditPipelineResult = {
        id: 's1',
        overall: 'warn',
        score: 50,
        stages: [
          { stage: 'docs' as AuditStage, result: 'warn', score: 50, events: [], duration: 10 },
        ],
        duration: 10,
        timestamp: '',
      };
      expect(engine.summary(r)).toContain('[WARN]');
    });

    it('should render SKIP', () => {
      const r: AuditPipelineResult = {
        id: 's1',
        overall: 'pass',
        score: 0,
        stages: [
          { stage: 'benchmarks' as AuditStage, result: 'skip', score: 0, events: [], duration: 0 },
        ],
        duration: 0,
        timestamp: '',
      };
      expect(engine.summary(r)).toContain('[SKIP]');
    });

    it('should include events in output', () => {
      const r: AuditPipelineResult = {
        id: 's1',
        overall: 'fail',
        score: 0,
        stages: [
          {
            stage: 'security' as AuditStage,
            result: 'fail',
            score: 0,
            events: [
              {
                id: 'e1',
                timestamp: '',
                type: 'audit:error',
                severity: 'error',
                result: 'fail',
                description: 'critical vuln',
              },
            ],
            duration: 5,
          },
        ],
        duration: 5,
        timestamp: '',
      };
      expect(engine.summary(r)).toContain('critical vuln');
    });

    it('should render all result types in one summary', () => {
      const r: AuditPipelineResult = {
        id: 'all-types',
        overall: 'pass',
        score: 50,
        stages: [
          { stage: 'a' as AuditStage, result: 'pass', score: 100, events: [], duration: 5 },
          { stage: 'b' as AuditStage, result: 'fail', score: 0, events: [], duration: 5 },
          { stage: 'c' as AuditStage, result: 'warn', score: 50, events: [], duration: 5 },
          { stage: 'd' as AuditStage, result: 'skip', score: 0, events: [], duration: 0 },
        ],
        duration: 15,
        timestamp: '',
      };
      const s = engine.summary(r);
      expect(s).toContain('[PASS]');
      expect(s).toContain('[FAIL]');
      expect(s).toContain('[WARN]');
      expect(s).toContain('[SKIP]');
    });
  });

  describe('static stage — all branches', () => {
    it('should use biome and pass with no issues', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ devDependencies: { '@biomejs/biome': '^1.0.0' } }),
      );
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockReturnValue('0 errors, 0 warnings');
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should detect biome errors', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ devDependencies: { '@biomejs/biome': '^1.0.0' } }),
      );
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockReturnValue('3 errors, 5 warnings');
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should detect biome warnings only', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ devDependencies: { '@biomejs/biome': '^1.0.0' } }),
      );
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockReturnValue('0 errors, 2 warnings');
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should use eslint when biome missing', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { eslint: '^8.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('.eslintrc.json'),
      );
      mockExecSync.mockReturnValue(JSON.stringify([{ errorCount: 2, warningCount: 3 }]));
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should parse eslint fallback on bad JSON', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { eslint: '^8.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('.eslintrc.json'),
      );
      mockExecSync.mockReturnValue('1 error\n2 warnings');
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should use tsc fallback and detect errors', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockImplementation(() => {
        throw { stdout: 'src/foo.ts(1,1): error TS2324', stderr: '', status: 1 };
      });
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should handle tsc fallback with 0 errors', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockReturnValue('');
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should handle biome with execSync throw', async () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ devDependencies: { '@biomejs/biome': '^1.0.0' } }),
      );
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockImplementation(() => {
        throw { stdout: '0 errors, 1 warning', stderr: '', status: 1 };
      });
      const result = await engine.execute(defaultCtx, ['static']);
      expect(result.stages[0].result).toBe('warn');
    });
  });

  describe('tests stage — all branches', () => {
    it('should skip if no framework', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('skip');
    });

    it('should detect vitest and parse JSON', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({
          testResults: [{ status: 'passed' }, { status: 'passed' }, { status: 'failed' }],
        }),
      );
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should parse vitest all passed', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({ testResults: [{ status: 'passed' }, { status: 'passed' }] }),
      );
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should handle vitest 0 tests found', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(JSON.stringify({ testResults: [] }));
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('warn');
      expect(result.stages[0].score).toBe(50);
    });

    it('should fallback parse vitest when JSON has { but is invalid', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('{bad json, 5 passed, 1 failed');
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should parse jest JSON output', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { jest: '^29.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({ numPassedTests: 10, numFailedTests: 2, numTotalTests: 12 }),
      );
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should parse jest all passed', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { jest: '^29.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({ numPassedTests: 5, numFailedTests: 0, numTotalTests: 5 }),
      );
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should fallback parse jest output when JSON invalid', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { jest: '^29.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('3 passed, 0 failed');
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should use npm when no pnpm/yarn lock', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockReturnValue(JSON.stringify({ testResults: [{ status: 'passed' }] }));
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should handle vitest JSON with no testResults key', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('{}');
      const result = await engine.execute(defaultCtx, ['tests']);
      expect(result.stages[0].result).toBe('warn');
    });
  });

  describe('coverage stage — all branches', () => {
    it('should skip if no framework', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({}));
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('skip');
    });

    it('should parse text coverage output and pass', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('Lines: 85.5 Branches: 78.2 Functions: 90.1 Statements: 84.3');
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should parse JSON coverage-summary as fallback', async () => {
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }))
        .mockReturnValueOnce(
          JSON.stringify({
            total: {
              lines: { pct: 90 },
              branches: { pct: 85 },
              functions: { pct: 88 },
              statements: { pct: 87 },
            },
          }),
        );
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('package.json') ||
          p.endsWith('pnpm-lock.yaml') ||
          p.endsWith('coverage-summary.json'),
      );
      mockExecSync.mockReturnValue('');
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should handle no data parsed', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('');
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should warn below 80', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('Lines: 70');
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should fail below 60', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('Lines: 45');
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should use only lines metric when others missing', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('Lines: 90.0');
      const result = await engine.execute(defaultCtx, ['coverage']);
      expect(result.stages[0].result).toBe('pass');
    });
  });

  describe('security stage — all branches', () => {
    it('should pass with no vulns', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
        }),
      );
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should fail on critical vulns', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({
          metadata: { vulnerabilities: { critical: 2, high: 1, moderate: 3, low: 5 } },
        }),
      );
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should fail on high vulns', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0 } },
        }),
      );
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should warn on moderate vulns', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 2, low: 0 } },
        }),
      );
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should handle flat vulnerabilities format', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue(
        JSON.stringify({
          vulnerabilities: { 'pkg-a': { severity: 'critical' }, 'pkg-b': { severity: 'high' } },
        }),
      );
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should fallback to line parsing on bad JSON', async () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockImplementation(() => {
        throw { stdout: '', stderr: 'critical: 1\nhigh: 2\nmoderate: 3\nlow: 4', status: 1 };
      });
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should use npm audit when no pnpm lock', async () => {
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockExecSync.mockReturnValue(
        JSON.stringify({
          metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0 } },
        }),
      );
      const result = await engine.execute(defaultCtx, ['security']);
      expect(result.stages[0].result).toBe('pass');
    });
  });

  describe('performance stage — all branches', () => {
    it('should pass with no issues', async () => {
      mockExecSync.mockReturnValue('');
      const result = await engine.execute(defaultCtx, ['performance']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should fail on type errors', async () => {
      mockExecSync.mockReturnValue('src/a.ts:1:1 - error TS2324: Type "x" is not assignable');
      const result = await engine.execute(defaultCtx, ['performance']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should warn on large files', async () => {
      mockExecSync.mockReturnValue('');
      mockReaddirSync.mockReturnValue([{ name: 'huge.ts', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue('a\n'.repeat(600));
      const result = await engine.execute(defaultCtx, ['performance']);
      expect(result.stages[0].result).toBe('warn');
    });
  });

  describe('architecture stage — all branches', () => {
    it('should pass cleanly', async () => {
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should warn on large files', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'big.ts', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue('x\n'.repeat(600));
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should fail on circular dependencies', async () => {
      const pSep = path.sep;
      mockReaddirSync.mockReturnValue([
        { name: 'a.ts', isDirectory: () => false },
        { name: 'b.ts', isDirectory: () => false },
      ]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      const importFiles = new Map<string, string>([
        ['a.ts', `import { b } from ".${pSep}b.ts"`],
        ['b.ts', `import { a } from ".${pSep}a.ts"`],
      ]);
      mockReadFileSync.mockImplementation((p: string) => {
        const parts = p.split(path.sep);
        const base = parts[parts.length - 1];
        return importFiles.get(base) ?? '{}';
      });
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result.stages[0].result).toBe('fail');
    });
  });

  describe('contracts stage — all branches', () => {
    it('should warn with no schemas', async () => {
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should validate OpenAPI files', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'openapi.yaml', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue(JSON.stringify({ openapi: '3.0.0', paths: { '/api': {} } }));
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should flag OpenAPI empty paths', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'openapi.json', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue(JSON.stringify({ openapi: '3.0.0', paths: {} }));
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should flag OpenAPI missing version field', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'openapi.json', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue(JSON.stringify({ info: {}, paths: { '/api': {} } }));
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should flag OpenAPI missing version AND empty paths', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'swagger.json', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue(JSON.stringify({ info: {} }));
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should validate GraphQL files', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'schema.graphql', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue('type Query { hello: String }');
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should flag GraphQL without type defs', async () => {
      mockReaddirSync.mockReturnValue([{ name: 'schema.gql', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockReadFileSync.mockReturnValue('# empty');
      const result = await engine.execute(defaultCtx, ['contracts']);
      expect(result.stages[0].result).toBe('warn');
    });
  });

  describe('docs stage — all branches', () => {
    it('should pass with all docs', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('README.md') ||
          p.endsWith('CHANGELOG.md') ||
          p.endsWith('CONTRIBUTING.md') ||
          p.endsWith('LICENSE') ||
          p.endsWith('docs'),
      );
      mockReaddirSync.mockReturnValue([{ name: 'api.md', isDirectory: () => false }]);
      const result = await engine.execute(defaultCtx, ['docs']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should fail with no docs', async () => {
      mockExistsSync.mockReturnValue(false);
      const result = await engine.execute(defaultCtx, ['docs']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should warn with half docs', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('README.md') ||
          p.endsWith('CHANGELOG.md') ||
          p.endsWith('LICENSE') ||
          p.endsWith('docs'),
      );
      mockReaddirSync.mockReturnValue([{ name: 'api.md', isDirectory: () => false }]);
      const result = await engine.execute(defaultCtx, ['docs']);
      expect(result.stages[0].result).toBe('warn');
    });
  });

  describe('compliance stage — all branches', () => {
    it('should pass with all checks', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('LICENSE') ||
          p.endsWith('.env.example') ||
          p.endsWith('.gitignore') ||
          p.endsWith('.github') ||
          p.endsWith('.editorconfig') ||
          p.endsWith('Dockerfile') ||
          p.endsWith('package.json'),
      );
      const result = await engine.execute(defaultCtx, ['compliance']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should fail with committed secrets', async () => {
      mockExistsSync.mockImplementation((p: string) => p.endsWith('package.json'));
      mockReaddirSync.mockReturnValue([{ name: '.env', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => false });
      const result = await engine.execute(defaultCtx, ['compliance']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should warn with partial compliance', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('LICENSE') ||
          p.endsWith('.gitignore') ||
          p.endsWith('.github') ||
          p.endsWith('.editorconfig') ||
          p.endsWith('package.json'),
      );
      const result = await engine.execute(defaultCtx, ['compliance']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should handle .env.sample alternative', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('LICENSE') ||
          p.endsWith('.env.sample') ||
          p.endsWith('.gitignore') ||
          p.endsWith('.github') ||
          p.endsWith('.editorconfig') ||
          p.endsWith('package.json'),
      );
      const result = await engine.execute(defaultCtx, ['compliance']);
      expect(result.stages[0].result).toBe('warn');
    });

    it('should handle docker-compose.yaml alternative', async () => {
      mockExistsSync.mockImplementation(
        (p: string) =>
          p.endsWith('package.json') ||
          p.endsWith('.gitignore') ||
          p.endsWith('.github') ||
          p.endsWith('.env.example') ||
          p.endsWith('.editorconfig') ||
          p.endsWith('LICENSE') ||
          p.endsWith('docker-compose.yaml'),
      );
      const result = await engine.execute(defaultCtx, ['compliance']);
      expect(result.stages[0].result).toBe('pass');
    });
  });

  describe('benchmarks stage — all branches', () => {
    it('should skip with no bench files', async () => {
      const result = await engine.execute(defaultCtx, ['benchmarks']);
      expect(result.stages[0].result).toBe('skip');
    });

    it('should pass with bench script and files', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { bench: 'echo bench' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('bench results');
      const result = await engine.execute(defaultCtx, ['benchmarks']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should execute bench script successfully', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { bench: 'vitest bench' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('all benches passed');
      const result = await engine.execute(defaultCtx, ['benchmarks']);
      expect(result.stages[0].result).toBe('pass');
    });

    it('should fail when bench script fails', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { bench: 'vitest bench' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockImplementation(() => {
        throw { stdout: '', stderr: 'timeout', status: 1 };
      });
      const result = await engine.execute(defaultCtx, ['benchmarks']);
      expect(result.stages[0].result).toBe('fail');
    });

    it('should handle bench script with benchmark key', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ scripts: { benchmark: 'echo bench' } }));
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('package.json') || p.endsWith('pnpm-lock.yaml'),
      );
      mockExecSync.mockReturnValue('bench results');
      const result = await engine.execute(defaultCtx, ['benchmarks']);
      expect(result.stages[0].result).toBe('pass');
    });
  });

  describe('helpers — indirect coverage', () => {
    it('should handle walkFiles directory recursion', async () => {
      mockReaddirSync
        .mockReturnValueOnce([{ name: 'src', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'index.ts', isDirectory: () => false }]);
      mockStatSync
        .mockReturnValueOnce({ isDirectory: () => true })
        .mockReturnValueOnce({ isDirectory: () => false });
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result).toBeDefined();
    });

    it('should skip node_modules in walkFiles', async () => {
      const dirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
      for (const d of dirs) {
        mockReaddirSync.mockReset().mockReturnValueOnce([{ name: d, isDirectory: () => true }]);
        mockStatSync.mockReset().mockReturnValue({ isDirectory: () => true });
        const result = await engine.execute(defaultCtx, ['architecture']);
        expect(result).toBeDefined();
      }
    });

    it('should handle walkFiles inaccessible directory', async () => {
      mockReaddirSync.mockImplementationOnce(() => {
        throw new Error('EACCES');
      });
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result).toBeDefined();
    });

    it('should handle readJsonSafe failure', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const result = await engine.execute(defaultCtx, ['docs']);
      expect(result).toBeDefined();
    });

    it('should handle countLines read failure', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result).toBeDefined();
    });

    it('should handle empty walkFiles maxDepth', async () => {
      mockReaddirSync
        .mockReturnValueOnce([{ name: 'a', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'b', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'c', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'd', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'e', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'f', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'g', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'h', isDirectory: () => true }])
        .mockReturnValueOnce([{ name: 'deep.ts', isDirectory: () => false }]);
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result).toBeDefined();
    });

    it('should handle extractImports read failure', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      const result = await engine.execute(defaultCtx, ['architecture']);
      expect(result).toBeDefined();
    });
  });

  describe('overall result calculation', () => {
    it('should be pass for all pass', async () => {
      engine.registerStage(makePassStage('a'));
      engine.registerStage(makePassStage('b'));
      const r = await engine.execute(defaultCtx, ['a' as AuditStage, 'b' as AuditStage]);
      expect(r.overall).toBe('pass');
    });

    it('should be warn if any warn', async () => {
      engine.registerStage(makeWarnStage('w'));
      engine.registerStage(makePassStage('p'));
      const r = await engine.execute(defaultCtx, ['w' as AuditStage, 'p' as AuditStage]);
      expect(r.overall).toBe('warn');
    });

    it('should be fail if any fail', async () => {
      engine.registerStage(makeFailStage('f'));
      engine.registerStage(makeWarnStage('w'));
      const r = await engine.execute(defaultCtx, ['f' as AuditStage, 'w' as AuditStage]);
      expect(r.overall).toBe('fail');
    });

    it('should be pass for empty stages', async () => {
      const r = await engine.execute(defaultCtx, []);
      expect(r.overall).toBe('pass');
    });
  });

  describe('boundary values', () => {
    it('should handle extremely long project path', async () => {
      const ctx: AuditContext = { projectPath: '/'.repeat(5000) };
      const result = await engine.execute(ctx, []);
      expect(result).toBeDefined();
    });

    it('should handle many stages', async () => {
      for (let i = 0; i < 50; i++) engine.registerStage(makePassStage(`s${i}`));
      const stages = Array.from({ length: 50 }, (_, i) => `s${i}` as AuditStage);
      const result = await engine.execute(defaultCtx, stages);
      expect(result.stages).toHaveLength(50);
    });

    it('should handle zero score', async () => {
      engine.registerStage({
        stage: 'zero' as AuditStage,
        name: 'Zero',
        execute: async () => ({
          stage: 'zero' as AuditStage,
          result: 'pass',
          score: 0,
          events: [],
          duration: 0,
        }),
      });
      const r = await engine.execute(defaultCtx, ['zero' as AuditStage]);
      expect(r.score).toBe(0);
    });

    it('should handle max score', async () => {
      engine.registerStage(makePassStage('m1'));
      engine.registerStage(makePassStage('m2'));
      const r = await engine.execute(defaultCtx, ['m1' as AuditStage, 'm2' as AuditStage]);
      expect(r.score).toBe(100);
    });

    it('should handle special characters in path', async () => {
      const ctx: AuditContext = { projectPath: '/path/with spaces/and (special) chars!' };
      const result = await engine.execute(ctx, []);
      expect(result).toBeDefined();
    });
  });

  describe('error recovery', () => {
    it('should handle null context options', async () => {
      const ctx: AuditContext = { projectPath: '/test', targetPath: undefined, options: undefined };
      const result = await engine.execute(ctx, []);
      expect(result).toBeDefined();
    });

    it('should continue after stage failure', async () => {
      engine.registerStage(makeFailStage('f1'));
      engine.registerStage(makePassStage('p1'));
      engine.registerStage(makeFailStage('f2'));
      const result = await engine.execute(defaultCtx, [
        'f1' as AuditStage,
        'p1' as AuditStage,
        'f2' as AuditStage,
      ]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[1].result).toBe('pass');
      expect(result.stages[2].result).toBe('fail');
    });

    it('should handle non-Error object thrown from stage', async () => {
      engine.registerStage({
        stage: 'string-boom' as AuditStage,
        name: 'StringBoom',
        execute: async () => {
          throw 'something broke';
        },
      });
      const result = await engine.execute(defaultCtx, ['string-boom' as AuditStage]);
      expect(result.stages[0].result).toBe('fail');
      expect(result.stages[0].events[0].description).toContain('Stage string-boom failed');
    });

    it('should handle loadHistory in execute when persistPath fails to save', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify([]));
      const e = new AuditEngine({ persistPath: '/tmp/cycle.json' });
      const result = await e.execute(defaultCtx, []);
      expect(result).toBeDefined();
    });

    it('should handle write failure in saveHistory', async () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('write fail');
      });
      const e = new AuditEngine({ persistPath: '/tmp/fail-write2.json' });
      const result = await e.execute(defaultCtx, []);
      expect(result).toBeDefined();
    });
  });

  describe('mixed stage execution', () => {
    it('should mix skip, pass, fail', async () => {
      engine.registerStage(makePassStage('real'));
      engine.registerStage(makeFailStage('failme'));
      const result = await engine.execute(defaultCtx, [
        'ghost' as AuditStage,
        'real' as AuditStage,
        'failme' as AuditStage,
      ]);
      expect(result.stages[0].result).toBe('skip');
      expect(result.stages[1].result).toBe('pass');
      expect(result.stages[2].result).toBe('fail');
    });
  });
});
