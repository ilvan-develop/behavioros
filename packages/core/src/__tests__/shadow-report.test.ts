import { describe, expect, it } from 'vitest';
import type { Alert } from '../shadow/alert-manager';
import type { DiffAnalysisSummary, DiffSeverity } from '../shadow/diff-analyzer';
import { ShadowReportGenerator } from '../shadow/reports/shadow-report';
import type { ReplayStats } from '../shadow/traffic-replay';

const makeDiffSummary = (overrides: Partial<DiffAnalysisSummary> = {}): DiffAnalysisSummary => ({
  id: 'summary-1',
  timestamp: '2026-01-01T00:00:00.000Z',
  totalPairs: 10,
  meanDriftScore: 15,
  p95DriftScore: 40,
  driftViolations: 1,
  regressions: 0,
  improvements: 1,
  statusCodeMismatches: 0,
  meanLatencyRatio: 1.1,
  recommendation: 'proceed',
  categoryBreakdown: { 'body-value': 2 } as any,
  severityBreakdown: { low: 2 } as any,
  results: [],
  ...overrides,
});

const makeReplayStats = (overrides: Partial<ReplayStats> = {}): ReplayStats => ({
  total: 10,
  succeeded: 10,
  failed: 0,
  avgLatencyMs: 150,
  p50LatencyMs: 100,
  p95LatencyMs: 300,
  p99LatencyMs: 500,
  totalDurationMs: 2000,
  ...overrides,
});

const makeAlert = (overrides: Partial<Alert> = {}): Alert => ({
  id: 'alert-1',
  type: 'drift-threshold',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  severity: 'high',
  summary: 'Drift threshold exceeded',
  description: 'Mean drift score exceeds configured threshold',
  diffResultIds: ['dr-1'],
  driftScore: 45,
  metadata: {},
  ...overrides,
});

describe('ShadowReportGenerator', () => {
  it('generate creates a report with all fields', () => {
    const generator = new ShadowReportGenerator({ projectName: 'test-project' });
    const report = generator.generate({
      diffSummary: makeDiffSummary(),
      replayStats: makeReplayStats(),
      alerts: [],
      captures: [{ timestamp: '2026-01-01T00:00:00.000Z' }],
      dnaVersion: '1.0.0',
      baselineVersion: '0.9.0',
      projectName: 'test-project',
    });

    expect(report.id).toBeDefined();
    expect(report.title).toContain('test-project');
    expect(report.dnaVersion).toBe('1.0.0');
    expect(report.baselineVersion).toBe('0.9.0');
    expect(report.recommendation).toBe('proceed');
  });

  it('report includes start and end times from captures', () => {
    const generator = new ShadowReportGenerator();
    const report = generator.generate({
      diffSummary: makeDiffSummary(),
      replayStats: makeReplayStats(),
      alerts: [],
      captures: [
        { timestamp: '2026-01-01T00:00:00.000Z' },
        { timestamp: '2026-01-02T00:00:00.000Z' },
      ],
    });

    expect(report.trafficTimeRange.start).toBe('2026-01-01T00:00:00.000Z');
    expect(report.trafficTimeRange.end).toBe('2026-01-02T00:00:00.000Z');
  });

  it('report includes passed/failed counts from replayStats', () => {
    const generator = new ShadowReportGenerator();
    const replayStats = makeReplayStats({ succeeded: 8, failed: 2 });
    const report = generator.generate({
      diffSummary: makeDiffSummary(),
      replayStats,
      alerts: [],
      captures: [{} as any],
    });

    expect(report.replayStats.succeeded).toBe(8);
    expect(report.replayStats.failed).toBe(2);
  });

  it('report includes active alerts', () => {
    const generator = new ShadowReportGenerator();
    const alert = makeAlert({ severity: 'critical' });
    const report = generator.generate({
      diffSummary: makeDiffSummary(),
      replayStats: makeReplayStats(),
      alerts: [alert],
      captures: [{} as any],
    });

    expect(report.alerts).toHaveLength(1);
    expect(report.alerts[0].id).toBe('alert-1');
  });

  it('addSection appends section data (via buildSections)', () => {
    const generator = new ShadowReportGenerator({ includeDiffDetails: true });
    const diffSummary = makeDiffSummary({
      results: [
        {
          id: 'dr-1',
          captureId: 'cap-1',
          replayId: 'rep-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          findings: [],
          driftScore: 0,
          overallSeverity: 'info' as DiffSeverity,
          statusCodeMatch: true,
          latencyRatio: 1,
          regressions: false,
        },
      ],
    });
    const report = generator.generate({
      diffSummary,
      replayStats: makeReplayStats(),
      alerts: [],
      captures: [{} as any],
    });

    expect(report.sections.length).toBeGreaterThanOrEqual(5);
    const overview = report.sections.find((s) => s.title === 'Overview');
    expect(overview).toBeDefined();
    expect(overview!.content).toContain('Total Pairs Analyzed');
  });

  it('executiveSummary contains key metrics', () => {
    const generator = new ShadowReportGenerator();
    const report = generator.generate({
      diffSummary: makeDiffSummary({ totalPairs: 10, meanDriftScore: 15 }),
      replayStats: makeReplayStats(),
      alerts: [],
      captures: [{} as any],
    });

    expect(report.executiveSummary).toContain('10');
    expect(report.executiveSummary).toContain('15');
    expect(report.executiveSummary).toContain('PROCEED');
  });

  it('recommendation is reflected in report', () => {
    const generator = new ShadowReportGenerator();
    const report = generator.generate({
      diffSummary: makeDiffSummary({ recommendation: 'rollback' }),
      replayStats: makeReplayStats(),
      alerts: [],
      captures: [{} as any],
    });

    expect(report.recommendation).toBe('rollback');
  });

  it('confidence score is calculated and clamped 0-100', () => {
    const generator = new ShadowReportGenerator();
    const report = generator.generate({
      diffSummary: makeDiffSummary({ meanDriftScore: 200, regressions: 10 }),
      replayStats: makeReplayStats({ failed: 10, total: 10 }),
      alerts: [makeAlert({ severity: 'critical' }), makeAlert({ severity: 'high' })],
      captures: [{} as any],
    });

    expect(report.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(report.confidenceScore).toBeLessThanOrEqual(100);
  });

  it('totalEntries equals diffSummary.totalPairs', () => {
    const generator = new ShadowReportGenerator();
    const report = generator.generate({
      diffSummary: makeDiffSummary({ totalPairs: 42 }),
      replayStats: makeReplayStats(),
      alerts: [],
      captures: [{} as any],
    });
    expect(report.totalEntries).toBe(42);
  });

  it('getConfig returns the active config', () => {
    const generator = new ShadowReportGenerator({ projectName: 'my-app' });
    expect(generator.getConfig().projectName).toBe('my-app');
  });
});
