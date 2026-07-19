import EventEmitter from 'eventemitter3';

export type QuarantineReason =
  | 'suspicion-threshold'
  | 'privilege-escalation'
  | 'repeated-failure'
  | 'manual'
  | 'audit-failure'
  | 'governance-block';

export type QuarantineStatus = 'active' | 'expired' | 'released' | 'escalated';

export interface QuarantineManagerConfig {
  defaultDurationMs: number;
  maxDurationMs: number;
  autoReleaseEnabled: boolean;
  checkIntervalMs: number;
  maxQuarantinedAgents: number;
  escalationThresholdMs: number;
}

export interface QuarantineEntry {
  agentId: string;
  reason: QuarantineReason;
  status: QuarantineStatus;
  quarantinedAt: string;
  expiresAt: string;
  releasedAt: string | null;
  releasedBy: string | null;
  durationMs: number;
  metadata: Record<string, unknown>;
}

export interface QuarantineResult {
  success: boolean;
  entry: QuarantineEntry | null;
  reason: string;
}

export interface QuarantineManagerEvents {
  'agent-quarantined': (entry: QuarantineEntry) => void;
  'agent-released': (entry: QuarantineEntry) => void;
  'agent-auto-released': (entry: QuarantineEntry) => void;
  'quarantine-expired': (entry: QuarantineEntry) => void;
  'escalation-required': (entry: QuarantineEntry) => void;
  'action-blocked': (agentId: string, reason: string) => void;
}

