import { randomUUID } from 'node:crypto';
import EventEmitter from 'eventemitter3';

// ============================================================
// Traffic Splitter — Routes traffic between old and new DNA
// ============================================================

/**
 * Supported load balancing strategies for canary routing.
 */
export type SplitStrategy = 'round-robin' | 'random' | 'weighted' | 'sticky';

/**
 * A single route entry mapping traffic to a DNA version.
 */
export interface TrafficRoute {
  /** Unique route ID. */
  id: string;
  /** DNA version identifier (e.g. "v1.0.0" or "v2.0.0-canary"). */
  version: string;
  /** Weight for this route (0-100). */
  weight: number;
  /** Whether this is the canary version. */
  isCanary: boolean;
}

/**
 * A sticky session mapping.
 */
export interface StickySession {
  /** Session identifier (e.g. agent ID, user ID, request ID prefix). */
  sessionId: string;
  /** Version this session is pinned to. */
  pinnedVersion: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 expiry timestamp. */
  expiresAt: string;
}

/**
 * Configuration for the traffic splitter.
 */
export interface TrafficSplitterConfig {
  /** Split strategy. Default: "weighted". */
  strategy: SplitStrategy;
  /** Sticky session TTL in ms. Default: 3600000 (1h). */
  stickySessionTtlMs: number;
  /** Maximum concurrent sticky sessions. Default: 10000. */
  maxStickySessions: number;
}

/**
 * Result of a routing decision.
 */
export interface RoutingDecision {
  /** Unique decision ID. */
  id: string;
  /** Version the request was routed to. */
  routedVersion: string;
  /** Whether this was a sticky session match. */
  stickyMatch: boolean;
  /** Current traffic percentages at decision time. */
  trafficSplit: Record<string, number>;
}

/**
 * Events emitted by the traffic splitter.
 */
export interface TrafficSplitterEvents {
  'route:decision': (decision: RoutingDecision) => void;
  'split:changed': (routes: TrafficRoute[]) => void;
  'sticky:created': (session: StickySession) => void;
}

const DEFAULT_SPLITTER_CONFIG: TrafficSplitterConfig = {
  strategy: 'weighted',
  stickySessionTtlMs: 3_600_000,
  maxStickySessions: 10_000,
};

// ============================================================
// TrafficSplitter
// ============================================================

export class TrafficSplitter extends EventEmitter<TrafficSplitterEvents> {
  private config: TrafficSplitterConfig;
  private routes: TrafficRoute[] = [];
  private stickySessions: Map<string, StickySession> = new Map();
  private roundRobinIndex = 0;

  constructor(config?: Partial<TrafficSplitterConfig>) {
    super();
    this.config = { ...DEFAULT_SPLITTER_CONFIG, ...config };
  }

  // ── Route management ────────────────────────────────────────

  /**
   * Set the traffic split between old and new DNA versions.
   */
  setSplit(canaryWeight: number, stableWeight?: number): TrafficRoute[] {
    const effectiveStable = stableWeight ?? 100 - canaryWeight;

    this.routes = [
      {
        id: randomUUID(),
        version: 'stable',
        weight: effectiveStable,
        isCanary: false,
      },
      {
        id: randomUUID(),
        version: 'canary',
        weight: canaryWeight,
        isCanary: true,
      },
    ];

    this.emit('split:changed', this.routes);
    return this.routes;
  }

  /**
   * Set split with custom version identifiers.
   */
  setVersionedSplit(
    stableVersion: string,
    stableWeight: number,
    canaryVersion: string,
    canaryWeight: number,
  ): TrafficRoute[] {
    this.routes = [
      {
        id: randomUUID(),
        version: stableVersion,
        weight: stableWeight,
        isCanary: false,
      },
      {
        id: randomUUID(),
        version: canaryVersion,
        weight: canaryWeight,
        isCanary: true,
      },
    ];

    this.emit('split:changed', this.routes);
    return this.routes;
  }

  // ── Routing ─────────────────────────────────────────────────

