import { z } from 'zod';

// ============================================================
// BehaviorOS Ecosystem Schemas — Phase 0: Schema Universal
// ============================================================

// --- Skill ---

export const SkillCategorySchema = z.enum([
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
]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillAuthoritySchema = z.enum([
  'junior',
  'senior',
  'architect',
  'lead',
  'director',
  'vp',
  'c-level',
]);
export type SkillAuthority = z.infer<typeof SkillAuthoritySchema>;

export const SkillSourceSchema = z.enum([
  'behavioros',
  'aitmpl',
  'open-design',
  'ui-ux-pro-max',
  'local',
]);
export type SkillSource = z.infer<typeof SkillSourceSchema>;

export const SkillSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  category: SkillCategorySchema,
  authorityRequired: SkillAuthoritySchema.optional(),
  prerequisites: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  source: SkillSourceSchema,
  installCommand: z.string().optional(),
  checksum: z.string().optional(),
  installedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type Skill = z.infer<typeof SkillSchema>;

export const SkillRefSchema = z.object({
  id: z.string(),
  proficiency: z.number().min(1).max(5).optional(),
});
export type SkillRef = z.infer<typeof SkillRefSchema>;

// --- Component Registry ---

export const ComponentTypeSchema = z.enum([
  'skill',
  'mcp',
  'agent',
  'dna',
  'design-system',
  'plugin',
  'prompt-template',
]);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

export const ComponentSourceSchema = z.enum([
  'behavioros',
  'aitmpl',
  'open-design',
  'ui-ux-pro-max',
  'local',
  'custom',
]);
export type ComponentSource = z.infer<typeof ComponentSourceSchema>;

export const ComponentStatusSchema = z.enum([
  'active',
  'inactive',
  'outdated',
  'conflict',
  'installing',
  'error',
]);
export type ComponentStatus = z.infer<typeof ComponentStatusSchema>;

export const ComponentRegistrySchema = z.object({
  id: z.string(),
  type: ComponentTypeSchema,
  name: z.string(),
  source: ComponentSourceSchema,
  version: z.string(),
  status: ComponentStatusSchema.default('active'),
  description: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  authorityRequired: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  installedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type ComponentRegistry = z.infer<typeof ComponentRegistrySchema>;

// --- Mission Decomposition ---

export const RejectionReasonSchema = z.object({
  code: z.enum([
    'missing-skill',
    'insufficient-authority',
    'overloaded',
    'out-of-scope',
    'conflict',
    'timeout',
  ]),
  details: z.string(),
  suggestion: z.string().optional(),
  requiredSkill: z.string().optional(),
});
export type RejectionReason = z.infer<typeof RejectionReasonSchema>;

export const SubTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.enum([
    'design',
    'implementation',
    'testing',
    'documentation',
    'review',
    'security',
    'deployment',
    'compliance',
  ]),
  requiredSkill: z.string(),
  status: z
    .enum(['pending', 'routed', 'accepted', 'in_progress', 'completed', 'rejected', 'failed'])
    .default('pending'),
  assignedAgent: z.string().optional(),
  rejectionReason: RejectionReasonSchema.optional(),
  output: z.any().optional(),
});
export type SubTask = z.infer<typeof SubTaskSchema>;

export const TaskRouteSchema = z.object({
  subtaskId: z.string(),
  agentId: z.string(),
  confidence: z.number().min(0).max(1),
  strategy: z.enum(['dna-match', 'capability-match', 'semantic-fallback']),
});
export type TaskRoute = z.infer<typeof TaskRouteSchema>;

export const AutonomousMissionStatusSchema = z.enum([
  'created',
  'decomposing',
  'routing',
  'executing',
  'review',
  'completed',
  'failed',
]);
export type AutonomousMissionStatus = z.infer<typeof AutonomousMissionStatusSchema>;

export const AutonomousMissionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.enum(['feature', 'bugfix', 'refactor', 'security', 'deploy', 'research']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  status: AutonomousMissionStatusSchema,
  subtasks: z.array(SubTaskSchema).default([]),
  routing: z.array(TaskRouteSchema).default([]),
  dnaPattern: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  lifecycle: z
    .object({
      docsGenerated: z.boolean().default(false),
      testsGenerated: z.boolean().default(false),
      auditPassed: z.boolean().default(false),
      learningRecorded: z.boolean().default(false),
    })
    .default({}),
});
export type AutonomousMission = z.infer<typeof AutonomousMissionSchema>;

// --- Ecosystem Report ---

export const EcosystemReportSchema = z.object({
  project: z.string(),
  timestamp: z.string().datetime(),
  agents: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      skillsCount: z.number(),
    }),
  ),
  skills: z.array(ComponentRegistrySchema),
  mcps: z.array(ComponentRegistrySchema),
  designSystems: z.array(ComponentRegistrySchema),
  dnas: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
      active: z.boolean(),
    }),
  ),
  audit: z
    .object({
      lastRun: z.string().datetime().optional(),
      passed: z.boolean(),
    })
    .optional(),
});
export type EcosystemReport = z.infer<typeof EcosystemReportSchema>;
