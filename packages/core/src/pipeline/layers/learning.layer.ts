import { randomUUID } from 'node:crypto';
import type { DispatcherLayerResult, PipelineDispatcherContext } from '../pipeline-context';
import type { PipelineLayer } from './layer.interface';

// ============================================================
// Layer 9 — Learning Layer
// Records learning events, detects patterns, generates insights.
// NEVER blocks — always records results.
// ============================================================

export interface LearningEntry {
  id: string;
  pipelineId: string;
  type: 'observation' | 'pattern' | 'insight' | 'feedback' | 'correction';
  source: string;
  data: Record<string, unknown>;
  confidence: number;
  timestamp: string;
}

export interface LearningPattern {
  id: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  description: string;
  category: string;
  lastDetected: string;
}

export interface LearningLayerOptions {
  autoDetectPatterns?: boolean;
  minConfidence?: number;
  maxEntries?: number;
  maxPatterns?: number;
}

export class LearningLayer implements PipelineLayer {
  readonly id = 'learning';
  readonly name = 'Learning';
  readonly order = 9;

  private entries: LearningEntry[] = [];
  private patterns: LearningPattern[] = [];
  private autoDetect: boolean;
  private minConfidence: number;
  private maxEntries: number;
  private maxPatterns: number;

  constructor(options: LearningLayerOptions = {}) {
    this.autoDetect = options.autoDetectPatterns ?? true;
    this.minConfidence = options.minConfidence ?? 0.5;
    this.maxEntries = options.maxEntries ?? 10_000;
    this.maxPatterns = options.maxPatterns ?? 1_000;
  }

  shouldExecute(_context: PipelineDispatcherContext): boolean {
    return true;
  }