  /**
   * Route a request to the appropriate DNA version.
   */
  route(sessionId?: string): RoutingDecision {
    let routedVersion: string;
    let stickyMatch = false;

    if (sessionId) {
      const existing = this.stickySessions.get(sessionId);
      if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
        routedVersion = existing.pinnedVersion;
        stickyMatch = true;
      } else {
        if (existing) this.stickySessions.delete(sessionId);
        routedVersion = this.resolveRoute();
        if (this.config.strategy === 'sticky') {
          this.createStickySession(sessionId, routedVersion);
          stickyMatch = true;
        }
      }
    } else {
      routedVersion = this.resolveRoute();
    }

    const decision: RoutingDecision = {
      id: randomUUID(),
      routedVersion,
      stickyMatch,
      trafficSplit: this.getTrafficSplit(),
    };

    this.emit('route:decision', decision);
    return decision;
  }

  // ── Sticky sessions ─────────────────────────────────────────

  /**
   * Manually create a sticky session for a given ID.
   */
  createStickySession(sessionId: string, version: string): StickySession {
    if (this.stickySessions.size >= this.config.maxStickySessions) {
      this.evictOldestSession();
    }

    const now = Date.now();
    const session: StickySession = {
      sessionId,
      pinnedVersion: version,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.config.stickySessionTtlMs).toISOString(),
    };

    this.stickySessions.set(sessionId, session);
    this.emit('sticky:created', session);
    return session;
  }

  /**
   * Remove a sticky session.
   */
  removeStickySession(sessionId: string): boolean {
    return this.stickySessions.delete(sessionId);
  }

  /**
   * Get all active sticky sessions.
   */
  getStickySessions(): StickySession[] {
    return Array.from(this.stickySessions.values()).filter(
      (s) => new Date(s.expiresAt).getTime() > Date.now(),
    );
  }

  // ── Query ───────────────────────────────────────────────────

  /**
   * Get current traffic split as a version → percentage map.
   */
  getTrafficSplit(): Record<string, number> {
    const split: Record<string, number> = {};
    for (const route of this.routes) {
      split[route.version] = route.weight;
    }
    return split;
  }

  /**
   * Get all routes.
   */
  getRoutes(): TrafficRoute[] {
    return [...this.routes];
  }

  /**
   * Get the canary route, if any.
   */
  getCanaryRoute(): TrafficRoute | undefined {
    return this.routes.find((r) => r.isCanary);
  }

  /**
   * Get the stable route, if any.
   */
  getStableRoute(): TrafficRoute | undefined {
    return this.routes.find((r) => !r.isCanary);
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<TrafficSplitterConfig> {
    return this.config;
  }

  // ── Reset ───────────────────────────────────────────────────

  /**
   * Reset all routes and sticky sessions.
   */
  reset(): void {
    this.routes = [];
    this.stickySessions.clear();
    this.roundRobinIndex = 0;
  }

  // ── Private ─────────────────────────────────────────────────

  private resolveRoute(): string {
    if (this.routes.length === 0) return 'stable';

    switch (this.config.strategy) {
      case 'round-robin':
        return this.resolveRoundRobin();
      case 'random':
        return this.resolveRandom();
      default:
        return this.resolveWeighted();
    }
  }

  private resolveRoundRobin(): string {
    const idx = this.roundRobinIndex % this.routes.length;
    this.roundRobinIndex++;
    return this.routes[idx].version;
  }

  private resolveRandom(): string {
    const totalWeight = this.routes.reduce((sum, r) => sum + r.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const route of this.routes) {
      roll -= route.weight;
      if (roll <= 0) return route.version;
    }
    return this.routes[this.routes.length - 1].version;
  }

  private resolveWeighted(): string {
    const totalWeight = this.routes.reduce((sum, r) => sum + r.weight, 0);
    if (totalWeight === 0) return this.routes[0].version;

    let roll = Math.random() * totalWeight;
    for (const route of this.routes) {
      roll -= route.weight;
      if (roll <= 0) return route.version;
    }
    return this.routes[this.routes.length - 1].version;
  }

  private evictOldestSession(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, session] of this.stickySessions) {
      const time = new Date(session.createdAt).getTime();
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }
    if (oldestKey) this.stickySessions.delete(oldestKey);
  }
}
