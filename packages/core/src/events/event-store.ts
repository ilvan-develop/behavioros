import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BehaviorOSEvent, EventStoreConfig, Snapshot } from './event-types';

// ============================================================
// Event Store — Append-only event log with snapshots
// ============================================================

const DEFAULT_MAX_EVENTS = 100_000;
const DEFAULT_SNAPSHOT_INTERVAL = 100;

export class EventStore {
  private events: BehaviorOSEvent[] = [];
  private snapshots: Snapshot[] = [];
  private maxEvents: number;
  private snapshotInterval: number;
  private persistPath: string | null;

  constructor(config?: EventStoreConfig) {
    this.maxEvents = config?.maxEvents ?? DEFAULT_MAX_EVENTS;
    this.snapshotInterval = config?.snapshotInterval ?? DEFAULT_SNAPSHOT_INTERVAL;
    this.persistPath = config?.persistPath ?? null;

    if (this.persistPath) {
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      this.load();
    }
  }

  // --- Append ---

  append(event: BehaviorOSEvent): void {
    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    if (this.persistPath) {
      this.persist();
    }
  }

  // --- Query Events ---

  getEvents(aggregateId: string): BehaviorOSEvent[] {
    return this.events.filter((e) => e.aggregateId === aggregateId);
  }

  getEventsByType(type: string): BehaviorOSEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  getEventsAfter(timestamp: string): BehaviorOSEvent[] {
    return this.events.filter((e) => e.timestamp > timestamp);
  }

  getAllEvents(): BehaviorOSEvent[] {
    return [...this.events];
  }

  // --- Snapshots ---

  createSnapshot(aggregateId: string, state: unknown): Snapshot {
    const snapshot: Snapshot = {
      aggregateId,
      aggregateType: this.resolveAggregateType(aggregateId),
      state,
      version: this.events.filter((e) => e.aggregateId === aggregateId).length,
      timestamp: new Date().toISOString(),
    };

    this.snapshots.push(snapshot);

    if (this.persistPath) {
      this.persist();
    }

    return snapshot;
  }

  getLatestSnapshot(aggregateId: string): Snapshot | null {
    const aggregateSnapshots = this.snapshots.filter((s) => s.aggregateId === aggregateId);
    return aggregateSnapshots.length > 0 ? aggregateSnapshots[aggregateSnapshots.length - 1] : null;
  }

  getSnapshots(aggregateId: string): Snapshot[] {
    return this.snapshots.filter((s) => s.aggregateId === aggregateId);
  }

  // --- Replay ---

  replay(aggregateId: string): unknown {
    const aggregateEvents = this.getEvents(aggregateId);
    if (aggregateEvents.length === 0) return null;

    let state: Record<string, unknown> = {};
    for (const event of aggregateEvents) {
      state = { ...state, ...(event.payload as Record<string, unknown>) };
    }
    return state;
  }

  replayFrom(timestamp: string): BehaviorOSEvent[] {
    return this.getEventsAfter(timestamp);
  }

  // --- Stats ---

  getStats(): { totalEvents: number; totalSnapshots: number; aggregates: string[] } {
    const aggregates = [...new Set(this.events.map((e) => e.aggregateId))];
    return {
      totalEvents: this.events.length,
      totalSnapshots: this.snapshots.length,
      aggregates,
    };
  }

  // --- Persistence ---

  persist(): void {
    if (!this.persistPath) return;

    const data = JSON.stringify({ events: this.events, snapshots: this.snapshots }, null, 2);
    writeFileSync(this.persistPath, data);
  }

  load(): void {
    if (!this.persistPath) return;

    try {
      if (existsSync(this.persistPath)) {
        const raw = readFileSync(this.persistPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.events = parsed.events ?? [];
        this.snapshots = parsed.snapshots ?? [];
      }
    } catch {
      this.events = [];
      this.snapshots = [];
    }
  }

  // --- Private ---

  private resolveAggregateType(aggregateId: string): string {
    const event = this.events.find((e) => e.aggregateId === aggregateId);
    return event?.aggregateType ?? 'unknown';
  }
}