export class QuarantineManager {
  private config: QuarantineManagerConfig;
  private entries: Map<string, QuarantineEntry> = new Map();
  private history: QuarantineEntry[] = [];
  private emitter = new EventEmitter();
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<QuarantineManagerConfig>) {
    this.config = {
      defaultDurationMs: config?.defaultDurationMs ?? 300_000,
      maxDurationMs: config?.maxDurationMs ?? 3_600_000,
      autoReleaseEnabled: config?.autoReleaseEnabled ?? true,
      checkIntervalMs: config?.checkIntervalMs ?? 30_000,
      maxQuarantinedAgents: config?.maxQuarantinedAgents ?? 500,
      escalationThresholdMs: config?.escalationThresholdMs ?? 1_800_000,
    };

    if (this.config.autoReleaseEnabled) {
      this.startAutoReleaseCheck();
    }
  }

  quarantine(
    agentId: string,
    reason: QuarantineReason,
    durationMs?: number,
    metadata?: Record<string, unknown>,
  ): QuarantineResult {
    if (this.entries.has(agentId)) {
      const existing = this.entries.get(agentId)!;
      return {
        success: false,
        entry: existing,
        reason: `Agent "${agentId}" is already quarantined since ${existing.quarantinedAt}`,
      };
    }

    if (this.entries.size >= this.config.maxQuarantinedAgents) {
      return {
        success: false,
        entry: null,
        reason: `Maximum quarantined agents reached (${this.config.maxQuarantinedAgents})`,
      };
    }

    const now = new Date();
    const duration = Math.min(
      durationMs ?? this.config.defaultDurationMs,
      this.config.maxDurationMs,
    );
    const expiresAt = new Date(now.getTime() + duration);

    const entry: QuarantineEntry = {
      agentId,
      reason,
      status: 'active',
      quarantinedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      releasedAt: null,
      releasedBy: null,
      durationMs: duration,
      metadata: metadata ?? {},
    };

    this.entries.set(agentId, entry);
    this.emitter.emit('agent-quarantined', entry);

    if (duration >= this.config.escalationThresholdMs) {
      this.emitter.emit('escalation-required', entry);
    }

    return { success: true, entry, reason: `Agent "${agentId}" quarantined for ${duration}ms` };
  }

  release(agentId: string, releasedBy: string = 'system'): QuarantineResult {
    const entry = this.entries.get(agentId);
    if (!entry) {
      return {
        success: false,
        entry: null,
        reason: `Agent "${agentId}" is not quarantined`,
      };
    }

    if (entry.status !== 'active') {
      return {
        success: false,
        entry,
        reason: `Agent "${agentId}" quarantine is already ${entry.status}`,
      };
    }

    const now = new Date();
    entry.status = 'released';
    entry.releasedAt = now.toISOString();
    entry.releasedBy = releasedBy;

    this.entries.delete(agentId);
    this.history.push({ ...entry });
    this.emitter.emit('agent-released', entry);

    return { success: true, entry, reason: `Agent "${agentId}" released by ${releasedBy}` };
  }

  isQuarantined(agentId: string): boolean {
    const entry = this.entries.get(agentId);
    if (!entry) return false;

    if (entry.status !== 'active') {
      return false;
    }

    if (new Date() >= new Date(entry.expiresAt)) {
      this.handleExpiration(entry);
      return false;
    }

    return true;
  }

  checkAction(agentId: string, action: string): { allowed: boolean; reason: string } {
    if (!this.isQuarantined(agentId)) {
      return { allowed: true, reason: 'Agent is not quarantined' };
    }

    const entry = this.entries.get(agentId)!;
    this.emitter.emit('action-blocked', agentId, action);

    return {
      allowed: false,
      reason: `Agent "${agentId}" is quarantined (reason: ${entry.reason}) — action "${action}" blocked`,
    };
  }

  getEntry(agentId: string): QuarantineEntry | null {
    return this.entries.get(agentId) ?? null;
  }

  getActiveQuarantines(): QuarantineEntry[] {
    return [...this.entries.values()].filter((e) => e.status === 'active');
  }

  getHistory(agentId?: string): QuarantineEntry[] {
    if (agentId) {
      return this.history.filter((e) => e.agentId === agentId);
    }
    return [...this.history];
  }

  getStats(): {
    active: number;
    total: number;
    released: number;
    expired: number;
    escalated: number;
  } {
    const all = [...this.history, ...this.entries.values()];
    return {
      active: [...this.entries.values()].filter((e) => e.status === 'active').length,
      total: all.length,
      released: all.filter((e) => e.status === 'released').length,
      expired: all.filter((e) => e.status === 'expired').length,
      escalated: all.filter((e) => e.status === 'escalated').length,
    };
  }

  forceReleaseAll(): number {
    let count = 0;
    for (const [_agentId, entry] of this.entries) {
      if (entry.status === 'active') {
        entry.status = 'released';
        entry.releasedAt = new Date().toISOString();
        entry.releasedBy = 'force-release';
        this.history.push({ ...entry });
        this.emitter.emit('agent-released', entry);
        count++;
      }
    }
    this.entries.clear();
    return count;
  }

  reset(): void {
    this.entries.clear();
    this.history = [];
    this.stopAutoReleaseCheck();
  }

  startAutoReleaseCheck(): void {
    this.stopAutoReleaseCheck();
    this.checkTimer = setInterval(() => {
      this.checkExpiredEntries();
    }, this.config.checkIntervalMs);
  }

  stopAutoReleaseCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  on<K extends keyof QuarantineManagerEvents>(
    event: K,
    listener: QuarantineManagerEvents[K],
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof QuarantineManagerEvents>(
    event: K,
    listener: QuarantineManagerEvents[K],
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  private checkExpiredEntries(): void {
    const now = new Date();
    for (const [_agentId, entry] of this.entries) {
      if (entry.status !== 'active') continue;

      if (now >= new Date(entry.expiresAt)) {
        this.handleExpiration(entry);
      }
    }
  }

  private handleExpiration(entry: QuarantineEntry): void {
    entry.status = 'expired';
    entry.releasedAt = new Date().toISOString();
    this.entries.delete(entry.agentId);
    this.history.push({ ...entry });
    this.emitter.emit('quarantine-expired', entry);
    this.emitter.emit('agent-auto-released', entry);
  }
}
