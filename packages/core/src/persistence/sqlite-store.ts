import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type {
  AgentState,
  AuditEvent,
  LearningEvent,
  Mission,
  MissionStatus,
  QualityMetric,
} from '@behavioros/schemas';
import Database from 'better-sqlite3';

// ============================================================
// SQLite Persistence Layer — Survives restarts
// ============================================================

export interface PersistenceConfig {
  dbPath?: string;
  memory?: boolean;
}

export class SQLiteStore {
  private db: Database.Database;

  constructor(config: PersistenceConfig = {}) {
    const dbPath = config.dbPath ?? './.behavioros/data/behavioros.db';

    if (!config.memory) {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = config.memory ? new Database(':memory:') : new Database(dbPath);

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        result TEXT NOT NULL DEFAULT 'pass',
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS quality_metrics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value REAL NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_events (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        applied INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_insights (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        occurrences INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_results (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        overall TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS quality_reports (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        passed INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS decision_history (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
      CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log(type);
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
      CREATE INDEX IF NOT EXISTS idx_learning_events_type ON learning_events(type);
      CREATE INDEX IF NOT EXISTS idx_learning_events_source ON learning_events(source);
      CREATE INDEX IF NOT EXISTS idx_quality_metrics_name ON quality_metrics(name);
    `);
  }

  // --- Missions ---

  saveMission(mission: Mission): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO missions (id, data, status, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
      )
      .run(mission.id, JSON.stringify(mission), mission.status);
  }

  getMission(id: string): Mission | null {
    const row = this.db.prepare('SELECT data FROM missions WHERE id = ?').get(id) as
      | { data: string }
      | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  getAllMissions(): Mission[] {
    const rows = this.db.prepare('SELECT data FROM missions ORDER BY created_at DESC').all() as {
      data: string;
    }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  getMissionsByStatus(status: MissionStatus): Mission[] {
    const rows = this.db
      .prepare('SELECT data FROM missions WHERE status = ? ORDER BY created_at DESC')
      .all(status) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  deleteMission(id: string): boolean {
    const result = this.db.prepare('DELETE FROM missions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // --- Agents ---

  saveAgent(agent: AgentState): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO agents (id, data, status, updated_at)
         VALUES (?, ?, ?, datetime('now'))`,
      )
      .run(agent.id, JSON.stringify(agent), agent.status);
  }

  getAgent(id: string): AgentState | null {
    const row = this.db.prepare('SELECT data FROM agents WHERE id = ?').get(id) as
      | { data: string }
      | undefined;
    return row ? JSON.parse(row.data) : null;
  }

  getAllAgents(): AgentState[] {
    const rows = this.db.prepare('SELECT data FROM agents').all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  // --- Audit Log ---

  saveAuditEvent(event: AuditEvent): void {
    this.db
      .prepare(
        `INSERT INTO audit_log (id, data, type, severity, result, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        JSON.stringify(event),
        event.type,
        event.severity,
        event.result,
        event.timestamp,
      );
  }

  getAuditLog(limit = 100, offset = 0): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT data FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  getAuditLogByType(type: string): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT data FROM audit_log WHERE type = ? ORDER BY timestamp DESC')
      .all(type) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  getAuditLogCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as {
      count: number;
    };
    return row.count;
  }

  // --- Quality Metrics ---

  saveQualityMetric(metric: QualityMetric): void {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO quality_metrics (id, name, value, data, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        metric.name,
        metric.value,
        JSON.stringify(metric),
        metric.timestamp ?? new Date().toISOString(),
      );
  }

  getQualityMetrics(limit = 100): QualityMetric[] {
    const rows = this.db
      .prepare('SELECT data FROM quality_metrics ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  // --- Learning Events ---

  saveLearningEvent(event: LearningEvent): void {
    this.db
      .prepare(
        `INSERT INTO learning_events (id, data, type, source, applied, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.id,
        JSON.stringify(event),
        event.type,
        event.source,
        event.applied ? 1 : 0,
        event.timestamp,
      );
  }

  getLearningEvents(limit = 100): LearningEvent[] {
    const rows = this.db
      .prepare('SELECT data FROM learning_events ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  getLearningEventsBySource(source: string): LearningEvent[] {
    const rows = this.db
      .prepare('SELECT data FROM learning_events WHERE source = ? ORDER BY timestamp DESC')
      .all(source) as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  // --- Learning Insights ---

  saveInsight(insight: {
    id: string;
    pattern: string;
    confidence: number;
    occurrences: number;
    description: string;
    suggestedAction?: string;
  }): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO learning_insights (id, pattern, confidence, occurrences, data, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(
        insight.id,
        insight.pattern,
        insight.confidence,
        insight.occurrences,
        JSON.stringify(insight),
      );
  }

  getInsights(): Array<{
    id: string;
    pattern: string;
    confidence: number;
    occurrences: number;
    description: string;
    suggestedAction?: string;
  }> {
    const rows = this.db
      .prepare('SELECT data FROM learning_insights ORDER BY confidence DESC')
      .all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data));
  }

  // --- Audit Results (from AuditEngine) ---

  saveAuditResult(result: {
    id: string;
    overall: string;
    score: number;
    stages: unknown[];
    duration: number;
    timestamp: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO audit_results (id, data, overall, score, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(result.id, JSON.stringify(result), result.overall, result.score, result.timestamp);
  }

  getAuditResults(
    limit = 50,
  ): Array<{ id: string; overall: string; score: number; timestamp: string }> {
    const rows = this.db
      .prepare(
        'SELECT id, overall, score, timestamp FROM audit_results ORDER BY timestamp DESC LIMIT ?',
      )
      .all(limit) as Array<{ id: string; overall: string; score: number; timestamp: string }>;
    return rows;
  }

  // --- Quality Reports ---

  saveQualityReport(report: {
    id: string;
    passed: boolean;
    score: number;
    checks: unknown[];
    timestamp: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO quality_reports (id, data, passed, score, timestamp)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        report.id,
        JSON.stringify(report),
        report.passed ? 1 : 0,
        report.score,
        report.timestamp,
      );
  }

  getQualityReports(
    limit = 50,
  ): Array<{ id: string; passed: boolean; score: number; timestamp: string }> {
    const rows = this.db
      .prepare(
        'SELECT id, passed, score, timestamp FROM quality_reports ORDER BY timestamp DESC LIMIT ?',
      )
      .all(limit) as Array<{ id: string; passed: boolean; score: number; timestamp: string }>;
    return rows.map((r) => ({ ...r, passed: Boolean(r.passed) }));
  }

  // --- Decision History ---

  saveDecision(decision: { id: string; result: string; [key: string]: unknown }): void {
    this.db
      .prepare(
        `INSERT INTO decision_history (id, data, timestamp)
         VALUES (?, ?, datetime('now'))`,
      )
      .run(decision.id, JSON.stringify(decision));
  }

  getDecisions(limit = 50): Array<{ data: string; timestamp: string }> {
    return this.db
      .prepare('SELECT data, timestamp FROM decision_history ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as Array<{ data: string; timestamp: string }>;
  }

  // --- KV Store (generic key-value) ---

  set(key: string, value: unknown): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO kv_store (key, value, updated_at)
         VALUES (?, ?, datetime('now'))`,
      )
      .run(key, JSON.stringify(value));
  }

  get<T = unknown>(key: string): T | null {
    const row = this.db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? (JSON.parse(row.value) as T) : null;
  }

  delete(key: string): boolean {
    const result = this.db.prepare('DELETE FROM kv_store WHERE key = ?').run(key);
    return result.changes > 0;
  }

  // --- Stats ---

  getStats() {
    const missions = this.db.prepare('SELECT COUNT(*) as count FROM missions').get() as {
      count: number;
    };
    const agents = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as {
      count: number;
    };
    const auditEvents = this.db.prepare('SELECT COUNT(*) as count FROM audit_log').get() as {
      count: number;
    };
    const qualityMetrics = this.db
      .prepare('SELECT COUNT(*) as count FROM quality_metrics')
      .get() as {
      count: number;
    };
    const learningEvents = this.db
      .prepare('SELECT COUNT(*) as count FROM learning_events')
      .get() as {
      count: number;
    };
    const insights = this.db.prepare('SELECT COUNT(*) as count FROM learning_insights').get() as {
      count: number;
    };

    return {
      missions: missions.count,
      agents: agents.count,
      auditEvents: auditEvents.count,
      qualityMetrics: qualityMetrics.count,
      learningEvents: learningEvents.count,
      insights: insights.count,
    };
  }

  // --- Cleanup ---

  close(): void {
    this.db.close();
  }

  vacuum(): void {
    this.db.exec('VACUUM');
  }

  clearAll(): void {
    this.db.exec(`
      DELETE FROM missions;
      DELETE FROM agents;
      DELETE FROM audit_log;
      DELETE FROM quality_metrics;
      DELETE FROM learning_events;
      DELETE FROM learning_insights;
      DELETE FROM audit_results;
      DELETE FROM quality_reports;
      DELETE FROM decision_history;
      DELETE FROM kv_store;
    `);
  }
}