  async execute(context: PipelineDispatcherContext): Promise<DispatcherLayerResult> {
    const start = Date.now();

    try {
      // 1. Record learning event from pipeline execution
      const layerResults = context.layerResults;
      const passedLayers = layerResults.filter((r) => r.passed).length;
      const totalLayers = layerResults.length;
      const avgScore =
        totalLayers > 0
          ? Math.round(layerResults.reduce((s, r) => s + r.score, 0) / totalLayers)
          : 0;

      const entry: LearningEntry = {
        id: randomUUID(),
        pipelineId: context.id,
        type: this.determineEventType(context, layerResults.length),
        source: 'pipeline-layer',
        data: {
          action: context.action,
          agentId: context.agentId,
          passedLayers,
          totalLayers,
          avgScore,
          duration: Date.now() - context.startTime,
          layerScores: layerResults.map((r) => ({
            layer: r.layerId,
            score: r.score,
            passed: r.passed,
          })),
        },
        confidence: this.calculateConfidence(passedLayers, totalLayers),
        timestamp: new Date().toISOString(),
      };

      this.entries.push(entry);

      // Evict oldest entries if over capacity (FIFO)
      if (this.entries.length > this.maxEntries) {
        const evicted = this.entries.length - this.maxEntries;
        this.entries = this.entries.slice(-this.maxEntries);
        console.warn(
          `[LearningLayer] Evicted ${evicted} old entries (capacity: ${this.maxEntries})`,
        );
      }

      // 2. Auto-detect patterns
      if (this.autoDetect) {
        this.detectPatterns(entry);
      }

      // 3. Generate insights summary
      const recentInsights = this.patterns.filter(
        (p) => Date.now() - new Date(p.lastDetected).getTime() < 60 * 60 * 1000,
      );

      // NEVER blocks
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: 100,
        duration: Date.now() - start,
        details: {
          entriesRecorded: this.entries.length,
          patternsDetected: this.patterns.length,
          recentInsights: recentInsights.length,
          latestEntry: {
            id: entry.id,
            type: entry.type,
            confidence: entry.confidence,
          },
          topPatterns: this.patterns
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3)
            .map((p) => ({
              pattern: p.pattern,
              confidence: p.confidence,
              occurrences: p.occurrences,
            })),
        },
      };
    } catch (error) {
      // NEVER blocks
      return {
        layerId: this.id,
        layerName: this.name,
        passed: true,
        score: 0,
        duration: Date.now() - start,
        details: {
          error: error instanceof Error ? error.message : 'Unknown learning error',
          note: 'Learning layer does not block — error recorded',
        },
      };
    }
  }

  private determineEventType(
    context: PipelineDispatcherContext,
    completedLayers: number,
  ): LearningEntry['type'] {
    if (context.failed) return 'correction';
    if (completedLayers >= 7) return 'insight';
    if (completedLayers >= 4) return 'observation';
    return 'feedback';
  }

  private calculateConfidence(passedLayers: number, totalLayers: number): number {
    if (totalLayers === 0) return 0;
    return Math.round((passedLayers / totalLayers) * 100) / 100;
  }

  private detectPatterns(entry: LearningEntry): void {
    // Pattern: consistent success across pipelines
    const recentEntries = this.entries.filter(
      (e) => Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000,
    );

    if (recentEntries.length >= 3) {
      const successRate =
        recentEntries.filter((e) => e.type !== 'correction').length / recentEntries.length;

      if (successRate >= 0.8) {
        this.upsertPattern({
          id: 'consistent-success',
          pattern: 'Pipeline consistently succeeds',
          confidence: Math.min(0.95, successRate),
          occurrences: recentEntries.length,
          description: `${Math.round(successRate * 100)}% success rate across ${recentEntries.length} recent pipeline runs`,
          category: 'success',
          lastDetected: new Date().toISOString(),
        });
      }
    }

    // Pattern: agent-specific performance
    const agentEntries = recentEntries.filter((e) => e.data.agentId === entry.data.agentId);
    if (agentEntries.length >= 2) {
      const agentSuccess =
        agentEntries.filter((e) => e.type !== 'correction').length / agentEntries.length;

      this.upsertPattern({
        id: `agent-${entry.data.agentId}-performance`,
        pattern: `Agent ${(entry.data.agentId as string) ?? 'unknown'} performance`,
        confidence: Math.min(0.9, agentSuccess),
        occurrences: agentEntries.length,
        description: `Agent '${entry.data.agentId}' has ${Math.round(agentSuccess * 100)}% success rate`,
        category: 'source',
        lastDetected: new Date().toISOString(),
      });
    }

    // Pattern: action-type correlation
    const actionEntries = recentEntries.filter((e) => e.data.action === entry.data.action);
    if (actionEntries.length >= 2) {
      const actionSuccess =
        actionEntries.filter((e) => e.type !== 'correction').length / actionEntries.length;

      if (actionSuccess < 0.5) {
        this.upsertPattern({
          id: `action-${String(entry.data.action)}-difficulty`,
          pattern: `Action '${String(entry.data.action)}' frequently fails`,
          confidence: Math.min(0.85, 1 - actionSuccess),
          occurrences: actionEntries.length,
          description: `Action '${entry.data.action}' fails ${Math.round((1 - actionSuccess) * 100)}% of the time`,
          category: 'failure',
          lastDetected: new Date().toISOString(),
        });
      }
    }
  }

  private upsertPattern(pattern: LearningPattern): void {
    const existing = this.patterns.find((p) => p.id === pattern.id);
    if (existing) {
      existing.occurrences = pattern.occurrences;
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);
      existing.lastDetected = pattern.lastDetected;
    } else {
      this.patterns.push(pattern);
    }

    // Evict oldest patterns if over capacity (FIFO)
    if (this.patterns.length > this.maxPatterns) {
      const evicted = this.patterns.length - this.maxPatterns;
      this.patterns = this.patterns.slice(-this.maxPatterns);
      console.warn(
        `[LearningLayer] Evicted ${evicted} old patterns (capacity: ${this.maxPatterns})`,
      );
    }
  }

  getEntries(): LearningEntry[] {
    return [...this.entries];
  }

  getPatterns(): LearningPattern[] {
    return [...this.patterns];
  }

  getPatternsByCategory(category: string): LearningPattern[] {
    return this.patterns.filter((p) => p.category === category);
  }

  clearEntries(): void {
    this.entries = [];
  }

  clearPatterns(): void {
    this.patterns = [];
  }
}
