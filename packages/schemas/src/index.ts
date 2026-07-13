import { z } from 'zod'

// ============================================================
// BehaviorOS Core Schemas — Zod v4.4.3
// ============================================================

// --- DNA Pattern ---
export const AgentRoleSchema = z.enum([
  'engineer',
  'architect',
  'qa',
  'security',
  'devops',
  'product',
  'design',
  'data',
  'sre',
  'manager',
  'analyst',
  'researcher',
  'support',
  'specialist',
])
export type AgentRole = z.infer<typeof AgentRoleSchema>

export const AuthorityLevelSchema = z.enum(['junior', 'senior', 'architect', 'lead', 'director', 'vp', 'c-level'])
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>

export const BoundaryRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['max_files', 'max_lines', 'max_modules', 'require_approval', 'forbidden']),
  value: z.union([z.number(), z.string(), z.boolean()]),
  scope: z.enum(['per_commit', 'per_pr', 'per_session', 'global']),
})
export type BoundaryRule = z.infer<typeof BoundaryRuleSchema>

export const AgentPersonaSchema = z.object({
  role: AgentRoleSchema,
  authority: AuthorityLevelSchema,
  name: z.string().optional(),
  description: z.string().optional(),
  boundaries: z.array(BoundaryRuleSchema).optional(),
  skills: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
})
export type AgentPersona = z.infer<typeof AgentPersonaSchema>

export const VotingStrategySchema = z.enum(['unanimous', 'majority', 'weighted', 'byzantine', 'quorum'])
export type VotingStrategy = z.infer<typeof VotingStrategySchema>

export const GovernanceRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  level: z.enum(['critical', 'high', 'medium', 'low']),
  action: z.enum(['block', 'warn', 'log', 'escalate', 'auto_approve']),
  scope: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
})
export type GovernanceRule = z.infer<typeof GovernanceRuleSchema>

export const QualityGateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['test_coverage', 'lint', 'typecheck', 'security', 'performance', 'custom']),
  threshold: z.number().optional(),
  pass: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
})
export type QualityGate = z.infer<typeof QualityGateSchema>

export const BehaviorPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum([
    'decision',
    'collaboration',
    'escalation',
    'review',
    'testing',
    'deployment',
    'monitoring',
    'learning',
    'communication',
    'custom',
  ]),
  description: z.string().optional(),
  triggers: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
})
export type BehaviorPattern = z.infer<typeof BehaviorPatternSchema>

export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['action', 'decision', 'parallel', 'conditional', 'loop', 'gate']),
  description: z.string().optional(),
  agent: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  next: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  retries: z.number().optional(),
})
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>

export const DNAPackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  tags: z.array(z.string()).optional(),
  personas: z.array(AgentPersonaSchema),
  governance: z.array(GovernanceRuleSchema).optional(),
  quality: z.array(QualityGateSchema).optional(),
  patterns: z.array(BehaviorPatternSchema).optional(),
  workflows: z.array(WorkflowStepSchema).optional(),
  config: z.record(z.unknown()).optional(),
})
export type DNAPackage = z.infer<typeof DNAPackageSchema>

// --- Mission ---
export const MissionStatusSchema = z.enum([
  'draft',
  'queued',
  'planning',
  'executing',
  'review',
  'blocked',
  'completed',
  'failed',
  'cancelled',
])
export type MissionStatus = z.infer<typeof MissionStatusSchema>

export const MissionPrioritySchema = z.enum(['critical', 'high', 'medium', 'low'])
export type MissionPriority = z.infer<typeof MissionPrioritySchema>

export const MissionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['feature', 'bugfix', 'refactor', 'research', 'incident', 'experiment', 'custom']),
  priority: MissionPrioritySchema.default('medium'),
  status: MissionStatusSchema.default('draft'),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type Mission = z.infer<typeof MissionSchema>

// --- Agent State ---
export const AgentStatusSchema = z.enum([
  'idle',
  'working',
  'reviewing',
  'blocked',
  'waiting',
  'offline',
  'error',
])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

export const AgentStateSchema = z.object({
  id: z.string(),
  role: AgentRoleSchema,
  status: AgentStatusSchema.default('idle'),
  authority: AuthorityLevelSchema.default('junior'),
  currentMission: z.string().uuid().optional(),
  completedMissions: z.array(z.string().uuid()).default([]),
  reputation: z.number().min(0).max(100).default(50),
  metadata: z.record(z.unknown()).optional(),
})
export type AgentState = z.infer<typeof AgentStateSchema>

// --- Audit ---
export const AuditSeveritySchema = z.enum(['info', 'warning', 'error', 'critical'])
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>

export const AuditResultSchema = z.enum(['pass', 'fail', 'warn', 'skip'])
export type AuditResult = z.infer<typeof AuditResultSchema>

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.string(),
  severity: AuditSeveritySchema.default('info'),
  result: AuditResultSchema.default('pass'),
  agentId: z.string().optional(),
  missionId: z.string().uuid().optional(),
  description: z.string(),
  details: z.record(z.unknown()).optional(),
  suggestions: z.array(z.string()).optional(),
})
export type AuditEvent = z.infer<typeof AuditEventSchema>

// --- Quality ---
export const QualityMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  threshold: z.number().optional(),
  passed: z.boolean().optional(),
  timestamp: z.string().datetime().optional(),
})
export type QualityMetric = z.infer<typeof QualityMetricSchema>

// --- Learning ---
export const LearningEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.enum(['observation', 'pattern', 'insight', 'feedback', 'correction']),
  source: z.string(),
  data: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).default(0.5),
  applied: z.boolean().default(false),
})
export type LearningEvent = z.infer<typeof LearningEventSchema>

// --- Compiler ---
export const CompilerConfigSchema = z.object({
  source: z.string(),
  output: z.string(),
  format: z.enum(['yaml', 'json']).default('yaml'),
  validate: z.boolean().default(true),
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false),
})
export type CompilerConfig = z.infer<typeof CompilerConfigSchema>

// --- SDK Config ---
export const BehaviorOSConfigSchema = z.object({
  dnaPath: z.string().optional(),
  dnaPackage: DNAPackageSchema.optional(),
  governance: z
    .object({
      enabled: z.boolean().default(true),
      level: z.enum(['strict', 'standard', 'relaxed']).default('standard'),
      requireApproval: z.boolean().default(true),
      maxAgents: z.number().default(10),
    })
    .optional(),
  quality: z
    .object({
      enabled: z.boolean().default(true),
      minCoverage: z.number().default(80),
      enforceTypecheck: z.boolean().default(true),
      enforceLint: z.boolean().default(true),
    })
    .optional(),
  learning: z
    .object({
      enabled: z.boolean().default(true),
      persistPath: z.string().optional(),
      autoApply: z.boolean().default(false),
    })
    .optional(),
  audit: z
    .object({
      enabled: z.boolean().default(true),
      stages: z
        .array(z.enum([
          'static',
          'architecture',
          'security',
          'performance',
          'tests',
          'coverage',
          'contracts',
          'docs',
          'compliance',
          'benchmarks',
        ]))
        .optional(),
    })
    .optional(),
})
export type BehaviorOSConfig = z.infer<typeof BehaviorOSConfigSchema>
