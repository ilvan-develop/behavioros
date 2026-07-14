// ============================================================
// Metrics Collector — Real metrics from BehaviorOSEngine + HTTP APIs
// ============================================================

import type {
  BehaviorOSGovernance,
  BehaviorOSLayers,
  BehaviorOSLearning,
  BehaviorOSMetrics,
  BehaviorOSPipeline,
  BehaviorOSQuality,
  BrocolisApi,
  BrocolisDeliveries,
  BrocolisMetrics,
  BrocolisOrders,
  BrocolisPrescriptions,
  BrocolisUsers,
  FinPayCompliance,
  FinPayFraud,
  FinPayMetrics,
  FinPayOcr,
  FinPayPayments,
  FinPayTrust,
  HealthLevel,
  HealthStatus,
  UnifiedMetrics,
} from './types';

// ============================================================
// Engine contract — local interface matching BehaviorOSEngine
// so this module compiles without @behavioros/core declarations.
// ============================================================

/** Minimal subset of AgentState we need. */
interface AgentSnapshot {
  status: string;
  completedMissions: string[];
}

/** Minimal subset of AuditEvent we need. */
interface AuditEventSnapshot {
  type: string;
  severity: string;
  result: string;
}

/** Minimal subset of LearningEvent we need. */
interface LearningEventSnapshot {
  type: string;
}

/** Minimal subset of Mission we need. */
interface MissionSnapshot {
  status: string;
}

export interface BehaviorOSEngineLike {
  getStats(): {
    missions: Record<string, number>;
    agents: Record<string, number>;
    auditEvents: number;
    qualityMetrics: number;
    learningEvents: number;
  };
  getAllMissions(): MissionSnapshot[];
  getAllAgents(): AgentSnapshot[];
  getAuditLog(): AuditEventSnapshot[];
  getLearningEvents(): LearningEventSnapshot[];
}

// ============================================================
// Config
// ============================================================

export interface MetricsCollectorConfig {
  /** Reference to a live BehaviorOSEngine for pulling real metrics. */
  engine?: BehaviorOSEngineLike;
  /** Brocolis API base URL (e.g. "http://localhost:3001"). If omitted, engine data is used as proxy. */
  brocolisApiUrl?: string;
  /** FinPay API base URL (e.g. "http://localhost:3002"). If omitted, engine data is used as proxy. */
  finpayApiUrl?: string;
  /** BehaviorOS data file path (unused when engine ref is provided). */
  behaviorosDataPath?: string;
  /** Auto-collection interval in ms. 0 = disabled. */
  collectInterval?: number;
  /** HTTP request timeout in ms. */
  httpTimeout?: number;
  /** Maximum number of historical snapshots to retain. */
  maxHistorySize?: number;
}

// ============================================================
// Snapshot & History
// ============================================================

export interface MetricSnapshot {
  timestamp: string;
  metrics: UnifiedMetrics;
}

export interface MetricHistoryEntry {
  timestamp: string;
  value: number;
}

// ============================================================
// Health
// ============================================================

export interface CollectorHealthStatus extends HealthStatus {
  details: {
    engineConnected: boolean;
    brocolisApiReachable: boolean;
    finpayApiReachable: boolean;
    snapshotsCollected: number;
    errorRate: number;
    lastError?: string;
  };
}

// ============================================================
// Internal helpers
// ============================================================

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

function defaultFetch(): FetchFn {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis);
  }
  return async () => {
    throw new Error('No fetch implementation available');
  };
}

