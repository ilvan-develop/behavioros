/**
 * Severity — Union type: info, warning, error, critical;.
 */
export type Severity = 'info' | 'warning' | 'error' | 'critical';
/**
 * ObservationStatus — Union type: new, acknowledged, investigating, resolved;.
 */
export type ObservationStatus = 'new' | 'acknowledged' | 'investigating' | 'resolved';

/**
 * Observation — Configuration and options interface.
 */
export interface Observation {
  id: string;
  type: string;
  source: string;
  severity: Severity;
  message: string;
  data: Record<string, unknown>;
  status: ObservationStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

/**
 * ObservationEngine — observation engine.
 *
 * Methods: record, get, acknowledge, investigate, resolve, list, getStats, clear.
 */
export class ObservationEngine {
  private observations: Map<string, Observation> = new Map();
  private counter = 0;

  record(
    type: string,
    source: string,
    severity: Severity,
    message: string,
    data?: Record<string, unknown>,
  ): string {
    const id = `obs_${++this.counter}_${Date.now()}`;
    const now = new Date().toISOString();
    const observation: Observation = {
      id,
      type,
      source,
      severity,
      message,
      data: data ?? {},
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
    this.observations.set(id, observation);
    return id;
  }

  get(id: string): Observation | undefined {
    return this.observations.get(id);
  }

  acknowledge(id: string): void {
    const obs = this.observations.get(id);
    if (obs) {
      obs.status = 'acknowledged';
      obs.updatedAt = new Date().toISOString();
    }
  }

  investigate(id: string): void {
    const obs = this.observations.get(id);
    if (obs) {
      obs.status = 'investigating';
      obs.updatedAt = new Date().toISOString();
    }
  }

  resolve(id: string): void {
    const obs = this.observations.get(id);
    if (obs) {
      obs.status = 'resolved';
      obs.updatedAt = new Date().toISOString();
      obs.resolvedAt = new Date().toISOString();
    }
  }

  list(filter?: {
    source?: string;
    type?: string;
    severity?: Severity;
    status?: ObservationStatus;
    since?: string;
    until?: string;
  }): Observation[] {
    const entries = Array.from(this.observations.values());

    if (!filter) return entries;

    return entries.filter((obs) => {
      if (filter.source && obs.source !== filter.source) return false;
      if (filter.type && obs.type !== filter.type) return false;
      if (filter.severity && obs.severity !== filter.severity) return false;
      if (filter.status && obs.status !== filter.status) return false;
      if (filter.since && obs.createdAt < filter.since) return false;
      if (filter.until && obs.createdAt > filter.until) return false;
      return true;
    });
  }

  getStats(): {
    total: number;
    bySeverity: Record<Severity, number>;
    byStatus: Record<ObservationStatus, number>;
  } {
    const entries = Array.from(this.observations.values());
    const bySeverity: Record<Severity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };
    const byStatus: Record<ObservationStatus, number> = {
      new: 0,
      acknowledged: 0,
      investigating: 0,
      resolved: 0,
    };

    for (const obs of entries) {
      bySeverity[obs.severity]++;
      byStatus[obs.status]++;
    }

    return {
      total: entries.length,
      bySeverity,
      byStatus,
    };
  }

  clear(): void {
    this.observations.clear();
    this.counter = 0;
  }
}
