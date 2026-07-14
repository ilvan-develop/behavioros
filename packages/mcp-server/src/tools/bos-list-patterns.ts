import type { BehaviorSelector } from '@behavioros/core';
import { z } from 'zod';

export const bosListPatternsInput = z.object({});

export type BosListPatternsInput = z.infer<typeof bosListPatternsInput>;

export async function bosListPatterns(selector: BehaviorSelector) {
  const rules = selector.listRules();

  const patternDetails = rules
    .map((r) => {
      const selection = r.result();
      return {
        id: r.id,
        priority: r.priority,
        primaryPattern: selection.primary,
        secondaryPattern: selection.secondary,
        blend: selection.blend,
        confidence: selection.confidence,
        rationale: selection.rationale,
      };
    })
    .sort((a, b) => b.priority - a.priority);

  const uniquePatterns = [...new Set(patternDetails.map((p) => p.primaryPattern))];

  const lines: string[] = [
    'Available Behavioral DNA Patterns',
    '',
    `Total rules: ${patternDetails.length}`,
    `Unique patterns: ${uniquePatterns.length}`,
    `Patterns: ${uniquePatterns.join(', ')}`,
    '',
    '--- RULE DETAILS (sorted by priority) ---',
  ];

  for (const detail of patternDetails) {
    lines.push(
      `  [${detail.priority}] ${detail.id}`,
      `    Pattern: ${detail.primaryPattern}${detail.secondaryPattern ? ` + ${detail.secondaryPattern} (${detail.blend.secondary}%)` : ''}`,
      `    Confidence: ${(detail.confidence * 100).toFixed(0)}%`,
      `    Rationale: ${detail.rationale}`,
    );
  }

  lines.push(
    '',
    '--- RAW DATA ---',
    JSON.stringify({ rules: patternDetails, uniquePatterns }, null, 2),
  );

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
