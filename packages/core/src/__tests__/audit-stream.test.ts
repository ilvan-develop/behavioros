import { describe, expect, it } from 'vitest';
import { AuditStream } from '../engines/observability/audit-stream';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    actor: 'user:1',
    action: 'read',
    resource: 'doc:42',
    resourceType: 'document',
    result: 'success' as const,
    ...overrides,
  };
}

describe('AuditStream', () => {
  it('should record an event and assign id + timestamp', () => {
    const stream = new AuditStream();
    stream.record(makeEvent());
    expect(stream.size()).toBe(1);
    const events = stream.query({}).events;
    expect(events[0].id).toBeDefined();
    expect(events[0].timestamp).toBeDefined();
    expect(events[0].actor).toBe('user:1');
  });

  it('should query by actor', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ actor: 'alice' }));
    stream.record(makeEvent({ actor: 'bob' }));
    stream.record(makeEvent({ actor: 'alice' }));
    expect(stream.query({ actor: 'alice' }).total).toBe(2);
    expect(stream.query({ actor: 'bob' }).total).toBe(1);
    expect(stream.query({ actor: 'charlie' }).total).toBe(0);
  });

  it('should query by action', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ action: 'create' }));
    stream.record(makeEvent({ action: 'update' }));
    stream.record(makeEvent({ action: 'delete' }));
    expect(stream.query({ action: 'create' }).total).toBe(1);
    expect(stream.query({ action: 'update' }).total).toBe(1);
  });

  it('should query by result', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ result: 'success' }));
    stream.record(makeEvent({ result: 'failure' }));
    stream.record(makeEvent({ result: 'denied' }));
    expect(stream.query({ result: 'success' }).total).toBe(1);
    expect(stream.query({ result: 'failure' }).total).toBe(1);
    expect(stream.query({ result: 'denied' }).total).toBe(1);
  });

  it('should query by time range', () => {
    const stream = new AuditStream();
    stream.record(makeEvent());
    stream.record(makeEvent());
    const after = new Date(Date.now() + 100_000).toISOString();
    expect(stream.query({ since: after }).total).toBe(0);
    expect(stream.query({ until: after }).total).toBe(2);
  });

  it('should paginate results with offset and limit', () => {
    const stream = new AuditStream();
    for (let i = 0; i < 10; i++) {
      stream.record(makeEvent({ action: `action-${i}` }));
    }
    const page1 = stream.query({ limit: 3, offset: 0 });
    expect(page1.events).toHaveLength(3);
    expect(page1.total).toBe(10);
    const page2 = stream.query({ limit: 3, offset: 3 });
    expect(page2.events).toHaveLength(3);
    expect(page2.events[0].action).toBe('action-3');
  });

  it('should combine multiple filters', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ actor: 'alice', action: 'read', result: 'success' }));
    stream.record(makeEvent({ actor: 'alice', action: 'write', result: 'success' }));
    stream.record(makeEvent({ actor: 'bob', action: 'read', result: 'failure' }));
    const result = stream.query({ actor: 'alice', action: 'read' });
    expect(result.total).toBe(1);
    expect(result.events[0].result).toBe('success');
  });

  it('should get events by actor', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ actor: 'alice' }));
    stream.record(makeEvent({ actor: 'bob' }));
    stream.record(makeEvent({ actor: 'alice' }));
    expect(stream.getByActor('alice')).toHaveLength(2);
    expect(stream.getByActor('bob')).toHaveLength(1);
  });

  it('should get events by resource', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ resource: 'doc:1' }));
    stream.record(makeEvent({ resource: 'doc:2' }));
    stream.record(makeEvent({ resource: 'doc:1' }));
    expect(stream.getByResource('doc:1')).toHaveLength(2);
    expect(stream.getByResource('doc:2')).toHaveLength(1);
  });

  it('should export as JSON', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ actor: 'alice', action: 'login' }));
    const json = stream.export('json');
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].actor).toBe('alice');
    expect(parsed[0].action).toBe('login');
  });

  it('should export as CSV', () => {
    const stream = new AuditStream();
    stream.record(makeEvent({ actor: 'alice', action: 'login', result: 'success' }));
    const csv = stream.export('csv');
    expect(csv).toContain('id,actor,action,resource,resourceType,result,timestamp');
    expect(csv).toContain('alice');
    expect(csv).toContain('login');
  });

  it('should default to JSON export', () => {
    const stream = new AuditStream();
    stream.record(makeEvent());
    expect(stream.export()).toContain('"actor"');
  });

  it('should set retention and prune old events', () => {
    const stream = new AuditStream();
    stream.setRetention(30);

    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const oldTimestamp = old.toISOString();

    stream.record(makeEvent({ actor: 'old-entry' }));
    stream.record(makeEvent({ actor: 'new-entry' }));
    stream.record(makeEvent({ actor: 'another-old' }));

    const events = stream.query({}).events;
    events[0].timestamp = oldTimestamp;
    events[2].timestamp = oldTimestamp;
    for (const e of events) {
      stream.query({}).events[stream.query({}).events.findIndex((x) => x.id === e.id)] = e;
    }

    const pruned = stream.prune();
    expect(pruned).toBe(2);
    expect(stream.size()).toBe(1);
  });

  it('should return zero from prune when nothing is expired', () => {
    const stream = new AuditStream();
    stream.setRetention(90);
    stream.record(makeEvent());
    stream.record(makeEvent());
    expect(stream.prune()).toBe(0);
    expect(stream.size()).toBe(2);
  });

  it('should track size', () => {
    const stream = new AuditStream();
    expect(stream.size()).toBe(0);
    stream.record(makeEvent());
    expect(stream.size()).toBe(1);
    stream.record(makeEvent());
    stream.record(makeEvent());
    expect(stream.size()).toBe(3);
  });
});
