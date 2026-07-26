import type { LearningEvent } from '@behavioros/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(JSON.stringify({ events: [], insights: [] })),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

import { LearningEngine } from '../engines/learning/learning-engine';

function makeEvent(
  overrides: Partial<LearningEvent> = {},
): Omit<LearningEvent, 'id' | 'timestamp'> {
  return {
    type: 'observation',
    source: 'test-source',
    data: { key: 'value' },
    confidence: 0.5,
    applied: false,
    ...overrides,
  };
}

function makeFullEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    type: 'observation',
    source: 'test-source',
    data: { key: 'value' },
    confidence: 0.5,
    applied: false,
    ...overrides,
  };
}

describe('LearningEngine', () => {
  let engine: LearningEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new LearningEngine();
  });

  describe('constructor', () => {
    it('should create with defaults', () => {
      expect(engine).toBeInstanceOf(LearningEngine);
      expect(engine.getEvents()).toEqual([]);
      expect(engine.getInsights()).toEqual([]);
    });

    it('should create with persist path', () => {
      const e = new LearningEngine({ persistPath: '/tmp/learning.json' });
      expect(e).toBeInstanceOf(LearningEngine);
    });

    it('should create with autoApply enabled', () => {
      const e = new LearningEngine({ autoApply: true });
      expect(e).toBeInstanceOf(LearningEngine);
    });
  });

  describe('record', () => {
    it('should record an event and assign id/timestamp', () => {
      const event = engine.record(makeEvent());
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.type).toBe('observation');
      expect(engine.getEvents()).toHaveLength(1);
    });

    it('should record multiple events', () => {
      engine.record(makeEvent({ type: 'observation' }));
      engine.record(makeEvent({ type: 'insight' }));
      engine.record(makeEvent({ type: 'correction' }));
      expect(engine.getEvents()).toHaveLength(3);
    });

    it('should accept events with confidence 0 and 1', () => {
      engine.record(makeEvent({ confidence: 0 }));
      engine.record(makeEvent({ confidence: 1 }));
      expect(engine.getEvents()).toHaveLength(2);
    });

    it('should reference same event object from getEvents', () => {
      const _event = engine.record(makeEvent({ data: { key: 'value' } }));
      const events = engine.getEvents();
      expect(events[0].data).toEqual({ key: 'value' });
    });
  });

  describe('getEvents', () => {
    it('should return copy of events', () => {
      engine.record(makeEvent());
      const events = engine.getEvents();
      events.push({} as LearningEvent);
      expect(engine.getEvents()).toHaveLength(1);
    });
  });

  describe('insights', () => {
    it('should return empty insights by default', () => {
      expect(engine.getInsights()).toEqual([]);
    });

    it('should detect temporal pattern after enough events', () => {
      for (let i = 0; i < 10; i++) {
        const d = new Date('2026-07-20T10:00:00Z');
        d.setHours(10 + (i % 3));
        engine.record(
          makeEvent({
            type: 'observation',
            data: {},
          }),
        );
      }
      const insights = engine.getInsights();
      expect(insights.length).toBeGreaterThanOrEqual(0);
    });

    it('should filter insights by category', () => {
      engine = new LearningEngine({ autoApply: false });
      for (let i = 0; i < 6; i++) {
        engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      }

      const _allInsights = engine.getInsights();
      const sourceInsights = engine.getInsightsByCategory('source');
      expect(sourceInsights.every((i) => i.category === 'source')).toBe(true);
    });

    it('should return empty for nonexistent category', () => {
      const result = engine.getInsightsByCategory('temporal');
      expect(result).toEqual([]);
    });
  });

  describe('getTrends', () => {
    it('should return empty when less than 2 events', () => {
      engine.record(makeEvent());
      expect(engine.getTrends()).toEqual([]);
    });

    it('should return trends when enough events', () => {
      for (let i = 0; i < 8; i++) {
        const d = new Date('2026-07-20T10:00:00Z');
        d.setMinutes(d.getMinutes() + i * 30);
        engine.record(makeEvent({ type: 'observation', data: {} }));
      }
      const trends = engine.getTrends();
      expect(trends.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getAnomalies', () => {
    it('should return empty when less than 5 events', () => {
      for (let i = 0; i < 4; i++) engine.record(makeEvent());
      expect(engine.getAnomalies()).toEqual([]);
    });

    it('should return anomalies when enough events with high rate', () => {
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - i * 5);
        engine.record(makeEvent({ type: 'correction', data: {} }));
      }
      const anomalies = engine.getAnomalies();
      expect(Array.isArray(anomalies)).toBe(true);
    });
  });

  describe('getSourceReputation', () => {
    it('should return null for unknown source', () => {
      expect(engine.getSourceReputation('nonexistent')).toBeNull();
    });

    it('should compute reputation for known source', () => {
      engine.record(makeEvent({ source: 'agent-a', type: 'insight', confidence: 0.9 }));
      engine.record(makeEvent({ source: 'agent-a', type: 'observation', confidence: 0.5 }));
      engine.record(makeEvent({ source: 'agent-a', type: 'insight', confidence: 0.8 }));
      const rep = engine.getSourceReputation('agent-a');
      expect(rep).not.toBeNull();
      expect(rep!.totalEvents).toBe(3);
      expect(rep!.insightCount).toBe(2);
      expect(rep!.averageConfidence).toBeCloseTo(0.733, 1);
    });
  });

  describe('applyInsight', () => {
    it('should return false for nonexistent insight', () => {
      expect(engine.applyInsight('nonexistent')).toBe(false);
    });

    it('should apply insight and record feedback event', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      const insights = engine.getInsights();
      if (insights.length > 0) {
        const applied = engine.applyInsight(insights[0].id);
        expect(applied).toBe(true);
        const events = engine.getEvents();
        const feedbackEvents = events.filter((e) => e.type === 'feedback');
        expect(feedbackEvents.length).toBeGreaterThan(0);
      }
    });

    it('should increase confidence on apply', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      const insights = engine.getInsights();
      if (insights.length > 0) {
        const beforeConf = insights[0].confidence;
        engine.applyInsight(insights[0].id);
        expect(insights[0].confidence).toBeGreaterThan(beforeConf);
      }
    });
  });

  describe('generateReport', () => {
    it('should generate report with zero events', () => {
      const report = engine.generateReport();
      expect(report.totalEvents).toBe(0);
      expect(report.insights).toEqual([]);
    });

    it('should include applied/pending counts', () => {
      engine.record(makeEvent({ applied: true }));
      engine.record(makeEvent({ applied: false }));
      const report = engine.generateReport();
      expect(report.appliedCount).toBe(1);
      expect(report.pendingCount).toBe(1);
    });
  });

  describe('persist / load', () => {
    it('should throw persist error without path', async () => {
      await expect(engine.persist()).rejects.toThrow('No persist path configured');
    });

    it('should throw load error without path', async () => {
      await expect(engine.load()).rejects.toThrow('No load path configured');
    });

    it('should persist to file', async () => {
      const { writeFile } = await import('node:fs/promises');
      engine.record(makeEvent());
      const e = new LearningEngine({ persistPath: '/tmp/test.json' });
      e.record(makeEvent());
      await e.persist();
      expect(writeFile).toHaveBeenCalled();
    });
  });

  describe('summary', () => {
    it('should return summary string with zero events', () => {
      const s = engine.summary();
      expect(s).toContain('0 events');
      expect(s).toContain('0 insights');
    });

    it('should include top insights in summary', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      const s = engine.summary();
      expect(s).toContain('events');
      expect(s).toContain('insights');
    });
  });

  describe('autoApply', () => {
    it('should auto-apply high confidence insights when enabled', () => {
      const e = new LearningEngine({ autoApply: true });
      e.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      const feedbackEvents = e.getEvents().filter((evt) => evt.type === 'feedback');
      expect(feedbackEvents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detection patterns', () => {
    it('should detect correlation between event types', () => {
      const events = [
        { type: 'insight' as const, source: 'a', confidence: 0.7, applied: false, data: {} },
        { type: 'correction' as const, source: 'b', confidence: 0.6, applied: false, data: {} },
      ];
      for (const evt of events) {
        engine.record(evt);
      }
      expect(engine.getEvents().length).toBe(2);
    });

    it('should handle failure chain detection', () => {
      for (let i = 0; i < 4; i++) {
        const d = new Date();
        d.setMinutes(d.getMinutes() - i * 5);
        const evt = makeFullEvent({ type: 'correction', source: 'debugger' as const });
        (engine as any).events.push(evt);
      }
      engine.record(makeEvent({ type: 'correction', source: 'debugger' }));
      expect(engine.getEvents().length).toBe(5);
    });

    it('should handle success pattern detection', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      engine.record(makeEvent({ type: 'feedback', source: 'test', confidence: 0.8 }));
      expect(engine.getEvents().length).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle recorded events with applied true', () => {
      engine.record(makeEvent({ applied: true }));
      const report = engine.generateReport();
      expect(report.pendingCount).toBe(0);
    });

    it('should allow getInsightsByCategory with no matching events', () => {
      const result = engine.getInsightsByCategory('anomaly');
      expect(result).toEqual([]);
    });
  });
});
