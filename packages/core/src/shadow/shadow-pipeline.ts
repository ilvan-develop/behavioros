import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { type Alert, AlertManager, type AlertManagerConfig } from './alert-manager';
import { type DiffAnalysisSummary, DiffAnalyzer, type DiffAnalyzerConfig } from './diff-analyzer';
import {
  type ComplianceReport,
  type ComplianceReportConfig,
  ComplianceReportGenerator,
} from './reports/compliance-report';
import {
  type ShadowReport,
  type ShadowReportConfig,
  ShadowReportGenerator,
} from './reports/shadow-report';
import { type CapturedTraffic, TrafficCapture, type TrafficCaptureConfig } from './traffic-capture';
import { type ReplayConfig, type ReplayStats, TrafficReplay } from './traffic-replay';

// ============================================================
// Shadow Pipeline — Main orchestrator for shadow mode execution
// ============================================================

/**
 * Pipeline execution status.
 */
export type PipelineStatus =
  | 'idle'
  | 'capturing'
  | 'replaying'
  | 'analyzing'
  | 'reporting'
  | 'completed'
  | 'failed';

/**
 * Shadow pipeline configuration.
 */
export interface ShadowPipelineConfig {
  /** Project name. */
  projectName: string;
  /** DNA version being tested. */
  dnaVersion: string;
  /** Baseline DNA version for comparison. */
  baselineVersion?: string;
  /** Traffic capture settings. */
  capture: Partial<TrafficCaptureConfig>;
  /** Replay settings. */
  replay: Partial<ReplayConfig>;
  /** Diff analyzer settings. */
  diffAnalyzer: Partial<DiffAnalyzerConfig>;
  /** Alert manager settings. */
  alertManager: Partial<AlertManagerConfig>;
  /** Shadow report settings. */
  report: Partial<ShadowReportConfig>;
  /** Compliance report settings. */
  compliance: Partial<ComplianceReportConfig>;
  /** Persistence directory for all pipeline artifacts. */
  persistDir?: string;
  /** Whether to auto-generate compliance reports. Default: true. */
  generateCompliance: boolean;
  /** Callback invoked when the pipeline status changes. */
  onStatusChange?: (status: PipelineStatus) => void;
}

/**
 * Replay handler type — the shadow DNA evaluation function.
 */
export type ShadowHandler = (
  request: Record<string, unknown>,
  path: string,
  method: string,
) => Promise<{ response: Record<string, unknown>; statusCode: number }>;

/**
 * Complete pipeline result after execution.
 */
export interface PipelineResult {
  /** Unique run ID. */
  id: string;
  /** Pipeline status at completion. */
  status: PipelineStatus;
  /** ISO-8601 start time. */
  startedAt: string;
  /** ISO-8601 end time. */
  completedAt: string;
  /** Total duration in ms. */
  durationMs: number;
  /** Captured traffic count. */
  capturedCount: number;
  /** Diff analysis summary. */
  diffSummary: DiffAnalysisSummary | null;
  /** Replay statistics. */
  replayStats: ReplayStats | null;
  /** Fired alerts. */
  alerts: Alert[];
  /** Shadow validation report. */
  shadowReport: ShadowReport | null;
  /** Compliance report. */
  complianceReport: ComplianceReport | null;
  /** Error message if failed. */
  error?: string;
}

// --- Defaults ---

const DEFAULT_PIPELINE_CONFIG: ShadowPipelineConfig = {
  projectName: 'unknown',
  dnaVersion: '0.0.0',
  capture: {},
  replay: {},
  diffAnalyzer: {},
  alertManager: {},
  report: {},
  compliance: {},
  generateCompliance: true,
};

// ============================================================
// ShadowPipeline
// ============================================================

export class ShadowPipeline {
  private config: ShadowPipelineConfig;
  private capture: TrafficCapture;
  private replay: TrafficReplay;
  private analyzer: DiffAnalyzer;
  private alertManager: AlertManager;
  private reportGenerator: ShadowReportGenerator;
  private complianceGenerator: ComplianceReportGenerator;
  private status: PipelineStatus = 'idle';
  private results: PipelineResult[] = [];

