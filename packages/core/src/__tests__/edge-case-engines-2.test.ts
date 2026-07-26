import { describe, expect, it } from 'vitest';
import { GovernanceEngine } from '../engines/governance/governance-engine';
import { LearningEngine } from '../engines/learning/learning-engine';
import { MemoryEngine } from '../engines/memory-engine';

// ============================================================
// 1. MemoryEngine — Edge Cases
// ============================================================

describe('MemoryEngine — edge cases', () => {
  it('handles empty directory for readAll', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem' });
    const files = await engine.readAll();
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBe(6);
    for (const f of files) {
      expect(f.entries).toEqual([]);
    }
  });

  it('handles read of non-existent category file', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem2' });
    const entries = await engine.read('context');
    expect(entries).toEqual([]);
  });

  it('importJson rejects invalid JSON', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem3' });
    await expect(engine.importJson('not valid json')).rejects.toThrow('Invalid JSON');
  });

  it('importJson rejects non-array JSON', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem4' });
    await expect(engine.importJson('{"key": "value"}')).rejects.toThrow('expected an array');
  });

  it('importJson accepts empty array', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem5' });
    await expect(engine.importJson('[]')).resolves.toBeUndefined();
  });

  it('search returns empty for non-existent category', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem6' });
    const results = await engine.search('anything', 'decision');
    expect(results).toEqual([]);
  });

  it('getSummary returns zeros for empty memory', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem7' });
    const summary = await engine.getSummary();
    expect(summary.totalEntries).toBe(0);
    expect(summary.lastUpdated).toBe(new Date(0).toISOString());
  });

  it('exportJson returns empty array for empty memory', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem8' });
    const json = await engine.exportJson();
    expect(JSON.parse(json)).toEqual([]);
  });

  it('write with empty string value does not throw', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem9' });
    await expect(
      engine.write({
        key: 'empty',
        value: '',
        category: 'context',
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });

  it('writeBatch with empty array does not throw', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem10' });
    await expect(engine.writeBatch([])).resolves.toBeUndefined();
  });

  it('concurrent writes do not cause race conditions', async () => {
    const engine = new MemoryEngine({ basePath: '/tmp/non-existent-bos-mem11' });
    const promises = Array.from({ length: 10 }, (_, i) =>
      engine.write({
        key: `concurrent-${i}`,
        value: `value-${i}`,
        category: 'context',
        timestamp: new Date().toISOString(),
      }),
    );
    await expect(Promise.all(promises)).resolves.toBeDefined();
  });
});

// ============================================================
// 2. LearningEngine — Edge Cases
// ============================================================

describe('LearningEngine — edge cases', () => {
  it('returns empty events initially', () => {
    const engine = new LearningEngine();
    expect(engine.getEvents()).toEqual([]);
    expect(engine.getInsights()).toEqual([]);
  });

  it('getTrends returns empty for fewer than 2 events', () => {
    const engine = new LearningEngine();
    engine.record({
      type: 'observation',
      source: 'test',
      data: {},
      confidence: 0.5,
      applied: false,
    });
    expect(engine.getTrends()).toEqual([]);
  });

  it('getAnomalies returns empty for fewer than 5 events', () => {
    const engine = new LearningEngine();
    for (let i = 0; i < 4; i++) {
      engine.record({
        type: 'observation',
        source: 'test',
        data: {},
        confidence: 0.5,
        applied: false,
      });
    }
    expect(engine.getAnomalies()).toEqual([]);
  });

  it('getSourceReputation returns null for unknown source', () => {
    const engine = new LearningEngine();
    expect(engine.getSourceReputation('nonexistent')).toBeNull();
  });

  it('applyInsight returns false for non-existent insight', () => {
    const engine = new LearningEngine();
    expect(engine.applyInsight('non-existent-id')).toBe(false);
  });

  it('handles record with missing fields gracefully', () => {
    const engine = new LearningEngine();
    const event = engine.record({
      type: 'observation',
      source: 'test',
      data: {},
      confidence: undefined as unknown as number,
      applied: undefined as unknown as boolean,
    });
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('timestamp');
    expect(event.type).toBe('observation');
  });

  it('generateReport returns valid structure for empty engine', () => {
    const engine = new LearningEngine();
    const report = engine.generateReport();
    expect(report.totalEvents).toBe(0);
    expect(report.insights).toEqual([]);
    expect(report.appliedCount).toBe(0);
    expect(report.pendingCount).toBe(0);
    expect(report.trends).toEqual([]);
    expect(report.anomalies).toEqual([]);
  });

  it('summary returns correct counts for 0 events', () => {
    const engine = new LearningEngine();
    const s = engine.summary();
    expect(s).toContain('0 events');
    expect(s).toContain('0 insights');
  });

  it('persist throws without path', async () => {
    const engine = new LearningEngine();
    await expect(engine.persist()).rejects.toThrow('No persist path configured');
  });

  it('load throws without path', async () => {
    const engine = new LearningEngine();
    await expect(engine.load()).rejects.toThrow('No load path configured');
  });

  it('getInsightsByCategory returns empty for non-existent category', () => {
    const engine = new LearningEngine();
    const insights = engine.getInsightsByCategory('temporal');
    expect(insights).toEqual([]);
  });

  it('records multiple events sequentially', () => {
    const engine = new LearningEngine();
    const e1 = engine.record({
      type: 'observation',
      source: 'a',
      data: {},
      confidence: 0.5,
      applied: false,
    });
    const e2 = engine.record({
      type: 'insight',
      source: 'b',
      data: {},
      confidence: 0.8,
      applied: false,
    });
    expect(e2.id).not.toBe(e1.id);
    expect(engine.getEvents().length).toBe(2);
  });
});

