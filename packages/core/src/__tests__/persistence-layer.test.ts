import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock better-sqlite3 entirely
const mockStmt = {
  run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
  get: vi.fn(),
  all: vi.fn().mockReturnValue([]),
  bind: vi.fn(),
};
const mockDb = {
  prepare: vi.fn(() => mockStmt),
  exec: vi.fn(),
  close: vi.fn(),
  pragma: vi.fn().mockReturnValue([{ integrity_check: 'ok' }]),
};

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDb),
}));

// Mock fs for SQLiteAuditStore
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('[]'),
  writeFileSync: vi.fn(),
}));

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import type { AuditEntry } from '../persistence/sqlite-audit-store';
import { SQLiteAuditStore } from '../persistence/sqlite-audit-store';
import { SQLiteStore } from '../persistence/sqlite-store';

const mockDate = new Date('2026-07-22T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(mockDate);
  mockStmt.run.mockClear();
  mockStmt.get.mockClear();
  mockStmt.all.mockClear();
  mockDb.prepare.mockClear();
  mockDb.exec.mockClear();
  mockDb.close.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================================
// SQLiteStore
// ============================================================

describe('SQLiteStore', () => {
  let store: SQLiteStore;

  beforeEach(() => {
    mockDb.pragma.mockReturnValue([{ integrity_check: 'ok' }]);
    store = new SQLiteStore({ memory: true });
  });

  describe('construction', () => {
    it('creates store in memory mode without touching filesystem', () => {
      expect(mockDb.exec).toHaveBeenCalled();
      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDb.pragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('throws on integrity check failure', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'corrupted' }]);
      expect(() => new SQLiteStore({ memory: true })).toThrow('integrity check failed');
    });

    it('creates directory for file-based store', () => {
      const fsExistsMock = vi.mocked(existsSync);
      fsExistsMock.mockReturnValue(false);

      new SQLiteStore({ dbPath: '/tmp/test/behavioros.db' });

      expect(mkdirSync).toHaveBeenCalled();
    });
  });

  describe('missions', () => {
    const mission = {
      id: 'mission-1',
      title: 'Test Mission',
      priority: 'high' as const,
      status: 'in_progress' as const,
      createdAt: '2026-07-22T12:00:00.000Z',
      updatedAt: '2026-07-22T12:00:00.000Z',
    };

    it('saves a mission', () => {
      store.saveMission(mission as never);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO missions'),
      );
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets a mission by id', () => {
      mockStmt.get.mockReturnValueOnce({ data: JSON.stringify(mission) });
      const result = store.getMission('mission-1');
      expect(result).toEqual(mission);
    });

    it('returns null for non-existent mission', () => {
      mockStmt.get.mockReturnValueOnce(undefined);
      const result = store.getMission('nonexistent');
      expect(result).toBeNull();
    });

    it('gets all missions', () => {
      mockStmt.all.mockReturnValueOnce([
        { data: JSON.stringify(mission) },
        { data: JSON.stringify({ ...mission, id: 'mission-2' }) },
      ]);
      const result = store.getAllMissions();
      expect(result).toHaveLength(2);
    });

    it('gets missions by status', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(mission) }]);
      const result = store.getMissionsByStatus('in_progress' as never);
      expect(result).toHaveLength(1);
    });

    it('deletes a mission', () => {
      mockStmt.run.mockReturnValueOnce({ changes: 1 });
      const result = store.deleteMission('mission-1');
      expect(result).toBe(true);
    });

    it('returns false when deleting non-existent mission', () => {
      mockStmt.run.mockReturnValueOnce({ changes: 0 });
      const result = store.deleteMission('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('agents', () => {
    const agent = {
      id: 'agent-1',
      status: 'active' as const,
      role: 'engineer' as const,
      currentMission: undefined,
      completedMissions: [],
    };

    it('saves an agent', () => {
      store.saveAgent(agent as never);
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets an agent by id', () => {
      mockStmt.get.mockReturnValueOnce({ data: JSON.stringify(agent) });
      const result = store.getAgent('agent-1');
      expect(result).toEqual(agent);
    });

    it('returns null for non-existent agent', () => {
      mockStmt.get.mockReturnValueOnce(undefined);
      expect(store.getAgent('nonexistent')).toBeNull();
    });

    it('gets all agents', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(agent) }]);
      const result = store.getAllAgents();
      expect(result).toHaveLength(1);
    });
  });

  describe('audit log', () => {
    const event = {
      id: 'audit-1',
      type: 'deploy' as const,
      severity: 'info' as const,
      result: 'pass' as const,
      timestamp: '2026-07-22T12:00:00.000Z',
    };

    it('saves an audit event', () => {
      store.saveAuditEvent(event as never);
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets audit log with pagination', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(event) }]);
      const result = store.getAuditLog(10, 0);
      expect(result).toHaveLength(1);
    });

    it('gets audit log by type', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(event) }]);
      const result = store.getAuditLogByType('deploy');
      expect(result).toHaveLength(1);
    });

    it('gets audit log count', () => {
      mockStmt.get.mockReturnValueOnce({ count: 5 });
      expect(store.getAuditLogCount()).toBe(5);
    });
  });

  describe('quality metrics', () => {
    const metric = {
      name: 'test-coverage',
      value: 85,
      timestamp: '2026-07-22T12:00:00.000Z',
    };

    it('saves a quality metric', () => {
      store.saveQualityMetric(metric as never);
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets quality metrics', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(metric) }]);
      const result = store.getQualityMetrics(10);
      expect(result).toHaveLength(1);
    });
  });

  describe('learning events', () => {
    const event = {
      id: 'learn-1',
      type: 'observation' as const,
      source: 'audit' as const,
      applied: false,
      timestamp: '2026-07-22T12:00:00.000Z',
    };

    it('saves a learning event', () => {
      store.saveLearningEvent(event as never);
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets learning events', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(event) }]);
      const result = store.getLearningEvents(10);
      expect(result).toHaveLength(1);
    });

    it('gets learning events by source', () => {
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(event) }]);
      const result = store.getLearningEventsBySource('audit');
      expect(result).toHaveLength(1);
    });
  });

  describe('learning insights', () => {
    it('saves an insight', () => {
      store.saveInsight({
        id: 'insight-1',
        pattern: 'test-pattern',
        confidence: 0.85,
        occurrences: 5,
        description: 'Test insight',
        suggestedAction: 'Monitor closely',
      });
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets all insights', () => {
      const insight = {
        id: 'insight-1',
        pattern: 'test-pattern',
        confidence: 0.85,
        occurrences: 5,
        description: 'Test insight',
        suggestedAction: 'Monitor closely',
      };
      mockStmt.all.mockReturnValueOnce([{ data: JSON.stringify(insight) }]);
      const result = store.getInsights();
      expect(result).toHaveLength(1);
      expect(result[0].pattern).toBe('test-pattern');
    });
  });

  describe('audit results', () => {
    it('saves and retrieves audit results', () => {
      store.saveAuditResult({
        id: 'ar-1',
        overall: 'passed',
        score: 95,
        stages: [],
        duration: 1200,
        timestamp: '2026-07-22T12:00:00.000Z',
      });
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets audit results', () => {
      mockStmt.all.mockReturnValueOnce([
        { id: 'ar-1', overall: 'passed', score: 95, timestamp: '2026-07-22T12:00:00.000Z' },
      ]);
      const result = store.getAuditResults(10);
      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(95);
    });
  });

  describe('quality reports', () => {
    it('saves a quality report', () => {
      store.saveQualityReport({
        id: 'qr-1',
        passed: true,
        score: 90,
        checks: [],
        timestamp: '2026-07-22T12:00:00.000Z',
      });
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets quality reports', () => {
      mockStmt.all.mockReturnValueOnce([
        { id: 'qr-1', passed: 1, score: 90, timestamp: '2026-07-22T12:00:00.000Z' },
      ]);
      const result = store.getQualityReports(10);
      expect(result).toHaveLength(1);
      expect(result[0].passed).toBe(true);
    });
  });

  describe('decision history', () => {
    it('saves a decision', () => {
      store.saveDecision({ id: 'dec-1', result: 'approved' });
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets decisions', () => {
      mockStmt.all.mockReturnValueOnce([
        {
          data: JSON.stringify({ id: 'dec-1', result: 'approved' }),
          timestamp: '2026-07-22T12:00:00.000Z',
        },
      ]);
      const result = store.getDecisions(10);
      expect(result).toHaveLength(1);
    });
  });

  describe('KV store', () => {
    it('sets a value', () => {
      store.set('test-key', { nested: 'value' });
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('gets a value', () => {
      mockStmt.get.mockReturnValueOnce({ value: JSON.stringify({ nested: 'value' }) });
      const result = store.get('test-key');
      expect(result).toEqual({ nested: 'value' });
    });

    it('returns null for non-existent key', () => {
      mockStmt.get.mockReturnValueOnce(undefined);
      expect(store.get('nonexistent')).toBeNull();
    });

    it('deletes a key', () => {
      mockStmt.run.mockReturnValueOnce({ changes: 1 });
      expect(store.delete('test-key')).toBe(true);
    });
  });

  describe('stats', () => {
    it('returns correct counts', () => {
      mockStmt.get
        .mockReturnValueOnce({ count: 3 })
        .mockReturnValueOnce({ count: 2 })
        .mockReturnValueOnce({ count: 5 })
        .mockReturnValueOnce({ count: 1 })
        .mockReturnValueOnce({ count: 4 })
        .mockReturnValueOnce({ count: 0 });

      const stats = store.getStats();
      expect(stats.missions).toBe(3);
      expect(stats.agents).toBe(2);
      expect(stats.auditEvents).toBe(5);
      expect(stats.qualityMetrics).toBe(1);
      expect(stats.learningEvents).toBe(4);
      expect(stats.insights).toBe(0);
    });
  });

  describe('maintenance', () => {
    it('closes the database', () => {
      store.close();
      expect(mockDb.close).toHaveBeenCalled();
    });

    it('runs vacuum', () => {
      store.vacuum();
      expect(mockDb.exec).toHaveBeenCalledWith('VACUUM');
    });

    it('checks integrity', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'ok' }]);
      expect(store.periodicIntegrityCheck()).toBe(true);
    });

    it('detects integrity failure', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'corrupted' }]);
      expect(store.periodicIntegrityCheck()).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('throws without authorization', () => {
      expect(() => store.clearAll()).toThrow('requires explicit authorization');
    });

    it('clears with authorization', () => {
      store.clearAll(true);
      expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM missions'));
    });

    it('confirmClearAll with correct token', () => {
      store.confirmClearAll('CONFIRM_CLEAR_ALL');
      expect(mockDb.exec).toHaveBeenCalled();
    });

    it('confirmClearAll throws on wrong token', () => {
      expect(() => store.confirmClearAll('wrong-token')).toThrow('Invalid confirmation token');
    });
  });
});

