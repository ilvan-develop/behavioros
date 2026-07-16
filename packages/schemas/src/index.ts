import { z } from 'zod';

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
  'orchestrator',
  'knowledge',
]);
export type AgentRole = z.infer<typeof AgentRoleSchema>;

export const AuthorityLevelSchema = z.enum([
  'junior',
  'senior',
  'architect',
  'lead',
  'director',
  'vp',
  'c-level',
]);
export type AuthorityLevel = z.infer<typeof AuthorityLevelSchema>;

export const BoundaryRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['max_files', 'max_lines', 'max_modules', 'require_approval', 'forbidden']),
  value: z.union([z.number(), z.string(), z.boolean()]),
  scope: z.enum(['per_commit', 'per_pr', 'per_session', 'global']),
});
export type BoundaryRule = z.infer<typeof BoundaryRuleSchema>;

export const AgentPersonaSchema = z.object({
  role: AgentRoleSchema,
  authority: AuthorityLevelSchema,
  name: z.string().optional(),
  description: z.string().optional(),
  boundaries: z.array(BoundaryRuleSchema).optional(),
  skills: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
});
export type AgentPersona = z.infer<typeof AgentPersonaSchema>;

export const VotingStrategySchema = z.enum([
  'unanimous',
  'majority',
  'weighted',
  'byzantine',
  'quorum',
]);
export type VotingStrategy = z.infer<typeof VotingStrategySchema>;

export const GovernanceRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  level: z.enum(['critical', 'high', 'medium', 'low']),
  action: z.enum(['block', 'warn', 'log', 'escalate', 'auto_approve']),
  scope: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
});
export type GovernanceRule = z.infer<typeof GovernanceRuleSchema>;

export const QualityGateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['test_coverage', 'lint', 'typecheck', 'security', 'performance', 'custom']),
  threshold: z.number().optional(),
  pass: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});
export type QualityGate = z.infer<typeof QualityGateSchema>;

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
});
export type BehaviorPattern = z.infer<typeof BehaviorPatternSchema>;

// --- BOS DNA Behavioral Pattern (11 catalog patterns) ---

export const PrincipleSchema = z.object({
  id: z.string(),
  statement: z.string(),
  priority: z.enum(['must', 'should', 'maybe']),
  rationale: z.string(),
});
export type Principle = z.infer<typeof PrincipleSchema>;

export const ForbiddenActionSchema = z.object({
  id: z.string(),
  action: z.string(),
  consequence: z.enum(['block', 'halt', 'escalate', 'warn']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});
export type ForbiddenAction = z.infer<typeof ForbiddenActionSchema>;

export const PersonalitySchema = z
  .object({
    communication: z
      .object({
        type: z.string().optional(),
        urgency: z.object({ default: z.string() }).optional(),
        detail_level: z.object({ default: z.string() }).optional(),
        tone: z.object({ default: z.string() }).optional(),
      })
      .optional(),
    formality: z.string().optional(),
    expressiveness: z.string().optional(),
  })
  .catchall(z.unknown());
export type Personality = z.infer<typeof PersonalitySchema>;

export const AutonomySchema = z.object({
  can_decide: z.array(z.string()).optional(),
  must_ask: z.array(z.string()).optional(),
  never_do: z.array(z.string()).optional(),
  escalation_triggers: z
    .array(
      z.object({
        condition: z.string(),
        action: z.string(),
      }),
    )
    .optional(),
});
export type Autonomy = z.infer<typeof AutonomySchema>;

export const DNABehavioralPatternSchema = z.object({
  meta: z.object({
    version: z.string(),
    schema: z.string().optional(),
    description: z.string().optional(),
  }),
  identity: z.object({
    name: z.string(),
    description: z.string(),
    archetype: z.string(),
    category: z.string(),
    version: z.string().optional(),
  }),
  personality: PersonalitySchema.optional(),
  principles: z.array(PrincipleSchema).optional(),
  forbidden: z.array(ForbiddenActionSchema).optional(),
  decision_model: z.record(z.unknown()).optional(),
  communication: z.record(z.unknown()).optional(),
  autonomy: AutonomySchema.optional(),
  risk_tolerance: z.string().optional(),
  parallelism: z.record(z.unknown()).optional(),
  quality_gates: z.record(z.unknown()).optional(),
  learning: z.record(z.unknown()).optional(),
});
export type DNABehavioralPattern = z.infer<typeof DNABehavioralPatternSchema>;

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
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const AgentMappingSchema = z.record(
  z.string(),
  z.object({
    role: AgentRoleSchema,
    authority: AuthorityLevelSchema,
    opencode_agents: z.array(z.string()),
  }),
);
export type AgentMapping = z.infer<typeof AgentMappingSchema>;

export const DNAPackageSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  tags: z.array(z.string()).optional(),
  personas: z.array(AgentPersonaSchema).min(1),
  governance: z.array(GovernanceRuleSchema).optional(),
  quality: z.array(QualityGateSchema).optional(),
  patterns: z.array(BehaviorPatternSchema).optional(),
  workflows: z.array(WorkflowStepSchema).optional(),
  agent_mapping: AgentMappingSchema.optional(),
  config: z.record(z.unknown()).optional(),
});
export type DNAPackage = z.infer<typeof DNAPackageSchema>;

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
]);
export type MissionStatus = z.infer<typeof MissionStatusSchema>;

