import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import type { LearningEvent } from '@behavioros/schemas';

export type PatternCategory =
  | 'temporal'
  | 'correlation'
  | 'trend'
  | 'anomaly'
  | 'success'
  | 'failure'
  | 'source';

export interface PatternInsight {
  id: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  description: string;
  suggestedAction?: string;
  category: PatternCategory;
  lastDetected: string;
}

export interface TrendInfo {
  type: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  periodCount: number;
  recentCount: number;
  currentRate: number;
}

export interface AnomalyInfo {
  type: string;
  detectedAt: string;
  expectedRate: number;
  actualRate: number;
  multiplier: number;
  windowMinutes: number;
  eventIds: string[];
}

export interface SourceReputation {
  source: string;
  totalEvents: number;
  insightCount: number;
  correctionCount: number;
  insightRatio: number;
  averageConfidence: number;
}

export interface LearningReport {
  id: string;
  totalEvents: number;
  insights: PatternInsight[];
  appliedCount: number;
  pendingCount: number;
  timestamp: string;
  trends: TrendInfo[];
  anomalies: AnomalyInfo[];
}

interface PersistedState {
  events: LearningEvent[];
  insights: PatternInsight[];
}

export class LearningEngine {
  private events: LearningEvent[] = [];
  private insights: PatternInsight[] = [];
  private persistPath?: string;
  private autoApply: boolean;

  constructor(options?: { persistPath?: string; autoApply?: boolean }) {
    this.persistPath = options?.persistPath;
    this.autoApply = options?.autoApply ?? false;
  }

  record(event: Omit<LearningEvent, 'id' | 'timestamp'>): LearningEvent {
    const enriched: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.events.push(enriched);

    this.runDetection(enriched);

    if (this.autoApply) {
      this.autoApplyInsights();
    }

    return enriched;
  }

  getEvents(): LearningEvent[] {
    return [...this.events];
  }

  getInsights(): PatternInsight[] {
    return [...this.insights];
  }

  getInsightsByCategory(category: PatternCategory): PatternInsight[] {
    return this.insights.filter((i) => i.category === category);
  }

