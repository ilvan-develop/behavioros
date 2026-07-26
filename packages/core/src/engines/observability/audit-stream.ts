import { randomUUID } from 'node:crypto';

/**
 * AuditEvent — Configuration and options interface.
 */
export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  resource: string;
  resourceType: string;
  result: 'success' | 'failure' | 'denied';
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
}

/**
 * AuditQuery — Configuration and options interface.
 */
export interface AuditQuery {
  actor?: string;
  action?: string;
  resource?: string;
  result?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

/**
 * AuditQueryResult — Configuration and options interface.
 */
export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * AuditStream — audit stream.
 *
 * Methods: record, query, getByActor, getByResource, export, setRetention, prune, size.
 */
export class AuditStream {
  private events: AuditEvent[] = [];
  private retentionDays = 90;

  record(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const entry: AuditEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.events.push(entry);
  }

  query(query: AuditQuery): AuditQueryResult {
    let filtered = [...this.events];

    if (query.actor) {
      filtered = filtered.filter((e) => e.actor === query.actor);
    }
    if (query.action) {
      filtered = filtered.filter((e) => e.action === query.action);
    }
    if (query.resource) {
      filtered = filtered.filter((e) => e.resource === query.resource);
    }
    if (query.result) {
      filtered = filtered.filter((e) => e.result === query.result);
    }
    if (query.since) {
      const since = new Date(query.since).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= since);
    }
    if (query.until) {
      const until = new Date(query.until).getTime();
      filtered = filtered.filter((e) => new Date(e.timestamp).getTime() <= until);
    }

    const total = filtered.length;
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const events = filtered.slice(offset, offset + limit);

    return { events, total, offset, limit };
  }

  getByActor(actor: string): AuditEvent[] {
    return this.events.filter((e) => e.actor === actor);
  }

  getByResource(resource: string): AuditEvent[] {
    return this.events.filter((e) => e.resource === resource);
  }

  export(format?: 'json' | 'csv'): string {
    if (format === 'csv') {
      const headers = ['id', 'actor', 'action', 'resource', 'resourceType', 'result', 'timestamp'];
      const rows = this.events.map((e) =>
        headers
          .map((h) => JSON.stringify((e as unknown as Record<string, unknown>)[h] ?? ''))
          .join(','),
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(this.events, null, 2);
  }

  setRetention(days: number): void {
    this.retentionDays = days;
  }

  prune(): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    const cutoffTime = cutoff.getTime();
    const before = this.events.length;
    this.events = this.events.filter((e) => new Date(e.timestamp).getTime() >= cutoffTime);
    return before - this.events.length;
  }

  size(): number {
    return this.events.length;
  }
}