export const MissionPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type MissionPriority = z.infer<typeof MissionPrioritySchema>;

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
});
export type Mission = z.infer<typeof MissionSchema>;

// --- Agent State ---
export const AgentStatusSchema = z.enum([
  'idle',
  'working',
  'reviewing',
  'blocked',
  'waiting',
  'offline',
  'error',
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentStateSchema = z.object({
  id: z.string(),
  role: AgentRoleSchema,
  status: AgentStatusSchema.default('idle'),
  authority: AuthorityLevelSchema.default('junior'),
  currentMission: z.string().uuid().optional(),
  completedMissions: z.array(z.string().uuid()).default([]),
  reputation: z.number().min(0).max(100).default(50),
  metadata: z.record(z.unknown()).optional(),
});
export type AgentState = z.infer<typeof AgentStateSchema>;

// --- Audit ---
export const AuditSeveritySchema = z.enum(['info', 'warning', 'error', 'critical']);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

export const AuditResultSchema = z.enum(['pass', 'fail', 'warn', 'skip']);
export type AuditResult = z.infer<typeof AuditResultSchema>;

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
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// --- Quality ---
export const QualityMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  threshold: z.number().optional(),
  passed: z.boolean().optional(),
  timestamp: z.string().datetime().optional(),
});
export type QualityMetric = z.infer<typeof QualityMetricSchema>;

// --- Learning ---
export const LearningEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  type: z.enum(['observation', 'pattern', 'insight', 'feedback', 'correction']),
  source: z.string(),
  data: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).default(0.5),
  applied: z.boolean().default(false),
});
export type LearningEvent = z.infer<typeof LearningEventSchema>;

// --- Compiler ---
export const CompilerConfigSchema = z.object({
  source: z.string(),
  output: z.string(),
  format: z.enum(['yaml', 'json']).default('yaml'),
  validate: z.boolean().default(true),
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false),
});
export type CompilerConfig = z.infer<typeof CompilerConfigSchema>;

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
        .array(
          z.enum([
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
          ]),
        )
        .optional(),
    })
    .optional(),
});
export type BehaviorOSConfig = z.infer<typeof BehaviorOSConfigSchema>;

// ============================================================
// EAARG Extension — Enterprise Agent Architecture Review Guide
// ============================================================

export const DiscoveryQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  category: z.enum(['functional', 'non_functional', 'architecture', 'security', 'quality']),
  required: z.boolean().default(true),
  followUp: z.array(z.string()).optional(),
});
export type DiscoveryQuestion = z.infer<typeof DiscoveryQuestionSchema>;