  getTrends(): TrendInfo[] {
    if (this.events.length < 2) return [];

    const sorted = [...this.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const byType = this.groupBy(this.events, (e) => e.type);

    const trends: TrendInfo[] = [];

    for (const [type, events] of Object.entries(byType)) {
      if (events.length < 3) continue;

      const half = Math.floor(events.length / 2);
      const firstHalf = events.slice(0, half);
      const secondHalf = events.slice(half);

      const firstRate = firstHalf.length / this.timeSpanHours(firstHalf);
      const secondRate = secondHalf.length / this.timeSpanHours(secondHalf);

      const now = new Date(sorted[sorted.length - 1].timestamp).getTime();
      const recentWindow = now - 24 * 60 * 60 * 1000;
      const recentCount = events.filter(
        (e) => new Date(e.timestamp).getTime() >= recentWindow,
      ).length;

      const slope = firstRate > 0 ? (secondRate - firstRate) / firstRate : 0;

      let direction: 'increasing' | 'decreasing' | 'stable';
      if (slope > 0.15) direction = 'increasing';
      else if (slope < -0.15) direction = 'decreasing';
      else direction = 'stable';

      trends.push({
        type,
        direction,
        slope,
        periodCount: events.length,
        recentCount,
        currentRate: secondRate,
      });
    }

    return trends;
  }

  getAnomalies(): AnomalyInfo[] {
    if (this.events.length < 5) return [];

    const anomalies: AnomalyInfo[] = [];
    const now = Date.now();
    const byType = this.groupBy(this.events, (e) => e.type);

    for (const [type, events] of Object.entries(byType)) {
      const sorted = [...events].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      if (sorted.length < 4) continue;

      const mainBody = sorted.slice(0, -Math.ceil(sorted.length * 0.2));
      const bodySpan = this.timeSpanHours(mainBody);
      const expectedRate = bodySpan > 0 ? mainBody.length / bodySpan : 0;

      if (expectedRate <= 0) continue;

      const windowMinutes = 60;
      const windowMs = windowMinutes * 60 * 1000;
      const recent = sorted.filter((e) => now - new Date(e.timestamp).getTime() < windowMs);
      const actualRate = recent.length / (windowMinutes / 60);

      if (actualRate > expectedRate * 3 && recent.length >= 3) {
        anomalies.push({
          type,
          detectedAt: new Date().toISOString(),
          expectedRate: expectedRate,
          actualRate,
          multiplier: actualRate / expectedRate,
          windowMinutes,
          eventIds: recent.map((e) => e.id),
        });
      }
    }

    return anomalies;
  }

  getSourceReputation(source: string): SourceReputation | null {
    const sourceEvents = this.events.filter((e) => e.source === source);
    if (sourceEvents.length === 0) return null;

    const insightCount = sourceEvents.filter((e) => e.type === 'insight').length;
    const correctionCount = sourceEvents.filter((e) => e.type === 'correction').length;
    const totalConfidence = sourceEvents.reduce((s, e) => s + (e.confidence ?? 0.5), 0);

    return {
      source,
      totalEvents: sourceEvents.length,
      insightCount,
      correctionCount,
      insightRatio: totalConfidence > 0 ? insightCount / (insightCount + correctionCount + 1) : 0,
      averageConfidence: totalConfidence / sourceEvents.length,
    };
  }

  applyInsight(insightId: string): boolean {
    const insight = this.insights.find((i) => i.id === insightId);
    if (!insight) return false;

    insight.confidence = Math.min(1, insight.confidence + 0.1);
    insight.occurrences += 1;
    insight.lastDetected = new Date().toISOString();

    this.record({
      type: 'feedback',
      source: 'learning-engine',
      data: { appliedInsight: insightId, pattern: insight.pattern },
      confidence: 1,
      applied: true,
    });

    return true;
  }

  generateReport(): LearningReport {
    return {
      id: randomUUID(),
      totalEvents: this.events.length,
      insights: this.insights,
      appliedCount: this.events.filter((e) => e.applied).length,
      pendingCount: this.events.filter((e) => !e.applied).length,
      timestamp: new Date().toISOString(),
      trends: this.getTrends(),
      anomalies: this.getAnomalies(),
    };
  }

  async persist(path?: string): Promise<void> {
    const target = path ?? this.persistPath;
    if (!target) throw new Error('No persist path configured');
    const state: PersistedState = {
      events: this.events,
      insights: this.insights,
    };
    await writeFile(target, JSON.stringify(state, null, 2), 'utf-8');
  }

  async load(path?: string): Promise<void> {
    const target = path ?? this.persistPath;
    if (!target) throw new Error('No load path configured');
    const raw = await readFile(target, 'utf-8');
    const state: PersistedState = JSON.parse(raw);
    this.events = state.events ?? [];
    this.insights = state.insights ?? [];
  }

  private runDetection(event: LearningEvent): void {
    this.detectTemporalPattern(event);
    this.detectCorrelation(event);
    this.detectTrend(event);
    this.detectAnomaly(event);
    this.detectSuccessPattern(event);
    this.detectFailureChain(event);
    this.updateSourceReputationInsight(event);
  }

  // 1. Temporal Pattern Detection
  private detectTemporalPattern(_event: LearningEvent): void {
    if (this.events.length < 5) return;

    const byType = this.groupBy(this.events, (e) => e.type);
    const _sorted = [...this.events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    for (const [type, events] of Object.entries(byType)) {
      if (events.length < 3) continue;

      const dayCounts: Record<string, number> = {};
      for (const e of events) {
        const day = new Date(e.timestamp).toLocaleDateString('en-US', { weekday: 'long' });
        dayCounts[day] = (dayCounts[day] ?? 0) + 1;
      }

      const totalDays = Object.values(dayCounts).reduce((a, b) => a + b, 0);
      const avgPerDay = totalDays / Math.max(1, Object.keys(dayCounts).length);

      for (const [day, count] of Object.entries(dayCounts)) {
        if (count >= avgPerDay * 2 && count >= 3) {
          const ratio = count / totalDays;
          const patternId = `temporal-${type}-${day}`;
          const existing = this.insights.find((i) => i.id === patternId);

          if (existing) {
            existing.occurrences = count;
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            existing.lastDetected = new Date().toISOString();
          } else {
            this.insights.push({
              id: patternId,
              pattern: `${type} on ${day}`,
              confidence: Math.min(0.9, ratio),
              occurrences: count,
              description: `"${type}" events are ${(ratio * 100).toFixed(0)}% more common on ${day}`,
              suggestedAction: `Investigate root cause of ${type} spikes on ${day}`,
              category: 'temporal',
              lastDetected: new Date().toISOString(),
            });
          }
        }
      }

      // Hourly clustering
      const hourCounts: Record<number, number> = {};
      for (const e of events) {
        const hour = new Date(e.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
      }
      for (let h = 0; h < 24; h++) {
        if ((hourCounts[h] ?? 0) >= avgPerDay * 1.5 && (hourCounts[h] ?? 0) >= 2) {
          const patternId = `temporal-${type}-hour-${h}`;
          const existing = this.insights.find((i) => i.id === patternId);
          if (existing) {
            existing.occurrences = hourCounts[h];
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            existing.lastDetected = new Date().toISOString();
          } else {
            this.insights.push({
              id: patternId,
              pattern: `${type} around hour ${h}`,
              confidence: Math.min(0.8, (hourCounts[h] ?? 0) / totalDays),
              occurrences: hourCounts[h] ?? 0,
              description: `"${type}" events cluster around ${h}:00`,
              suggestedAction: `Consider scheduling preventive actions before ${h}:00`,
              category: 'temporal',
              lastDetected: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // 2. Correlation Detection
  private detectCorrelation(event: LearningEvent): void {
    if (this.events.length < 3) return;

    const windowMs = 10 * 60 * 1000;
    const recent = this.events.filter(
      (e) => Date.now() - new Date(e.timestamp).getTime() < windowMs,
    );

    for (const other of recent) {
      if (other.id === event.id) continue;

      const diff = Math.abs(
        new Date(event.timestamp).getTime() - new Date(other.timestamp).getTime(),
      );
      if (diff > windowMs) continue;

      const pair = [event.type, other.type].sort().join('->');
      const patternId = `correlation-${pair}`;
      const existing = this.insights.find((i) => i.id === patternId);

      if (existing) {
        existing.occurrences += 1;
        existing.confidence = Math.min(0.95, existing.confidence + 0.03);
        existing.lastDetected = new Date().toISOString();
      } else {
        this.insights.push({
          id: patternId,
          pattern: `${event.type} correlates with ${other.type}`,
          confidence: 0.4,
          occurrences: 1,
          description: `"${event.type}" events from "${event.source}" frequently follow "${other.type}" from "${other.source}" within ${(diff / 1000).toFixed(0)}s`,
          suggestedAction: `Monitor "${other.type}" as a leading indicator for "${event.type}"`,
          category: 'correlation',
          lastDetected: new Date().toISOString(),
        });
      }
    }
  }

  // 3. Trend Detection
  private detectTrend(event: LearningEvent): void {
    const byType = this.groupBy(this.events, (e) => e.type);
    const typeEvents = byType[event.type] ?? [];

    if (typeEvents.length < 4) return;

    const half = Math.floor(typeEvents.length / 2);
    const firstRate = half > 0 ? half / this.timeSpanHours(typeEvents.slice(0, half)) : 0;
    const secondRate =
      typeEvents.length - half > 0
        ? (typeEvents.length - half) / this.timeSpanHours(typeEvents.slice(half))
        : 0;

    if (firstRate <= 0 || secondRate <= 0) return;

    const changeRatio = secondRate / firstRate;
    const patternId = `trend-${event.type}`;
    const existing = this.insights.find((i) => i.id === patternId);

    let direction: string;
    let confidence: number;
    if (changeRatio > 1.5) {
      direction = 'increasing';
      confidence = Math.min(0.9, 0.5 + (changeRatio - 1) * 0.15);
    } else if (changeRatio < 0.67) {
      direction = 'decreasing';
      confidence = Math.min(0.9, 0.5 + (1 / changeRatio - 1) * 0.1);
    } else {
      return;
    }

    if (existing) {
      existing.confidence = Math.min(0.95, existing.confidence + 0.04);
      existing.occurrences += 1;
      existing.lastDetected = new Date().toISOString();
    } else {
      this.insights.push({
        id: patternId,
        pattern: `${event.type} ${direction}`,
        confidence,
        occurrences: 1,
        description: `"${event.type}" events are ${direction} (rate: ${firstRate.toFixed(2)}/h → ${secondRate.toFixed(2)}/h)`,
        suggestedAction:
          direction === 'increasing'
            ? `Investigate cause of rising "${event.type}" events`
            : `Review what changed — "${event.type}" events are declining`,
        category: 'trend',
        lastDetected: new Date().toISOString(),
      });
    }
  }

  // 4. Anomaly Detection
  private detectAnomaly(event: LearningEvent): void {
    if (this.events.length < 6) return;

    const byType = this.groupBy(this.events, (e) => e.type);
    const typeEvents = byType[event.type] ?? [];
    if (typeEvents.length < 4) return;

    const sorted = [...typeEvents].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const mainBody = sorted.slice(0, -2);
    const bodySpan = this.timeSpanHours(mainBody);
    const expectedRate = bodySpan > 0 ? mainBody.length / bodySpan : 0;

    if (expectedRate <= 0) return;

    const windowMs = 60 * 60 * 1000;
    const now = new Date(event.timestamp).getTime();
    const windowStart = now - windowMs;
    const recentCount = typeEvents.filter(
      (e) => new Date(e.timestamp).getTime() >= windowStart,
    ).length;
    const actualRate = recentCount / (windowMs / (60 * 60 * 1000));

    if (actualRate < expectedRate * 3 || recentCount < 3) return;

    const patternId = `anomaly-${event.type}`;
    const existing = this.insights.find((i) => i.id === patternId);

    if (existing) {
      existing.confidence = Math.min(0.95, existing.confidence + 0.06);
      existing.occurrences += 1;
      existing.lastDetected = new Date().toISOString();
    } else {
      this.insights.push({
        id: patternId,
        pattern: `${event.type} spike`,
        confidence: Math.min(0.9, 0.5 + (actualRate / expectedRate) * 0.1),
        occurrences: 1,
        description: `Anomaly: "${event.type}" rate is ${(actualRate / expectedRate).toFixed(1)}x normal (expected: ${expectedRate.toFixed(2)}/h, actual: ${actualRate.toFixed(2)}/h)`,
        suggestedAction: `Alert: unusual "${event.type}" activity detected — investigate immediately`,
        category: 'anomaly',
        lastDetected: new Date().toISOString(),
      });
    }
  }

  // 5. Success Pattern Detection
  private detectSuccessPattern(_event: LearningEvent): void {
    const successes = this.events.filter((e) => e.type === 'insight' && e.confidence >= 0.7);
    const _failures = this.events.filter((e) => e.type === 'correction');

    if (successes.length < 2) return;

    // Check if feedback events precede successful insights
    for (const success of successes) {
      const before = this.events.filter((e) => {
        const eTime = new Date(e.timestamp).getTime();
        const sTime = new Date(success.timestamp).getTime();
        return eTime < sTime && sTime - eTime < 30 * 60 * 1000;
      });

      const feedbackBefore = before.filter((e) => e.type === 'feedback');
      if (feedbackBefore.length >= 1) {
        const patternId = 'success-feedback-loop';
        const existing = this.insights.find((i) => i.id === patternId);

        if (existing) {
          existing.occurrences += 1;
          existing.confidence = Math.min(0.95, existing.confidence + 0.05);
          existing.lastDetected = new Date().toISOString();
        } else {
          this.insights.push({
            id: patternId,
            pattern: 'Feedback leads to insight',
            confidence: 0.6,
            occurrences: 1,
            description:
              'High-confidence insights are often preceded by feedback events within 30min',
            suggestedAction: 'Encourage more feedback loops to increase insight quality',
            category: 'success',
            lastDetected: new Date().toISOString(),
          });
        }
      }
    }

    // Success rate by source
    const bySource = this.groupBy(successes, (e) => e.source);
    for (const [source, sEvents] of Object.entries(bySource)) {
      if (sEvents.length < 2) continue;
      const totalFromSource = this.events.filter((e) => e.source === source).length;
      if (totalFromSource < 3) continue;
      const successRate = sEvents.length / totalFromSource;

      if (successRate >= 0.6) {
        const patternId = `success-source-${source}`;
        const existing = this.insights.find((i) => i.id === patternId);

        if (existing) {
          existing.confidence = Math.min(0.95, existing.confidence + 0.04);
          existing.lastDetected = new Date().toISOString();
        } else {
          this.insights.push({
            id: patternId,
            pattern: `${source} has high success rate`,
            confidence: successRate,
            occurrences: sEvents.length,
            description: `Source "${source}" produces high-value insights ${(successRate * 100).toFixed(0)}% of the time`,
            suggestedAction: `Prioritize outputs from "${source}" for critical decisions`,
            category: 'success',
            lastDetected: new Date().toISOString(),
          });
        }
      }
    }
  }

  // 6. Failure Chain Detection
  private detectFailureChain(_event: LearningEvent): void {
    const failures = this.events.filter((e) => e.type === 'correction');
    if (failures.length < 2) return;

    for (const failure of failures) {
      const windowMs = 15 * 60 * 1000;
      const fTime = new Date(failure.timestamp).getTime();
      const preceding = this.events.filter((e) => {
        const eTime = new Date(e.timestamp).getTime();
        return eTime < fTime && fTime - eTime < windowMs;
      });

      if (preceding.length < 2) continue;

      const chainTypes = preceding.map((e) => e.type).join(' → ');
      const patternId = `failure-chain-${chainTypes.replace(/\s+/g, '-')}`;
      const existing = this.insights.find((i) => i.id === patternId);

      if (existing) {
        existing.occurrences += 1;
        existing.confidence = Math.min(0.95, existing.confidence + 0.08);
        existing.lastDetected = new Date().toISOString();
      } else {
        this.insights.push({
          id: patternId,
          pattern: `Failure chain: ${chainTypes}`,
          confidence: 0.45,
          occurrences: 1,
          description: `Correction events follow this sequence: ${chainTypes}`,
          suggestedAction: `Interrupt the chain after "${preceding[preceding.length - 1]?.type}" to prevent failure`,
          category: 'failure',
          lastDetected: new Date().toISOString(),
        });
      }
    }
  }

  // 7. Source Reputation Tracking
  private updateSourceReputationInsight(_event: LearningEvent): void {
    const bySource = this.groupBy(this.events, (e) => e.source);

    for (const [source, sEvents] of Object.entries(bySource)) {
      if (sEvents.length < 3) continue;

      const insightCount = sEvents.filter((e) => e.type === 'insight').length;
      const correctionCount = sEvents.filter((e) => e.type === 'correction').length;
      const totalConfidence = sEvents.reduce((s, e) => s + (e.confidence ?? 0.5), 0);
      const avgConfidence = totalConfidence / sEvents.length;
      const ratio = correctionCount > 0 ? insightCount / correctionCount : insightCount;

      let reputation: string;
      if (ratio >= 2 && avgConfidence >= 0.7) {
        reputation = 'trusted';
      } else if (ratio >= 0.5) {
        reputation = 'neutral';
      } else {
        reputation = 'unreliable';
      }

      const patternId = `reputation-${source}`;
      const existing = this.insights.find((i) => i.id === patternId);

      const confidence = Math.min(0.95, 0.4 + ratio * 0.1);

      if (existing) {
        existing.confidence = Math.min(0.95, existing.confidence + 0.02);
        existing.occurrences = sEvents.length;
        existing.lastDetected = new Date().toISOString();
      } else {
        this.insights.push({
          id: patternId,
          pattern: `${source} is ${reputation}`,
          confidence,
          occurrences: sEvents.length,
          description: `Source "${source}" has ${insightCount} insights vs ${correctionCount} corrections (ratio: ${ratio.toFixed(1)}), avg confidence: ${(avgConfidence * 100).toFixed(0)}%`,
          suggestedAction:
            reputation === 'trusted'
              ? `Increase weight of "${source}" in decision-making`
              : reputation === 'unreliable'
                ? `Review "${source}" outputs — high correction rate`
                : `Monitor "${source}" for more data`,
          category: 'source',
          lastDetected: new Date().toISOString(),
        });
      }
    }
  }

  // 8. Auto-apply high-confidence insights
  private autoApplyInsights(): void {
    for (const insight of this.insights) {
      if (insight.confidence > 0.8) {
        const alreadyApplied = this.events.some(
          (e) => e.type === 'feedback' && (e.data?.appliedInsight as string) === insight.id,
        );
        if (!alreadyApplied) {
          this.applyInsight(insight.id);
        }
      }
    }
  }

  summary(): string {
    const lines: string[] = [];
    lines.push(`Learning Engine: ${this.events.length} events, ${this.insights.length} insights`);
    lines.push(`Applied: ${this.events.filter((e) => e.applied).length}`);
    lines.push(`Pending: ${this.events.filter((e) => !e.applied).length}`);

    const categories = this.groupBy(this.insights, (i) => i.category);
    for (const [cat, catInsights] of Object.entries(categories)) {
      lines.push(`  ${cat}: ${catInsights.length} insights`);
    }

    if (this.insights.length > 0) {
      lines.push('Top insights:');
      for (const insight of this.insights.slice(0, 5)) {
        lines.push(
          `  [${insight.category}] ${insight.description} (${(insight.confidence * 100).toFixed(0)}% confidence, ${insight.occurrences} occurrences)`,
        );
      }
    }

    return lines.join('\n');
  }

  private timeSpanHours(events: LearningEvent[]): number {
    if (events.length < 2) return 1;
    const times = events.map((e) => new Date(e.timestamp).getTime());
    const spanMs = Math.max(times[times.length - 1] - times[0], 60_000);
    return spanMs / (60 * 60 * 1000);
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
    const map: Record<string, T[]> = {};
    for (const item of items) {
      const key = keyFn(item);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }
}
