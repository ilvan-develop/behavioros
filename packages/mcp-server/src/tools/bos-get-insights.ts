import type { BosLearningEngine } from '@behavioros/core';
import { z } from 'zod';

export const bosGetInsightsInput = z.object({});

export type BosGetInsightsInput = z.infer<typeof bosGetInsightsInput>;

export async function bosGetInsights(learningEngine: BosLearningEngine) {
  const stats = learningEngine.getStats();
  const insights = learningEngine.analyze();

  const recommendations = insights
    .filter((i) => i.recommendation !== 'reinforce' || i.suggestedMutation)
    .map((i) => ({
      pattern: i.pattern,
      successRate: `${(i.successRate * 100).toFixed(0)}%`,
      avgQuality: i.avgQuality.toFixed(2),
      sampleSize: i.sampleSize,
      recommendation: i.recommendation,
      suggestion: i.suggestedMutation,
    }));

  const mutations = insights
    .filter((i) => i.recommendation === 'mutate' || i.recommendation === 'abandon')
    .map(
      (i) =>
        `Pattern "${i.pattern}": ${i.recommendation} — ${i.suggestedMutation ?? 'No specific mutation'}`,
    );

  const lines: string[] = [
    'Behavioral Pattern Insights',
    '',
    '--- SYSTEM STATS ---',
    `Total records: ${stats.totalRecords}`,
    `Active patterns: ${stats.patterns}`,
    `Overall success rate: ${(stats.overallSuccessRate * 100).toFixed(0)}%`,
    `Average quality: ${stats.avgQuality.toFixed(2)}`,
  ];

  if (recommendations.length > 0) {
    lines.push('', '--- PATTERN ANALYSIS ---');
    for (const rec of recommendations) {
      lines.push(
        `  ${rec.pattern}: ${rec.recommendation} (success=${rec.successRate}, quality=${rec.avgQuality}, n=${rec.sampleSize})`,
      );
      if (rec.suggestion) {
        lines.push(`    -> ${rec.suggestion}`);
      }
    }
  } else {
    lines.push('', '--- PATTERN ANALYSIS ---');
    lines.push('  Insufficient data for pattern analysis. Record more behavioral events.');
  }

  if (mutations.length > 0) {
    lines.push('', '--- RECOMMENDED MUTATIONS ---');
    for (const m of mutations) {
      lines.push(`  * ${m}`);
    }
  }

  lines.push('', '--- RAW DATA ---', JSON.stringify({ stats, insights, recommendations }, null, 2));

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
