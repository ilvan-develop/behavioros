import EventEmitter from 'eventemitter3';

export type SuspicionLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export type AnomalyType =
  | 'rate-spike'
  | 'unauthorized-access'
  | 'privilege-escalation'
  | 'data-exfiltration'
  | 'repeated-failure'
  | 'pattern-deviation'
  | 'off-hours-activity'
  | 'scope-creep';

export interface SuspicionDetectorConfig {
  failureThreshold: number;
  failureWindowMs: number;
  rateSpikeMultiplier: number;
  rateBaselineWindowMs: number;
  anomalyScoreThreshold: number;
  coolDownMs: number;
  maxTrackedAgents: number;
}

export interface AgentBehaviorSnapshot {
  agentId: string;
  totalRequests: number;
  failedRequests: number;
  successRate: number;
  avgRequestsPerMinute: number;
  uniqueActions: string[];
  lastActivity: string;
  consecutiveFailures: number;
}

export interface SuspicionEvent {
  agentId: string;
  anomalyType: AnomalyType;
  level: SuspicionLevel;
  score: number;
  details: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface SuspicionResult {
  agentId: string;
  level: SuspicionLevel;
  score: number;
  reasons: string[];
  shouldQuarantine: boolean;
  events: SuspicionEvent[];
}

export interface SuspicionDetectorEvents {
  'suspicion-detected': (event: SuspicionEvent) => void;
  'level-changed': (agentId: string, from: SuspicionLevel, to: SuspicionLevel) => void;
  'quarantine-recommended': (agentId: string, reason: string) => void;
  'agent-cleared': (agentId: string) => void;
}

interface RequestRecord {
  timestamp: number;
  action: string;
  success: boolean;
}

interface AgentTracking {
  requests: RequestRecord[];
  totalRequests: number;
  failedRequests: number;
  consecutiveFailures: number;
  lastActivity: number;
  level: SuspicionLevel;
  score: number;
  events: SuspicionEvent[];
  actions: Map<string, number>;
}

const SCORE_WEIGHTS: Record<AnomalyType, number> = {
  'rate-spike': 25,
  'unauthorized-access': 40,
  'privilege-escalation': 50,
  'data-exfiltration': 45,
  'repeated-failure': 20,
  'pattern-deviation': 15,
  'off-hours-activity': 10,
  'scope-creep': 30,
};

const LEVEL_THRESHOLDS: Record<SuspicionLevel, number> = {
  none: 0,
  low: 20,
  medium: 45,
  high: 70,
  critical: 90,
};

export class SuspicionDetector {
  private config: SuspicionDetectorConfig;
  private agents: Map<string, AgentTracking> = new Map();
  private emitter = new EventEmitter();
  private globalBaseline: { totalRequests: number; windowStart: number } = {
    totalRequests: 0,
    windowStart: Date.now(),
  };

  constructor(config?: Partial<SuspicionDetectorConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 10,
      failureWindowMs: config?.failureWindowMs ?? 300_000,
      rateSpikeMultiplier: config?.rateSpikeMultiplier ?? 3,
      rateBaselineWindowMs: config?.rateBaselineWindowMs ?? 600_000,
      anomalyScoreThreshold: config?.anomalyScoreThreshold ?? 45,
      coolDownMs: config?.coolDownMs ?? 120_000,
      maxTrackedAgents: config?.maxTrackedAgents ?? 1_000,
    };
  }

  recordRequest(agentId: string, action: string, success: boolean): SuspicionResult {
    const tracking = this.getOrCreateTracking(agentId);
    const now = Date.now();

    tracking.requests.push({ timestamp: now, action, success });
    tracking.totalRequests++;
    tracking.lastActivity = now;

    if (!success) {
      tracking.failedRequests++;
      tracking.consecutiveFailures++;
    } else {
      tracking.consecutiveFailures = 0;
    }

    const actionCount = tracking.actions.get(action) ?? 0;
    tracking.actions.set(action, actionCount + 1);

    this.pruneRequests(tracking);
    this.globalBaseline.totalRequests++;

    const events: SuspicionEvent[] = [];

    const failureEvent = this.checkRepeatedFailures(agentId, tracking);
    if (failureEvent) events.push(failureEvent);

    const rateEvent = this.checkRateSpike(agentId, tracking);
    if (rateEvent) events.push(rateEvent);

    const patternEvent = this.checkPatternDeviation(agentId, tracking);
    if (patternEvent) events.push(patternEvent);

    for (const event of events) {
      tracking.events.push(event);
      tracking.score = Math.min(100, tracking.score + event.score);
      this.emitter.emit('suspicion-detected', event);
    }

    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit('level-changed', agentId, prev, newLevel);

      if (newLevel === 'critical' || newLevel === 'high') {
        this.emitter.emit(
          'quarantine-recommended',
          agentId,
          `Suspicion level reached ${newLevel} (score: ${tracking.score})`,
        );
      }
    }

