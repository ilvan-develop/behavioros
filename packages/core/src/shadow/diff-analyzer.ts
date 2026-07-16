import { randomUUID } from 'node:crypto';
import type { CapturedTraffic } from './traffic-capture';
import type { ReplayResult } from './traffic-replay';

// ============================================================
// Diff Analyzer — Compare original vs shadow responses
// ============================================================

/**
 * Severity levels for diff findings.
 */
export type DiffSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Category of difference detected.
 */
export type DiffCategory =
  | 'status-code'
  | 'body-structure'
  | 'body-value'
  | 'latency-regression'
  | 'latency-improvement'
  | 'error-introduced'
  | 'error-resolved'
  | 'schema-change'
  | 'field-missing'
  | 'field-added'
  | 'behavioral-shift';

/**
 * A single field-level or structural diff finding.
 */
export interface DiffFinding {
  /** Unique finding ID. */
  id: string;
  /** Category of the diff. */
  category: DiffCategory;
  /** Severity of this finding. */
  severity: DiffSeverity;
  /** Human-readable description. */
  description: string;
  /** Path within the response object. */
  path: string;
  /** Original value (if applicable). */
  original?: unknown;
  /** Shadow value (if applicable). */
  shadow?: unknown;
}

/**
 * Complete analysis of one original/shadow pair.
 */
export interface DiffResult {
  /** Unique diff result ID. */
  id: string;
  /** Reference to the captured traffic ID. */
  captureId: string;
  /** Reference to the replay result ID. */
  replayId: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** All findings for this pair. */
  findings: DiffFinding[];
  /** Aggregate drift score (0-100, 0=identical, 100=completely different). */
  driftScore: number;
  /** Overall severity (highest finding severity). */
  overallSeverity: DiffSeverity;
  /** Status code match. */
  statusCodeMatch: boolean;
  /** Latency ratio (shadow/original, <1 means shadow is faster). */
  latencyRatio: number;
  /** Whether the shadow introduced an error the original did not have. */
  regressions: boolean;
}

/**
 * Aggregate analysis across all diff results.
 */
export interface DiffAnalysisSummary {
  /** Unique analysis ID. */
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Total pairs analyzed. */
  totalPairs: number;
  /** Mean drift score. */
  meanDriftScore: number;
  /** P95 drift score. */
  p95DriftScore: number;
  /** Number of pairs with drift > threshold. */
  driftViolations: number;
  /** Number of regressions (errors introduced). */
  regressions: number;
  /** Number of improvements (errors resolved). */
  improvements: number;
  /** Number of status code mismatches. */
  statusCodeMismatches: number;
  /** Mean latency ratio (shadow/original). */
  meanLatencyRatio: number;
  /** Recommendation based on analysis. */
  recommendation: 'proceed' | 'investigate' | 'rollback';
  /** Per-category finding counts. */
  categoryBreakdown: Record<DiffCategory, number>;
  /** Per-severity finding counts. */
  severityBreakdown: Record<DiffSeverity, number>;
  /** Individual diff results. */
  results: DiffResult[];
}

export interface DiffAnalyzerConfig {
  /** Drift score threshold to flag a pair as violating. Default: 30. */
  driftThreshold: number;
  /** Latency regression threshold (ratio). Default: 1.5 (50% slower). */
  latencyRegressionThreshold: number;
  /** Latency improvement threshold (ratio). Default: 0.7 (30% faster). */
  latencyImprovementThreshold: number;
  /** Minimum latency diff (ms) to consider significant. Default: 100. */
  latencyMinDeltaMs: number;
  /** Fields to ignore during structural diff. Default: ['timestamp','id','requestId']. */
  ignoreFields: string[];
  /** Max depth for recursive diff. Default: 10. */
  maxDepth: number;
}

// --- Defaults ---

const DEFAULT_DIFF_CONFIG: DiffAnalyzerConfig = {
  driftThreshold: 30,
  latencyRegressionThreshold: 1.5,
  latencyImprovementThreshold: 0.7,
  latencyMinDeltaMs: 100,
  ignoreFields: ['timestamp', 'id', 'requestId'],
  maxDepth: 10,
};

const SEVERITY_ORDER: Record<DiffSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

// ============================================================
// DiffAnalyzer
// ============================================================

