import { randomUUID } from 'node:crypto';

interface StoredEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * DetectedPattern — Configuration and options interface.
 */
export interface DetectedPattern {
  id: string;
  type: 'frequent-sequence' | 'anomaly' | 'trend';
  name: string;
  description: string;
  confidence: number;
  frequency?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  relatedEvents: string[];
  suggestedAction?: string;
  detectedAt: string;
}

/**
 * PatternDetector — pattern detector.
 *
 * Methods: record, detectFrequentSequences, detectAnomalies, detectTrends, getAllPatterns, clear.
 */
export class PatternDetector {
  private events: StoredEvent[] = [];
  private patterns: DetectedPattern[] = [];

  record(type: string, data: Record<string, unknown>): void {
    this.events.push({
      id: randomUUID(),
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  detectFrequentSequences(minOccurrences = 2): DetectedPattern[] {
    if (this.events.length < 2) return [];

    const newPatterns: DetectedPattern[] = [];

    for (let seqLen = 2; seqLen <= Math.min(4, this.events.length); seqLen++) {
      const sequenceCounts = new Map<string, { count: number; indices: number[] }>();

      for (let i = 0; i <= this.events.length - seqLen; i++) {
        const seq = this.events
          .slice(i, i + seqLen)
          .map((e) => e.type)
          .join(' -> ');
        const existing = sequenceCounts.get(seq) ?? { count: 0, indices: [] };
        existing.count++;
        existing.indices.push(i);
        sequenceCounts.set(seq, existing);
      }

      for (const [seqStr, info] of sequenceCounts) {
        if (info.count >= minOccurrences) {
          const confidence = Math.min(
            0.95,
            0.5 + (info.count / Math.max(1, this.events.length - seqLen + 1)) * 0.5,
          );
          const relatedIds = info.indices.flatMap((idx) =>
            this.events.slice(idx, idx + seqLen).map((e) => e.id),
          );

          const existing = this.patterns.find((p) => p.name === `frequent-sequence: ${seqStr}`);

          if (existing) {
            existing.frequency = info.count;
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            existing.detectedAt = new Date().toISOString();
          } else {
            newPatterns.push({
              id: randomUUID(),
              type: 'frequent-sequence',
              name: `frequent-sequence: ${seqStr}`,
              description: `Sequence "${seqStr}" occurred ${info.count} times`,
              confidence,
              frequency: info.count,
              relatedEvents: relatedIds,
              suggestedAction: `Investigate recurring sequence: ${seqStr}`,
              detectedAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    this.patterns.push(...newPatterns);
    return newPatterns;
  }

  detectAnomalies(windowSize = 10, stdDevThreshold = 2): DetectedPattern[] {
    const newPatterns: DetectedPattern[] = [];
    const byType = this.groupBy(this.events, (e) => e.type);

    for (const [type, typeEvents] of Object.entries(byType)) {
      if (typeEvents.length < 4) continue;

      const sorted = [...typeEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const totalSpan = this.timeSpanMs(sorted);
      if (totalSpan <= 0) continue;

      const _binSize = totalSpan / windowSize;
      const bins: number[] = new Array(windowSize).fill(0);

      for (const event of sorted) {
        const t = new Date(event.timestamp).getTime();
        const binIndex = Math.min(
          Math.floor(((t - new Date(sorted[0].timestamp).getTime()) / totalSpan) * windowSize),
          windowSize - 1,
        );
        bins[binIndex]++;
      }

      const mean = bins.reduce((s, c) => s + c, 0) / bins.length;
      const variance = bins.reduce((s, c) => s + (c - mean) ** 2, 0) / bins.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0) continue;

      const lastBinCount = bins[bins.length - 1];
      const zScore = Math.abs((lastBinCount - mean) / stdDev);

      if (zScore >= stdDevThreshold) {
        const severity =
          zScore >= stdDevThreshold * 3
            ? 'critical'
            : zScore >= stdDevThreshold * 2.5
              ? 'high'
              : 'medium';

        const existing = this.patterns.find((p) => p.name === `anomaly: ${type}`);

        if (existing) {
          existing.confidence = Math.min(0.95, existing.confidence + 0.05);
          existing.detectedAt = new Date().toISOString();
        } else {
          newPatterns.push({
            id: randomUUID(),
            type: 'anomaly',
            name: `anomaly: ${type}`,
            description: `Anomalous "${type}" event count in last bin: ${lastBinCount} (z-score: ${zScore.toFixed(2)})`,
            confidence: Math.min(0.9, 0.5 + (zScore / (stdDevThreshold * 3)) * 0.4),
            severity,
            relatedEvents: sorted.slice(-lastBinCount).map((e) => e.id),
            suggestedAction: `Review "${type}" events — unusual activity detected (z-score: ${zScore.toFixed(2)})`,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    this.patterns.push(...newPatterns);
    return newPatterns;
  }

  detectTrends(windowSize = 10): DetectedPattern[] {
    const newPatterns: DetectedPattern[] = [];
    const byType = this.groupBy(this.events, (e) => e.type);

    for (const [type, typeEvents] of Object.entries(byType)) {
      if (typeEvents.length < windowSize * 2) continue;

      const sorted = [...typeEvents].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const totalSpan = this.timeSpanMs(sorted);
      if (totalSpan <= 0) continue;

      const _binSize = totalSpan / (windowSize * 2);
      const totalBins = windowSize * 2;
      const bins: number[] = new Array(totalBins).fill(0);

      for (const event of sorted) {
        const t = new Date(event.timestamp).getTime();
        const binIndex = Math.min(
          Math.floor(((t - new Date(sorted[0].timestamp).getTime()) / totalSpan) * totalBins),
          totalBins - 1,
        );
        bins[binIndex]++;
      }

      const firstBins = bins.slice(0, windowSize);
      const secondBins = bins.slice(windowSize);

      const firstSum = firstBins.reduce((s, c) => s + c, 0);
      const secondSum = secondBins.reduce((s, c) => s + c, 0);

      if (firstSum <= 0) continue;

      const changeRatio = secondSum / firstSum;

      let direction: string;
      let confidence: number;
      if (changeRatio > 1.3) {
        direction = 'increasing';
        confidence = Math.min(0.9, 0.5 + (changeRatio - 1) * 0.2);
      } else if (changeRatio < 0.77) {
        direction = 'decreasing';
        confidence = Math.min(0.9, 0.5 + (1 / changeRatio - 1) * 0.15);
      } else {
        continue;
      }

      const existing = this.patterns.find((p) => p.name === `trend: ${type}`);

      if (existing) {
        existing.confidence = Math.min(0.95, existing.confidence + 0.03);
        existing.detectedAt = new Date().toISOString();
        existing.frequency = sorted.length;
      } else {
        newPatterns.push({
          id: randomUUID(),
          type: 'trend',
          name: `trend: ${type}`,
          description: `"${type}" events are ${direction} (${firstSum} → ${secondSum} per half)`,
          confidence,
          frequency: sorted.length,
          relatedEvents: sorted.slice(-windowSize).map((e) => e.id),
          suggestedAction:
            direction === 'increasing'
              ? `Investigate cause of rising "${type}" events`
              : `Review what changed — "${type}" events are declining`,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    this.patterns.push(...newPatterns);
    return newPatterns;
  }

  getAllPatterns(): DetectedPattern[] {
    return [...this.patterns];
  }

  clear(): void {
    this.events = [];
    this.patterns = [];
  }

  private timeSpanMs(events: StoredEvent[]): number {
    if (events.length < 2) return 0;
    const times = events.map((e) => new Date(e.timestamp).getTime());
    return Math.max(times[times.length - 1] - times[0], 1);
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