  constructor(config?: Partial<ShadowPipelineConfig>) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
    this.capture = new TrafficCapture(this.config.capture);
    this.replay = new TrafficReplay(this.config.replay);
    this.analyzer = new DiffAnalyzer(this.config.diffAnalyzer);
    this.alertManager = new AlertManager(this.config.alertManager);
    this.reportGenerator = new ShadowReportGenerator(this.config.report);
    this.complianceGenerator = new ComplianceReportGenerator(this.config.compliance);
  }

  // ── Full pipeline execution ──────────────────────────────────

  /**
   * Execute the full shadow pipeline: replay → analyze → alert → report.
   * Expects traffic to have been captured beforehand via the capture API.
   */
  async execute(captures: CapturedTraffic[], handler: ShadowHandler): Promise<PipelineResult> {
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    const startMs = Date.now();
    const result: PipelineResult = {
      id: runId,
      status: 'idle',
      startedAt,
      completedAt: '',
      durationMs: 0,
      capturedCount: captures.length,
      diffSummary: null,
      replayStats: null,
      alerts: [],
      shadowReport: null,
      complianceReport: null,
    };

    try {
      // ── Phase 1: Replay ──
      this.setStatus('replaying');
      const replayOutcome = await this.replay.replayBatch(captures, handler);
      result.replayStats = replayOutcome.stats;

      // ── Phase 2: Analyze ──
      this.setStatus('analyzing');
      const diffSummary = this.analyzer.analyzeBatch(captures, replayOutcome.results);
      result.diffSummary = diffSummary;

      // ── Phase 3: Alert ──
      const alerts = this.alertManager.evaluateBatch(diffSummary.results);
      result.alerts = alerts;

      // ── Phase 4: Report ──
      this.setStatus('reporting');
      const shadowReport = this.reportGenerator.generate({
        diffSummary,
        replayStats: replayOutcome.stats,
        alerts: this.alertManager.getAlerts(),
        captures,
        dnaVersion: this.config.dnaVersion,
        baselineVersion: this.config.baselineVersion,
        projectName: this.config.projectName,
      });
      result.shadowReport = shadowReport;

      if (this.config.generateCompliance) {
        const complianceReport = this.complianceGenerator.generate({
          diffSummary,
          replayStats: replayOutcome.stats,
          captures,
          alerts: this.alertManager.getAlerts(),
          dnaVersion: this.config.dnaVersion,
          projectName: this.config.projectName,
        });
        result.complianceReport = complianceReport;
      }

      // ── Phase 5: Persist ──
      if (this.config.persistDir) {
        await this.persistResult(result);
      }

      result.status = 'completed';
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startMs;
    } catch (err) {
      result.status = 'failed';
      result.error = err instanceof Error ? err.message : String(err);
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startMs;
    }

    this.results.push(result);
    this.setStatus(result.status);
    return result;
  }

  /**
   * Execute with automatic capture from a production proxy.
   * Returns a capture function to pass to the production middleware.
   */
  createCaptureMiddleware(): {
    capture: (params: {
      method: string;
      path: string;
      request: Record<string, unknown>;
      response: Record<string, unknown>;
      statusCode: number;
      latencyMs: number;
      error?: string;
      agentId?: string;
      tags?: Record<string, string>;
    }) => CapturedTraffic | null;
    getCaptures: () => CapturedTraffic[];
    getStats: () => ReturnType<TrafficCapture['getStats']>;
  } {
    this.setStatus('capturing');
    return {
      capture: (params) => this.capture.capture(params),
      getCaptures: () => this.capture.getEntries(),
      getStats: () => this.capture.getStats(),
    };
  }

  // ── Access to sub-components ──────────────────────────────────

  /** Get the traffic capture instance. */
  getCapture(): TrafficCapture {
    return this.capture;
  }

  /** Get the traffic replay instance. */
  getReplay(): TrafficReplay {
    return this.replay;
  }

  /** Get the diff analyzer instance. */
  getAnalyzer(): DiffAnalyzer {
    return this.analyzer;
  }

  /** Get the alert manager instance. */
  getAlertManager(): AlertManager {
    return this.alertManager;
  }

  /** Get the report generator instance. */
  getReportGenerator(): ShadowReportGenerator {
    return this.reportGenerator;
  }

  /** Get the compliance report generator instance. */
  getComplianceGenerator(): ComplianceReportGenerator {
    return this.complianceGenerator;
  }

  // ── History ──────────────────────────────────────────────────

  /** Get all pipeline run results. */
  getHistory(): PipelineResult[] {
    return [...this.results];
  }

  /** Get the last pipeline run result. */
  getLastResult(): PipelineResult | undefined {
    return this.results[this.results.length - 1];
  }

  /** Get current pipeline status. */
  getStatus(): PipelineStatus {
    return this.status;
  }

  // ── Persistence ──────────────────────────────────────────────

  /**
   * Persist pipeline configuration and history.
   */
  async persist(dirPath?: string): Promise<void> {
    const dir = dirPath ?? this.config.persistDir;
    if (!dir) throw new Error('No persist directory configured');

    if (!existsSync(dir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
    }

    await writeFile(`${dir}/pipeline-history.json`, JSON.stringify(this.results, null, 2), 'utf-8');
    await this.capture.flush(`${dir}/captured-traffic.json`);
    await this.alertManager.persist(`${dir}/alerts.json`);
  }

  /**
   * Load pipeline history from disk.
   */
  async load(dirPath: string): Promise<void> {
    const historyPath = `${dirPath}/pipeline-history.json`;
    if (existsSync(historyPath)) {
      const raw = await readFile(historyPath, 'utf-8');
      this.results = JSON.parse(raw) as PipelineResult[];
    }

    const capturePath = `${dirPath}/captured-traffic.json`;
    if (existsSync(capturePath)) {
      await this.capture.load(capturePath);
    }

    const alertPath = `${dirPath}/alerts.json`;
    if (existsSync(alertPath)) {
      await this.alertManager.load(alertPath);
    }
  }

  // ── Config ───────────────────────────────────────────────────

  getConfig(): Readonly<ShadowPipelineConfig> {
    return this.config;
  }

  // ── Private ──────────────────────────────────────────────────

  private setStatus(status: PipelineStatus): void {
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  private async persistResult(result: PipelineResult): Promise<void> {
    if (!this.config.persistDir) return;

    const dir = this.config.persistDir;
    if (!existsSync(dir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(dir, { recursive: true });
    }

    if (result.shadowReport) {
      await this.reportGenerator.save(
        result.shadowReport,
        `${dir}/shadow-report-${result.id}.json`,
      );
    }
    if (result.complianceReport) {
      await this.complianceGenerator.save(
        result.complianceReport,
        `${dir}/compliance-report-${result.id}.json`,
      );
    }
  }
}