export class DiffAnalyzer {
  private config: DiffAnalyzerConfig;

  constructor(config?: Partial<DiffAnalyzerConfig>) {
    this.config = { ...DEFAULT_DIFF_CONFIG, ...config };
  }

  // ── Single pair analysis ─────────────────────────────────────

  /**
   * Analyze a single original/shadow pair.
   */
  analyze(capture: CapturedTraffic, replay: ReplayResult): DiffResult {
    const findings: DiffFinding[] = [];

    this.compareStatusCodes(capture, replay, findings);
    this.compareBodies(capture.response, replay.shadowResponse, '', findings, 0);
    this.compareLatency(capture, replay, findings);

    const driftScore = this.calculateDriftScore(findings);
    const overallSeverity = this.getHighestSeverity(findings);
    const latencyRatio =
      capture.latencyMs > 0
        ? Math.round((replay.shadowLatencyMs / capture.latencyMs) * 100) / 100
        : 0;

    const regressions = findings.some(
      (f) => f.category === 'error-introduced' || f.category === 'latency-regression',
    );

    return {
      id: randomUUID(),
      captureId: capture.id,
      replayId: replay.id,
      timestamp: new Date().toISOString(),
      findings,
      driftScore,
      overallSeverity,
      statusCodeMatch: capture.statusCode === replay.shadowStatusCode,
      latencyRatio,
      regressions,
    };
  }

  // ── Batch analysis ───────────────────────────────────────────

  /**
   * Analyze all pairs and produce a summary.
   */
  analyzeBatch(captures: CapturedTraffic[], replays: ReplayResult[]): DiffAnalysisSummary {
    const results: DiffResult[] = [];

    for (const replay of replays) {
      const capture = captures.find((c) => c.id === replay.captureId);
      if (!capture) continue;
      results.push(this.analyze(capture, replay));
    }

    const driftScores = results.map((r) => r.driftScore).sort((a, b) => a - b);
    const latencyRatios = results.map((r) => r.latencyRatio).filter((r) => r > 0);
    const regressions = results.filter((r) => r.regressions).length;
    const improvements = results.filter((r) =>
      r.findings.some((f) => f.category === 'error-resolved'),
    ).length;
    const statusCodeMismatches = results.filter((r) => !r.statusCodeMatch).length;

    const categoryBreakdown = this.countByCategory(results);
    const severityBreakdown = this.countBySeverity(results);

    const meanDriftScore =
      driftScores.length > 0
        ? Math.round(driftScores.reduce((a, b) => a + b, 0) / driftScores.length)
        : 0;
    const p95DriftScore = percentile(driftScores, 95);
    const meanLatencyRatio =
      latencyRatios.length > 0
        ? Math.round((latencyRatios.reduce((a, b) => a + b, 0) / latencyRatios.length) * 100) / 100
        : 0;
    const driftViolations = driftScores.filter((s) => s > this.config.driftThreshold).length;

    const recommendation = this.determineRecommendation(
      meanDriftScore,
      regressions,
      statusCodeMismatches,
      driftViolations,
      results.length,
    );

    return {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      totalPairs: results.length,
      meanDriftScore,
      p95DriftScore,
      driftViolations,
      regressions,
      improvements,
      statusCodeMismatches,
      meanLatencyRatio,
      recommendation,
      categoryBreakdown,
      severityBreakdown,
      results,
    };
  }

  // ── Config ───────────────────────────────────────────────────

  getConfig(): Readonly<DiffAnalyzerConfig> {
    return this.config;
  }

  // ── Comparison logic ─────────────────────────────────────────

  private compareStatusCodes(
    capture: CapturedTraffic,
    replay: ReplayResult,
    findings: DiffFinding[],
  ): void {
    if (capture.statusCode === replay.shadowStatusCode) return;

    const category: DiffCategory =
      replay.shadowStatusCode >= 400 && capture.statusCode < 400
        ? 'error-introduced'
        : replay.shadowStatusCode < 400 && capture.statusCode >= 400
          ? 'error-resolved'
          : 'status-code';

    const severity: DiffSeverity =
      category === 'error-introduced' ? 'high' : category === 'error-resolved' ? 'info' : 'medium';

    findings.push({
      id: randomUUID(),
      category,
      severity,
      description: `Status code changed from ${capture.statusCode} to ${replay.shadowStatusCode}`,
      path: '[statusCode]',
      original: capture.statusCode,
      shadow: replay.shadowStatusCode,
    });
  }

