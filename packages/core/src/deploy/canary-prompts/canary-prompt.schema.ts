import { z } from 'zod';

// ============================================================
// Canary Prompt Schema — Zod v4.4.3
// Behavioral drift detection via LLM prompt testing
// ============================================================

export const CanaryPromptCategorySchema = z.enum([
  'safety',
  'accuracy',
  'compliance',
  'performance',
]);
export type CanaryPromptCategory = z.infer<typeof CanaryPromptCategorySchema>;

export const CanaryPromptDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  prompt: z.string().min(1),
  expectedBehavior: z.string().min(1),
  driftThreshold: z.number().min(0).max(1).default(0.3),
  category: CanaryPromptCategorySchema,
  tags: z.array(z.string()).default([]),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CanaryPromptDefinition = z.infer<typeof CanaryPromptDefinitionSchema>;

export const CanaryPromptCreateSchema = CanaryPromptDefinitionSchema.omit({
  createdAt: true,
  updatedAt: true,
});
export type CanaryPromptCreate = z.infer<typeof CanaryPromptCreateSchema>;

export const CanaryPromptResultSchema = z.object({
  promptId: z.string(),
  model: z.string(),
  response: z.string(),
  driftScore: z.number().min(0).max(1),
  passed: z.boolean(),
  latencyMs: z.number(),
  timestamp: z.string().datetime(),
  error: z.string().optional(),
});
export type CanaryPromptResult = z.infer<typeof CanaryPromptResultSchema>;

export const CanaryPromptBatchResultSchema = z.object({
  results: z.array(CanaryPromptResultSchema),
  overallDriftScore: z.number().min(0).max(1),
  overallPassed: z.boolean(),
  failedPrompts: z.array(z.string()),
  totalLatencyMs: z.number(),
  timestamp: z.string().datetime(),
});
export type CanaryPromptBatchResult = z.infer<typeof CanaryPromptBatchResultSchema>;

export const DriftDetectionSchema = z.object({
  detected: z.boolean(),
  severity: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  affectedPrompts: z.array(z.string()),
  averageDriftScore: z.number().min(0).max(1),
  maxDriftScore: z.number().min(0).max(1),
  recommendation: z.enum(['continue', 'investigate', 'rollback']),
  details: z.string().optional(),
});
export type DriftDetection = z.infer<typeof DriftDetectionSchema>;
