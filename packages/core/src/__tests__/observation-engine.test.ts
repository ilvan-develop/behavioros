import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObservationEngine } from '../engines/cognitive/observation-engine';

describe('ObservationEngine', () => {
  let engine: ObservationEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new ObservationEngine();
  });

  afterEach(() => {
    engine.clear();
    vi.useRealTimers();
  });

  describe('record', () => {
    it('should record a new observation and return an id', () => {
      const id = engine.record('test', 'engine', 'info', 'test message');
      expect(id).toBeDefined();
      expect(id).toMatch(/^obs_\d+_\d+$/);
    });

    it('should create an observation with default empty data', () => {
      const id = engine.record('test', 'engine', 'warning', 'no data');
      const obs = engine.get(id);
      expect(obs?.data).toEqual({});
    });

    it('should create an observation with provided data', () => {
      const data = { key: 'value', count: 42 };
      const id = engine.record('test', 'engine', 'error', 'with data', data);
      const obs = engine.get(id);
      expect(obs?.data).toEqual(data);
    });
  });

  describe('get', () => {
    it('should return an observation by id', () => {
      const id = engine.record('test', 'engine', 'info', 'get me');
      const obs = engine.get(id);
      expect(obs).toBeDefined();
      expect(obs?.id).toBe(id);
      expect(obs?.type).toBe('test');
      expect(obs?.source).toBe('engine');
      expect(obs?.severity).toBe('info');
      expect(obs?.message).toBe('get me');
      expect(obs?.status).toBe('new');
    });

    it('should return undefined for unknown id', () => {
      const obs = engine.get('nonexistent');
      expect(obs).toBeUndefined();
    });
  });

  describe('lifecycle', () => {
    it('should acknowledge an observation', () => {
      const id = engine.record('test', 'engine', 'info', 'lifecycle');
      engine.acknowledge(id);
      expect(engine.get(id)?.status).toBe('acknowledged');
    });

    it('should investigate an observation', () => {
      const id = engine.record('test', 'engine', 'error', 'investigate');
      engine.investigate(id);
      expect(engine.get(id)?.status).toBe('investigating');
    });

    it('should resolve an observation and set resolvedAt', () => {
      const id = engine.record('test', 'engine', 'critical', 'resolve');
      engine.resolve(id);
      const obs = engine.get(id);
      expect(obs?.status).toBe('resolved');
      expect(obs?.resolvedAt).toBeDefined();
    });

    it('should no-op on lifecycle methods for unknown ids', () => {
      expect(() => engine.acknowledge('x')).not.toThrow();
      expect(() => engine.investigate('x')).not.toThrow();
      expect(() => engine.resolve('x')).not.toThrow();
    });

    it('should update updatedAt on status changes', () => {
      const id = engine.record('test', 'engine', 'info', 'timestamps');
      const created = engine.get(id)!.createdAt;
      const updated = engine.get(id)!.updatedAt;
      expect(updated).toBe(created);

      vi.advanceTimersByTime(100);
      engine.acknowledge(id);
      expect(engine.get(id)!.updatedAt).not.toBe(created);
    });
  });

  describe('list', () => {
    it('should return all observations when no filter is provided', () => {
      engine.record('a', 'src1', 'info', 'msg1');
      engine.record('b', 'src2', 'error', 'msg2');
      expect(engine.list()).toHaveLength(2);
    });

    it('should filter by source', () => {
      engine.record('a', 'src1', 'info', 'msg1');
      engine.record('b', 'src2', 'error', 'msg2');
      const filtered = engine.list({ source: 'src1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe('src1');
    });

    it('should filter by type', () => {
      engine.record('typeA', 'src', 'info', 'msg1');
      engine.record('typeB', 'src', 'warning', 'msg2');
      const filtered = engine.list({ type: 'typeA' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('typeA');
    });

    it('should filter by severity', () => {
      engine.record('a', 'src', 'info', 'msg1');
      engine.record('b', 'src', 'critical', 'msg2');
      const filtered = engine.list({ severity: 'critical' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].severity).toBe('critical');
    });

    it('should filter by status', () => {
      const id = engine.record('a', 'src', 'info', 'msg');
      engine.acknowledge(id);
      const filtered = engine.list({ status: 'acknowledged' });
      expect(filtered).toHaveLength(1);
    });

    it('should filter by time range', () => {
      const id = engine.record('a', 'src', 'info', 'msg');
      const obs = engine.get(id)!;
      const filtered = engine.list({ since: obs.createdAt, until: obs.createdAt });
      expect(filtered).toHaveLength(1);
    });

    it('should return empty array when no matches', () => {
      engine.record('a', 'src', 'info', 'msg');
      const filtered = engine.list({ source: 'nonexistent' });
      expect(filtered).toHaveLength(0);
    });

    it('should combine multiple filters', () => {
      engine.record('typeA', 'src1', 'info', 'msg1');
      engine.record('typeA', 'src1', 'critical', 'msg2');
      engine.record('typeB', 'src1', 'info', 'msg3');
      const filtered = engine.list({ type: 'typeA', severity: 'info' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].message).toBe('msg1');
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty engine', () => {
      const stats = engine.getStats();
      expect(stats.total).toBe(0);
      expect(stats.bySeverity).toEqual({ info: 0, warning: 0, error: 0, critical: 0 });
      expect(stats.byStatus).toEqual({ new: 0, acknowledged: 0, investigating: 0, resolved: 0 });
    });

    it('should return correct stats', () => {
      engine.record('a', 'src', 'info', 'm1');
      engine.record('b', 'src', 'error', 'm2');
      engine.record('c', 'src', 'critical', 'm3');
      const id2 = engine.record('d', 'src', 'warning', 'm4');
      engine.acknowledge(id2);
      const stats = engine.getStats();
      expect(stats.total).toBe(4);
      expect(stats.bySeverity.info).toBe(1);
      expect(stats.bySeverity.error).toBe(1);
      expect(stats.bySeverity.critical).toBe(1);
      expect(stats.bySeverity.warning).toBe(1);
      expect(stats.byStatus.new).toBe(3);
      expect(stats.byStatus.acknowledged).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all observations', () => {
      engine.record('a', 'src', 'info', 'm1');
      engine.record('b', 'src', 'error', 'm2');
      engine.clear();
      expect(engine.list()).toHaveLength(0);
      expect(engine.getStats().total).toBe(0);
    });
  });
});