export const RequiredEvidenceSchema = z.object({
  id: z.string(),
  type: z.enum(['file', 'commit', 'test', 'report', 'log', 'diagram', 'config', 'manual']),
  description: z.string(),
  location: z.string().optional(),
  required: z.boolean().default(true),
});
export type RequiredEvidence = z.infer<typeof RequiredEvidenceSchema>;

export const LayerCriteriaSchema = z.object({
  id: z.string(),
  description: z.string(),
  weight: z.number().min(0).max(1).default(1),
});
export type LayerCriteria = z.infer<typeof LayerCriteriaSchema>;

export const ConversationProtocolSchema = z.object({
  area: z.string(),
  status: z.enum(['pending', 'in_progress', 'partial', 'complete', 'blocked']),
  completionPercent: z.number().min(0).max(100),
  completedItems: z.array(z.string()),
  pendingItems: z.array(z.string()),
  technicalDebts: z.array(z.string()),
  risks: z.array(z.string()),
  blockers: z.array(z.string()),
  evidence: z.array(z.string()),
  acceptanceCriteria: z.array(LayerCriteriaSchema),
  nextActions: z.array(z.string()),
  recommendation: z.enum(['proceed', 'fix', 'revalidate', 'approve_for_production']),
});
export type ConversationProtocol = z.infer<typeof ConversationProtocolSchema>;

export const SkillReferenceSchema = z.object({
  skillId: z.string(),
  skillName: z.string(),
  description: z.string(),
  required: z.boolean().default(true),
  weight: z.number().min(0).max(1).default(1),
});
export type SkillReference = z.infer<typeof SkillReferenceSchema>;

export const EAARGStepSchema = WorkflowStepSchema.extend({
  layer: z.number().min(1).max(18),
  layerName: z.string(),
  objectives: z.array(z.string()),
  questions: z.array(DiscoveryQuestionSchema),
  requiredEvidence: z.array(RequiredEvidenceSchema),
  acceptanceCriteria: z.array(LayerCriteriaSchema),
  rejectionCriteria: z.array(LayerCriteriaSchema),
  checklist: z.array(z.string()),
  nextSteps: z.array(z.string()),
  skills: z.array(SkillReferenceSchema).default([]),
});
export type EAARGStep = z.infer<typeof EAARGStepSchema>;

export const LayerResultSchema = z.object({
  layer: z.number(),
  layerName: z.string(),
  status: z.enum(['pending', 'in_progress', 'pass', 'fail', 'skip']),
  score: z.number().min(0).max(100),
  protocol: ConversationProtocolSchema,
  evidenceCollected: z.array(z.string()),
  questionsAnswered: z.number(),
  questionsTotal: z.number(),
  criteriaMet: z.number(),
  criteriaTotal: z.number(),
  skillsUsed: z.array(z.string()).default([]),
  skillsScore: z.number().min(0).max(100).optional(),
  duration: z.number(),
  timestamp: z.string().datetime(),
});
export type LayerResult = z.infer<typeof LayerResultSchema>;

export const PipelineStateSchema = z.object({
  id: z.string().uuid(),
  dnaId: z.string(),
  status: z.enum(['created', 'running', 'paused', 'completed', 'failed']),
  currentLayer: z.number().optional(),
  layers: z.array(LayerResultSchema),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  overallScore: z.number().min(0).max(100),
  overallStatus: z.enum(['pending', 'pass', 'fail', 'partial']),
});
export type PipelineState = z.infer<typeof PipelineStateSchema>;

export const PipelineReportSchema = z.object({
  pipelineId: z.string().uuid(),
  dnaId: z.string(),
  totalLayers: z.number(),
  completedLayers: z.number(),
  passedLayers: z.number(),
  failedLayers: z.number(),
  skippedLayers: z.number(),
  overallScore: z.number().min(0).max(100),
  overallStatus: z.enum(['pending', 'pass', 'fail', 'partial']),
  layers: z.array(LayerResultSchema),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  duration: z.number(),
  timestamp: z.string().datetime(),
});
export type PipelineReport = z.infer<typeof PipelineReportSchema>;
