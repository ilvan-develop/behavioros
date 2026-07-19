import { createHash } from 'node:crypto';
import EventEmitter from 'eventemitter3';

export type EvidenceType =
  | 'action-log'
  | 'request-response'
  | 'governance-evaluation'
  | 'suspicion-alert'
  | 'quarantine-event'
  | 'sandbox-execution'
  | 'audit-trail';

export type EvidenceSeverity = 'info' | 'warning' | 'critical';

export interface ForensicCollectorConfig {
  maxEntries: number;
  retentionMs: number;
  captureRequestBodies: boolean;
  captureResponseBodies: boolean;
  maxBodySizeBytes: number;
  enableHashing: boolean;
  flushIntervalMs: number;
}

export interface ForensicEntry {
  id: string;
  agentId: string;
  type: EvidenceType;
  severity: EvidenceSeverity;
  timestamp: string;
  action: string;
  request: CapturedData | null;
  response: CapturedData | null;
  metadata: Record<string, unknown>;
  hash: string;
  previousHash: string;
}

export interface CapturedData {
  headers: Record<string, string>;
  body: unknown;
  sizeBytes: number;
  truncated: boolean;
}

export interface ForensicEvidenceReport {
  entries: ForensicEntry[];
  totalEntries: number;
  timeRange: { from: string; to: string };
  chainIntegrity: boolean;
  generatedAt: string;
}

export interface ForensicCollectorEvents {
  'entry-recorded': (entry: ForensicEntry) => void;
  'chain-verified': (valid: boolean, length: number) => void;
  'evidence-exported': (report: ForensicEvidenceReport) => void;
  'entry-pruned': (count: number) => void;
}