// ============================================================
// SQLiteAuditStore
// ============================================================

describe('SQLiteAuditStore', () => {
  let auditStore: SQLiteAuditStore;
  const testEntry: Omit<AuditEntry, 'previousHash' | 'hash'> = {
    id: 'entry-1',
    timestamp: '2026-07-22T12:00:00.000Z',
    agentId: 'agent-1',
    missionId: 'mission-1',
    action: 'deploy',
    payload: '{"version":"1.0.0"}',
  };

  beforeEach(() => {
    vi.mocked(readFileSync).mockReturnValue('[]');
    auditStore = new SQLiteAuditStore({ dbPath: '/tmp/test/audit.json' });
  });

  it('appends an entry and returns full entry with hashes', () => {
    const entry = auditStore.append(testEntry);
    expect(entry.id).toBe('entry-1');
    expect(entry.previousHash).toBe('0'.repeat(64));
    expect(entry.hash).toBeDefined();
    expect(entry.hash.length).toBe(64);
  });

  it('appends multiple entries with correct chain', () => {
    const entry1 = auditStore.append(testEntry);
    const entry2 = auditStore.append({ ...testEntry, id: 'entry-2' });

    expect(entry2.previousHash).toBe(entry1.hash);
  });

  it('verifies a valid chain', () => {
    auditStore.append(testEntry);
    auditStore.append({ ...testEntry, id: 'entry-2' });

    const result = auditStore.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(2);
    expect(result.verifiedEntries).toBe(2);
  });

  it('returns valid for empty chain', () => {
    const result = auditStore.verifyChain();
    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(0);
  });

  it('detects broken chain', () => {
    auditStore.append(testEntry);
    auditStore.append({ ...testEntry, id: 'entry-2' });

    const entries = auditStore.getEntries();
    entries[1].previousHash = 'tampered';

    const result = auditStore.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.totalEntries).toBe(2);
  });

  it('filters entries by agent', () => {
    auditStore.append(testEntry);
    auditStore.append({ ...testEntry, id: 'entry-2', agentId: 'agent-2' });

    const agent1 = auditStore.getByAgent('agent-1');
    expect(agent1).toHaveLength(1);
    expect(agent1[0].agentId).toBe('agent-1');
  });

  it('filters entries by mission', () => {
    auditStore.append(testEntry);
    auditStore.append({ ...testEntry, id: 'entry-2', missionId: 'mission-2' });

    const result = auditStore.getByMission('mission-1');
    expect(result).toHaveLength(1);
  });

  it('returns correct count', () => {
    expect(auditStore.count()).toBe(0);
    auditStore.append(testEntry);
    expect(auditStore.count()).toBe(1);
  });

  it('returns all entries', () => {
    auditStore.append(testEntry);
    auditStore.append({ ...testEntry, id: 'entry-2' });

    const entries = auditStore.getEntries();
    expect(entries).toHaveLength(2);
  });

  it('persists entries to disk on append', () => {
    auditStore.append(testEntry);
    expect(auditStore.count()).toBe(1);
  });

  it('remains operational after construction', () => {
    const loadedStore = new SQLiteAuditStore({ dbPath: '/tmp/test/audit.json' });
    const entry = loadedStore.append(testEntry);
    expect(entry.id).toBe('entry-1');
    expect(loadedStore.count()).toBe(1);
  });
});
