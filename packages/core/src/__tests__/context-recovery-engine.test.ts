import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMkdir = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();

vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...(args as [string, object])),
  readFile: (...args: unknown[]) => mockReadFile(...(args as [string, string])),
  writeFile: (...args: unknown[]) => mockWriteFile(...(args as [string, string, string])),
}));

import type { RecoveryCheckpoint } from '../engines/recovery/context-recovery-engine';
import { ContextRecoveryEngine } from '../engines/recovery/context-recovery-engine';

function createCheckpoint(overrides: Partial<RecoveryCheckpoint> = {}): RecoveryCheckpoint {
  return {
    id: 'cp-test-001',
    timestamp: '2026-07-21T10:00:00.000Z',
    missionId: 'mission-1',
    phase: 'execution',
    coverage: 85,
    contextHash: 'ctx-abc123',
    state: { task: 'implement-feature', status: 'in-progress' },
    ...overrides,
  };
}

describe('ContextRecoveryEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createCheckpoint', () => {
    it('creates a checkpoint with correct fields', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const checkpoint = await engine.createCheckpoint('mission-1', 'execution', {
        task: 'build',
      });

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.missionId).toBe('mission-1');
      expect(checkpoint.phase).toBe('execution');
      expect(checkpoint.state).toEqual({ task: 'build' });
      expect(checkpoint.timestamp).toBeDefined();
      expect(checkpoint.contextHash).toMatch(/^ctx-/);
    });

    it('saves checkpoint to file', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      await engine.createCheckpoint('mission-1', 'planning', {});

      expect(mockWriteFile).toHaveBeenCalled();
      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toHaveLength(1);
      expect(written[0].phase).toBe('planning');
    });

    it('appends to existing checkpoints', async () => {
      const existing = [createCheckpoint({ id: 'cp-existing' })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const checkpoint = await engine.createCheckpoint('mission-2', 'review', {});

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toHaveLength(2);
      expect(written[0].id).toBe('cp-existing');
      expect(written[1].id).toBe(checkpoint.id);
    });

    it('computes coverage from state', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const checkpoint = await engine.createCheckpoint('m1', 'phase', {
        a: 'value',
        b: 'value',
        c: '',
      });

      expect(checkpoint.coverage).toBe(67);
    });
  });

  describe('checkpoint limit enforcement', () => {
    it('trims to maxCheckpoints when exceeded', async () => {
      const existing = Array.from({ length: 50 }, (_, i) =>
        createCheckpoint({ id: `cp-${i}`, phase: `phase-${i}` }),
      );
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({
        basePath: '/project/.behavioros',
        maxCheckpoints: 50,
      });
      await engine.createCheckpoint('mission-1', 'new-phase', {});

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toHaveLength(50);
      expect(written[0].id).toBe('cp-1');
      expect(written[49].phase).toBe('new-phase');
    });

    it('respects custom maxCheckpoints', async () => {
      const existing = [createCheckpoint({ id: 'cp-1' }), createCheckpoint({ id: 'cp-2' })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({
        basePath: '/project/.behavioros',
        maxCheckpoints: 2,
      });
      await engine.createCheckpoint('m', 'p', {});

      const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
      expect(written).toHaveLength(2);
    });
  });

  describe('detectContextLoss', () => {
    it('returns none when no previous checkpoint exists', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.detectContextLoss(80);

      expect(result.lost).toBe(false);
      expect(result.severity).toBe('none');
    });

    it('detects minor loss (drop < 20%)', async () => {
      const existing = [createCheckpoint({ coverage: 85 })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.detectContextLoss(75);

      expect(result.lost).toBe(true);
      expect(result.severity).toBe('minor');
      expect(result.reason).toContain('10%');
    });

    it('detects major loss (drop >= 20%)', async () => {
      const existing = [createCheckpoint({ coverage: 90 })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.detectContextLoss(60);

      expect(result.lost).toBe(true);
      expect(result.severity).toBe('major');
    });

    it('detects critical loss (drop >= 50%)', async () => {
      const existing = [createCheckpoint({ coverage: 95 })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.detectContextLoss(30);

      expect(result.lost).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.reason).toContain('critical');
    });

    it('returns none when coverage is stable', async () => {
      const existing = [createCheckpoint({ coverage: 80 })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.detectContextLoss(80);

      expect(result.lost).toBe(false);
      expect(result.severity).toBe('none');
    });

    it('returns none when coverage improved', async () => {
      const existing = [createCheckpoint({ coverage: 60 })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.detectContextLoss(85);

      expect(result.lost).toBe(false);
    });

    it('uses provided checkpoint when given', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const provided = createCheckpoint({ coverage: 90 });
      const result = await engine.detectContextLoss(50, provided);

      expect(result.lost).toBe(true);
      expect(result.severity).toBe('major');
    });
  });

  describe('rebuildContext', () => {
    it('returns failure when no checkpoints exist', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.rebuildContext();

      expect(result.success).toBe(false);
      expect(result.restoredFrom).toBe('none');
      expect(result.actions).toContain('No checkpoint found to rebuild from');
    });

    it('rebuilds from latest checkpoint', async () => {
      const existing = [
        createCheckpoint({ id: 'cp-old', coverage: 70, state: { task: 'old' } }),
        createCheckpoint({ id: 'cp-new', coverage: 90, state: { task: 'new', extra: 'data' } }),
      ];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));
      mockReadFile.mockImplementationOnce(async (filePath: string) => {
        if (filePath.includes('recovery-checkpoints')) {
          return JSON.stringify(existing);
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.rebuildContext();

      expect(result.success).toBe(true);
      expect(result.restoredFrom).toBe('cp-new');
      expect(result.actions.some((a) => a.includes('cp-new'))).toBe(true);
    });

    it('includes memory file reading in actions', async () => {
      const existing = [createCheckpoint({ coverage: 80, state: { a: 1 } })];
      let callCount = 0;
      mockReadFile.mockImplementation(async (filePath: string) => {
        if (filePath.includes('recovery-checkpoints')) {
          return JSON.stringify(existing);
        }
        callCount++;
        if (filePath.includes('memory.md') && callCount === 1) {
          return '## mem-key\n- value\n';
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.rebuildContext();

      expect(result.actions.some((a) => a.includes('memory file(s)'))).toBe(true);
    });
  });

  describe('validateRecovery', () => {
    it('validates successful recovery', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.validateRecovery({
        success: true,
        restoredFrom: 'cp-1',
        checkpoints: [],
        actions: ['restored state'],
        coverageAfter: 85,
      });

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('flags failed recovery', async () => {
      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.validateRecovery({
        success: false,
        restoredFrom: 'none',
        checkpoints: [],
        actions: [],
        coverageAfter: 10,
      });

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.includes('failure'))).toBe(true);
    });

    it('flags low post-recovery coverage', async () => {
      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.validateRecovery({
        success: true,
        restoredFrom: 'cp-1',
        checkpoints: [],
        actions: ['restored'],
        coverageAfter: 30,
      });

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('too low'))).toBe(true);
    });

    it('flags empty actions', async () => {
      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const result = await engine.validateRecovery({
        success: true,
        restoredFrom: 'cp-1',
        checkpoints: [],
        actions: [],
        coverageAfter: 80,
      });

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('No recovery actions'))).toBe(true);
    });
  });

  describe('getCheckpoints / getLatestCheckpoint', () => {
    it('returns empty array when no checkpoints exist', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const checkpoints = await engine.getCheckpoints();

      expect(checkpoints).toEqual([]);
    });

    it('returns all checkpoints', async () => {
      const existing = [createCheckpoint({ id: 'cp-1' }), createCheckpoint({ id: 'cp-2' })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const checkpoints = await engine.getCheckpoints();

      expect(checkpoints).toHaveLength(2);
    });

    it('getLatestCheckpoint returns last checkpoint', async () => {
      const existing = [createCheckpoint({ id: 'cp-1' }), createCheckpoint({ id: 'cp-2' })];
      mockReadFile.mockResolvedValue(JSON.stringify(existing));

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const latest = await engine.getLatestCheckpoint();

      expect(latest?.id).toBe('cp-2');
    });

    it('getLatestCheckpoint returns null when no checkpoints', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      const latest = await engine.getLatestCheckpoint();

      expect(latest).toBeNull();
    });
  });

  describe('directory creation', () => {
    it('creates .behavioros directory if missing', async () => {
      mockReadFile.mockResolvedValue('[]');

      const engine = new ContextRecoveryEngine({ basePath: '/project/.behavioros' });
      await engine.createCheckpoint('m', 'p', {});

      expect(mockMkdir).toHaveBeenCalledWith('/project/.behavioros', { recursive: true });
    });
  });
});