// ============================================================
// 3. GovernanceEngine — Edge Cases
// ============================================================

describe('GovernanceEngine — edge cases', () => {
  it('handles empty rules list', () => {
    const engine = new GovernanceEngine([]);
    const result = engine.evaluate({
      agentId: 'test',
      agentRole: 'engineer',
      agentAuthority: 'senior',
      action: 'edit file',
      targetType: 'file',
      impact: 'low',
    });
    expect(result.allowed).toBe(true);
  });

  it('allows actions that match no rules', () => {
    const engine = new GovernanceEngine([
      {
        id: 'rule-1',
        name: 'Block payments',
        description: '',
        level: 'critical',
        action: 'block',
        conditions: ['type:payment'],
        scope: ['all'],
      },
    ]);
    const result = engine.evaluate({
      agentId: 'test',
      agentRole: 'engineer',
      agentAuthority: 'senior',
      action: 'edit docs',
      targetType: 'file',
      impact: 'low',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks actions matching block rules', () => {
    const engine = new GovernanceEngine([
      {
        id: 'rule-1',
        name: 'Block payments',
        description: '',
        level: 'critical',
        action: 'block',
        conditions: ['type:payment'],
        scope: ['all'],
      },
    ]);
    const result = engine.evaluate({
      agentId: 'test',
      agentRole: 'engineer',
      agentAuthority: 'senior',
      action: 'edit payment flow',
      targetType: 'file',
      impact: 'high',
    });
    expect(result.allowed).toBe(false);
  });

  it('handles disabled rules — engine ignores enabled field', () => {
    const engine = new GovernanceEngine([
      {
        id: 'rule-1',
        name: 'Block payments',
        description: '',
        level: 'critical',
        action: 'block',
        conditions: ['type:payment'],
        scope: ['all'],
      },
    ]);
    const result = engine.evaluate({
      agentId: 'test',
      agentRole: 'engineer',
      agentAuthority: 'senior',
      action: 'edit payment',
      targetType: 'file',
      impact: 'high',
    });
    expect(result.allowed).toBe(false);
  });

  it('escalates for insufficient authority', () => {
    const engine = new GovernanceEngine([
      {
        id: 'rule-2',
        name: 'Arch changes',
        description: '',
        level: 'high',
        action: 'escalate',
        conditions: ['type:architecture'],
        scope: ['engineer'],
      },
    ]);
    const result = engine.evaluate({
      agentId: 'test',
      agentRole: 'engineer',
      agentAuthority: 'junior',
      action: 'change architecture',
      targetType: 'module',
      impact: 'high',
    });
    expect(result.escalationRequired).toBe(true);
  });
});