  private compareBodies(
    original: Record<string, unknown>,
    shadow: Record<string, unknown>,
    basePath: string,
    findings: DiffFinding[],
    depth: number,
  ): void {
    if (depth > this.config.maxDepth) return;

    const allKeys = new Set([...Object.keys(original), ...Object.keys(shadow)]);

    for (const key of allKeys) {
      if (this.config.ignoreFields.includes(key)) continue;

      const path = basePath ? `${basePath}.${key}` : key;
      const origVal = original[key];
      const shadowVal = shadow[key];

      // Field missing from shadow
      if (origVal !== undefined && shadowVal === undefined) {
        findings.push({
          id: randomUUID(),
          category: 'field-missing',
          severity: 'medium',
          description: `Field "${key}" present in original but missing in shadow`,
          path,
          original: origVal,
        });
        continue;
      }

      // Field added in shadow
      if (origVal === undefined && shadowVal !== undefined) {
        findings.push({
          id: randomUUID(),
          category: 'field-added',
          severity: 'low',
          description: `Field "${key}" added in shadow response`,
          path,
          shadow: shadowVal,
        });
        continue;
      }

      // Structural diff: both objects — recurse
      if (
        typeof origVal === 'object' &&
        typeof shadowVal === 'object' &&
        origVal !== null &&
        shadowVal !== null
      ) {
        if (Array.isArray(origVal) !== Array.isArray(shadowVal)) {
          findings.push({
            id: randomUUID(),
            category: 'schema-change',
            severity: 'high',
            description: `Type changed from ${Array.isArray(origVal) ? 'array' : 'object'} to ${Array.isArray(shadowVal) ? 'array' : 'object'} at "${path}"`,
            path,
            original: Array.isArray(origVal) ? 'array' : 'object',
            shadow: Array.isArray(shadowVal) ? 'array' : 'object',
          });
        } else if (Array.isArray(origVal) && Array.isArray(shadowVal)) {
          this.compareArrays(origVal, shadowVal, path, findings, depth);
        } else {
          this.compareBodies(
            origVal as Record<string, unknown>,
            shadowVal as Record<string, unknown>,
            path,
            findings,
            depth + 1,
          );
        }
        continue;
      }

      // Value diff
      if (JSON.stringify(origVal) !== JSON.stringify(shadowVal)) {
        findings.push({
          id: randomUUID(),
          category: 'body-value',
          severity: this.classifyValueSeverity(key, origVal, shadowVal),
          description: `Value differs at "${path}"`,
          path,
          original: origVal,
          shadow: shadowVal,
        });
      }
    }
  }

  private compareArrays(
    original: unknown[],
    shadow: unknown[],
    basePath: string,
    findings: DiffFinding[],
    depth: number,
  ): void {
    if (original.length !== shadow.length) {
      findings.push({
        id: randomUUID(),
        category: 'schema-change',
        severity: 'medium',
        description: `Array length changed from ${original.length} to ${shadow.length} at "${basePath}"`,
        path: basePath,
        original: original.length,
        shadow: shadow.length,
      });
    }

    const maxLen = Math.min(original.length, shadow.length, 50);
    for (let i = 0; i < maxLen; i++) {
      const origEl = original[i] as Record<string, unknown> | unknown;
      const shadowEl = shadow[i] as Record<string, unknown> | unknown;

      if (
        typeof origEl === 'object' &&
        typeof shadowEl === 'object' &&
        origEl !== null &&
        shadowEl !== null
      ) {
        this.compareBodies(
          origEl as Record<string, unknown>,
          shadowEl as Record<string, unknown>,
          `${basePath}[${i}]`,
          findings,
          depth + 1,
        );
      } else if (JSON.stringify(origEl) !== JSON.stringify(shadowEl)) {
        findings.push({
          id: randomUUID(),
          category: 'body-value',
          severity: 'low',
          description: `Array element differs at ${basePath}[${i}]`,
          path: `${basePath}[${i}]`,
          original: origEl,
          shadow: shadowEl,
        });
      }
    }
  }

