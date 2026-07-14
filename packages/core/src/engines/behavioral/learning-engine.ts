/**
 * BOS Learning Engine — records behavioral patterns, tracks success/failure,
 * and suggests DNA mutations.
 */

export interface BehavioralRecord {
  id: string;
  timestamp: string;
  dna: string;
  task: string;
  agent: string;
  squad?: string;
  success: boolean;
  duration: number;
  quality: number;
  metrics?: Record<string, number>;
  feedback?: string;
}

export interface PatternInsight {
  pattern: string;
  successRate: number;
  avgDuration: number;
  avgQuality: number;
  sampleSize: number;
  recommendation: 'reinforce' | 'mutate' | 'abandon';
  suggestedMutation?: string;
}

export interface DnaMutation {
  dna: string;
  field: string;
  from: unknown;
  to: unknown;
  reason: string;
  confidence: number;
}

const MIN_SAMPLES_FOR_ANALYSIS = 3;
const MIN_SAMPLES_FOR_MUTATIONS = 5;
const FAILURE_RATE_MUTATE_THRESHOLD = 0.3;
const SUCCESS_RATE_ABANDON_THRESHOLD = 0.6;
const SUCCESS_RATE_MUTATE_THRESHOLD = 0.8;
const LOW_QUALITY_THRESHOLD = 0.7;
const LONG_DURATION_MS = 300_000;

export class BosLearningEngine {
  private records: BehavioralRecord[] = [];
  private patterns: Map<string, BehavioralRecord[]> = new Map();

  async record(data: BehavioralRecord): Promise<void> {
    this.records.push(data);
    if (!this.patterns.has(data.dna)) {
      this.patterns.set(data.dna, []);
    }
    this.patterns.get(data.dna)!.push(data);
  }

  analyze(dna?: string): PatternInsight[] {
    const insights: PatternInsight[] = [];
    const patterns = dna ? [dna] : Array.from(this.patterns.keys());

    for (const pattern of patterns) {
      const records = this.patterns.get(pattern) ?? [];
      if (records.length < MIN_SAMPLES_FOR_ANALYSIS) {
        insights.push({
          pattern,
          successRate: 0,
          avgDuration: 0,
          avgQuality: 0,
          sampleSize: records.length,
          recommendation: 'reinforce',
          suggestedMutation: 'Insufficient data for analysis',
        });
        continue;
      }
      const successCount = records.filter((r) => r.success).length;
      const successRate = successCount / records.length;
      const avgDuration = records.reduce((s, r) => s + r.duration, 0) / records.length;
      const avgQuality = records.reduce((s, r) => s + r.quality, 0) / records.length;

      let recommendation: PatternInsight['recommendation'] = 'reinforce';
      let suggestedMutation: string | undefined;

      if (successRate < SUCCESS_RATE_ABANDON_THRESHOLD) {
        recommendation = 'abandon';
        suggestedMutation = 'Consider switching to a different DNA pattern';
      } else if (successRate < SUCCESS_RATE_MUTATE_THRESHOLD) {
        suggestedMutation = this.suggestMutation(pattern, records);
        if (suggestedMutation) {
          recommendation = 'mutate';
        }
      }

      insights.push({
        pattern,
        successRate,
        avgQuality,
        avgDuration,
        sampleSize: records.length,
        recommendation,
        suggestedMutation,
      });
    }

    return insights;
  }

  suggestMutations(dna: string): DnaMutation[] {
    const records = this.patterns.get(dna) ?? [];
    const mutations: DnaMutation[] = [];
    if (records.length < MIN_SAMPLES_FOR_MUTATIONS) return mutations;

    const failures = records.filter((r) => !r.success);
    const failureRate = failures.length / records.length;

    if (failureRate > FAILURE_RATE_MUTATE_THRESHOLD) {
      mutations.push({
        dna,
        field: 'risk_tolerance',
        from: 'low',
        to: 'medium',
        reason: `High failure rate (${(failureRate * 100).toFixed(0)}%) suggests risk tolerance too restrictive`,
        confidence: 0.7,
      });
    }

    const avgQuality = records.reduce((s, r) => s + r.quality, 0) / records.length;
    if (avgQuality < LOW_QUALITY_THRESHOLD) {
      mutations.push({
        dna,
        field: 'quality_gates.required',
        from: 'current',
        to: 'add more gates',
        reason: `Low avg quality (${avgQuality.toFixed(2)}) suggests insufficient gates`,
        confidence: 0.8,
      });
    }

    return mutations;
  }

  private suggestMutation(_pattern: string, records: BehavioralRecord[]): string {
    const failures = records.filter((r) => !r.success);
    const avgDuration = records.reduce((s, r) => s + r.duration, 0) / records.length;

    if (failures.length > records.length * FAILURE_RATE_MUTATE_THRESHOLD) {
      return 'High failure rate — add more quality gates or reduce risk tolerance';
    }
    if (avgDuration > LONG_DURATION_MS) {
      return 'Long duration — consider switching to parallel execution';
    }
    return 'Pattern performing within bounds — minor optimizations';
  }

  getRecords(dna?: string): BehavioralRecord[] {
    return dna ? this.records.filter((r) => r.dna === dna) : [...this.records];
  }

  getStats(): {
    totalRecords: number;
    patterns: number;
    overallSuccessRate: number;
    avgQuality: number;
  } {
    const total = this.records.length;
    return {
      totalRecords: total,
      patterns: this.patterns.size,
      overallSuccessRate: total > 0 ? this.records.filter((r) => r.success).length / total : 0,
      avgQuality: total > 0 ? this.records.reduce((s, r) => s + r.quality, 0) / total : 0,
    };
  }
}
