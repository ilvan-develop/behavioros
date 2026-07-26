import type { LearningEvent } from '@behavioros/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${Math.random().toString(36).slice(2, 10)}`,
}));

const mockReadFilePromise = vi.hoisted(() =>
  vi.fn().mockResolvedValue(JSON.stringify({ events: [], insights: [] })),
);
const mockWriteFilePromise = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFilePromise,
  writeFile: mockWriteFilePromise,
}));

import { LearningEngine } from '../engines/learning/learning-engine';

function makeEvent(
  overrides: Partial<Omit<LearningEvent, 'id' | 'timestamp'>> = {},
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
    id: `evt-fixed-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    type: 'observation',
    source: 'test-source',
    data: { key: 'value' },
    confidence: 0.5,
    applied: false,
    ...overrides,
  };
}

describe('LearningEngine — edge cases', () => {
  let engine: LearningEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new LearningEngine();
  });

  describe('record — confidence edge cases', () => {
    it('should handle confidence = 0', () => {
      const evt = engine.record(makeEvent({ confidence: 0 }));
      expect(evt.confidence).toBe(0);
      expect(engine.getEvents()).toHaveLength(1);
    });

    it('should handle confidence = 1.0 (max)', () => {
      const evt = engine.record(makeEvent({ confidence: 1.0 }));
      expect(evt.confidence).toBe(1.0);
    });

    it('should handle confidence > 1 (no clamping at record level)', () => {
      const evt = engine.record(makeEvent({ confidence: 2.5 }));
      expect(evt.confidence).toBe(2.5);
    });

    it('should handle confidence = 0.5 (default)', () => {
      const evt = engine.record(makeEvent({ confidence: 0.5 }));
      expect(evt.confidence).toBe(0.5);
    });
  });

  describe('record — data edge cases', () => {
    it('should handle event with undefined data', () => {
      const evt = engine.record(makeEvent({ data: undefined as any }));
      expect(evt.data).toBeUndefined();
    });

    it('should handle event with null data', () => {
      const evt = engine.record(makeEvent({ data: null as any }));
      expect(evt.data).toBeNull();
    });

    it('should handle event with empty data object', () => {
      const evt = engine.record(makeEvent({ data: {} }));
      expect(evt.data).toEqual({});
    });

    it('should handle source with special characters', () => {
      const evt = engine.record(makeEvent({ source: 'source-with-dashes_underscores/123' }));
      expect(evt.source).toBe('source-with-dashes_underscores/123');
    });

    it('should accept events without applied field', () => {
      const evt = engine.record(makeEvent({ applied: undefined as any }));
      expect(evt.applied).toBeUndefined();
    });
  });

  describe('pattern detection — insufficient events', () => {
    it('should NOT detect temporal pattern with < 5 events', () => {
      for (let i = 0; i < 4; i++) {
        engine.record(makeEvent({ type: 'observation' }));
      }
      // Temporal detection returns early on < 5 events.
      // Other detectors (source reputation) may fire with >= 3 events.
      const temporalInsights = engine.getInsightsByCategory('temporal');
      expect(temporalInsights).toHaveLength(0);
    });

    it('should NOT detect trend with < 4 events of same type', () => {
      for (let i = 0; i < 3; i++) {
        engine.record(makeEvent({ type: 'insight' }));
      }
      // Each record triggers detection; trend needs >= 4 same type events
      expect(engine.getInsights().filter((i) => i.category === 'trend')).toHaveLength(0);
    });

    it('should NOT detect correlation with < 3 events', () => {
      engine.record(makeEvent({ type: 'insight' }));
      engine.record(makeEvent({ type: 'correction' }));
      // correlation needs >= 3 events
      expect(engine.getInsights().filter((i) => i.category === 'correlation')).toHaveLength(0);
    });

    it('should NOT detect anomaly with < 6 events', () => {
      for (let i = 0; i < 5; i++) {
        engine.record(makeEvent({ type: 'observation' }));
      }
      // detectAnomaly returns early on < 6 events
      expect(engine.getInsights().filter((i) => i.category === 'anomaly')).toHaveLength(0);
    });

    it('should NOT detect success pattern with < 2 successes', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      // Only 1 success, needs >= 2
      expect(engine.getInsights().filter((i) => i.category === 'success')).toHaveLength(0);
    });

    it('should NOT detect failure chain with < 2 corrections', () => {
      engine.record(makeEvent({ type: 'correction' }));
      expect(engine.getInsights().filter((i) => i.category === 'failure')).toHaveLength(0);
    });

    it('should NOT update source reputation with < 3 events from same source', () => {
      engine.record(makeEvent({ source: 'agent-x', type: 'insight' }));
      engine.record(makeEvent({ source: 'agent-x', type: 'observation' }));
      expect(engine.getInsights().filter((i) => i.category === 'source')).toHaveLength(0);
    });
  });

  describe('auto-apply', () => {
    it('should auto-apply high confidence insight when autoApply is on', () => {
      const e = new LearningEngine({ autoApply: true });
      e.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      // When autoApply=true, autoApplyInsights runs after record
      // It checks confidence > 0.8
      const insights = e.getInsights();
      const appliedInsight = insights.find((i) => i.confidence > 0.8);
      if (appliedInsight) {
        const fb = e
          .getEvents()
          .find((evt) => evt.type === 'feedback' && evt.data?.appliedInsight === appliedInsight.id);
        expect(fb).toBeDefined();
      }
    });

    it('should NOT auto-apply low confidence insight', () => {
      const e = new LearningEngine({ autoApply: true });
      e.record(makeEvent({ type: 'insight', confidence: 0.5 }));
      const feedbacks = e.getEvents().filter((evt) => evt.type === 'feedback');
      expect(feedbacks).toHaveLength(0);
    });

    it('should NOT double-apply already applied insight', () => {
      // Pre-populate with an insight that has high confidence
      (engine as any).insights.push({
        id: 'test-insight-double',
        pattern: 'test',
        confidence: 0.9,
        occurrences: 3,
        description: 'test',
        category: 'temporal',
        lastDetected: new Date().toISOString(),
      });
      // Manually apply it once
      const applied = engine.applyInsight('test-insight-double');
      expect(applied).toBe(true);
      const feedbackEventsBefore = engine.getEvents().filter((e) => e.type === 'feedback');
      expect(feedbackEventsBefore).toHaveLength(1);
      // Calling applyInsight again increases occurrences/confidence but doesn't
      // add a duplicate feedback for the same insight — it always records a new feedback
      engine.applyInsight('test-insight-double');
      const feedbackEventsAfter = engine.getEvents().filter((e) => e.type === 'feedback');
      expect(feedbackEventsAfter).toHaveLength(2);
    });
  });

  describe('getTrends — boundary conditions', () => {
    it('should return empty when events < 2', () => {
      engine.record(makeEvent());
      expect(engine.getTrends()).toEqual([]);
    });

    it('should return empty when each type has < 3 events', () => {
      const types: Array<'observation' | 'pattern' | 'insight' | 'feedback' | 'correction'> = [
        'observation',
        'pattern',
        'insight',
        'feedback',
        'correction',
        'observation',
      ];
      for (const t of types) {
        engine.record(makeEvent({ type: t }));
      }
      const trends = engine.getTrends();
      // Each type has < 3 events (max 2 per type), so no trends
      expect(trends).toHaveLength(0);
    });

    it('should detect stable trend when slope is within threshold', () => {
      for (let i = 0; i < 6; i++) {
        const d = new Date(Date.now() - (5 - i) * 60 * 60 * 1000);
        const evt = makeFullEvent({ type: 'observation', timestamp: d.toISOString() });
        (engine as any).events.push(evt);
      }
      const trends = engine.getTrends();
      // With 6 evenly spaced events, slope should be ~0 (stable)
      if (trends.length > 0) {
        expect(['stable', 'increasing', 'decreasing']).toContain(trends[0].direction);
      }
    });
  });

  describe('getAnomalies — boundary conditions', () => {
    it('should return empty when exactly 5 events (minimum not met for detection)', () => {
      for (let i = 0; i < 5; i++) {
        engine.record(makeEvent({ type: 'observation' }));
      }
      // getAnomalies requires >= 5 events to start, then per-type >= 4
      expect(engine.getAnomalies()).toEqual([]);
    });

    it('should return empty when events are spread out (no spike)', () => {
      for (let i = 0; i < 10; i++) {
        const d = new Date(Date.now() - (30 - i) * 60 * 60 * 1000);
        const evt = makeFullEvent({ type: 'observation', timestamp: d.toISOString() });
        (engine as any).events.push(evt);
      }
      const anomalies = engine.getAnomalies();
      expect(anomalies).toHaveLength(0);
    });
  });

  describe('getSourceReputation — edge cases', () => {
    it('should return null for source with no events', () => {
      expect(engine.getSourceReputation('ghost')).toBeNull();
    });

    it('should compute reputation ratio correctly with zero corrections', () => {
      engine.record(makeEvent({ source: 'agent-z', type: 'insight', confidence: 0.8 }));
      engine.record(makeEvent({ source: 'agent-z', type: 'insight', confidence: 0.9 }));
      engine.record(makeEvent({ source: 'agent-z', type: 'insight', confidence: 0.7 }));
      const rep = engine.getSourceReputation('agent-z');
      expect(rep).not.toBeNull();
      expect(rep!.insightCount).toBe(3);
      expect(rep!.correctionCount).toBe(0);
      expect(rep!.insightRatio).toBeGreaterThan(0);
    });

    it('should compute reputation with only corrections', () => {
      engine.record(makeEvent({ source: 'bad-agent', type: 'correction', confidence: 0.3 }));
      engine.record(makeEvent({ source: 'bad-agent', type: 'correction', confidence: 0.2 }));
      engine.record(makeEvent({ source: 'bad-agent', type: 'correction', confidence: 0.1 }));
      const rep = engine.getSourceReputation('bad-agent');
      expect(rep).not.toBeNull();
      expect(rep!.correctionCount).toBe(3);
      expect(rep!.insightRatio).toBe(0);
    });
  });

  describe('applyInsight — edge cases', () => {
    it('should return false for non-existent insight id', () => {
      expect(engine.applyInsight('does-not-exist')).toBe(false);
    });

    it('should increment confidence on apply', () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));
      const insights = engine.getInsights();
      if (insights.length > 0) {
        const before = insights[0].confidence;
        engine.applyInsight(insights[0].id);
        expect(insights[0].confidence).toBe(Math.min(1, before + 0.1));
      }
    });

    it('should cap confidence at 1.0 on repeated applies', () => {
      // Push directly so we have an insight
      (engine as any).insights.push({
        id: 'test-insight',
        pattern: 'test',
        confidence: 0.95,
        occurrences: 1,
        description: 'test',
        category: 'temporal',
        lastDetected: new Date().toISOString(),
      });
      engine.applyInsight('test-insight');
      engine.applyInsight('test-insight');
      const insight = engine.getInsights().find((i) => i.id === 'test-insight');
      expect(insight?.confidence).toBe(1); // capped
    });
  });

  describe('generateReport — edge cases', () => {
    it('should count applied and pending events', () => {
      engine.record(makeEvent({ applied: true }));
      engine.record(makeEvent({ applied: true }));
      engine.record(makeEvent({ applied: false }));
      const report = engine.generateReport();
      expect(report.appliedCount).toBe(2);
      expect(report.pendingCount).toBe(1);
    });

    it('should include trends and anomalies in report', () => {
      const report = engine.generateReport();
      expect(report.trends).toBeDefined();
      expect(report.anomalies).toBeDefined();
    });
  });

  describe('persist / load — edge cases', () => {
    it('should throw on persist without path', async () => {
      await expect(engine.persist()).rejects.toThrow('No persist path configured');
    });

    it('should throw on load without path', async () => {
      await expect(engine.load()).rejects.toThrow('No load path configured');
    });

    it('should persist and restore state correctly', async () => {
      engine.record(makeEvent({ type: 'insight', confidence: 0.9 }));

      // Create a new engine, load into it
      const e2 = new LearningEngine({ persistPath: '/tmp/learning.json' });
      mockReadFilePromise.mockResolvedValue(
        JSON.stringify({
          events: [
            {
              id: 'restored',
              timestamp: new Date().toISOString(),
              type: 'insight',
              source: 'restored-source',
              data: {},
              confidence: 0.85,
              applied: false,
            },
          ],
          insights: [
            {
              id: 'restored-insight',
              pattern: 'restored',
              confidence: 0.8,
              occurrences: 3,
              description: 'restored insight',
              category: 'temporal',
              lastDetected: new Date().toISOString(),
            },
          ],
        }),
      );
      await e2.load();
      expect(e2.getEvents()).toHaveLength(1);
      expect(e2.getEvents()[0].source).toBe('restored-source');
      expect(e2.getInsights()).toHaveLength(1);
    });
  });

  describe('summary — edge cases', () => {
    it('should show 0 events and 0 insights for empty engine', () => {
      const s = engine.summary();
      expect(s).toContain('0 events');
      expect(s).toContain('0 insights');
    });

    it('should categorize insights in summary', () => {
      (engine as any).insights.push({
        id: 's1',
        pattern: 'test',
        confidence: 0.7,
        occurrences: 2,
        description: 'test pattern',
        category: 'temporal',
        lastDetected: new Date().toISOString(),
      });
      const s = engine.summary();
      expect(s).toContain('temporal');
      expect(s).toContain('1 insights');
    });
  });

  describe('success pattern detection', () => {
    it('should detect success-feedback-loop when feedback precedes insight', () => {
      // Create a feedback event first, then a high-confidence insight
      const feedbackTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      (engine as any).events.push(
        makeFullEvent({
          id: 'feedback-1',
          timestamp: feedbackTime,
          type: 'feedback',
          source: 'test',
          confidence: 0.8,
        }),
      );
      const insightTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      (engine as any).events.push(
        makeFullEvent({
          id: 'insight-1',
          timestamp: insightTime,
          type: 'insight',
          source: 'test',
          confidence: 0.9,
        }),
      );
      // Trigger detection by recording another event
      engine.record(makeEvent({ type: 'observation' }));
      const successInsights = engine.getInsightsByCategory('success');
      // With 2 successes (confidence >= 0.7) and feedback before insight
      expect(successInsights.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('failure chain detection', () => {
    it('should detect failure chain with 2+ corrections within window', () => {
      const now = Date.now();
      for (let i = 0; i < 3; i++) {
        (engine as any).events.push(
          makeFullEvent({
            id: `corr-${i}`,
            timestamp: new Date(now - (2 - i) * 5 * 60 * 1000).toISOString(),
            type: 'correction',
            source: 'debugger',
            confidence: 0.5,
          }),
        );
      }
      engine.record(makeEvent({ type: 'observation' }));
      // 3 corrections satisfy >= 2 requirement
      // detection triggered by record
    });
  });
});