export class ForensicCollector {
  private config: ForensicCollectorConfig;
  private entries: ForensicEntry[] = [];
  private emitter = new EventEmitter();
  private lastHash = '0'.repeat(64);
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<ForensicCollectorConfig>) {
    this.config = {
      maxEntries: config?.maxEntries ?? 100_000,
      retentionMs: config?.retentionMs ?? 7_776_000_000,
      captureRequestBodies: config?.captureRequestBodies ?? true,
      captureResponseBodies: config?.captureResponseBodies ?? true,
      maxBodySizeBytes: config?.maxBodySizeBytes ?? 102_400,
      enableHashing: config?.enableHashing ?? true,
      flushIntervalMs: config?.flushIntervalMs ?? 60_000,
    };
  }

  record(
    agentId: string,
    type: EvidenceType,
    action: string,
    options?: {
      request?: { headers?: Record<string, string>; body?: unknown };
      response?: { headers?: Record<string, string>; body?: unknown };
      severity?: EvidenceSeverity;
      metadata?: Record<string, unknown>;
    },
  ): ForensicEntry {
    const entryId = this.generateId();
    const now = new Date().toISOString();

    const request = options?.request
      ? this.captureData(options.request.headers ?? {}, options.request.body)
      : null;

    const response = options?.response
      ? this.captureData(options.response.headers ?? {}, options.response.body)
      : null;

    const payload = JSON.stringify({
      agentId,
      type,
      action,
      request,
      response,
      timestamp: now,
    });

    const hash = this.config.enableHashing ? this.computeHash(payload, this.lastHash) : entryId;

    const entry: ForensicEntry = {
      id: entryId,
      agentId,
      type,
      severity: options?.severity ?? 'info',
      timestamp: now,
      action,
      request,
      response,
      metadata: options?.metadata ?? {},
      hash,
      previousHash: this.lastHash,
    };

    this.lastHash = hash;
    this.entries.push(entry);

    if (this.entries.length > this.config.maxEntries) {
      const pruned = this.entries.splice(0, this.entries.length - this.config.maxEntries);
      this.emitter.emit('entry-pruned', pruned.length);
    }

    this.emitter.emit('entry-recorded', entry);
    return entry;
  }

  recordAction(
    agentId: string,
    action: string,
    result: 'success' | 'failure' | 'blocked',
    metadata?: Record<string, unknown>,
  ): ForensicEntry {
    return this.record(agentId, 'action-log', action, {
      severity: result === 'blocked' ? 'warning' : result === 'failure' ? 'critical' : 'info',
      metadata: { result, ...metadata },
    });
  }

  recordRequestResponse(
    agentId: string,
    action: string,
    request: { headers?: Record<string, string>; body?: unknown },
    response: { headers?: Record<string, string>; body?: unknown },
    metadata?: Record<string, unknown>,
  ): ForensicEntry {
    return this.record(agentId, 'request-response', action, {
      request,
      response,
      metadata,
    });
  }

  recordGovernanceEvaluation(
    agentId: string,
    action: string,
    decision: 'approved' | 'blocked' | 'escalated',
    violations: string[],
    metadata?: Record<string, unknown>,
  ): ForensicEntry {
    return this.record(agentId, 'governance-evaluation', action, {
      severity: decision === 'blocked' ? 'critical' : decision === 'escalated' ? 'warning' : 'info',
      metadata: { decision, violations, ...metadata },
    });
  }

  recordSuspicionAlert(
    agentId: string,
    level: string,
    score: number,
    reasons: string[],
  ): ForensicEntry {
    return this.record(agentId, 'suspicion-alert', 'suspicion-detected', {
      severity: score >= 90 ? 'critical' : score >= 70 ? 'warning' : 'info',
      metadata: { level, score, reasons },
    });
  }

  recordQuarantineEvent(
    agentId: string,
    event: 'quarantined' | 'released' | 'expired',
    reason: string,
  ): ForensicEntry {
    return this.record(agentId, 'quarantine-event', event, {
      severity: event === 'quarantined' ? 'warning' : 'info',
      metadata: { reason },
    });
  }

  getEntry(id: string): ForensicEntry | null {
    return this.entries.find((e) => e.id === id) ?? null;
  }

  getEntries(filter?: {
    agentId?: string;
    type?: EvidenceType;
    severity?: EvidenceSeverity;
    from?: string;
    to?: string;
    limit?: number;
  }): ForensicEntry[] {
    let result = [...this.entries];

    if (filter?.agentId) {
      result = result.filter((e) => e.agentId === filter.agentId);
    }
    if (filter?.type) {
      result = result.filter((e) => e.type === filter.type);
    }
    if (filter?.severity) {
      result = result.filter((e) => e.severity === filter.severity);
    }
    if (filter?.from) {
      const from = new Date(filter.from).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= from);
    }
    if (filter?.to) {
      const to = new Date(filter.to).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= to);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  exportEvidence(filter?: {
    agentId?: string;
    from?: string;
    to?: string;
  }): ForensicEvidenceReport {
    const entries = this.getEntries(filter);

    const chainIntegrity = this.verifyChain(entries);

    const report: ForensicEvidenceReport = {
      entries,
      totalEntries: entries.length,
      timeRange: {
        from: entries.length > 0 ? entries[0].timestamp : new Date().toISOString(),
        to: entries.length > 0 ? entries[entries.length - 1].timestamp : new Date().toISOString(),
      },
      chainIntegrity,
      generatedAt: new Date().toISOString(),
    };

    this.emitter.emit('evidence-exported', report);
    return report;
  }

  verifyChain(entries?: ForensicEntry[]): boolean {
    const chain = entries ?? this.entries;
    if (chain.length === 0) return true;

    let previousHash = '0'.repeat(64);
    for (const entry of chain) {
      if (entry.previousHash !== previousHash) {
        return false;
      }
      previousHash = entry.hash;
    }

    this.emitter.emit('chain-verified', true, chain.length);
    return true;
  }

  getAgentTimeline(agentId: string): ForensicEntry[] {
    return this.entries.filter((e) => e.agentId === agentId);
  }

  getStats(): {
    totalEntries: number;
    byType: Record<EvidenceType, number>;
    bySeverity: Record<EvidenceSeverity, number>;
    uniqueAgents: number;
    chainValid: boolean;
  } {
    const byType = {} as Record<EvidenceType, number>;
    const bySeverity = {} as Record<EvidenceSeverity, number>;
    const agents = new Set<string>();

    for (const entry of this.entries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      bySeverity[entry.severity] = (bySeverity[entry.severity] ?? 0) + 1;
      agents.add(entry.agentId);
    }

    return {
      totalEntries: this.entries.length,
      byType,
      bySeverity,
      uniqueAgents: agents.size,
      chainValid: this.verifyChain(),
    };
  }

  prune(maxAgeMs?: number): number {
    const retention = maxAgeMs ?? this.config.retentionMs;
    const cutoff = Date.now() - retention;
    const before = this.entries.length;

    this.entries = this.entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);

    const pruned = before - this.entries.length;
    if (pruned > 0) {
      this.emitter.emit('entry-pruned', pruned);
    }

    return pruned;
  }

  startPeriodicFlush(): void {
    this.stopPeriodicFlush();
    this.flushTimer = setInterval(() => {
      this.prune();
    }, this.config.flushIntervalMs);
  }

  stopPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  reset(): void {
    this.entries = [];
    this.lastHash = '0'.repeat(64);
    this.stopPeriodicFlush();
  }

  on<K extends keyof ForensicCollectorEvents>(
    event: K,
    listener: ForensicCollectorEvents[K],
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof ForensicCollectorEvents>(
    event: K,
    listener: ForensicCollectorEvents[K],
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  private captureData(headers: Record<string, string>, body: unknown): CapturedData {
    const serialized = JSON.stringify(body ?? null);
    const sizeBytes = new TextEncoder().encode(serialized).length;
    const truncated = sizeBytes > this.config.maxBodySizeBytes;

    let capturedBody: unknown = body;
    if (truncated && this.config.captureResponseBodies) {
      capturedBody = serialized.substring(0, this.config.maxBodySizeBytes);
    } else if (!this.config.captureRequestBodies && body !== undefined) {
      capturedBody = '[redacted]';
    } else if (!this.config.captureResponseBodies && body !== undefined) {
      capturedBody = '[redacted]';
    }

    return { headers, body: capturedBody, sizeBytes, truncated };
  }

  private computeHash(data: string, previousHash: string): string {
    const combined = previousHash + data;
    return createHash('sha256').update(combined).digest('hex');
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `fore_${timestamp}_${random}`;
  }
}