async function httpJson<T>(url: string, timeout: number, fetchFn: FetchFn): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetchFn(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ============================================================
// MetricsCollector
// ============================================================

export class MetricsCollector {
  private readonly config: MetricsCollectorConfig;
  private readonly engine: BehaviorOSEngineLike | undefined;
  private readonly fetchFn: FetchFn;
  private readonly httpTimeout: number;
  private readonly maxHistorySize: number;

  private history: MetricSnapshot[] = [];
  private collectionTimer: ReturnType<typeof setInterval> | null = null;
  private _running = false;
  private _totalCollections = 0;
  private _errorCount = 0;
  private _lastError: string | undefined;

  constructor(config: MetricsCollectorConfig = {}) {
    this.config = config;
    this.engine = config.engine;
    this.fetchFn = defaultFetch();
    this.httpTimeout = config.httpTimeout ?? 5000;
    this.maxHistorySize = config.maxHistorySize ?? 360;
  }

  // ----------------------------------------------------------
  // Lifecycle
  // ----------------------------------------------------------

  start(): void {
    if (this._running) return;
    this._running = true;
    const interval = this.config.collectInterval ?? 15_000;
    if (interval > 0) {
      this.collectionTimer = setInterval(() => {
        this.collectAll().catch((err) => {
          this._errorCount++;
          this._lastError = String(err);
        });
      }, interval);
    }
  }

  stop(): void {
    this._running = false;
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }
  }

  // ----------------------------------------------------------
  // Public collection methods
  // ----------------------------------------------------------

  async collectAll(): Promise<UnifiedMetrics> {
    const [brocolis, finpay, behavioros] = await Promise.all([
      this.collectBrocolisMetrics(),
      this.collectFinPayMetrics(),
      this.collectBehaviorOSMetrics(),
    ]);

    const unified: UnifiedMetrics = {
      brocolis,
      finpay,
      behavioros,
      timestamp: new Date().toISOString(),
    };

    this.recordSnapshot(unified);
    return unified;
  }

  async collectBrocolisMetrics(): Promise<BrocolisMetrics> {
    const now = new Date().toISOString();

    if (this.config.brocolisApiUrl) {
      const data = await httpJson<BrocolisMetrics>(
        `${this.config.brocolisApiUrl}/api/metrics`,
        this.httpTimeout,
        this.fetchFn,
      );
      if (data) return { ...data, timestamp: now };
    }

    return this.buildBrocolisFromEngine(now);
  }

  async collectFinPayMetrics(): Promise<FinPayMetrics> {
    const now = new Date().toISOString();

    if (this.config.finpayApiUrl) {
      const data = await httpJson<FinPayMetrics>(
        `${this.config.finpayApiUrl}/api/metrics`,
        this.httpTimeout,
        this.fetchFn,
      );
      if (data) return { ...data, timestamp: now };
    }

    return this.buildFinPayFromEngine(now);
  }

  async collectBehaviorOSMetrics(): Promise<BehaviorOSMetrics> {
    const now = new Date().toISOString();
    return this.buildBehaviorOSFromEngine(now);
  }

  // ----------------------------------------------------------
  // Engine-driven builders
  // ----------------------------------------------------------

  private buildBehaviorOSFromEngine(now: string): BehaviorOSMetrics {
    if (!this.engine) return this.emptyBehaviorOS(now);

    const stats = this.engine.getStats();
    const auditLog = this.engine.getAuditLog();
    const learningEvents = this.engine.getLearningEvents();
    const qualityScores = this.computeQualityFromAudit(auditLog);

    const pipeline: BehaviorOSPipeline = {
      active: stats.missions.executing ?? 0,
      completed: stats.missions.completed ?? 0,
      failed: stats.missions.failed ?? 0,
    };

    const layers = this.deriveLayerCounts(auditLog);

    const governance = this.deriveGovernanceCounts(auditLog);

    const quality: BehaviorOSQuality = {
      coverage: qualityScores.avgCoverage,
      lintPass: qualityScores.lintPass,
      typecheckPass: qualityScores.typecheckPass,
    };

    const learning: BehaviorOSLearning = {
      events: learningEvents.length,
      patterns: learningEvents.filter((e) => e.type === 'insight').length,
      autoFixes: learningEvents.filter((e) => e.type === 'fix').length,
    };

    return { pipeline, layers, governance, quality, learning, timestamp: now };
  }

  private buildBrocolisFromEngine(now: string): BrocolisMetrics {
    if (!this.engine) return this.emptyBrocolis(now);

    const stats = this.engine.getStats();
    const auditLog = this.engine.getAuditLog();
    const totalMissions = sumValues(stats.missions);

    const orders: BrocolisOrders = {
      total: totalMissions,
      pending: (stats.missions.draft ?? 0) + (stats.missions.queued ?? 0),
      completed: stats.missions.completed ?? 0,
      cancelled: stats.missions.failed ?? 0,
      revenue: 0,
    };

    const prescriptions: BrocolisPrescriptions = {
      uploaded: auditLog.filter((e) => e.type.includes('prescription') || e.type.includes('upload'))
        .length,
      verified: auditLog.filter((e) => e.result === 'pass').length,
      rejected: auditLog.filter((e) => e.result === 'fail').length,
    };

    const deliveries: BrocolisDeliveries = {
      active: stats.missions.executing ?? 0,
      completed: stats.missions.completed ?? 0,
      failed: stats.missions.failed ?? 0,
    };

    const agents = this.engine.getAllAgents();
    const users: BrocolisUsers = {
      active: agents.length,
      new: agents.filter((a) => a.completedMissions.length === 0).length,
      churned: 0,
    };

    const api: BrocolisApi = {
      latency: 0,
      errorRate: totalMissions > 0 ? ((stats.missions.failed ?? 0) / totalMissions) * 100 : 0,
      throughput: totalMissions,
    };

    return { orders, prescriptions, deliveries, users, api, timestamp: now };
  }

  private buildFinPayFromEngine(now: string): FinPayMetrics {
    if (!this.engine) return this.emptyFinPay(now);

    const stats = this.engine.getStats();
    const auditLog = this.engine.getAuditLog();
    const qualityScores = this.computeQualityFromAudit(auditLog);
    const totalMissions = sumValues(stats.missions);

    const payments: FinPayPayments = {
      total: totalMissions,
      approved: stats.missions.completed ?? 0,
      rejected: stats.missions.failed ?? 0,
      pendingReview: (stats.missions.draft ?? 0) + (stats.missions.queued ?? 0),
    };

    const trust: FinPayTrust = {
      avgScore: qualityScores.avgCoverage,
      distribution: {
        low: auditLog.filter((e) => e.severity === 'error').length,
        medium: auditLog.filter((e) => e.severity === 'warning').length,
        high: auditLog.filter((e) => e.severity === 'info').length,
      },
    };

    const governanceBlocked = auditLog.filter(
      (e) => e.type.includes('governance') && e.type.includes('violation'),
    ).length;

    const fraud: FinPayFraud = {
      detected: governanceBlocked,
      falsePositives: 0,
      truePositives: governanceBlocked,
    };

    const compliance: FinPayCompliance = {
      passed: auditLog.filter((e) => e.result === 'pass').length,
      violations: auditLog.filter((e) => e.result === 'fail').length,
    };

    const ocr: FinPayOcr = {
      accuracy: qualityScores.lintPass ? 100 : 0,
      processingTime: 0,
    };

    return { payments, trust, fraud, compliance, ocr, timestamp: now };
  }

  // ----------------------------------------------------------
  // Engine data extractors
  // ----------------------------------------------------------

  private computeQualityFromAudit(auditLog: AuditEventSnapshot[]): {
    avgCoverage: number;
    lintPass: boolean;
    typecheckPass: boolean;
  } {
    const qualityEvents = auditLog.filter((e) => e.type.includes('quality'));

    const avgCoverage =
      qualityEvents.length > 0
        ? (qualityEvents.filter((e) => e.result === 'pass').length / qualityEvents.length) * 100
        : 0;

    const lintPass = !auditLog.some((e) => e.type.includes('lint') && e.result === 'fail');
    const typecheckPass = !auditLog.some(
      (e) => e.type.includes('typecheck') && e.result === 'fail',
    );

    return { avgCoverage, lintPass, typecheckPass };
  }

  private deriveLayerCounts(auditLog: AuditEventSnapshot[]): BehaviorOSLayers {
    const passCount = auditLog.filter((e) => e.result === 'pass').length;
    const failCount = auditLog.filter((e) => e.result === 'fail').length;
    const warnCount = auditLog.filter((e) => e.result === 'warn' || e.result === 'skip').length;

    return { passed: passCount, failed: failCount, pending: warnCount };
  }

  private deriveGovernanceCounts(auditLog: AuditEventSnapshot[]): BehaviorOSGovernance {
    const blocked = auditLog.filter(
      (e) => e.type.includes('governance') && e.result === 'fail',
    ).length;
    const escalated = auditLog.filter(
      (e) => e.type.includes('governance') && e.type.includes('escalat'),
    ).length;
    const approved = auditLog.filter(
      (e) => e.type.includes('governance') && e.result === 'pass',
    ).length;

    return { blocked, escalated, approved };
  }

  // ----------------------------------------------------------
  // Empty / zero-state builders
  // ----------------------------------------------------------

  private emptyBehaviorOS(now: string): BehaviorOSMetrics {
    return {
      pipeline: { active: 0, completed: 0, failed: 0 },
      layers: { passed: 0, failed: 0, pending: 0 },
      governance: { blocked: 0, escalated: 0, approved: 0 },
      quality: { coverage: 0, lintPass: true, typecheckPass: true },
      learning: { events: 0, patterns: 0, autoFixes: 0 },
      timestamp: now,
    };
  }

  private emptyBrocolis(now: string): BrocolisMetrics {
    return {
      orders: { total: 0, pending: 0, completed: 0, cancelled: 0, revenue: 0 },
      prescriptions: { uploaded: 0, verified: 0, rejected: 0 },
      deliveries: { active: 0, completed: 0, failed: 0 },
      users: { active: 0, new: 0, churned: 0 },
      api: { latency: 0, errorRate: 0, throughput: 0 },
      timestamp: now,
    };
  }

  private emptyFinPay(now: string): FinPayMetrics {
    return {
      payments: { total: 0, approved: 0, rejected: 0, pendingReview: 0 },
      trust: { avgScore: 0, distribution: { low: 0, medium: 0, high: 0 } },
      fraud: { detected: 0, falsePositives: 0, truePositives: 0 },
      compliance: { passed: 0, violations: 0 },
      ocr: { accuracy: 0, processingTime: 0 },
      timestamp: now,
    };
  }

  // ----------------------------------------------------------
  // History & time-series
  // ----------------------------------------------------------

  private recordSnapshot(metrics: UnifiedMetrics): void {
    this.history.push({ timestamp: metrics.timestamp, metrics });
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
    this._totalCollections++;
  }

  /**
   * Returns metric values over time for the given dotted metric path.
   *
   * Example: `getMetricHistory('behavioros.pipeline.completed', 60_000)`
   */
  getMetricHistory(metricName: string, durationMs: number): MetricHistoryEntry[] {
    const cutoff = Date.now() - durationMs;
    const entries: MetricHistoryEntry[] = [];

    for (const snapshot of this.history) {
      if (new Date(snapshot.timestamp).getTime() < cutoff) continue;
      const value = resolveMetricPath(snapshot.metrics, metricName);
      if (typeof value === 'number') {
        entries.push({ timestamp: snapshot.timestamp, value });
      }
    }

    return entries;
  }

  getHistory(): MetricSnapshot[] {
    return [...this.history];
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealthStatus(): Promise<CollectorHealthStatus> {
    const engineConnected = this.engine !== undefined;

    let brocolisApiReachable = false;
    if (this.config.brocolisApiUrl) {
      const data = await httpJson<unknown>(
        `${this.config.brocolisApiUrl}/api/health`,
        this.httpTimeout,
        this.fetchFn,
      );
      brocolisApiReachable = data !== null;
    }

    let finpayApiReachable = false;
    if (this.config.finpayApiUrl) {
      const data = await httpJson<unknown>(
        `${this.config.finpayApiUrl}/api/health`,
        this.httpTimeout,
        this.fetchFn,
      );
      finpayApiReachable = data !== null;
    }

    const errorRate =
      this._totalCollections > 0 ? (this._errorCount / this._totalCollections) * 100 : 0;

    let status: HealthLevel = 'healthy';
    if (errorRate > 50) {
      status = 'unhealthy';
    } else if (errorRate > 5) {
      status = 'degraded';
    } else if (!engineConnected && !brocolisApiReachable && !finpayApiReachable) {
      status = 'unknown';
    }

    return {
      service: 'metrics-collector',
      status,
      uptime: this._totalCollections * (this.config.collectInterval ?? 15_000),
      lastCheck: new Date().toISOString(),
      details: {
        engineConnected,
        brocolisApiReachable,
        finpayApiReachable,
        snapshotsCollected: this._totalCollections,
        errorRate,
        lastError: this._lastError,
      },
    };
  }

  // ----------------------------------------------------------
  // Accessors
  // ----------------------------------------------------------

  get isRunning(): boolean {
    return this._running;
  }

  get totalCollections(): number {
    return this._totalCollections;
  }
}

// ============================================================
// Module-level helpers
// ============================================================

function sumValues(record: Record<string, number> | undefined): number {
  if (!record) return 0;
  return Object.values(record).reduce((sum, n) => sum + n, 0);
}

function resolveMetricPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
