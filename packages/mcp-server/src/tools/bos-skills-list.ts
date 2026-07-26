import type { SkillEngine } from '@behavioros/core';
import { z } from 'zod';

export const bosSkillsListInput = z.object({
  category: z
    .enum([
      'development',
      'ai-research',
      'creative-design',
      'utilities',
      'web-data',
      'enterprise-communication',
      'productivity',
      'security',
      'devops',
      'database',
      'design',
      'compliance',
      'custom',
    ])
    .optional()
    .describe('Filter by skill category'),
  authorityLevel: z
    .enum(['junior', 'senior', 'architect', 'lead', 'director', 'vp', 'c-level'])
    .optional()
    .describe('Filter by required authority level'),
  source: z
    .enum(['behavioros', 'aitmpl', 'open-design', 'ui-ux-pro-max', 'local'])
    .optional()
    .describe('Filter by source'),
});

export type BosSkillsListInput = z.infer<typeof bosSkillsListInput>;

export async function bosSkillsList(skillEngine: SkillEngine, input: BosSkillsListInput) {
  const { category, authorityLevel, source } = input;

  // Use search with empty query to get all, then apply filters
  const skills = await skillEngine.search('', {
    category,
    authorityLevel,
    source,
  });

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(
          {
            total: skills.length,
            filters: {
              category: category ?? 'any',
              authorityLevel: authorityLevel ?? 'any',
              source: source ?? 'any',
            },
            skills: skills.map((s) => ({
              id: s.id,
              name: s.name,
              version: s.version,
              category: s.category,
              authorityRequired: s.authorityRequired,
              source: s.source,
              tags: s.tags,
            })),
          },
          null,
          2,
        ),
      },
    ],
  };
}