  private compareLatency(
    capture: CapturedTraffic,
    replay: ReplayResult,
    findings: DiffFinding[],
  ): void {
    if (capture.latencyMs <= 0) return;

    const deltaMs = replay.shadowLatencyMs - capture.latencyMs;
    const absDelta = Math.abs(deltaMs);

    if (absDelta < this.config.latencyMinDeltaMs) return;

    if (deltaMs > 0) {
      const ratio = replay.shadowLatencyMs / capture.latencyMs;
      if (ratio >= this.config.latencyRegressionThreshold) {
        findings.push({
          id: randomUUID(),
          category: 'latency-regression',
          severity: ratio >= 2.0 ? 'high' : 'medium',
          description: `Shadow is ${Math.round((ratio - 1) * 100)}% slower (${capture.latencyMs}ms → ${replay.shadowLatencyMs}ms)`,
          path: '[latency]',
          original: capture.latencyMs,
          shadow: replay.shadowLatencyMs,
        });
      }
    } else {
      const ratio = replay.shadowLatencyMs / capture.latencyMs;
      if (ratio <= this.config.latencyImprovementThreshold) {
        findings.push({
          id: randomUUID(),
          category: 'latency-improvement',
          severity: 'info',
          description: `Shadow is ${Math.round((1 - ratio) * 100)}% faster (${capture.latencyMs}ms → ${replay.shadowLatencyMs}ms)`,
          path: '[latency]',
          original: capture.latencyMs,
          shadow: replay.shadowLatencyMs,
        });
      }
    }
  }

  // ── Scoring ──────────────────────────────────────────────────

  private calculateDriftScore(findings: DiffFinding[]): number {
    if (findings.length === 0) return 0;

    const severityWeights: Record<DiffSeverity, number> = {
      info: 1,
      low: 5,
      medium: 15,
      high: 30,
      critical: 50,
    };

    const rawScore = findings.reduce((sum, f) => sum + severityWeights[f.severity], 0);
    return Math.min(100, Math.round(rawScore));
  }

  private classifyValueSeverity(key: string, original: unknown, shadow: unknown): DiffSeverity {
    const lowerKey = key.toLowerCase();
    const safetyCriticalFields = ['id', 'amount', 'price', 'total', 'status', 'currency', 'email'];
    const securityFields = ['token', 'secret', 'password', 'key', 'auth'];

    if (securityFields.some((f) => lowerKey.includes(f))) return 'critical';
    if (safetyCriticalFields.includes(lowerKey)) return 'high';
    if (typeof original !== typeof shadow) return 'medium';
    return 'low';
  }

  private getHighestSeverity(findings: DiffFinding[]): DiffSeverity {
    if (findings.length === 0) return 'info';
    return findings.reduce<DiffSeverity>(
      (max, f) => (SEVERITY_ORDER[f.severity] > SEVERITY_ORDER[max] ? f.severity : max),
      'info',
    );
  }

  private determineRecommendation(
    meanDrift: number,
    regressions: number,
    _statusCodeMismatches: number,
    driftViolations: number,
    totalPairs: number,
  ): 'proceed' | 'investigate' | 'rollback' {
    if (totalPairs === 0) return 'investigate';

    const regressionRate = regressions / totalPairs;
    const violationRate = driftViolations / totalPairs;

    if (regressionRate > 0.1 || meanDrift > 60) return 'rollback';
    if (regressionRate > 0.02 || meanDrift > this.config.driftThreshold || violationRate > 0.15) {
      return 'investigate';
    }
    return 'proceed';
  }

  // ── Breakdowns ───────────────────────────────────────────────

  private countByCategory(results: DiffResult[]): Record<DiffCategory, number> {
    const counts = {} as Record<DiffCategory, number>;
    for (const result of results) {
      for (const finding of result.findings) {
        counts[finding.category] = (counts[finding.category] ?? 0) + 1;
      }
    }
    return counts;
  }

  private countBySeverity(results: DiffResult[]): Record<DiffSeverity, number> {
    const counts = {} as Record<DiffSeverity, number>;
    for (const result of results) {
      for (const finding of result.findings) {
        counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
      }
    }
    return counts;
  }
}

// ============================================================
// Helpers
// ============================================================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
