import { randomUUID } from 'node:crypto';
import type { LearningEvent } from '@behavioros/schemas';

// ============================================================
// Learning Engine — Pattern Recognition, Feedback, Auto-Apply
// ============================================================

export interface PatternInsight {
  id: string;
  pattern: string;
  confidence: number;
  occurrences: number;
  description: string;
  suggestedAction?: string;
}

export interface LearningReport {
  id: string;
  totalEvents: number;
  insights: PatternInsight[];
  appliedCount: number;
  pendingCount: number;
  timestamp: string;
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

  /**
   * Regista um evento de aprendizagem
   */
  record(event: Omit<LearningEvent, 'id' | 'timestamp'>): LearningEvent {
    const enriched: LearningEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.events.push(enriched);
    this.analyzePattern(enriched);
    return enriched;
  }

  /**
   * Obtém todos os eventos
   */
  getEvents(): LearningEvent[] {
    return [...this.events];
  }

  /**
   * Obtém insights reconhecidos
   */
  getInsights(): PatternInsight[] {
    return [...this.insights];
  }

  /**
   * Aplica um insight automaticamente
   */
  applyInsight(insightId: string): boolean {
    const insight = this.insights.find((i) => i.id === insightId);
    if (!insight) return false;

    insight.confidence = Math.min(1, insight.confidence + 0.1);
    return true;
  }

  /**
   * Gera um relatório de aprendizagem
   */
  generateReport(): LearningReport {
    return {
      id: randomUUID(),
      totalEvents: this.events.length,
      insights: this.insights,
      appliedCount: this.events.filter((e) => e.applied).length,
      pendingCount: this.events.filter((e) => !e.applied).length,
      timestamp: new Date().toISOString(),
    };
  }

  private analyzePattern(event: LearningEvent): void {
    // Simple pattern recognition — looks for repeated types
    const sameType = this.events.filter((e) => e.type === event.type && e.source === event.source);
    if (sameType.length >= 3) {
      const existing = this.insights.find(
        (i) => i.pattern === event.type && i.description.includes(event.source),
      );
      if (existing) {
        existing.occurrences = sameType.length;
        existing.confidence = Math.min(1, existing.confidence + 0.05);
      } else {
        this.insights.push({
          id: randomUUID(),
          pattern: event.type,
          confidence: 0.5,
          occurrences: sameType.length,
          description: `Pattern detected: ${event.type} from ${event.source}`,
          suggestedAction: `Consider automating response to ${event.type} events`,
        });
      }
    }
  }

  /**
   * Resumo
   */
  summary(): string {
    const lines: string[] = [];
    lines.push(`Learning Engine: ${this.events.length} events, ${this.insights.length} insights`);
    lines.push(`Applied: ${this.events.filter((e) => e.applied).length}`);
    lines.push(`Pending: ${this.events.filter((e) => !e.applied).length}`);
    if (this.insights.length > 0) {
      lines.push('Top insights:');
      for (const insight of this.insights.slice(0, 5)) {
        lines.push(
          `  - ${insight.description} (${(insight.confidence * 100).toFixed(0)}% confidence, ${insight.occurrences} occurrences)`,
        );
      }
    }
    return lines.join('\n');
  }
}