    return {
      agentId,
      level: tracking.level,
      score: tracking.score,
      reasons: events.map((e) => e.details),
      shouldQuarantine: tracking.level === 'critical',
      events,
    };
  }

  checkAccess(agentId: string, resource: string, allowedResources: string[]): SuspicionResult {
    const tracking = this.getOrCreateTracking(agentId);
    const isAuthorized = allowedResources.includes(resource);

    const events: SuspicionEvent[] = [];

    if (!isAuthorized) {
      const event: SuspicionEvent = {
        agentId,
        anomalyType: 'unauthorized-access',
        level: 'high',
        score: SCORE_WEIGHTS['unauthorized-access'],
        details: `Unauthorized access attempt to "${resource}"`,
        timestamp: new Date().toISOString(),
        metadata: { resource, allowedResources },
      };
      events.push(event);
      tracking.events.push(event);
      tracking.score = Math.min(100, tracking.score + event.score);
      this.emitter.emit('suspicion-detected', event);
    }

    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit('level-changed', agentId, prev, newLevel);
    }

    return {
      agentId,
      level: tracking.level,
      score: tracking.score,
      reasons: events.map((e) => e.details),
      shouldQuarantine: tracking.level === 'critical',
      events,
    };
  }

  checkPrivilegeEscalation(
    agentId: string,
    requestedAuthority: string,
    allowedAuthority: string,
  ): SuspicionResult {
    const tracking = this.getOrCreateTracking(agentId);
    const events: SuspicionEvent[] = [];

    if (requestedAuthority !== allowedAuthority) {
      const event: SuspicionEvent = {
        agentId,
        anomalyType: 'privilege-escalation',
        level: 'critical',
        score: SCORE_WEIGHTS['privilege-escalation'],
        details: `Privilege escalation attempt — requested "${requestedAuthority}", allowed "${allowedAuthority}"`,
        timestamp: new Date().toISOString(),
        metadata: { requestedAuthority, allowedAuthority },
      };
      events.push(event);
      tracking.events.push(event);
      tracking.score = Math.min(100, tracking.score + event.score);
      this.emitter.emit('suspicion-detected', event);
    }

    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit('level-changed', agentId, prev, newLevel);

      if (newLevel === 'critical') {
        this.emitter.emit('quarantine-recommended', agentId, 'Privilege escalation detected');
      }
    }

    return {
      agentId,
      level: tracking.level,
      score: tracking.score,
      reasons: events.map((e) => e.details),
      shouldQuarantine: tracking.level === 'critical',
      events,
    };
  }

  getSnapshot(agentId: string): AgentBehaviorSnapshot | null {
    const tracking = this.agents.get(agentId);
    if (!tracking) return null;

    const successRate =
      tracking.totalRequests > 0
        ? ((tracking.totalRequests - tracking.failedRequests) / tracking.totalRequests) * 100
        : 100;

    const windowMs = this.config.rateBaselineWindowMs;
    const recentRequests = tracking.requests.filter((r) => r.timestamp >= Date.now() - windowMs);
    const avgPerMinute = recentRequests.length / (windowMs / 60_000);

    return {
      agentId,
      totalRequests: tracking.totalRequests,
      failedRequests: tracking.failedRequests,
      successRate,
      avgRequestsPerMinute: avgPerMinute,
      uniqueActions: [...tracking.actions.keys()],
      lastActivity: new Date(tracking.lastActivity).toISOString(),
      consecutiveFailures: tracking.consecutiveFailures,
    };
  }

  getLevel(agentId: string): SuspicionLevel {
    return this.agents.get(agentId)?.level ?? 'none';
  }

  getScore(agentId: string): number {
    return this.agents.get(agentId)?.score ?? 0;
  }

  getEvents(agentId: string): SuspicionEvent[] {
    return [...(this.agents.get(agentId)?.events ?? [])];
  }

  getAllSuspicious(): Array<{ agentId: string; level: SuspicionLevel; score: number }> {
    const result: Array<{ agentId: string; level: SuspicionLevel; score: number }> = [];
    for (const [agentId, tracking] of this.agents) {
      if (tracking.level !== 'none') {
        result.push({ agentId, level: tracking.level, score: tracking.score });
      }
    }
    return result.sort((a, b) => b.score - a.score);
  }

  resetAgent(agentId: string): void {
    this.agents.delete(agentId);
    this.emitter.emit('agent-cleared', agentId);
  }

  decayScore(agentId: string, decayAmount: number = 5): void {
    const tracking = this.agents.get(agentId);
    if (!tracking) return;

    tracking.score = Math.max(0, tracking.score - decayAmount);
    const newLevel = this.calculateLevel(tracking.score);
    if (newLevel !== tracking.level) {
      const prev = tracking.level;
      tracking.level = newLevel;
      this.emitter.emit('level-changed', agentId, prev, newLevel);
    }
  }

  reset(): void {
    this.agents.clear();
    this.globalBaseline = { totalRequests: 0, windowStart: Date.now() };
  }

  on<K extends keyof SuspicionDetectorEvents>(
    event: K,
    listener: SuspicionDetectorEvents[K],
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof SuspicionDetectorEvents>(
    event: K,
    listener: SuspicionDetectorEvents[K],
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  private getOrCreateTracking(agentId: string): AgentTracking {
    let tracking = this.agents.get(agentId);
    if (tracking) return tracking;

    if (this.agents.size >= this.config.maxTrackedAgents) {
      const oldest = this.agents.entries().next().value;
      if (oldest) this.agents.delete(oldest[0]);
    }

    tracking = {
      requests: [],
      totalRequests: 0,
      failedRequests: 0,
      consecutiveFailures: 0,
      lastActivity: Date.now(),
      level: 'none',
      score: 0,
      events: [],
      actions: new Map(),
    };
    this.agents.set(agentId, tracking);
    return tracking;
  }

  private checkRepeatedFailures(agentId: string, tracking: AgentTracking): SuspicionEvent | null {
    if (tracking.consecutiveFailures < this.config.failureThreshold) return null;

    const recentFailures = tracking.requests.filter(
      (r) => !r.success && r.timestamp >= Date.now() - this.config.failureWindowMs,
    );

    if (recentFailures.length < this.config.failureThreshold) return null;

    return {
      agentId,
      anomalyType: 'repeated-failure',
      level: 'high',
      score: SCORE_WEIGHTS['repeated-failure'],
      details: `${recentFailures.length} consecutive failures in ${this.config.failureWindowMs}ms window (threshold: ${this.config.failureThreshold})`,
      timestamp: new Date().toISOString(),
      metadata: {
        consecutiveFailures: tracking.consecutiveFailures,
        windowFailures: recentFailures.length,
      },
    };
  }

  private checkRateSpike(agentId: string, tracking: AgentTracking): SuspicionEvent | null {
    const now = Date.now();
    const windowMs = this.config.rateBaselineWindowMs;

    const recentRequests = tracking.requests.filter((r) => r.timestamp >= now - windowMs);
    if (recentRequests.length < 20) return null;

    const currentRate = recentRequests.length / (windowMs / 60_000);

    const olderRequests = tracking.requests.filter(
      (r) => r.timestamp >= now - windowMs * 2 && r.timestamp < now - windowMs,
    );
    const baselineRate =
      olderRequests.length > 0 ? olderRequests.length / (windowMs / 60_000) : currentRate;

    if (baselineRate === 0) return null;

    const ratio = currentRate / baselineRate;
    if (ratio < this.config.rateSpikeMultiplier) return null;

    return {
      agentId,
      anomalyType: 'rate-spike',
      level: 'high',
      score: SCORE_WEIGHTS['rate-spike'],
      details: `Rate spike detected — ${currentRate.toFixed(1)} req/min vs baseline ${baselineRate.toFixed(1)} req/min (${ratio.toFixed(1)}x)`,
      timestamp: new Date().toISOString(),
      metadata: { currentRate, baselineRate, ratio },
    };
  }

  private checkPatternDeviation(agentId: string, tracking: AgentTracking): SuspicionEvent | null {
    if (tracking.totalRequests < 50) return null;

    const actionEntries = [...tracking.actions.entries()];
    const totalActions = actionEntries.reduce((sum, [, count]) => sum + count, 0);

    let entropy = 0;
    for (const [, count] of actionEntries) {
      const probability = count / totalActions;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    const maxEntropy = Math.log2(Math.max(1, actionEntries.length));
    const normalizedEntropy = maxEntropy > 0 ? entropy / maxEntropy : 1;

    if (normalizedEntropy > 0.7) return null;

    return {
      agentId,
      anomalyType: 'pattern-deviation',
      level: 'medium',
      score: SCORE_WEIGHTS['pattern-deviation'],
      details: `Low action entropy (${normalizedEntropy.toFixed(2)}) — highly concentrated behavior pattern`,
      timestamp: new Date().toISOString(),
      metadata: { entropy: normalizedEntropy, actionCount: actionEntries.length },
    };
  }

  private calculateLevel(score: number): SuspicionLevel {
    if (score >= LEVEL_THRESHOLDS.critical) return 'critical';
    if (score >= LEVEL_THRESHOLDS.high) return 'high';
    if (score >= LEVEL_THRESHOLDS.medium) return 'medium';
    if (score >= LEVEL_THRESHOLDS.low) return 'low';
    return 'none';
  }

  private pruneRequests(tracking: AgentTracking): void {
    const cutoff = Date.now() - this.config.rateBaselineWindowMs * 2;
    tracking.requests = tracking.requests.filter((r) => r.timestamp >= cutoff);
  }
}
